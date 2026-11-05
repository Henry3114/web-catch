globalThis.Navigation51={
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
