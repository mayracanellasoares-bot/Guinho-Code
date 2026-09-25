const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html=fs.readFileSync('eliza-dev-pwa/ui-v4.html','utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(source,'JS should be present');
function run({blockedStorage=false, oldHistory=false}={}){
 const elements=new Map();
 function element(tag='div'){
  return {tag, textContent:'',className:'',title:'',value:'auto',style:{},listeners:{},options:[],children:[],disabled:false,scrollTop:0,scrollHeight:10,
    classList:{add(){},remove(){},toggle(){return true}},
    addEventListener(name,cb){this.listeners[name]=cb},setAttribute(){},
    append(...items){for(const item of items){if(item&&typeof item==='object')item.parentElement=this;this.children.push(item)}},appendChild(item){if(item&&typeof item==='object')item.parentElement=this;this.children.push(item);return item},
    replaceChildren(...items){this.children=[];this.append(...items)},add(item){this.options.push(item)},
    focus(){},remove(){},requestSubmit(){},getAttribute(){return null}
  };
 }
 const document={
   querySelector(sel){if(!elements.has(sel))elements.set(sel,element());return elements.get(sel)},
   createElement:element,
   addEventListener(){},
 };
 const data=new Map();
 if(oldHistory)data.set('elizaDevChatV3',JSON.stringify([{role:'user',content:'ola'},{role:'assistant',content:'Resposta com codigo'}]));
 const storage={getItem(key){if(blockedStorage)throw Error('SecurityError');return data.get(key)||null},
 setItem(key,val){if(blockedStorage)throw Error('SecurityError');data.set(key,val)},
 removeItem(key){if(blockedStorage)throw Error('SecurityError');data.delete(key)}};
 const errors=[],calls=[];
 const context={
   document,localStorage:storage,window:{innerHeight:700,addEventListener(){}},
   navigator:{},requestAnimationFrame(cb){cb()},
   fetch:async(url)=>{calls.push(url);return{ok:true,json:async()=>({models:[{id:'auto',label:'Automático',source:'auto',available:true},{id:'smol',label:'Smol',source:'ollama',available:true}],routerConnected:true,ollamaConnected:true})}},
   Option:class {constructor(label,value){this.textContent=label;this.value=value}},
   setTimeout(){},confirm(){return true},URL,Blob,
   console:{log(){},warn(){},error(...args){errors.push(args.map(String).join(' '))}}
 };
 try{vm.runInNewContext(source,context,{timeout:2500});}
 catch(e){errors.push(e.message)}
 return{elements,calls,errors};
}
test('fresh browser renders greeting and model selector',async()=>{
 const r=run();await new Promise(setImmediate);
 assert.deepEqual(r.errors,[]);
 assert.ok(r.calls.includes('/api/models'),'models endpoint must be requested');
 assert.equal(r.elements.get('#status').textContent,'Pronto');
 const welcome=r.elements.get('#chatInner').children[0];
 assert.equal(welcome?.className,'welcome','welcome must mount in DOM');
 assert.equal(welcome?.children[1]?.textContent,'O que vamos criar hoje?');
 assert.equal(r.elements.get('#model').options.length,2);
});
test('old chat renders existing assistant response and its buttons',async()=>{
 const r=run({oldHistory:true});await new Promise(setImmediate);
 assert.deepEqual(r.errors,[]);
 assert.ok(r.calls.includes('/api/models'));
 assert.equal(r.elements.get('#status').textContent,'Pronto');
 const rows=r.elements.get('#chatInner').children;
 assert.equal(rows.length,2,'old messages should render without blanking the UI');
 assert.equal(rows[1]?.className,'msg assistant');
 assert.equal(rows[1]?.children[1]?.children[2]?.className,'actions','copy/download actions mount after body');
});
test('blocked browser storage still renders greeting and models',async()=>{
 const r=run({blockedStorage:true});await new Promise(setImmediate);
 assert.deepEqual(r.errors,[]);
 assert.ok(r.calls.includes('/api/models'));
 assert.equal(r.elements.get('#status').textContent,'Pronto');
 assert.equal(r.elements.get('#chatInner').children[0]?.className,'welcome');
});