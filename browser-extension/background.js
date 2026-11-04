"use strict";
const ACTION_TITLE = "按已保存的数量采集并导出Excel（右键→选项可设置）";

chrome.action.onClicked.addListener(async tab => {
  try {
    if (!tab?.id || !/^https:\/\/(?:[\w-]+\.)*zhipin\.com\/web\/geek\/jobs(?:[/?#]|$)/.test(tab.url || "")) {
      throw new Error("请先切换到已登录的BOSS职位搜索结果页，再点击BOSS图标。");
    }
    await chrome.action.setBadgeText({tabId: tab.id, text: ""});
    await chrome.action.setTitle({tabId: tab.id, title: ACTION_TITLE});
    await chrome.scripting.executeScript({target: {tabId: tab.id}, files: ["xlsx.js", "collector.js"]});
    const stored = await chrome.storage.local.get('boss-export-settings-v1');
    const count = stored['boss-export-settings-v1']?.count ?? 30;
    const result = await chrome.tabs.sendMessage(tab.id, {action: "start", count, reveal: true});
    if (!result?.ok) throw new Error(result?.error || "启动未成功，请刷新BOSS页面后重试。");
  } catch (error) {
    if (tab?.id) {
      await chrome.action.setBadgeBackgroundColor({tabId: tab.id, color: "#b42318"});
      await chrome.action.setBadgeText({tabId: tab.id, text: "!"});
      await chrome.action.setTitle({tabId: tab.id, title: error.message});
      // 在普通网页中显示可读提示；浏览器内部页面只显示图标提示。
      if (/^https?:/.test(tab.url || "")) {
        await chrome.scripting.executeScript({target: {tabId: tab.id}, func: message => alert(message), args: [error.message]}).catch(() => {});
      }
    }
  }
});
