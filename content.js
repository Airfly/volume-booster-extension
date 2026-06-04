/* ===================================================
 * Volume Booster — Content Script
 * 使用 Web Audio API GainNode 放大音频
 * =================================================== */

(function () {
  'use strict';

  // --- 状态 ---
  let gainValue = 1.0;             // 当前增益倍数 (1.0 = 100%)
  const gainNodes = new WeakMap(); // MediaElement → GainNode
  let audioCtx = null;

  // --- 获取 / 创建 AudioContext（需要用户交互后才解锁） ---
  function getAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // --- 为单个 media 元素挂载增益节点 ---
  function attachGain(media) {
    // 跳过已处理过的、没有 src 或不是 audio/video 的元素
    if (gainNodes.has(media)) return;
    if (!(media instanceof HTMLMediaElement)) return;
    // 跳过短音频片段（如 notification 音效）以免不必要的开销
    if (media.duration !== undefined && media.duration > 0 && media.duration < 0.3) return;

    try {
      const ctx = getAudioContext();
      const source = ctx.createMediaElementSource(media);
      const gain = ctx.createGain();
      gain.gain.value = gainValue;
      source.connect(gain);
      gain.connect(ctx.destination);
      gainNodes.set(media, gain);

      // 如果媒体已经在播放，确保 AudioContext 是 running 状态
      if (!media.paused) {
        ctx.resume();
      }
    } catch (e) {
      // createMediaElementSource 对同一元素只能调用一次,
      // 出现异常说明已被其它脚本接管，跳过即可
    }
  }

  // --- 更新所有已挂载元素的增益值 ---
  function updateAllGains(value) {
    gainValue = value;
    if (gainNodes.size === 0) return;
    for (const [media, gain] of gainNodes.entries()) {
      try {
        gain.gain.value = value;
      } catch (_) {
        // 元素可能已被移除
      }
    }
  }

  // --- 扫描并处理所有现有的 media 元素 ---
  function scanMediaElements() {
    const medias = document.querySelectorAll('audio, video');
    medias.forEach(attachGain);
  }

  // --- MutationObserver：监听动态添加的 media 元素 ---
  const observer = new MutationObserver((mutations) => {
    let needsScan = false;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLMediaElement ||
              (node instanceof Element && node.querySelector('audio, video'))) {
            needsScan = true;
            break;
          }
        }
      }
      if (needsScan) break;
    }
    if (needsScan) scanMediaElements();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // --- 监听来自 popup / background 的消息 ---
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SET_GAIN') {
      updateAllGains(message.value);
      sendResponse({ ok: true, value: message.value });
    } else if (message.type === 'GET_GAIN') {
      sendResponse({ value: gainValue });
    }
    return true;
  });

  // --- 初始化：从 storage 读取保存的增益值，然后挂载 ---
  chrome.storage.sync.get({ gain: 1.0 }, (data) => {
    gainValue = data.gain;
    scanMediaElements();
  });

  // --- 页面完全加载后再扫一次（处理延迟加载的媒体） ---
  if (document.readyState === 'complete') {
    scanMediaElements();
  } else {
    window.addEventListener('load', scanMediaElements);
  }

  // --- 用户点击页面时确保 AudioContext 被唤醒（iOS / 新版 Chrome 策略） ---
  document.addEventListener('pointerdown', () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }, { once: false });

  console.log(chrome.i18n.getMessage('logLoaded', [(gainValue * 100).toFixed(0)]));
})();
