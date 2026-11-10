'use strict';
const { app, ipcMain, shell, Tray, Menu, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { createWindow, getWindow, toggleStow, setAlwaysOnTop } = require('./window');
const { registerShortcuts, unregisterShortcuts } = require('./shortcuts');
const { readStore, writeStore } = require('./store');
const { syncShelf } = require('./weread');

const OFFICIAL_URL = 'https://weread.qq.com/';
let tray = null;
// 只允许读取经由文件对话框导入的路径，避免 renderer 侧任意文件读取
const allowedPaths = new Set();

// 单实例锁：避免多开导致全局热键被重复注册
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const w = getWindow();
    if (w) { w.show(); w.focus(); }
  });

  app.whenReady().then(() => {
    createWindow(readStore().config || {});
    const hotkey = registerShortcuts(() => toggleStow());
    if (!hotkey) console.warn('[quiet-page] 全局热键注册失败，请使用托盘菜单收起/恢复');
    createTray();
    registerIpc();
  });

  // 托盘常驻；若托盘创建失败（例如无图标资源），关窗即退出
  app.on('window-all-closed', () => { if (!tray) app.quit(); });
  app.on('will-quit', () => unregisterShortcuts());
}

function createTray() {
  // 正式发布前放置 resources/tray.png（16x16 / 32x32）；缺失时降级，不让应用崩溃
  const iconPath = path.join(__dirname, '..', '..', 'resources', 'tray.png');
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();
  try {
    tray = new Tray(icon);
    tray.setToolTip('静页 · 桌面阅读');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '显示 / 收起', click: () => toggleStow() },
      { label: '打开官方微信读书', click: () => shell.openExternal(OFFICIAL_URL) },
      { type: 'separator' },
      { label: '退出', click: () => { if (tray) tray.destroy(); tray = null; app.quit(); } }
    ]));
    tray.on('click', () => toggleStow());
  } catch (e) {
    console.warn('[quiet-page] 托盘创建失败：', e.message);
    tray = null;
  }
}

function registerIpc() {
  ipcMain.handle('state:get', () => readStore());

  ipcMain.handle('state:set', (_e, patch) => {
    const next = { ...readStore(), ...(patch || {}) };
    writeStore(next);
    return next;
  });

  // 白名单：renderer 只能唤起微信读书官方域名，防止被注入后打开任意外部地址
  ipcMain.handle('open:official', (_e, url) => {
    try {
      const u = new URL(url || OFFICIAL_URL);
      if (u.protocol !== 'https:' || u.hostname !== 'weread.qq.com') return false;
      shell.openExternal(u.toString());
      return true;
    } catch (_) { return false; }
  });

  ipcMain.handle('dialog:import', async () => {
    const r = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '电子书', extensions: ['txt', 'epub'] }]
    });
    if (r.canceled) return [];
    r.filePaths.forEach((p) => allowedPaths.add(p));
    return r.filePaths;
  });

  // TXT 直读；EPUB 需要 zip 解析，v0.2 接入。只读、限大小、限已导入路径。
  ipcMain.handle('file:read-text', async (_e, p) => {
    if (typeof p !== 'string' || !allowedPaths.has(p)) return { ok: false, reason: 'UNSUPPORTED' };
    try {
      const st = fs.statSync(p);
      if (st.size > 5 * 1024 * 1024) return { ok: false, reason: 'TOO_LARGE' };
      if (/\.epub$/i.test(p)) return { ok: false, reason: 'EPUB_PENDING' };
      if (!/\.txt$/i.test(p)) return { ok: false, reason: 'UNSUPPORTED' };
      let text = fs.readFileSync(p).toString('utf8');
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      // TODO(v0.2): Windows 中文 TXT 常见 GBK，需引入 iconv 做编码探测
      return { ok: true, text };
    } catch (e) {
      return { ok: false, reason: 'IO', message: String(e) };
    }
  });

  ipcMain.handle('window:pin', (_e, on) => { setAlwaysOnTop(!!on); return true; });
  ipcMain.handle('weread:shelf', () => syncShelf());
  ipcMain.handle('window:stow', () => toggleStow());
}
