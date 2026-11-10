'use strict';
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// 只存配置、书目与本地阅读进度；API Key 不写这里（见 README）
const DEFAULT = { config: {}, books: [], progress: {} };

function file() {
  return path.join(app.getPath('userData'), 'quiet-page.json');
}

function readStore() {
  try {
    return { ...DEFAULT, ...JSON.parse(fs.readFileSync(file(), 'utf8')) };
  } catch (_) {
    return { ...DEFAULT };
  }
}

function writeStore(data) {
  const target = file();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = target + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, target); // 原子替换，避免写入中断损坏进度
}

module.exports = { readStore, writeStore, DEFAULT };
