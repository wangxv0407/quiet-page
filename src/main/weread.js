'use strict';
const fs = require('fs');
const path = require('path');

// 微信读书官方 Agent Gateway「只读」适配层。
// 官方接口地址、请求参数与 skill_version 一律以官方文档为准，本项目不硬编码任何推测值。
// 任一配置缺失或请求失败都返回可判定的结果，应用据此降级为纯本地模式（需求 R-16）。

// 从项目根 .env 补齐配置（shell 已显式注入的环境变量优先）。
// 不引入 dotenv：只用标准库；.env 已被 .gitignore 排除，不进仓库、不写日志。
function loadEnvFile() {
  const p = path.join(__dirname, '..', '..', '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || m[1] in process.env) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
loadEnvFile();

const SHELF_URL = process.env.WEREAD_SHELF_URL || '';
const API_KEY = process.env.WEREAD_API_KEY || '';

async function syncShelf() {
  if (!SHELF_URL || !API_KEY) {
    return { ok: false, reason: 'NOT_CONFIGURED' };
  }
  try {
    const res = await fetch(SHELF_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      // TODO(接入时): 按官方文档补齐 skill_version 与分页参数
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return { ok: false, reason: 'HTTP_' + res.status };
    return { ok: true, data: await res.json() };
  } catch (e) {
    return { ok: false, reason: 'NETWORK', message: String(e) };
  }
}

module.exports = { syncShelf };
