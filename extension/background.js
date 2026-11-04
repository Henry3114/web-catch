"use strict";
async function connect(tabId){
  const tab=await chrome.tabs.get(tabId);
  if(!/^https?:\/\//.test(tab.url || ''))throw new Error('请切到普通网页并点击工具栏图标；浏览器内部页面不允许采集。');
  await chrome.scripting.executeScript({target:{tabId},files:['locator.js','engine.js','content.js']});
  const all=await chrome.storage.local.get(null);
  let saved=all['vpc.session.'+tabId];
  const valid=data=>data && (data.source===tab.url || (data.pending && Date.now()-data.pending.at<60000 && data.pending.origin===new URL(tab.url).origin));
  if(!valid(saved))saved=Object.entries(all).filter(([key,v])=>key.startsWith('vpc.archive.') && valid(v)).map(([,v])=>v).sort((a,b)=>b.updatedAt-a.updatedAt)[0];
  const reply=await chrome.tabs.sendMessage(tabId,{type:'VPC_CONTENT',action:'init',tabId,saved:valid(saved)?saved:null});
  if(!reply?.ok)throw new Error(reply?.error || '无法连接网页，请刷新后重试。');
  return tab;
}
chrome.action.onClicked.addListener(tab=>{
  if(tab.id==null)return;
  // 必须直接在用户点击事件中打开侧栏。
  chrome.sidePanel.open({tabId:tab.id}).catch(()=>{});
  connect(tab.id).catch(error=>chrome.action.setTitle({tabId:tab.id,title:error.message}));
});
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.type!=='VPC_RPC' || sender.id!==chrome.runtime.id)return;
  (async()=>{
    const [active]=await chrome.tabs.query({active:true,currentWindow:true});
    const id=message.tabId ?? active?.id;
    if(id==null)throw new Error('未找到当前网页。');
    const tab=await connect(id);
    if(message.action==='context')return {tabId:id,url:tab.url,title:tab.title};
    const response=await chrome.tabs.sendMessage(id,{type:'VPC_CONTENT',action:message.action,payload:message.payload});
    if(!response?.ok)throw new Error(response?.error || '网页没有响应。');
    return response.data;
  })().then(data=>reply({ok:true,data})).catch(error=>reply({ok:false,error:error.message}));
  return true;
});
chrome.tabs.onUpdated.addListener((id,info)=>{
  if(info.status!=='complete')return;
  chrome.storage.local.get('vpc.session.'+id).then(async saved=>{
    const data=saved['vpc.session.'+id];
    if(!data?.pending || Date.now()-data.pending.at>=60000)return;
    const tab=await chrome.tabs.get(id);
    if(new URL(tab.url).origin!==data.pending.origin)return;
    await connect(id);
    await chrome.tabs.sendMessage(id,{type:'VPC_CONTENT',action:'start',payload:data.config});
  }).catch(()=>{});
});
