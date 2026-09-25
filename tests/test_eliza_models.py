"""Unit tests for installed Termux GGUF discovery and manual/automatic routing."""
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("guinho_router", ROOT / "guinho-router.py")
router = importlib.util.module_from_spec(spec)
spec.loader.exec_module(router)


class LocalModelTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        models = {name: self.directory / f"{name}.gguf" for name in router.MODEL_LABELS}
        self.model_patch = mock.patch.object(router, "MODEL_DIR", self.directory)
        self.models_patch = mock.patch.object(router, "MODELS", models)
        self.home_patch = mock.patch.object(router.Path, "home", return_value=self.directory)
        self.env_patch = mock.patch.dict(os.environ, {
            key: "" for key in router.MODEL_ENV_KEYS.values()
        })
        for patcher in (self.model_patch, self.models_patch, self.home_patch, self.env_patch):
            patcher.start()
            self.addCleanup(patcher.stop)

    def install(self, name):
        path = self.directory / name
        path.write_bytes(b"GGUF")
        return path

    def test_discovers_smol_without_known_full_filename(self):
        gemma = self.install("gemma-3-270m-it-q8.gguf")
        smol = self.install("SmolLM2-360M-Instruct-Q4_K_M.gguf")
        models = router.discover_models()
        self.assertEqual(models["gemma"], gemma)
        self.assertEqual(models["smol"], smol)
        catalog = {entry["id"]: entry for entry in router.model_catalog(models)}
        self.assertTrue(catalog["smol"]["available"])
        self.assertEqual(catalog["smol"]["filename"], smol.name)
        self.assertFalse(catalog["qwen"]["available"])

    def test_explicit_selection_stays_on_user_model(self):
        messages = [{"role": "user", "content": "Escreva código Python"}]
        name, scores = router.choose_model(messages, "smol", {"gemma", "smol", "qwen"})
        self.assertEqual(name, "smol")
        self.assertEqual(scores["smol"], 100)

    def test_missing_explicit_model_returns_error_instead_of_substituting(self):
        with self.assertRaisesRegex(ValueError, "não encontrado"):
            router.choose_model([{"role": "user", "content": "Oi"}], "smol", {"gemma"})

    def test_auto_falls_back_to_available_model(self):
        name, _ = router.choose_model([{"role": "user", "content": "Código JavaScript"}], "auto", {"smol", "gemma"})
        self.assertEqual(name, "smol")
        name, _ = router.choose_model([{"role": "user", "content": "Oi"}], "auto", {"smol", "gemma"})
        self.assertEqual(name, "gemma")

    def test_no_installed_models_is_not_reported_as_online(self):
        with self.assertRaisesRegex(ValueError, "Nenhum modelo local"):
            router.choose_model([{"role": "user", "content": "Oi"}], "auto", set())

    def test_explicit_file_override(self):
        external = self.install("actual-model.gguf")
        with mock.patch.dict(os.environ, {"GUINHO_SMOL_MODEL": str(external)}):
            self.assertEqual(router.discover_models()["smol"], external)
        with mock.patch.dict(os.environ, {"GUINHO_SMOL_MODEL": str(self.directory / "missing.gguf")}):
            self.assertNotIn("smol", router.discover_models())


if __name__ == "__main__":
    unittest.main()
