"use strict";
let listTabId,detailTabId,bindingKey,pendingSample;
const bindingsReady=(async()=>{
  const window=await chrome.windows.getCurrent();bindingKey='vpc.bindings.'+window.id;
  const saved=(await chrome.storage.session.get(bindingKey))[bindingKey] || {};
  listTabId=saved.list;detailTabId=saved.detail;
})();
const pattern=origin=>{const u=new URL(origin);return u.protocol+'//'+u.hostname+'/*';};
const api=async(action,payload)=>{
  // Invoke permission request directly within the Start click, before any await.
  let grant;
  const detailPick=action==='pick' && payload?.role==='detail' && payload.config?.detail?.mode==='page';
  const permissionConfig=action==='autoDetail' || detailPick?payload.config:payload;
  if(detailPick && !permissionConfig.detail.origin)throw new Error('请先点“自动读取详情”，工作台会打开详情样例，再点选这个字段。');
  if(action==='autoDetail' || detailPick || (action==='start' && payload.detail?.mode==='page' && payload.fields.some(f=>f.scope==='detail')))
    grant=chrome.permissions.request({origins:[...new Set([pattern(permissionConfig.match.origin),pattern(permissionConfig.detail.origin)])]});
  if(grant && !await grant)throw new Error('未获得网站访问权限，尚未开始采集。');
  await bindingsReady;
  if(action==='cancelPick' && pendingSample){pendingSample.cancelled=true;await chrome.runtime.sendMessage({type:'VPC_RPC',tabId:listTabId,action:'stop'});return {};}
  if(detailPick){
    if(listTabId==null)throw new Error('请先连接职位列表，再点选详情字段。');
    const operation={cancelled:false};pendingSample=operation;
    try{
      const response=await chrome.runtime.sendMessage({type:'VPC_RPC',tabId:listTabId,action:'sampleForPick',payload:{config:payload.config,sampleTabId:detailTabId}});
      if(operation.cancelled)throw new Error('已取消点选。');
      if(!response?.ok){const error=new Error(response?.error || '无法打开详情样例，请重新连接详情页。');error.needsEntry=!!response?.needsEntry;throw error;}
      detailTabId=response.data.tabId;
      await chrome.storage.session.set({[bindingKey]:{list:listTabId,detail:detailTabId}});
      if(operation.cancelled)throw new Error('已取消点选。');
    }finally{if(pendingSample===operation)pendingSample=null;}
  }
  const detail=action==='detailContext' || payload?.role==='detail';
  let tabId=detail?detailTabId:listTabId;
  if((action==='context' || action==='detailContext') && payload?.current)tabId=undefined;
  if(detail && action!=='detailContext' && tabId==null)throw new Error('请先打开一个详情页，点击工具栏图标，再点“连接详情样例”。');
  const response=await chrome.runtime.sendMessage({type:'VPC_RPC',tabId,action:action==='detailContext'?'context':action,payload});
  if(!response?.ok){const error=new Error(response?.error || '请在目标网页点一次工具栏图标。');error.needsEntry=!!response?.needsEntry;throw error;}
  if(action==='autoDetail' && response.data.sampleTabId!=null){detailTabId=response.data.sampleTabId;await chrome.storage.session.set({[bindingKey]:{list:listTabId,detail:detailTabId}});}
  if(action==='detailContext' && response.data.tabId===listTabId)throw new Error('这还是列表标签页。请先在新标签页打开一个职位详情，点击该页工作台图标，再连接详情样例。');
  if(action==='context' || action==='detailContext') {
    if(detail)detailTabId=response.data.tabId;else listTabId=response.data.tabId;
    await chrome.storage.session.set({[bindingKey]:{list:listTabId,detail:detailTabId}});
  }
  return response.data;
};
VisualStudio.create({element:document.querySelector('#app'),api,storage:{
  get:async()=> (await chrome.storage.local.get('vpc.templates.v1'))['vpc.templates.v1'] || {},
  set:async templates=>chrome.storage.local.set({'vpc.templates.v1':templates}),
  getDraft:async()=>{await bindingsReady;return (await chrome.storage.local.get(bindingKey+'.draft'))[bindingKey+'.draft'];},
  setDraft:async config=>{await bindingsReady;await chrome.storage.local.set({[bindingKey+'.draft']:config});}
}});
