from pathlib import Path
import json,unittest,shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class FixedTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.p=sync_playwright().start();cls.browser=cls.p.chromium.launch(headless=True,executable_path=shutil.which('chromium'))
 @classmethod
 def tearDownClass(cls):cls.browser.close();cls.p.stop()
 def setUp(self):
  if not Path('/tmp/fixed51-samples/finance.html').exists():self.skipTest('用户真实网页快照仅留本地，不随仓库发布')
  self.context=self.browser.new_context();self.context.route('**/*',lambda r:r.abort());self.page=self.context.new_page()
 def tearDown(self):self.context.close()
 def load(self,name):
  self.page.set_content((Path('/tmp/fixed51-samples')/name).read_text());self.page.add_script_tag(path=str(ROOT/'extension/site51.js'))
 def test_real_finance_detail(self):
  self.load('finance.html');r=self.page.evaluate("Site51.detail({expected:'金融客服专员',url:'https://jobs.51job.com/guangzhou/174119496.html'})")
  self.assertTrue(r['ok']);d=r['data'];self.assertEqual(d['salary'],'9千-1.2万');self.assertEqual(d['company'],'前锦网络信息技术（上海）有限公司');self.assertEqual(d['nature'],'已上市');self.assertEqual(d['scale'],'5000-10000人');self.assertEqual(d['industry'],'人力资源服务');self.assertIn('保利国际广场',d['location']);self.assertIn('通过电话',d['duties']);self.assertNotIn('本科及以上学历',d['duties']);self.assertIn('本科及以上学历',d['requirements']);self.assertNotIn('职能类别',d['requirements']);self.assertEqual(d['issue'],'')
 def test_real_service_detail(self):
  self.load('service.html');r=self.page.evaluate("Site51.detail({expected:'客户服务岗（不涉及主动营销）'})")
  self.assertTrue(r['ok']);self.assertNotIn('广发基金管理有限公司',r['data']['duties']);self.assertIn('本科及以上学历',r['data']['requirements']);self.assertEqual(r['data']['issue'],'')
 def test_real_list(self):
  self.load('list.html');rows=self.page.evaluate('Site51.list()');self.assertGreaterEqual(len(rows),20);self.assertEqual(rows[0]['name'],'金融客服专员');self.assertEqual(rows[1]['name'],'客户服务岗（不涉及主动营销）');self.assertEqual(rows[0]['company'],'前锦网络信息技术（上海）有限公司');self.assertEqual(rows[0]['salary'],'9千-1.2万');self.assertEqual(len(set(r['key'] for r in rows)),len(rows))
 def test_no_wrong_job(self):
  self.load('finance.html');r=self.page.evaluate("Site51.detail({expected:'其它职位'})");self.assertFalse(r['ok']);self.assertNotIn('data',r)
 def test_missing_section_keeps_raw_and_issue(self):
  self.load('finance.html');self.page.evaluate("document.querySelector('.job_msg>div').innerText='岗位职责：\\n分析客户服务数据并制作报告。'");r=self.page.evaluate('Site51.detail()');self.assertTrue(r['ok']);self.assertEqual(r['data']['requirements'],'');self.assertIn('任职资格',r['data']['issue']);self.assertIn('分析客户',r['data']['raw'])
 def test_changed_layout_does_not_count_success(self):
  self.load('finance.html');self.page.evaluate("document.querySelector('.job_msg').remove()");self.assertFalse(self.page.evaluate('Site51.detail().ok'))
if __name__=='__main__':unittest.main()
