#!/usr/bin/env python3
"""Eliza Dev: PWA local com seletor GGUF + Ollama, sem dependências externas."""

import json
import os
import re
import zipfile
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = "127.0.0.1"
PORT = int(os.environ.get("ELIZA_PORT", "8000"))
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
ROUTER_URL = os.environ.get("ELIZA_ROUTER_URL", "http://127.0.0.1:8090").rstrip("/")
DEFAULT_MODEL = os.environ.get("ELIZA_DEFAULT_MODEL", "auto")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MANIFEST = json.dumps({
    "name": "Eliza Dev",
    "short_name": "Eliza Dev",
    "description": "Assistente de programação local conectado ao Ollama.",
    "start_url": "/",
    "scope": "/",
    "display": "standalone",
    "background_color": "#050505",
    "theme_color": "#050505",
    "icons": [
        {"src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
        {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"},
    ],
}, ensure_ascii=False)

SERVICE_WORKER = """const CACHE='eliza-dev-pwa-v3';
const ASSETS=['/','/manifest.webmanifest','/icon-192.png','/icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('eliza-dev-pwa-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()]))});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
if(event.request.mode==='navigate'||url.pathname==='/'||url.pathname==='/index.html'){
 event.respondWith(fetch(event.request).then(response=>{const clone=response.clone();caches.open(CACHE).then(cache=>cache.put('/',clone));return response}).catch(()=>caches.match('/')));return}
event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
"""

HTML = r'''<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#050505">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/icon-192.png">
<title>Eliza Dev</title>
<style>
:root{color-scheme:dark;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;--bg:#050505;--text:#f2f2f2;--muted:#aaa;--edge:#484848}
*{box-sizing:border-box}html,body{min-height:100%;margin:0;background:var(--bg);color:var(--text)}
body{font-size:15px}.app{max-width:1100px;margin:auto;min-height:100dvh;display:flex;flex-direction:column}
header{padding:16px 20px 12px;border-bottom:1px solid #333;display:flex;justify-content:space-between;gap:12px;align-items:center}
h1{font-size:20px;margin:0;font-weight:700}header small{color:var(--muted);font-size:12px}
#status{color:#8dff8d;font-size:12px;white-space:normal;text-align:right}
.modelbar{padding:12px 20px;display:flex;align-items:center;gap:9px;flex-wrap:wrap;border-bottom:1px solid #252525;background:#0a0a0a}
.modelbar label{font-size:13px;color:#dedede;white-space:nowrap}.modelbar select{flex:1;min-width:155px;max-width:450px;background:#080808;color:#fff;border:1px solid #777;border-radius:4px;padding:10px;font:14px ui-monospace,Consolas,monospace}
.modelbar button,.secondary{background:#080808;color:#f2f2f2;border:1px solid #555;padding:9px 11px;font-size:12px}
#modelInfo{font-size:12px;color:#aaa;flex-basis:100%}
.chat{flex:1;padding:22px 20px 100px;overflow:auto;min-height:200px}
.msg{max-width:920px;margin:0 auto 18px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.55;font-size:15px}
.role{color:#999;font-size:12px;margin-bottom:5px}.user .role{color:#fff}.assistant .role{color:#8dff8d}
.body{border-left:2px solid #333;padding-left:12px}.user .body{border-color:#777}
pre{background:#111;border:1px solid #333;padding:14px;overflow:auto;white-space:pre-wrap}
.composer{border-top:1px solid #333;padding:12px 20px calc(12px + env(safe-area-inset-bottom));position:sticky;bottom:0;background:var(--bg);z-index:2}
textarea{width:100%;min-height:80px;max-height:32dvh;resize:vertical;background:#0b0b0b;border:1px solid #555;color:#fff;padding:12px;font:15px/1.5 ui-monospace,Consolas,monospace;outline:none;border-radius:3px}
textarea:focus,.modelbar select:focus{border-color:#fff;outline:1px solid #aaa}.bar{display:flex;justify-content:space-between;align-items:center;margin-top:9px;gap:12px}
button{background:#f2f2f2;color:#050505;border:0;padding:11px 18px;font:700 14px ui-monospace,Consolas,monospace;cursor:pointer;border-radius:3px}button:disabled{opacity:.45;cursor:wait}
.hint{color:#aaa;font-size:12px}.empty{color:#aaa;text-align:center;padding:14vh 10px}.tools{display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap}
.tools label,.download{border:1px solid #555;padding:9px 12px;color:#ddd;cursor:pointer;font:12px ui-monospace,Consolas,monospace;background:#0b0b0b}.tools input{display:none}
.clip{display:inline-flex;align-items:center;justify-content:center;width:42px;height:38px;padding:0!important;border-radius:4px}.clip svg{width:21px;height:21px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.files{color:#aaa;font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;max-width:75%}.actions{margin-top:10px;display:flex;gap:8px;flex-wrap:wrap}
@media(max-width:600px){header{padding:12px}h1{font-size:18px}.modelbar{padding:10px 12px}.modelbar select{width:100%;max-width:none;flex-basis:70%}.chat{padding:15px 12px 90px}.composer{padding:10px 12px calc(10px + env(safe-area-inset-bottom))}.msg{font-size:15px}.bar .hint{font-size:11px}}
</style></head>
<body><main class="app">
<header><div><h1>ELIZA_DEV //</h1><small>assistente local · GGUF + Ollama</small></div><span id="status" role="status">● iniciando</span></header>
<section class="modelbar" aria-label="Seleção de inteligência artificial"><label for="model">IA selecionada</label><select id="model" aria-label="Escolher modelo"><option value="auto">Consultando modelos…</option></select><button type="button" id="refreshModels" title="Atualizar modelos">↻ ATUALIZAR</button><small id="modelInfo" role="status">Consultando 8090 e 11434…</small></section>
<section id="chat" class="chat" role="log" aria-live="polite"><div class="empty">Digite uma solicitação de código para começar.</div></section>
<form id="form" class="composer"><div class="tools"><label class="clip" for="files" title="Anexar arquivos" aria-label="Anexar arquivos"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20.5 11.5-8.8 8.8a5 5 0 0 1-7.1-7.1l9.2-9.2a3.5 3.5 0 0 1 5 5l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg></label><input id="files" type="file" multiple accept="*/*"><span id="fileNames" class="files">Nenhum arquivo anexado</span><button type="button" id="clearHistory" class="secondary" title="Apagar histórico local">LIMPAR CHAT</button></div><textarea id="input" placeholder="Descreva o código que você quer criar..."></textarea><div class="bar"><span class="hint">Enter envia · Shift+Enter quebra linha</span><button id="send" type="submit">ENVIAR</button></div></form>
</main><script>
'use strict';
const chat=document.querySelector('#chat'),form=document.querySelector('#form'),input=document.querySelector('#input'),send=document.querySelector('#send'),statusEl=document.querySelector('#status'),fileInput=document.querySelector('#files'),fileNames=document.querySelector('#fileNames'),modelSelect=document.querySelector('#model'),modelInfo=document.querySelector('#modelInfo'),refreshButton=document.querySelector('#refreshModels');
const KEY='elizaDevChatV3', MODEL_KEY='elizaDevModelV3';
const messages=[];let selectedFiles=[],catalog=new Map(),sending=false;
function setStatus(text,color='#8dff8d'){statusEl.textContent='● '+text;statusEl.style.color=color}
function add(role,text,model=''){
  const empty=chat.querySelector('.empty');if(empty)empty.remove();
  const el=document.createElement('article');el.className='msg '+role;
  const roleEl=document.createElement('div');roleEl.className='role';roleEl.textContent=role==='user'?'VOCÊ':'ELIZA_DEV'+(model?' · '+model:'');
  const body=document.createElement('div');body.className='body';body.textContent=text;
  el.append(roleEl,body);chat.appendChild(el);chat.scrollTop=chat.scrollHeight;return body;
}
function saveHistory(){try{localStorage.setItem(KEY,JSON.stringify(messages.slice(-30)))}catch(e){modelInfo.textContent='Histórico não pôde ser salvo neste navegador.'}}
function loadHistory(){try{const stored=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(stored)){for(const item of stored.slice(-30)){if(item&&['user','assistant'].includes(item.role)&&typeof item.content==='string'){messages.push({role:item.role,content:item.content,model:item.model||''});add(item.role,item.content,item.model||'')}}}}catch(e){localStorage.removeItem(KEY)}}
loadHistory();
function chosenLabel(){return modelSelect.options[modelSelect.selectedIndex]?.textContent||modelSelect.value}
async function loadModels(){
  refreshButton.disabled=true;modelInfo.textContent='Consultando serviços locais…';
  const previous=localStorage.getItem(MODEL_KEY)||modelSelect.value||'auto';
  try{
    const response=await fetch('/api/models',{cache:'no-store'});const data=await response.json();if(!response.ok||!Array.isArray(data.models))throw Error(data.error||'Catálogo inválido');
    catalog=new Map(data.models.map(item=>[item.id,item]));modelSelect.replaceChildren();
    for(const item of data.models){const provider=item.source==='ollama-cloud'?'nuvem':item.source==='gguf'?'GGUF':item.source==='ollama'?'Ollama':'indisponível';const option=new Option(item.label+' · '+provider+(item.available?'':' (offline)'),item.id);option.disabled=!item.available;modelSelect.add(option)}
    const available=catalog.get(previous)?.available?previous:(catalog.get('auto')?.available?'auto':data.models.find(x=>x.available)?.id||'');
    modelSelect.value=available;
    localStorage.setItem(MODEL_KEY,available);
    modelInfo.textContent='Roteador 8090: '+(data.routerConnected?'online':'offline')+' · Ollama 11434: '+(data.ollamaConnected?'online':'offline')+(available?' · '+chosenLabel():' · nenhum modelo disponível');
    setStatus(available?'pronto':'sem modelos disponíveis',available?'#8dff8d':'#ff7777');
    send.disabled=!available;
  }catch(e){modelInfo.textContent='Falha ao obter os modelos: '+e.message;setStatus('catálogo indisponível','#ff7777');send.disabled=true}
  finally{refreshButton.disabled=false}
}
modelSelect.addEventListener('change',()=>{localStorage.setItem(MODEL_KEY,modelSelect.value);modelInfo.textContent='Modelo escolhido: '+chosenLabel();setStatus('pronto');});
refreshButton.addEventListener('click',()=>loadModels());
loadModels();
fileInput.addEventListener('change',()=>{selectedFiles=[...fileInput.files];fileNames.textContent=selectedFiles.length?selectedFiles.map(f=>`${f.name} (${Math.ceil(f.size/1024)} KB)`).join('\n'):'Nenhum arquivo anexado'});
const textExtensions=/\.(html?|css|js|ts|jsx|tsx|py|cs|cpp|c|h|hpp|java|json|md|txt|sql|sh|bash|yml|yaml|xml|gd|log|csv|ini|toml|env|svg)$/i;
function readFile(file){
  const isImage=file.type.startsWith('image/');
  if(!isImage&&!textExtensions.test(file.name)&&!file.type.startsWith('text/'))return Promise.reject(Error('Arquivo binário não suportado: '+file.name+'. Anexe código/texto; PDF e ZIP não são interpretados nesta versão.'));
  if(file.size>(isImage?4*1024*1024:1024*1024))return Promise.reject(Error('Arquivo excede o limite: '+file.name+' (4 MB imagem / 1 MB texto).'));
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({name:file.name,type:file.type||(isImage?'image/png':'text/plain'),size:file.size,content:reader.result});reader.onerror=()=>reject(Error('Não foi possível ler '+file.name));if(isImage)reader.readAsDataURL(file);else reader.readAsText(file)});
}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function actionButtons(target){
  const actions=document.createElement('div');actions.className='actions';
  const txt=document.createElement('button');txt.className='download';txt.type='button';txt.textContent='BAIXAR RESPOSTA .TXT';txt.addEventListener('click',()=>downloadBlob(new Blob([target.textContent],{type:'text/plain;charset=utf-8'}),'eliza-resposta.txt'));
  const zip=document.createElement('button');zip.className='download';zip.type='button';zip.textContent='BAIXAR ARQUIVOS .ZIP';zip.addEventListener('click',async()=>{try{const r=await fetch('/api/package',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:target.textContent})});if(!r.ok){const e=await r.json().catch(()=>({}));throw Error(e.error||'Nenhum bloco de código encontrado.')}downloadBlob(await r.blob(),'eliza-arquivos.zip')}catch(e){setStatus(e.message,'#ff7777')}});
  actions.append(txt,zip);target.parentElement.appendChild(actions);
}
form.addEventListener('submit',async e=>{
  e.preventDefault();if(sending)return;
  const text=input.value.trim(),model=modelSelect.value;if(!text&&!selectedFiles.length)return;
  if(!model||!catalog.get(model)?.available){setStatus('selecione uma IA disponível','#ff7777');return}
  if(selectedFiles.length>10){setStatus('máximo de 10 anexos','#ff7777');return}
  let attachments;try{attachments=await Promise.all(selectedFiles.map(readFile))}catch(err){setStatus(err.message,'#ff7777');return}
  const shown=text+(attachments.length?'\n\n[Anexos: '+attachments.map(f=>f.name).join(', ')+']':'');
  input.value='';add('user',shown);
  const turn={role:'user',content:text||'Analise os arquivos anexados.'};messages.push(turn);
  const payloadMessages=messages.slice(-24).map(({role,content})=>({role,content}));
  sending=true;send.disabled=true;modelSelect.disabled=true;setStatus('processando','#fff');const target=add('assistant','');
  try{
    const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,messages:payloadMessages,attachments})});
    const data=await res.json();if(!res.ok)throw Error(data.error||'Erro no servidor');
    const answer=data.message||'Resposta vazia';target.textContent=answer;
    const actual=data.actualModel||data.label||model;target.parentElement.querySelector('.role').textContent='ELIZA_DEV · '+actual;
    messages.push({role:'assistant',content:answer,model:actual});saveHistory();actionButtons(target);
    setStatus('pronto · '+actual);selectedFiles=[];fileInput.value='';fileNames.textContent='Nenhum arquivo anexado';
  }catch(err){target.textContent='ERRO: '+err.message;messages.pop();setStatus('erro: '+err.message,'#ff7777')}
  finally{sending=false;send.disabled=false;modelSelect.disabled=false;input.focus()}
});
input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit()}});
document.querySelector('#clearHistory').addEventListener('click',()=>{if(!confirm('Apagar o histórico local deste navegador?'))return;messages.length=0;localStorage.removeItem(KEY);chat.replaceChildren();const empty=document.createElement('div');empty.className='empty';empty.textContent='Digite uma solicitação de código para começar.';chat.appendChild(empty);setStatus('histórico apagado')});
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{});
</script></body></html>'''


def attachment_prompt(attachments):
    parts = []
    for item in attachments[:10]:
        name = os.path.basename(str(item.get("name", "arquivo")))
        content = str(item.get("content", ""))
        if content.startswith("data:"):
            if content.startswith("data:image/"):
                continue
            content = content.split(",", 1)[-1]
            try:
                import base64
                decoded = base64.b64decode(content).decode("utf-8", "replace")
            except Exception:
                decoded = content
        else:
            decoded = content
        parts.append(f"\n\n===== ARQUIVO ANEXADO: {name} =====\n{decoded[:500000]}\n===== FIM DO ARQUIVO =====")
    return "".join(parts)


MAX_BODY_BYTES = 12 * 1024 * 1024
CLOUD_TAG = "gemma4:31b-cloud"
OLLAMA_LOCAL = {
    "smol": ("SmolLM2 360M", "smollm2:360m"),
    "smol135": ("SmolLM2 135M", "smollm2:135m"),
    "gemma_ollama": ("Gemma 3 270M (Ollama)", "gemma3:270m"),
    "gemma": ("Gemma 3 270M", "gemma3:270m"),
}


def get_json(url, timeout=2.5):
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return json.load(response)
    except (OSError, ValueError, TypeError):
        return None


def models_catalog():
    """Merge router catalog with directly available Ollama models.

    Direct Ollama entries provide a fallback when 8090 is not running; cloud
    is opt-in only and never included in automatic routing.
    """
    router = get_json(ROUTER_URL + "/models")
    ollama = get_json(OLLAMA_URL.rstrip("/") + "/api/tags")
    router_ok = isinstance(router, dict) and router.get("ok") is True and isinstance(router.get("models"), list)
    ollama_ok = isinstance(ollama, dict) and isinstance(ollama.get("models"), list)
    installed_tags = {str(item.get("name", item.get("model", ""))).casefold() for item in ollama["models"] if isinstance(item, dict)} if ollama_ok else set()
    entries = {}
    if router_ok:
        for item in router["models"]:
            if not isinstance(item, dict) or not isinstance(item.get("id"), str):
                continue
            key = item["id"]
            if key not in {"qwen", "nemotron", "gemma", "gemma_ollama", "smol", "smol135"}:
                continue
            if item.get("available") is True and item.get("source") in {"gguf", "ollama"}:
                entries[key] = {"id": key, "label": str(item.get("label") or key), "source": item["source"],
                                "available": True, "upstream": "router", "tag": key}
    for key, (label, tag) in OLLAMA_LOCAL.items():
        if key not in entries and tag in installed_tags:
            entries[key] = {"id": key, "label": label, "source": "ollama", "available": True,
                            "upstream": "ollama", "tag": tag}
    if CLOUD_TAG in installed_tags:
        entries["gemma_cloud"] = {"id": "gemma_cloud", "label": "Gemma 4 31B Cloud (requer internet)",
                                  "source": "ollama-cloud", "available": True, "upstream": "ollama", "tag": CLOUD_TAG}
    local_ready = any(key != "gemma_cloud" for key in entries)
    catalog = [{"id": "auto", "label": "Automático · somente modelos locais", "source": "auto",
                "available": local_ready, "upstream": "router" if router_ok else "direct", "tag": "auto"}]
    order = ("qwen", "gemma", "gemma_ollama", "smol", "smol135", "nemotron", "gemma_cloud")
    for key in order:
        if key in entries:
            catalog.append(entries[key])
    return {"models": catalog, "routerConnected": router_ok,
            "ollamaConnected": ollama_ok, "choices": {m["id"]: m for m in catalog if m["available"]}}


def prepare_messages(messages, attachments=None, allow_images=False):
    if not isinstance(messages, list) or not messages or len(messages) > 32:
        raise ValueError("Envie de 1 a 32 mensagens.")
    prepared = []
    for message in messages:
        if not isinstance(message, dict) or message.get("role") not in {"user", "assistant"} or not isinstance(message.get("content"), str):
            raise ValueError("Mensagem inválida.")
        content = message["content"]
        if len(content) > 60000:
            raise ValueError("Mensagem maior que 60 mil caracteres.")
        prepared.append({"role": message["role"], "content": content})
    if prepared[-1]["role"] != "user":
        raise ValueError("A última mensagem deve ser do usuário.")
    attachments = attachments or []
    if not isinstance(attachments, list) or len(attachments) > 10:
        raise ValueError("Máximo de 10 anexos.")
    if any(not isinstance(a, dict) or not isinstance(a.get("content"), str) for a in attachments):
        raise ValueError("Anexo inválido.")
    prepared[-1]["content"] += attachment_prompt(attachments)
    images = [a["content"].split(",", 1)[1] for a in attachments
              if a["content"].startswith("data:image/") and "," in a["content"]]
    if images and not allow_images:
        raise ValueError("O modelo selecionado não aceita anexos de imagem nesta interface. Use um modelo com visão (Gemma Cloud) ou anexe código/texto.")
    if images:
        prepared[-1]["images"] = images[:4]
    return prepared


def post_json(url, payload, timeout=300):
    request = urllib.request.Request(url, data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                                     headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def ask_model(messages, attachments=None, selected="auto"):
    if not isinstance(selected, str):
        raise ValueError("Modelo inválido.")
    catalog = models_catalog()
    model = catalog["choices"].get(selected)
    if model is None:
        raise ValueError("Modelo indisponível: " + selected + ". Atualize o catálogo no Eliza.")
    direct = model["upstream"] in {"ollama", "direct"}
    prepared = prepare_messages(messages, attachments, allow_images=model["id"] == "gemma_cloud")
    if direct:
        tag = model["tag"]
        if tag == "auto":
            # Use a real, installed local model only. Never select cloud automatically.
            for candidate in ("qwen", "smol", "gemma", "smol135", "gemma_ollama"):
                found = catalog["choices"].get(candidate)
                if found and found["upstream"] == "ollama" and found["id"] != "gemma_cloud":
                    tag = found["tag"]
                    model = found
                    break
            else:
                raise ValueError("Nenhuma IA local disponível para seleção automática.")
        result = post_json(OLLAMA_URL.rstrip("/") + "/api/chat", {"model": tag, "messages": prepared,
                                                              "stream": False, "options": {"temperature": 0.2}})
        answer = result.get("message", {}).get("content", "")
        actual_model = result.get("model", tag)
    else:
        payload = {"model": model["tag"], "messages": prepared, "stream": False,
                   "max_tokens": 2048, "temperature": 0.2}
        result = post_json(ROUTER_URL + "/v1/chat/completions", payload)
        choices = result.get("choices") or []
        answer = choices[0].get("message", {}).get("content", "") if choices else ""
        actual_model = result.get("model", model["id"])
    if not isinstance(answer, str) or not answer.strip():
        raise RuntimeError("O modelo respondeu sem texto. Tente novamente ou selecione outra IA.")
    return {"message": answer, "model": model["id"], "label": model["label"],
            "actualModel": str(actual_model), "source": model["source"]}


def code_files_from_text(text):
    files = []
    pattern = re.compile(r"```([^\n]*)\n([\s\S]*?)```")
    for index, match in enumerate(pattern.finditer(text), 1):
        info = match.group(1).strip()
        code = match.group(2).rstrip() + "\n"
        tokens = info.split()
        language = tokens[0].lower() if tokens else "txt"
        filename = None
        for token in tokens[1:]:
            if token.startswith("filename="):
                filename = token.split("=", 1)[1].strip('"\'')
        if not filename:
            filename = {"html":"index.html","css":"style.css","javascript":"script.js","js":"script.js","python":"main.py","py":"main.py","json":"data.json","java":"Main.java","csharp":"Program.cs","cs":"Program.cs","bash":"run.sh","sh":"run.sh"}.get(language, f"arquivo_{index}.{language if language.isalnum() else 'txt'}")
        filename = os.path.basename(filename)
        if any(existing[0] == filename for existing in files):
            stem, ext = os.path.splitext(filename)
            filename = f"{stem}_{index}{ext}"
        files.append((filename, code))
    return files


def make_zip(text):
    import io
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        files = code_files_from_text(text)
        if not files:
            raise ValueError("Nenhum bloco de código foi encontrado.")
        for name, content in files:
            archive.writestr(name, content)
    return buffer.getvalue()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[Eliza Dev] {self.address_string()} - {fmt % args}")

    def send_json(self, status, data):
        raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/manifest.webmanifest":
            raw = MANIFEST.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/manifest+json; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        if path == "/sw.js":
            raw = SERVICE_WORKER.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        if path in ("/icon-192.png", "/icon-512.png"):
            filename = path.lstrip("/")
            filepath = os.path.join(BASE_DIR, filename)
            try:
                with open(filepath, "rb") as asset:
                    raw = asset.read()
                self.send_response(200)
                self.send_header("Content-Type", "image/png")
                self.send_header("Cache-Control", "public, max-age=86400")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)
            except FileNotFoundError:
                self.send_error(404, "Ícone não encontrado: " + filename)
            return
        if path in ("/", "/index.html"):
            raw = HTML.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        if path == "/api/health":
            self.send_json(200, {"ok": True, "ollama": OLLAMA_URL, "router": ROUTER_URL})
            return
        if path == "/api/models":
            data = models_catalog()
            self.send_json(200, {k: v for k, v in data.items() if k != "choices"})
            return
        self.send_error(404)

    def do_POST(self):
        if self.path not in ("/api/chat", "/api/package"):
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY_BYTES:
                self.send_json(413, {"error": "Envio vazio ou maior que 12 MB."})
                return
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(body, dict):
                raise ValueError("Envie um objeto JSON.")
            if self.path == "/api/package":
                archive = make_zip(str(body.get("text", "")))
                self.send_response(200)
                self.send_header("Content-Type", "application/zip")
                self.send_header("Content-Disposition", "attachment; filename=eliza-arquivos.zip")
                self.send_header("Content-Length", str(len(archive)))
                self.end_headers()
                self.wfile.write(archive)
                return
            messages = body.get("messages", [])
            if not messages:
                self.send_json(400, {"error": "Nenhuma mensagem foi enviada."})
                return
            reply = ask_model(messages, body.get("attachments", []), body.get("model", DEFAULT_MODEL))
            self.send_json(200, reply)
        except ValueError as exc:
            self.send_json(400, {"error": str(exc)})
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")
            self.send_json(502, {"error": f"IA local respondeu HTTP {exc.code}: {detail[:500]}"})
        except urllib.error.URLError as exc:
            self.send_json(503, {"error": "Serviço de IA indisponível: " + str(exc.reason)})
        except Exception as exc:
            self.send_json(500, {"error": str(exc)})


if __name__ == "__main__":
    print(f"Eliza Dev em http://{HOST}:{PORT}")
    print(f"Roteador: {ROUTER_URL} | Ollama: {OLLAMA_URL} | modelo padrão: {DEFAULT_MODEL}")
    print("Pressione CTRL+C para encerrar.")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
