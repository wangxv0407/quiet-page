'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// 白名单 API：renderer 拿不到 ipcRenderer、fs、shell，也拿不到任意 IPC 通道
contextBridge.exposeInMainWorld('deskfolio', {
  getState: () => ipcRenderer.invoke('state:get'),
  setState: (patch) => ipcRenderer.invoke('state:set', patch),
  openOfficial: (url) => ipcRenderer.invoke('open:official', url),
  importFiles: () => ipcRenderer.invoke('dialog:import'),
  readText: (path) => ipcRenderer.invoke('file:read-text', path),
  syncShelf: () => ipcRenderer.invoke('weread:shelf'),
  stow: () => ipcRenderer.invoke('window:stow'),
  setPin: (on) => ipcRenderer.invoke('window:pin', on),
  onStowChanged: (cb) => {
    const listener = (_e, value) => cb(value);
    ipcRenderer.on('window:stow-changed', listener);
    return () => ipcRenderer.removeListener('window:stow-changed', listener);
  }
});
