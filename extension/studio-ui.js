"use strict";
(() => {
  const DEFAULT=()=>({version:1,id:crypto.randomUUID(),name:'我的采集模板',match:{origin:''},listSelector:'',fields:[],keyFields:[],detail:{mode:'same',origin:'',linkField:'',clickSelector:'',identityField:'',identitySelector:'',identityType:'text',waitField:'',allowSame:false},pagination:{mode:'none',selector:''},options:{count:20,delay:1500,timeout:15000,maxPages:30,dropEmpty:true}});
  function create({element,api,storage,demo=false}) {
    let config=DEFAULT(), context=null, templates={}, latest=null, busy=false, startedHere=false,pickingRole='list';
    element.className='studio';
    element.innerHTML=`<div class="top"><div class="mark">V</div><div><h1>网页采集工作台</h1><span class="tag">${demo?'离线演示 · 示例数据':'独立试用版 · 配置驱动'}</span></div></div>
      <p class="hint">鼠标点选网页，建立自己的采集模板。</p>
      <div class="quickbar"><button id="quick-preview">预览</button><button id="quick-start" class="primary">开始采集</button><button id="quick-stop">暂停</button><button id="quick-export">导出</button><span id="quick-progress" class="hint"></span></div>
      <div id="notice" role="status">正在连接当前网页…</div><p id="source" class="source"></p>
      <div class="buttons"><button id="connect">连接列表页</button><button id="example" ${demo?'':'hidden'}>填入演示模板</button><a class="demo-link" href="demo.html" target="_blank" ${demo?'hidden':''}>先看离线演示 ↗</a></div>
      <section class="card"><div class="cardhead"><h2>模板</h2><button id="new">新建</button></div>
      <select id="templates"><option value="">选择已保存模板</option></select><label>模板名称<input id="name" maxlength="80"></label><p id="template-host" class="hint"></p><button id="bind">绑定当前网站</button>
      <div class="buttons"><button id="save">保存到本机</button><button id="json">导出模板</button><button id="import">导入模板</button><button id="delete-template" class="danger">删除模板</button></div><input id="file" type="file" accept="application/json,.json" hidden></section>
      <section class="card"><div class="cardhead"><h2><span class="step">1</span>选择列表</h2><button id="pick-list">点选一整条记录</button></div><button id="repair-list">修复列表层级与字段</button>
      <p class="hint">移到一条完整记录上，按 ↑ 可扩大选择，点击确认；Esc 取消。</p><p id="list-summary" class="selector">尚未选择</p>
      <details><summary>手动调整列表定位规则</summary><input id="list-selector" placeholder="CSS 定位规则"></details></section>
      <section class="card"><div class="cardhead"><h2><span class="step">2</span>定义字段</h2><button id="add">＋ 添加字段</button></div><div id="fields"></div>
      <div id="detail" hidden><h2>详情设置</h2>
      <label>详情打开方式<select id="detail-mode"><option value="same">在当前页面展开</option><option value="page">进入详情页（新标签页）</option></select></label>
      <div id="page-detail" hidden><p class="hint">手动打开一个职位详情，点击该页工具栏图标，再点下面的“连接详情样例”。详情字段在样例页点选；列表和翻页仍在列表页点选。运行时返回列表页点开始即可。</p><button id="connect-detail">连接详情样例（当前标签页）</button><p id="detail-source" class="source"></p><label>使用哪一列作为详情链接<select id="link-field"></select></label><p class="hint">没有链接列时，点选下方“打开详情的位置”，选择列表中的职位标题。可选详情标识用于核对职位名称，防止错配。</p></div>
      <p id="same-help" class="hint">先手动展开一条详情，再点选详情字段；配置列表标识与详情标识。</p>
      <div class="buttons"><button id="pick-click">点选打开详情的位置</button><button id="pick-identity">点选详情中的标识</button></div>
      <p class="hint">列表中哪一列，应与详情标识相同？</p><select id="identity-field"></select>
      <label>详情标识读取方式<select id="identity-type"><option value="text">文字</option><option value="href">链接</option></select></label>
      <label>等待哪一详情字段更新<select id="wait-field"></select></label>
      <label><input id="same-detail" type="checkbox"> 允许不同记录的详情正文完全相同</label>
      <details><summary>查看详情定位规则</summary><label>点击位置<input id="click-selector"></label><label>详情标识<input id="identity-selector"></label></details></div></section>
      <section class="card"><h2><span class="step">3</span>翻页与采集数量</h2>
      <label>翻页方式<select id="mode"><option value="none">只读当前列表</option><option value="next">点击下一页</option><option value="load">点击加载更多</option><option value="scroll">滚动加载</option></select></label>
      <div id="next-block" hidden><button id="pick-next">点选翻页按钮</button><input id="next-selector" placeholder="翻页按钮定位规则"></div>
      <div class="numberrow"><label>目标条数<input id="count" type="number" min="1" max="10000"></label><label>每条间隔（秒）<input id="delay" type="number" min="0.5" max="60" step="0.5"></label></div>
      <details><summary>等待、去重及导出设置</summary><div class="numberrow"><label>等待超时（秒）<input id="timeout" type="number" min="1" max="60"></label><label>最多列表页<input id="pages" type="number" min="1" max="500"></label></div><label><input id="drop" type="checkbox"> 自动删除全空列</label><label><input id="auto-export" type="checkbox" checked> 采集结束后自动导出 Excel</label><p class="hint">可在字段卡片勾选“用于去重”；不选时优先使用链接，否则使用整条列表文字。</p></details></section>
      <section class="card"><h2><span class="step">4</span>预览与运行</h2><div class="buttons"><button id="preview">预览前5条</button><button id="start" class="primary">开始 / 继续</button><button id="stop">暂停</button><button id="cancel">取消点选</button></div>
      <div class="metrics"><p id="progress">尚未运行</p><span id="state" class="tag">待配置</span></div><p id="run-message" class="hint"></p>
      <div class="buttons"><button id="excel">导出已有结果</button><button id="clear" class="danger">清空结果</button></div><div id="preview-table"></div><div id="detail-preview" class="sample" hidden></div></section>
      <p class="footer">模板和结果只保存在本机。点选只定位页面元素，不读取密码或Cookie、不绕过访问验证。支持列表/表格、同页详情和进入详情页批量采集。</p>`;
    const $=id=>element.querySelector('#'+id);
    const notify=(message,error=false)=>{$('notice').textContent=message;$('notice').classList.toggle('error',error);};
    const safe=fn=>async(...args)=>{try{return await fn(...args);}catch(error){notify(error.message,true);}finally{persistDraft();}};
    function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
    function table(records,fields){
      $('preview-table').replaceChildren();
      if(!records.length){$('preview-table').textContent='暂无记录。';return;}
      const wrap=document.createElement('div');wrap.className='tablewrap';const tab=document.createElement('table'),head=document.createElement('tr');
      for(const f of fields){const th=document.createElement('th');th.textContent=f.name;head.append(th);}tab.append(head);
      for(const r of records.slice(0,5)){const tr=document.createElement('tr');for(const f of fields){const td=document.createElement('td');td.textContent=r[f.id] || (f.scope==='detail'?'运行时逐条读取':'—');tr.append(td);}tab.append(tr);}
      wrap.append(tab);$('preview-table').append(wrap);
    }
    function readForm(){
      config.name=$('name').value.trim();config.listSelector=$('list-selector').value.trim();
      config.options={count:Number($('count').value),delay:Number($('delay').value)*1000,timeout:Number($('timeout').value)*1000,maxPages:Number($('pages').value),dropEmpty:$('drop').checked};
      config.pagination={mode:$('mode').value,selector:$('next-selector').value.trim()};
      config.detail={mode:$('detail-mode').value,origin:config.detail?.origin || '',linkField:$('link-field').value,clickSelector:$('click-selector').value.trim(),identitySelector:$('identity-selector').value.trim(),identityField:$('identity-field').value,identityType:$('identity-type').value,waitField:$('wait-field').value,allowSame:$('same-detail').checked};
      return structuredClone(config);
    }
    function refreshFields(reset=false){
      $('fields').replaceChildren();
      for(const f of config.fields){
        const card=document.createElement('div');card.className='field';card.dataset.fieldId=f.id;
        card.innerHTML='<div class="row"><input class="fieldname" placeholder="字段名称"><button class="pick fixed">点选</button><button class="remove fixed" title="删除字段">×</button></div><div class="field-grid"><select class="scope"><option value="list">列表内字段</option><option value="detail">详情区字段</option></select><select class="type"><option value="text">文字</option><option value="href">链接地址</option><option value="src">图片地址</option></select></div><label class="hint"><input class="key" type="checkbox"> 用于去重</label><details><summary>定位规则</summary><input class="rule"></details><p class="selector"></p>';
        card.querySelector('.fieldname').value=f.name;card.querySelector('.scope').value=f.scope;card.querySelector('.type').value=f.type;card.querySelector('.rule').value=f.selector;card.querySelector('p').textContent=f.selector || '尚未点选';card.querySelector('.key').checked=config.keyFields.includes(f.id);
        card.querySelector('.fieldname').oninput=e=>{f.name=e.target.value;identityOptions();};
        card.querySelector('.scope').onchange=e=>{f.scope=e.target.value;if(f.scope==='detail')config.keyFields=config.keyFields.filter(id=>id!==f.id);refreshFields();};
        card.querySelector('.type').onchange=e=>{f.type=e.target.value;identityOptions();};
        card.querySelector('.rule').oninput=e=>{f.selector=e.target.value;card.querySelector('p').textContent=f.selector;};
        card.querySelector('.key').onchange=e=>{config.keyFields=config.keyFields.filter(id=>id!==f.id);if(e.target.checked)config.keyFields.push(f.id);};
        card.querySelector('.key').disabled=f.scope!=='list';
        card.querySelector('.remove').onclick=()=>{config.fields=config.fields.filter(x=>x.id!==f.id);config.keyFields=config.keyFields.filter(id=>id!==f.id);refreshFields();};
        card.querySelector('.pick').onclick=safe(async()=>{readForm();const selected=await pick(f.scope==='list'?'field-list':'field-detail');if(selected){f.selector=selected.selector;refreshFields();notify(`已选择“${f.name}”：${selected.sample}`);}});
        $('fields').append(card);
      }
      $('detail').hidden=!config.fields.some(f=>f.scope==='detail');identityOptions(reset);persistDraft();
    }
    function identityOptions(reset=false){
      const linked=reset?config.detail?.linkField:($('link-field').value || config.detail?.linkField);
      $('link-field').replaceChildren(new Option('点选职位标题获取链接',''));
      for(const f of config.fields.filter(f=>f.scope==='list' && f.type==='href'))$('link-field').append(new Option(f.name,f.id));
      if(linked)$('link-field').value=linked;
      const selected=reset?config.detail?.identityField:($('identity-field').value || config.detail?.identityField);
      const waited=reset?config.detail?.waitField:($('wait-field').value || config.detail?.waitField);
      for(const [id,scope]of[['identity-field','list'],['wait-field','detail']]){
        $(id).replaceChildren();if(id==='identity-field')$(id).append(new Option('不设置（进入详情页可选）',''));for(const f of config.fields.filter(f=>f.scope===scope)){const opt=document.createElement('option');opt.value=f.id;opt.textContent=f.name;$(id).append(opt);}
      }
      if(selected && config.fields.some(f=>f.id===selected))$('identity-field').value=selected;
      if(waited && config.fields.some(f=>f.id===waited))$('wait-field').value=waited;
    }
    function form(){
      $('template-host').textContent='适用网站：'+(config.match?.origin || '尚未绑定');
      $('name').value=config.name;$('list-selector').value=config.listSelector;$('list-summary').textContent=config.listSelector || '尚未选择';
      $('mode').value=config.pagination.mode;$('next-selector').value=config.pagination.selector || '';$('next-block').hidden=!['next','load'].includes(config.pagination.mode);
      $('count').value=config.options.count;$('delay').value=config.options.delay/1000;$('timeout').value=config.options.timeout/1000;$('pages').value=config.options.maxPages;$('drop').checked=config.options.dropEmpty!==false;
      $('detail-mode').value=config.detail?.mode || 'same';detailMode();$('detail-source').textContent=config.detail?.origin || '尚未连接详情样例';
      $('click-selector').value=config.detail?.clickSelector || '';$('identity-selector').value=config.detail?.identitySelector || '';$('identity-type').value=config.detail?.identityType || 'text';$('same-detail').checked=!!config.detail?.allowSame;
      refreshFields(true);
    }
    async function pick(kind){
      if(busy)throw new Error('请先完成或取消上一次点选。');busy=true;
      notify('请在左侧目标网页移动鼠标并点击；↑扩大选择，Esc取消。');
      pickingRole=config.detail.mode==='page' && ['field-detail','identity'].includes(kind)?'detail':'list';
      try{return await api('pick',{kind,listSelector:config.listSelector,role:pickingRole});}finally{busy=false;pickingRole='list';}
    }
    async function connect(current=false){context=await api('context',{current:current===true});$('source').textContent=context.title+' · '+context.url;$('source').title=context.url;if(!config.match.origin)config.match.origin=new URL(context.url).origin;$('template-host').textContent='适用网站：'+(config.match.origin || '尚未绑定');notify(demo?'演示页已连接。可以手动点选，或先填入演示模板。':'已连接。点“选择列表”开始，先预览再运行。');}
    async function save(){readForm();VisualEngine.validate(config);templates[config.id]=structuredClone(config);await storage.set(templates);templateOptions();$('templates').value=config.id;notify('模板已保存在本机。');}
    function templateOptions(){$('templates').replaceChildren(new Option('选择已保存模板',''));for(const c of Object.values(templates))$('templates').append(new Option(c.name,c.id));}
    function exportResult(){if(!latest?.records.length)throw new Error('还没有结果，请先预览并运行。');const c=latest.config,selected=latest.records.slice(0,c.options.count);const bytes=VisualXlsx.createWorkbook(selected,c.fields,{dropEmpty:c.options.dropEmpty,errors:latest.errors});download(bytes,c.name.replace(/[\\/:*?"<>|]/g,'_')+'_'+selected.length+'条.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');}
    async function update(){
      if(busy)return;
      try{latest=await api('state');$('progress').textContent=`${latest.records.length} / ${latest.config?.options.count || config.options.count} 条`;$('quick-progress').textContent=$('progress').textContent;$('state').textContent=({idle:'待配置',running:'运行中',paused:'已暂停',done:'已结束'})[latest.status] || latest.status;$('run-message').textContent=latest.message;$('stop').disabled=!latest.running;$('quick-stop').disabled=!latest.running;$('quick-start').disabled=latest.running;$('start').disabled=latest.running;
        if(latest.records.length)table(latest.records,latest.config.fields);
        if(startedHere && !latest.running && ['done','paused'].includes(latest.status)){
          startedHere=false;if(latest.records.length && $('auto-export').checked)exportResult();
          if(latest.status==='paused')notify(latest.message,true);
        }
      }catch(error){$('run-message').textContent=error.message;}
    }
    $('connect').onclick=safe(()=>connect(true));
    $('connect-detail').onclick=safe(async()=>{readForm();const sample=await api('detailContext',{current:true});config.detail.origin=new URL(sample.url).origin;$('detail-source').textContent=sample.title+' · '+sample.url;notify('详情样例已连接。详情字段点选会定位到这张详情页；列表设置仍对应原列表。');});
    $('detail-mode').onchange=()=>{config.detail.mode=$('detail-mode').value;detailMode();};
    $('bind').onclick=safe(async()=>{await connect(true);config.match.origin=new URL(context.url).origin;$('template-host').textContent='适用网站：'+config.match.origin;notify('已绑定当前网站，请重新预览或点选需要调整的字段。');});
    $('pick-list').onclick=safe(async()=>{const data=await pick('list');config.listSelector=data.selector;$('list-selector').value=data.selector;$('list-summary').textContent=`匹配 ${data.count} 条 · ${data.selector}`;notify(`已识别 ${data.count} 条记录，接下来添加字段。`);});
    $('repair-list').onclick=safe(async()=>{const repaired=await api('repair',readForm());config=repaired.config;form();$('list-summary').textContent=`匹配 ${repaired.count} 条 · ${config.listSelector}`;notify(`已修复列表：${repaired.previous} → ${repaired.count} 条；字段改为每条记录内读取。${latest?.records.length?'请先导出并清空旧结果，再预览运行。':'请先预览确认每行正确。'}`+(repaired.warnings.length?'\n'+repaired.warnings.join('\n'):''),!!repaired.warnings.length);});
    $('add').onclick=()=>{readForm();config.fields.push({id:crypto.randomUUID(),name:'字段'+(config.fields.length+1),scope:'list',type:'text',selector:''});refreshFields();};
    $('mode').onchange=()=>{$('next-block').hidden=!['next','load'].includes($('mode').value);};
    $('pick-next').onclick=safe(async()=>{const result=await pick('next');$('next-selector').value=result.selector;notify('已选择翻页按钮。');});
    $('pick-click').onclick=safe(async()=>{const result=await pick('detail-click');$('click-selector').value=result.selector;notify('已选择详情点击位置。');});
    $('pick-identity').onclick=safe(async()=>{const result=await pick('identity');$('identity-selector').value=result.selector;notify('已选择详情标识：'+result.sample);});
    $('preview').onclick=safe(async()=>{const c=readForm(),result=await api('preview',c);table(result.records,c.fields);if(c.detail.mode==='page')result.detail=await api('sample',{config:c,role:'detail'});const details=c.fields.filter(f=>f.scope==='detail');$('detail-preview').hidden=!details.length;$('detail-preview').textContent='当前详情单独预览（未与每条列表关联）：\n'+details.map(f=>f.name+'：'+(result.detail[f.id] || '—')).join('\n');notify(`列表匹配 ${result.count} 条，显示前5条。`+(result.warnings.length?'\n'+result.warnings.join('\n'):''),!!result.warnings.length);});
    $('start').onclick=safe(async()=>{readForm();VisualEngine.validate(config);latest=await api('start',structuredClone(config));startedHere=true;notify('采集已开始，可暂停或导出。');await update();});
    $('stop').onclick=safe(async()=>{latest=await api('stop');startedHere=false;await update();});
    $('cancel').onclick=safe(async()=>{await api('cancelPick',{role:pickingRole});notify('点选已取消。');});
    $('clear').onclick=safe(async()=>{if(latest?.records.length && !confirm('清空本次采集结果？已保存的模板不会删除。'))return;latest=await api('clear');$('preview-table').replaceChildren();await update();});
    $('excel').onclick=safe(async()=>{latest=await api('state');exportResult();});
    $('save').onclick=safe(save);
    $('new').onclick=()=>{config=DEFAULT();if(context)config.match.origin=new URL(context.url).origin;form();$('templates').value='';notify('已新建空模板；已有采集结果未删除。');};
    $('templates').onchange=()=>{if(templates[$('templates').value]){config=structuredClone(templates[$('templates').value]);form();notify('模板已加载，请先预览确认定位。');}};
    $('json').onclick=safe(()=>{readForm();VisualEngine.validate(config);download(JSON.stringify(config,null,2),config.name+'.json','application/json');});
    $('import').onclick=()=>{$('file').click();};
    $('file').onchange=safe(async()=>{const file=$('file').files[0];if(!file)return;if(file.size>200000)throw new Error('模板文件过大。');const parsed=JSON.parse(await file.text());config=VisualEngine.validate(parsed);form();notify('已导入模板，点预览检查后可保存。');$('file').value='';});
    $('delete-template').onclick=safe(async()=>{if(!templates[config.id])throw new Error('当前模板尚未保存。');if(!confirm('删除本机保存的这个模板？采集结果保留。'))return;delete templates[config.id];await storage.set(templates);templateOptions();notify('模板已删除。');});
    $('example').onclick=safe(async()=>{config=await api('example');form();notify('已填入演示模板。点“预览前5条”，再点开始。你也可以重新点选修改。');});
    for(const [quick,target]of[['quick-preview','preview'],['quick-start','start'],['quick-stop','stop'],['quick-export','excel']])$(quick).onclick=()=>$(target).click();
    function detailMode(){const page=$('detail-mode').value==='page';$('page-detail').hidden=!page;$('same-help').hidden=page;$('same-detail').parentElement.hidden=page;$('wait-field').parentElement.hidden=page;}
    let draftTimer,draftingReady=false;
    function persistDraft(){if(!storage.setDraft || !draftingReady)return;clearTimeout(draftTimer);draftTimer=setTimeout(()=>{try{storage.setDraft(readForm()).catch(()=>{});}catch{}},150);}
    element.addEventListener('input',persistDraft);element.addEventListener('change',persistDraft);
    form();
    const ready=(async()=>{templates=await storage.get() || {};templateOptions();const draft=await storage.getDraft?.();if(draft?.version===1 && Array.isArray(draft.fields)){config=draft;form();}draftingReady=true;await connect();persistDraft();await update();})().catch(error=>notify(error.message,true));
    const timer=setInterval(update,1000);
    return {ready,dispose:()=>{clearInterval(timer);clearTimeout(draftTimer);},getConfig:readForm,loadConfig:c=>{config=structuredClone(c);form();}};
  }
  globalThis.VisualStudio={create,defaults:DEFAULT};
})();
