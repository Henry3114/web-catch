"use strict";
(() => {
  if(globalThis.VisualDetect)return;
  function list(root,input,url) {
    const visible=VisualLocator.visible;
    const text=el=>(el?.innerText || '').trim();
    const ignored=/^(投递|立即投递|立即沟通|去聊聊|收藏|申请|查看详情|职位链接)$/;
    const roles=[
      ['title','职位名称','.jname,.job-name,.job-title,.jobname,.name,h3,h2,[class*="job-name"],[class*="jobName"],[class*="job-title"],a[href*="/jobs/"],a[href*=".html"]'],
      ['salary','薪资待遇','.sal,.salary,.job-salary,[class*="salary"],[class*="Salary"]'],
      ['company','公司名称','.cname,.cname a,.company-name,.company,.comp,.company-title,[class*="company-name"],[class*="companyName"]'],
      ['location','工作地点','.location,.area,.job-area,.distrinct,[class*="job-area"],[class*="location"]'],
      ['education','学历要求','.education,[class*="education"]']
    ];
    const field=(row,selector)=>[...row.querySelectorAll(selector)].find(el=>visible(el) && text(el) && !ignored.test(text(el)) && !/[\uE000-\uF8FF]/u.test(text(el)));
    const readRoles=row=>{const result=roles.map(([id,name,selector])=>({id,name,element:field(row,selector)})).filter(f=>f.element);if(!result.some(f=>f.id==='title') && input.detail?.clickSelector){const el=field(row,input.detail.clickSelector);if(el)result.unshift({id:'title',name:'职位名称',element:el});}return result;};
    const candidates=[];
    if(input.listSelector?.trim()) {
      let rows;try{rows=[...root.querySelectorAll(input.listSelector)].filter(visible);}catch{throw new Error('列表规则无效。点“点一个职位标题”重新识别。');}
      if(rows.length)candidates.push({selector:input.listSelector,rows,forced:true});
    } else {
      for(const selector of ['.joblist-item','.job-card-wrapper','.job-card-box','.job-item','.record','article','tr','[role="listitem"]','li']) {
        const rows=[...root.querySelectorAll(selector)].filter(el=>visible(el) && text(el).length>5 && (!el.matches('tr') || el.querySelector('td')));
        if(rows.length>=2)candidates.push({selector,rows});
      }
      if(!candidates.length)for(const node of [...root.querySelectorAll('h2,h3,a[href]')].filter(visible).slice(0,120)) {
        const unit=VisualLocator.probableItem(node,root);
        if(unit===node || unit===root || unit===document.body)continue;
        const proposal=VisualLocator.listSelector(unit,root);
        if(proposal.count>=2 && !candidates.some(c=>c.selector===proposal.selector))candidates.push({selector:proposal.selector,rows:[...root.querySelectorAll(proposal.selector)].filter(visible)});
      }
    }
    const ranked=candidates.map(c=>{
      const sample=c.rows.slice(0,5),roles=sample.map(readRoles);
      const titles=roles.map(fs=>text(fs.find(f=>f.id==='title')?.element)).filter(Boolean);
      const score=(sample.every(row=>row.matches('tr') && row.querySelector('td')) && sample[0].closest('table')?.querySelector('thead th')?40:0)+(new Set(titles).size>=2?30:0)+roles.reduce((sum,fs)=>sum+fs.length,0)*2+Math.min(c.rows.length,10)-sample.reduce((sum,row)=>sum+Math.min(VisualLocator.nestedRecords(row),4)*10,0);
      return {...c,score};
    }).sort((a,b)=>b.score-a.score);
    const chosen=ranked.find(c=>c.forced || c.score>=35);
    if(!chosen)throw new Error('暂时没识别出列表。点“点一个职位标题”，在网页上点任意一个职位名称。');
    const rows=chosen.rows,first=rows[0],c=structuredClone(input),warnings=[];
    const rawSalary=first.querySelector(roles.find(r=>r[0]==='salary')[2]);if(/[\uE000-\uF8FF]/u.test(text(rawSalary)))warnings.push('薪资使用了特殊字体，无法可靠识别，已跳过这一列。');
    c.listSelector=chosen.selector;c.match={origin:new URL(url).origin};c.fields=[];c.keyFields=[];
    let titleElement;
    for(const role of readRoles(first)) {
      const selector=VisualLocator.unique(role.element,first);
      const found=rows.slice(0,5).map(row=>{const el=selector===':scope'?row:row.querySelector(selector);return visible(el)?text(el):'';});
      if(found.filter(Boolean).length<Math.min(2,rows.length))continue;
      c.fields.push({id:'auto-'+role.id,name:role.name,scope:'list',type:'text',selector});
      if(role.id==='title')titleElement=role.element;
    }
    if(!c.fields.length) {
      // A normal HTML table can expose useful column names even without job classes.
      const headers=first.closest('table')?.querySelectorAll('thead th');
      if(headers?.length)for(let i=0;i<Math.min(headers.length,20);i++)if(text(headers[i]))c.fields.push({id:'auto-col-'+i,name:text(headers[i])+'（'+(i+1)+'）',scope:'list',type:'text',selector:':scope > td:nth-of-type('+(i+1)+')'});
      else c.fields.push({id:'auto-content',name:'列表内容',scope:'list',type:'text',selector:':scope'});
    }
    const link=titleElement && (titleElement.closest('a[href]') || titleElement.querySelector('a[href]'));
    let sampleUrl='';
    if(link && first.contains(link))try{const raw=link.getAttribute('href') || '',target=new URL(raw,url);if(raw.trim() && /^https?:$/.test(target.protocol) && !raw.startsWith('#') && target.href!==new URL(url).href)sampleUrl=target.href;}catch{}
    c.detail={mode:'page',origin:sampleUrl?new URL(sampleUrl).origin:'',linkField:'',clickSelector:titleElement?VisualLocator.unique(titleElement,first):'',identityField:'',identitySelector:'',identityType:'text',waitField:'',allowSame:false};
    if(sampleUrl){c.fields.push({id:'auto-url',name:'职位链接',scope:'list',type:'href',selector:VisualLocator.unique(link,first)});c.detail.linkField='auto-url';c.keyFields=['auto-url'];}
    const next=[...root.querySelectorAll('button,a,[role="button"],.btn-next,.next')].find(el=>visible(el) && !el.disabled && el.getAttribute('aria-disabled')!=='true' && !/disabled/.test(el.className) && ((/^(下一页|下页|下一页\s*[>›»→])$/.test(text(el)) || (/^[>›»→]$/.test(text(el)) && el.closest('.pagination,.pager,[class*=pagination],[class*=pager]'))) || /^(下一页|Next page)$/i.test(el.getAttribute('aria-label') || '') || el.matches('.btn-next')));
    c.pagination=next?{mode:'next',selector:VisualLocator.unique(next,root)}:{mode:'none',selector:''};
    if(!next)warnings.push('未识别到下一页按钮，当前只读取这一页。可在高级设置中补选。');
    if(c.fields.some(f=>f.id==='auto-content'))warnings.push('未识别出独立列，先按每条完整内容预览；可在高级设置中调整字段。');
    return {config:c,count:rows.length,sampleUrl,warnings,records:rows.slice(0,5).map(row=>Object.fromEntries(c.fields.map(f=>{const el=f.selector===':scope'?row:row.querySelector(f.selector);return [f.id,f.type==='href'?(el?.href || ''):text(el)];})))};
  }
  // Self-contained for chrome.scripting.executeScript; only visible DOM is read.
  async function details({timeout=15000}={}) {
    const visible=el=>!!el && !!el.getClientRects().length && getComputedStyle(el).visibility!=='hidden';
    const text=el=>(el?.innerText || '').trim();
    const selector=el=>{
      if(el.id && document.querySelectorAll('#'+CSS.escape(el.id)).length===1)return '#'+CSS.escape(el.id);
      let path='',node=el;
      while(node && node!==document.body){const p=node.parentElement;let s=node.tagName.toLowerCase();const classes=[...node.classList].filter(c=>/^[a-zA-Z_][\w-]*$/.test(c) && !/active|selected/.test(c)).slice(0,2);s+=classes.map(c=>'.'+CSS.escape(c)).join('');if(p && [...p.children].filter(c=>c.tagName===node.tagName).length>1)s+=':nth-of-type('+([...p.children].filter(c=>c.tagName===node.tagName).indexOf(node)+1)+')';path=s+(path?' > '+path:'');if(document.querySelectorAll(path).length===1)return path;node=p;}
      return path;
    };
    const until=Date.now()+timeout;let previous='',since=0;
    while(Date.now()<until) {
      if(/安全验证|访问受限|访问异常|验证码|登录/.test(document.title) || ['.geetest_panel','.verify-page','.login-dialog','.sign-dialog','input[type="password"]'].some(s=>[...document.querySelectorAll(s)].some(visible)))return {ok:false,needsUser:true,error:'请在打开的详情页完成登录或验证，再回工作台点“自动读取详情”。'};
      const candidates=[...document.querySelectorAll('.job-description,.job-desc,.job_msg,.bmsg.job_msg,.job-sec-text,.job-detail-description,[class*="jobDescription"],[class*="job-description"],#detail-description')].filter(visible);
      for(const heading of [...document.querySelectorAll('h2,h3,h4,dt,strong')].filter(el=>visible(el) && /^(职位描述|岗位职责|工作职责|任职要求|岗位要求)[:：]?$/.test(text(el)))){
        let parent=heading.parentElement;
        for(let depth=0;parent && depth<3;depth++,parent=parent.parentElement)if(text(parent).length>=60 && text(parent).length<25000){candidates.push(parent);break;}
      }
      const body=candidates.filter(el=>text(el).length>=30 && text(el).length<30000 && !el.querySelector('input,textarea') && !/[\uE000-\uF8FF]/u.test(text(el))).sort((a,b)=>text(b).length-text(a).length)[0];
      const signature=text(body);
      if(body && document.readyState==='complete') {
        if(signature!==previous){previous=signature;since=Date.now();}
        if(Date.now()-since>=800){const title=[...document.querySelectorAll('h1,.job-title,.cn h1')].find(visible);return {ok:true,data:{fields:[{id:'auto-description',name:'职位描述',scope:'detail',type:'text',selector:selector(body)}],sample:{'auto-description':signature},title:text(title),identitySelector:title?selector(title):'',url:location.href}};}
      }
      await new Promise(resolve=>setTimeout(resolve,200));
    }
    return {ok:false,needsSelection:true,error:'详情页已打开。只需点一次“点选职位描述”，选择正文即可。'};
  }
  globalThis.VisualDetect={list,details};
})();
