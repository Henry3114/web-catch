"use strict";
(() => {
  if (globalThis.VisualLocator) return;
  const visible = el => el instanceof Element && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[data-vpc-ui]');
  const classes = el => [...el.classList].filter(c => /^[a-zA-Z_][\w-]*$/.test(c) && !/^(active|selected|current|hover|is-active|is-selected)$/.test(c)).slice(0,3);
  const simple = el => el.tagName.toLowerCase() + classes(el).map(c => '.'+CSS.escape(c)).join('');
  const unitClass = name => name!=='row' && /(?:^|[-_])(item|card|record|result|row)(?:[-_](wrapper|wrap|box))?$/i.test(name);
  function family(el, root = document) {
    const candidates=[...classes(el).filter(unitClass),...classes(el).filter(c=>!unitClass(c))].map(c=>el.tagName.toLowerCase()+'.'+CSS.escape(c));
    if(el.matches('tr,li,article,[role="listitem"]'))candidates.push(el.tagName.toLowerCase());
    for(const selector of candidates) {
      const matched=[...root.querySelectorAll(selector)].filter(visible);
      if(matched.length<2)continue;
      // 重复的嵌套包装不作为多条记录。
      const outer=matched.filter(item=>!matched.some(other=>other!==item && other.contains(item)));
      if(outer.includes(el) && outer.length>=2)return {selector,items:outer};
    }
    return null;
  }
  function unique(el, root = document) {
    if (!(el instanceof Element) || (root !== document && !root.contains(el))) throw new Error('请选择当前网页中的元素。');
    if (el === root) return ':scope';
    if (el.id && !/\d{5}|[a-f0-9]{10}/i.test(el.id)) {
      const id = '#'+CSS.escape(el.id);
      if (root.querySelectorAll(id).length === 1) return id;
    }
    const testId = el.getAttribute('data-testid');
    if (testId) {
      const selector = `[data-testid="${CSS.escape(testId)}"]`;
      if (root.querySelectorAll(selector).length === 1) return selector;
    }
    let path = simple(el), current = el;
    if (root.querySelectorAll(path).length === 1) return path;
    while (current.parentElement && current !== root) {
      const parent = current.parentElement;
      const siblings = [...parent.children].filter(x => x.tagName === current.tagName);
      const segment = simple(current) + (siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(current)+1})` : '');
      path = current === el ? segment : segment + ' > ' + path;
      if (parent === root) return ':scope > ' + path;
      if(parent.id && !/\d{5}|[a-f0-9]{10}/i.test(parent.id)) {
        const id='#'+CSS.escape(parent.id);
        if(root.querySelectorAll(id).length===1)return id+' > '+path;
      }
      if (root.querySelectorAll(path).length === 1) return path;
      current = parent;
    }
    return path;
  }
  function listSelector(el, root = document) {
    if (!el.parentElement || el === root) throw new Error('请选择列表中的一整条记录，而不是整个页面。');
    const repeated=family(el,root);
    if(repeated) {
      for(let parent=el.parentElement;parent;parent=parent.parentElement) {
        const inParent=repeated.items.filter(item=>parent.contains(item));
        if(inParent.length>=2) {
          const selector=parent===root?repeated.selector:unique(parent,root)+' '+repeated.selector;
          return {selector,count:[...root.querySelectorAll(selector)].filter(visible).length};
        }
        if(parent===root || parent===document.documentElement)break;
      }
    }
    const selector = unique(el.parentElement, root) + ' > ' + simple(el);
    return {selector, count: [...root.querySelectorAll(selector)].filter(visible).length};
  }
  function probableItem(el, root = document) {
    // 优先识别“条目/卡片”级重复结构，不把左右栏或列表包装层当成记录。
    for(let current=el;current && current!==root && current!==document.body;current=current.parentElement) {
      if(current.matches('div,article,li,tr,section,[role="listitem"]') && classes(current).some(unitClass) && family(current,root) && current.getBoundingClientRect().height>=35)return current;
    }
    const semantic=el.closest('tr,li,article,[role="listitem"]');
    if(semantic && semantic!==root && (root===document || root.contains(semantic)))return semantic;
    for (let current = el; current && current !== root && current !== document.body; current = current.parentElement) {
      if (current.matches('tr,li,article,[role="listitem"]')) return current;
      const siblings = current.parentElement ? [...current.parentElement.children] : [];
      if (siblings.filter(s => s.matches(simple(current))).length >= 2 && current.children.length >= 2) return current;
    }
    return el;
  }
  function nestedRecords(container) {
    const units=[...container.querySelectorAll('tr,article,li,div[class],section[class],[role="listitem"]')]
      .filter(el=>visible(el) && el.getBoundingClientRect().height>=35 && (el.matches('tr,article,[role="listitem"]') || classes(el).some(unitClass)));
    return units.filter(el=>!units.some(parent=>parent!==el && parent.contains(el))).length;
  }
  globalThis.VisualLocator = {visible, unique, listSelector, probableItem, nestedRecords};
})();
