"""Integration tests for local Ollama catalog and OpenAI-compatible forwarding."""
import http.client
import importlib.util
import json
from pathlib import Path
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("guinho_router_ollama", ROOT / "guinho-router.py")
router = importlib.util.module_from_spec(spec)
spec.loader.exec_module(router)

INSTALLED = {
    "models": [
        {"name": "smollm2:360m", "size": 725000000},
        {"name": "smollm2:135m", "size": 270000000},
        {"name": "gemma3:270m", "size": 291000000},
        {"name": "gemma4:31b-cloud", "size": 0},
    ]
}


class FakeOllama(BaseHTTPRequestHandler):
    received = []

    def log_message(self, *_):
        return

    def do_GET(self):
        if self.path != "/api/tags":
            self.send_error(404)
            return
        body = json.dumps(INSTALLED).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != "/v1/chat/completions":
            self.send_error(404)
            return
        size = int(self.headers.get("Content-Length", "0"))
        data = json.loads(self.rfile.read(size))
        self.received.append(data)
        body = json.dumps({
            "choices": [{"message": {"role": "assistant", "content": "Ollama local OK"}}]
        }).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class OllamaRouterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ollama = ThreadingHTTPServer(("127.0.0.1", 0), FakeOllama)
        cls.ollama_thread = threading.Thread(target=cls.ollama.serve_forever, daemon=True)
        cls.ollama_thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.ollama.shutdown()
        cls.ollama.server_close()
        cls.ollama_thread.join(timeout=3)

    def setUp(self):
        FakeOllama.received.clear()
        self.patch_host = mock.patch.object(router, "OLLAMA_HOST", "127.0.0.1")
        self.patch_port = mock.patch.object(router, "OLLAMA_PORT", self.ollama.server_port)
        self.patch_gguf = mock.patch.object(router, "discover_models", return_value={})
        for patcher in (self.patch_host, self.patch_port, self.patch_gguf):
            patcher.start()
            self.addCleanup(patcher.stop)
        self.router = router.ReusableThreadingHTTPServer(("127.0.0.1", 0), router.RouterHandler)
        self.thread = threading.Thread(target=self.router.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.close_router)

    def close_router(self):
        self.router.shutdown()
        self.router.server_close()
        self.thread.join(timeout=3)

    def get_json(self, path):
        connection = http.client.HTTPConnection("127.0.0.1", self.router.server_port, timeout=5)
        try:
            connection.request("GET", path)
            response = connection.getresponse()
            result = response.status, json.loads(response.read())
            return result
        finally:
            connection.close()

    def post_chat(self, model):
        connection = http.client.HTTPConnection("127.0.0.1", self.router.server_port, timeout=5)
        try:
            payload = json.dumps({"model": model, "messages": [
                {"role": "user", "content": "Crie código HTML"}
            ], "stream": False}).encode()
            connection.request("POST", "/v1/chat/completions", payload,
                               {"Content-Type": "application/json"})
            response = connection.getresponse()
            return response.status, response.getheader("X-Guinho-Provider"), json.loads(response.read())
        finally:
            connection.close()

    def test_catalog_marks_local_ollama_variants_not_cloud(self):
        code, data = self.get_json("/models")
        self.assertEqual(code, 200)
        catalog = {model["id"]: model for model in data["models"]}
        self.assertTrue(data["ollamaConnected"])
        for key in ("smol", "smol135", "gemma", "gemma_ollama"):
            self.assertTrue(catalog[key]["available"], key)
            self.assertEqual(catalog[key]["source"], "ollama")
        self.assertFalse(catalog["nemotron"]["available"])
        self.assertFalse(any("cloud" in str(item["filename"]) for item in data["models"]))

    def test_each_manual_selection_forwards_exact_ollama_model(self):
        for model, tag in (("smol", "smollm2:360m"),
                           ("smol135", "smollm2:135m"),
                           ("gemma_ollama", "gemma3:270m")):
            with self.subTest(model=model):
                status, provider, answer = self.post_chat(model)
                self.assertEqual(status, 200)
                self.assertEqual(provider, "ollama")
                self.assertEqual(FakeOllama.received[-1]["model"], tag)
                self.assertEqual(answer["choices"][0]["message"]["content"], "Ollama local OK")

    def test_missing_model_does_not_silently_switch(self):
        status, provider, data = self.post_chat("nemotron")
        self.assertEqual(status, 400)
        self.assertIsNone(provider)
        self.assertEqual(data["error"], "model_selection_failed")
        self.assertEqual(len(FakeOllama.received), 0)

    def test_automatic_code_routing_uses_installed_smol(self):
        status, provider, _ = self.post_chat("auto")
        self.assertEqual(status, 200)
        self.assertEqual(provider, "ollama")
        self.assertEqual(FakeOllama.received[0]["model"], "smollm2:360m")


if __name__ == "__main__":
    unittest.main()
