#!/usr/bin/env python3
"""Local Guinho model router for Termux/llama.cpp and Ollama.

The router exposes one OpenAI-compatible endpoint on 127.0.0.1:8090. It
routes installed GGUF files to llama-server on port 8080, or installed
Ollama model tags to Ollama on port 11434. Cloud tags are not selected.

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
OLLAMA_HOST = os.environ.get("GUINHO_OLLAMA_HOST", "127.0.0.1")
OLLAMA_PORT = int(os.environ.get("GUINHO_OLLAMA_PORT", "11434"))
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
    "smol": MODEL_DIR / "smol.gguf",  # discovered by filename; no rename needed
}

MODEL_LABELS = {
    "qwen": "Qwen Coder (GGUF)", "nemotron": "Nemotron Nano (GGUF)",
    "gemma": "Gemma 3 270M", "gemma_ollama": "Gemma 3 270M (Ollama)",
    "smol": "SmolLM2 360M", "smol135": "SmolLM2 135M",
}
OLLAMA_MODEL_TAGS = {
    "smol": "smollm2:360m",
    "smol135": "smollm2:135m",
    "gemma": "gemma3:270m",
    "gemma_ollama": "gemma3:270m",
}
MODEL_ENV_KEYS = {"qwen": "GUINHO_QWEN_MODEL", "nemotron": "GUINHO_NEMOTRON_MODEL",
                  "gemma": "GUINHO_GEMMA_MODEL", "smol": "GUINHO_SMOL_MODEL"}


def discover_models() -> dict[str, Path]:
    """Find installed GGUFs in the configured folder and common Termux folders.

    GUINHO_*_MODEL may point to an exact file. Existing model names remain
    supported; SmolLM GGUF names are detected without guessing their version.
    Only local paths are inspected. This does not download or execute files.
    """
    downloads = Path.home() / "storage" / "downloads"
    folders = (MODEL_DIR, downloads, downloads / "I.As", Path.home() / "models", Path.home())
    files: dict[str, Path] = {}
    for folder in folders:
        if not folder.is_dir():
            continue
        try:
            paths = list(folder.glob("*.gguf"))
            if folder == downloads:
                paths += list(folder.glob("*/*.gguf"))
            for path in paths:
                if path.is_file():
                    files[str(path.resolve())] = path.resolve()
        except OSError:
            continue
    result: dict[str, Path] = {}
    for name in MODELS:
        configured = os.environ.get(MODEL_ENV_KEYS[name], "").strip()
        if configured:
            chosen = Path(configured).expanduser()
            if chosen.is_file() and chosen.suffix.casefold() == ".gguf":
                result[name] = chosen.resolve()
            # An explicit invalid path must not silently select a different file.
            continue
        preferred = MODELS[name]
        if preferred.is_file():
            result[name] = preferred.resolve()
            continue
        matches = [file for file in files.values() if name in file.name.casefold()]
        if not matches:
            continue
        # Prefer instruction-tuned Q4_K_M when multiple quantizations are present.
        matches.sort(key=lambda file: (
            0 if "q4_k_m" in file.name.casefold() else 1,
            0 if "instruct" in file.name.casefold() or "-it-" in file.name.casefold() else 1,
            str(file).casefold(),
        ))
        result[name] = matches[0]
    return result


def discover_ollama_models() -> set[str]:
    """Fetch installed Ollama tags from the local daemon, never auto-pull them."""
    try:
        with urllib.request.urlopen(
            f"http://{OLLAMA_HOST}:{OLLAMA_PORT}/api/tags", timeout=2.5
        ) as response:
            if response.status != HTTPStatus.OK:
                return set()
            data = json.load(response)
    except (OSError, urllib.error.URLError, ValueError, TypeError):
        return set()
    if not isinstance(data, dict) or not isinstance(data.get("models"), list):
        return set()
    result: set[str] = set()
    for model in data["models"]:
        if not isinstance(model, dict):
            continue
        name = model.get("name", model.get("model"))
        if isinstance(name, str) and name.casefold().strip():
            result.add(name.casefold().strip())
    return result


def available_sources(
    installed: dict[str, Path], ollama_tags: set[str]
) -> dict[str, dict[str, str]]:
    """Resolve each UI ID to a local provider and an exact installed model."""
    sources: dict[str, dict[str, str]] = {}
    for name, path in installed.items():
        sources[name] = {"provider": "gguf", "model": str(path)}
    for name, tag in OLLAMA_MODEL_TAGS.items():
        if tag in ollama_tags and name not in sources:
            sources[name] = {"provider": "ollama", "model": tag}
    return sources


def model_catalog(
    installed: dict[str, Path], ollama_tags: set[str] | None = None
) -> list[dict[str, Any]]:
    sources = available_sources(installed, ollama_tags or set())
    return [
        {"id": name, "label": label, "available": name in sources,
         "source": sources[name]["provider"] if name in sources else None,
         "filename": Path(sources[name]["model"]).name if name in sources else None}
        for name, label in MODEL_LABELS.items()
    ]

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


def choose_model(
    messages: Any, requested_model: Any = "auto", available: set[str] | None = None
) -> tuple[str, dict[str, int]]:
    """Honor explicit selection, then route by intent among installed models."""
    installed = set(MODEL_LABELS) if available is None else set(available)
    requested = str(requested_model or "auto").casefold().strip().lstrip("/")
    if requested not in {"auto", *MODEL_LABELS}:
        raise ValueError(f"Modelo desconhecido: {requested}")
    text = _latest_user_text(messages).strip()
    lowered = text.casefold()
    explicit = re.search(r"(?:^|\s)/(qwen|nemotron|gemma_ollama|smol135|gemma|smol)(?:\s|$)", lowered)
    if requested == "auto" and explicit:
        requested = explicit.group(1)
    if requested != "auto":
        if requested not in installed:
            raise ValueError(f"{MODEL_LABELS[requested]} não encontrado. Verifique /models ou configure {MODEL_ENV_KEYS[requested]}.")
        return requested, {requested: 100}

    scores = {"qwen": 0, "nemotron": 0, "gemma": 0, "smol": 0, "smol135": 0, "gemma_ollama": 0}
    if CODE_TERMS.search(text):
        scores["qwen"] += 6
        scores["smol"] += 3
    if "```" in text or re.search(r"\.(html?|css|js|ts|py|java|cpp|cs|sql)\b", lowered):
        scores["qwen"] += 5
        scores["smol"] += 3
    if GENERAL_TERMS.search(text):
        scores["nemotron"] += 5
        scores["smol"] += 2
    if SIMPLE_TERMS.search(text):
        scores["gemma"] += 3
        scores["smol"] += 2
    if len(text) <= 160:
        scores["gemma"] += 1
    if len(text) >= 700:
        scores["nemotron"] += 2

    order = ("qwen", "smol", "nemotron", "gemma") if scores["qwen"] else (
        ("nemotron", "smol", "gemma", "qwen") if scores["nemotron"] else
        ("gemma", "smol", "nemotron", "qwen")
    )
    # The explicit variants remain manual options; auto uses the default aliases.
    order += ("smol135", "gemma_ollama")
    for name in order:
        if name in installed:
            return name, scores
    raise ValueError("Nenhum modelo local encontrado. Confira GGUF e Ollama em /models.")


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
        if self.path == "/models":
            installed = discover_models()
            tags = discover_ollama_models()
            self._send_json({"ok": True, "models": model_catalog(installed, tags),
                             "activeModel": ACTIVE_MODEL, "ollamaConnected": bool(tags)})
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
        installed = discover_models()
        ollama_tags = discover_ollama_models()
        sources = available_sources(installed, ollama_tags)
        MODELS.update(installed)
        try:
            model_name, scores = choose_model(
                payload["messages"], payload.get("model", "auto"), set(sources)
            )
        except ValueError as error:
            self._send_json({"ok": False, "error": "model_selection_failed",
                             "message": str(error), "models": model_catalog(installed, ollama_tags)}, 400)
            return
        payload["messages"] = compact_messages(payload["messages"])
        try:
            # Serializes switching and inference so a second request cannot kill
            # the model while the first request is still receiving its stream.
            with PROCESS_LOCK:
                source = sources[model_name]
                if source["provider"] == "gguf":
                    ensure_model(model_name)
                    payload["model"] = model_name
                    self._proxy(payload, model_name, scores)
                else:
                    # Release only our own llama-server; never terminate Ollama.
                    stop_backend()
                    payload["model"] = source["model"]
                    self._proxy(payload, model_name, scores,
                                host=OLLAMA_HOST, port=OLLAMA_PORT, provider="ollama")
        except Exception as error:  # noqa: BLE001 - return a useful local API error
            print(f"[guinho-router] model={model_name} failed: {error}", flush=True)
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

    def _proxy(self, payload: dict[str, Any], model_name: str, scores: dict[str, int],
               host: str = LLAMA_HOST, port: int = LLAMA_PORT,
               provider: str = "gguf") -> None:
        body = json_bytes(payload)
        connection = HTTPConnection(host, port, timeout=180)
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
                print(
                    f"[guinho-router] {provider} HTTP {response.status}: {detail[:1000]}",
                    flush=True,
                )
                self._send_json(
                    {"ok": False, "error": "model_backend_error", "provider": provider, "status": response.status, "detail": detail},
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
            self.send_header("X-Guinho-Provider", provider)
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
                chunk = response.read1(8192)
                if not chunk:
                    break
                self.wfile.write(chunk)
                self.wfile.flush()
        finally:
            connection.close()


def shutdown(*_: Any) -> None:
    stop_backend()
    raise SystemExit(0)


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
        stop_backend()

