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
    append(...items){this.children.push(...items)},appendChild(item){this.children.push(item);return item},
    replaceChildren(...items){this.children=items},add(item){this.options.push(item)},
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
test('fresh browser leaves Iniciando and lists models',async()=>{
 const r=run();await new Promise(setImmediate);
 assert.deepEqual(r.errors,[]);
 assert.ok(r.calls.includes('/api/models'),'models endpoint must be requested');
 assert.notEqual(r.elements.get('#status').textContent,'Iniciando');
});
test('old chat migrates without blocking models',async()=>{
 const r=run({oldHistory:true});await new Promise(setImmediate);
 assert.deepEqual(r.errors,[]);
 assert.ok(r.calls.includes('/api/models'));
 assert.notEqual(r.elements.get('#status').textContent,'Iniciando');
});
test('browser blocking localStorage still allows models to load',async()=>{
 const r=run({blockedStorage:true});await new Promise(setImmediate);
 assert.deepEqual(r.errors,[]);
 assert.ok(r.calls.includes('/api/models'),'storage permissions cannot block chat UI');
 assert.notEqual(r.elements.get('#status').textContent,'Iniciando');
});