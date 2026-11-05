import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../extension/background.js',import.meta.url),'utf8');
function setup(url='https://example.com/list'){
  const calls=[],data={};let click,rpc,update;
  const chrome={
    runtime:{id:'vpc-test',onMessage:{addListener:fn=>{rpc=fn;}}},
    action:{onClicked:{addListener:fn=>{click=fn;}},setTitle:async args=>calls.push(['title',args])},
    sidePanel:{open:async args=>calls.push(['panel',args])},
    scripting:{executeScript:async args=>calls.push(['inject',args])},
    storage:{local:{get:async()=>data}},
    tabs:{onRemoved:{addListener:()=>{}},get:async id=>({id,url,title:'Test page'}),update:async()=>{},query:async()=>[{id:9,url}],onUpdated:{addListener:fn=>{update=fn;}},sendMessage:async(id,message)=>{calls.push(['message',id,message]);return {ok:true,data:{status:'idle',records:[]}};}}
  };
  const context=vm.createContext({chrome,URL,Date,setTimeout});context.importScripts=(...files)=>files.forEach(f=>vm.runInContext(fs.readFileSync(new URL('../extension/'+f,import.meta.url),'utf8'),context));vm.runInContext(source,context);
  return{calls,data,click:updateTab=>click(updateTab),request:(message,sender={id:'vpc-test'})=>new Promise(resolve=>{const wait=rpc(message,sender,resolve);if(!wait)resolve(undefined);}),update:(...args)=>update(...args)};
}
test('toolbar click opens the native side panel before asynchronous injection',async()=>{
  const app=setup();app.click({id:9});assert.equal(app.calls[0][0],'panel');
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(app.calls.some(c=>c[0]==='inject'));
});
test('messages from other extensions are ignored',async()=>{
  const app=setup();const reply=await app.request({type:'VPC_RPC',action:'state'},{id:'other'});
  assert.equal(reply,undefined);assert.equal(app.calls.length,0);
});
test('current tab is initialized and used for picker requests',async()=>{
  const app=setup();const reply=await app.request({type:'VPC_RPC',action:'pick',payload:{kind:'list'}});
  assert.equal(reply.ok,true);
  const messages=app.calls.filter(c=>c[0]==='message');
  assert.equal(messages[0][2].action,'init');assert.equal(messages[1][2].action,'pick');assert.equal(messages[1][1],9);
});
test('internal browser pages are refused before injection',async()=>{
  const app=setup('chrome://extensions/');const reply=await app.request({type:'VPC_RPC',action:'state'});
  assert.equal(reply.ok,false);assert.ok(!app.calls.some(c=>c[0]==='inject'));
});
test('a cached task from another origin is not restored',async()=>{
  const app=setup();app.data['vpc.session.9']={source:'https://other.example/list',config:{id:'old'},records:[{a:'old'}]};
  await app.request({type:'VPC_RPC',action:'state'});
  const init=app.calls.find(c=>c[0]==='message')[2];assert.equal(init.saved,null);
});
test('same-origin page completion resumes an explicitly pending pagination task',async()=>{
  const app=setup('https://example.com/list?page=2');
  app.data['vpc.session.9']={source:'https://example.com/list',config:{id:'demo'},pending:{at:Date.now(),origin:'https://example.com'},records:[]};
  app.update(9,{status:'complete'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(app.calls.some(c=>c[0]==='message' && c[2].action==='start'));
});
test('a pending task cannot auto-resume on a different origin',async()=>{
  const app=setup('https://other.example/list');
  app.data['vpc.session.9']={source:'https://example.com/list',config:{id:'demo'},pending:{at:Date.now(),origin:'https://example.com'},records:[]};
  app.update(9,{status:'complete'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(!app.calls.some(c=>c[0]==='inject' || c[0]==='message'));
});
