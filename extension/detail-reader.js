"use strict";
// Both functions are self-contained: Chrome serializes them into the selected tab.
globalThis.VisualDetail={
  readyForPick:async function({timeout=10000}={}){
    const visible=el=>!!el && !!el.getClientRects().length && getComputedStyle(el).visibility!=='hidden';
    const until=Date.now()+timeout;
    while(Date.now()<until){
      if(/安全验证|访问受限|访问异常|验证码|登录/.test(document.title) || ['.geetest_panel','.verify-page','.login-dialog','.sign-dialog','input[type="password"]'].some(s=>[...document.querySelectorAll(s)].some(visible)))return {ok:false,error:'请先在详情页完成登录或验证，再点选这个字段。'};
      const text=(document.body?.innerText || '').trim();
      if(document.readyState==='complete' && text.length>=10 && !/^\s*(?:404\b|page not found|页面不存在|页面未找到)/i.test(text))return {ok:true};
      await new Promise(resolve=>setTimeout(resolve,200));
    }
    return {ok:false,error:'详情页还没有加载出正文。请刷新详情页，再点选这个字段。'};
  },
  read:async function({fields,detail,expected,timeout,url}) {
    function section(text,field){
  const aliases={duties:['工作职责','岗位职责','职位职责','工作内容','岗位内容','主要职责','职责描述'],requirements:['岗位要求','任职要求','职位要求','任职资格','招聘要求','任职条件','资格要求']};
  let mode=field.section || 'auto';
  if(mode==='whole')return text;
  if(mode==='auto'){const name=String(field.name || '').replace(/\s/g,'');mode=Object.keys(aliases).find(key=>aliases[key].includes(name));}
  if(!mode || !aliases[mode])return text;
  const titles=[...aliases.duties,...aliases.requirements,'备注','其他说明','其它说明','职能类别','关键字','关键词','工作地址','工作地点','公司信息','公司介绍','福利待遇'];
  const pattern=new RegExp('(^|[\\r\\n])\\s*(?:[一二三四五六七八九十0-9]+[、.．）)]\\s*)?[【\\[]?('+titles.join('|')+')[】\\]]?\\s*(?:[:：]|(?=[\\r\\n]|$))','g');
  const matches=[...text.matchAll(pattern)];
  const selected=matches.findIndex(m=>aliases[mode].includes(m[2]));
  if(selected>=0){const start=matches[selected].index+matches[selected][0].length,end=matches[selected+1]?.index ?? text.length;return text.slice(start,end).trim();}
  if(matches.some(m=>[...aliases.duties,...aliases.requirements].includes(m[2])))return '';
  return text;
}
    const norm=v=>String(v ?? '').replace(/\s+/g,'');
    const visible=el=>!!el && !!el.getClientRects().length && getComputedStyle(el).visibility!=='hidden' && getComputedStyle(el).display!=='none';
    const target=new URL(url);
    let previous='',since=0,until=Date.now()+timeout;
    const read=f=>{
      const el=document.querySelector(f.selector);if(!visible(el))return '';
      if(f.type==='text') {
        let text=(el.innerText || '').trim();
        if((f.section || 'auto')!=='whole' && /^(工作职责|岗位职责|职位职责|工作内容|岗位要求|任职要求|任职资格|职位要求)$/.test(f.name || '')){for(let parent=el.parentElement,depth=0;parent && parent!==document.body && depth<3;parent=parent.parentElement,depth++){const nearby=(parent.innerText || '').trim();if(/(?:工作职责|岗位职责|任职要求|岗位要求)\s*[:：]/.test(nearby) && nearby.length<30000){text=nearby;break;}}}
        if(/[\uE000-\uF8FF]/u.test(text))throw new Error(`“${f.name || '详情'}”含特殊字体字符，无法可靠提取。`);
        return section(text,f);
      }
      const node=f.type==='href'?(el.closest('a[href]') || el.querySelector('a[href]')):(el.matches('img')?el:el.querySelector('img'));
      const raw=node?.getAttribute(f.type);if(!raw)return '';
      const link=new URL(raw,location.href);return /^https?:$/.test(link.protocol)?link.href:'';
    };
    try {
      while(Date.now()<until) {
        if(/安全验证|访问受限|访问异常|验证码|登录/.test(document.title) || ['.geetest_panel','.verify-page','.login-dialog','.sign-dialog','input[type="password"]'].some(s=>[...document.querySelectorAll(s)].some(visible)))
          return {ok:false,needsUser:true,error:'详情页要求登录或人工验证。请在已打开的详情页处理，再返回列表继续。'};
        if(location.origin!==target.origin || location.pathname!==target.pathname || location.search!==target.search)throw new Error('详情跳转到了不同页面，已暂停，避免错配。');
        const values=Object.fromEntries(fields.map(f=>[f.id,read(f)]));
        const identityOK=!detail.identitySelector || (norm(expected) && norm(read({selector:detail.identitySelector,type:detail.identityType || 'text'}))===norm(expected));
        // Require all configured detail fields. Never silently finish with blank detail columns.
        const ready=document.readyState==='complete' && identityOK && fields.every(f=>values[f.id]);
        const signature=JSON.stringify(values);
        if(ready) {if(signature!==previous){previous=signature;since=Date.now();}if(Date.now()-since>=800)return {ok:true,data:{...values,_detailUrl:location.href}};}
        else {previous='';since=0;}
        await new Promise(resolve=>setTimeout(resolve,200));
      }
      throw new Error('详情字段为空、未加载或标识不匹配。请在详情样例中重新点选；已有结果保留。');
    }catch(error){return {ok:false,error:error.message};}
  },
  capture:async function({rowSelector,clickSelector}) {
    const row=document.querySelector(rowSelector),node=row && (clickSelector===':scope'?row:row.querySelector(clickSelector));
    if(!node)return {ok:false,error:'未找到职位详情入口，请重新点选职位标题。'};
    if(/^(投递|立即投递|申请|立即沟通|沟通|去聊聊|发送|删除|支付|购买|收藏)$/.test((node.innerText || '').trim()))return {ok:false,error:'请选择职位标题，不能选择投递、沟通等操作按钮。'};
    const link=node.closest('a[href]') || node.querySelector('a[href]');
    const reserved=raw=>/^\s*_(?:blank|self|top|parent)\s*$/i.test(String(raw));
    const http=raw=>{if(raw==null || !String(raw).trim() || String(raw).trim().startsWith('#') || reserved(raw))return '';try{const u=new URL(String(raw),location.href);return /^https?:$/.test(u.protocol) && !/(?:^|\/)_(?:blank|self|top|parent)\/?$/i.test(decodeURIComponent(u.pathname))?u.href:'';}catch{return '';}};
    for(const raw of [link?.getAttribute('href'),node.getAttribute('data-href'),node.getAttribute('data-url')]){const candidate=http(raw);if(candidate)return {ok:true,url:candidate};}
    // For JS-only title links, capture the URL emitted by that one click.
    // Restore the page's function even when its click handler throws or times out.
    const original=window.open;let captured='';
    const accept=raw=>{const candidate=http(raw);if(candidate)captured=candidate;};
    // Some title handlers open an empty window and assign its location later.
    // Capture that public navigation without opening the placeholder page.
    const capture=(raw,target)=>{
      accept(raw);if(reserved(raw))accept(target);
      let href='about:blank';
      const location={assign:accept,replace:accept,toString:()=>href};
      Object.defineProperty(location,'href',{get:()=>href,set:value=>{href=String(value);accept(value);}});
      const handle={closed:false,focus:()=>{},close:()=>{handle.closed=true;}};
      Object.defineProperty(handle,'location',{get:()=>location,set:value=>{location.href=value;}});
      return handle;
    };
    try {
      window.open=capture;
      node.scrollIntoView({block:'center'});node.click();
      const until=Date.now()+5000;
      while(!captured && Date.now()<until)await new Promise(resolve=>setTimeout(resolve,100));
      return captured?{ok:true,url:captured}:{ok:false,error:'这个入口没有提供可读取的详情链接。请改为点选职位标题，或添加“链接地址”字段。'};
    }catch(error){return captured?{ok:true,url:captured}:{ok:false,error:error.message};}
    finally {if(window.open===capture)window.open=original;}
  }
};
