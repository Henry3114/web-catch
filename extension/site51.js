"use strict";
globalThis.Site51={
  // Fixed selectors verified against the user's saved list page. No tracking attributes or private APIs.
  list:function(){
    const text=e=>(e?.innerText || '').trim();
    const visible=e=>!!e && !!e.getClientRects().length;
    const rows=[...document.querySelectorAll('.joblist-item')].filter(e=>visible(e) && e.querySelector('.jname'));
    return rows.map((row,index)=>{
      const get=s=>text(row.querySelector(s));
      const data={name:get('.jname'),salary:get('.sal'),company:get('.cname'),location:get('.area'),industry:get('.bc .dc:first-child'),nature:get('.bc .dc:nth-child(2)'),scale:get('.bc .dc:nth-child(3)')};
      return {...data,index,key:JSON.stringify([data.name,data.company,data.salary,data.location,index])};
    }).filter(r=>r.name && r.company);
  },
  detail:function({expected='',url=location.href}={}){
    const norm=s=>String(s || '').replace(/\s+/g,'');
    const text=e=>(e?.innerText || '').replace(/\u00a0/g,' ').trim();
    const get=s=>text(document.querySelector(s));
    if(/安全验证|访问受限|访问异常|验证码|登录/.test(document.title) || ['.login-dialog','.sign-dialog','.verify-page','.geetest_panel'].some(s=>[...document.querySelectorAll(s)].some(e=>e.getClientRects().length && getComputedStyle(e).visibility!=='hidden')))return {ok:false,needsUser:true,error:'详情页需要登录或验证，请手动完成后继续。'};
    const name=get('.tHeader .jTitle h1'),body=document.querySelector('.job-detail .job_msg > div:first-child');
    if(!name || !body || !body.getClientRects().length || !text(body))return {ok:false,error:'未找到已验证的51job职位结构，暂停保留结果。请导出异常记录供排查。'};
    if(expected && norm(expected)!==norm(name))return {ok:false,error:'职位对应不一致：列表“'+expected+'”，详情“'+name+'”。已暂停避免错配。'};
    const raw=text(body);
    const roles={duties:['岗位职责','工作职责','职位职责','工作内容','岗位内容','主要职责','职责描述'],requirements:['任职要求','岗位要求','任职资格','职位要求','任职条件','资格要求','招聘要求']};
    const labels=[...roles.duties,...roles.requirements,'备注','其他说明','其它说明'];
    const re=new RegExp('(^|[\\r\\n])\\s*(?:[一二三四五六七八九十0-9]+[、.．）)]\\s*)?[【\\[]?('+labels.join('|')+')[】\\]]?\\s*(?:[:：]|(?=[\\r\\n]|$))','g');
    const matches=[...raw.matchAll(re)],part=key=>{const i=matches.findIndex(m=>roles[key].includes(m[2]));return i<0?'':raw.slice(matches[i].index+matches[i][0].length,matches[i+1]?.index ?? raw.length).trim();};
    const tag=selector=>{const marker=document.querySelector(selector);return text(marker?.closest('p'));};
    const city=get('.tHeader .type_2'),address=get('.job-address .bmsg > p.fp');
    const data={name,salary:get('.tHeader .jTitle strong'),company:get('.corp-card .com_name p'),location:address?(address.includes(city)?address:[city,address].filter(Boolean).join(' · ')):city,duties:part('duties'),requirements:part('requirements'),nature:tag('.com_tag .i_flag'),scale:tag('.com_tag .i_people'),industry:tag('.com_tag .i_trade'),intro:get('.job-corp .tmsg'),raw,_detailUrl:url,_time:new Date().toISOString()};
    const names={name:'职位名称',salary:'薪资待遇',company:'公司名称',location:'工作地点',duties:'工作职责',requirements:'任职资格',nature:'公司性质',scale:'公司规模',industry:'行业',intro:'公司介绍'};
    const missing=Object.keys(names).filter(k=>!data[k]);
    const unreadable=Object.keys(names).filter(k=>/[\uE000-\uF8FF]/u.test(data[k] || ''));
    for(const k of unreadable)data[k]='';
    data.issue=[...(missing.length?['页面未单列或未能读取：'+missing.map(k=>names[k]).join('、')]:[]),...(unreadable.length?['特殊字体无法可靠读取：'+unreadable.map(k=>names[k]).join('、')]:[])].join('；');
    return {ok:true,data};
  },
  next:function(){
    const button=document.querySelector('button.btn-next');
    if(!button || button.disabled || button.getAttribute('aria-disabled')==='true' || /disabled/.test(button.className))return false;
    button.click();return true;
  },
  capture:async function({row}){
    const candidates=[...document.querySelectorAll('.joblist-item')].filter(el=>el.getClientRects().length && el.querySelector('.jname'));
    const text=e=>(e?.innerText || '').trim();
    const same=el=>el && text(el.querySelector('.jname'))===row.name && text(el.querySelector('.cname'))===row.company && text(el.querySelector('.sal'))===row.salary && text(el.querySelector('.area'))===row.location;
    const selected=same(candidates[row.index])?candidates[row.index]:candidates.find(same);
    if(!selected)return {ok:false,error:'列表变化，请暂停后重新搜索。'};
    const token='pick-'+Date.now();selected.setAttribute('data-fixed51-pick',token);
    try{return await Navigation51.capture({rowSelector:'[data-fixed51-pick="'+token+'"]',clickSelector:'.jname'});}finally{selected.removeAttribute('data-fixed51-pick');}
  }
};
