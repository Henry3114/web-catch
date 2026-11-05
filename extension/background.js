"use strict";
importScripts('site51.js','navigation.js','xlsx.js','schema.js');
let taskPromise=null,live=null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const save=async()=>chrome.storage.local.set({fixed51:live});
async function invoke(tabId,method,arg){
  await chrome.scripting.executeScript({target:{tabId},files:['navigation.js','site51.js']});
  const [r]=await chrome.scripting.executeScript({target:{tabId},func:async(method,arg)=>Site51[method](arg),args:[method,arg ?? null]});return r?.result;
}
async function loaded(id){const until=Date.now()+20000;while(Date.now()<until){const t=await chrome.tabs.get(id);if(t.status==='complete')return t;await sleep(300);}throw new Error('页面打开超时，请检查登录或网络。');}
async function closeDetail(){if(live?.detailTabId!=null){await chrome.tabs.remove(live.detailTabId).catch(()=>{});live.detailTabId=null;}}
async function run(){
  try{
    while(live.running && live.records.length<live.count){
      const source=await loaded(live.listTabId);
      if(new URL(source.url).hostname!=='we.51job.com')throw new Error('列表页面已改变，请回到51job列表。');
      let rows=[];
      for(let i=0;i<40 && live.running;i++){rows=await invoke(live.listTabId,'list');if(rows?.length)break;await sleep(300);}
      if(!live.running)break;
      if(!rows?.length)throw new Error('列表尚未加载或需要登录。请在列表页处理后继续。');
      let added=0;
      for(const row of rows){
        if(!live.running || live.records.length>=live.count)break;
        if(live.seen.includes(row.key))continue;
        live.message='正在读取 '+(live.records.length+1)+'/'+live.count+'：'+row.name;await save();
        const entry=await invoke(live.listTabId,'capture',{row});
        if(!live.running)break;
        if(!entry?.ok)throw new Error(entry?.error || '无法读取职位链接。');
        const url=new URL(entry.url);
        if(url.protocol!=='https:' || url.hostname!=='jobs.51job.com' || !/\/\d+\.html$/.test(url.pathname))throw new Error('标题没有跳转到有效的职位详情地址，已暂停。');
        const key=url.origin+url.pathname;
        if(live.records.some(r=>r._jobKey===key)){live.seen.push(row.key);continue;}
        if(live.detailTabId==null){const tab=await chrome.tabs.create({url:url.href,active:false});live.detailTabId=tab.id;}else{const open=await chrome.tabs.get(live.detailTabId);if(open.url!==url.href)await chrome.tabs.update(live.detailTabId,{url:url.href});}
        await save();const tab=await loaded(live.detailTabId);
        if(new URL(tab.url).origin!==url.origin || new URL(tab.url).pathname!==url.pathname)throw new Error('详情跳转到了其它页面，请先手动处理登录。');
        let result;
        for(let retry=0;retry<25 && live.running;retry++){result=await invoke(live.detailTabId,'detail',{expected:row.name,url:url.href});if(result?.ok || result?.needsUser)break;await sleep(400);}
        if(!live.running)break;
        if(!result?.ok){if(result?.needsUser){await chrome.tabs.update(live.detailTabId,{active:true});live.needsUser=true;}throw new Error(result?.error || '无法读取详情。');}
        const data=result.data;
        // List metadata may supply missing company attributes, but never guess duties or salary digits.
        for(const k of ['company','nature','scale','industry'])if(!data[k] && row[k])data[k]=row[k];
        live.records.push({...data,_jobKey:key,_source:source.url});live.seen.push(row.key);added++;
        if(data.issue)live.errors.push({url:url.href,message:row.name+'：'+data.issue});
        live.message='已读取 '+live.records.length+'/'+live.count+' 条';await save();await sleep(1000);
      }
      if(!live.running || live.records.length>=live.count)break;
      if(live.pages>=100 || !await invoke(live.listTabId,'next')){live.running=false;live.status='shortage';live.message='只有 '+live.records.length+'/'+live.count+' 条：列表已结束或没有可用的下一页按钮。';break;}
      live.pages++;await save();await sleep(1200);
      const before=rows.map(r=>r.key).join('|');let changed=false;
      for(let retry=0;retry<40 && live.running;retry++){await loaded(live.listTabId);const next=await invoke(live.listTabId,'list');if(next?.length && next.map(r=>r.key).join('|')!==before){changed=true;break;}await sleep(300);}
      if(!changed && live.running)throw new Error('点击下一页后列表没有变化，已暂停，保留结果。');
    }
    if(live.records.length>=live.count){
      live.status='done';live.message='已完成 '+live.records.length+'/'+live.count+' 条。';
      try{const bytes=VisualXlsx.createWorkbook(live.records,Fixed51Fields,{dropEmpty:false,errors:live.errors});let binary='';for(let i=0;i<bytes.length;i+=4096)binary+=String.fromCharCode(...bytes.subarray(i,i+4096));live.downloadId=await chrome.downloads.download({url:'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,'+btoa(binary),filename:'51job_'+live.keyword.replace(/[\\/:*?"<>|]/g,'_')+'_'+live.records.length+'条.xlsx',saveAs:false});live.message+=' Excel已发起下载。';}catch{live.message+=' 自动下载失败，请点“导出Excel”手动保存。';}
    }
    else if(live.running && live.status!=='shortage')live.status='paused';
  }catch(error){live.status='paused';live.message=error.message;live.errors.push({url:live.source,message:error.message});}
  finally{if(live.status==='running'){live.status='paused';live.message='已暂停，已读取 '+live.records.length+'/'+live.count+' 条，结果保留。';}live.running=false;if(!live.needsUser)await closeDetail();await save();await chrome.alarms.clear('fixed51-watch');taskPromise=null;}
}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(sender.id!==chrome.runtime.id)return;
  (async()=>{
    if(!live)live=(await chrome.storage.local.get('fixed51')).fixed51 || null;
    if(m.action==='state')return live;
    if(m.action==='stop'){if(live){live.running=false;live.message='正在暂停，已读取的结果保留。';await save();}return live;}
    if(m.action==='start'){
      if(taskPromise)return live;
      if(!await chrome.permissions.contains({origins:['https://we.51job.com/*','https://jobs.51job.com/*']}))throw new Error('请允许访问51job列表和详情网站。');
      const keyword=String(m.keyword || '').trim(),count=Number(m.count);
      if(!keyword || !Number.isInteger(count) || count<1 || count>1000)throw new Error('请填写关键词和1至1000的整数条数。');
      if(live?.records?.length && (live.keyword!==keyword || live.count!==count) && !m.newTask)throw new Error('已有结果，请先导出，再点“新任务”开始另一批。');
      if(!live || m.newTask || live.keyword!==keyword || live.count!==count || live.status==='done' || live.status==='shortage'){
        if(live?.records?.length && !m.newTask)throw new Error('本批已结束。导出后，点“新任务”再开始。');
        const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
        if(!tab?.url?.startsWith('https://we.51job.com/'))throw new Error('请先打开51job职位列表，再点击此扩展。');
        await closeDetail();let source=new URL(tab.url);
        if(source.pathname!=='/pc/search' || source.searchParams.get('keyword')!==keyword){source=new URL('https://we.51job.com/pc/search');source.searchParams.set('keyword',keyword);await chrome.tabs.update(tab.id,{url:source.href});}
        live={keyword,count,listTabId:tab.id,source:source.href,records:[],errors:[],seen:[],pages:1,detailTabId:null,status:'running',running:true,message:'正在加载列表…'};
      }
      live.running=true;live.needsUser=false;live.status='running';await save();await chrome.alarms.create('fixed51-watch',{periodInMinutes:0.5});taskPromise=run();return live;
    }
    throw new Error('未知操作');
  })().then(data=>reply({ok:true,data})).catch(e=>reply({ok:false,error:e.message}));return true;
});
chrome.alarms.onAlarm.addListener(async a=>{
  if(a.name!=='fixed51-watch' || taskPromise)return;
  live=(await chrome.storage.local.get('fixed51')).fixed51;
  if(live?.running){live.running=false;live.status='paused';live.message='浏览器中断了后台任务，已保存进度，请点“开始／继续”。';await closeDetail();await save();}await chrome.alarms.clear('fixed51-watch');
});

chrome.runtime.onStartup.addListener(async()=>{const stored=(await chrome.storage.local.get('fixed51')).fixed51;if(stored?.running){stored.running=false;stored.status='paused';stored.detailTabId=null;stored.message='浏览器已重启，进度保留。请重新打开职位列表开始新任务，或导出已有结果。';await chrome.storage.local.set({fixed51:stored});}});
