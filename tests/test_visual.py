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


if __name__=='__main__':
    unittest.main()
