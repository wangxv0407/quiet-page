'use strict';
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // 在纯浏览器里直接打开 index.html 时也能预览，不依赖 Electron
  const fallback = {
    getState: async () => ({ config: {}, books: [], progress: {} }),
    setState: async (p) => p,
    openOfficial: async () => false,
    importFiles: async () => [],
    readText: async () => ({ ok: false, reason: 'NO_BRIDGE' }),
    syncShelf: async () => ({ ok: false, reason: 'NOT_CONFIGURED' }),
    stow: async () => {},
    setPin: async () => {},
    onStowChanged: () => () => {}
  };
  const api = window.deskfolio || fallback;

  const win = $('#win');
  const reader = $('#reader');
  let store = { config: {}, books: [], progress: {} };
  let currentId = null;
  let statusTimer = null;
  let saveTimer = null;

  const cfg = () => store.config || {};

  function toast(msg) {
    const el = $('#status');
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => el.classList.remove('is-on'), 2200);
  }

  function lum(hex) {
    const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  function contrast(a, b) {
    const hi = Math.max(lum(a), lum(b)), lo = Math.min(lum(a), lum(b));
    return (hi + 0.05) / (lo + 0.05);
  }

  async function persist(patch) {
    const next = { ...store, ...patch };
    try {
      const res = await api.setState(patch);
      store = (res && res.config) ? res : next;
    } catch (_) { store = next; }
  }

  function readout() {
    const night = document.documentElement.dataset.theme === 'night';
    const bg = night ? '#191A1C' : '#F7F5F0';
    const fg = night ? (cfg().tone || '#8C939B') : '#2B2925';
    $('#crVal').textContent = contrast(fg, bg).toFixed(2) + ' : 1';
  }

  function apply() {
    const c = cfg();
    const night = c.theme === 'night';
    document.documentElement.dataset.theme = night ? 'night' : 'paper';
    $('#themeBtn').textContent = night ? '夜读' : '纸墨';
    $('#themeBtn').setAttribute('aria-pressed', String(night));

    const a = typeof c.alpha === 'number' ? c.alpha : 1;
    win.style.setProperty('--alpha', a);
    win.style.setProperty('--tone', c.tone || '#8C939B');
    $('#alpha').value = Math.round(a * 100);
    $('#alphaVal').textContent = Math.round(a * 100) + '%';

    win.classList.toggle('is-minimal', !!c.minimal);
    $('#minimalBtn').setAttribute('aria-pressed', String(!!c.minimal));
    $('#swMinimal').setAttribute('aria-checked', String(!!c.minimal));
    $('#swPin').setAttribute('aria-checked', String(c.pin !== false));
    $$('#segTone button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tone === (c.tone || '#8C939B'))));
    readout();
  }

  function bookHtml(list, emptyText) {
    if (!list.length) return '<div class="book__sub shelf-hint">' + esc(emptyText) + '</div>';
    return list.map((b) =>
      '<button class="book" data-id="' + esc(b.id) + '" aria-current="' + (currentId === b.id) + '">' +
      '<span class="cover">' + esc(b.title.charAt(0)) + '</span>' +
      '<span class="book__meta"><span class="book__title">' + esc(b.title) + '</span>' +
      '<span class="book__sub">' + esc(b.author || '') + '</span></span></button>'
    ).join('');
  }

  function renderShelf() {
    const books = store.books || [];
    $('#empty').classList.toggle('is-on', books.length === 0);
    $('#cloudList').innerHTML = bookHtml(books.filter((b) => b.source === 'cloud'), '云端书架待接入 v0.2');
    $('#localList').innerHTML = bookHtml(books.filter((b) => b.source === 'local'), '暂无本地书籍');
    $$('.book').forEach((btn) => btn.addEventListener('click', () => openBook(btn.dataset.id)));
  }

  function splitText(text) {
    const parts = text.split(/\r?\n\s*\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1) return parts.slice(0, 300);
    const out = [];
    for (let i = 0; i < text.length; i += 220) out.push(text.slice(i, i + 220));
    return out.slice(0, 300);
  }

  async function openBook(id) {
    const b = (store.books || []).find((x) => x.id === id);
    if (!b) return;
    currentId = id;
    $('#barName').textContent = b.title;
    $('#bookTitle').textContent = b.title;
    $('#chapter').textContent = b.source === 'local' ? '本地文件 · 断点续读' : '微信读书 · 只读';
    renderShelf();

    if (b.source !== 'local') {
      $('#prose').innerHTML = '<p>正版书正文请在官方网页版阅读，本工具不承载登录态、不抓取正文。</p>';
      return;
    }
    const r = await api.readText(b.path);
    if (!r || !r.ok) {
      const why = { EPUB_PENDING: 'EPUB 解析将在 v0.2 接入', TOO_LARGE: '文件超过 5MB 限制', UNSUPPORTED: '不支持的文件类型', NO_BRIDGE: '当前为浏览器预览模式' };
      $('#prose').innerHTML = '<p>暂时无法打开这本书：' + esc((r && why[r.reason]) || '读取失败') + '</p>';
      toast('未能打开：' + ((r && r.reason) || '读取失败'));
      return;
    }
    $('#prose').innerHTML = splitText(r.text).map((p) => '<p>' + esc(p) + '</p>').join('');
    const p = (store.progress || {})[id] || 0;
    reader.scrollTop = p * Math.max(1, reader.scrollHeight - reader.clientHeight);
    $('#progressText').textContent = '已读 ' + Math.round(p * 100) + '%';
    $('#fill').style.width = (p * 100) + '%';
  }

  async function sync() {
    const r = await api.syncShelf();
    const ok = !!(r && r.ok);
    $('#notice').classList.toggle('is-on', !ok);
    $('#conn').classList.toggle('is-ok', ok);
    $('#connText').textContent = ok ? '微信读书 · 只读已连接' : '纯本地模式';
    if (!ok) {
      $('#noticeText').textContent = r && r.reason === 'NOT_CONFIGURED'
        ? '微信读书未配置，已使用纯本地模式。'
        : '云端暂不可用，已使用纯本地模式。';
    }
  }

  function closePanel() {
    $('#stealth').classList.remove('is-open');
    $('#stealthBtn').setAttribute('aria-expanded', 'false');
  }

  function bind() {
    $('#themeBtn').addEventListener('click', async () => {
      await persist({ config: { ...cfg(), theme: cfg().theme === 'night' ? 'paper' : 'night' } });
      apply();
    });
    $('#minimalBtn').addEventListener('click', async () => {
      await persist({ config: { ...cfg(), minimal: !cfg().minimal } });
      apply();
    });
    $('#swMinimal').addEventListener('click', () => $('#minimalBtn').click());

    $('#stealthBtn').addEventListener('click', (e) => {
      const open = !$('#stealth').classList.contains('is-open');
      $('#stealth').classList.toggle('is-open', open);
      e.currentTarget.setAttribute('aria-expanded', String(open));
    });
    $('#stealthClose').addEventListener('click', closePanel);

    $('#alpha').addEventListener('input', (e) => {
      const a = Number(e.target.value) / 100;
      win.style.setProperty('--alpha', a);
      $('#alphaVal').textContent = e.target.value + '%';
      readout();
    });
    $('#alpha').addEventListener('change', async (e) => {
      await persist({ config: { ...cfg(), alpha: Number(e.target.value) / 100 } });
    });

    $$('#segTone button').forEach((b) => b.addEventListener('click', async () => {
      await persist({ config: { ...cfg(), tone: b.dataset.tone } });
      apply();
    }));

    $('#swPin').addEventListener('click', async (e) => {
      const on = !(cfg().pin !== false);
      await persist({ config: { ...cfg(), pin: on } });
      e.currentTarget.setAttribute('aria-checked', String(on));
      await api.setPin(on);
    });

    $('#stowBtn').addEventListener('click', () => api.stow());
    $('#officialBtn').addEventListener('click', async () => {
      const ok = await api.openOfficial();
      if (!ok) toast('未能打开官方网页版');
    });
    $('#syncBtn').addEventListener('click', async () => { await sync(); toast('已刷新连接状态'); });

    $('#importBtn').addEventListener('click', async () => {
      const paths = await api.importFiles();
      if (!paths || !paths.length) return;
      const books = [...(store.books || [])];
      for (const p of paths) {
        const name = p.split(/[\\/]/).pop().replace(/\.(txt|epub)$/i, '');
        books.push({
          id: 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          title: name, author: '本地文件', source: 'local', path: p
        });
      }
      await persist({ books });
      renderShelf();
      toast('已导入 ' + paths.length + ' 本');
    });

    reader.addEventListener('scroll', () => {
      if (!currentId) return;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        const max = Math.max(1, reader.scrollHeight - reader.clientHeight);
        const p = Math.min(1, reader.scrollTop / max);
        await persist({ progress: { ...(store.progress || {}), [currentId]: p } });
        $('#progressText').textContent = '已读 ' + Math.round(p * 100) + '%';
        $('#fill').style.width = (p * 100) + '%';
      }, 400);
    });

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
    api.onStowChanged((stowed) => { if (!stowed) toast('已恢复阅读'); });
  }

  async function boot() {
    try { const s = await api.getState(); if (s) store = { ...store, ...s }; } catch (_) { /* 使用默认值 */ }
    if (!store.config) store.config = {};
    if (!store.books) store.books = [];
    if (!store.progress) store.progress = {};
    bind();
    apply();
    renderShelf();
    await sync();
    const first = (store.books || [])[0];
    if (first) await openBook(first.id);
  }

  boot();
})();
