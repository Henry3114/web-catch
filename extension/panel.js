"use strict";
let tabId;
const api=async(action,payload)=>{
  const response=await chrome.runtime.sendMessage({type:'VPC_RPC',tabId:action==='context'?undefined:tabId,action,payload});
  if(!response?.ok)throw new Error(response?.error || '请在目标网页点一次工具栏图标。');
  if(action==='context')tabId=response.data.tabId;
  return response.data;
};
VisualStudio.create({element:document.querySelector('#app'),api,storage:{
  get:async()=> (await chrome.storage.local.get('vpc.templates.v1'))['vpc.templates.v1'] || {},
  set:async templates=>chrome.storage.local.set({'vpc.templates.v1':templates})
}});
