"use strict";
// Both functions are self-contained: Chrome serializes them into the selected tab.
globalThis.VisualDetail={
  read:async function({fields,detail,expected,timeout,url}) {
    const norm=v=>String(v ?? '').replace(/\s+/g,'');
    const visible=el=>!!el && !!el.getClientRects().length && getComputedStyle(el).visibility!=='hidden' && getComputedStyle(el).display!=='none';
    const target=new URL(url);
    let previous='',since=0,until=Date.now()+timeout;
    const read=f=>{
      const el=document.querySelector(f.selector);if(!visible(el))return '';
      if(f.type==='text') {
        const text=(el.innerText || '').trim();
        if(/[\uE000-\uF8FF]/u.test(text))throw new Error(`“${f.name || '详情'}”含特殊字体字符，无法可靠提取。`);
        return text;
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
