import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function setup({allowed=true,activeId=30}={}){
  const calls=[],data={};let app;
  const chrome={windows:{getCurrent:async()=>({id:7})},storage:{session:{get:async()=>({'vpc.bindings.7':{list:10,detail:20}}),set:async d=>Object.assign(data,d)},local:{get:async()=>({}),set:async()=>{}}},permissions:{request:p=>{calls.push(['permission',p]);return Promise.resolve(allowed);}},runtime:{sendMessage:async m=>{calls.push(['message',m]);return {ok:true,data:m.action==='sampleForPick'?{tabId:40,url:'https://detail.test/sample'}:m.action==='context'?{tabId:m.tabId ?? activeId,url:'https://detail.test/sample',title:'sample'}:{records:[]}};}}};
  vm.runInNewContext(fs.readFileSync(new URL('../extension/panel.js',import.meta.url),'utf8'),{chrome,URL,document:{querySelector:()=>({})},VisualStudio:{create:opts=>app=opts}});
  return {app,calls,data,chrome};
}
test('page mode requests just selected sites synchronously from start gesture',async()=>{
  const a=setup();const promise=a.app.api('start',{match:{origin:'https://list.test'},detail:{mode:'page',origin:'https://detail.test'},fields:[{scope:'detail'}]});
  assert.equal(a.calls[0][0],'permission');assert.deepEqual(Array.from(a.calls[0][1].origins),['https://list.test/*','https://detail.test/*']);
  await promise;assert.equal(a.calls[1][1].tabId,10);
});
test('denied permission leaves both websites untouched',async()=>{
  const a=setup({allowed:false});await assert.rejects(a.app.api('start',{match:{origin:'https://list.test'},detail:{mode:'page',origin:'https://detail.test'},fields:[{scope:'detail'}]}),/未获得/);
  assert.equal(a.calls.filter(c=>c[0]==='message').length,0);
});
test('detail field picks use sample tab while list picks keep original tab',async()=>{
  const a=setup();await a.app.api('pick',{kind:'field-detail',role:'detail'});await a.app.api('pick',{kind:'field-list',role:'list'});
  assert.equal(a.calls[0][1].tabId,20);assert.equal(a.calls[1][1].tabId,10);
});
test('connecting detail sample does not replace the list binding',async()=>{
  const a=setup();await a.app.api('detailContext',{current:true});await a.app.api('state');
  assert.equal(a.data['vpc.bindings.7'].list,10);assert.equal(a.data['vpc.bindings.7'].detail,30);assert.equal(a.calls.at(-1)[1].tabId,10);
});

test('list tab cannot be bound as an independent detail sample',async()=>{
  const a=setup({activeId:10});await assert.rejects(a.app.api('detailContext',{current:true}),/这还是列表标签页/);
  assert.equal(a.data['vpc.bindings.7'],undefined);
});
test('automatic detail reading requests selected hosts in its click gesture',async()=>{
  const a=setup();const promise=a.app.api('autoDetail',{config:{match:{origin:'https://list.test'},detail:{origin:'https://detail.test'}},url:'https://detail.test/job'});
  assert.equal(a.calls[0][0],'permission');await promise;assert.equal(a.calls.at(-1)[1].tabId,10);
});

test('closed or missing detail binding is prepared before sending field picker',async()=>{
  const a=setup();const payload={kind:'field-detail',role:'detail',config:{match:{origin:'https://list.test'},detail:{mode:'page',origin:'https://detail.test',sampleUrl:'https://detail.test/sample'}}};
  const promise=a.app.api('pick',payload);assert.equal(a.calls[0][0],'permission');await promise;
  const messages=a.calls.filter(c=>c[0]==='message').map(c=>c[1]);
  assert.equal(messages[0].action,'sampleForPick');assert.equal(messages[0].tabId,10);
  assert.equal(messages[1].action,'pick');assert.equal(messages[1].tabId,40);
  assert.equal(a.data['vpc.bindings.7'].list,10);assert.equal(a.data['vpc.bindings.7'].detail,40);
});
test('cancel during sample opening prevents starting an orphaned picker',async()=>{
  const a=setup();let ready,resolve;
  const entered=new Promise(r=>ready=r),wait=new Promise(r=>resolve=r);
  const original=a.chrome.runtime.sendMessage;
  a.chrome.runtime.sendMessage=async message=>{if(message.action==='sampleForPick'){ready();await wait;return {ok:true,data:{tabId:40}};}return original(message);};
  const picking=a.app.api('pick',{kind:'field-detail',role:'detail',config:{match:{origin:'https://list.test'},detail:{mode:'page',origin:'https://detail.test',sampleUrl:'https://detail.test/sample'}}});
  await entered;await a.app.api('cancelPick',{role:'detail'});resolve();
  await assert.rejects(picking,/取消/);
  assert.ok(!a.calls.some(c=>c[0]==='message' && c[1].action==='pick'));
  assert.ok(a.calls.some(c=>c[0]==='message' && c[1].action==='stop' && c[1].tabId===10));
});
