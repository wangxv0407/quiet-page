'use strict';
const { globalShortcut } = require('electron');
const { readStore } = require('./store');

let active = null;

// Electron accelerator 的键名与原型设计的 Alt+\ 不一定一致，
// 因此按候选顺序尝试注册，任一成功即锁定；全部失败由托盘菜单兜底，不让应用崩溃。
function registerShortcuts(handler) {
  const cfg = readStore().config || {};
  const candidates = [cfg.hotkey, 'Alt+Backslash', 'CommandOrControl+Alt+H'].filter(Boolean);
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
