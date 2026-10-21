/* =============================================================
   定投 (lldca)
   美股定投记录与收益统计（默认七巨头，41 只预设池 + 任意美股代码自选）
   - 纯前端实现，数据仅存 localStorage，可打包为 Android App
   - 红涨绿跌（中文金融惯例）；默认人民币显示，可切换美元
   - 现价支持腾讯财经行情自动获取（国内可直连）或手动输入
   - License 授权码机制已内置但默认未启用（tools/ 下附授权码生成器，备用）
   ============================================================= */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MAG7 = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  /* ---------------- 常量与元数据 ---------------- */
  // 预设股票池：美股七巨头 + 热门蓝筹/科技/中概，用户可自选
  const STOCK_POOL = [
    { symbol: 'AAPL',  name: '苹果',       color: '#5b8def', base: 342.94 },
    { symbol: 'MSFT',  name: '微软',       color: '#2f9e6e', base: 533.52 },
    { symbol: 'GOOGL', name: '谷歌',       color: '#e8a33d', base: 344.18 },
    { symbol: 'AMZN',  name: '亚马逊',     color: '#e07b39', base: 262.45 },
    { symbol: 'NVDA',  name: '英伟达',     color: '#6fbf73', base: 217.09 },
    { symbol: 'META',  name: 'Meta',       color: '#4a7fd4', base: 705.44 },
    { symbol: 'TSLA',  name: '特斯拉',     color: '#d05b5b', base: 368.06 },
    { symbol: 'AVGO',  name: '博通',       color: '#c2503f', base: 368.92 },
    { symbol: 'AMD',   name: 'AMD',        color: '#a8547d', base: 227.31 },
    { symbol: 'TSM',   name: '台积电',     color: '#8a6fc9', base: 300.44 },
    { symbol: 'INTC',  name: '英特尔',     color: '#4f8fc0', base: 38.94 },
    { symbol: 'QCOM',  name: '高通',       color: '#d4884a', base: 172.16 },
    { symbol: 'MU',    name: '美光',       color: '#5aa6a0', base: 181.05 },
    { symbol: 'MRVL',  name: '迈威尔',     color: '#3f9e8c', base: 126.38 },
    { symbol: 'ORCL',  name: '甲骨文',     color: '#b0523d', base: 285.63 },
    { symbol: 'CRM',   name: 'Salesforce', color: '#4d9fd6', base: 340.72 },
    { symbol: 'ADBE',  name: 'Adobe',      color: '#c0523f', base: 365.19 },
    { symbol: 'NOW',   name: 'ServiceNow', color: '#6f8fd4', base: 985.40 },
    { symbol: 'PLTR',  name: 'Palantir',   color: '#5b7fc0', base: 175.86 },
    { symbol: 'SNOW',  name: 'Snowflake',  color: '#57b8d9', base: 226.41 },
    { symbol: 'SHOP',  name: 'Shopify',    color: '#5aa84f', base: 76.35 },
    { symbol: 'NFLX',  name: '奈飞',       color: '#c0392b', base: 1265.70 },
    { symbol: 'BABA',  name: '阿里巴巴',   color: '#e8842a', base: 172.35 },
    { symbol: 'PDD',   name: '拼多多',     color: '#d0453f', base: 135.62 },
    { symbol: 'JD',    name: '京东',       color: '#b03a48', base: 34.96 },
    { symbol: 'BIDU',  name: '百度',       color: '#3f6fb5', base: 118.42 },
    { symbol: 'JPM',   name: '摩根大通',   color: '#4a6fa5', base: 319.66 },
    { symbol: 'V',     name: 'Visa',       color: '#2f5fa8', base: 348.90 },
    { symbol: 'MA',    name: 'Mastercard', color: '#e07b1f', base: 562.13 },
    { symbol: 'BAC',   name: '美国银行',   color: '#a05a7a', base: 51.24 },
    { symbol: 'GS',    name: '高盛',       color: '#5f7f9f', base: 768.55 },
    { symbol: 'WMT',   name: '沃尔玛',     color: '#3f7fb5', base: 102.48 },
    { symbol: 'COST',  name: '好市多',     color: '#b0523d', base: 985.62 },
    { symbol: 'KO',    name: '可口可乐',   color: '#c0392b', base: 73.85 },
    { symbol: 'PEP',   name: '百事',       color: '#2f5f9e', base: 152.44 },
    { symbol: 'MCD',   name: '麦当劳',     color: '#d4a017', base: 262.31 },
    { symbol: 'NKE',   name: '耐克',       color: '#c0553f', base: 69.47 },
    { symbol: 'DIS',   name: '迪士尼',     color: '#7a5fc0', base: 106.53 },
    { symbol: 'XOM',   name: '埃克森美孚', color: '#b0523d', base: 114.36 },
    { symbol: 'LLY',   name: '礼来',       color: '#c0392b', base: 812.47 },
    { symbol: 'UBER',  name: 'Uber',       color: '#4a7a9f', base: 93.58 }
  ];
  const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'];
  const POOL_MAP = {};
  for (const s of STOCK_POOL) POOL_MAP[s.symbol] = s;
  // 自定义股票调色板（按代码哈希稳定取色）
  const CUSTOM_COLORS = ['#5b8def', '#2f9e6e', '#e8a33d', '#e07b39', '#6fbf73', '#8b6fd8', '#c0553f', '#4a7a9f', '#b0523d', '#c0392b'];
  function colorFor(sym) {
    let h = 0;
    for (let i = 0; i < sym.length; i++) h = (h * 31 + sym.charCodeAt(i)) >>> 0;
    return CUSTOM_COLORS[h % CUSTOM_COLORS.length];
  }
  // 美股代码格式：1-5 个字母，可带 .B 后缀（如 BRK.B）
  const validSym = (s) => /^[A-Z]{1,5}(\.[A-Z])?$/.test(String(s || '').toUpperCase());
  // 查股票元数据：预设池 → 本机自定义注册表
  const SYM = (s) => {
    const up = String(s || '').toUpperCase();
    if (POOL_MAP[up]) return POOL_MAP[up];
    if (state && Array.isArray(state.custom)) {
      const c = state.custom.find((x) => x && x.symbol === up);
      if (c) return c;
    }
    return null;
  };
  // 兜底合成元数据（旧数据或未注册的自定义代码）
  function symMeta(sym) {
    const up = String(sym || '').toUpperCase();
    return SYM(up) || { symbol: up, name: up, color: colorFor(up), custom: !POOL_MAP[up] };
  }

  // 用户选中的股票（默认七巨头；支持预设池外任意代码）
  function activeStocks(st) {
    const list = (st && Array.isArray(st.stocks) && st.stocks.length) ? st.stocks : DEFAULT_SYMBOLS;
    const out = [];
    for (const sym of list) {
      const s = symMeta(sym);
      if (out.indexOf(s) < 0) out.push(s);
    }
    return out;
  }

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

  /* =============================================================
     License 授权（离线校验）
     - deviceId：首次启动随机生成，存本机
     - 授权码：HMAC-SHA256(内置密钥, deviceId) 前 16 位十六进制
     - 注意：纯前端方案可被逆向，仅防止随手分享；如需强校验需服务端
     ============================================================= */
  const LICENSE_SECRET = 'lldca-license-v1.9f3A';
  const LICENSE_PREFIX = 'LLDCA';
  const LICENSE_DEV_KEY = 'lldca.deviceId';
  const LICENSE_DATA_KEY = 'lldca.license';

  const SHA_K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));

  function sha256Bytes(message) {
    const l = message.length;
    const total = ((l + 9 + 63) & ~63);
    const buf = new Uint8Array(total);
    buf.set(message);
    buf[l] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(total - 8, Math.floor(l / 0x20000000));
    dv.setUint32(total - 4, (l * 8) >>> 0);
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const w = new Uint32Array(64);
    for (let i = 0; i < total; i += 64) {
      for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
      for (let t = 16; t < 64; t++) {
        const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let t = 0; t < 64; t++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + SHA_K[t] + w[t]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
    }
    const out = new Uint8Array(32);
    const odv = new DataView(out.buffer);
    odv.setUint32(0, h0); odv.setUint32(4, h1); odv.setUint32(8, h2); odv.setUint32(12, h3);
    odv.setUint32(16, h4); odv.setUint32(20, h5); odv.setUint32(24, h6); odv.setUint32(28, h7);
    return out;
  }

  function hmacSha256Bytes(key, msg) {
    let k = key;
    if (k.length > 64) k = sha256Bytes(k);
    const block = new Uint8Array(64);
    block.set(k);
    const ipad = new Uint8Array(64), opad = new Uint8Array(64);
    for (let i = 0; i < 64; i++) { ipad[i] = block[i] ^ 0x36; opad[i] = block[i] ^ 0x5c; }
    const innerInput = new Uint8Array(64 + msg.length);
    innerInput.set(ipad, 0);
    innerInput.set(msg, 64);
    const innerHash = sha256Bytes(innerInput);
    const outerInput = new Uint8Array(64 + 32);
    outerInput.set(opad, 0);
    outerInput.set(innerHash, 64);
    return sha256Bytes(outerInput);
  }

  const strBytes = (s) => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xff; return u; };
  const toHex = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += ((u8[i] >> 4).toString(16)) + ((u8[i] & 15).toString(16)); return s; };

  function genDeviceId() {
    const bytes = new Uint8Array(6);
    const c = (typeof globalThis !== 'undefined' && globalThis.crypto) ? globalThis.crypto : null;
    if (c && c.getRandomValues) c.getRandomValues(bytes);
    else for (let i = 0; i < 6; i++) bytes[i] = Math.floor(Math.random() * 256);
    return toHex(bytes).toUpperCase();
  }

  // 由设备识别码计算授权码（作者与 App 使用同一算法）
  function licenseCodeFor(deviceId) {
    const mac = hmacSha256Bytes(strBytes(LICENSE_SECRET), strBytes(String(deviceId || '').toUpperCase()));
    const raw = toHex(mac).toUpperCase().slice(0, 16);
    return [raw.slice(0, 4), raw.slice(4, 8), raw.slice(8, 12), raw.slice(12, 16)].join('-');
  }

  // 归一化用户输入：去横线/小写、去 LLDCA 前缀
  function normalizeCode(s) {
    let t = String(s || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (t.indexOf(LICENSE_PREFIX) === 0) t = t.slice(LICENSE_PREFIX.length);
    return t;
  }

  function verifyCode(code, deviceId) {
    const d = String(deviceId || '').toUpperCase();
    if (!d) return false;
    return normalizeCode(code) === normalizeCode(licenseCodeFor(d));
  }

  /* ---------------- 状态管理 ---------------- */
  function defaultState() {
    return {
      v: 2,
      settings: { currency: 'CNY', rate: 7.2, theme: 'light', payDay: 5 },
      stocks: DEFAULT_SYMBOLS.slice(),
      custom: [],
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
      else if (k === 'stocks') {
        if (Array.isArray(o.stocks)) out.stocks = o.stocks.map((x) => String(x).toUpperCase()).filter((x) => validSym(x));
      }
      else if (k === 'custom') {
        if (Array.isArray(o.custom)) out.custom = o.custom.filter((x) => x && validSym(x.symbol)).map((x) => ({
          symbol: String(x.symbol).toUpperCase(),
          name: String(x.name || x.symbol),
          color: x.color || colorFor(String(x.symbol).toUpperCase())
        }));
      }
      else out[k] = o[k];
    }
    if (!out.stocks || !out.stocks.length) out.stocks = DEFAULT_SYMBOLS.slice();
    return out;
  }

  const memStore = {};
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return memStore[k] != null ? memStore[k] : null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { memStore[k] = v; } }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (e) { delete memStore[k]; } }

  function loadState() {
    const raw = lsGet(LS_KEY);
    if (raw) {
      try { return mergeState(defaultState(), JSON.parse(raw)); } catch (e) { /* 损坏则用默认值 */ }
    }
    return defaultState();
  }

  /* ---------------- License 存储 ---------------- */
  function getDeviceId() {
    let id = lsGet(LICENSE_DEV_KEY);
    if (!id || !/^[0-9A-F]{12}$/.test(String(id).toUpperCase())) {
      id = genDeviceId();
      lsSet(LICENSE_DEV_KEY, id);
    }
    return String(id).toUpperCase();
  }

  function licenseState() {
    const deviceId = getDeviceId();
    const raw = lsGet(LICENSE_DATA_KEY);
    if (!raw) return { activated: false, deviceId, code: '' };
    try {
      const d = JSON.parse(raw);
      if (d && d.deviceId === deviceId && verifyCode(d.code, deviceId)) {
        return { activated: true, deviceId, code: normalizeCode(d.code) };
      }
    } catch (e) { /* 忽略 */ }
    return { activated: false, deviceId, code: '' };
  }

  function activateLicense(code) {
    const deviceId = getDeviceId();
    if (!verifyCode(code, deviceId)) return false;
    lsSet(LICENSE_DATA_KEY, JSON.stringify({ code: normalizeCode(licenseCodeFor(deviceId)), deviceId, at: Date.now() }));
    return true;
  }

  function deactivateLicense() { lsDel(LICENSE_DATA_KEY); }

  /* ---------------- 计算逻辑 ---------------- */
  function calcHoldings(st) {
    const h = {};
    for (const s of activeStocks(st)) h[s.symbol] = { symbol: s.symbol, name: s.name, color: s.color, shares: 0, cost: 0 };
    for (const r of st.records || []) {
      const x = h[r.symbol];
      if (!x) continue;
      x.shares += (+r.shares || 0);
      x.cost += (+r.usd || 0);
    }
    for (const k in h) {
      const x = h[k];
      x.avg = x.shares > 0 ? x.cost / x.shares : 0;
      const p = (st.prices && st.prices[k]) ? (+st.prices[k].usd || 0) : 0;
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
    for (const s of activeStocks(st)) m[s.symbol] = 0;
    for (const r of st.records || []) {
      if (ymOf(r.date) === ym) m[r.symbol] = (m[r.symbol] || 0) + (+r.usd || 0);
    }
    return m;
  }

  function planTotal(st) {
    let t = 0;
    for (const s of activeStocks(st)) {
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
    for (const s of activeStocks(st)) walk[s.symbol] = (s.base || 100) * (0.6 + Math.random() * 0.42);
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, clamp(st.settings.payDay, 1, 28), 10, 30, 0);
      const ds = dateStr(d);
      for (const s of activeStocks(st)) {
        const drift = 1 + (Math.random() - 0.44) * 0.13;
        walk[s.symbol] = Math.max(1, walk[s.symbol] * drift);
        const px = round2(walk[s.symbol]);
        const usd = (+st.plan[s.symbol]) || 300;
        st.records.push({ id: genId(), symbol: s.symbol, date: ds, usd, price: px, shares: round4(usd / px), note: '', ts: d.getTime() });
      }
    }
    for (const s of activeStocks(st)) {
      st.prices[s.symbol] = { usd: round2((s.base || 100) * (0.995 + Math.random() * 0.012)), at: Date.now() };
    }
    st.records.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.ts || 0) - (a.ts || 0)));
    return st;
  }

  function parseImport(text) {
    const p = JSON.parse(text);
    if (!p || typeof p !== 'object' || !Array.isArray(p.records)) throw new Error('文件格式不正确');
    const symSet = new Set();
    if (Array.isArray(p.stocks)) for (const x of p.stocks) symSet.add(String(x).toUpperCase());
    for (const r of p.records) {
      if (!r || typeof r.symbol !== 'string' || !validSym(r.symbol)) throw new Error('包含无效的股票代码');
      if (!(+r.usd > 0)) throw new Error('包含无效的金额');
      if (typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) throw new Error('包含无效的日期');
      symSet.add(String(r.symbol).toUpperCase());
    }
    p.stocks = Array.from(symSet);
    if (p.stocks != null && !Array.isArray(p.stocks)) throw new Error('stocks 字段格式不正确');
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

  async function fetchAllPrices(st) {
    const stocks = activeStocks(st || (typeof state !== 'undefined' ? state : null) || defaultState());
    const rs = await Promise.all(stocks.map(async (s) => [s.symbol, await fetchPrice(s.symbol)]));
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
  let stockQuery = '';

  const $ = (id) => document.getElementById(id);

  const IC = {
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 12a8.5 8.5 0 1 1-2.5-6"/><path d="M20.5 3.5V8h-4.5"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="M8 11.5 12 15.5 16 11.5"/><path d="M4.5 19.5h15"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15.5V4.5"/><path d="M8 8 12 4l4 4"/><path d="M4.5 19.5h15"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 7h15"/><path d="M9.5 7V5h5v2"/><path d="M6.5 7l1 13h9l1-13"/><path d="M10 11v5M14 11v5"/></svg>',
    pie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.4"/><path d="M12 3.6V12l7.2 4.2"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 6.5h11M9 12h11M9 17.5h6"/><circle cx="4.6" cy="6.5" r="1.15" fill="currentColor" stroke="none"/><circle cx="4.6" cy="12" r="1.15" fill="currentColor" stroke="none"/><circle cx="4.6" cy="17.5" r="1.15" fill="currentColor" stroke="none"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5.5v13M5.5 12h13"/></svg>',
    key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15.5" r="4.2"/><path d="M11 12.5 20 3.5"/><path d="M17.5 6l2.5 2.5"/><path d="M15 8.5 17.5 11"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5 10 18 19.5 6.5"/></svg>'
  };

  const VIEW_META = {
    home: { title: '定投', actions: '' },
    holdings: { title: '我的持仓', actions: '<button class="icon-btn" data-act="prices" title="更新现价">' + IC.refresh + '</button>' },
    plan: { title: '定投计划', actions: '<button class="icon-btn" data-act="manageStocks" title="管理定投股票">' + IC.plus + '</button>' },
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
    // 软键盘优化①：输入框聚焦时自动滚到可视区中央（弹层/页面通用）
    document.addEventListener('focusin', (e) => {
      const el = e.target;
      if (!el || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      setTimeout(() => {
        try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        catch (_) { try { el.scrollIntoView(); } catch (e2) { /* ignore */ } }
      }, 260);
    });
    // 软键盘优化②：部分 WebView 未 adjustResize 时，把底部弹层抬到键盘上方
    if (window.visualViewport) {
      const vv = window.visualViewport;
      vv.addEventListener('resize', () => {
        const sh = $('sheet');
        if (!sh || !sh.classList.contains('show')) return;
        const kh = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        sh.style.transform = kh > 120 ? 'translate(-50%, ' + kh + 'px)' : '';
      });
    }
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
    add: (sym) => openAddSheet(sym || (activeStocks(state)[0] || {}).symbol || 'AAPL'),
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
    goto: (t) => { closeSheet(); switchTab(t); },
    manageStocks: () => openStockSheet(),
    toggleStock: (sym) => toggleStock(sym),
    addCustom: () => addCustomFromSheet(),
    selectSeven: () => { state.stocks = DEFAULT_SYMBOLS.slice(); saveState(); refreshStockSheet(); toast('已恢复七巨头'); },
    clearStocks: () => { state.stocks = []; saveState(); refreshStockSheet(); },
    stockDone: () => { closeSheet(); render(); }
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
    } else if (kind === 'stockq') {
      stockQuery = el.value.trim();
      renderStockList();
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
    const done = activeStocks(state).reduce((a, s) => a + (rec[s.symbol] || 0), 0);
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

    const planRows = activeStocks(state).filter((s) => ((+state.plan[s.symbol]) || 0) > 0).map((s) => {
      const planned = +state.plan[s.symbol];
      const d = rec[s.symbol] || 0;
      const pct = Math.min(100, d / planned * 100);
      return `<div class="mini-row"><span class="dot" style="background:${s.color}"></span><span class="mini-nm">${s.symbol}</span><div class="progress"><i class="${d >= planned ? 'done' : ''}" style="width:${pct}%"></i></div><span class="mini-vl">${fmtMoney(d)}/${fmtMoney(planned)}</span></div>`;
    }).join('');
    html += `<div class="card"><div class="card-title">本月定投进度<span class="sub">${monthLabel(ym)}</span></div>${planRows || '<div class="hint" style="margin:0">尚未设置定投计划，去「计划」页设置每月金额</div>'}</div>`;

    html += `<div class="card"><div class="card-title">持仓分布<span class="sub">按市值</span></div>${donutHtml(h)}</div>`;
    html += `<div class="card"><div class="card-title">累计投入 vs 当前市值<span class="sub">按月</span></div>${lineHtml()}</div>`;

    const recent = state.records.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.ts || 0) - (a.ts || 0))).slice(0, 3);
    if (recent.length) {
      const rows = recent.map((r) => {
        const s = symMeta(r.symbol);
        return `<div class="row" data-act="delRec" data-arg="${r.id}">
          <span class="dot" style="background:${s.color}">${r.symbol.slice(0, 2)}</span>
          <div class="row-main"><div class="row-title" style="font-size:13.5px">${s.symbol} · ${s.name}</div><div class="row-sub">${r.date}</div></div>
          <div class="row-right"><div class="row-value" style="font-size:13.5px">${fmtMoney(r.usd)}</div></div>
        </div>`;
      }).join('');
      html += `<div class="card"><div class="card-title">最近记录<span class="sub" data-act="goto" data-arg="records" style="cursor:pointer;color:var(--primary)">查看全部</span></div>${rows}</div>`;
    } else {
      html += `<div class="card"><div class="card-title">开始你的定投</div>
        <div class="hint" style="margin:0">1. 到「计划」页选择股票并设置每月定投金额<br>2. 每次扣款后点「记一笔」记录成交金额与价格<br>3. 在「我的」页更新现价，自动计算收益</div>
        <div style="display:flex;gap:10px;margin-top:14px"><button class="btn btn-primary" style="flex:1" data-act="add">记一笔</button><button class="btn btn-ghost" style="flex:1" data-act="demo">载入演示数据</button></div></div>`;
    }

    $('view-home').innerHTML = html;
  }

  /* ---------------- 持仓 ---------------- */
  function renderHoldings() {
    const h = calcHoldings(state);
    const t = totals(h);
    const arr = activeStocks(state).map((s) => h[s.symbol]).sort((a, b) => (b.value - a.value) || (b.shares - a.shares));
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
        <div class="card-title">持仓明细<span class="sub">${activeStocks(state).length} 只 · 点击查看详情 / 改现价</span></div>
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
    const rows = activeStocks(state).map((s) => {
      const planned = (+state.plan[s.symbol]) || 0;
      const d = rec[s.symbol] || 0;
      const pct = planned > 0 ? Math.min(100, d / planned * 100) : 0;
      return `<div class="plan-row">
        <div class="plan-top">
          <span class="dot" style="background:${s.color}">${s.symbol.slice(0, 2)}</span>
          <div class="row-main">
            <div class="row-title">${s.symbol} · ${s.name}</div>
            <div class="row-sub" id="ps-${s.symbol}">${planned > 0 ? '本月 ' + fmtMoney(d) + ' / ' + fmtMoney(planned) : '未设置月投金额'}</div>
          </div>
          <button class="icon-btn" data-act="planplus" data-arg="${s.symbol}" title="记一笔">${IC.plus}</button>
        </div>
        <div class="plan-amt">
          <input class="input" type="text" inputmode="decimal" data-bind="plan:${s.symbol}" data-hint="ph-${s.symbol}" value="${planned > 0 ? trimNum(toDisp(planned, st)) : ''}" placeholder="月投金额">
          <div class="hint" id="ph-${s.symbol}" style="margin:0;flex:1">${planned > 0 ? '≈ ' + fmtUsd(planned) : '设为 0 即暂停该股定投'}</div>
        </div>
        <div class="progress" id="pg-${s.symbol}" style="margin-top:8px;${planned > 0 ? '' : 'display:none'}"><i id="pgi-${s.symbol}" class="${planned > 0 && d >= planned ? 'done' : ''}" style="width:${pct}%"></i></div>
      </div>`;
    }).join('');
    const nStocks = activeStocks(state).length;
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
      <div class="card"><div class="card-title">各股票月投金额<span class="sub">${st.currency === 'CNY' ? '人民币计价' : '美元计价'}</span></div>
        <div class="hint" style="margin:0 0 12px">当前选中 <b>${nStocks}</b> 只股票。点右上角 <b>+</b> 可添加或移除股票（共 ${STOCK_POOL.length} 只可选）。</div>
        ${rows || '<div class="empty">' + IC.pie + '<div class="t">还没有选择股票</div><div class="d">点右上角 + 从股票池中选择要定投的股票</div><div class="btns"><button class="btn btn-primary" data-act="manageStocks">选择股票</button></div></div>'}
      </div>
      <div class="card"><div class="hint" style="margin:0">提示：输入的金额按当前汇率折算为美元入账；之后修改「显示货币」或汇率，不会影响已记录的成本。坚持按计划执行，忽略短期波动。</div></div>`;
  }

  /* ---------------- 记录 ---------------- */
  function renderRecords() {
    const recs = state.records.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.ts || 0) - (a.ts || 0)));
    const list = filterSym === 'ALL' ? recs : recs.filter((r) => r.symbol === filterSym);
    const totalUsd = list.reduce((a, r) => a + r.usd, 0);
    const chips = ['ALL'].concat(activeStocks(state).map((s) => s.symbol)).map((s) =>
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
          const s = symMeta(r.symbol);
          const px = state.prices[r.symbol] ? state.prices[r.symbol].usd : 0;
          const pnl = px > 0 && r.price > 0 ? ((px - r.price) / r.price) * 100 : null;
          return `<div class="row" data-act="delRec" data-arg="${r.id}">
            <span class="dot" style="background:${s.color}">${r.symbol.slice(0, 2)}</span>
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
    const stocks = activeStocks(state);
    const held = stocks.filter((s) => h[s.symbol].shares > 0).length;
    const first = state.records.length ? state.records.map((r) => r.date).sort()[0] : '—';
    const priceRows = stocks.map((s) => {
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
          <div class="stat"><div class="stat-l">持有股票</div><div class="stat-v">${held} / ${stocks.length}</div></div>
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
        <div class="hint" style="margin:0">定投 v1.2.2（lldca）· 数据仅存储在本机（浏览器/应用内），不会上传。更换设备请使用「导出/导入备份」。<br><br>自定义股票：在「计划」页点右上角 <b>+</b> 打开股票选择器，下方「自定义代码」输入框可添加任意美股代码（1-5 位字母，如 NFLX / UBER / CRM，BRK.B 形式亦可）。<br><br>本应用可打包为安卓 App：通过 Capacitor 生成 Android 工程，用 Android Studio 构建 APK，详见项目 README.md。<br><br>注意：本应用仅用于个人投资记录与统计，不构成任何投资建议。股市有风险，投资需谨慎。</div>
      </div>`;
  }

  /* ---------------- 图表 ---------------- */
  function donutHtml(h) {
    const items = activeStocks(state).map((s) => h[s.symbol]).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
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
    sh.style.transform = '';
    sh.classList.add('show');
    $('backdrop').classList.add('show');
    document.body.style.overflow = 'hidden';
    if (onMount) onMount();
  }

  function closeSheet() {
    const sh = $('sheet');
    sh.classList.remove('show');
    sh.style.transform = '';
    $('backdrop').classList.remove('show');
    document.body.style.overflow = '';
    setTimeout(() => { if (!sh.classList.contains('show')) sh.innerHTML = ''; }, 350);
    sheetSym = null;
  }

  function openAddSheet(sym) {
    sheetSym = sym || 'AAPL';
    fCur = state.settings.currency;
    const p = state.prices[sheetSym];
    const chips = activeStocks(state).map((s) => `<button class="chip ${s.symbol === sheetSym ? 'active' : ''}" data-act="fsym" data-arg="${s.symbol}">${s.symbol} ${s.name}</button>`).join('');
    openSheet(`
      <div class="sheet-grip"></div>
      <div class="sheet-title">记一笔</div>
      <div class="sheet-body">
        <div class="field" style="margin-top:4px"><label>股票</label><div class="chips scrollable" id="f-syms">${chips}</div></div>
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
    // 若记录了未选中的股票，自动加入选中列表
    if (activeStocks(state).every((s) => s.symbol !== sym)) {
      state.stocks = activeStocks(state).map((s) => s.symbol).concat(sym);
    }
    saveState();
    closeSheet();
    buzz(15);
    toast('已记录 ' + fmtMoney(usd) + ' → ' + sym);
    render();
  }

  function openPriceSheet() {
    const rows = activeStocks(state).map((s) => {
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

  /* ---------------- 股票选择弹层 ---------------- */
  function openStockSheet() {
    stockQuery = '';
    openSheet(`
      <div class="sheet-grip"></div>
      <div class="sheet-title">选择定投股票<span class="sheet-sub" id="stock-count"></span></div>
      <div class="sheet-body">
        <div class="search-wrap">
          <span class="search-ic">${IC.search}</span>
          <input class="input" id="stock-q" type="text" data-bind="stockq" placeholder="搜索代码或名称，如 NVDA / 英伟达">
        </div>
        <div id="stock-list"></div>
      </div>
      <div class="custom-bar">
        <div class="custom-bar-t">不在列表里？输入代码自定义添加<span class="custom-bar-h">1-5 个字母，如 NFLX / UBER / CRM</span></div>
        <div class="custom-add">
          <input class="input" id="custom-sym" type="text" maxlength="8" autocomplete="off" placeholder="美股代码，如 NFLX">
          <button class="btn btn-primary btn-sm" data-act="addCustom" type="button">添加</button>
        </div>
      </div>
      <div class="sheet-foot" style="display:flex;gap:10px">
        <button class="btn btn-ghost" style="flex:1" data-act="selectSeven">恢复七巨头</button>
        <button class="btn btn-primary" style="flex:1" data-act="stockDone">完成</button>
      </div>`, () => {
      const ci = $('custom-sym');
      if (ci) ci.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomFromSheet(); } });
    });
    renderStockList();
  }

  function refreshStockSheet() {
    renderStockList();
    render();
  }

  function renderStockList() {
    const listEl = $('stock-list');
    const cntEl = $('stock-count');
    if (!listEl) return;
    const q = (stockQuery || '').toUpperCase();
    const selected = activeStocks(state).map((s) => s.symbol);
    const all = STOCK_POOL.concat(state.custom || []);
    const items = all.filter((s) => !q || s.symbol.toUpperCase().indexOf(q) >= 0 || String(s.name).toUpperCase().indexOf(q) >= 0);
    if (cntEl) cntEl.textContent = `已选 ${selected.length}`;
    if (!items.length) {
      listEl.innerHTML = '<div class="hint" style="margin:12px 0">没有匹配的预设股票。<br>可在下方「自定义代码」输入框输入美股代码（1-5 个字母，如 <b>NFLX</b>）点「添加」，加入任意想定投的股票。</div>';
      return;
    }
    listEl.innerHTML = '<div class="stock-grid">' + items.map((s) => {
      const on = selected.indexOf(s.symbol) >= 0;
      const planned = (+state.plan[s.symbol]) || 0;
      const isCustom = !!s.custom || !POOL_MAP[s.symbol];
      return `<button class="stock-item ${on ? 'on' : ''}" data-act="toggleStock" data-arg="${s.symbol}">
        <span class="stock-ck">${on ? IC.check : ''}</span>
        <span class="stock-nm"><b>${s.symbol}</b> ${esc(s.name)}${isCustom ? '<span class="stock-tag">自定义</span>' : ''}${planned > 0 ? '<span class="stock-pl">月投 ' + fmtMoney(planned) + '</span>' : ''}</span>
      </button>`;
    }).join('') + '</div>';
  }

  // 自定义添加任意美股代码
  function addCustomStock(raw) {
    const sym = String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!sym) return '请输入股票代码';
    if (!validSym(sym)) return '代码格式不正确：1-5 个字母，如 NFLX（BRK.B 形式亦可）';
    if (POOL_MAP[sym]) return sym + ' 已在预设池中，直接勾选即可';
    const cur = Array.isArray(state.stocks) ? state.stocks.slice() : DEFAULT_SYMBOLS.slice();
    if (cur.indexOf(sym) >= 0) return sym + ' 已在定投列表中';
    state.custom = Array.isArray(state.custom) ? state.custom : [];
    if (!state.custom.some((x) => x && x.symbol === sym)) {
      state.custom.push({ symbol: sym, name: sym, color: colorFor(sym), custom: true });
    }
    state.stocks = cur.concat(sym);
    saveState();
    refreshStockSheet();
    return null;
  }

  function addCustomFromSheet() {
    const el = $('custom-sym');
    const sym = String((el && el.value) || '').trim().toUpperCase();
    const err = addCustomStock(sym);
    if (err) { toast(err); return; }
    if (el) el.value = '';
    toast('已添加 ' + sym);
    renderStockList();
  }

  function toggleStock(sym) {
    sym = String(sym || '').toUpperCase();
    if (!validSym(sym)) return;
    const cur = activeStocks(state).map((x) => x.symbol);
    const idx = cur.indexOf(sym);
    if (idx >= 0) {
      if (cur.length <= 1) { toast('至少保留一只股票'); return; }
      cur.splice(idx, 1);
    } else {
      cur.push(sym);
    }
    state.stocks = cur;
    saveState();
    refreshStockSheet();
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
    const res = await fetchAllPrices(state);
    const n = Object.keys(res).length;
    if (n === 0) { toast('自动获取失败（网络或跨域限制），请手动输入'); return; }
    for (const k in res) state.prices[k] = { usd: res[k], at: Date.now() };
    saveState();
    closeSheet();
    render();
    buzz(15);
    toast(`已更新 ${n}/${activeStocks(state).length} 只股票的现价`);
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lldca-backup-' + todayStr() + '.json';
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
    const ok = await confirmDialog({ title: '载入演示数据', msg: '将生成近 14 个月的模拟定投记录（基于当前选中股票回溯生成），并覆盖当前记录与现价。', ok: '载入' });
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
    get state() { return state; },
    set state(v) { state = v; },
    STOCK_POOL, DEFAULT_SYMBOLS, SYM, symMeta, activeStocks, validSym, colorFor,
    defaultState, mergeState, loadState, saveState,
    calcHoldings, totals, monthRecorded, planTotal, nextPayday, cumByMonth, niceCeil,
    fmtMoney, fmtUsd, fmtPct, fmtShares, fmtShort, toDisp, pnlClass,
    seedDemo, parseImport, parseGtimg,
    sha256Bytes, hmacSha256Bytes, genDeviceId, licenseCodeFor, normalizeCode, verifyCode,
    dateStr, todayStr, ymOf, monthLabel, monthShort, clamp, round2, round4, esc, trimNum
  };
});
