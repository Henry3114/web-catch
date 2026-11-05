"use strict";
(() => {
  const DEFAULT=()=>({version:1,id:crypto.randomUUID(),name:'我的采集模板',quickDetails:true,match:{origin:''},listSelector:'',fields:[],keyFields:[],detail:{mode:'same',origin:'',linkField:'',clickSelector:'',identityField:'',identitySelector:'',identityType:'text',waitField:'',allowSame:false},pagination:{mode:'none',selector:''},options:{count:20,delay:1500,timeout:15000,maxPages:30,dropEmpty:true}});
  function create({element,api,storage,demo=false,installedVersion='',extensionId=''}) {
    let config=DEFAULT(), context=null, templates={}, latest=null, busy=false, startedHere=false,pickingRole='list',guideWorking=false,autoSample=null,manualDetail=false,validation=null,runtimeCheckKey='',actionChecks={};
    element.className='studio';
    element.innerHTML=`<div class="top"><div class="mark">V</div><div><h1>网页采集工作台</h1><span class="tag">${demo?'离线演示 · 示例数据':'独立试用版 · 配置驱动'}</span></div></div>
      <p id="version-info" class="hint"></p><p class="hint">先自动识别页面，再按提示补充点选。</p>
      <div class="quickbar"><button id="quick-preview">预览</button><button id="quick-start" class="primary">开始采集</button><button id="quick-stop">暂停</button><button id="quick-export">导出</button><span id="quick-progress" class="hint"></span></div>
      <div id="notice" role="status">正在连接当前网页…</div><p id="source" class="source"></p>
      <div class="buttons"><button id="connect">连接列表页</button><button id="example" ${demo?'':'hidden'}>填入演示模板</button><a class="demo-link" href="demo.html" target="_blank" ${demo?'hidden':''}>先看离线演示 ↗</a></div>
      <section class="card guide"><span class="tag">简单模式</span><h2 id="guide-title">先连接职位列表</h2><p id="guide-hint" class="hint"></p><div class="numberrow"><label>采集数量<input id="count" type="number" min="1" max="10000" value="20"></label><label><input id="quick-details" type="checkbox" checked> 同时读取职位详情</label></div><div class="buttons"><button id="guide-action" class="primary">自动识别页面</button><button id="guide-pick-title">点一个职位标题</button><button id="guide-cancel" hidden>取消准备</button></div><p id="guide-summary" class="hint"></p></section>
      <section class="card"><div class="cardhead"><h2>设置检查</h2><button id="check-setup">检查设置</button></div><p class="hint">√ 样例实测通过　× 检查失败　○ 待验证。检查第一条职位，修改设置后需重新检查。</p><div id="setup-checks" role="status"></div></section><details id="advanced-settings"><summary>高级设置（字段、模板和翻页，可选）</summary>
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
      <div class="numberrow"><label>每条间隔（秒）<input id="delay" type="number" min="0.5" max="60" step="0.5"></label></div>
      <details><summary>等待、去重及导出设置</summary><div class="numberrow"><label>等待超时（秒）<input id="timeout" type="number" min="1" max="60"></label><label>最多列表页<input id="pages" type="number" min="1" max="500"></label></div><label><input id="drop" type="checkbox"> 自动删除全空列</label><label><input id="auto-export" type="checkbox" checked> 采集结束后自动导出 Excel</label><p class="hint">可在字段卡片勾选“用于去重”；不选时优先使用链接，否则使用整条列表文字。</p></details></section>
      </details><section class="card results"><h2>预览与结果</h2><div class="buttons manual-controls"><button id="preview">预览前5条</button><button id="start" class="primary">开始 / 继续</button><button id="stop">暂停</button><button id="cancel">取消点选</button></div>
      <div class="metrics"><p id="progress">尚未运行</p><span id="state" class="tag">待配置</span></div><p id="run-message" class="hint"></p>
      <div class="buttons"><button id="excel">导出已有结果</button><button id="clear" class="danger">清空结果</button></div><div id="preview-table"></div><div id="detail-preview" class="sample" hidden></div></section>
      <div id="picker-help" hidden role="status"><span id="picker-message"></span><button id="picker-cancel">取消点选</button></div><p class="footer">模板和结果只保存在本机。点选只定位页面元素，不读取密码或Cookie、不绕过访问验证。支持列表/表格、同页详情和进入详情页批量采集。</p>`;
    const $=id=>element.querySelector('#'+id);
    function versions(){const ui='0.3.5',content=context?.contentVersion;$('version-info').textContent='界面 v'+ui+(installedVersion?' · 扩展 v'+installedVersion:' · 离线演示')+(content?' · 网页脚本 '+content:'')+(extensionId?' · ID '+extensionId:'');if(installedVersion && installedVersion!==ui){$('version-info').className='check-fail';$('version-info').textContent+=' × 版本不一致：请覆盖当前扩展目录的文件并重新加载扩展。';}else if(content && content!==ui){$('version-info').className='check-fail';$('version-info').textContent+=' × 请刷新职位列表和详情页。';}else $('version-info').className='hint';}
    const actionIds=['connect','bind','pick-list','repair-list','connect-detail','pick-click','pick-identity','pick-next','save','json','import','preview','start','stop','excel','clear','count','mode','link-field','identity-field','identity-type','detail-mode','templates'];
    for(const id of actionIds){const control=$(id);if(!control)continue;const badge=document.createElement('p');badge.dataset.actionStatus=id;badge.className='action-status check-pending';control.insertAdjacentElement('afterend',badge);}
    function actionKey(id){if(id.startsWith('field:')){const f=config.fields.find(f=>'field:'+f.id===id);return JSON.stringify([context?.url,f]);}const d=config.detail || {};return JSON.stringify(id==='connect'?context?.url:id==='pick-list'||id==='repair-list'?config.listSelector:id==='pick-click'?d.clickSelector:id==='connect-detail'?[d.origin,d.sampleUrl]:id==='pick-identity'||id==='identity-field'?[d.identitySelector,d.identityField]:id==='pick-next'||id==='mode'?config.pagination:id==='count'?config.options.count:checkKey());}
    function markAction(id,status,message){actionChecks[id]={status,message,key:actionKey(id)};renderActions();}
    function renderActions(){if(config.options){const n=Number($('count').value);actionChecks.count={key:actionKey('count'),status:Number.isInteger(n)&&n>=1&&n<=10000?'pass':'fail',message:Number.isInteger(n)&&n>=1&&n<=10000?'数量格式有效':'请填写1至10000的整数'};}for(const node of element.querySelectorAll('[data-action-status]')){const id=node.dataset.actionStatus,stored=actionChecks[id],check=stored?.key===actionKey(id)?stored:null;node.className='action-status check-'+(check?.status || 'pending');node.textContent=check?({pass:'√ ',fail:'× ',pending:'○ '})[check.status]+check.message:'○ 尚未验证';}versions();}
    versions();
    const notify=(message,error=false)=>{$('notice').textContent=message;$('notice').classList.toggle('error',error);};
    const safe=fn=>async(...args)=>{try{const result=await fn(...args);const id=args[0]?.currentTarget?.id;const messages={json:'已发起模板下载，请查看浏览器下载记录。',excel:'已发起结果下载，请查看浏览器下载记录。',preview:'预览已运行；字段是否正确请看设置检查。',stop:'已暂停采集，已有结果保留。',bind:'已绑定当前网站；字段需单独检查。'};if(messages[id])markAction(id,'pass',messages[id]);return result;}catch(error){if(error.needsEntry){manualDetail=false;autoSample=null;config.detail={...config.detail,sampleUrl:'',entryInvalid:true};form();}const id=args[0]?.currentTarget?.id;if(id)markAction(id,'fail',error.message);notify(error.message,true);}finally{persistDraft();}};
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
      config.quickDetails=$('quick-details').checked;
      config.detail={...config.detail,mode:$('detail-mode').value,origin:config.detail?.origin || '',linkField:$('link-field').value,clickSelector:$('click-selector').value.trim(),identitySelector:$('identity-selector').value.trim(),identityField:$('identity-field').value,identityType:$('identity-type').value,waitField:$('wait-field').value,allowSame:$('same-detail').checked};
      return structuredClone(config);
    }
    function refreshFields(reset=false){
      $('fields').replaceChildren();
      for(const f of config.fields){
        if(!f.selector && !f.scopeChosen && /岗位要求|任职要求|岗位职责|工作职责|职位描述|岗位描述/.test(f.name)){f.scope='detail';config.keyFields=config.keyFields.filter(id=>id!==f.id);$('quick-details').checked=true;}
        const card=document.createElement('div');card.className='field';card.dataset.fieldId=f.id;
        card.innerHTML='<div class="row"><input class="fieldname" placeholder="字段名称"><button class="pick fixed">点选</button><button class="remove fixed" title="删除字段">×</button></div><div class="field-grid"><select class="scope"><option value="list">列表内字段（自动返回）</option><option value="detail">详情页字段（自动打开）</option></select><select class="type"><option value="text">文字</option><option value="href">链接地址</option><option value="src">图片地址</option></select></div><label class="hint"><input class="key" type="checkbox"> 用于去重</label><details><summary>定位规则</summary><input class="rule"></details><p class="selector"></p><label class="section-label">正文读取<select class="section-mode"><option value="auto">按字段名称自动分段</option><option value="whole">所选区域全部文字</option><option value="duties">只取工作／岗位职责</option><option value="requirements">只取岗位／任职要求</option></select></label><p class="pick-state hint" role="status"></p><p class="field-check hint"></p>';
        card.querySelector('.section-label').hidden=f.scope!=='detail' || f.type!=='text';card.querySelector('.section-mode').value=f.section || 'auto';card.querySelector('.section-mode').onchange=e=>{f.section=e.target.value;autoSample=null;};
        card.querySelector('.fieldname').value=f.name;card.querySelector('.scope').value=f.scope;card.querySelector('.type').value=f.type;card.querySelector('.rule').value=f.selector;card.querySelector('p').textContent=f.selector || '尚未点选';card.querySelector('.key').checked=config.keyFields.includes(f.id);
        card.querySelector('.fieldname').oninput=e=>{f.name=e.target.value;autoSample=null;if(!f.selector && !f.scopeChosen && /岗位要求|任职要求|岗位职责|工作职责|职位描述|岗位描述/.test(f.name)){f.scope='detail';card.querySelector('.scope').value='detail';config.keyFields=config.keyFields.filter(id=>id!==f.id);card.querySelector('.key').checked=false;card.querySelector('.key').disabled=true;$('quick-details').checked=true;card.querySelector('.pick').textContent='点选详情';card.querySelector('.pick-state').textContent='点选时会自动切换到详情页。';$('detail').hidden=false;}identityOptions();};
        card.querySelector('.scope').onchange=e=>{f.scope=e.target.value;f.scopeChosen=true;f.selector='';if(f.scope==='detail')config.keyFields=config.keyFields.filter(id=>id!==f.id);refreshFields();};
        card.querySelector('.type').onchange=e=>{f.type=e.target.value;identityOptions();};
        card.querySelector('.rule').oninput=e=>{f.selector=e.target.value;card.querySelector('p').textContent=f.selector;};
        card.querySelector('.key').onchange=e=>{config.keyFields=config.keyFields.filter(id=>id!==f.id);if(e.target.checked)config.keyFields.push(f.id);};
        card.querySelector('.key').disabled=f.scope!=='list';
        card.querySelector('.remove').onclick=()=>{config.fields=config.fields.filter(x=>x.id!==f.id);config.keyFields=config.keyFields.filter(id=>id!==f.id);refreshFields();};
        const selectedBadge=document.createElement('p');selectedBadge.dataset.actionStatus='field:'+f.id;selectedBadge.className='action-status check-pending';card.append(selectedBadge);
        card.querySelector('.pick').textContent=f.scope==='detail'?'点选详情':'点选列表';
        card.querySelector('.pick-state').textContent=f.scope==='detail'?'点选时自动打开详情样例，可随时按Esc取消。':'点选时自动返回列表，在一条记录内选择内容。';
        card.querySelector('.pick').onclick=safe(async()=>{
          const status=card.querySelector('.pick-state');
          if(busy){status.textContent='正在点选其他字段。请先按Esc，或点下方“取消点选”，再选本字段。';return;}
          readForm();status.textContent=f.scope==='detail'?'正在打开详情样例，随后请点击正文…':'请在列表卡片内点击这个字段…';
          try{const selected=await pick(f.scope==='list'?'field-list':'field-detail',f.name);if(selected){f.selector=selected.selector;autoSample=null;refreshFields();markAction('field:'+f.id,'pass','已选到位置；提取内容仍需验证。');await rememberPrepared();notify(`已选择“${f.name}”。点“预览”检查本字段实际提取的内容。`);}}
          catch(error){status.textContent=error.message;throw error;}
        });
        $('fields').append(card);
      }
      renderChecks();$('detail').hidden=!config.fields.some(f=>f.scope==='detail');identityOptions(reset);persistDraft();renderGuide();
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
      $('quick-details').checked=config.quickDetails ?? config.fields.some(f=>f.scope==='detail');
      $('name').value=config.name;$('list-selector').value=config.listSelector;$('list-summary').textContent=config.listSelector || '尚未选择';
      $('mode').value=config.pagination.mode;$('next-selector').value=config.pagination.selector || '';$('next-block').hidden=!['next','load'].includes(config.pagination.mode);
      $('count').value=config.options.count;$('delay').value=config.options.delay/1000;$('timeout').value=config.options.timeout/1000;$('pages').value=config.options.maxPages;$('drop').checked=config.options.dropEmpty!==false;
      $('detail-mode').value=config.detail?.mode || 'same';detailMode();$('detail-source').textContent=config.detail?.origin || '尚未连接详情样例';
      $('click-selector').value=config.detail?.clickSelector || '';$('identity-selector').value=config.detail?.identitySelector || '';$('identity-type').value=config.detail?.identityType || 'text';$('same-detail').checked=!!config.detail?.allowSame;
      refreshFields(true);
    }
    async function pick(kind,fieldName=''){
      if(latest?.running)throw new Error('请先暂停采集，再点选字段。');
      if(busy)throw new Error('请先完成或取消上一次点选。');busy=true;
      config.listSelector=$('list-selector').value.trim();
      notify('请在目标网页点击'+(fieldName?'“'+fieldName+'”':'内容')+'；按Esc取消。');$('picker-help').hidden=false;$('picker-message').textContent=kind==='field-detail' && config.detail.mode==='page'?'正在打开详情样例，请稍候；打开后点击'+(fieldName || '正文')+'。':'请在网页内点击'+(fieldName || '内容')+'，按Esc取消。';
      pickingRole=config.detail.mode==='page' && ['field-detail','identity'].includes(kind)?'detail':'list';
      try{
        const result=await api('pick',{kind,listSelector:config.listSelector,role:pickingRole,config:readForm(),fieldName});
        if(result.autoList){config.listSelector=result.listSelector;$('list-selector').value=result.listSelector;$('list-summary').textContent=`自动识别 ${result.count} 条 · ${result.listSelector}`;}
        return result;
      }finally{busy=false;pickingRole='list';$('picker-help').hidden=true;}
    }
    async function connect(current=false){context=await api('context',{current:current===true});$('source').textContent=context.title+' · '+context.url;$('source').title=context.url;if(!config.match.origin)config.match.origin=new URL(context.url).origin;$('template-host').textContent='适用网站：'+(config.match.origin || '尚未绑定');markAction('connect','pass','已连接当前列表页；字段内容需另外验证。');renderGuide();notify(demo?'演示页已连接。可以手动点选，或先填入演示模板。':'已连接。点“选择列表”开始，先预览再运行。');}
    async function save(){readForm();VisualEngine.validate(config);templates[config.id]=structuredClone(config);await storage.set(templates);templateOptions();$('templates').value=config.id;markAction('save','pass','模板已保存到本机。');notify('模板已保存在本机。');}
    function templateOptions(){$('templates').replaceChildren(new Option('选择已保存模板',''));for(const c of Object.values(templates))$('templates').append(new Option(c.name,c.id));}
    function exportResult(){if(!latest?.records.length)throw new Error('还没有结果，请先预览并运行。');const c=latest.config,selected=latest.records.slice(0,c.options.count);const bytes=VisualXlsx.createWorkbook(selected,c.fields,{dropEmpty:c.options.dropEmpty,errors:latest.errors});download(bytes,c.name.replace(/[\\/:*?"<>|]/g,'_')+'_'+selected.length+'条.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');}
    async function update(){
      if(busy || guideWorking)return;
      try{latest=await api('state');if(installedVersion && context)context.contentVersion=latest.buildVersion || context.contentVersion || '旧版未标识';$('progress').textContent=`${latest.records.length} / ${latest.config?.options.count || config.options.count} 条`;$('quick-progress').textContent=$('progress').textContent;$('state').textContent=({idle:'待配置',running:'运行中',paused:'已暂停',done:'已结束'})[latest.status] || latest.status;if(latest.status==='running')markAction('start','pass','采集已启动。');else if(latest.status==='done')markAction('start','pass','本次采集已结束，共 '+latest.records.length+' 条。');else if(latest.status==='paused')markAction('start','fail',latest.message);if(latest.validation?.length && latest.status==='paused' && runtimeCheckKey!==JSON.stringify(latest.validation)){runtimeCheckKey=JSON.stringify(latest.validation);validation={key:checkKey(latest.config || config,latest.source),checks:latest.validation};renderChecks();}$('run-message').textContent=latest.status==='idle' && config.listSelector && config.fields.length?'配置已准备好，预览正确后点击开始采集。':latest.message;$('stop').disabled=!latest.running;$('quick-stop').disabled=!latest.running;$('quick-start').disabled=latest.running;renderGuide();if(latest.status==='idle' && guideStep().action==='run')$('state').textContent='已准备';$('start').disabled=latest.running;
        if(latest.records.length)table(latest.records,latest.config.fields);
        if(startedHere && !latest.running && ['done','paused'].includes(latest.status)){
          startedHere=false;if(latest.records.length && $('auto-export').checked)exportResult();
          if(latest.status==='paused')notify(latest.message,true);
        }
      }catch(error){$('run-message').textContent=error.message;}
    }
    $('connect').onclick=safe(()=>connect(true));
    $('connect-detail').onclick=safe(async()=>{readForm();const sample=await api('detailContext',{current:true});config.detail.origin=new URL(sample.url).origin;config.detail.sampleUrl=sample.url;config.detail.entryInvalid=false;$('detail-source').textContent=sample.title+' · '+sample.url;markAction('connect-detail','pass','已连接详情样例；与列表是否对应需核对。');notify('详情样例已连接。详情字段点选会定位到这张详情页；列表设置仍对应原列表。');});
    $('detail-mode').onchange=()=>{config.detail.mode=$('detail-mode').value;detailMode();};
    $('bind').onclick=safe(async()=>{await connect(true);config.match.origin=new URL(context.url).origin;$('template-host').textContent='适用网站：'+config.match.origin;notify('已绑定当前网站，请重新预览或点选需要调整的字段。');});
    $('pick-list').onclick=safe(async()=>{const data=await pick('list');config.listSelector=data.selector;$('list-selector').value=data.selector;$('list-summary').textContent=`匹配 ${data.count} 条 · ${data.selector}`;markAction('pick-list',data.count?'pass':'fail','当前匹配 '+data.count+' 条记录。');notify(`已识别 ${data.count} 条记录，接下来添加字段。`);});
    $('repair-list').onclick=safe(async()=>{const repaired=await api('repair',readForm());config=repaired.config;form();markAction('repair-list','pass','已应用修复，匹配 '+repaired.count+' 条，请预览内容。');$('list-summary').textContent=`匹配 ${repaired.count} 条 · ${config.listSelector}`;notify(`已修复列表：${repaired.previous} → ${repaired.count} 条；字段改为每条记录内读取。${latest?.records.length?'请先导出并清空旧结果，再预览运行。':'请先预览确认每行正确。'}`+(repaired.warnings.length?'\n'+repaired.warnings.join('\n'):''),!!repaired.warnings.length);});
    $('add').onclick=()=>{readForm();config.fields.push({id:crypto.randomUUID(),name:'字段'+(config.fields.length+1),scope:config.fields.some(f=>f.scope==='detail') || (config.detail?.mode==='page' && $('quick-details').checked)?'detail':'list',type:'text',selector:''});refreshFields();};
    $('mode').onchange=()=>{$('next-block').hidden=!['next','load'].includes($('mode').value);};
    $('pick-next').onclick=safe(async()=>{const result=await pick('next');$('next-selector').value=result.selector;markAction('pick-next','pass','已选到按钮；实际翻页效果尚未验证。');notify('已选择翻页按钮。');});
    $('pick-click').onclick=safe(async()=>{const result=await pick('detail-click');$('click-selector').value=result.selector;markAction('pick-click','pass','已选到入口位置；真实链接待验证。');notify(result.autoList?`已锁定职位标题，并自动识别 ${result.count} 条记录。请预览确认列表字段。`:'已锁定详情点击位置。');});
    $('pick-identity').onclick=safe(async()=>{const result=await pick('identity');$('identity-selector').value=result.selector;markAction('pick-identity','pass','已选到标识：'+result.sample+'；对应关系待验证。');notify('已选择详情标识：'+result.sample);});
    $('preview').onclick=safe(async()=>{const c=readForm(),result=await api('preview',c);table(result.records,c.fields);if(c.detail.mode==='page' && c.fields.some(f=>f.scope==='detail')){if(autoSample)result.detail=autoSample;else try{result.detail=await api('sample',{config:c,role:'detail'});}catch{result.warnings.push('详情样例未连接；已保存的详情规则将在运行时逐条读取。');}}const details=c.fields.filter(f=>f.scope==='detail');$('detail-preview').hidden=!details.length;$('detail-preview').textContent='当前详情单独预览（未与每条列表关联）：\n'+details.map(f=>f.name+'：'+(result.detail[f.id] || '—')).join('\n');notify(`列表匹配 ${result.count} 条，显示前5条。`+(result.warnings.length?'\n'+result.warnings.join('\n'):''),!!result.warnings.length);});
    $('start').onclick=safe(async()=>{if(!$('advanced-settings').open && guideStep().action!=='run'){await guideAction();return;}readForm();VisualEngine.validate(config);latest=await api('start',structuredClone(config));startedHere=true;notify('采集已开始，可暂停或导出。');await update();});
    $('stop').onclick=safe(async()=>{latest=await api('stop');startedHere=false;await update();});
    $('cancel').onclick=safe(async()=>{await api('cancelPick',{role:pickingRole});notify('点选已取消。');});$('picker-cancel').onclick=()=>$('cancel').click();
    $('clear').onclick=safe(async()=>{if(latest?.records.length && !confirm('清空本次采集结果？已保存的模板不会删除。'))return;latest=await api('clear');markAction('clear','pass','结果已清空，模板保留。');$('preview-table').replaceChildren();await update();});
    $('excel').onclick=safe(async()=>{latest=await api('state');exportResult();});
    $('save').onclick=safe(save);
    $('new').onclick=()=>{config=DEFAULT();if(context)config.match.origin=new URL(context.url).origin;form();$('templates').value='';notify('已新建空模板；已有采集结果未删除。');};
    $('templates').onchange=()=>{if(templates[$('templates').value]){config=structuredClone(templates[$('templates').value]);form();markAction('templates','pass','已加载此模板；当前网页内容需重新检查。');notify('模板已加载，请先预览确认定位。');}};
    $('json').onclick=safe(()=>{readForm();VisualEngine.validate(config);download(JSON.stringify(config,null,2),config.name+'.json','application/json');});
    $('import').onclick=()=>{$('file').click();};
    $('file').onchange=safe(async()=>{const file=$('file').files[0];if(!file)return;if(file.size>200000)throw new Error('模板文件过大。');const parsed=JSON.parse(await file.text());config=VisualEngine.validate(parsed);form();markAction('import','pass','模板已导入，页面内容仍需检查。');notify('已导入模板，点预览检查后可保存。');$('file').value='';});
    $('delete-template').onclick=safe(async()=>{if(!templates[config.id])throw new Error('当前模板尚未保存。');if(!confirm('删除本机保存的这个模板？采集结果保留。'))return;delete templates[config.id];await storage.set(templates);templateOptions();notify('模板已删除。');});
    $('example').onclick=safe(async()=>{config=await api('example');form();notify('已填入演示模板。点“预览前5条”，再点开始。你也可以重新点选修改。');});
    for(const [quick,target]of[['quick-preview','preview'],['quick-stop','stop'],['quick-export','excel']])$(quick).onclick=()=>$(target).click();
    function guideStep(){
      if(!context)return {action:'connect',title:'先打开要采集的职位列表',hint:'切到职位列表，点工具栏工作台图标，再点“连接列表页”。',button:'连接列表页'};
      readForm();
      if(!config.listSelector || !config.fields.some(f=>f.scope==='list'))return {action:'detect',title:'第1步：自动识别列表和字段',hint:'点一下自动识别。找不到列表时，再点任意一个职位标题。',button:'自动识别页面'};
      if($('quick-details').checked && (config.detail?.entryInvalid || (config.detail?.sampleUrl && !VisualDetect.url(config.detail.sampleUrl,context.url))))return {action:'entry',title:'需要重新获取职位详情链接',hint:'上次打开的是空白页或无效地址。点下方按钮，工具会从职位列表重新获取真实链接。',button:'重新获取详情链接'};
      if($('quick-details').checked && !config.fields.some(f=>f.scope==='detail' && f.selector)){
        if(manualDetail)return {action:'description',title:'只需补点一下职位描述',hint:'详情页已打开。点下方按钮，再选择包含职责、要求的完整正文。',button:'点选职位描述'};
        if(!config.detail?.sampleUrl)return {action:'entry',title:'补充职位详情入口',hint:'工具还没找到详情链接。点“点一个职位标题”补选入口；只要列表信息可取消“同时读取职位详情”。',button:'自动查找详情入口'};
        return {action:'detail',title:'第2步：自动试读一条职位详情',hint:'自动打开一条职位并识别正文。Chrome 询问网站权限时点“允许”。',button:'自动读取详情'};
      }
      try{VisualEngine.validate(config);}catch(e){if(/采集数量/.test(e.message))return {action:'count',title:'先填写采集数量',hint:e.message,button:'修改采集数量'};const missing=config.fields.find(f=>!f.selector);if(missing)return {action:'field',field:missing,title:'补点一下“'+missing.name+'”',hint:'点击下方按钮，在网页中选择这项内容的位置。',button:'点选'+missing.name};return {action:'advanced',title:'还差一项设置',hint:e.message+'。点下方按钮补充。',button:'打开需要的设置'};}
      return {action:'run',title:'已准备好，可以开始采集',hint:'先检查下方预览；开始后自动逐条读取、翻页并导出 Excel。',button:'开始采集'};
    }
    function renderGuide(){
      if(!$('guide-action'))return;
      const step=guideStep();renderChecks();renderActions();$('guide-title').textContent=guideWorking?'正在自动准备，请稍候…':step.title;$('guide-hint').textContent=step.hint;$('guide-action').textContent=step.button;$('guide-action').disabled=guideWorking || busy || !!latest?.running;$('guide-pick-title').disabled=guideWorking || busy || !!latest?.running;
      $('guide-cancel').hidden=!(guideWorking && step.action==='detail');
      if(latest?.running){$('guide-title').textContent='正在自动采集';$('guide-hint').textContent='保持职位列表打开，完成后自动导出 Excel。需要中断时点顶部“暂停”。';$('guide-action').textContent='采集中…';}else if(latest?.status==='paused' && step.action==='run'){$('guide-title').textContent='已暂停，已有结果保留';$('guide-hint').textContent=latest.message;$('guide-action').textContent='继续采集';}
      $('guide-pick-title').hidden=!['detect','entry'].includes(step.action);$('quick-start').textContent=step.action==='run'?'开始采集':'下一步';
    }
    async function rememberPrepared(){try{VisualEngine.validate(config);templates[config.id]=structuredClone(config);await storage.set(templates);templateOptions();$('templates').value=config.id;markAction('save','pass','完整配置已自动保存到本机。');}catch{}}
    async function findEntry(){
      const entry=await api('resolveEntry',readForm()),resolved=VisualDetect.url(entry.url,context.url);
      if(!resolved){const e=new Error('没有取得有效职位地址。请重新获取详情链接，或补点一个职位标题。');e.needsEntry=true;throw e;}
      if(!entry.link && config.detail?.linkField){config.keyFields=config.keyFields.filter(id=>id!==config.detail.linkField);config.detail.linkField='';}
      const url=new URL(resolved);manualDetail=false;
      config.detail={...config.detail,mode:'page',origin:url.origin,sampleUrl:url.href,sampleTitle:entry.title || '',entryInvalid:false};form();markAction('pick-click','pass','已取得真实链接：'+url.href);
    }
    async function detectPage(){
      if(latest?.running)throw new Error('请先暂停采集。');
      if(latest?.records.length)throw new Error('已有结果保留。重新识别前，请先导出并清空结果。');
      const result=await api('suggest',readForm());config=result.config;autoSample=null;manualDetail=false;form();markAction('pick-list','pass','自动识别 '+result.count+' 条记录。');table(result.records,config.fields);
      $('guide-summary').textContent=`已识别 ${result.count} 条；字段：${config.fields.map(f=>f.name).join('、')}。`+(result.warnings.length?' '+result.warnings.join(' '):'');
      if($('quick-details').checked)try{await findEntry();}catch(e){notify(e.message,true);return;}
      await rememberPrepared();notify($('quick-details').checked?'列表已识别。下一步点“自动读取详情”。':'列表已识别并保存，下方预览正确即可开始。');
    }
    async function prepareDetails(){
      const result=await api('autoDetail',{config:readForm(),url:config.detail.sampleUrl});
      if(result.needsSelection){manualDetail=true;notify(result.message);renderGuide();return;}
      mergeDetailFields(result.fields);autoSample=result.sample;
      config.detail={...config.detail,mode:'page',origin:new URL(result.url).origin,identityField:'',identitySelector:''};
      if(result.title && result.title.replace(/\s+/g,'')===config.detail.sampleTitle?.replace(/\s+/g,'')){config.detail.identityField='auto-title';config.detail.identitySelector=result.identitySelector;}
      form();markAction('connect-detail','pass','样例正文已实际读取；其它自定义字段需检查。');await rememberPrepared();$('detail-preview').hidden=false;$('detail-preview').textContent='详情试读（仅第一条样例）：\n'+Object.values(autoSample).join('\n');notify('详情已自动识别并保存。检查预览后，点“开始采集”。');
    }
    function mergeDetailFields(fields){for(const field of fields){const existing=config.fields.find(f=>f.id===field.id);if(!existing)config.fields.push(field);else if(!existing.selector)existing.selector=field.selector;}}
    async function guideAction(){
      if(guideWorking || busy || latest?.running)return;
      const step=guideStep();
      if(step.action==='run'){$('start').click();return;}
      if(step.action==='count'){$('count').focus();$('count').select();return;}
      if(step.action==='advanced'){$('advanced-settings').open=true;$('fields').scrollIntoView({block:'center'});notify(step.hint,true);return;}
      guideWorking=true;renderGuide();
      try{
        if(step.action==='field'){const chosen=await pick(step.field.scope==='detail'?'field-detail':'field-list');step.field.selector=chosen.selector;form();await rememberPrepared();}
        else if(step.action==='connect'){await connect(true);await detectPage();}
        else if(step.action==='detect')await detectPage();
        else if(step.action==='entry')await findEntry();
        else if(step.action==='detail')await prepareDetails();
        else if(step.action==='description'){
          const selected=await pick('field-detail');mergeDetailFields([{id:'auto-description',name:'职位描述',scope:'detail',type:'text',selector:selected.selector}]);manualDetail=false;form();await rememberPrepared();notify('职位描述已保存，可以继续配置或开始采集。');
        }
      }finally{guideWorking=false;renderGuide();}
    }
    $('guide-cancel').onclick=safe(async()=>{await api('stop');notify('准备已取消。已有配置和结果保留。');});
    $('guide-action').onclick=safe(guideAction);$('quick-start').onclick=safe(guideAction);
    $('guide-pick-title').onclick=safe(async()=>{const selected=await pick('detail-click');$('click-selector').value=selected.selector;config.detail.clickSelector=selected.selector;await detectPage();});
    $('quick-details').onchange=()=>{readForm();if(!$('quick-details').checked){config.fields=config.fields.filter(f=>f.scope!=='detail');autoSample=null;manualDetail=false;form();rememberPrepared();}renderGuide();};
    function checkKey(c=config,source=context?.url){return JSON.stringify({source,fields:c.fields,detail:c.detail,list:c.listSelector,match:c.match,pagination:c.pagination});}
    function renderChecks(){
      if(!$('setup-checks'))return;
      const checked=validation?.key===checkKey()?validation.checks:[];
      const expected=[{id:'list',label:'职位列表'},...config.fields.map(f=>({id:'field:'+f.id,label:f.name})),...(config.fields.some(f=>f.scope==='detail')?[{id:'entry',label:'详情入口'},{id:'detail-page',label:'详情页面'},{id:'identity',label:'职位对应关系'}]:[])];
      const all=expected.map(item=>checked.find(c=>c.id===item.id) || {...item,status:'pending',message:'待验证，请点“检查设置”'});
      $('setup-checks').replaceChildren();
      for(const item of all){const line=document.createElement('p');line.className='check-'+item.status;line.textContent=({pass:'√ ',fail:'× ',pending:'○ '})[item.status]+item.label+'：'+item.message;$('setup-checks').append(line);}
      for(const card of $('fields').children){const item=all.find(c=>c.id==='field:'+card.dataset.fieldId),target=card.querySelector('.field-check');if(item && target){target.className='field-check check-'+item.status;target.textContent=({pass:'√ ',fail:'× ',pending:'○ '})[item.status]+item.message;}}
    }
    $('check-setup').onclick=safe(async()=>{
      if(busy || guideWorking || latest?.running)throw new Error('请先结束点选或暂停采集，再检查设置。');
      readForm();const key=checkKey();$('check-setup').disabled=true;notify('正在检查列表、真实详情链接、职位对应关系和各字段内容…');
      try{const result=await api('checkSetup',{config:structuredClone(config)});validation={key,checks:result.checks};for(const c of result.checks){const target={list:['pick-list'],entry:['pick-click','link-field'],'detail-page':['connect-detail'],identity:['pick-identity','identity-field'],pagination:['pick-next','mode']}[c.id];if(target)for(const id of target)markAction(id,c.status,c.message);}renderChecks();const failed=result.checks.filter(c=>c.status==='fail');notify(failed.length?'检查发现问题：'+failed.map(c=>c.label).join('、')+'。请查看检查项旁的具体原因。':'已检查的项目通过；○ 项尚未验证，不代表已通过。',!!failed.length);}finally{$('check-setup').disabled=false;}
    });
    for(const id of ['link-field','identity-field','identity-type','detail-mode','mode'])$(id).addEventListener('change',()=>{readForm();const messages={'link-field':$('link-field').value?'已选择链接字段；真实地址待验证。':'已选择通过职位标题取链接；地址待验证。','identity-field':$('identity-field').value?'已选择标识列；与详情是否一致待验证。':'未启用标识核对，将按链接对应。','identity-type':'已选择标识读取方式；匹配结果待验证。','detail-mode':'已选择详情打开方式；页面内容待验证。',mode:config.pagination.mode==='none'?'只读取当前列表，不自动翻页。':'已选择翻页方式；按钮和加载效果待验证。'};markAction(id,'pass',messages[id]);});
    function detailMode(){const page=$('detail-mode').value==='page';$('page-detail').hidden=!page;$('same-help').hidden=page;$('same-detail').parentElement.hidden=page;$('wait-field').parentElement.hidden=page;}
    let draftTimer,draftingReady=false;
    function persistDraft(){if(!storage.setDraft || !draftingReady)return;clearTimeout(draftTimer);draftTimer=setTimeout(()=>{try{storage.setDraft(readForm()).catch(()=>{});}catch{}},150);}
    element.addEventListener('keydown',event=>{if(event.key==='Escape' && busy){event.preventDefault();$('picker-cancel').click();}});
    element.addEventListener('input',()=>{persistDraft();renderGuide();});element.addEventListener('change',()=>{persistDraft();renderGuide();});
    form();
    const ready=(async()=>{templates=await storage.get() || {};templateOptions();const draft=await storage.getDraft?.();if(draft?.version===1 && Array.isArray(draft.fields)){config=draft;form();}draftingReady=true;await connect();persistDraft();await update();})().catch(error=>notify(error.message,true));
    const timer=setInterval(update,1000);
    return {ready,dispose:()=>{clearInterval(timer);clearTimeout(draftTimer);},getConfig:readForm,loadConfig:c=>{config=structuredClone(c);form();}};
  }
  globalThis.VisualStudio={create,defaults:DEFAULT};
})();
