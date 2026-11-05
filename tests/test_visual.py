from pathlib import Path
import io
import json
import shutil
import sys
import unittest
import zipfile
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import quote

from openpyxl import load_workbook
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import build

NESTED_JOBS = '''<div class="leftbox"><div class="jobs">
<div class="virtual-slot"><div class="joblist-item" style="height:140px"><div class="joblist-item-job-wrapper"><span class="jname text-cut">运营支持一</span><span class="cname text-cut">公司一</span><span class="sal text-cut">8千-1.3万</span></div></div></div>
<div class="virtual-slot"><div class="joblist-item" style="height:140px"><div class="joblist-item-job-wrapper"><span class="jname text-cut">运营支持二</span><span class="cname text-cut">公司二</span><span class="sal text-cut">1-2万</span></div></div></div>
<div class="virtual-slot"><div class="joblist-item" style="height:140px"><div class="joblist-item-job-wrapper"><span class="jname text-cut">运营支持三</span><span class="cname text-cut">公司三</span><span class="sal text-cut">18-25万/年</span></div></div></div>
</div><div class="pagination" style="height:50px">页码区域</div></div>'''


class VisualCollectorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        build.build()
        class Quiet(SimpleHTTPRequestHandler):
            def log_message(self, *args):
                pass
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.thread.start()
        cls.demo_url=f'http://127.0.0.1:{cls.server.server_port}/'+quote('试玩.html')
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(headless=True, executable_path=shutil.which('chromium'))

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.server.shutdown();cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width':1500,'height':1000}, accept_downloads=True)
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.goto(self.demo_url)
        self.page.evaluate('VisualDemo.studio.ready')
        self.page.wait_for_timeout(220)
        self.page.clock.install()

    def tearDown(self):
        self.assertEqual(self.errors, [])
        self.context.close()

    def tick(self, condition, limit=1800):
        for _ in range(limit):
            self.page.clock.fast_forward(200)
            if self.page.evaluate(condition):
                return
        self.fail('任务未在虚拟时间上限内完成')

    def test_offline_demo_ui_preview_detail_pagination_and_excel(self):
        self.page.locator('#example').click()
        self.page.locator('#preview').click()
        self.assertIn('匹配 6 条', self.page.locator('#notice').inner_text())
        self.assertIn('当前详情单独预览', self.page.locator('#detail-preview').inner_text())
        self.assertEqual(self.page.locator('#preview-table tr').count(), 6)
        with self.page.expect_download() as event:
            self.page.locator('#start').click()
            self.tick("VisualDemo.engine.snapshot().status==='done'")
            self.tick("document.querySelector('#state').textContent==='已结束'")
        state = self.page.evaluate('VisualDemo.engine.snapshot()')
        self.assertEqual(len(state['records']), 12)
        self.assertEqual(len({r['_key'] for r in state['records']}), 12)
        for i, record in enumerate(state['records'], 1):
            self.assertEqual(record['name'], f'演示岗位 {i:02}')
            self.assertIn(f'示例编号 {i}\n', record['description'])
            self.assertIn(f'示例要求 {i}：', record['requirements'])
        wb = load_workbook(io.BytesIO(Path(event.value.path()).read_bytes()))
        self.assertEqual(wb['采集结果'].max_row, 13)
        self.assertEqual(wb['采集结果']['A13'].value, '演示岗位 12')
        wb.close()

    def test_visual_picker_builds_list_field_and_next_rules(self):
        self.page.locator('#pick-list').click()
        name = self.page.locator('#records .record .name').first
        name.hover(); name.click()
        self.assertIn('匹配 6 条', self.page.locator('#list-summary').inner_text())
        self.page.locator('#add').click()
        field = self.page.locator('#fields .field').first
        field.locator('.fieldname').fill('岗位名称')
        field.locator('.pick').click(); name.hover(); name.click()
        self.page.locator('#mode').select_option('next')
        self.page.locator('#pick-next').click()
        next_button = self.page.locator('#next')
        next_button.hover(); next_button.click()
        self.page.locator('#preview').click()
        self.assertIn('演示岗位 01', self.page.locator('#preview-table').inner_text(),
                      self.page.locator('#notice').inner_text()+' '+str(self.page.evaluate('VisualDemo.studio.getConfig()')))
        config = self.page.evaluate('VisualDemo.studio.getConfig()')
        preview=self.page.evaluate('c=>VisualDemo.engine.preview(c)', config)
        self.assertEqual([r[config['fields'][0]['id']] for r in preview['records']], [f'演示岗位 {i:02}' for i in range(1,6)])
        self.assertEqual(config['pagination']['selector'], '#next')
        self.assertEqual(self.page.evaluate('VisualDemo.page'), 0, '点选不能触发网页翻页')

    def test_table_rows_can_be_selected(self):
        self.page.locator('#view-table').click()
        self.page.locator('#pick-list').click()
        name = self.page.locator('tr.record .name').first
        name.hover(); name.click()
        self.assertIn('匹配 6 条', self.page.locator('#list-summary').inner_text())
        self.assertIn('tr.record', self.page.locator('#list-selector').input_value())

    def nested_jobs(self):
        self.page.evaluate("html=>document.querySelector('#demo-page').innerHTML=html",NESTED_JOBS)
        return self.page.evaluate("""() => {
          const c=VisualDemo.example();c.name='嵌套职位测试';c.listSelector='div.leftbox > div';
          c.fields=[['title','职位名称','.jname'],['company','公司名称','.cname'],['salary','薪资范围','.sal']]
            .map(([id,name,selector])=>({id,name,scope:'list',type:'text',selector:'div.joblist-item:nth-of-type(1) '+selector}));
          c.keyFields=[];c.detail={};c.pagination={mode:'none',selector:''};c.options.count=3;return c;
        }""")

    def test_nested_job_cards_are_selected_instead_of_outer_columns(self):
        self.nested_jobs()
        selector=self.page.evaluate("""() => {
          const unit=VisualLocator.probableItem(document.querySelector('.jname'),document.querySelector('#demo-page'));
          return {className:unit.className,...VisualLocator.listSelector(unit,document.querySelector('#demo-page'))};
        }""")
        self.assertEqual(selector['className'],'joblist-item')
        self.assertEqual(selector['count'],3)
        self.assertNotIn('nth-of-type(1)',selector['selector'])

    def test_repair_rebases_first_record_paths_and_collects_three_distinct_jobs(self):
        config=self.nested_jobs()
        bad=self.page.evaluate('c=>VisualDemo.engine.preview(c)',config)
        self.assertEqual(bad['count'],2)
        self.assertTrue(any('外层容器' in warning for warning in bad['warnings']))
        result=self.page.evaluate('c=>VisualDemo.engine.repair(c)',config)
        self.assertEqual(result['count'],3)
        self.assertEqual(result['previous'],2)
        self.assertTrue(all('joblist-item:nth' not in f['selector'] for f in result['config']['fields']))
        self.page.evaluate('c=>VisualDemo.engine.start(c)',result['config'])
        self.tick("VisualDemo.engine.snapshot().status==='done'")
        rows=self.page.evaluate('VisualDemo.engine.snapshot().records')
        self.assertEqual([row['title'] for row in rows],['运营支持一','运营支持二','运营支持三'])
        self.assertEqual([row['company'] for row in rows],['公司一','公司二','公司三'])
        self.assertEqual([row['salary'] for row in rows],['8千-1.3万','1-2万','18-25万/年'])

    def test_repair_button_updates_existing_visual_template(self):
        config=self.nested_jobs()
        self.page.evaluate('c=>VisualDemo.studio.loadConfig(c)',config)
        self.page.locator('#repair-list').click()
        self.page.wait_for_function("document.querySelector('#notice').textContent.includes('已修复列表')")
        self.assertIn('匹配 3 条',self.page.locator('#list-summary').inner_text())
        self.page.locator('#preview').click()
        self.page.wait_for_function("document.querySelector('#preview-table').textContent.includes('运营支持三')")
        self.assertEqual(self.page.locator('#preview-table tr').count(),4)

    def test_pagination_icon_picker_selects_its_button(self):
        self.page.evaluate("document.querySelector('#next').innerHTML='下一页 <i class=arrow>›</i>'")
        self.page.locator('#mode').select_option('next')
        self.page.locator('#pick-next').click()
        arrow=self.page.locator('#next .arrow');arrow.hover();arrow.click()
        self.assertEqual(self.page.locator('#next-selector').input_value(),'#next')
        self.assertEqual(self.page.evaluate('VisualDemo.page'),0)

    def test_template_save_reload_and_json_roundtrip(self):
        self.page.locator('#example').click(); self.page.locator('#name').fill('我的模板')
        self.page.locator('#save').click()
        self.page.wait_for_function("document.querySelector('#notice').textContent.includes('已保存在本机')")
        with self.page.expect_download() as event:
            self.page.locator('#json').click()
        config = json.loads(Path(event.value.path()).read_text())
        self.assertEqual(config['name'], '我的模板')
        self.assertNotIn('records', config)
        self.page.reload(); self.page.evaluate('VisualDemo.studio.ready')
        self.assertIn('我的模板', self.page.locator('#templates').inner_text())
        self.page.locator('#templates').select_option('demo-template')
        self.assertEqual(self.page.locator('#identity-field').input_value(), 'name')
        self.assertEqual(self.page.locator('#wait-field').input_value(), 'description')
        self.page.locator('#new').click()
        self.page.locator('#file').set_input_files({'name':'template.json','mimeType':'application/json','buffer':json.dumps(config).encode()})
        self.page.wait_for_function("document.querySelector('#notice').textContent.includes('已导入')")
        self.assertEqual(self.page.locator('#name').input_value(), '我的模板')

    def test_failed_detail_identity_preserves_partial_data(self):
        self.page.evaluate("""() => {
          const cfg=VisualDemo.example();cfg.options.count=3;
          document.querySelectorAll('.open-detail')[1].onclick=()=>{};
          VisualDemo.engine.start(cfg);
        }""")
        self.tick("VisualDemo.engine.snapshot().status==='paused'")
        state = self.page.evaluate('VisualDemo.engine.snapshot()')
        self.assertEqual(len(state['records']),1)
        self.assertIn('详情未能',state['message'])

    def test_no_more_pages_reports_shortage_and_dedupes(self):
        self.page.evaluate("""() => {const c=VisualDemo.example();c.fields=c.fields.filter(f=>f.scope==='list');c.options.count=40;VisualDemo.engine.start(c);} """)
        self.tick("VisualDemo.engine.snapshot().status==='done'")
        state=self.page.evaluate('VisualDemo.engine.snapshot()')
        self.assertEqual(len(state['records']),24)
        self.assertEqual(len({r['_key'] for r in state['records']}),24)
        self.assertIn('没有更多',state['message'])

    def test_count_can_increase_without_deleting_records(self):
        self.page.evaluate("""() => {const c=VisualDemo.example();c.fields=c.fields.filter(f=>f.scope==='list');c.options.count=5;VisualDemo.engine.start(c);} """)
        self.tick("VisualDemo.engine.snapshot().status==='done'")
        self.page.evaluate("""() => {const c=VisualDemo.engine.snapshot().config;c.options.count=10;VisualDemo.engine.start(c);} """)
        self.tick("VisualDemo.engine.snapshot().status==='done'")
        state=self.page.evaluate('VisualDemo.engine.snapshot()')
        self.assertEqual(len(state['records']),10)
        self.assertEqual(len({r['_key'] for r in state['records']}),10)

    def test_resume_can_pass_already_collected_pages(self):
        self.page.evaluate("""() => {const c=VisualDemo.example();c.fields=c.fields.filter(f=>f.scope==='list');c.options.count=8;VisualDemo.engine.start(c);} """)
        self.tick("VisualDemo.engine.snapshot().status==='done'")
        self.page.locator('#reset-page').click()
        self.page.evaluate("""() => {const c=VisualDemo.engine.snapshot().config;c.options.count=14;VisualDemo.engine.start(c);} """)
        self.tick("VisualDemo.engine.snapshot().status==='done'")
        state=self.page.evaluate('VisualDemo.engine.snapshot()')
        self.assertEqual(len(state['records']),14)
        self.assertEqual(len({r['_key'] for r in state['records']}),14)

    def test_validation_rejects_duplicate_fields_and_template_is_inert(self):
        error=self.page.evaluate("""() => {try{const c=VisualDemo.example();c.fields[1].name=c.fields[0].name;VisualEngine.validate(c);return ''}catch(e){return e.message}}""")
        self.assertIn('唯一',error)
        self.page.evaluate("""() => {const c=VisualDemo.example();c.fields[0].name='<img src=x onerror="window.injected=true">';VisualDemo.studio.loadConfig(c)}""")
        self.assertIsNone(self.page.evaluate('window.injected'))
        self.assertEqual(self.page.locator('#fields img').count(),0)

    def test_generic_xlsx_omits_blank_columns_and_keeps_literal_formulas(self):
        data=self.page.evaluate("""() => Array.from(VisualXlsx.createWorkbook([{a:'=1+1',b:'',_source:'https://example.com'}],[{id:'a',name:'字段A'},{id:'b',name:'空列'}]))""")
        wb=load_workbook(io.BytesIO(bytes(data)))
        self.assertEqual(wb['采集结果']['A2'].value,'=1+1')
        self.assertEqual(wb['采集结果']['A2'].data_type,'s')
        self.assertNotIn('空列',[c.value for c in wb['采集结果'][1]])
        wb.close()

    def test_build_is_self_contained_and_independent(self):
        html=(ROOT/'试玩.html').read_text()
        self.assertNotIn('<script src=',html)
        self.assertNotIn('chrome-extension://',html)
        manifest=json.loads((ROOT/'extension/manifest.json').read_text())
        self.assertNotIn('host_permissions',manifest)
        self.assertEqual(manifest['permissions'],['activeTab','scripting','storage','sidePanel'])
        with zipfile.ZipFile(build.build()) as archive:
            self.assertIsNone(archive.testzip())
            self.assertIn('visual-page-collector/试玩.html',archive.namelist())



    def page_detail_engine(self, broken=None):
        detail=self.context.new_page()
        detail.on('pageerror', lambda e: self.errors.append(str(e)))
        def route(request):
            ident=request.request.url.rsplit('/',1)[-1]
            title='安全验证' if broken=='login' and ident=='2' else '职位详情'
            name='错误职位' if broken=='identity' and ident=='2' else '职位'+ident
            text='' if broken=='blank' and ident=='2' else '岗位职责'+ident
            request.fulfill(content_type='text/html; charset=utf-8',body=f'<html><head><title>{title}</title></head><body><h1>{name}</h1><div id="description">{text}</div><div id="requirements">任职要求{ident}</div></body></html>')
        self.context.route('**/test-details/*',route)
        port=self.server.server_port
        origin=f'http://localhost:{port}'
        def read_remote(payload):
            detail.goto(payload['link'])
            detail.add_script_tag(path=str(ROOT/'extension/detail-reader.js'))
            return detail.evaluate('opts=>VisualDetail.read(opts)',{'fields':[f for f in payload['config']['fields'] if f['scope']=='detail'],'detail':payload['config']['detail'],'expected':payload['data']['name'],'timeout':1200,'url':payload['link']})
        self.read_remote=read_remote
        self.page.evaluate("""origin=>{
          const host=document.createElement('div');host.id='remote-records';
          host.innerHTML=[1,2,3].map(n=>`<div class="remote-record"><a class="title" href="${origin}/test-details/${n}">职位${n}</a><span class="salary">${n+7}K</span></div>`).join('');
          document.body.prepend(host);
          const c=VisualStudio.defaults();c.name='跨页测试';c.match.origin=location.origin;c.listSelector='#remote-records .remote-record';
          c.fields=[{id:'name',name:'职位名称',scope:'list',type:'text',selector:'.title'},{id:'url',name:'职位链接',scope:'list',type:'href',selector:'.title'},{id:'salary',name:'薪资',scope:'list',type:'text',selector:'.salary'},{id:'description',name:'岗位职责',scope:'detail',type:'text',selector:'#description'},{id:'requirements',name:'任职要求',scope:'detail',type:'text',selector:'#requirements'}];
          c.detail={mode:'page',origin,linkField:'url',identityField:'name',identitySelector:'h1',identityType:'text'};
          c.options={count:3,delay:500,timeout:1200,maxPages:1,dropEmpty:true};
          window.remoteConfig=c;window.remoteEngine=VisualEngine.create({detailReader:async payload=>{const r=await new Promise(resolve=>{window.remotePending={payload,resolve};});if(!r.ok){const e=new Error(r.error);e.needsUser=!!r.needsUser;throw e;}return r.data;}});
        }""",origin)
        return detail

    def run_remote(self):
        self.page.evaluate('remoteEngine.start(remoteConfig)')
        for _ in range(100):
            payload=self.page.evaluate('window.remotePending?.payload || null')
            if payload:
                reply=self.read_remote(payload)
                self.page.evaluate('reply=>{const p=window.remotePending;window.remotePending=null;p.resolve(reply);}',reply)
            self.page.clock.fast_forward(600)
            if not self.page.evaluate('remoteEngine.snapshot().running'):
                return
        self.fail('跨页任务未结束')

    def test_cross_origin_detail_pages_merge_distinct_rows_and_export(self):
        detail=self.page_detail_engine()
        self.run_remote()
        state=self.page.evaluate('remoteEngine.snapshot()')
        self.assertEqual(state['status'],'done')
        self.assertEqual([r['description'] for r in state['records']],['岗位职责1','岗位职责2','岗位职责3'])
        self.assertEqual([r['requirements'] for r in state['records']],['任职要求1','任职要求2','任职要求3'])
        self.assertNotEqual(state['records'][0]['_source'].split('/')[2],state['records'][0]['_detailUrl'].split('/')[2])
        data=self.page.evaluate('Array.from(VisualXlsx.createWorkbook(remoteEngine.snapshot().records,remoteConfig.fields))')
        wb=load_workbook(io.BytesIO(bytes(data)));rows=list(wb.active.values)
        self.assertIn('详情页面',rows[0]);self.assertEqual(rows[2][0],'职位2');self.assertIn('岗位职责2',rows[2]);wb.close();detail.close()

    def test_wrong_detail_identity_pauses_and_preserves_previous_row(self):
        detail=self.page_detail_engine('identity')
        self.run_remote()
        state=self.page.evaluate('remoteEngine.snapshot()')
        self.assertEqual(state['status'],'paused');self.assertEqual(len(state['records']),1)
        self.assertIn('标识不匹配',state['message']);detail.close()

    def test_detail_login_pauses_with_previous_data_and_resume_flag(self):
        detail=self.page_detail_engine('login')
        self.run_remote()
        state=self.page.evaluate('remoteEngine.snapshot()')
        self.assertEqual(state['status'],'paused');self.assertTrue(state['needsUser']);self.assertEqual(len(state['records']),1);detail.close()

    def test_blank_detail_field_is_not_silently_saved(self):
        detail=self.page_detail_engine('blank')
        self.run_remote()
        state=self.page.evaluate('remoteEngine.snapshot()')
        self.assertEqual(state['status'],'paused');self.assertEqual(len(state['records']),1);detail.close()

    def test_title_url_capture_supports_js_and_restores_window_open(self):
        self.page.add_script_tag(path=str(ROOT/'extension/detail-reader.js'))
        result=self.page.evaluate("""async()=>{
          const el=document.createElement('div');el.id='capture-test';el.innerHTML='<span class="title">职位标题</span>';document.body.prepend(el);
          el.querySelector('.title').onclick=()=>window.open('https://jobs.example/detail/7','_blank');
          const original=window.open;const result=await VisualDetail.capture({rowSelector:'#capture-test',clickSelector:'.title'});
          return {...result,restored:window.open===original};
        }""")
        self.assertEqual(result['url'],'https://jobs.example/detail/7');self.assertTrue(result['restored'])

    def test_page_detail_mode_form_roundtrip_and_validation(self):
        self.page.evaluate("""()=>{const c=VisualDemo.example();c.detail={mode:'page',origin:'https://jobs.example',linkField:'url',clickSelector:'.open-detail',identityField:'name',identitySelector:'h1'};VisualDemo.studio.loadConfig(c);}""")
        self.assertEqual(self.page.locator('#detail-mode').input_value(),'page');self.assertTrue(self.page.locator('#connect-detail').is_visible())
        c=self.page.evaluate('VisualDemo.studio.getConfig()');self.assertEqual(c['detail']['origin'],'https://jobs.example');self.assertEqual(c['detail']['mode'],'page')
        error=self.page.evaluate("""()=>{try{const c=VisualDemo.studio.getConfig();c.detail.origin='javascript:bad';VisualEngine.validate(c);return '';}catch(e){return e.message;}}""")
        self.assertIn('无效',error)


    def test_detail_reader_rejects_different_query_even_on_same_path(self):
        detail=self.context.new_page()
        detail.goto(self.demo_url)
        detail.add_script_tag(path=str(ROOT/'extension/detail-reader.js'))
        result=detail.evaluate("opts=>VisualDetail.read(opts)",{'fields':[],'detail':{},'timeout':1000,'url':self.demo_url+'?job=other'})
        self.assertFalse(result['ok']);self.assertIn('不同页面',result['error']);detail.close()

    def test_incomplete_page_detail_draft_survives_ui_recreation(self):
        self.page.evaluate("""async()=>{
          const el=document.createElement('main');el.id='draft-area';document.body.append(el);
          const c=VisualDemo.example();c.detail={...c.detail,mode:'page',origin:'https://jobs.example',linkField:'url'};
          window.savedDraft=c;
          window.draftStudio=VisualStudio.create({element:el,api:async action=>action==='context'?{title:'列表',url:location.href}:{records:[],status:'idle',running:false,message:'',config:null},storage:{get:async()=>({}),set:async()=>{},getDraft:async()=>savedDraft,setDraft:async c=>{savedDraft=c;}}});
          await draftStudio.ready;
        }""")
        self.assertEqual(self.page.locator('#draft-area #detail-mode').input_value(),'page')
        self.page.locator('#draft-area #name').fill('尚未配置完成的模板')
        self.page.locator('#draft-area #add').click()
        self.page.clock.fast_forward(300)
        self.assertEqual(self.page.evaluate('savedDraft.name'),'尚未配置完成的模板')
        self.assertEqual(self.page.evaluate('savedDraft.fields.at(-1).selector'),'')
        self.page.evaluate("draftStudio.dispose();document.querySelector('#draft-area').remove()")


    def test_detail_title_picker_infers_missing_list_and_saves_relative_entry(self):
        config=self.nested_jobs();config['listSelector']=''
        config['fields'].append({'id':'description','name':'详情','scope':'detail','type':'text','selector':'#detail-body'})
        config['detail']={'mode':'page','origin':'https://jobs.example'}
        self.page.evaluate('c=>VisualDemo.studio.loadConfig(c)',config)
        self.page.locator('#pick-click').click()
        title=self.page.locator('#demo-page .jname').nth(1);title.hover();title.click()
        self.page.wait_for_function("document.querySelector('#notice').textContent.includes('已锁定职位标题')")
        self.assertEqual(self.page.locator('[data-vpc-ui]').count(),0)
        self.assertIn('自动识别 3 条',self.page.locator('#list-summary').inner_text())
        values=self.page.evaluate("""()=>{const c=VisualDemo.studio.getConfig();return [...document.querySelectorAll(c.listSelector)].map(row=>row.querySelector(c.detail.clickSelector).innerText);}""")
        self.assertEqual(values,['运营支持一','运营支持二','运营支持三'])

    def test_list_picker_prerequisites_fail_before_overlay_with_clear_guidance(self):
        for kind,selector in [('field-list',''),('detail-click','['),('detail-click','.no-such-list')]:
            error=self.page.evaluate("""opts=>{try{VisualDemo.engine.pick(opts);return '';}catch(e){return e.message;}}""",{'kind':kind,'listSelector':selector})
            self.assertIn('第1步',error)
            self.assertEqual(self.page.locator('[data-vpc-ui]').count(),0)

    def test_detail_picker_does_not_infer_one_title_as_a_list(self):
        self.page.evaluate("document.querySelector('#demo-page').innerHTML='<div id=single><span id=only-title>一个职位</span></div>'")
        self.page.evaluate("()=>{window.pickFailure='';VisualDemo.engine.pick({kind:'detail-click',listSelector:''}).catch(e=>window.pickFailure=e.message);}")
        title=self.page.locator('#only-title');title.hover();title.click()
        self.assertIn('第1步',self.page.locator('[data-vpc-ui=tip]').inner_text())
        self.page.keyboard.press('Escape')
        self.assertEqual(self.page.locator('[data-vpc-ui]').count(),0)
        self.assertIn('取消',self.page.evaluate('pickFailure'))


if __name__=='__main__':
    unittest.main()
