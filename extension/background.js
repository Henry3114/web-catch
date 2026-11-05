"use strict";
importScripts('detail-reader.js','detect.js','detail-manager.js');
async function connect(tabId){
  const tab=await chrome.tabs.get(tabId);
  if(!/^https?:\/\//.test(tab.url || ''))throw new Error('请切到普通网页并点击工具栏图标；浏览器内部页面不允许采集。');
  await chrome.scripting.executeScript({target:{tabId},files:['locator.js','detect.js','engine.js','content.js']});
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
  if(message?.type==='VPC_DETAIL' && sender.id===chrome.runtime.id && sender.tab?.id!=null){
    const id=sender.tab.id;
    const operation=message.action==='collect'?VisualDetailManager.collect(id,message.payload):message.action==='finish'?VisualDetailManager.close(id,{keep:message.needsUser}):Promise.reject(new Error('未知详情操作。'));
    operation.then(data=>reply({ok:true,data})).catch(error=>reply({ok:false,error:error.message,needsUser:!!error.needsUser}));return true;
  }
  if(message?.type!=='VPC_RPC' || sender.id!==chrome.runtime.id)return;
  (async()=>{
    const [active]=await chrome.tabs.query({active:true,currentWindow:true});
    const id=message.tabId ?? active?.id;
    if(id==null)throw new Error('未找到当前网页。');
    if(message.action==='stop')await VisualDetailManager.cancel(id);
    const tab=await connect(id);
    if(message.action==='context')return {tabId:id,url:tab.url,title:tab.title};
    if(message.action==='autoDetail')return VisualDetailManager.prepare(id,message.payload);
    if(message.action==='resolveEntry'){
      if(message.payload.detail?.entryInvalid || (message.payload.detail?.sampleUrl && !VisualDetect.url(message.payload.detail.sampleUrl,tab.url)))await VisualDetailManager.cancel(id);
      const response=await chrome.tabs.sendMessage(id,{type:'VPC_CONTENT',action:'entry',payload:message.payload});
      if(!response?.ok)throw new Error(response?.error || '请先识别列表。');
      const publicUrl=VisualDetect.url(response.data.link,tab.url);
      if(publicUrl)return {...response.data,url:publicUrl};
      if(!message.payload.detail?.clickSelector)throw new Error('没有识别到职位入口。请点一次职位标题，或取消“同时读取职位详情”。');
      const [result]=await chrome.scripting.executeScript({target:{tabId:id},world:'MAIN',func:VisualDetail.capture,args:[{rowSelector:response.data.rowSelector,clickSelector:message.payload.detail.clickSelector}]});
      if(!result?.result?.ok)throw new Error(result?.result?.error || '没有找到详情链接。');
      const resolved=VisualDetect.url(result.result.url,tab.url);
      if(!resolved){const e=new Error('未找到有效职位地址。请点“重新获取详情链接”，或补点一个职位标题。');e.needsEntry=true;throw e;}
      return {...response.data,url:resolved};
    }
    if(message.action==='pick')await chrome.tabs.update(id,{active:true});
    const response=await chrome.tabs.sendMessage(id,{type:'VPC_CONTENT',action:message.action,payload:message.payload});
    if(!response?.ok)throw new Error(response?.error || '网页没有响应。');
    return response.data;
  })().then(data=>reply({ok:true,data})).catch(error=>reply({ok:false,error:error.message,needsUser:!!error.needsUser,needsEntry:!!error.needsEntry}));
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
chrome.tabs.onRemoved.addListener(id=>VisualDetailManager.cancel(id).catch(()=>{}));
