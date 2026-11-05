import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const config={match:{origin:'https://list.test'},detail:{mode:'page',origin:'https://jobs.test',identityField:'name'},fields:[{id:'name',scope:'list'},{id:'description',scope:'detail'}],options:{timeout:1000}};
const payload=(id=1)=>({config,data:{name:'职位'+id},link:'https://jobs.test/detail/'+id});
function setup(){
  const calls=[],session={},tabs=new Map([[1,{id:1,url:'https://list.test/search',status:'complete'}],[2,{id:2,url:'https://jobs.test/sample',status:'complete'}]]);
  let next=100;
  const chrome={permissions:{contains:async p=>{calls.push(['permission',p]);return true;}},storage:{session:{get:async key=>({[key]:session[key]}),set:async data=>Object.assign(session,data),remove:async key=>delete session[key]}},tabs:{
    get:async id=>{if(!tabs.has(id))throw new Error('closed');return tabs.get(id);},
    create:async args=>{const tab={id:next++,...args,status:'complete'};tabs.set(tab.id,tab);calls.push(['create',args,tab.id]);return tab;},
    update:async(id,args)=>{Object.assign(tabs.get(id),args);calls.push(['update',id,args]);return tabs.get(id);},
    remove:async id=>{tabs.delete(id);calls.push(['remove',id]);}
  },scripting:{executeScript:async args=>{calls.push(['execute',args]);return [{result:args.world==='MAIN'?{ok:true,url:'https://jobs.test/detail/1'}:{ok:true,data:{description:'描述',_detailUrl:tabs.get(args.target.tabId).url}}}];}}};
  const context=vm.createContext({chrome,URL,Date,setTimeout});
  for(const file of ['detail-reader.js','detail-manager.js'])vm.runInContext(fs.readFileSync(new URL('../extension/'+file,import.meta.url),'utf8'),context);
  return {chrome,calls,session,tabs,manager:context.VisualDetailManager};
}
test('different detail URLs reuse one owned background tab and never close sample',async()=>{
  const a=setup();assert.equal((await a.manager.collect(1,payload())).description,'描述');
  await a.manager.collect(1,payload(2));
  assert.equal(a.calls.filter(c=>c[0]==='create').length,1);
  assert.ok(a.calls.some(c=>c[0]==='update' && c[2].url==='https://jobs.test/detail/2'));
  await a.manager.close(1);
  assert.ok(a.tabs.has(2));assert.ok(!a.tabs.has(100));
});
test('missing host permission refuses before opening or clicking anything',async()=>{
  const a=setup();a.chrome.permissions.contains=async()=>false;
  await assert.rejects(a.manager.collect(1,payload()),/允许访问/);
  assert.ok(!a.calls.some(c=>['create','execute'].includes(c[0])));
});
test('foreign detail links are rejected without navigation',async()=>{
  const a=setup();await assert.rejects(a.manager.collect(1,{...payload(),link:'https://foreign.test/a'}),/不属于/);
  assert.ok(!a.calls.some(c=>c[0]==='create'));
});
test('JS-only title entry captures a URL before navigating selected detail site',async()=>{
  const a=setup();await a.manager.collect(1,{...payload(),link:'',config:{...config,detail:{...config.detail,clickSelector:'.title'}},rowSelector:'.record'});
  assert.equal(a.calls.find(c=>c[0]==='execute')[1].world,'MAIN');
  assert.ok(a.calls.some(c=>c[0]==='create'));
});
test('verification preserves and focuses owned page for manual completion',async()=>{
  const a=setup();a.chrome.scripting.executeScript=async()=>[{result:{ok:false,needsUser:true,error:'人工验证'}}];
  await assert.rejects(a.manager.collect(1,payload()),e=>e.needsUser===true);
  assert.ok(a.tabs.has(100));assert.equal(a.tabs.get(100).active,true);
  await a.manager.close(1,{keep:true});assert.ok(a.tabs.has(100));
  a.chrome.scripting.executeScript=async()=>[{result:{ok:true,data:{description:'完成'}}}];
  assert.equal((await a.manager.collect(1,payload())).description,'完成');
  assert.ok(!a.calls.some(c=>c[0]==='update' && c[2].url));
});
test('ordinary extraction failure closes only owned page and preserves sample',async()=>{
  const a=setup();a.chrome.scripting.executeScript=async()=>[{result:{ok:false,error:'字段为空'}}];
  await assert.rejects(a.manager.collect(1,payload()),/字段为空/);
  assert.ok(!a.tabs.has(100));assert.ok(a.tabs.has(2));
});
test('cancel interrupts in-flight detail and does not leak a tab',async()=>{
  const a=setup();let resolve,entered;
  const ready=new Promise(r=>entered=r);
  a.chrome.scripting.executeScript=async()=>{entered();return new Promise(r=>resolve=r);};
  const collecting=a.manager.collect(1,payload());await ready;
  await a.manager.cancel(1);resolve([{result:{ok:true,data:{description:'late'}}}]);
  await assert.rejects(collecting,/已暂停/);assert.ok(!a.tabs.has(100));
});
test('parallel reads for a list are rejected to prevent overwritten detail navigation',async()=>{
  const a=setup();let resolve,entered;
  const ready=new Promise(r=>entered=r);
  a.chrome.scripting.executeScript=async()=>{entered();return new Promise(r=>resolve=r);};
  const first=a.manager.collect(1,payload());await ready;
  await assert.rejects(a.manager.collect(1,payload(2)),/上一条/);
  resolve([{result:{ok:true,data:{description:'one'}}}]);await first;await a.manager.close(1);
});
test('reader functions remain valid when Chrome serializes them for injection',()=>{
  const context=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../extension/detail-reader.js',import.meta.url),'utf8'),context);
  for(const fn of Object.values(context.VisualDetail))assert.doesNotThrow(()=>new vm.Script('('+fn.toString()+')'));
});
