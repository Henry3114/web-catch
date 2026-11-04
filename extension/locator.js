"use strict";
(() => {
  if (globalThis.VisualLocator) return;
  const visible = el => el instanceof Element && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[data-vpc-ui]');
  const classes = el => [...el.classList].filter(c => /^[a-zA-Z_][\w-]*$/.test(c) && !/^(active|selected|current|hover|is-active|is-selected)$/.test(c)).slice(0,3);
  const simple = el => el.tagName.toLowerCase() + classes(el).map(c => '.'+CSS.escape(c)).join('');
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
    const selector = unique(el.parentElement, root) + ' > ' + simple(el);
    return {selector, count: [...root.querySelectorAll(selector)].filter(visible).length};
  }
  function probableItem(el, root = document) {
    const semantic=el.closest('tr,li,article,[role="listitem"]');
    if(semantic && semantic!==root && (root===document || root.contains(semantic)))return semantic;
    for (let current = el; current && current !== root && current !== document.body; current = current.parentElement) {
      if (current.matches('tr,li,article,[role="listitem"]')) return current;
      const siblings = current.parentElement ? [...current.parentElement.children] : [];
      if (siblings.filter(s => s.matches(simple(current))).length >= 2 && current.children.length >= 2) return current;
    }
    return el;
  }
  globalThis.VisualLocator = {visible, unique, listSelector, probableItem};
})();
