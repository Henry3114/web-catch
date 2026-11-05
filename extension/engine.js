"use strict";
(() => {
  if (globalThis.VisualEngine) return;
  const LIMIT = 10000;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const norm = v => String(v ?? '').replace(/\s+/g,'');
  const visible = VisualLocator.visible;
  function validate(input) {
    const c = structuredClone(input);
    const selectorValid=(selector,label)=>{try{document.createDocumentFragment().querySelector(selector);}catch{throw new Error(label+'的位置规则无效，请重新点选。');}};
    if (!c || c.version !== 1 || typeof c.name !== 'string' || !c.name.trim()) throw new Error('请填写模板名称。');
    const identifier=value=>typeof value==='string' && /^[\w-]{1,100}$/.test(value) && !['__proto__','constructor','prototype'].includes(value);
    if(!identifier(c.id))throw new Error('模板标识无效，请新建模板或修正导入文件。');
    if (!c.listSelector) throw new Error('请先点选列表中的一整条记录。');
    if (!Array.isArray(c.fields) || !c.fields.length || c.fields.length>100) throw new Error('请添加1至100个采集字段。');
    const names = new Set(), ids = new Set();
    for (const f of c.fields) {
      if (!identifier(f.id) || ids.has(f.id) || typeof f.name!=='string' || !f.name.trim() || names.has(f.name.trim())) throw new Error('字段名称和标识必须唯一且不能为空。');
      names.add(f.name.trim()); ids.add(f.id);
      if (!['text','href','src'].includes(f.type) || !['list','detail'].includes(f.scope)) throw new Error('字段类型或读取区域无效。');
      if (!f.selector || f.selector.length > 1200) throw new Error(`请点选“${f.name}”的位置。`);
      selectorValid(f.selector,'“'+f.name+'”');
    }
    selectorValid(c.listSelector,'列表');
    c.options ||= {};
    for (const [key, fallback, min, max] of [['count',20,1,LIMIT],['delay',1500,500,60000],['timeout',15000,1000,60000],['maxPages',30,1,500]]) {
      c.options[key] = Number(c.options[key] ?? fallback);
      if (!Number.isInteger(c.options[key]) || c.options[key] < min || c.options[key] > max) throw new Error(({count:'采集数量请填写1至10000的整数。',delay:'每条间隔请填写0.5至60秒。',timeout:'等待超时请填写1至60秒。',maxPages:'最多列表页请填写1至500的整数。'})[key]);
    }
    c.pagination ||= {mode:'none', selector:''};
    if (!['none','next','load','scroll'].includes(c.pagination.mode)) throw new Error('翻页方式无效。');
    if (['next','load'].includes(c.pagination.mode) && !c.pagination.selector) throw new Error('请点选下一页或加载更多按钮。');
    for (const selector of [c.pagination.selector, c.detail?.clickSelector, c.detail?.identitySelector]) if (selector) selectorValid(selector,'翻页或详情');
    c.detail ||= {};
    c.detail.mode ||= 'same';
    if (!['same','page'].includes(c.detail.mode)) throw new Error('详情模式无效。');
    if (c.fields.some(f=>f.scope==='detail') && c.detail.mode==='page') {
      let origin;try {origin=new URL(c.detail.origin);}catch {throw new Error('请连接一个详情样例页。');}
      if (!/^https?:$/.test(origin.protocol) || origin.origin!==c.detail.origin) throw new Error('详情网站地址无效。');
      const link=c.fields.find(f=>f.id===c.detail.linkField && f.scope==='list' && f.type==='href');
      if (!link && !c.detail.clickSelector) throw new Error('请选取列表中的职位链接字段，或点选打开详情的位置。');
      if (c.detail.identitySelector && !c.fields.some(f=>f.id===c.detail.identityField && f.scope==='list')) throw new Error('请设置详情标识对应的列表字段。');
    } else if (c.fields.some(f=>f.scope==='detail')) {
      const field = c.fields.find(f=>f.id===c.detail?.identityField && f.scope==='list');
      if (!field || !c.detail?.identitySelector) throw new Error('有详情字段时，请设置列表中的标识字段和详情区对应的标识。');
    }
    c.keyFields = (c.keyFields || []).filter(id=>c.fields.some(f=>f.id===id && f.scope==='list'));
    return c;
  }
  function create({root = document, onUpdate = async()=>{}, url = ()=>location.href, detailReader = null} = {}) {
    let running = false, task = null, cancelledPick = null;
    let state = {status:'idle', message:'请选择列表，再添加字段。', config:null, records:[], errors:[], page:1, pending:null, source:url()};
    const get = selector => selector === ':scope' ? root : root.querySelector(selector);
    const items = c => [...root.querySelectorAll(c.listSelector)].filter(visible);
    const snapshot = () => structuredClone({...state, running});
    async function emit(message, status) {
      if (message != null) state.message = message;
      if (status) state.status = status;
      await onUpdate(snapshot());
    }
    function check() {
      if (!running) throw new Error('已暂停，已有结果保留。');
      if (/安全验证|访问受限|访问异常/.test(document.title)) throw new Error('网页要求人工验证，已暂停。请手动处理后继续。');
      for (const selector of ['.geetest_panel','.verify-page','.login-dialog','.sign-dialog']) if ([...root.querySelectorAll(selector)].some(visible)) throw new Error('请先手动完成登录或验证。');
      if (new URL(url()).origin !== new URL(state.source).origin) throw new Error('网页来源改变，已暂停。');
    }
    function value(container, field) {
      const el = field.selector === ':scope' ? container : container.querySelector(field.selector);
      if (!el || !visible(el)) return '';
      if (field.type === 'text') {
        let text=(el.innerText || '').trim();
        if((field.section || 'auto')!=='whole' && /^(工作职责|岗位职责|职位职责|工作内容|岗位要求|任职要求|任职资格|职位要求)$/.test(field.name || '')){for(let parent=el.parentElement,depth=0;parent && parent!==document.body && depth<3;parent=parent.parentElement,depth++){const nearby=(parent.innerText || '').trim();if(/(?:工作职责|岗位职责|任职要求|岗位要求)\s*[:：]/.test(nearby) && nearby.length<30000){text=nearby;break;}}}
        if (/[\uE000-\uF8FF]/u.test(text)) throw new Error(`“${field.name}”包含特殊字体字符，普通文字读取不可靠。请取消此字段或使用专门适配。`);
        return field.scope==='detail'?VisualDetect.section(text,field):text;
      }
      const target = field.type === 'href' ? (el.closest('a[href]') || el.querySelector('a[href]')) : (el.matches('img') ? el : el.querySelector('img'));
      const raw = target?.getAttribute(field.type) || '';
      if (!raw) return '';
      if(field.type==='href')return VisualDetect.url(raw,url());
      const resolved = new URL(raw, url());
      return /^https?:$/.test(resolved.protocol) ? resolved.href : '';
    }
    function listValues(row,c) {
      return Object.fromEntries(c.fields.filter(f=>f.scope==='list').map(f=>[f.id,value(row,f)]));
    }
    const detailValues = c => Object.fromEntries(c.fields.filter(f=>f.scope==='detail').map(f=>[f.id,value(root,f)]));
    function key(row, data, c) {
      if (c.keyFields.length) {
        const parts = c.keyFields.map(id=>data[id]);
        if (parts.some(Boolean)) return JSON.stringify(parts);
        throw new Error('去重字段全部为空，请重新点选。');
      }
      const links = c.fields.filter(f=>f.scope==='list' && f.type==='href').map(f=>data[f.id]).filter(Boolean);
      return links[0] || norm(row.innerText);
    }
    async function readDetails(row, data, c) {
      const fields = c.fields.filter(f=>f.scope==='detail');
      if (!fields.length) return {};
      if (c.detail.mode==='page') {
        if (!detailReader) throw new Error('跨页详情需要在独立扩展中运行。');
        return detailReader({config:c,data,link:data[c.detail.linkField] || '',rowSelector:VisualLocator.unique(row,document)});
      }
      const expected = norm(data[c.detail.identityField]);
      if (!expected) throw new Error('当前列表记录的详情标识为空，已暂停，避免错配。');
      const before = detailValues(c);
      const waitId = c.detail.waitField || fields[0].id;
      const selected = /(^|\s)(active|selected|current|is-active|is-selected)(\s|$)/.test(row.className) || row.getAttribute('aria-selected')==='true';
      const button = c.detail.clickSelector ? row.querySelector(c.detail.clickSelector) : row;
      if (!button) throw new Error('未找到打开详情的点击位置，请重新点选。');
      const link = button.closest('a[href]');
      if (link && link.getAttribute('href') && !link.getAttribute('href').startsWith('#') && !link.getAttribute('href').startsWith('javascript:')) {
        // 此试用版只做同页详情；阻止默认新窗口跳转，保留网站自身点击处理。
        button.addEventListener('click', event=>event.preventDefault(), {once:true});
      }
      button.scrollIntoView({block:'center'}); button.click();
      const deadline = Date.now()+c.options.timeout;
      let previous = '', since = 0;
      while (Date.now()<deadline) {
        check();
        const actual = norm(value(root,{selector:c.detail.identitySelector,type:c.detail.identityType || 'text',name:'详情标识'}));
        const details = detailValues(c);
        const ready = expected===actual && (selected || c.detail.allowSame || details[waitId]!==before[waitId]) && fields.some(f=>details[f.id]);
        const fingerprint = JSON.stringify(details);
        if (ready) {
          if (fingerprint!==previous) {previous=fingerprint; since=Date.now();}
          if (Date.now()-since>=800) return details;
        } else {previous=''; since=0;}
        await sleep(200);
      }
      throw new Error('详情未能与当前记录对应，已暂停。请检查详情标识和等待更新字段；跳转网页请选择“进入详情页”。');
    }
    async function advance(c, previous) {
      if (c.pagination.mode==='none') return false;
      const before=JSON.stringify(items(c).map(row=>key(row,listValues(row,c),c)));
      if (c.pagination.mode==='scroll') {
        const last=items(c).at(-1);
        last?.scrollIntoView({block:'end'});
        for(let el=last?.parentElement;el && el!==document.body;el=el.parentElement) if(el.scrollHeight>el.clientHeight && /scroll|auto/.test(getComputedStyle(el).overflowY)) el.scrollTop=el.scrollHeight;
        window.scrollTo(0,document.body.scrollHeight);
      } else {
        const chosen=get(c.pagination.selector);
        const button=chosen?.closest('button,a,[role="button"]') || chosen;
        if (!button || !visible(button) || button.disabled || button.getAttribute('aria-disabled')==='true' || /disabled/.test(button.className)) return false;
        state.pending = {at:Date.now(),origin:new URL(url()).origin,nextPage:state.page+1};
        await emit('正在翻页…');
        button.click();
      }
      const deadline=Date.now()+c.options.timeout;
      while(Date.now()<deadline) {
        check();
        const current=items(c).map(row=>key(row,listValues(row,c),c));
        if(current.some(id=>!previous.has(id)) || JSON.stringify(current)!==before) {state.pending=null; return true;}
        await sleep(300);
      }
      state.pending=null; return false;
    }
    async function loop(c) {
      const seen = new Set(state.records.map(r=>r._key));
      try {
        for (;state.page<=c.options.maxPages && state.records.length<c.options.count;state.page++) {
          check();
          const until=Date.now()+c.options.timeout;
          while(!items(c).length && Date.now()<until){check();await sleep(250);}
          const rows=items(c);
          if(!rows.length) throw new Error('未找到列表记录，可能尚未加载或定位规则失效。');
          for(const row of rows) {
            check();
            const data=listValues(row,c), id=key(row,data,c);
            if(!id || seen.has(id)) continue;
            if(!Object.values(data).some(Boolean)) throw new Error('这个匹配项的字段全部为空：可能选中了外层容器，或字段固定在第一条。请预览并使用“修复列表层级与字段”。');
            const details=await readDetails(row,data,c);check();
            state.records.push({...data,...details,_key:id,_source:url(),_time:new Date(Date.now()+8*3600000).toISOString().replace('Z','+08:00')});
            seen.add(id);
            await emit(`已采集 ${state.records.length}/${c.options.count} 条。`);
            if(state.records.length>=c.options.count) break;
            await sleep(c.options.delay);
          }
          if(state.records.length>=c.options.count || state.page>=c.options.maxPages || !await advance(c,seen)) break;
        }
        await emit(state.records.length>=c.options.count ? `已完成 ${Math.min(state.records.length,c.options.count)} 条，可以导出 Excel。` : `已采集 ${state.records.length} 条；没有更多记录或达到翻页上限，可导出已有结果。`,'done');
      } catch(error) {
        state.needsUser=!!error.needsUser;
        if(running) state.errors.push({url:url(),message:error.message});
        await emit(error.message,'paused');
      } finally {running=false;state.pending=null;await emit();}
    }
    async function start(config) {
      if(running) return snapshot();
      const c=validate(config);
      if(c.match?.origin && c.match.origin!==new URL(url()).origin) throw new Error('此模板属于另一个网站，请切换模板或重新配置。');
      const structure=config=>JSON.stringify({...config,options:undefined,name:undefined});
      if(state.records.length && structure(c)!==structure(state.config)) throw new Error('字段或定位配置已改变，请先导出并清空已有结果，再运行新配置。');
      if(!state.config)state.source=url();
      state.page=state.pending?.nextPage || 1;
      state.config=c;state.pending=null;state.needsUser=false;running=true;
      await emit('正在运行，请保持目标网页打开。','running');
      task=loop(c).finally(()=>{task=null;});
      return snapshot();
    }
    async function stop(){running=false;if(task) await task;await emit('已暂停，已有结果保留。','paused');return snapshot();}
    async function clear(){if(running)throw new Error('请先暂停再清空。');if(task)await task;state={...state,config:null,source:url(),records:[],errors:[],page:1,pending:null,needsUser:false};await emit('结果已清空。','idle');return snapshot();}
    function restore(data) {
      if(!data?.config || !Array.isArray(data.records))return;
      const config=validate(data.config);
      state=structuredClone(data);state.config=config;running=false;delete state.running;
    }
    function preview(input) {
      const c=validate(input), rows=items(c), warnings=[];
      if(rows.slice(0,5).some(row=>VisualLocator.nestedRecords(row)>1))warnings.push('列表可能选中了外层容器：一个匹配项包含多条记录。请使用“修复列表层级与字段”。');
      const data=rows.slice(0,5).map(row=>listValues(row,c));
      for(const f of c.fields.filter(f=>f.scope==='list')) if(data.every(r=>!r[f.id]))warnings.push(`“${f.name}”在预览中全部为空。`);
      return {count:rows.length,records:data,detail:c.detail.mode==='page'?{}:detailValues(c),warnings};
    }
    function repair(input) {
      const c=validate(input), oldRows=items(c), original=oldRows[0];
      if(!original)throw new Error('当前列表规则没有匹配记录，请先重新点选列表。');
      const fields=c.fields.filter(f=>f.scope==='list');
      const targets=fields.map(f=>({field:f,element:(f.selector===':scope'?original:original.querySelector(f.selector)) || get(f.selector)})).filter(t=>visible(t.element));
      if(!targets.length)throw new Error('没有找到字段样例，请先点选至少一个列表字段。');
      let unit=VisualLocator.probableItem(targets[0].element,root);
      while(unit && !targets.every(t=>unit.contains(t.element)))unit=unit.parentElement;
      if(!unit || unit===root || unit===document.body)throw new Error('字段分布在不同区域，请重新点选同一条记录内的字段。');
      const proposed=VisualLocator.listSelector(unit,root);
      if(proposed.count<2)throw new Error('尚未识别到重复记录，请重新点选一张完整卡片。');
      const nextRows=[...root.querySelectorAll(proposed.selector)].filter(visible);
      for(const {field,element}of targets) {
        const targetRow=nextRows.find(row=>row.contains(element));
        if(targetRow)field.selector=VisualLocator.unique(element,targetRow);
      }
      if(c.detail?.clickSelector) {
        const target=original.querySelector(c.detail.clickSelector);
        const targetRow=target && nextRows.find(row=>row.contains(target));
        if(targetRow)c.detail.clickSelector=VisualLocator.unique(target,targetRow);
      }
      c.listSelector=proposed.selector;
      const check=preview(c);
      return {config:c,previous:oldRows.length,count:check.count,warnings:check.warnings};
    }
    function pick({kind, listSelector: list='',fieldName=''}) {
      if(running)throw new Error('请先暂停再修改点选。');
      cancelledPick?.();
      list=String(list || '').trim();
      if(kind==='field-list' || kind==='detail-click') {
        if(!list && kind==='field-list')throw new Error('请先在第1步点选一整条职位卡片，再点选列表字段。');
        if(list) {
          let rows;try {rows=[...root.querySelectorAll(list)].filter(visible);}catch {throw new Error('列表定位规则无效，请回到第1步重新点选一整条记录。');}
          if(!rows.length)throw new Error('当前列表规则没有匹配记录，请回到第1步重新点选列表。');
        }
      }
      return new Promise((resolve,reject)=>{
        let selected=null, hovered=null;
        const overlay=document.createElement('div');overlay.dataset.vpcUi='picker';
        overlay.style.cssText='position:fixed;pointer-events:none;z-index:2147483647;border:3px solid #0a9188;background:#0a91881c;box-sizing:border-box';
        const tip=document.createElement('div');tip.dataset.vpcUi='tip';tip.textContent=(fieldName?'请选择“'+String(fieldName).slice(0,50)+'”':'点选元素')+' · ↑ 选外层 · ↓ 返回 · Esc 取消';
        tip.style.cssText='position:fixed;left:14px;bottom:14px;z-index:2147483647;background:#123b3a;color:white;padding:10px 16px;border-radius:8px;font:14px system-ui;pointer-events:none';
        document.documentElement.append(overlay,tip);
        const paint=()=>{if(!selected)return;const r=selected.getBoundingClientRect();Object.assign(overlay.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});};
        const move=e=>{if(!visible(e.target) || e.target===hovered || (root!==document && !root.contains(e.target)))return;hovered=e.target;selected=kind==='list'?VisualLocator.probableItem(hovered,root):(kind==='next'?(hovered.closest('button,a,[role="button"]') || hovered):hovered);paint();};
        const cleanup=()=>{document.removeEventListener('mousemove',move,true);document.removeEventListener('click',click,true);document.removeEventListener('keydown',keyDown,true);overlay.remove();tip.remove();clearTimeout(timer);cancelledPick=null;};
        const cancel=()=>{cleanup();reject(new Error('已取消点选。'));};
        const click=e=>{
          if(!selected)return;e.preventDefault();e.stopImmediatePropagation();
          try {
            let result;
            if(['field-list','field-detail','identity'].includes(kind) && (selected===document.body || selected===document.documentElement || selected===root))throw new Error('选到了整个页面。请点击具体文字，或按↓缩小选择。');
            if(kind==='list')result=VisualLocator.listSelector(selected,root);
            else if(kind==='field-list' || kind==='detail-click') {
              let inferred=null;
              if(!list && kind==='detail-click') {
                const unit=VisualLocator.probableItem(selected,root);
                if(unit===selected || unit===root || unit===document.body || VisualLocator.nestedRecords(unit)>1)throw new Error('尚未选定列表。请按Esc退出，在第1步点选包含标题、薪资和公司的整张职位卡片。');
                inferred=VisualLocator.listSelector(unit,root);
                if(inferred.count<2)throw new Error('未识别到多条职位卡片。请按Esc退出，在第1步先选择列表。');
              }
              const row=[...root.querySelectorAll(inferred?.selector || list)].find(item=>item.contains(selected));
              if(!row)throw new Error('请在列表中的某一条记录内点选；详情区字段请切换读取区域。');
              result={selector:VisualLocator.unique(selected,row)};
              if(inferred)Object.assign(result,{listSelector:inferred.selector,count:inferred.count,autoList:true});
            } else result={selector:VisualLocator.unique(selected,root)};
            result.sample=(selected.innerText || selected.getAttribute('alt') || selected.tagName).trim().slice(0,160);
            cleanup();resolve(result);
          } catch(error){tip.textContent=error.message+'（Esc取消）';}
        };
        const keyDown=e=>{
          if(e.key==='Escape'){e.preventDefault();cancel();}
          if(e.key==='ArrowUp' && selected?.parentElement && selected.parentElement!==root){e.preventDefault();selected=selected.parentElement;paint();}
          if(e.key==='ArrowDown' && hovered){e.preventDefault();selected=hovered;paint();}
        };
        const timer=setTimeout(cancel,120000);cancelledPick=cancel;
        document.addEventListener('mousemove',move,true);document.addEventListener('click',click,true);document.addEventListener('keydown',keyDown,true);
      });
    }
    function suggest(input){if(running)throw new Error('请先暂停采集，再识别页面。');return VisualDetect.list(root,input,url());}
    function entry(c){
      const row=items(c)[0];if(!row)throw new Error('没有找到职位列表，请先点“自动识别页面”。');
      const data=listValues(row,c);
      return {link:data[c.detail?.linkField] || '',rowSelector:VisualLocator.unique(row,document),title:data['auto-title'] || data[c.detail?.identityField] || ''};
    }
    return {start,stop,clear,preview,repair,pick,snapshot,restore,suggest,entry,sample:input=>detailValues(validate(input)),cancelPick:()=>cancelledPick?.()};
  }
  globalThis.VisualEngine={create,validate};
})();
