"use strict";
(() => {
  if (globalThis.BossCollector) return;
  const STORE = "boss-visible-export-v1";
  const SETTINGS = 'boss-export-settings-v1';
  const TASK_PREFIX = 'boss-search-task-v1:';
  const CARD = ".job-card-wrapper, .job-card-wrap, .job-card-box, .job-list-item, .job-card, [role='listitem']";
  const TITLE = [".job-name", ".job-title", ".job-card-name", "h3", "h2"];
  const DETAIL = [".job-detail-box", ".job-detail-container", ".job-detail-wrap", ".job-detail", ".job-detail-content"];
  const norm = text => String(text || "").replace(/\s+/g, "");
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const visible = el => el instanceof Element && !el.closest("#boss-export-tool") && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  const ownText = el => el?.innerText?.trim() || "";
  const first = (root, selectors) => {
    for (const selector of selectors) {
      const el = [...root.querySelectorAll(selector)].find(e => visible(e) && ownText(e));
      if (el) return ownText(el);
    }
    return "";
  };
  let state = null, loading = null, running = false, task = null, message = "可修改目标数量后开始采集。";
  let collapsed = true, hidden = false;
  let host = null, shadow = null;
  let switching = null;
  const fresh = () => ({version: 1, search: "", records: [], keys: [], errors: [], target: 30, pending: null});
  const normalizeSearch = value => {
    const url = new URL(value, location.origin);
    for (const name of ["page", "pageNum", "pageSize", "ka", "lid"]) url.searchParams.delete(name);
    for (const [name, value] of [...url.searchParams]) if (value === '') url.searchParams.delete(name);
    url.searchParams.sort();
    return url.pathname + "?" + url.searchParams.toString();
  };
  const searchKey = () => normalizeSearch(location.href);
  const taskKey = search => TASK_PREFIX + normalizeSearch(search);
  const groupName = () => new URL(state.search || location.href, location.origin).searchParams.get('query') || '当前搜索';
  async function load() {
    if (!state) {
      if (!loading) loading = chrome.storage.local.get([STORE, SETTINGS, taskKey(searchKey())]).then(async data => {
        const legacy = data[STORE];
        if (legacy?.search) {
          legacy.search = normalizeSearch(legacy.search);
          const key = taskKey(legacy.search);
          if (!(await chrome.storage.local.get(key))[key]) await chrome.storage.local.set({[key]: legacy});
        }
        state = data[taskKey(searchKey())] || (legacy?.search === searchKey() ? legacy : fresh());
        // 老版尚未开始采集时，也保留其数量设置。
        if (!legacy?.search && legacy && !data[taskKey(searchKey())]) state.target = legacy.target || 30;
        state.search = searchKey();
        const preferred = data[SETTINGS]?.count;
        if (preferred != null) state.target = validCount(preferred);
        collapsed = data[SETTINGS]?.collapsed !== false;
      });
      await loading;
    }
    return state;
  }
  const save = () => chrome.storage.local.set({[STORE]: state, [taskKey(state.search)]: state});
  async function switchSearch() {
    if (state.search === searchKey()) return;
    if (!switching) switching = (async () => {
      // 先停止旧任务并等待其保存，防止旧描述写进新搜索。
      running = false;
      if (task) await task;
      await save();
      const key = searchKey();
      const data = await chrome.storage.local.get([taskKey(key), SETTINGS]);
      state = data[taskKey(key)] || fresh();
      state.search = key;
      state.pending = null;
      state.target = validCount(data[SETTINGS]?.count ?? state.target);
      await save();
      show(state.records.length ? `已恢复“${groupName()}”的 ${state.records.length} 条记录，可继续或导出。` : `已为“${groupName()}”新建任务，之前的搜索结果已保留。`);
    })().finally(() => {switching = null;});
    await switching;
  }

  function render() {
    if (!shadow) return;
    const saved = state?.records.length || 0, target = state?.target || 30;
    shadow.querySelector('#progress').textContent = `${groupName()}：已保存 ${saved} 条，目标 ${target} 条`;
    shadow.querySelector('#compact').textContent = `采集 ${Math.min(saved, target)}/${target} · 展开`;
    shadow.querySelector('#message').textContent = message;
    shadow.querySelector('#start').disabled = running;
    shadow.querySelector('#stop').disabled = !running;
    const input = shadow.querySelector('#count');
    if (shadow.activeElement !== input) input.value = target;
    shadow.querySelector('#panel').hidden = collapsed;
    shadow.querySelector('#compact').hidden = !collapsed;
    host.style.display = hidden ? 'none' : '';
  }
  function show(text) {message = text; render();}
  function mount() {
    if (host?.isConnected) return;
    host = document.createElement('div'); host.id = 'boss-export-tool';
    host.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483647;max-width:320px';
    shadow = host.attachShadow({mode: 'closed'});
    shadow.innerHTML = `<style>:host{all:initial}[hidden]{display:none!important}section{font:14px/1.6 system-ui,sans-serif;width:280px;background:white;color:#193a40;padding:14px;border:2px solid #008c95;border-radius:10px;box-shadow:0 4px 20px #0002}strong{font-size:16px}p{margin:6px 0;overflow-wrap:anywhere}button{font:13px system-ui;margin:4px 4px 0 0;padding:7px;border:0;border-radius:5px;cursor:pointer;background:#e9f5f4;color:#193a40}button:disabled{opacity:.5;cursor:default}#compact{background:#008c95;color:white;box-shadow:0 2px 8px #0003;padding:8px 12px;border-radius:20px}.header{display:flex;align-items:center;gap:6px}.header strong{flex:1}input{width:95px;font:inherit;padding:4px}label{font-size:13px}</style>
      <button id="compact" title="展开设置、暂停或导出"></button>
      <section id="panel"><div class="header"><strong>BOSS 职位导出 Excel</strong><button id="minimize" title="收起">—</button><button id="hide" title="隐藏窗口，采集继续；再点工具栏B图标恢复">×</button></div>
      <p id="progress"></p><label>目标数量 <input id="count" type="number" min="1" max="1048575" step="1"><button id="apply">应用</button></label>
      <p id="message" role="status"></p><button id="start">开始 / 继续</button><button id="stop">暂停</button><button id="export">导出 Excel</button><button id="clear">清空记录</button></section>`;
    document.documentElement.append(host);
    shadow.querySelector('#compact').addEventListener('click', () => {collapsed = false; render();});
    shadow.querySelector('#minimize').addEventListener('click', () => {collapsed = true; render();});
    shadow.querySelector('#hide').addEventListener('click', () => {hidden = true; render();});
    shadow.querySelector('#apply').addEventListener('click', () => {
      dispatch('configure', {count: Number(shadow.querySelector('#count').value)}).catch(error => show(error.message));
    });
    for (const action of ['start', 'stop', 'export', 'clear']) shadow.querySelector(`#${action}`).addEventListener('click', () => {
      if (action === 'clear' && !confirm('仅清空当前搜索的职位记录？其他搜索记录会保留，建议先导出当前结果。')) return;
      dispatch(action).catch(error => show(error.message));
    });
    render();
  }
  function validCount(value) {
    const count = Number(value);
    if (!Number.isSafeInteger(count) || count < 1 || count > 1048575) throw new Error('目标数量请填写1至1048575的整数。');
    return count;
  }
  async function configure(value) {
    const count = validCount(value);
    const previous = (await chrome.storage.local.get(SETTINGS))[SETTINGS] || {};
    await chrome.storage.local.set({[SETTINGS]: {...previous, count}});
    state.target = count;
    await save();
    show(`目标已设为 ${count} 条。${state.records.length > count ? '本次导出前'+count+'条，其余记录仍保留。' : ''}`);
  }

  function canonical(value) {
    try {
      const url = new URL(value, location.href);
      if (!/(^|\.)zhipin\.com$/.test(url.hostname) || !/^\/job_detail\/[\w-]+\.html$/.test(url.pathname)) return "";
      // www 与无 www 视为同一职位；不保存 URL 中可能出现的跟踪参数。
      return "https://www.zhipin.com" + url.pathname;
    } catch {return "";}
  }
  function cards() {
    let nodes = [...document.querySelectorAll(CARD)].filter(el => visible(el) && !el.closest(DETAIL.join(",")));
    // 仅在未识别到常见卡片类名时，尝试包含薪资及职位标题的列表项。
    if (!nodes.length) nodes = [...document.querySelectorAll("li")].filter(el => visible(el) && el.querySelector(".salary, .job-salary") && TITLE.some(s => el.querySelector(s)));
    // 某些版本在卡片内嵌套另一种卡片类名，保留最外层以避免重复点击。
    nodes = nodes.filter(el => !nodes.some(other => other !== el && other.contains(el)));
    const result = new Map();
    for (const node of nodes) {
      const title = first(node, TITLE);
      if (!title) continue;
      const salary = first(node, [".job-salary", ".salary"]);
      const company = first(node, [".company-name", ".company-title"]);
      const area = first(node, [".job-area", ".job-location", ".company-location"]);
      const link = [...node.querySelectorAll("a[href]")].map(a => canonical(a.href)).find(Boolean) || "";
      const dataId = node.getAttribute("data-jobid") || node.getAttribute("data-job-id") || "";
      const key = link || (dataId ? "job:" + dataId : "card:" + [title, company, salary, area].map(norm).join("|"));
      if (!result.has(key)) result.set(key, {node, key, link, title, salary, company, area,
        tags: first(node, [".job-tag-list", ".tag-list"]),
        companyTags: first(node, [".company-tag-list"]),
        companyInfo: first(node, [".company-info", ".company-box"]),
        selected: /(^|\s)(?:active|selected|current|is-active|is-selected)(?:\s|$)/.test(node.className) || node.getAttribute("aria-selected") === "true"});
    }
    return [...result.values()];
  }

  function panel() {
    let root = null;
    for (const selector of DETAIL) {
      root = [...document.querySelectorAll(selector)].find(el => visible(el) && /职位描述/.test(ownText(el)));
      if (root) break;
    }
    // 在未知布局中，从“职位描述”标题寻找右侧容器，避免把左侧列表混入详情。
    if (!root) {
      const heading = [...document.querySelectorAll("h2,h3,h4")].find(el => visible(el) && ownText(el) === "职位描述");
      for (let p = heading?.parentElement; p && p !== document.body; p = p.parentElement) {
        if (p.querySelector("h1, .job-name, .job-title") && p.getBoundingClientRect().width < innerWidth * .85 && !p.querySelector(CARD)) {root = p; break;}
      }
    }
    if (!root) return null;
    let description = first(root, [".job-sec-text", ".job-description", "[data-testid='job-description']", ".job-detail-section .text", ".job-detail-body .desc"]);
    if (!description) {
      const heading = [...root.querySelectorAll("h2,h3,h4")].find(el => ownText(el) === "职位描述");
      const parts = [];
      for (let el = heading?.nextElementSibling; el; el = el.nextElementSibling) {
        if (/^(公司介绍|公司简介|工作地址|工商信息|招聘者)$/.test(ownText(el))) break;
        if (visible(el) && ownText(el)) parts.push(ownText(el));
      }
      description = parts.join("\n\n");
    }
    return {root, description,
      title: first(root, [".name h1", ".job-name", ".job-title", "h1", "h2"]),
      salary: first(root, [".salary", ".job-salary"]),
      company: first(root, [".sider-company .company-name", ".sider-company .company-info a", ".job-detail-company .company-name", ".company-name"]),
      companyInfo: first(root, [".sider-company", ".job-detail-company", ".company-info"]),
      companyTags: [...root.querySelectorAll(".sider-company .company-info p, .company-tag-list li")].filter(visible).map(ownText).join("\n"),
      intro: [...root.querySelectorAll(".job-sec,.job-detail-section")].filter(el => visible(el) && /^(公司介绍|公司简介)/.test(ownText(el))).map(ownText).join("\n\n"),
      area: first(root, [".text-city", ".job-area"]),
      experience: first(root, [".text-experiece", ".text-experience", ".job-experience"]),
      education: first(root, [".text-degree", ".job-degree"]),
      tags: first(root, [".job-tags", ".job-keyword-list"]),
      benefits: first(root, [".job-benefits", ".welfare-list", ".tag-container"]),
      address: first(root, [".location-address", ".job-location"]),
      link: [...root.querySelectorAll("a[href]")].map(a => canonical(a.href)).find(Boolean) || "",
      text: ownText(root)};
  }
  function checkGate() {
    if (/安全验证|访问异常|访问受限/.test(document.title) || /\/passport\/.*verify/.test(location.pathname)) throw new Error("网站要求安全验证。已暂停，请手动完成验证后回到搜索页继续。");
    for (const selector of [".geetest_panel", ".verify-page", ".sign-dialog", ".login-dialog", ".sign-wrap"]) {
      if ([...document.querySelectorAll(selector)].some(visible)) throw new Error("请先在浏览器中手动完成登录或验证，再继续。");
    }
  }
  function checkRunning() {
    if (!running) throw new Error("已暂停，可继续或导出已有结果。");
    checkGate();
    if (document.visibilityState === "hidden") throw new Error("已暂停：请保持 BOSS 标签页在前台，然后点击继续。");
    if (searchKey() !== state.search) throw new Error("搜索条件已改变，原任务结果已保留。点B图标即可开始当前搜索。");
  }
  class DetailUnavailable extends Error {}
  function clickTargets(card) {
    const title = TITLE.map(s => card.node.querySelector(s)).find(el => visible(el));
    const targets = [];
    for (let el = title; el && card.node.contains(el) && targets.length < 5; el = el.parentElement) {
      if (visible(el)) targets.push(el);
      if (el === card.node) break;
    }
    const body = card.node.querySelector('.job-card-body, .job-card-left, .job-info');
    return [...new Set([...targets, body, card.node].filter(el => visible(el)))];
  }
  function selectCard(target) {
    target.scrollIntoView({block: 'center', behavior: 'instant'});
    const rect = target.getBoundingClientRect();
    const options = {bubbles: true, cancelable: true, view: window,
      clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, button: 0};
    // 只取消职位链接的默认跳转，页面原有的选择事件仍正常执行。
    // 使用标题及其祖先作为点击目标，不触碰沟通、收藏或公司链接。
    const anchor = target.closest('a[href]');
    if (anchor && canonical(anchor.href)) target.addEventListener('click', event => event.preventDefault(), {once: true});
    target.dispatchEvent(new MouseEvent('mousedown', {...options, buttons: 1}));
    target.dispatchEvent(new MouseEvent('mouseup', options));
    target.dispatchEvent(new MouseEvent('click', options));
  }
  async function readCard(card) {
    const before = panel();
    const targets = clickTargets(card);
    const deadline = Date.now() + Math.min(30000, targets.length * 6000 + 6000);
    let attempt = 0, nextClick = 0;
    let last = "", stableSince = 0;
    while (Date.now() < deadline) {
      checkRunning();
      if (Date.now() >= nextClick && attempt < targets.length) {
        const target = targets[attempt++];
        if (target.isConnected) selectCard(target);
        nextClick = Date.now() + 6000;
        if (attempt > 1) show(`正在自动重试“${card.title}”（${attempt}/${targets.length}）…`);
      }
      const detail = panel();
      if (detail?.description && norm(detail.title) === norm(card.title)) {
        const salaryMatches = !card.salary || !detail.salary || norm(card.salary) === norm(detail.salary);
        const companyMatches = !card.company || !detail.company || norm(card.company) === norm(detail.company);
        const idMatches = !card.link || !detail.link || card.link === detail.link;
        // 比较描述本身，不能因为标题先更新而接受上一条岗位的旧描述。
        const changed = !before?.description || detail.description !== before.description;
        const linked = card.link && detail.link === card.link;
        const wasCurrent = card.selected && before && norm(before.title) === norm(card.title) && (!card.company || !before.company || norm(before.company) === norm(card.company));
        const signature = [detail.title, detail.description, detail.salary, detail.company, detail.text].join("\n");
        if (salaryMatches && companyMatches && idMatches && (changed || linked || wasCurrent)) {
          if (last !== signature) {last = signature; stableSince = Date.now();}
          if (Date.now() - stableSince >= 1000) return detail;
        } else {last = ""; stableSince = 0;}
      } else {last = ""; stableSince = 0;}
      await sleep(250);
    }
    throw new DetailUnavailable(`“${card.title}”自动重试后仍未显示匹配的详情，未保存旧内容，已跳过。`);
  }
  function splitSections(text) {
    const headings = [...text.matchAll(/^[ \t]*(?:[【\[（(]\s*)?(岗位描述|岗位职责|工作职责|职位职责|工作内容|岗位要求|任职要求|任职资格|职位要求|职位描述|福利待遇)\s*(?:[】\]）)]\s*)?(?:[:：][ \t]*|[ \t]*(?=\n|$))/gm)];
    const duties = [], requirements = [];
    headings.forEach((h, i) => {
      const body = text.slice(h.index + h[0].length, headings[i + 1]?.index ?? text.length).trim();
      if (/岗位描述|岗位职责|工作职责|职位职责|工作内容/.test(h[1])) duties.push(body);
      if (/岗位要求|任职要求|任职资格|职位要求/.test(h[1])) requirements.push(body);
    });
    return [duties.join("\n\n"), requirements.join("\n\n")];
  }
  function record(card, detail) {
    const [duties, requirements] = splitSections(detail.description);
    const tags = [...new Set((card.companyTags + "\n" + detail.companyTags).split("\n").filter(Boolean))];
    const scale = tags.find(t => /\d.*人/.test(t)) || "";
    const funding = tags.find(t => /融资|上市|[A-H]轮|天使|不需要/.test(t)) || "";
    return {
      "岗位名称": detail.title, "薪资待遇": detail.salary || card.salary, "工作地点": detail.area || card.area,
      "经验要求": detail.experience, "学历要求": detail.education, "职位标签": detail.tags || card.tags,
      "公司名称": detail.company || card.company, "公司行业": tags.find(t => t !== scale && t !== funding) || "",
      "公司规模": scale, "融资阶段": funding, "公司信息": [detail.companyInfo, card.companyInfo, card.companyTags].filter(Boolean).join("\n\n"),
      "公司简介": detail.intro, "职位描述": detail.description, "岗位描述": duties, "岗位要求": requirements,
      "福利待遇": detail.benefits, "工作地址": detail.address, "详情面板全文": detail.text,
      "职位链接": card.link || detail.link, "搜索页链接": location.href,
      "采集时间": new Date(Date.now() + 8 * 3600000).toISOString().replace("Z", "+08:00")
    };
  }
  async function advance(seen) {
    for (let attempt = 0; attempt < 3; attempt++) {
      checkRunning();
      const last = cards().at(-1)?.node;
      for (let p = last?.parentElement; p && p !== document.body; p = p.parentElement) {
        if (p.scrollHeight > p.clientHeight && /auto|scroll/.test(getComputedStyle(p).overflowY)) p.scrollTop = p.scrollHeight;
      }
      last?.scrollIntoView({block: "end", behavior: "instant"});
      await sleep(1200);
      if (cards().some(c => !seen.has(c.key))) return true;
    }
    let next = [...document.querySelectorAll('a[ka="page-next"], a[rel="next"], .options-pages a.next, .options-pages button.next, button[aria-label="下一页"], a[aria-label="下一页"]')].find(visible);
    if (!next) next = [...document.querySelectorAll("a,button")].find(el => visible(el) && /^(下一页|下页|›|>)$/.test(ownText(el)));
    if (!next) next = [...document.querySelectorAll(".options-pages .ui-icon-arrow-right")].map(el => el.parentElement).find(visible);
    if (!next || next.disabled || /disabled/.test(next.className) || next.getAttribute("aria-disabled") === "true") return false;
    state.pending = {at: Date.now(), search: state.search};
    await save();
    next.click();
    const end = Date.now() + 15000;
    while (Date.now() < end) {
      checkRunning();
      if (cards().some(c => !seen.has(c.key))) {state.pending = null; await save(); return true;}
      await sleep(400);
    }
    state.pending = null;
    await save();
    return false;
  }
  function download() {
    if (!state?.records.length) throw new Error("还没有采集到职位，暂时无法导出。");
    const selected = state.records.slice(0, state.target);
    const data = BossXlsx.createWorkbook(selected, state.errors);
    const url = URL.createObjectURL(new Blob([data], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
    const anchor = document.createElement("a");
    const name = groupName().replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
    anchor.href = url; anchor.download = `BOSS_${name}_${selected.length}条_${new Date(Date.now()+8*3600000).toISOString().replace(/[:.]/g, "-").replace('Z','+0800')}.xlsx`;
    document.documentElement.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function loop() {
    const seen = new Set(state.keys);
    let consecutiveFailures = 0;
    let current = null;
    try {
      for (let batch = 0; batch < state.target + 10 && state.records.length < state.target; batch++) {
        checkRunning();
        const batchCards = cards();
        if (!batchCards.length) throw new Error("未找到左侧职位卡片。请确认搜索有结果，并手动点开第一个岗位；网站改版时需要更新扩展。");
        for (const card of batchCards) {
          checkRunning();
          if (state.records.length >= state.target) break;
          if (seen.has(card.key)) continue;
          current = card;
          show(`正在读取：${card.title}。请勿手动切换岗位。`);
          let detail;
          try {
            detail = await readCard(card);
          } catch (error) {
            if (!(error instanceof DetailUnavailable)) throw error;
            state.errors = state.errors.filter(item => item.key !== (card.link || card.key));
            state.errors.push({key: card.link || card.key, message: error.message});
            seen.add(card.key); current = null;
            await save();
            show(`${error.message} 正在自动继续下一个岗位。`);
            if (++consecutiveFailures >= 5) throw new Error('连续5个岗位无法更新详情，已停止继续请求。已有结果已保存，请导出；需要进一步适配该页面。');
            await sleep(3000);
            continue;
          }
          checkRunning();
          if (state.records.length >= state.target) break;
          consecutiveFailures = 0;
          state.errors = state.errors.filter(item => item.key !== (card.link || card.key));
          state.records.push(record(card, detail));
          state.keys.push(card.key); seen.add(card.key); current = null;
          await save(); render();
          if (state.records.length >= state.target) break;
          await sleep(3000);
        }
        if (state.records.length >= state.target) break;
        if (!await advance(seen)) break;
      }
      if (state.records.length >= state.target) {
        download();
        show(`已完成 ${Math.min(state.records.length, state.target)} 条，Excel 已开始下载。如未出现下载，请点“导出 Excel”。`);
      } else {
        show(`已保存 ${state.records.length} 条，未达到 ${state.target} 条。列表没有更多可确认的岗位或已达到翻页上限；可先导出已有结果。`);
      }
    } catch (error) {
      if (current && running) state.errors.push({key: current.link || current.key, message: error.message});
      show(error.message);
    } finally {
      running = false; state.pending = null; await save(); render();
    }
  }
  async function dispatch(action, options = {}) {
    await load(); mount();
    await switchSearch();
    if (options.reveal || action === 'reveal') {hidden = false; collapsed = true; render();}
    if (action === 'configure') await configure(options.count);
    if (action === "start") {
      if (options.count != null) await configure(options.count);
      if (running || task) return {ok: true, count: state.records.length, message: "采集正在进行。"};
      checkGate();
      if (!/\/web\/geek\/jobs/.test(location.pathname)) throw new Error("请先打开 BOSS 职位搜索结果页。");
      const target = validCount(options.count ?? state.target ?? 30);
      state.search = searchKey(); state.target = target; state.pending = null;
      await save();
      if (running || task) return {ok: true, count: state.records.length, message: '采集正在进行。', running};
      running = true; show(`正在采集“${groupName()}”，请保持当前标签页在前台。`);
      task = loop().finally(() => {task = null;});
    } else if (action === "stop") {
      running = false; state.pending = null; await save(); show("已暂停，已有结果已保存在本机。");
    } else if (action === "export") {
      download();
    } else if (action === "clear") {
      if (running || task) throw new Error("请先暂停采集，稍后再清空。");
      const target = state.target, search = state.search; state = fresh(); state.target = target; state.search = search;
      await save(); show("当前搜索的记录已清空，其他搜索结果仍保留。");
    }
    return {ok: true, count: state.records.length, message, running};
  }
  globalThis.BossCollector = {dispatch, cards, panel};
  chrome.runtime.onMessage.addListener((request, sender, respond) => {
    if (!request || !["start", "stop", "export", "clear", "status", "configure", "reveal"].includes(request.action)) return;
    dispatch(request.action, request).then(respond).catch(error => respond({ok: false, error: error.message}));
    return true;
  });
  load().then(() => {
    const pending = state.pending;
    if (pending && pending.search === searchKey() && Date.now() - pending.at < 60000) return dispatch("start", {count: state.target});
    // 普通访问不自动采集。仅有已有记录时显示可恢复提示。
    if (state.records.length) {mount(); show("已有结果保存在本机。点击继续或导出 Excel。");}
  }).catch(error => {mount(); show(error.message);});
})();
