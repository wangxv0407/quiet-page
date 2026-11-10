'use strict';

// 微信读书官方 Agent Gateway「只读」适配层。
// 官方接口地址、请求参数与 skill_version 一律以官方文档为准，本项目不硬编码任何推测值。
// 任一配置缺失或请求失败都返回可判定的结果，应用据此降级为纯本地模式（需求 R-16）。

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
