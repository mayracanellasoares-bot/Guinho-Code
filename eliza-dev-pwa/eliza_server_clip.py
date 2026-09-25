#!/usr/bin/env python3
"""Eliza Dev: PWA local com seletor GGUF + Ollama, sem dependências externas."""

import base64
import json
import os
import re
import secrets
import threading
import zipfile
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

HOST = "127.0.0.1"
PORT = int(os.environ.get("ELIZA_PORT", "8000"))
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
ROUTER_URL = os.environ.get("ELIZA_ROUTER_URL", "http://127.0.0.1:8090").rstrip("/")
DEFAULT_MODEL = os.environ.get("ELIZA_DEFAULT_MODEL", "auto")
REQUIRE_AUTH = os.environ.get("ELIZA_REQUIRE_AUTH", "0") == "1"
ACCESS_USER = os.environ.get("ELIZA_ACCESS_USER", "eliza")
ACCESS_PASSWORD = os.environ.get("ELIZA_ACCESS_PASSWORD", "")
ALLOW_CLOUD = os.environ.get("ELIZA_ALLOW_CLOUD", "1") == "1"
INFERENCE_SLOT = threading.BoundedSemaphore(1)
if REQUIRE_AUTH and not ACCESS_PASSWORD:
    raise RuntimeError("Defina ELIZA_ACCESS_PASSWORD antes de iniciar a versão pública.")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MANIFEST = json.dumps({
    "name": "Eliza Dev",
    "short_name": "Eliza Dev",
    "description": "Assistente de programação local conectado ao Ollama.",
    "start_url": "/",
    "scope": "/",
    "display": "standalone",
    "background_color": "#101014",
    "theme_color": "#101014",
    "icons": [
        {"src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
        {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"},
    ],
}, ensure_ascii=False)

SERVICE_WORKER = """const CACHE='eliza-dev-pwa-v4-3';
const ASSETS=['/manifest.webmanifest','/icon-192.png','/icon-512.png'];
self.addEventListener('install',event=>{self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('eliza-dev-pwa-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()]))});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);
if(url.origin!==self.location.origin||event.request.method!=='GET'||!ASSETS.includes(url.pathname))return;
event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy))}return response}).catch(()=>caches.match(event.request)));
});
"""

HTML = r'''<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#101014"><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/icon-192.png">
<title>Eliza Dev — Assistente de código</title>
<style>
:root{color-scheme:dark;--bg:#101014;--side:#17171c;--panel:#24242b;--edge:#34343e;--text:#f2f2f5;--muted:#a6a6b3;--accent:#a6edce;font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
*{box-sizing:border-box}html,body{height:100%;margin:0}body{background:var(--bg);color:var(--text);overflow:hidden}button,select,textarea{font:inherit}button{cursor:pointer}button:disabled{opacity:.47;cursor:wait}button:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.app{height:100dvh;display:flex;overflow:hidden}.sidebar{width:264px;flex:0 0 264px;background:var(--side);border-right:1px solid #292930;display:flex;flex-direction:column;padding:18px 12px;z-index:20}.brand{display:flex;align-items:center;gap:11px;padding:3px 9px 23px}.brandmark,.welcome-mark{display:grid;place-items:center;background:#e8fff4;color:#18201c;font-weight:800}.brandmark{width:36px;height:36px;border-radius:12px;font-size:21px}.brand strong{display:block;font-size:17px;letter-spacing:-.03em}.brand small{display:block;color:var(--muted);font-size:11px}.side-action{display:flex;align-items:center;gap:10px;width:100%;padding:11px 13px;text-align:left;border:1px solid #464650;border-radius:12px;background:#25252c;color:#f5f5f5;font-weight:600;font-size:13px}.side-action:hover{background:#303039}.side-heading{margin:25px 10px 10px;color:#8e8e9a;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.history{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:4px;scrollbar-width:thin}.history-row{display:flex;align-items:center;border-radius:10px;min-width:0}.history-row.active{background:#303038}.history-row:hover{background:#282831}.history-open{flex:1;min-width:0;background:none;border:0;text-align:left;color:#dadbe0;padding:10px 11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px}.history-row.active .history-open{color:#fff;font-weight:650}.history-delete{flex:0 0 32px;width:32px;height:34px;background:transparent;color:#9c9ca7;border:0;border-radius:8px;font-size:19px}.history-delete:hover{background:#533239;color:#fff}.side-footer{padding:14px 10px 5px;border-top:1px solid var(--edge);font-size:12px;color:var(--muted);line-height:1.6}.side-footer strong{display:block;color:#e5e5eb;font-weight:600;margin-bottom:3px}.backdrop{display:none}
.workspace{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0}.topbar{height:66px;flex:none;display:flex;align-items:center;gap:11px;border-bottom:1px solid #28282e;padding:0 25px}.hamburger{display:none}.top-title{font-weight:700;font-size:16px;white-space:nowrap}.top-title span{color:#8e8e99;font-weight:400}.model-picker{display:flex;align-items:center;gap:8px;margin-left:12px;min-width:0;max-width:420px}.model-picker label{color:var(--muted);font-size:12px;white-space:nowrap}.model-picker select{background:#222229;color:#fff;border:1px solid #3c3c46;border-radius:10px;padding:9px 10px;min-width:0;max-width:330px;width:100%;font-size:13px}.iconbtn{height:36px;min-width:36px;border:0;border-radius:10px;background:transparent;color:#c5c5cf;font-size:19px;display:grid;place-items:center}.iconbtn:hover{background:#2a2a32;color:white}.top-spacer{flex:1}.status{display:flex;align-items:center;gap:7px;max-width:230px;color:#a6edce;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.status:before{content:"";display:block;background:currentColor;width:7px;height:7px;border-radius:50%;flex:none}
.chat-scroll{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}.chat-inner{width:min(100%,850px);margin:0 auto;padding:30px 28px 42px}.welcome{text-align:center;padding:clamp(58px,15vh,175px) 0 35px}.welcome-mark{width:55px;height:55px;border-radius:18px;font-size:29px;margin:0 auto 19px}.welcome h1{font-weight:650;letter-spacing:-.05em;font-size:clamp(24px,5vw,34px);margin:0 0 8px}.welcome p{color:var(--muted);margin:0 0 29px}.suggestions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;max-width:610px;margin:auto}.suggestion{text-align:left;border:1px solid #34343c;background:#19191f;color:#e4e4eb;border-radius:13px;padding:14px;font-size:13px}.suggestion:hover{border-color:#6e8e80;background:#25252d}.suggestion small{display:block;color:#9fa0ac;margin-top:5px;font-size:11px}
.msg{margin:0 0 27px;display:flex;gap:13px;align-items:flex-start;overflow-wrap:anywhere}.msg.user{justify-content:flex-end;margin-top:6px}.avatar{width:30px;height:30px;flex:none;border-radius:10px;background:#e4fff1;color:#132019;display:grid;place-items:center;font-weight:800;font-size:13px}.msg-content{min-width:0;max-width:100%;flex:1}.msg.user .msg-content{flex:0 1 auto;max-width:82%}.role{font-weight:700;color:#dedee6;font-size:12px;margin-bottom:8px}.role small{font-weight:400;color:#aaaab5;margin-left:6px}.body{white-space:pre-wrap;line-height:1.75;font-size:15px;color:#eeeef1}.user .body{background:#292930;border:1px solid #373740;border-radius:19px;padding:11px 17px;line-height:1.55}.prose{white-space:pre-wrap;overflow-wrap:anywhere}.code-panel{border:1px solid #3b3b45;border-radius:12px;background:#151519;margin:13px 0;overflow:hidden;max-width:100%}.code-head{background:#27272d;border-bottom:1px solid #34343d;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;color:#b9b9c4;font:12px ui-monospace,SFMono-Regular,Consolas,monospace}.code-head button{background:transparent;color:#d6d6e0;border:0;padding:5px 8px;border-radius:6px;font:12px inherit}.code-head button:hover{background:#45454e}.code-panel pre{margin:0;padding:15px;overflow:auto;max-height:480px;white-space:pre;tab-size:2}.code-panel code{font:13px/1.65 ui-monospace,SFMono-Regular,Consolas,monospace;color:#e9eadf}.actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:10px}.download{border:1px solid #393943;background:#1e1e25;color:#aaaab5;border-radius:8px;padding:7px 9px;font-size:11px}.download:hover{color:#fff;border-color:#70707a}.msg.user .role{display:none}
.composer-wrap{flex:none;width:100%;background:linear-gradient(transparent,#101014 12%);padding:14px 24px calc(13px + env(safe-area-inset-bottom))}.composer{max-width:850px;margin:0 auto;border:1px solid #41414c;background:#25252d;border-radius:20px;padding:11px 11px 10px;box-shadow:0 8px 35px #0003}.composer:focus-within{border-color:#73737d}.composer textarea{width:100%;display:block;background:none;border:0;outline:none!important;resize:none;padding:8px 10px;max-height:36dvh;min-height:42px;color:#f7f7fa;font-size:15px;line-height:1.6}.composer textarea::placeholder{color:#92929e}.composer-row{display:flex;align-items:center;gap:8px;padding:4px 3px 0}.clip{position:relative;display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:9px;color:#e0e0e7;cursor:pointer}.clip:hover{background:#3c3c46}.clip svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.clip input{position:absolute;opacity:0;width:1px;height:1px}.file-names{color:#b6b6c1;font-size:12px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.send{margin-left:auto;width:36px;height:36px;display:grid;place-items:center;border:0;border-radius:10px;background:#e9fff4;color:#14221b;font-size:19px;font-weight:700}.send:hover{background:#c8f7df}.composer-hint{text-align:center;color:#898995;font-size:11px;padding-top:7px}.mobile-new{display:none}
@media(max-width:900px){.sidebar{width:244px;flex-basis:244px}.topbar{padding:0 15px}.top-title{font-size:14px}.model-picker{margin-left:0}}
@media(max-width:700px){.sidebar{position:fixed;inset:0 auto 0 0;width:min(82vw,300px);transform:translateX(-105%);transition:transform .18s ease;box-shadow:8px 0 28px #0008}.app.menu-open .sidebar{transform:translateX(0)}.app.menu-open .backdrop{display:block;position:fixed;inset:0;background:#0009;z-index:15}.hamburger{display:grid}.topbar{height:58px;gap:7px;padding:0 10px}.top-title{display:none}.model-picker{flex:1;max-width:none}.model-picker label{display:none}.model-picker select{max-width:none;padding:9px 8px;font-size:12px}.status{max-width:95px;font-size:10px}.chat-inner{padding:22px 15px 24px}.msg{gap:9px;margin-bottom:23px}.avatar{height:27px;width:27px;font-size:12px}.msg-content{max-width:calc(100% - 36px)}.msg.user .msg-content{max-width:93%}.body{font-size:14px}.welcome{padding:clamp(50px,11vh,110px) 0 30px}.suggestions{grid-template-columns:1fr}.suggestion{padding:11px 13px}.composer-wrap{padding:9px 9px calc(7px + env(safe-area-inset-bottom))}.composer{border-radius:17px;padding:8px}.composer textarea{min-height:35px;font-size:16px}.composer-hint{font-size:10px}.mobile-new{display:grid}}
@media(prefers-reduced-motion:reduce){.sidebar{transition:none}}
</style></head><body><div id="app" class="app">
<aside class="sidebar" aria-label="Conversas"><div class="brand"><div class="brandmark" aria-hidden="true">✳</div><div><strong>Eliza Dev</strong><small>Seu espaço para criar</small></div></div>
<button id="newChat" class="side-action" type="button"><span aria-hidden="true">＋</span> Nova conversa</button><div class="side-heading">Conversas recentes</div><nav id="history" class="history" aria-label="Histórico local"></nav><div class="side-footer"><strong>● Eliza no seu servidor</strong><div id="modelInfo" role="status">Verificando modelos…</div><div style="margin-top:8px">Conversas salvas somente neste navegador.</div></div></aside>
<div id="backdrop" class="backdrop"></div><div class="workspace">
<header class="topbar"><button id="menuButton" class="iconbtn hamburger" type="button" aria-label="Abrir menu" aria-expanded="false">☰</button><div class="top-title">Eliza <span>Dev</span></div><div class="model-picker"><label for="model">Modelo</label><select id="model" aria-label="Escolher modelo de IA"><option value="auto">Consultando modelos…</option></select><button type="button" id="refreshModels" class="iconbtn" title="Atualizar modelos" aria-label="Atualizar modelos">↻</button></div><div class="top-spacer"></div><span id="status" class="status" role="status">Carregando IA…</span><button id="mobileNew" class="iconbtn mobile-new" type="button" title="Nova conversa" aria-label="Nova conversa">＋</button></header>
<main id="chat" class="chat-scroll" role="log" aria-live="polite"><div id="chatInner" class="chat-inner"></div></main>
<div class="composer-wrap"><form id="form" class="composer"><textarea id="input" rows="1" placeholder="Pergunte ao Eliza ou descreva seu código…" aria-label="Sua mensagem"></textarea><div class="composer-row"><label class="clip" for="files" title="Anexar código, texto ou imagem" aria-label="Anexar arquivos"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20.5 11.5-8.8 8.8a5 5 0 0 1-7.1-7.1l9.2-9.2a3.5 3.5 0 0 1 5 5l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg><input id="files" type="file" multiple accept="*/*"></label><span id="fileNames" class="file-names">Anexar arquivo</span><button type="button" id="clearHistory" class="iconbtn" title="Excluir esta conversa" aria-label="Excluir esta conversa" style="font-size:17px">♲</button><button id="send" class="send" type="submit" aria-label="Enviar mensagem" title="Enviar mensagem">↑</button></div></form><div class="composer-hint">As respostas são geradas pelos modelos conectados ao seu servidor.</div></div>
</div></div>
<script>
'use strict';
// Private-mode browsers and some embedded WebViews can block localStorage.
// The chat must still load even if persistent storage is denied.
const safeStore={
 getItem(k){try{return localStorage.getItem(k)}catch(e){return null}},
 setItem(k,v){try{localStorage.setItem(k,v)}catch(e){}},
 removeItem(k){try{localStorage.removeItem(k)}catch(e){}}
};
function reportClientError(e){
 const status=document.querySelector('#status'),info=document.querySelector('#modelInfo');
 const message='Falha na interface: '+String(e?.message||e?.reason?.message||e||'erro desconhecido').slice(0,160);
 if(status){status.textContent=message;status.style.color='#ff8d8d'}
 if(info)info.textContent=message;
}
window.addEventListener('error',reportClientError);
window.addEventListener('unhandledrejection',reportClientError);
const qs=s=>document.querySelector(s);
const app=qs('#app'),chat=qs('#chat'),chatInner=qs('#chatInner'),form=qs('#form'),input=qs('#input'),send=qs('#send'),statusEl=qs('#status'),fileInput=qs('#files'),fileNames=qs('#fileNames'),modelSelect=qs('#model'),modelInfo=qs('#modelInfo'),refreshButton=qs('#refreshModels'),historyEl=qs('#history'),menuButton=qs('#menuButton');
const KEY='elizaDevChatsV4',OLD_KEY='elizaDevChatV3',MODEL_KEY='elizaDevModelV3';
const chats=[];let activeId='',selectedFiles=[],catalog=new Map(),sending=false;
function setStatus(message,color='#a6edce'){statusEl.textContent=message;statusEl.style.color=color}
function selectedChat(){return chats.find(c=>c.id===activeId)}
function closeMenu(){app.classList.remove('menu-open');menuButton.setAttribute('aria-expanded','false')}
function toggleMenu(){const open=app.classList.toggle('menu-open');menuButton.setAttribute('aria-expanded',String(open))}
menuButton.addEventListener('click',toggleMenu);qs('#backdrop').addEventListener('click',closeMenu);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
function makeChat(){return{id:String(Date.now())+Math.random().toString(36).slice(2,9),title:'Nova conversa',messages:[]}}
function saveHistory(){
 try{safeStore.setItem(KEY,JSON.stringify({activeId,chats:chats.slice(0,24).map(c=>({id:c.id,title:c.title,messages:c.messages.slice(-24).map(m=>({role:m.role,content:m.content.slice(0,40000),display:m.display?.slice(0,40000),model:m.model||''}))}))}))}
 catch(e){modelInfo.textContent='Armazenamento local cheio; limpe conversas antigas.'}
}
function initHistory(){
 try{
  const state=JSON.parse(safeStore.getItem(KEY)||'null');
  if(state&&Array.isArray(state.chats)){
   for(const c of state.chats.slice(0,24)){if(!c||typeof c.id!=='string'||!Array.isArray(c.messages))continue;
    const clean=c.messages.slice(-24).filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').map(m=>({role:m.role,content:m.content,display:typeof m.display==='string'?m.display:m.content,model:typeof m.model==='string'?m.model:''}));
    chats.push({id:c.id,title:typeof c.title==='string'?c.title.slice(0,80):'Nova conversa',messages:clean});
   }
   activeId=chats.some(c=>c.id===state.activeId)?state.activeId:'';
  }else{
   const old=JSON.parse(safeStore.getItem(OLD_KEY)||'[]');
   if(Array.isArray(old)&&old.length){
    const c=makeChat();c.messages=old.slice(-24).filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').map(m=>({role:m.role,content:m.content,display:m.content,model:m.model||''}));
    c.title=c.messages.find(m=>m.role==='user')?.content.slice(0,38)||'Conversa anterior';chats.push(c);activeId=c.id;
   }
  }
 }catch(e){/* corrupt local data: start clean */}
 if(!chats.length){const c=makeChat();chats.push(c);activeId=c.id}
 if(!activeId)activeId=chats[0].id;saveHistory();
}
function renderHistory(){
 historyEl.replaceChildren();
 for(const c of chats){
  const row=document.createElement('div');row.className='history-row'+(c.id===activeId?' active':'');
  const open=document.createElement('button');open.type='button';open.className='history-open';open.textContent=c.title||'Nova conversa';open.title=c.title;open.setAttribute('aria-current',c.id===activeId?'page':'false');
  open.addEventListener('click',()=>{if(sending){setStatus('Aguarde a resposta atual','#efc28a');return}activeId=c.id;saveHistory();renderHistory();renderChat();closeMenu()});
  const del=document.createElement('button');del.type='button';del.className='history-delete';del.textContent='×';del.title='Excluir conversa';del.setAttribute('aria-label','Excluir '+c.title);
  del.addEventListener('click',()=>deleteChat(c.id));row.append(open,del);historyEl.appendChild(row);
 }
}
function deleteChat(id){
 if(sending){setStatus('Aguarde a resposta atual','#efc28a');return}
 const index=chats.findIndex(c=>c.id===id);if(index<0)return;
 if(chats[index].messages.length&&!confirm('Excluir esta conversa apenas deste navegador?'))return;
 chats.splice(index,1);if(!chats.length)chats.push(makeChat());if(id===activeId)activeId=chats[0].id;
 saveHistory();renderHistory();renderChat();closeMenu();
}
function newChat(){
 if(sending){setStatus('Aguarde a resposta atual','#efc28a');return}
 const current=selectedChat();if(current?.messages.length){const c=makeChat();chats.unshift(c);activeId=c.id}
 saveHistory();renderHistory();renderChat();closeMenu();input.focus();
}
qs('#newChat').addEventListener('click',newChat);qs('#mobileNew').addEventListener('click',newChat);qs('#clearHistory').addEventListener('click',()=>deleteChat(activeId));
function scrollDown(){requestAnimationFrame(()=>{chat.scrollTop=chat.scrollHeight})}
function renderText(body,answer){
 body.replaceChildren();
 const fence='\x60\x60\x60';
 const parts=String(answer).split(new RegExp('('+fence+'[^\\n]*\\n[\\s\\S]*?'+fence+')','g'));
 for(const part of parts){if(!part)continue;const match=part.match(new RegExp('^'+fence+'([^\\n]*)\\n([\\s\\S]*?)'+fence+'$'));
  if(!match){const prose=document.createElement('div');prose.className='prose';prose.textContent=part;body.appendChild(prose);continue}
  const language=match[1].trim().split(/\s+/)[0]||'código',source=match[2].replace(/\n$/,'');
  const box=document.createElement('div'),head=document.createElement('div');box.className='code-panel';head.className='code-head';
  const label=document.createElement('span');label.textContent=language.toUpperCase();
  const copy=document.createElement('button');copy.type='button';copy.textContent='Copiar código';copy.addEventListener('click',()=>copyText(source,copy));
  const pre=document.createElement('pre'),code=document.createElement('code');code.textContent=source;pre.appendChild(code);head.append(label,copy);box.append(head,pre);body.appendChild(box);
 }
}
async function copyText(text,button){try{await navigator.clipboard.writeText(text);const before=button.textContent;button.textContent='Copiado ✓';setTimeout(()=>button.textContent=before,1400)}catch(e){setStatus('Não foi possível copiar','#ff8d8d')}}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200)}
function actionButtons(body,answer){
 const actions=document.createElement('div');actions.className='actions';
 const copy=document.createElement('button');copy.className='download';copy.type='button';copy.textContent='Copiar resposta';copy.addEventListener('click',()=>copyText(answer,copy));
 const txt=document.createElement('button');txt.className='download';txt.type='button';txt.textContent='↓ TXT';txt.addEventListener('click',()=>downloadBlob(new Blob([answer],{type:'text/plain;charset=utf-8'}),'eliza-resposta.txt'));
 const zip=document.createElement('button');zip.className='download';zip.type='button';zip.textContent='↓ ZIP';zip.addEventListener('click',async()=>{try{const r=await fetch('/api/package',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:answer})});if(!r.ok){const e=await r.json().catch(()=>({}));throw Error(e.error||'Nenhum bloco de código encontrado.')}downloadBlob(await r.blob(),'eliza-arquivos.zip')}catch(e){setStatus(e.message,'#ff8d8d')}});
 actions.append(copy,txt,zip);body.parentElement.appendChild(actions);
}
function addMessage(message){
 const el=document.createElement('article');el.className='msg '+message.role;
 const avatar=document.createElement('div');avatar.className='avatar';avatar.setAttribute('aria-hidden','true');avatar.textContent='✳';
 const content=document.createElement('div'),role=document.createElement('div');content.className='msg-content';role.className='role';
 role.textContent=message.role==='user'?'Você':'Eliza Dev';
 if(message.model&&message.role==='assistant'){const small=document.createElement('small');small.textContent='· '+message.model;role.appendChild(small)}
 const body=document.createElement('div');body.className='body';
 if(message.role==='assistant')renderText(body,message.content)
 else body.textContent=message.display||message.content;
 content.append(role,body);if(message.role==='assistant'&&message.content)actionButtons(body,message.content);if(message.role==='assistant')el.append(avatar,content);else el.append(content);
 chatInner.appendChild(el);scrollDown();return{body,role,el};
}
function renderChat(){
 chatInner.replaceChildren();const c=selectedChat();if(!c||!c.messages.length){
  const welcome=document.createElement('section'),mark=document.createElement('div');welcome.className='welcome';mark.className='welcome-mark';mark.textContent='✳';
  const h=document.createElement('h1'),p=document.createElement('p');h.textContent='O que vamos criar hoje?';p.textContent='Converse, programe e transforme ideias em projetos.';
  const choices=document.createElement('div');choices.className='suggestions';
  [['Criar um jogo HTML','Desenvolva um jogo 2D para celular em HTML, CSS e JavaScript.'],['Revisar meu código','Analise o código que vou anexar e identifique erros e melhorias.'],['Construir um aplicativo','Crie a estrutura de um PWA leve e responsivo.'],['Explicar programação','Explique passo a passo um conceito de programação.']].forEach(([name,prompt])=>{const b=document.createElement('button');b.className='suggestion';b.type='button';b.textContent=name;const small=document.createElement('small');small.textContent='Começar com esta ideia →';b.appendChild(small);b.addEventListener('click',()=>{input.value=prompt;resizeInput();input.focus()});choices.appendChild(b)});
  welcome.append(mark,h,p,choices);chatInner.appendChild(welcome);
 }else c.messages.forEach(addMessage);scrollDown();
}
try{initHistory();renderHistory();renderChat();}
catch(err){
 reportClientError(err);
 // A corrupted previously saved chat must not block the AI selector.
 chats.length=0;const fresh=makeChat();chats.push(fresh);activeId=fresh.id;
 try{chatInner.replaceChildren();renderHistory();renderChat()}catch(e){reportClientError(e)}
}
function chosenLabel(){return modelSelect.options[modelSelect.selectedIndex]?.textContent||modelSelect.value}
async function loadModels(){
 refreshButton.disabled=true;modelInfo.textContent='Consultando serviços locais…';
 try{
  const previous=safeStore.getItem(MODEL_KEY)||modelSelect.value||'auto';
  const response=await fetch('/api/models',{cache:'no-store'});const data=await response.json();if(!response.ok||!Array.isArray(data.models))throw Error(data.error||'Catálogo inválido');
  catalog=new Map(data.models.map(item=>[item.id,item]));modelSelect.replaceChildren();
  for(const item of data.models){const provider=item.source==='ollama-cloud'?'nuvem':item.source==='gguf'?'GGUF':item.source==='ollama'?'Ollama':'local';const option=new Option(item.label+' · '+provider+(item.available?'':' (offline)'),item.id);option.disabled=!item.available;modelSelect.add(option)}
  const available=catalog.get(previous)?.available?previous:(catalog.get('auto')?.available?'auto':data.models.find(x=>x.available)?.id||'');
  modelSelect.value=available;safeStore.setItem(MODEL_KEY,available);
  modelInfo.textContent='Roteador: '+(data.routerConnected?'conectado':'offline')+' · Ollama: '+(data.ollamaConnected?'conectado':'offline');
  setStatus(available?'Pronto':'Sem modelos disponíveis',available?'#a6edce':'#ff8d8d');send.disabled=!available;
 }catch(e){modelInfo.textContent='Não foi possível consultar modelos: '+e.message;setStatus('IA indisponível','#ff8d8d');send.disabled=true}
 finally{refreshButton.disabled=false}
}
modelSelect.addEventListener('change',()=>{safeStore.setItem(MODEL_KEY,modelSelect.value);setStatus('Modelo: '+chosenLabel())});
refreshButton.addEventListener('click',loadModels);loadModels();
function updateFiles(){fileNames.textContent=selectedFiles.length?selectedFiles.map(f=>f.name).join(', '):'Anexar arquivo';fileNames.title=fileNames.textContent}
fileInput.addEventListener('change',()=>{selectedFiles=[...fileInput.files];updateFiles()});
const textExtensions=/\.(html?|css|js|ts|jsx|tsx|py|cs|cpp|c|h|hpp|java|json|md|txt|sql|sh|bash|yml|yaml|xml|gd|log|csv|ini|toml|env|svg)$/i;
function readFile(file){
 const isImage=file.type.startsWith('image/');
 if(!isImage&&!textExtensions.test(file.name)&&!file.type.startsWith('text/'))return Promise.reject(Error('Arquivo binário não suportado: '+file.name+'. Use arquivos de código ou texto.'));
 if(file.size>(isImage?4*1024*1024:1024*1024))return Promise.reject(Error('Arquivo excede o limite: '+file.name+' (4 MB imagem / 1 MB texto).'));
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({name:file.name,type:file.type||(isImage?'image/png':'text/plain'),size:file.size,content:reader.result});reader.onerror=()=>reject(Error('Não foi possível ler '+file.name));if(isImage)reader.readAsDataURL(file);else reader.readAsText(file)});
}
function resizeInput(){input.style.height='auto';input.style.height=Math.min(input.scrollHeight,Math.round(window.innerHeight*.36))+'px'}
input.addEventListener('input',resizeInput);
form.addEventListener('submit',async e=>{
 e.preventDefault();if(sending)return;
 const text=input.value.trim(),model=modelSelect.value;if(!text&&!selectedFiles.length)return;
 if(!model||!catalog.get(model)?.available){setStatus('Escolha uma IA disponível','#ff8d8d');return}
 if(selectedFiles.length>10){setStatus('Máximo de 10 anexos','#ff8d8d');return}
 let attachments;try{attachments=await Promise.all(selectedFiles.map(readFile))}catch(err){setStatus(err.message,'#ff8d8d');return}
 const c=selectedChat(),shown=text+(attachments.length?'\n\n[Anexos: '+attachments.map(f=>f.name).join(', ')+']':'');
 const turn={role:'user',content:text||'Analise os arquivos anexados.',display:shown,model:''};
 c.messages.push(turn);if(c.title==='Nova conversa')c.title=(text||attachments.map(a=>a.name).join(', ')).slice(0,46)||'Arquivos anexados';
 input.value='';resizeInput();addMessage(turn);renderHistory();saveHistory();
 const payloadMessages=c.messages.slice(-24).map(m=>({role:m.role,content:m.content}));
 sending=true;send.disabled=true;modelSelect.disabled=true;setStatus('Gerando resposta…','#e9e9ed');
 const placeholder=addMessage({role:'assistant',content:'Pensando…',model:''});
 try{
  const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,messages:payloadMessages,attachments})});
  const data=await res.json();if(!res.ok)throw Error(data.error||'Erro no servidor');
  const answer=data.message||'Resposta vazia',actual=data.actualModel||data.label||model;
  placeholder.el.remove();c.messages.push({role:'assistant',content:answer,display:answer,model:actual});addMessage(c.messages[c.messages.length-1]);saveHistory();
  setStatus('Pronto');selectedFiles=[];fileInput.value='';updateFiles();
 }catch(err){placeholder.el.remove();c.messages.pop();input.value=text;resizeInput();renderChat();saveHistory();setStatus('Erro: '+err.message,'#ff8d8d')}
 finally{sending=false;send.disabled=!catalog.get(modelSelect.value)?.available;modelSelect.disabled=false;input.focus()}
});
input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229){e.preventDefault();form.requestSubmit()}});
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
    if ALLOW_CLOUD and CLOUD_TAG in installed_tags:
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
    def require_login(self):
        """Protect every route, including /api/chat and the PWA assets."""
        if not REQUIRE_AUTH:
            return False
        raw = self.headers.get("Authorization", "")
        accepted = False
        if raw.startswith("Basic "):
            try:
                value = base64.b64decode(raw[6:].strip(), validate=True).decode("utf-8")
                user, password = value.split(":", 1)
                accepted = (secrets.compare_digest(user, ACCESS_USER)
                            & secrets.compare_digest(password, ACCESS_PASSWORD))
            except (ValueError, UnicodeError):
                pass
        if accepted:
            return False
        body = b"Acesso restrito: informe o usuario e a senha do Eliza."
        self.send_response(401)
        self.send_header("WWW-Authenticate", 'Basic realm="Eliza Dev", charset="UTF-8"')
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        return True

    def verify_origin(self):
        """Reject browser cross-site POSTs; same-origin and CLI requests work."""
        origin = self.headers.get("Origin", "")
        if not origin:
            return True
        parsed = urlsplit(origin)
        host = self.headers.get("Host", "")
        return parsed.scheme in ("http", "https") and parsed.netloc.lower() == host.lower()

    def log_message(self, fmt, *args):
        print(f"[Eliza Dev] {self.address_string()} - {fmt % args}")

    def send_json(self, status, data):
        raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        if self.require_login():
            return
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        if self.require_login():
            return
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
        if self.require_login():
            return
        if not self.verify_origin():
            self.send_json(403, {"error": "Origem não autorizada."})
            return
        if self.path not in ("/api/chat", "/api/package"):
            self.send_error(404)
            return
        guarded = self.path == "/api/chat"
        if guarded and not INFERENCE_SLOT.acquire(blocking=False):
            self.send_json(429, {"error": "Uma geração já está em andamento. Aguarde e tente novamente."})
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
        finally:
            if guarded:
                INFERENCE_SLOT.release()


if __name__ == "__main__":
    print(f"Eliza Dev em http://{HOST}:{PORT}")
    print(f"Roteador: {ROUTER_URL} | Ollama: {OLLAMA_URL} | modelo padrão: {DEFAULT_MODEL}")
    print("Autenticação: " + ("ativada" if REQUIRE_AUTH else "desativada (uso local)"))
    print("Pressione CTRL+C para encerrar.")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
