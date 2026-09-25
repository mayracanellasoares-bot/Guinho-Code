"""Protect the phone-hosted Eliza app before allowing a public tunnel."""
import base64
import http.client
import importlib.util
import json
from pathlib import Path
import threading
import unittest
from unittest import mock

SRC = Path(__file__).resolve().parents[1] / "eliza-dev-pwa" / "eliza_server_clip.py"
spec = importlib.util.spec_from_file_location("eliza_public_test", SRC)
eliza = importlib.util.module_from_spec(spec)
spec.loader.exec_module(eliza)


class SecurityTests(unittest.TestCase):
    def setUp(self):
        self.patch_auth = mock.patch.object(eliza, "REQUIRE_AUTH", True)
        self.patch_user = mock.patch.object(eliza, "ACCESS_USER", "tester")
        self.patch_pass = mock.patch.object(eliza, "ACCESS_PASSWORD", "a-long-private-password")
        for p in (self.patch_auth, self.patch_user, self.patch_pass):
            p.start()
            self.addCleanup(p.stop)
        self.server = eliza.ThreadingHTTPServer(("127.0.0.1", 0), eliza.Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.close_server)

    def close_server(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=3)

    def request(self, method, path, *, auth=False, origin=None, body=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        headers = {}
        if auth:
            credentials = base64.b64encode(b"tester:a-long-private-password").decode()
            headers["Authorization"] = "Basic " + credentials
        if origin is not None:
            headers["Origin"] = origin
        if body is not None:
            headers["Content-Type"] = "application/json"
        try:
            conn.request(method, path, body=body, headers=headers)
            response = conn.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            conn.close()

    def test_every_route_requires_login(self):
        for method, path in (("GET", "/"), ("GET", "/api/models"), ("GET", "/sw.js"),
                             ("POST", "/api/chat"), ("POST", "/api/package")):
            with self.subTest(method=method, path=path):
                status, headers, _ = self.request(method, path)
                self.assertEqual(status, 401)
                self.assertIn("Basic ", headers["WWW-Authenticate"])

    def test_local_authenticated_ui(self):
        status, headers, body = self.request("GET", "/?v=3", auth=True)
        self.assertEqual(status, 200)
        self.assertIn(b"Eliza Dev", body)
        self.assertIn(b'id="history"', body)
        self.assertIn(b'id="model"', body)
        self.assertIn(b'id="files"', body)
        self.assertIn(b"elizaDevChatsV4", body)
        self.assertEqual(headers["Cache-Control"], "no-store")

    def test_cross_site_write_rejected(self):
        status, _, body = self.request("POST", "/api/chat", auth=True,
                origin="https://untrusted.example", body=b'{"model":"auto","messages":[]}')
        self.assertEqual(status, 403)
        self.assertIn(b"Origem", body)

    def test_busy_mobile_server_returns_429(self):
        self.assertTrue(eliza.INFERENCE_SLOT.acquire(blocking=False))
        self.addCleanup(eliza.INFERENCE_SLOT.release)
        status, _, body = self.request("POST", "/api/chat", auth=True,
                body=b'{"model":"auto","messages":[]}')
        self.assertEqual(status, 429)
        self.assertIn(b"Uma gera", body)

    def test_cloud_model_can_be_disabled(self):
        def catalog(url, *args, **kwargs):
            if url.endswith("/models"):
                return {"ok": True, "models": []}
            return {"models": [{"name": "gemma4:31b-cloud"},
                               {"name": "smollm2:360m"}]}
        with mock.patch.object(eliza, "ALLOW_CLOUD", False), mock.patch.object(eliza, "get_json", side_effect=catalog):
            result = eliza.models_catalog()
        choices = result["choices"]
        self.assertNotIn("gemma_cloud", choices)
        self.assertIn("smol", choices)


if __name__ == "__main__":
    unittest.main()
