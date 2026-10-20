/* =============================================================
   七巨头定投 (Mag7 DCA)
   美股七巨头月度定投记录与收益统计
   - 纯前端实现，数据仅存 localStorage，可打包为 Android App
   - 红涨绿跌（中文金融惯例）；默认人民币显示，可切换美元
   - 现价支持腾讯财经行情自动获取（国内可直连）或手动输入
   ============================================================= */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MAG7 = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  /* ---------------- 常量与元数据 ---------------- */
  const STOCKS = [
    { symbol: 'AAPL',  name: '苹果',   color: '#5b8def', base: 342.94 },
    { symbol: 'MSFT',  name: '微软',   color: '#2f9e6e', base: 533.52 },
    { symbol: 'GOOGL', name: '谷歌',   color: '#e8a33d', base: 344.18 },
    { symbol: 'AMZN',  name: '亚马逊', color: '#e07b39', base: 262.45 },
    { symbol: 'NVDA',  name: '英伟达', color: '#6fbf73', base: 217.09 },
    { symbol: 'META',  name: 'Meta',   color: '#4a7fd4', base: 705.44 },
    { symbol: 'TSLA',  name: '特斯拉', color: '#d05b5b', base: 368.06 }
  ];
  const SYM = (s) => STOCKS.find((x) => x.symbol === s);
  const LS_KEY = 'mag7dca.v1';
  const PRICE_API = (s) => 'https://qt.gtimg.cn/q=us' + s;

  /* ---------------- 工具函数 ---------------- */
  const pad2 = (n) => String(n).padStart(2, '0');
  const dateStr = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const todayStr = () => dateStr(new Date());
  const ymOf = (ds) => String(ds).slice(0, 7);
  const ymNow = () => ymOf(todayStr());
  const monthLabel = (ym) => { const p = String(ym).split('-'); return `${p[0]}年${+p[1]}月`; };
  const monthShort = (ym) => { const p = String(ym).split('-'); return `${p[0].slice(2)}/${p[1]}`; };
  const round2 = (v) => Math.round(v * 100) / 100;
  const round4 = (v) => Math.round(v * 10000) / 10000;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const trimNum = (v) => String(Math.round(v * 100) / 100);

  /* ---------------- 状态管理 ---------------- */
  function defaultState() {
    return {
      v: 1,
      settings: { currency: 'CNY', rate: 7.2, theme: 'light', payDay: 5 },
      plan: { AAPL: 600, MSFT: 600, GOOGL: 400, AMZN: 400, NVDA: 800, META: 400, TSLA: 400 },
      records: [],
      prices: {},
      demo: false
    };
  }

  function mergeState(base, over) {
    const out = JSON.parse(JSON.stringify(base));
    const o = over || {};
    for (const k of Object.keys(o)) {
      if (k === 'settings' || k === 'plan') Object.assign(out[k], o[k] || {});
      else out[k] = o[k];
    }
    return out;
  }

  const memStore = {};
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return memStore[k] != null ? memStore[k] : null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { memStore[k] = v; } }

  function loadState() {
    const raw = lsGet(LS_KEY);
    if (raw) {
      try { return mergeState(defaultState(), JSON.parse(raw)); } catch (e) { /* 损坏则用默认值 */ }
    }
    return defaultState();
  }

  /* ---------------- 计算逻辑 ---------------- */
  function calcHoldings(st) {
    const h = {};
    for (const s of STOCKS) h[s.symbol] = { symbol: s.symbol, name: s.name, color: s.color, shares: 0, cost: 0 };
    for (const r of st.records || []) {
      const x = h[r.symbol];
      if (!x) continue;
      x.shares += (+r.shares || 0);
      x.cost += (+r.usd || 0);
    }
    for (const s of STOCKS) {
      const x = h[s.symbol];
      x.avg = x.shares > 0 ? x.cost / x.shares : 0;
      const p = (st.prices && st.prices[s.symbol]) ? (+st.prices[s.symbol].usd || 0) : 0;
      x.price = p;
      x.value = x.shares * p;
      x.pnl = x.value - x.cost;
      x.pnlPct = x.cost > 0 ? (x.pnl / x.cost) * 100 : 0;
    }
    return h;
  }

  function totals(h) {
    let cost = 0, value = 0, hasPrice = false;
    for (const k in h) {
      cost += h[k].cost;
      value += h[k].value;
      if (h[k].price > 0) hasPrice = true;
    }
    return { cost, value, pnl: value - cost, pnlPct: cost > 0 ? ((value - cost) / cost) * 100 : 0, hasPrice };
  }

  function monthRecorded(st, ym) {
    const m = {};
    for (const s of STOCKS) m[s.symbol] = 0;
    for (const r of st.records || []) {
      if (ymOf(r.date) === ym) m[r.symbol] = (m[r.symbol] || 0) + (+r.usd || 0);
    }
    return m;
  }

  function planTotal(st) {
    let t = 0;
    for (const s of STOCKS) {
      const v = +(st.plan && st.plan[s.symbol]) || 0;
      if (v > 0) t += v;
    }
    return t;
  }

  function nextPayday(payDay, from) {
    const now = from ? new Date(from) : new Date();
    now.setHours(0, 0, 0, 0);
    const day = clamp(parseInt(payDay) || 5, 1, 28);
    let d = new Date(now.getFullYear(), now.getMonth(), day);
    if (d.getTime() < now.getTime()) d = new Date(now.getFullYear(), now.getMonth() + 1, day);
    const days = Math.round((d.getTime() - now.getTime()) / 86400000);
    return { date: d, days };
  }

  function cumByMonth(st) {
    const byYm = {};
    for (const r of st.records || []) {
      const ym = ymOf(r.date);
      byYm[ym] = (byYm[ym] || 0) + (+r.usd || 0);
    }
    const months = Object.keys(byYm).sort();
    let cum = 0;
    return months.map((ym) => { cum += byYm[ym]; return { ym, month: byYm[ym], cum }; });
  }

  function niceCeil(v) {
    if (!(v > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return m * p;
  }

  /* ---------------- 格式化 ---------------- */
  const curSym = (c) => (c === 'CNY' ? '¥' : '$');
  function curSettings() { return (typeof state !== 'undefined' && state && state.settings) ? state.settings : defaultState().settings; }
  function toDisp(usd, st) {
    const s = st || curSettings();
    return s.currency === 'CNY' ? usd * s.rate : usd;
  }
  function fmtMoney(usd, st, withSign) {
    const s = st || curSettings();
    const v = toDisp(usd, s);
    const sign = v < 0 ? '-' : (withSign && v > 0 ? '+' : '');
    return sign + curSym(s.currency) + Math.abs(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtUsd(v, withSign) {
    const sign = v < 0 ? '-' : (withSign && v > 0 ? '+' : '');
    return sign + '$' + Math.abs(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtPct(v, withSign) {
    const sign = v < 0 ? '-' : (withSign && v > 0 ? '+' : '');
    return sign + Math.abs(v).toFixed(2) + '%';
  }
  function fmtShares(v) { return (+v).toLocaleString('zh-CN', { maximumFractionDigits: 4 }); }
  function fmtShort(usd, st) {
    const s = st || curSettings();
    const v = toDisp(usd, s);
    const sym = curSym(s.currency);
    const a = Math.abs(v);
    if (a >= 1e8) return sym + (v / 1e8).toFixed(2) + '亿';
    if (a >= 1e4) return sym + (v / 1e4).toFixed(2) + '万';
    return sym + a.toFixed(0);
  }
  function fmtTime(ts) {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  function pnlClass(v) { return v > 0.0001 ? 'up' : (v < -0.0001 ? 'down' : 'flat'); }
  function pnlBadge(v) {
    return `<span class="badge ${pnlClass(v)}">${fmtPct(v, true)}</span>`;
  }

  /* ---------------- 数据操作 ---------------- */
  function seedDemo(st) {
    st.records = [];
    st.prices = {};
    st.demo = true;
    const months = 14;
    const now = new Date();
    const walk = {};
    for (const s of STOCKS) walk[s.symbol] = s.base * (0.6 + Math.random() * 0.42);
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, clamp(st.settings.payDay, 1, 28), 10, 30, 0);
      const ds = dateStr(d);
      for (const s of STOCKS) {
        const drift = 1 + (Math.random() - 0.44) * 0.13;
        walk[s.symbol] = Math.max(1, walk[s.symbol] * drift);
        const px = round2(walk[s.symbol]);
        const usd = +(st.plan[s.symbol]) || 0;
        if (usd <= 0) continue;
        st.records.push({ id: genId(), symbol: s.symbol, date: ds, usd, price: px, shares: round4(usd / px), note: '', ts: d.getTime() });
      }
    }
    for (const s of STOCKS) {
      st.prices[s.symbol] = { usd: round2(s.base * (0.995 + Math.random() * 0.012)), at: Date.now() };
    }
    st.records.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.ts || 0) - (a.ts || 0)));
    return st;
  }

  function parseImport(text) {
    const p = JSON.parse(text);
    if (!p || typeof p !== 'object' || !Array.isArray(p.records)) throw new Error('文件格式不正确');
    for (const r of p.records) {
      if (!r || typeof r.symbol !== 'string' || !SYM(r.symbol)) throw new Error('包含未知的股票代码');
      if (!(+r.usd > 0)) throw new Error('包含无效的金额');
      if (typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) throw new Error('包含无效的日期');
    }
    return mergeState(defaultState(), p);
  }

  /* ---------------- 行情获取（腾讯财经，国内直连） ---------------- */
  function parseGtimg(text) {
    const m = /="([^"]*)"/.exec(text || '');
    if (!m) return 0;
    const f = m[1].split('~');
    const v = parseFloat(f[3]);
    return isFinite(v) && v > 0 ? v : 0;
  }

  async function fetchText(url, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms || 5000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error('http ' + res.status);
      return await res.text();
    } finally { clearTimeout(timer); }
  }

  async function fetchPrice(symbol) {
    const cands = [
      PRICE_API(symbol),
      'https://stooq.com/q/l/?s=' + symbol.toLowerCase() + '.us&f=sd2t2ohlcv&h&e=csv',
      'https://api.allorigins.win/raw?url=' + encodeURIComponent(PRICE_API(symbol))
    ];
    for (const u of cands) {
      try {
        const txt = await fetchText(u, 4500);
        let p = parseGtimg(txt);
        if (!p) {
          const line = (txt || '').trim().split('\n')[0] || '';
          const f = line.split(',');
          p = parseFloat(f[6]);
        }
        if (p > 0) return round2(p);
      } catch (e) { /* 尝试下一个来源 */ }
    }
    return 0;
  }

  async function fetchAllPrices() {
    const rs = await Promise.all(STOCKS.map(async (s) => [s.symbol, await fetchPrice(s.symbol)]));
    const out = {};
    for (const kv of rs) if (kv[1] > 0) out[kv[0]] = kv[1];
    return out;
  }

  /* =============================================================
     UI 层（仅在浏览器环境执行）
     ============================================================= */
  let state = null;
  let view = 'home';
  let filterSym = 'ALL';
  let fCur = 'CNY';
  let sheetSym = null;

  const $ = (id) => document.getElementById(id);

  const IC = {
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 12a8.5 8.5 0 1 1-2.5-6"/><path d="M20.5 3.5V8h-4.5"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="M8 11.5 12 15.5 16 11.5"/><path d="M4.5 19.5h15"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15.5V4.5"/><path d="M8 8 12 4l4 4"/><path d="M4.5 19.5h15"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 7h15"/><path d="M9.5 7V5h5v2"/><path d="M6.5 7l1 13h9l1-13"/><path d="M10 11v5M14 11v5"/></svg>',
    pie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.4"/><path d="M12 3.6V12l7.2 4.2"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 6.5h11M9 12h11M9 17.5h6"/><circle cx="4.6" cy="6.5" r="1.15" fill="currentColor" stroke="none"/><circle cx="4.6" cy="12" r="1.15" fill="currentColor" stroke="none"/><circle cx="4.6" cy="17.5" r="1.15" fill="currentColor" stroke="none"/></svg>'
  };

  const VIEW_META = {
    home: { title: '定投', actions: '' },
    holdings: { title: '我的持仓', actions: '<button class="icon-btn" data-act="prices" title="更新现价">' + IC.refresh + '</button>' },
    plan: { title: '定投计划', actions: '' },
    records: { title: '投资记录', actions: '<button class="icon-btn" data-act="export" title="导出备份">' + IC.download + '</button>' },
    me: { title: '我的', actions: '' }
  };

  /* ---------------- 启动 ---------------- */
  function boot() {
    state = loadState();
    applyTheme();
    $('backdrop').addEventListener('click', closeSheet);
    $('importFile').addEventListener('change', onImportFile);
    window.addEventListener('scroll', () => {
      $('topbar').classList.toggle('scrolled', window.scrollY > 4);
    }, { passive: true });
    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    document.addEventListener('backbutton', () => {
      if ($('sheet').classList.contains('show')) closeSheet();
    });
    switchTab('home');
  }

  function applyTheme() {
    const t = curSettings().theme || 'light';
    document.documentElement.dataset.theme = t;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = t === 'dark' ? '#0c1017' : '#f3f5f9';
  }

  function saveState() {
    if (!state) return;
    lsSet(LS_KEY, JSON.stringify(state));
  }

  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (!/^https?:/.test(location.protocol)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  /* ---------------- 事件 ---------------- */
  function onClick(e) {
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) { switchTab(tabBtn.dataset.tab); return; }
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (actions[act]) actions[act](el.dataset.arg, el);
  }

  const actions = {
    add: (sym) => openAddSheet(sym || 'AAPL'),
    prices: () => openPriceSheet(),
    export: () => exportJSON(),
    import: () => $('importFile').click(),
    demo: () => loadDemo(),
    reset: () => clearData(),
    delRec: (id) => delRecord(id),
    setcur: (c) => { state.settings.currency = c; saveState(); render(); },
    settheme: (t) => { state.settings.theme = t; applyTheme(); saveState(); },
    filter: (s) => { filterSym = s; renderRecords(); },
    autoprice: () => autoPrice(),
    holding: (sym) => openHoldingSheet(sym),
    planplus: (sym) => openAddSheet(sym),
    saveRecord: () => saveRecord(),
    fcur: (c) => { fCur = c; refreshAddSheetCur(); },
    fsym: (sym) => {
      sheetSym = sym;
      document.querySelectorAll('#f-syms .chip').forEach((c) => c.classList.toggle('active', c.dataset.arg === sym));
      const p = state.prices[sym];
      const inp = $('f-price');
      if (inp) inp.value = p ? p.usd : '';
      updateAddHints();
    },
    usenow: () => {
      const p = state.prices[sheetSym];
      if (p) { $('f-price').value = p.usd; updateAddHints(); toast('已填入 ' + sheetSym + ' 现价'); }
      else toast('尚未获取该股现价，请手动输入');
    },
    closeSheet: () => closeSheet(),
    goto: (t) => { closeSheet(); switchTab(t); }
  };

  function onImportFile(e) {
    const f = e.target.files && e.target.files[0];
    if (f) importJSON(f);
    e.target.value = '';
  }

  function onInput(e) {
    const el = e.target.closest('[data-bind]');
    if (!el || !el.dataset.bind) return;
    const parts = el.dataset.bind.split(':');
    const kind = parts[0], key = parts[1];
    if (kind === 'plan') {
      const v = Math.max(0, parseFloat(el.value) || 0);
      const st = state.settings;
      state.plan[key] = round2(st.currency === 'CNY' ? v / st.rate : v);
      saveState();
      const hint = el.dataset.hint ? $(el.dataset.hint) : null;
      if (hint) hint.textContent = state.plan[key] > 0 ? '≈ ' + fmtUsd(state.plan[key]) : '设为 0 即暂停该股定投';
      const sub = $('ps-' + key);
      if (sub) {
        const done = monthRecorded(state, ymNow())[key];
        sub.textContent = state.plan[key] > 0 ? '本月 ' + fmtMoney(done) + ' / ' + fmtMoney(state.plan[key]) : '未设置月投金额';
      }
      const wrap = $('pg-' + key), bar = $('pgi-' + key);
      if (wrap && bar && state.plan[key] > 0) {
        wrap.style.display = '';
        const done = monthRecorded(state, ymNow())[key];
        bar.style.width = Math.min(100, done / state.plan[key] * 100) + '%';
        bar.classList.toggle('done', done >= state.plan[key]);
      } else if (wrap) {
        wrap.style.display = 'none';
      }
      const tot = $('plan-total-inline');
      if (tot) tot.textContent = fmtMoney(planTotal(state));
    } else if (kind === 'price') {
      const v = parseFloat(el.value);
      if (v > 0) state.prices[key] = { usd: round2(v), at: Date.now() };
      else delete state.prices[key];
      saveState();
      const hint = el.dataset.hint ? $(el.dataset.hint) : null;
      if (hint) hint.textContent = v > 0 ? '≈ ' + fmtMoney(v) + ' / 股' : '输入美元股价';
    } else if (kind === 'rate') {
      const v = parseFloat(el.value);
      if (v > 0) state.settings.rate = v;
    } else if (kind === 'payday') {
      const v = clamp(parseInt(el.value) || 5, 1, 28);
      state.settings.payDay = v;
      const np = nextPayday(v);
      const el2 = $('payday-next');
      if (el2) {
        el2.textContent = '每月 ' + v + ' 日定投 · 下次 ' + (np.days === 0 ? '就是今天' : np.days + ' 天后（' + (np.date.getMonth() + 1) + '月' + np.date.getDate() + '日）');
      }
    }
  }

  function onChange(e) {
    const el = e.target;
    if (!el || !el.dataset || !el.dataset.bind) return;
    const kind = el.dataset.bind.split(':')[0];
    if (kind === 'price') { saveState(); }
    else if (kind === 'rate' || kind === 'payday') { saveState(); render(); }
  }

  /* ---------------- 视图切换与渲染 ---------------- */
  function switchTab(t) {
    if (!VIEW_META[t]) t = 'home';
    view = t;
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + t));
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
    renderTopbar();
    render();
    window.scrollTo({ top: 0 });
    buzz(8);
  }

  function renderTopbar() {
    const m = VIEW_META[view];
    $('tbTitle').textContent = m.title;
    $('tbActions').innerHTML = m.actions || '';
  }

  function render() {
    ({ home: renderHome, holdings: renderHoldings, plan: renderPlan, records: renderRecords, me: renderMe })[view]();
  }

  /* ---------------- 首页 ---------------- */
  function renderHome() {
    const h = calcHoldings(state);
    const t = totals(h);
    const st = state.settings;
    const ym = ymNow();
    const rec = monthRecorded(state, ym);
    const pt = planTotal(state);
    const done = STOCKS.reduce((a, s) => a + rec[s.symbol], 0);
    const np = nextPayday(st.payDay);
    let html = '';

    if (state.demo) {
      html += '<div class="banner"><span>演示数据模式：记录与现价均为模拟示例</span><button class="btn btn-ghost" data-act="reset" style="margin-left:auto">清除</button></div>';
    }

    html += `
      <div class="hero">
        <div class="hero-label">总市值（${st.currency === 'CNY' ? '人民币' : '美元'}）</div>
        <div class="hero-total">${t.hasPrice ? fmtMoney(t.value) : '—'}</div>
        <div class="hero-row">
          <div class="hero-stat">总投入<b>${fmtMoney(t.cost)}</b></div>
          <div class="hero-stat">累计收益<b class="${pnlClass(t.pnl)}">${t.hasPrice ? fmtMoney(t.pnl, null, true) : '—'}</b></div>
          <div class="hero-stat">收益率<b class="${pnlClass(t.pnlPct)}">${t.hasPrice ? fmtPct(t.pnlPct, true) : '—'}</b></div>
        </div>
        <div class="hero-divider"></div>
        <div class="hero-row">
          <div class="hero-stat">本月已投<b>${fmtMoney(done)}</b></div>
          <div class="hero-stat">本月计划<b>${fmtMoney(pt)}</b></div>
          <div class="hero-stat">下次定投<b>${np.days === 0 ? '今天' : np.days + ' 天后'}</b></div>
        </div>
        <div class="hero-actions">
          <button class="btn btn-light" data-act="add">记一笔</button>
          <button class="btn btn-light" data-act="prices">更新现价</button>
        </div>
      </div>`;

    const planRows = STOCKS.filter((s) => ((+state.plan[s.symbol]) || 0) > 0).map((s) => {
      const planned = +state.plan[s.symbol];
      const d = rec[s.symbol];
      const pct = Math.min(100, d / planned * 100);
      return `<div class="mini-row"><span class="dot" style="background:${s.color}"></span><span class="mini-nm">${s.symbol}</span><div class="progress"><i class="${d >= planned ? 'done' : ''}" style="width:${pct}%"></i></div><span class="mini-vl">${fmtMoney(d)}/${fmtMoney(planned)}</span></div>`;
    }).join('');
    html += `<div class="card"><div class="card-title">本月定投进度<span class="sub">${monthLabel(ym)}</span></div>${planRows || '<div class="hint" style="margin:0">尚未设置定投计划，去「计划」页设置每月金额</div>'}</div>`;

    html += `<div class="card"><div class="card-title">持仓分布<span class="sub">按市值</span></div>${donutHtml(h)}</div>`;
    html += `<div class="card"><div class="card-title">累计投入 vs 当前市值<span class="sub">按月</span></div>${lineHtml()}</div>`;

    const recent = state.records.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.ts || 0) - (a.ts || 0))).slice(0, 3);
    if (recent.length) {
      const rows = recent.map((r) => {
        const s = SYM(r.symbol);
        return `<div class="row" data-act="delRec" data-arg="${r.id}">
          <span class="dot" style="background:${s.color}">${s.symbol.slice(0, 2)}</span>
          <div class="row-main"><div class="row-title" style="font-size:13.5px">${s.symbol} · ${s.name}</div><div class="row-sub">${r.date}</div></div>
          <div class="row-right"><div class="row-value" style="font-size:13.5px">${fmtMoney(r.usd)}</div></div>
        </div>`;
      }).join('');
      html += `<div class="card"><div class="card-title">最近记录<span class="sub" data-act="goto" data-arg="records" style="cursor:pointer;color:var(--primary)">查看全部</span></div>${rows}</div>`;
    } else {
      html += `<div class="card"><div class="card-title">开始你的七巨头定投</div>
        <div class="hint" style="margin:0">1. 到「计划」页设置每只股票的每月定投金额<br>2. 每次扣款后点「记一笔」记录成交金额与价格<br>3. 在「我的」页更新现价，自动计算收益</div>
        <div style="display:flex;gap:10px;margin-top:14px"><button class="btn btn-primary" style="flex:1" data-act="add">记一笔</button><button class="btn btn-ghost" style="flex:1" data-act="demo">载入演示数据</button></div></div>`;
    }

    $('view-home').innerHTML = html;
  }

  /* ---------------- 持仓 ---------------- */
  function renderHoldings() {
    const h = calcHoldings(state);
    const t = totals(h);
    const arr = STOCKS.map((s) => h[s.symbol]).sort((a, b) => (b.value - a.value) || (b.shares - a.shares));
    const anyShares = arr.some((x) => x.shares > 0);
    const rows = arr.map((x) => {
      const pxTxt = x.price > 0 ? fmtUsd(x.price) : '未更新';
      return `<div class="row" data-act="holding" data-arg="${x.symbol}">
        <span class="dot" style="background:${x.color}">${x.symbol.slice(0, 2)}</span>
        <div class="row-main">
          <div class="row-title">${x.symbol} · ${x.name}</div>
          <div class="row-sub">${x.shares > 0 ? '持股 ' + fmtShares(x.shares) + ' · 成本 ' + fmtUsd(x.avg) : '尚未买入'}</div>
        </div>
        <div class="row-right">
          <div class="row-value">${x.value > 0 ? fmtMoney(x.value) : '—'}</div>
          <div style="margin-top:3px">${x.shares > 0 && x.price > 0 ? pnlBadge(x.pnlPct) : '<span class="badge flat">' + pxTxt + '</span>'}</div>
        </div>
      </div>`;
    }).join('');
    $('view-holdings').innerHTML = `
      <div class="card" style="margin-top:12px">
        <div class="stat-grid">
          <div class="stat"><div class="stat-l">总市值</div><div class="stat-v">${t.hasPrice ? fmtMoney(t.value) : '—'}</div></div>
          <div class="stat"><div class="stat-l">总成本</div><div class="stat-v">${fmtMoney(t.cost)}</div></div>
          <div class="stat"><div class="stat-l">收益率</div><div class="stat-v ${pnlClass(t.pnlPct)}">${t.hasPrice ? fmtPct(t.pnlPct, true) : '—'}</div></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">七巨头持仓<span class="sub">点击查看详情 / 改现价</span></div>
        ${anyShares ? rows : `<div class="empty">${IC.pie}<div class="t">暂无持仓</div><div class="d">记录第一笔定投后，这里会显示每只股票的盈亏</div><div class="btns"><button class="btn btn-primary" data-act="add">记一笔</button><button class="btn btn-ghost" data-act="demo">演示数据</button></div></div>`}
      </div>`;
  }

  /* ---------------- 计划 ---------------- */
  function renderPlan() {
    const st = state.settings;
    const ym = ymNow();
    const rec = monthRecorded(state, ym);
    const pt = planTotal(state);
    const np = nextPayday(st.payDay);
    const rows = STOCKS.map((s) => {
      const planned = (+state.plan[s.symbol]) || 0;
      const d = rec[s.symbol];
      const pct = planned > 0 ? Math.min(100, d / planned * 100) : 0;
      return `<div class="plan-row">
        <div class="plan-top">
          <span class="dot" style="background:${s.color}">${s.symbol.slice(0, 2)}</span>
          <div class="row-main">
            <div class="row-title">${s.symbol} · ${s.name}</div>
            <div class="row-sub" id="ps-${s.symbol}">${planned > 0 ? '本月 ' + fmtMoney(d) + ' / ' + fmtMoney(planned) : '未设置月投金额'}</div>
          </div>
          <button class="icon-btn" data-act="planplus" data-arg="${s.symbol}" title="记一笔"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5.5v13M5.5 12h13"/></svg></button>
        </div>
        <div class="plan-amt">
          <input class="input" type="text" inputmode="decimal" data-bind="plan:${s.symbol}" data-hint="ph-${s.symbol}" value="${planned > 0 ? trimNum(toDisp(planned, st)) : ''}" placeholder="月投金额">
          <div class="hint" id="ph-${s.symbol}" style="margin:0;flex:1">${planned > 0 ? '≈ ' + fmtUsd(planned) : '设为 0 即暂停该股定投'}</div>
        </div>
        <div class="progress" id="pg-${s.symbol}" style="margin-top:8px;${planned > 0 ? '' : 'display:none'}"><i id="pgi-${s.symbol}" class="${planned > 0 && d >= planned ? 'done' : ''}" style="width:${pct}%"></i></div>
      </div>`;
    }).join('');
    $('view-plan').innerHTML = `
      <div class="card" style="margin-top:12px">
        <div class="card-title">月度定投预算</div>
        <div style="font-size:26px;font-weight:800;font-variant-numeric:tabular-nums"><span id="plan-total-inline">${fmtMoney(pt)}</span><span style="font-size:12px;color:var(--ink2);font-weight:700"> / 月</span></div>
        <div class="hint" id="payday-next">每月 ${st.payDay} 日定投 · 下次 ${np.days === 0 ? '就是今天' : np.days + ' 天后（' + (np.date.getMonth() + 1) + '月' + np.date.getDate() + '日）'}</div>
        <div class="plan-amt" style="margin-top:12px">
          <div style="flex:1">
            <div class="hint" style="margin:0 0 6px">定投日（1-28）</div>
            <input class="input" type="number" min="1" max="28" data-bind="payday" value="${st.payDay}">
          </div>
        </div>
      </div>
      <div class="card"><div class="card-title">各股票月投金额<span class="sub">${st.currency === 'CNY' ? '人民币计价' : '美元计价'}</span></div>${rows}</div>
      <div class="card"><div class="hint" style="margin:0">提示：输入的金额按当前汇率折算为美元入账；之后修改「显示货币」或汇率，不会影响已记录的成本。坚持按计划执行，忽略短期波动。</div></div>`;
  }

  /* ---------------- 记录 ---------------- */
  function renderRecords() {
    const recs = state.records.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.ts || 0) - (a.ts || 0)));
    const list = filterSym === 'ALL' ? recs : recs.filter((r) => r.symbol === filterSym);
    const totalUsd = list.reduce((a, r) => a + r.usd, 0);
    const chips = ['ALL'].concat(STOCKS.map((s) => s.symbol)).map((s) =>
      `<button class="chip ${filterSym === s ? 'active' : ''}" data-act="filter" data-arg="${s}">${s === 'ALL' ? '全部' : s}</button>`).join('');
    let body = '';
    if (!list.length) {
      body = `<div class="empty">${IC.list}<div class="t">还没有投资记录</div><div class="d">点击首页的「记一笔」开始记录定投</div><div class="btns"><button class="btn btn-primary" data-act="add">记一笔</button><button class="btn btn-ghost" data-act="demo">载入演示数据</button></div></div>`;
    } else {
      const groups = {};
      for (const r of list) {
        const ym = ymOf(r.date);
        (groups[ym] = groups[ym] || []).push(r);
      }
      body = Object.keys(groups).sort().reverse().map((ym) => {
        const mt = groups[ym].reduce((a, r) => a + r.usd, 0);
        const rows = groups[ym].map((r) => {
          const s = SYM(r.symbol);
          const px = state.prices[r.symbol] ? state.prices[r.symbol].usd : 0;
          const pnl = px > 0 && r.price > 0 ? ((px - r.price) / r.price) * 100 : null;
          return `<div class="row" data-act="delRec" data-arg="${r.id}">
            <span class="dot" style="background:${s.color}">${s.symbol.slice(0, 2)}</span>
            <div class="row-main">
              <div class="row-title">${s.symbol} · ${s.name}${r.note ? '<span class="row-sub" style="font-weight:500">· ' + esc(r.note) + '</span>' : ''}</div>
              <div class="row-sub">${r.date.slice(5).replace('-', '/')} · @${fmtUsd(r.price)} × ${fmtShares(r.shares)}</div>
            </div>
            <div class="row-right">
              <div class="row-value">${fmtMoney(r.usd)}</div>
              <div style="margin-top:3px">${pnl === null ? '<span class="badge flat">—</span>' : pnlBadge(pnl)}</div>
            </div>
          </div>`;
        }).join('');
        return `<div class="month-head"><span>${monthLabel(ym)}</span><span>当月投入 ${fmtMoney(mt)}</span></div>${rows}`;
      }).join('');
    }
    $('view-records').innerHTML = `
      <div class="chips" style="margin-top:10px">${chips}</div>
      <div class="card" style="margin-top:6px">
        <div class="card-title">共 ${list.length} 笔 · 总投入 ${fmtMoney(totalUsd)}<span class="sub">点击记录可删除</span></div>
        ${body}
      </div>`;
  }

  /* ---------------- 我的 ---------------- */
  function renderMe() {
    const st = state.settings;
    const h = calcHoldings(state);
    const held = STOCKS.filter((s) => h[s.symbol].shares > 0).length;
    const first = state.records.length ? state.records.map((r) => r.date).sort()[0] : '—';
    const priceRows = STOCKS.map((s) => {
      const p = state.prices[s.symbol];
      return `<div class="plan-row">
        <div class="plan-top">
          <span class="dot" style="background:${s.color}">${s.symbol.slice(0, 2)}</span>
          <div class="row-main"><div class="row-title">${s.symbol} · ${s.name}</div><div class="row-sub">${p ? '更新于 ' + fmtTime(p.at) : '未更新'}</div></div>
          <div style="width:104px"><input class="input" type="text" inputmode="decimal" data-bind="price:${s.symbol}" data-hint="pmh-${s.symbol}" placeholder="0.00" value="${p ? p.usd : ''}"></div>
        </div>
        <div class="hint" id="pmh-${s.symbol}">${p ? '≈ ' + fmtMoney(p.usd) + ' / 股' : '输入美元股价'}</div>
      </div>`;
    }).join('');
    $('view-me').innerHTML = `
      <div class="card" style="margin-top:12px">
        <div class="stat-grid">
          <div class="stat"><div class="stat-l">投资笔数</div><div class="stat-v">${state.records.length}</div></div>
          <div class="stat"><div class="stat-l">持有股票</div><div class="stat-v">${held} / 7</div></div>
          <div class="stat"><div class="stat-l">首次定投</div><div class="stat-v" style="font-size:13px">${first}</div></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">现价管理<span class="sub">美元/股</span></div>
        ${priceRows}
        <div style="display:flex;gap:10px;margin-top:12px">
          <button class="btn btn-ghost" style="flex:1" data-act="autoprice">${IC.refresh}自动获取</button>
        </div>
        <div class="hint">来源：腾讯财经行情接口（美股实时价，国内可直连），需联网。自动获取失败时可手动输入，收盘数据约有延迟。</div>
      </div>
      <div class="card">
        <div class="card-title">偏好设置</div>
        <div class="me-list">
          <div class="me-item" style="cursor:default"><div class="mi-t">显示货币</div><div class="seg" style="margin-left:auto"><button class="${st.currency === 'CNY' ? 'active' : ''}" data-act="setcur" data-arg="CNY">¥ 人民币</button><button class="${st.currency === 'USD' ? 'active' : ''}" data-act="setcur" data-arg="USD">$ 美元</button></div></div>
          <div class="me-item" style="cursor:default"><div class="mi-t">美元汇率<div class="mi-d">1 USD = ? CNY</div></div><input class="input" style="width:92px;margin-left:auto" type="text" inputmode="decimal" data-bind="rate" value="${st.rate}"></div>
          <div class="me-item" style="cursor:default"><div class="mi-t">界面主题</div><div class="seg" style="margin-left:auto"><button class="${st.theme === 'light' ? 'active' : ''}" data-act="settheme" data-arg="light">浅色</button><button class="${st.theme === 'dark' ? 'active' : ''}" data-act="settheme" data-arg="dark">深色</button></div></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">数据管理<span class="sub">本地存储</span></div>
        <div class="me-list">
          <div class="me-item" data-act="export"><div class="mi-ic">${IC.download}</div><div class="mi-t">导出备份<div class="mi-d">下载 JSON 数据文件</div></div></div>
          <div class="me-item" data-act="import"><div class="mi-ic">${IC.upload}</div><div class="mi-t">导入备份<div class="mi-d">从 JSON 文件恢复数据</div></div></div>
          <div class="me-item" data-act="demo"><div class="mi-ic">${IC.pie}</div><div class="mi-t">载入演示数据<div class="mi-d">生成 14 个月模拟定投</div></div></div>
          <div class="me-item danger" data-act="reset"><div class="mi-ic">${IC.trash}</div><div class="mi-t">清空数据<div class="mi-d">删除全部记录与现价</div></div></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">关于</div>
        <div class="hint" style="margin:0">定投 v1.0.0（lldca）· 数据仅存储在本机（浏览器/应用内），不会上传。更换设备请使用「导出/导入备份」。<br><br>本应用可打包为安卓 App：通过 Capacitor 生成 Android 工程，用 Android Studio 构建 APK，详见项目 README.md。<br><br>注意：本应用仅用于个人投资记录与统计，不构成任何投资建议。股市有风险，投资需谨慎。</div>
      </div>`;
  }

  /* ---------------- 图表 ---------------- */
  function donutHtml(h) {
    const items = STOCKS.map((s) => h[s.symbol]).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
    const total = items.reduce((a, x) => a + x.value, 0);
    if (!items.length) return '<div class="hint" style="margin:0">暂无持仓数据，记录定投并更新现价后显示分布</div>';
    const size = 132, r = 52, cx = 66, cy = 66, C = 2 * Math.PI * r;
    let acc = 0;
    let arcs = '';
    for (const it of items) {
      const frac = it.value / total;
      const len = Math.max(0.5, frac * C - 2);
      arcs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${it.color}" stroke-width="15" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-acc * C).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
      acc += frac;
    }
    const legend = items.map((it) =>
      `<div class="legend-row"><span class="dot" style="background:${it.color}"></span><span class="nm">${it.symbol} ${esc(it.name)}</span><span class="vl">${((it.value / total) * 100).toFixed(1)}%</span></div>`).join('');
    return `<div class="donut-box"><svg class="donut" viewBox="0 0 ${size} ${size}">${arcs}<text class="donut-num" x="${cx}" y="${cy + 1}">${fmtShort(total)}</text><text class="donut-lbl" x="${cx}" y="${cy + 16}">总市值</text></svg><div class="legend">${legend}</div></div>`;
  }

  function lineHtml() {
    const series = cumByMonth(state);
    const t = totals(calcHoldings(state));
    if (series.length < 2) {
      return '<div class="hint" style="margin:0">坚持定投，记录满 2 个月后这里会生成「累计投入 vs 当前市值」曲线。</div>';
    }
    const W = 340, H = 168, pl = 42, pr = 14, pt = 16, pb = 22;
    const iw = W - pl - pr, ih = H - pt - pb;
    const maxV = Math.max(t.value || 0, ...series.map((p) => p.cum)) * 1.08;
    const nice = niceCeil(maxV);
    const X = (i) => pl + (series.length === 1 ? iw / 2 : (iw * i) / (series.length - 1));
    const Y = (v) => pt + ih * (1 - v / nice);
    let d = '';
    series.forEach((p, i) => { d += (i ? ' L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.cum).toFixed(1); });
    const area = d + ` L${X(series.length - 1).toFixed(1)} ${(pt + ih).toFixed(1)} L${X(0).toFixed(1)} ${(pt + ih).toFixed(1)} Z`;
    let grid = '';
    [0, 0.5, 1].forEach((f) => {
      const v = nice * f;
      const y = Y(v).toFixed(1);
      grid += `<line class="grid-line" x1="${pl}" y1="${y}" x2="${W - pr}" y2="${y}"/><text class="axis-txt" x="${pl - 5}" y="${(+y + 3).toFixed(1)}" text-anchor="end">${fmtShort(v)}</text>`;
    });
    let xlab = '';
    const step = Math.max(1, Math.ceil(series.length / 5));
    series.forEach((p, i) => {
      if (i % step === 0 || i === series.length - 1) {
        xlab += `<text class="axis-txt" x="${X(i).toFixed(1)}" y="${H - 6}" text-anchor="middle">${monthShort(p.ym)}</text>`;
      }
    });
    const dots = series.map((p, i) => `<circle class="lc-dot" cx="${X(i).toFixed(1)}" cy="${Y(p.cum).toFixed(1)}" r="2"/>`).join('');
    let ref = '';
    if (t.hasPrice && t.value > 0) {
      const y = Y(t.value).toFixed(1);
      const c = t.pnl >= 0 ? 'var(--up)' : 'var(--down)';
      ref = `<line class="ref-line" x1="${pl}" y1="${y}" x2="${W - pr}" y2="${y}" style="stroke:${c}"/><text class="axis-txt" x="${W - pr}" y="${(+y - 4).toFixed(1)}" text-anchor="end" style="fill:${c};font-weight:700">当前市值 ${fmtShort(t.value)}</text>`;
    }
    const last = series[series.length - 1];
    return `<svg class="line-chart" viewBox="0 0 ${W} ${H}">
      <defs><linearGradient id="lcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--primary);stop-opacity:0.22"/><stop offset="1" style="stop-color:var(--primary);stop-opacity:0"/></linearGradient></defs>
      ${grid}${ref}
      <path d="${area}" fill="url(#lcg)"/>
      <path class="lc-line" d="${d}"/>
      ${dots}
      <circle cx="${X(series.length - 1).toFixed(1)}" cy="${Y(last.cum).toFixed(1)}" r="3.6" fill="var(--primary)" stroke="var(--card)" stroke-width="1.6"/>
      ${xlab}
    </svg>
    <div class="legend" style="margin-top:6px">
      <div class="legend-row"><span class="dot" style="background:var(--primary)"></span><span class="nm">累计投入</span><span class="vl">${fmtMoney(t.cost)}</span></div>
      ${t.hasPrice ? `<div class="legend-row"><span class="dot" style="background:${t.pnl >= 0 ? 'var(--up)' : 'var(--down)'}"></span><span class="nm">当前市值</span><span class="vl ${pnlClass(t.pnlPct)}">${fmtMoney(t.value)}（${fmtPct(t.pnlPct, true)}）</span></div>` : ''}
    </div>`;
  }

  /* ---------------- 弹层 ---------------- */
  function openSheet(html, onMount) {
    const sh = $('sheet');
    sh.innerHTML = html;
    sh.classList.add('show');
    $('backdrop').classList.add('show');
    document.body.style.overflow = 'hidden';
    if (onMount) onMount();
  }

  function closeSheet() {
    const sh = $('sheet');
    sh.classList.remove('show');
    $('backdrop').classList.remove('show');
    document.body.style.overflow = '';
    setTimeout(() => { if (!sh.classList.contains('show')) sh.innerHTML = ''; }, 350);
    sheetSym = null;
  }

  function openAddSheet(sym) {
    sheetSym = sym || 'AAPL';
    fCur = state.settings.currency;
    const p = state.prices[sheetSym];
    openSheet(`
      <div class="sheet-grip"></div>
      <div class="sheet-title">记一笔</div>
      <div class="sheet-body">
        <div class="field" style="margin-top:4px"><label>股票</label><div class="chips" id="f-syms">${STOCKS.map((s) => `<button class="chip ${s.symbol === sheetSym ? 'active' : ''}" data-act="fsym" data-arg="${s.symbol}">${s.symbol} ${s.name}</button>`).join('')}</div></div>
        <div class="field"><label>日期</label><input class="input" id="f-date" type="date" value="${todayStr()}"></div>
        <div class="field">
          <label>投入金额</label>
          <div style="display:flex;gap:10px;align-items:center">
            <input class="input" id="f-amount" type="text" inputmode="decimal" placeholder="0.00" style="flex:1">
            <div class="seg" id="f-curseg">
              <button class="${fCur === 'CNY' ? 'active' : ''}" data-act="fcur" data-arg="CNY">¥</button>
              <button class="${fCur === 'USD' ? 'active' : ''}" data-act="fcur" data-arg="USD">$</button>
            </div>
          </div>
          <div class="hint" id="f-amount-hint">≈ $0.00</div>
        </div>
        <div class="field">
          <label>成交价格（美元/股）</label>
          <input class="input" id="f-price" type="text" inputmode="decimal" placeholder="如 342.94" value="${p ? p.usd : ''}">
          <div class="hint" id="f-price-hint">${p ? '现价 ≈ ' + fmtMoney(p.usd) + ' / 股' : '按实际成交价填写'}</div>
        </div>
        <div class="field"><label>备注（可选）</label><input class="input" id="f-note" type="text" placeholder="如：第 12 期定投" maxlength="30"></div>
        <div class="field"><div class="hint" id="f-shares" style="margin:0">可获得约 — 股</div></div>
      </div>
      <div class="sheet-foot"><button class="btn btn-primary btn-block" data-act="saveRecord">保存记录</button></div>
    `, () => {
      ['f-amount', 'f-price'].forEach((id) => {
        const el = $(id);
        if (el) el.addEventListener('input', updateAddHints);
      });
      updateAddHints();
    });
  }

  function updateAddHints() {
    const amt = parseFloat($('f-amount').value) || 0;
    const px = parseFloat($('f-price').value) || 0;
    const usd = fCur === 'CNY' ? amt / state.settings.rate : amt;
    $('f-amount-hint').textContent = fCur === 'CNY' ? '≈ ' + fmtUsd(usd) : '≈ ' + fmtMoney(usd);
    $('f-price-hint').textContent = px > 0 ? '≈ ' + fmtMoney(px) + ' / 股' : '按实际成交价填写';
    $('f-shares').textContent = px > 0 && amt > 0 ? '可获得约 ' + fmtShares(usd / px) + ' 股' : '可获得约 — 股';
  }

  function refreshAddSheetCur() {
    document.querySelectorAll('#f-curseg button').forEach((b) => b.classList.toggle('active', b.dataset.arg === fCur));
    updateAddHints();
  }

  function saveRecord() {
    const sym = sheetSym || 'AAPL';
    const date = $('f-date').value || todayStr();
    const amt = parseFloat($('f-amount').value);
    const px = parseFloat($('f-price').value);
    const note = $('f-note').value.trim();
    if (!(amt > 0)) { toast('请输入投入金额'); return; }
    if (!(px > 0)) { toast('请输入成交价格'); return; }
    const usd = fCur === 'CNY' ? amt / state.settings.rate : amt;
    state.records.push({ id: genId(), symbol: sym, date, usd: round2(usd), price: round2(px), shares: round4(usd / px), note, ts: Date.now() });
    if (!state.prices[sym]) state.prices[sym] = { usd: round2(px), at: Date.now() };
    saveState();
    closeSheet();
    buzz(15);
    toast('已记录 ' + fmtMoney(usd) + ' → ' + sym);
    render();
  }

  function openPriceSheet() {
    const rows = STOCKS.map((s) => {
      const p = state.prices[s.symbol];
      return `<div class="plan-row">
        <div class="plan-top">
          <span class="dot" style="background:${s.color}">${s.symbol.slice(0, 2)}</span>
          <div class="row-main"><div class="row-title">${s.symbol} · ${s.name}</div><div class="row-sub">${p ? '更新于 ' + fmtTime(p.at) : '未更新'}</div></div>
          <div style="width:104px"><input class="input" type="text" inputmode="decimal" data-bind="price:${s.symbol}" data-hint="sph-${s.symbol}" placeholder="0.00" value="${p ? p.usd : ''}"></div>
        </div>
        <div class="hint" id="sph-${s.symbol}">${p ? '≈ ' + fmtMoney(p.usd) + ' / 股' : '输入美元股价'}</div>
      </div>`;
    }).join('');
    openSheet(`
      <div class="sheet-grip"></div>
      <div class="sheet-title">更新现价</div>
      <div class="sheet-body">
        ${rows}
        <div class="hint" style="margin-top:10px">单位为美元/股。修改后自动保存；也可点「自动获取」从腾讯财经拉取实时价。</div>
      </div>
      <div class="sheet-foot" style="display:flex;gap:10px">
        <button class="btn btn-ghost" style="flex:1" data-act="autoprice">${IC.refresh}自动获取</button>
        <button class="btn btn-primary" style="flex:1" data-act="closeSheet">完成</button>
      </div>`);
  }

  function openHoldingSheet(sym) {
    const x = calcHoldings(state)[sym];
    const s = SYM(sym);
    const planned = (+state.plan[sym]) || 0;
    const cnt = state.records.filter((r) => r.symbol === sym).length;
    openSheet(`
      <div class="sheet-grip"></div>
      <div class="sheet-title">${sym} · ${s.name}</div>
      <div class="sheet-body">
        <div class="stat-grid">
          <div class="stat"><div class="stat-l">持股</div><div class="stat-v">${fmtShares(x.shares)}</div></div>
          <div class="stat"><div class="stat-l">摊薄成本</div><div class="stat-v">${x.avg > 0 ? fmtUsd(x.avg) : '—'}</div></div>
          <div class="stat"><div class="stat-l">现价</div><div class="stat-v">${x.price > 0 ? fmtUsd(x.price) : '—'}</div></div>
        </div>
        <div class="stat-grid" style="margin-top:10px">
          <div class="stat"><div class="stat-l">市值</div><div class="stat-v">${x.value > 0 ? fmtMoney(x.value) : '—'}</div></div>
          <div class="stat"><div class="stat-l">累计投入</div><div class="stat-v">${fmtMoney(x.cost)}</div></div>
          <div class="stat"><div class="stat-l">盈亏</div><div class="stat-v ${pnlClass(x.pnlPct)}">${x.price > 0 && x.cost > 0 ? fmtPct(x.pnlPct, true) : '—'}</div></div>
        </div>
        <div class="field">
          <label>更新现价（美元/股）</label>
          <input class="input" id="hp-${sym}" data-bind="price:${sym}" data-hint="hph-${sym}" type="text" inputmode="decimal" placeholder="0.00" value="${x.price > 0 ? x.price : ''}">
          <div class="hint" id="hph-${sym}">${x.price > 0 ? '≈ ' + fmtMoney(x.price) + ' / 股' : '输入后自动保存'}</div>
        </div>
        <div class="hint">月投金额 ${planned > 0 ? fmtMoney(planned) : '未设置'} · 已记录 ${cnt} 笔</div>
      </div>
      <div class="sheet-foot" style="display:flex;gap:10px">
        <button class="btn btn-ghost" style="flex:1" data-act="goto" data-arg="plan">改计划</button>
        <button class="btn btn-primary" style="flex:1" data-act="add" data-arg="${sym}">记一笔</button>
      </div>`);
  }

  /* ---------------- 对话框 / Toast ---------------- */
  function confirmDialog(opts) {
    return new Promise((resolve) => {
      const root = $('dialogRoot');
      root.innerHTML = `<div class="dialog-mask" id="dlgMask"><div class="dialog">
        <h3>${esc(opts.title)}</h3><p>${esc(opts.msg || '')}</p>
        <div class="dialog-btns">
          <button class="btn btn-ghost" id="dlgNo">取消</button>
          <button class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" id="dlgYes">${esc(opts.ok || '确定')}</button>
        </div></div></div>`;
      const done = (v) => { root.innerHTML = ''; resolve(v); };
      $('dlgYes').onclick = () => done(true);
      $('dlgNo').onclick = () => done(false);
      $('dlgMask').onclick = (e) => { if (e.target.id === 'dlgMask') done(false); };
    });
  }

  function toast(msg) {
    const root = $('toastRoot');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 260);
    }, 2100);
  }

  /* ---------------- 数据动作 ---------------- */
  async function autoPrice() {
    toast('正在从腾讯财经获取实时价…');
    const res = await fetchAllPrices();
    const n = Object.keys(res).length;
    if (n === 0) { toast('自动获取失败（网络或跨域限制），请手动输入'); return; }
    for (const k in res) state.prices[k] = { usd: res[k], at: Date.now() };
    saveState();
    closeSheet();
    render();
    buzz(15);
    toast(`已更新 ${n}/7 只股票的现价`);
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mag7-dca-backup-' + todayStr() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('备份已导出');
  }

  async function importJSON(file) {
    try {
      const text = await file.text();
      const s = parseImport(text);
      const ok = await confirmDialog({ title: '导入备份', msg: `将用备份中的 ${s.records.length} 条记录覆盖当前数据。`, ok: '导入' });
      if (!ok) return;
      state = s;
      saveState();
      render();
      buzz(15);
      toast('导入成功');
    } catch (e) {
      toast('导入失败：' + (e && e.message ? e.message : '文件无法解析'));
    }
  }

  async function loadDemo() {
    const ok = await confirmDialog({ title: '载入演示数据', msg: '将生成近 14 个月的模拟定投记录（基于 2026-10 真实价格回溯生成），并覆盖当前记录与现价。', ok: '载入' });
    if (!ok) return;
    seedDemo(state);
    saveState();
    render();
    buzz(15);
    toast('演示数据已载入');
  }

  async function clearData() {
    const ok = await confirmDialog({ title: '清空数据', msg: '将删除全部投资记录与现价（计划与偏好设置保留）。', ok: '清空', danger: true });
    if (!ok) return;
    state.records = [];
    state.prices = {};
    state.demo = false;
    saveState();
    render();
    toast('已清空');
  }

  async function delRecord(id) {
    const r = state.records.find((x) => x.id === id);
    if (!r) return;
    const ok = await confirmDialog({ title: '删除记录', msg: `删除 ${r.date} ${r.symbol} ${fmtUsd(r.usd)} 的记录？`, ok: '删除', danger: true });
    if (!ok) return;
    state.records = state.records.filter((x) => x.id !== id);
    saveState();
    render();
    toast('已删除');
  }

  /* ---------------- 浏览器启动 ---------------- */
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }

  /* ---------------- 导出（供 Node 测试） ---------------- */
  return {
    STOCKS, SYM,
    defaultState, mergeState, loadState, saveState,
    calcHoldings, totals, monthRecorded, planTotal, nextPayday, cumByMonth, niceCeil,
    fmtMoney, fmtUsd, fmtPct, fmtShares, fmtShort, toDisp, pnlClass,
    seedDemo, parseImport, parseGtimg,
    dateStr, todayStr, ymOf, monthLabel, monthShort, clamp, round2, round4, esc, trimNum
  };
});
