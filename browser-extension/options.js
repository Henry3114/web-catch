"use strict";
const KEY = 'boss-export-settings-v1';
const countInput = document.querySelector('#count');
const collapsedInput = document.querySelector('#collapsed');
const feedback = document.querySelector('#status');
chrome.storage.local.get(KEY).then(data => {
  countInput.value = data[KEY]?.count ?? 30;
  collapsedInput.checked = data[KEY]?.collapsed !== false;
}).catch(error => {feedback.textContent = error.message;});
document.querySelector('#settings').addEventListener('submit', async event => {
  event.preventDefault();
  const count = Number(countInput.value);
  if (!Number.isSafeInteger(count) || count < 1 || count > 1048575) {feedback.textContent = '请输入1至1048575之间的整数。'; return;}
  try {
    const old = (await chrome.storage.local.get(KEY))[KEY] || {};
    await chrome.storage.local.set({[KEY]: {...old, count, collapsed: collapsedInput.checked}});
    feedback.textContent = `已保存：下次采集 ${count} 条。正在采集的任务可在页面小进度条中展开修改。`;
  } catch (error) {feedback.textContent = `保存失败：${error.message}`;}
});
