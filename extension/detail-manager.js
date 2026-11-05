"use strict";
globalThis.VisualDetailManager=(()=>{
  const jobs=new Map();
  const pattern=origin=>{const u=new URL(origin);if(!/^https?:$/.test(u.protocol))throw new Error('仅支持普通网页。');return u.protocol+'//'+u.hostname+'/*';};
  async function permission(origin){if(!await chrome.permissions.contains({origins:[pattern(origin)]}))throw new Error('请返回工作台点“开始”，允许访问列表和详情网站。');}
  const invalidLink=()=>{const e=new Error('没有取得有效的职位详情链接。请点“重新获取详情链接”。');e.needsEntry=true;return e;};
  async function close(listId,{keep=false}={}){
    const key='vpc.detail-tab.'+listId;
    const id=(await chrome.storage.session.get(key))[key];
    if(id!=null && !keep) {await chrome.storage.session.remove(key);await chrome.tabs.remove(id).catch(()=>{});}
  }
  async function cancel(listId){const job=jobs.get(listId);if(job)job.cancelled=true;await close(listId);}
  async function visit(listId,target,c,check){
      const key='vpc.detail-tab.'+listId;
      let id=(await chrome.storage.session.get(key))[key];
      if(id!=null)try{await chrome.tabs.get(id);}catch{id=null;}
      if(id==null){const tab=await chrome.tabs.create({url:target.href,active:false});id=tab.id;await chrome.storage.session.set({[key]:id});}
      else {
        const tab=await chrome.tabs.get(id);
        // Retain a verification page on retry; the user may just have solved its challenge.
        if(tab.url!==target.href)await chrome.tabs.update(id,{url:target.href});
      }
      check();
      const deadline=Date.now()+c.options.timeout;
      while(Date.now()<deadline) {check();const tab=await chrome.tabs.get(id);if(tab.status==='complete')break;await new Promise(resolve=>setTimeout(resolve,200));}
      check();
      const tab=await chrome.tabs.get(id);
      if(tab.status!=='complete')throw new Error('详情页打开超时，已暂停。');
      if(new URL(tab.url).origin!==c.detail.origin)throw new Error('详情跳转到其他网站。请先手动登录并重新连接详情样例。');
      return id;
  }
  async function collect(listId,payload){
    if(jobs.has(listId))throw new Error('上一条详情尚未结束，请稍后继续。');
    const job={cancelled:false};jobs.set(listId,job);
    const check=()=>{if(job.cancelled)throw new Error('已暂停，已有结果保留。');};
    try {
      const {config:c,data}=payload;
      if(c?.detail?.mode!=='page' || !c.fields?.some(f=>f.scope==='detail'))throw new Error('详情配置无效。');
      const list=await chrome.tabs.get(listId);
      if(new URL(list.url).origin!==c.match.origin)throw new Error('列表网站已改变。');
      await permission(c.match.origin);await permission(c.detail.origin);check();
      let url=VisualDetect.url(payload.link,list.url);
      if(!url) {
        if(!c.detail.clickSelector)throw new Error('请点选职位标题或配置职位链接字段。');
        const [result]=await chrome.scripting.executeScript({target:{tabId:listId},world:'MAIN',func:VisualDetail.capture,args:[{rowSelector:payload.rowSelector,clickSelector:c.detail.clickSelector}]});
        if(!result?.result?.ok)throw new Error(result?.result?.error || '无法读取详情链接。');
        url=VisualDetect.url(result.result.url,list.url);
      }
      if(!url)throw invalidLink();
      const target=new URL(url);
      if(!/^https?:$/.test(target.protocol) || target.origin!==c.detail.origin)throw new Error('职位链接不属于已绑定的详情网站，请检查链接字段或详情样例。');
      check();
      const id=await visit(listId,target,c,check);
      const [result]=await chrome.scripting.executeScript({target:{tabId:id},func:VisualDetail.read,args:[{fields:c.fields.filter(f=>f.scope==='detail'),detail:c.detail,expected:data[c.detail.identityField],timeout:c.options.timeout,url:target.href}]});
      check();
      const reply=result?.result;
      if(!reply?.ok){
        if(reply?.needsUser){job.keep=true;await chrome.tabs.update(id,{active:true});const error=new Error(reply.error);error.needsUser=true;throw error;}
        throw new Error(reply?.error || '详情页没有响应。');
      }
      return reply.data;
    }catch(error){if(!job.keep)await close(listId);throw error;}
    finally{jobs.delete(listId);}
  }
  async function prepare(listId,{config:c,url}){
    if(jobs.has(listId))throw new Error('正在读取详情，请等待完成或先暂停。');
    const job={cancelled:false};jobs.set(listId,job);
    const check=()=>{if(job.cancelled)throw new Error('详情试读已取消。');};
    try{
      const list=await chrome.tabs.get(listId),resolved=VisualDetect.url(url,list.url);
      if(!resolved)throw invalidLink();
      const target=new URL(resolved);
      if(new URL(list.url).origin!==c.match.origin || target.origin!==c.detail.origin || !/^https?:$/.test(target.protocol))throw new Error('页面地址改变，请重新识别页面。');
      await permission(c.match.origin);await permission(c.detail.origin);
      const id=await visit(listId,target,c,check);
      const [result]=await chrome.scripting.executeScript({target:{tabId:id},func:VisualDetect.details,args:[{timeout:Math.min(c.options.timeout,10000)}]});
      check();
      const tab=await chrome.tabs.get(id),actual=new URL(tab.url);
      if(actual.origin!==target.origin || actual.pathname!==target.pathname || actual.search!==target.search)throw new Error('详情跳转到了其他页面，请手动打开一个职位详情后重试。');
      const r=result?.result;
      if(r?.needsUser){job.keep=true;await chrome.tabs.update(id,{active:true});const e=new Error(r.error);e.needsUser=true;throw e;}
      if(r?.invalidPage){const e=new Error(r.error);e.needsEntry=true;throw e;}
      if(r?.needsSelection){job.keep=true;await chrome.tabs.update(id,{active:true});return {needsSelection:true,sampleTabId:id,url:target.href,message:r.error};}
      if(!r?.ok)throw new Error(r?.error || '无法读取详情，请手动连接一个详情样例。');
      await close(listId);return r.data;
    }catch(error){if(!job.keep)await close(listId);throw error;}finally{jobs.delete(listId);}
  }
  return {collect,prepare,close,cancel,pattern};
})();
