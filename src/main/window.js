'use strict';
const { BrowserWindow } = require('electron');
const path = require('path');
const { readStore, writeStore } = require('./store');

let win = null;
let stowed = false;

function createWindow(cfg = {}) {
  const { width = 980, height = 590, x, y, alwaysOnTop = true } = cfg;

  win = new BrowserWindow({
    width,
    height,
    ...(Number.isFinite(x) && Number.isFinite(y) ? { x, y } : {}),
    frame: false,
    // 窗口级透明只提供「可透」能力；背景 alpha 由 renderer 的 surface 层控制，
    // 文字层保持全不透明。切勿对窗口整体设 opacity，否则正文对比度同步下降。
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop,
    hasShadow: false,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  if (process.argv.includes('--dev')) win.webContents.openDevTools({ mode: 'detach' });

  const persistBounds = () => {
    if (!win || win.isDestroyed()) return;
    const b = win.getBounds();
    const s = readStore();
    s.config = { ...(s.config || {}), x: b.x, y: b.y, width: b.width, height: b.height };
    writeStore(s);
  };
  win.on('moved', persistBounds);
  win.on('resized', persistBounds);
  win.on('closed', () => { win = null; });

  return win;
}

function getWindow() { return win; }

function toggleStow(force) {
  if (!win || win.isDestroyed()) return stowed;
  stowed = typeof force === 'boolean' ? force : !stowed;
  if (stowed) win.hide();
  else { win.show(); win.focus(); }
  win.webContents.send('window:stow-changed', stowed);
  return stowed;
}

function setAlwaysOnTop(on) {
  if (win && !win.isDestroyed()) win.setAlwaysOnTop(!!on);
}

module.exports = { createWindow, getWindow, toggleStow, setAlwaysOnTop };
