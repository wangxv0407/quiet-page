'use strict';
const { spawn } = require('child_process');

// 从 WorkBuddy / VS Code 等 Electron 宿主的集成终端启动时，子进程会继承
// ELECTRON_RUN_AS_NODE=1，导致 electron.exe 退化成普通 Node，
// require('electron').app 变成 undefined 并在 index.js 顶部崩溃。
// 这里在拉起真正的 electron 前清掉该变量，保证 npm start 在任何终端都能用。
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const args = ['.'].concat(process.argv.slice(2));
const child = spawn(require('electron'), args, { stdio: 'inherit', env });
child.on('error', (e) => {
  console.error('[quiet-page] 无法启动 Electron：', e.message);
  process.exit(1);
});
child.on('exit', (code) => process.exit(code === null ? 1 : code));
