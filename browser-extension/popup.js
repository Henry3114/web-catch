"use strict";
const status = document.querySelector("#status");

async function send(action, extra = {}) {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  if (!tab?.url || !/^https:\/\/(?:[\w-]+\.)*zhipin\.com\/web\/geek\/jobs(?:[/?#]|$)/.test(tab.url)) {
    throw new Error("请先切换到 BOSS 的职位搜索结果页，再点击扩展图标。");
  }
  // 新安装后无需用户手动刷新已登录的搜索页。
  await chrome.scripting.executeScript({target: {tabId: tab.id}, files: ["xlsx.js", "collector.js"]});
  const response = await chrome.tabs.sendMessage(tab.id, {action, ...extra});
  if (!response?.ok) throw new Error(response?.error || "未连接到搜索页，请刷新后重试。");
  return response;
}

function show(result) {
  status.textContent = `已保存 ${result.count} 条。${result.message || ""}`;
}

for (const action of ["start", "stop", "export", "clear"]) {
  document.querySelector(`#${action}`).addEventListener("click", async () => {
    try {
      if (action === "clear" && !confirm("清空本机已保存的职位记录？建议先导出 Excel。")) return;
      const count = Number(document.querySelector("#count").value);
      if (!Number.isSafeInteger(count) || count < 1 || count > 1048575) throw new Error("数量请填写1至1048575的整数。");
      show(await send(action, {count}));
    } catch (error) {
      status.textContent = error.message;
    }
  });
}
send("status").then(show).catch(error => {status.textContent = error.message;});
