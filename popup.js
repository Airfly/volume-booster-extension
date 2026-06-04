/* ===================================================
 * Volume Booster — Popup Script
 * 用户界面逻辑：滑块、预设按钮、数据持久化
 * =================================================== */
(function () {
  'use strict';

  const slider = document.getElementById('gainSlider');
  const gainValueSpan = document.getElementById('gainValue');
  const presetButtons = document.querySelectorAll('.presets button');

  // --- 国际化：设置本地化文本 ---
  document.getElementById('popupTitle').textContent = chrome.i18n.getMessage('popupTitle');
  document.getElementById('popupSubtitle').textContent = chrome.i18n.getMessage('popupSubtitle');
  document.getElementById('popupHint').textContent = chrome.i18n.getMessage('popupHint');

  let activeTabId = null;

  // --- 向 content script 发送增益值 ---
  function sendGain(value) {
    const clamped = Math.max(100, Math.min(500, value));
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs.length) return;
      const tab = tabs[0];
      if (!tab.id) return;
      activeTabId = tab.id;
      chrome.tabs.sendMessage(tab.id, { type: 'SET_GAIN', value: clamped / 100 }, () => {
        // 忽略错误（页面可能不支持 content script）
        void chrome.runtime.lastError;
      });
    });
    // 保存到 storage
    chrome.storage.sync.set({ gain: clamped / 100 });
  }

  // --- 更新 UI ---
  function updateUI(value) {
    gainValueSpan.textContent = value;
    slider.value = value;

    // 高亮当前预设按钮
    presetButtons.forEach((btn) => {
      const v = parseInt(btn.dataset.value, 10);
      btn.classList.toggle('active', v === value);
    });

    // 滑块渐变色跟随
    const pct = (value - 100) / 400;
    const r = 0 + Math.round(pct * 0);
    const g = Math.round(0x55 + pct * (0xd2 - 0x55));
    const b = Math.round(0x77 + pct * (0xff - 0x77));
    slider.style.background = `linear-gradient(to right, #005577, rgb(${r},${g},${b}))`;
  }

  // --- 滑块拖动 ---
  slider.addEventListener('input', () => {
    const value = parseInt(slider.value, 10);
    updateUI(value);
    sendGain(value);
  });

  // --- 预设按钮点击 ---
  presetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const value = parseInt(btn.dataset.value, 10);
      updateUI(value);
      sendGain(value);
    });
  });

  // --- 打开 popup 时读取已保存的增益值 ---
  chrome.storage.sync.get({ gain: 1.0 }, (data) => {
    const pct = Math.round(data.gain * 100);
    const clamped = Math.max(100, Math.min(500, pct));
    updateUI(clamped);
    // 通知当前页面
    sendGain(clamped);
  });

})();
