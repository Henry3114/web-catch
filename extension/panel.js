"use strict";
let listTabId,detailTabId,bindingKey;
const bindingsReady=(async()=>{
  const window=await chrome.windows.getCurrent();bindingKey='vpc.bindings.'+window.id;
  const saved=(await chrome.storage.session.get(bindingKey))[bindingKey] || {};
  listTabId=saved.list;detailTabId=saved.detail;
})();
const pattern=origin=>{const u=new URL(origin);return u.protocol+'//'+u.hostname+'/*';};
const api=async(action,payload)=>{
  // Invoke permission request directly within the Start click, before any await.
  let grant;
  const permissionConfig=action==='autoDetail'?payload.config:payload;
  if(action==='autoDetail' || (action==='start' && payload.detail?.mode==='page' && payload.fields.some(f=>f.scope==='detail')))
    grant=chrome.permissions.request({origins:[...new Set([pattern(permissionConfig.match.origin),pattern(permissionConfig.detail.origin)])]});
  if(grant && !await grant)throw new Error('未获得网站访问权限，尚未开始采集。');
  await bindingsReady;
  const detail=action==='detailContext' || payload?.role==='detail';
  let tabId=detail?detailTabId:listTabId;
  if((action==='context' || action==='detailContext') && payload?.current)tabId=undefined;
  if(detail && action!=='detailContext' && tabId==null)throw new Error('请先打开一个详情页，点击工具栏图标，再点“连接详情样例”。');
  const response=await chrome.runtime.sendMessage({type:'VPC_RPC',tabId,action:action==='detailContext'?'context':action,payload});
  if(!response?.ok)throw new Error(response?.error || '请在目标网页点一次工具栏图标。');
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
