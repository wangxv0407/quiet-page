'use strict';
const { globalShortcut } = require('electron');
const { readStore } = require('./store');

let active = null;

// 实测（Electron 45 / Windows）：字面量 'Alt+\\' 合法；'Alt+Backslash'、
// 'Alt+Oem5'、'Alt+Grave' 都不是合法 accelerator token，会抛错并刷 WARNING。
// 仍按候选顺序尝试，任一成功即锁定；全部失败由托盘菜单兜底，不让应用崩溃。
function registerShortcuts(handler) {
  const cfg = readStore().config || {};
  const candidates = [cfg.hotkey, 'Alt+\\', 'CommandOrControl+Alt+H'].filter(Boolean);
  for (const key of candidates) {
    try {
      if (globalShortcut.register(key, handler)) {
        active = key;
        console.info('[quiet-page] 热键已注册：', key);
        return key;
      }
    } catch (_) {
      // 非法或已被占用的 accelerator：尝试下一个
    }
  }
  console.warn('[quiet-page] 无可用热键，请通过托盘菜单收起/恢复');
  return null;
}

function unregisterShortcuts() {
  globalShortcut.unregisterAll();
  active = null;
}

module.exports = { registerShortcuts, unregisterShortcuts };
