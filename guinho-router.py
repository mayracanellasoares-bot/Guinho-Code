#!/usr/bin/env python3
"""Local Guinho model router for Termux/llama.cpp.

The router exposes one OpenAI-compatible endpoint on 127.0.0.1:8090. It
selects one GGUF model for each request, keeps only that model loaded in
llama-server, and proxies the response from 127.0.0.1:8080.

No third-party Python package is required. The router is intentionally bound
to localhost; it is not a public internet server.
"""

from __future__ import annotations

import atexit
import json
import os
import re
import signal
import subprocess
import threading
import time
import urllib.error
import urllib.request
from http import HTTPStatus
from http.client import HTTPConnection
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


ROUTER_HOST = os.environ.get("GUINHO_ROUTER_HOST", "127.0.0.1")
ROUTER_PORT = int(os.environ.get("GUINHO_ROUTER_PORT", "8090"))
LLAMA_HOST = os.environ.get("GUINHO_LLAMA_HOST", "127.0.0.1")
LLAMA_PORT = int(os.environ.get("GUINHO_LLAMA_PORT", "8080"))
LLAMA_BIN = Path(
    os.environ.get(
        "GUINHO_LLAMA_BIN",
        str(Path.home() / "llama.cpp" / "build-vulkan" / "bin" / "llama-server"),
    )
).expanduser()
MODEL_DIR = Path(
    os.environ.get("GUINHO_MODEL_DIR", str(Path.home() / "storage" / "downloads" / "I.As"))
).expanduser()
CONTEXT_SIZE = os.environ.get("GUINHO_CONTEXT", "4096")
MAX_CONTEXT_CHARS = int(
    os.environ.get("GUINHO_MAX_CONTEXT_CHARS", str(int(CONTEXT_SIZE) * 3))
)
GPU_LAYERS = os.environ.get("GUINHO_GPU_LAYERS", "99")
START_TIMEOUT = float(os.environ.get("GUINHO_START_TIMEOUT", "120"))

MODELS = {
    "qwen": MODEL_DIR / "qwen2.5-coder-1.5b-instruct-q4_k_m.gguf",
    "nemotron": MODEL_DIR / "NVIDIA-Nemotron3-Nano-4B-Q4_K_M.gguf",
    "gemma": MODEL_DIR / "gemma-3-270m-it-UD-Q8_K_XL.gguf",
}

CODE_TERMS = re.compile(
    r"\b(c[oó]digo|programa|programar|script|bug|erro|debug|html|css|javascript|typescript|python|java|c\+\+|c#|sql|json|yaml|xml|api|github|git|npm|pip|docker|vercel|pwa|canvas|react|vue|classe|fun[cç][aã]o|algoritmo|terminal|compilar|compile|deploy|banco de dados|regex)\b",
    re.IGNORECASE,
)
GENERAL_TERMS = re.compile(
    r"\b(analise|an[aá]lise|explique|explica|planeje|planejamento|resuma|resumo|compare|compara|estrat[eé]gia|decis[aã]o|documento|hist[oó]ria|direito|argumento|pesquisa|relat[oó]rio|proposta|avalie|avalia[cç][aã]o|por que|por qu[eê])\b",
    re.IGNORECASE,
)
SIMPLE_TERMS = re.compile(
    r"\b(oi|ol[aá]|olá|obrigad[oa]|valeu|tchau|teste|status|defina|defini[cç][aã]o|significado|quanto|quem [eé]|qual [eé])\b",
    re.IGNORECASE,
)

PROCESS_LOCK = threading.RLock()
ACTIVE_PROCESS: subprocess.Popen[bytes] | None = None
ACTIVE_MODEL: str | None = None
LOG_HANDLE: Any = None


def _text_from_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
        return " ".join(parts)
    return ""


def _latest_user_text(messages: Any) -> str:
    if not isinstance(messages, list):
        return ""
    for item in reversed(messages):
        if isinstance(item, dict) and item.get("role") == "user":
            return _text_from_content(item.get("content"))
    return ""


def compact_messages(messages: Any) -> list[dict[str, str]]:
    """Keep the system prompt and newest turns within the model context.

    llama-server rejects requests whose prompt is larger than ``-c``. The
    browser keeps a long system prompt plus conversation history, so trimming
    here is safer than returning a context-size error to the user.
    """

    if not isinstance(messages, list):
        return []
    normalized: list[dict[str, str]] = []
    for item in messages:
        if not isinstance(item, dict) or item.get("role") not in {"system", "user", "assistant"}:
            continue
        content = _text_from_content(item.get("content")).strip()
        if content:
            normalized.append({"role": item["role"], "content": content})
    if not normalized:
        return []

    budget = max(6000, MAX_CONTEXT_CHARS)
    system = next((item for item in normalized if item["role"] == "system"), None)
    turns = [item for item in normalized if item is not system]
    result_system: dict[str, str] | None = None
    remaining = budget
    if system is not None:
        system_limit = min(len(system["content"]), max(2000, budget // 2))
        result_system = {"role": "system", "content": system["content"][:system_limit]}
        remaining -= len(result_system["content"])

    selected: list[dict[str, str]] = []
    for item in reversed(turns):
        if remaining <= 0:
            break
        content = item["content"]
        take = min(len(content), remaining)
        if take <= 0:
            break
        selected.append(
            {
                "role": item["role"],
                "content": content[:take] + ("\n[contexto anterior truncado]" if take < len(content) else ""),
            }
        )
        remaining -= take
    selected.reverse()
    return ([result_system] if result_system else []) + selected


def choose_model(messages: Any) -> tuple[str, dict[str, int]]:
    """Choose a model using explicit commands first, then weighted intent cues."""

    text = _latest_user_text(messages).strip()
    lowered = text.casefold()
    explicit = re.search(r"(?:^|\s)/(qwen|nemotron|gemma)(?:\s|$)", lowered)
    if explicit:
        return explicit.group(1), {explicit.group(1): 100}

    scores = {"qwen": 0, "nemotron": 0, "gemma": 0}
    if CODE_TERMS.search(text):
        scores["qwen"] += 6
    if "```" in text or re.search(r"\.(html?|css|js|ts|py|java|cpp|cs|sql)\b", lowered):
        scores["qwen"] += 5
    if GENERAL_TERMS.search(text):
        scores["nemotron"] += 5
    if SIMPLE_TERMS.search(text):
        scores["gemma"] += 3
    if len(text) <= 160:
        scores["gemma"] += 1
    if len(text) >= 700:
        scores["nemotron"] += 2

    # Coding signals take precedence over generic words such as "qual é".
    if scores["qwen"]:
        return "qwen", scores
    if scores["nemotron"]:
        return "nemotron", scores
    if scores["gemma"]:
        return "gemma", scores
    return "nemotron", scores


def _health_url() -> str:
    return f"http://{LLAMA_HOST}:{LLAMA_PORT}/health"


def backend_healthy() -> bool:
    try:
        with urllib.request.urlopen(_health_url(), timeout=1.5) as response:
            return response.status == HTTPStatus.OK
    except (OSError, urllib.error.URLError):
        return False


def stop_backend() -> None:
    global ACTIVE_PROCESS, ACTIVE_MODEL, LOG_HANDLE
    process = ACTIVE_PROCESS
    ACTIVE_PROCESS = None
    ACTIVE_MODEL = None
    if process is not None and process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=8)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
    if LOG_HANDLE is not None:
        LOG_HANDLE.close()
        LOG_HANDLE = None


def start_backend(model_name: str) -> None:
    global ACTIVE_PROCESS, ACTIVE_MODEL, LOG_HANDLE
    model_path = MODELS[model_name]
    if not model_path.is_file():
        raise RuntimeError(f"Modelo não encontrado: {model_path}")
    if not LLAMA_BIN.is_file() or not os.access(LLAMA_BIN, os.X_OK):
        raise RuntimeError(f"llama-server Vulkan não encontrado ou sem permissão: {LLAMA_BIN}")

    # Never silently take over an unrelated process that already owns 8080.
    if backend_healthy():
        raise RuntimeError(
            f"A porta {LLAMA_PORT} já está ocupada por outro llama-server. "
            "Encerre-o antes de iniciar o roteador."
        )

    log_path = Path.home() / "guinho-llama.log"
    LOG_HANDLE = log_path.open("ab", buffering=0)
    command = [
        str(LLAMA_BIN),
        "-m",
        str(model_path),
        "-c",
        CONTEXT_SIZE,
        "-np",
        "1",
        "-ngl",
        GPU_LAYERS,
        "--host",
        LLAMA_HOST,
        "--port",
        str(LLAMA_PORT),
    ]
    ACTIVE_PROCESS = subprocess.Popen(
        command,
        stdout=LOG_HANDLE,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    deadline = time.monotonic() + START_TIMEOUT
    while time.monotonic() < deadline:
        if ACTIVE_PROCESS.poll() is not None:
            raise RuntimeError(
                f"llama-server encerrou ao iniciar {model_name}. "
                f"Consulte {log_path}."
            )
        if backend_healthy():
            ACTIVE_MODEL = model_name
            return
        time.sleep(0.5)
    stop_backend()
    raise RuntimeError(f"Tempo esgotado aguardando o modelo {model_name} carregar.")


def ensure_model(model_name: str) -> None:
    with PROCESS_LOCK:
        if ACTIVE_MODEL == model_name and ACTIVE_PROCESS is not None and ACTIVE_PROCESS.poll() is None and backend_healthy():
            return
        stop_backend()
        start_backend(model_name)


def json_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False).encode("utf-8")


class RouterHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, format: str, *args: Any) -> None:
        # Keep the Termux output short; llama-server details are in the log file.
        print(f"[guinho-router] {self.address_string()} - {format % args}", flush=True)

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Guinho-Model")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def _send_json(self, value: Any, status: int = 200, model: str | None = None) -> None:
        payload = json_bytes(value)
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        if model:
            self.send_header("X-Guinho-Model", model)
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:
        if self.path == "/":
            self._send_json(
                {
                    "ok": True,
                    "service": "Guinho local router",
                    "router": f"http://{ROUTER_HOST}:{ROUTER_PORT}",
                    "health": "/health",
                    "chat": "/v1/chat/completions",
                    "activeModel": ACTIVE_MODEL,
                }
            )
            return
        if self.path != "/health":
            self._send_json({"ok": False, "error": "not_found"}, 404)
            return
        process_alive = ACTIVE_PROCESS is not None and ACTIVE_PROCESS.poll() is None
        self._send_json(
            {
                "ok": True,
                "status": "ok",
                "router": "ready",
                "activeModel": ACTIVE_MODEL,
                "backend": "vulkan",
                "processAlive": process_alive,
            }
        )

    def _read_payload(self) -> dict[str, Any] | None:
        raw_length = self.headers.get("Content-Length", "0")
        try:
            length = int(raw_length)
        except ValueError:
            self._send_json({"ok": False, "error": "invalid_content_length"}, 400)
            return None
        if length <= 0 or length > 8 * 1024 * 1024:
            self._send_json({"ok": False, "error": "request_too_large_or_empty"}, 413)
            return None
        try:
            value = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._send_json({"ok": False, "error": "invalid_json"}, 400)
            return None
        if not isinstance(value, dict) or not isinstance(value.get("messages"), list) or not value["messages"]:
            self._send_json({"ok": False, "error": "messages_must_be_an_array"}, 400)
            return None
        return value

    def do_POST(self) -> None:
        if self.path != "/v1/chat/completions":
            self._send_json({"ok": False, "error": "not_found"}, 404)
            return
        payload = self._read_payload()
        if payload is None:
            return
        model_name, scores = choose_model(payload["messages"])
        payload["messages"] = compact_messages(payload["messages"])
        try:
            # Serializes switching and inference so a second request cannot kill
            # the model while the first request is still receiving its stream.
            with PROCESS_LOCK:
                ensure_model(model_name)
                payload["model"] = model_name
                self._proxy(payload, model_name, scores)
        except Exception as error:  # noqa: BLE001 - return a useful local API error
            self._send_json(
                {
                    "ok": False,
                    "error": "local_model_unavailable",
                    "message": str(error),
                    "model": model_name,
                    "scores": scores,
                },
                503,
                model_name,
            )

    def _proxy(self, payload: dict[str, Any], model_name: str, scores: dict[str, int]) -> None:
        body = json_bytes(payload)
        connection = HTTPConnection(LLAMA_HOST, LLAMA_PORT, timeout=180)
        try:
            connection.request(
                "POST",
                "/v1/chat/completions",
                body=body,
                headers={"Content-Type": "application/json", "Accept": "text/event-stream"},
            )
            response = connection.getresponse()
            if response.status >= 400:
                detail = response.read(256 * 1024).decode("utf-8", "replace")
                self._send_json(
                    {"ok": False, "error": "llama_server_error", "status": response.status, "detail": detail},
                    502,
                    model_name,
                )
                return

            self.send_response(response.status)
            self._cors()
            content_type = response.getheader("Content-Type") or "application/json; charset=utf-8"
            self.send_header("Content-Type", content_type)
            self.send_header("Cache-Control", "no-cache")
            self.send_header("X-Guinho-Model", model_name)
            self.send_header("X-Guinho-Scores", json.dumps(scores, separators=(",", ":")))
            # SSE has no Content-Length; close this downstream response so the
            # browser can observe the end of the stream without hanging.
            self.send_header("Connection", "close")
            self.close_connection = True
            # Do not forward upstream Transfer-Encoding/Connection headers.
            content_length = response.getheader("Content-Length")
            if content_length and "text/event-stream" not in content_type:
                self.send_header("Content-Length", content_length)
            self.end_headers()
            while True:
                chunk = response.read(64 * 1024)
                if not chunk:
                    break
                self.wfile.write(chunk)
                self.wfile.flush()
        finally:
            connection.close()


def shutdown(*_: Any) -> None:
    stop_backend()


class ReusableThreadingHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


atexit.register(stop_backend)
signal.signal(signal.SIGTERM, shutdown)
signal.signal(signal.SIGINT, shutdown)


if __name__ == "__main__":
    print(f"Guinho Router: http://{ROUTER_HOST}:{ROUTER_PORT}", flush=True)
    print(f"llama-server: {LLAMA_BIN}", flush=True)
    print(f"modelos: {MODEL_DIR}", flush=True)
    print("O primeiro pedido iniciará o modelo adequado.", flush=True)
    server = ReusableThreadingHTTPServer((ROUTER_HOST, ROUTER_PORT), RouterHandler)
    try:
        server.serve_forever()
    finally:
        server.server_close()
        shutdown()

