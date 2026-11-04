"use strict";
(() => {
  const rows=Array.from({length:24},(_,i)=>({id:i+1,name:'演示岗位 '+String(i+1).padStart(2,'0'),salary:(8+i%5)+'–'+(12+i%5)+'K',company:'示例公司 '+String.fromCharCode(65+i%5),education:i%2?'本科':'大专'}));
  let page=0, mode='cards', selected=1;
  function detail(id){
    selected=id;const data=rows[id-1];
    document.querySelectorAll('.record').forEach(el=>el.classList.toggle('active',Number(el.dataset.id)===id));
    document.querySelector('#detail-title').textContent=data.name;
    setTimeout(()=>{
      document.querySelector('#detail-description').textContent=`示例编号 ${id}\n整理数据、生成报告，并跟进日常业务。\n此内容仅用于演示网页采集。`;
      document.querySelector('#detail-requirements').textContent=`${data.education}，具备沟通能力。\n示例要求 ${id}：熟悉常用办公工具。`;
    },180);
  }
  function render(){
    const container=document.querySelector('#records');container.replaceChildren();
    const list=mode==='table'?document.createElement('table'):document.createElement('div');
    if(mode==='table')list.className='demo-table';
    const body=mode==='table'?document.createElement('tbody'):list;
    if(mode==='table')list.append(body);
    for(const data of rows.slice(page*6,page*6+6)){
      const row=document.createElement(mode==='table'?'tr':'article');row.className='record';row.dataset.id=data.id;
      if(mode==='table')row.innerHTML='<td><h3 class="name"></h3><span class="company"></span><small class="education"></small></td><td><span class="salary"></span><br><button class="open-detail">查看详情</button><a class="detail-link">职位链接</a></td>';
      else row.innerHTML='<div class="row"><h3 class="name"></h3><span class="salary fixed"></span></div><span class="company"></span><small class="education"></small><small>经验不限</small><div><button class="open-detail">查看详情</button><a class="detail-link">职位链接</a></div>';
      for(const key of ['name','salary','company','education'])row.querySelector('.'+key).textContent=data[key];
      row.querySelector('a').href='https://example.com/jobs/demo-'+data.id;
      row.querySelector('a').onclick=event=>{event.preventDefault();detail(data.id);};
      row.querySelector('.open-detail').onclick=()=>detail(data.id);
      body.append(row);
    }
    container.append(list);document.querySelector('#page-indicator').textContent=`第 ${page+1}/4 页 · 共24条`;
    document.querySelector('#next').disabled=page===3;
    detail(page*6+1);
  }
  document.querySelector('#next').onclick=()=>{if(page<3){page++;render();}};
  document.querySelector('#view-cards').onclick=()=>{mode='cards';render();};
  document.querySelector('#view-table').onclick=()=>{mode='table';render();};
  document.querySelector('#reset-page').onclick=()=>{page=0;render();};
  render();
  const engine=VisualEngine.create({root:document.querySelector('#demo-page'),onUpdate:async data=>localStorage.setItem('vpc.demo.session',JSON.stringify(data))});
  const example=()=>({version:1,id:'demo-template',name:'示例职位采集',match:{origin:new URL(location.href).origin},listSelector:'#records .record',fields:[
    {id:'name',name:'岗位名称',scope:'list',type:'text',selector:'.name'},
    {id:'salary',name:'薪资',scope:'list',type:'text',selector:'.salary'},
    {id:'company',name:'公司',scope:'list',type:'text',selector:'.company'},
    {id:'url',name:'职位链接',scope:'list',type:'href',selector:'.detail-link'},
    {id:'description',name:'描述',scope:'detail',type:'text',selector:'#detail-description'},
    {id:'requirements',name:'要求',scope:'detail',type:'text',selector:'#detail-requirements'}
  ],keyFields:['url'],detail:{clickSelector:'.open-detail',identityField:'name',identitySelector:'#detail-title',identityType:'text',waitField:'description',allowSame:false},pagination:{mode:'next',selector:'#next'},options:{count:12,delay:700,timeout:8000,maxPages:4,dropEmpty:true}});
  const api=async(action,payload)=>{
    if(action==='context')return {url:location.href,title:'离线演示网页'};
    if(action==='state')return engine.snapshot();
    if(action==='example')return example();
    if(action==='pick')return engine.pick(payload);
    if(action==='cancelPick'){engine.cancelPick();return {};}
    if(action==='preview')return engine.preview(payload);
    if(action==='start')return engine.start(payload);
    if(action==='stop')return engine.stop();
    if(action==='clear')return engine.clear();
    throw new Error('未知操作');
  };
  const studio=VisualStudio.create({element:document.querySelector('#app'),api,demo:true,storage:{get:async()=>JSON.parse(localStorage.getItem('vpc.demo.templates') || '{}'),set:async data=>localStorage.setItem('vpc.demo.templates',JSON.stringify(data))}});
  globalThis.VisualDemo={engine,studio,example,render,get page(){return page;}};
})();
