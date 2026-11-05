import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';
function setup(failAt=0){
 let listener,data={},nextId=2;const tabs=new Map([[1,{id:1,url:'https://we.51job.com/pc/search?keyword=test',status:'complete'}]]),calls=[];
 const rows=Array.from({length:20},(_,i)=>({index:i,name:'岗位'+i,company:'公司'+i,salary:'9千-1.2万',location:'广州',key:'key'+i}));
 const chrome={downloads:{download:async opts=>{calls.push({download:opts});return 42;}},runtime:{id:'fixed51',onMessage:{addListener:f=>listener=f},onStartup:{addListener:()=>{}}},storage:{local:{set:async d=>{data=structuredClone(d);},get:async()=>structuredClone(data)}},permissions:{contains:async()=>true},alarms:{create:async()=>{},clear:async()=>{},onAlarm:{addListener:()=>{}}},tabs:{query:async()=>[tabs.get(1)],get:async id=>{if(!tabs.has(id))throw new Error('closed');return tabs.get(id);},create:async opts=>{const t={id:nextId++,...opts,status:'complete'};tabs.set(t.id,t);return t;},update:async(id,opts)=>Object.assign(tabs.get(id),opts),remove:async id=>tabs.delete(id)},scripting:{executeScript:async opts=>{
  if(opts.files)return [];
  const [method,arg]=opts.args;calls.push(method);
  if(method==='list')return [{result:rows}];
  if(method==='capture')return [{result:{ok:true,url:'https://jobs.51job.com/guangzhou/'+(arg.row.index+1)+'.html'}}];
  if(method==='detail'){
   const i=Number(new URL(arg.url).pathname.match(/(\d+)\.html/)[1]);
   if(i===failAt)return [{result:{ok:false,error:'职位对应错误'}}];
   return [{result:{ok:true,data:{name:arg.expected,salary:'9千-1.2万',company:'公司',location:'广州',duties:i===2?'':'职责',requirements:'要求',nature:'国企',scale:'1000人',industry:'服务',intro:'公司介绍',raw:'完整原文',issue:i===2?'未读到职责':'',_detailUrl:arg.url}}}];
  }
  if(method==='next')return [{result:false}];
  throw new Error('unexpected method');
 }}};
 const context=vm.createContext({chrome,URL,Date,TextEncoder,btoa,setTimeout:fn=>{queueMicrotask(fn);return 0;}});
 context.importScripts=(...files)=>files.forEach(f=>vm.runInContext(fs.readFileSync(new URL('../extension/'+f,import.meta.url),'utf8'),context));
 vm.runInContext(fs.readFileSync(new URL('../extension/background.js',import.meta.url),'utf8'),context);
 return {calls,tabs,get:()=>data.fixed51,request:(m)=>new Promise(resolve=>listener(m,{id:'fixed51'},resolve)),async finish(){for(let i=0;i<100;i++){await new Promise(r=>setImmediate(r));if(data.fixed51 && !data.fixed51.running)return data.fixed51;}throw new Error('not finished');}};
}
test('20 requested rows produce 20 results despite an individual missing field',async()=>{
 const app=setup();assert.equal((await app.request({action:'start',keyword:'test',count:20})).ok,true);const s=await app.finish();
 assert.equal(s.status,'done');assert.equal(s.records.length,20);assert.equal(s.records[1].duties,'');assert.ok(s.records[1].issue);assert.equal(s.errors.length,1);assert.equal(app.tabs.size,1);assert.equal(app.calls.filter(c=>c.download).length,1);assert.match(app.calls.find(c=>c.download).download.filename,/20条/);
});
test('identity error pauses and preserves earlier results',async()=>{
 const app=setup(2);await app.request({action:'start',keyword:'test',count:20});const s=await app.finish();assert.equal(s.status,'paused');assert.equal(s.records.length,1);assert.match(s.message,/对应错误/);assert.ok(!app.calls.some(c=>c.download));
});
test('insufficient list is explicitly reported rather than completed',async()=>{
 const app=setup();await app.request({action:'start',keyword:'test',count:30});const s=await app.finish();assert.equal(s.status,'shortage');assert.equal(s.records.length,20);assert.match(s.message,/20\/30/);assert.ok(!app.calls.some(c=>c.download));
});
test('invalid quantity is rejected before creating a job',async()=>{
 const app=setup();const r=await app.request({action:'start',keyword:'test',count:0});assert.equal(r.ok,false);assert.equal(app.get(),undefined);
});
