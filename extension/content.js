"use strict";
(() => {
  if(globalThis.__VISUAL_CAPTURE_ADAPTER__)return;
  let initialized=false, tabId=null;
  const engine=VisualEngine.create({detailReader:async payload=>{
    const response=await chrome.runtime.sendMessage({type:'VPC_DETAIL',action:'collect',payload});
    if(!response?.ok){const error=new Error(response?.error || '无法读取详情。');error.needsUser=!!response?.needsUser;error.checks=response?.checks || [];throw error;}
    return response.data;
  },onUpdate:async data=>{
    if(tabId==null)return;
    const saved={...data,updatedAt:Date.now()};
    const entry={['vpc.session.'+tabId]:saved};
    if(data.config)entry['vpc.archive.'+data.config.id+'.'+encodeURIComponent(data.source)]=saved;
    await chrome.storage.local.set(entry);
    if(!data.running)await chrome.runtime.sendMessage({type:'VPC_DETAIL',action:'finish',needsUser:!!data.needsUser});
  }});
  globalThis.__VISUAL_CAPTURE_ADAPTER__=engine;
  chrome.runtime.onMessage.addListener((request,sender,respond)=>{
    if(request?.type!=='VPC_CONTENT' || sender.id!==chrome.runtime.id)return;
    (async()=>{
      if(request.action==='init'){
        if(!initialized){
          tabId=request.tabId;
          if(request.saved){
            const data=structuredClone(request.saved);
            if(data.pending)data.page=data.pending.nextPage || data.page;
            engine.restore(data);
          }
          initialized=true;
        }
        return engine.snapshot();
      }
      if(!initialized)throw new Error('工作台尚未连接当前网页。');
      if(request.action==='context')return {url:location.href,title:document.title};
      if(request.action==='state')return engine.snapshot();
      if(request.action==='suggest')return engine.suggest(request.payload);
      if(request.action==='checkList')return engine.checkList(request.payload);
      if(request.action==='entry')return engine.entry(request.payload);
      if(request.action==='pick')return engine.pick(request.payload);
      if(request.action==='cancelPick'){engine.cancelPick();return {};}
      if(request.action==='preview')return engine.preview(request.payload);
      if(request.action==='sample'){
        if(new URL(location.href).origin!==request.payload.config.detail.origin)throw new Error('详情样例网站已改变，请重新连接。');
        return engine.sample(request.payload.config);
      }
      if(request.action==='repair')return engine.repair(request.payload);
      if(request.action==='start')return engine.start(request.payload);
      if(request.action==='stop')return engine.stop();
      if(request.action==='clear')return engine.clear();
      throw new Error('未知操作。');
    })().then(data=>respond({ok:true,data})).catch(error=>respond({ok:false,error:error.message}));
    return true;
  });
})();
