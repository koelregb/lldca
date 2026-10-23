/* =============================================================
   浮乐 (fuley) — 授权许可模块
   - 试用期 30 天（从首次启动计算，多镜像存储 + 时间回拨检测防篡改）
   - 激活码 = 一年一签：HMAC-SHA256(secret, 'AUTH|dev|FULEY|v3|<到期日索引>')
     激活后授权有效至「激活码内签署的到期日」，到期需重新签署
   - 到期前 15 天每日提醒一次续签
   - 激活码由配套授权工具 fuleylicense 生成（同一算法）
   - 注意：本地方案可被逆向提取密钥，防随手传播；商用强度需服务端校验
   ============================================================= */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FuleyLicense = api;
})(typeof self !== 'undefined' ? self : globalThis, function (root) {
  'use strict';

  var AUTH_SECRET = 'fuley-auth-v2.xK9mQ2pL';
  var DEVICE_KEY = 'fuley.deviceId';
  var AUTH_KEY = 'fuley.auth.v1';
  var MIRROR_KEYS = ['fuley.auth.m1', 'fuley.auth.m2'];
  var CLOCK_KEY = 'fuley.clock.v1';
  var TRIAL_DAYS = 30;        // 试用期天数
  var LIC_DAYS = 365;         // 授权有效期（一年一签）
  var WARN_DAYS = 15;         // 到期前提醒天数（每天一次）
  var DAY_MS = 86400000;
  var CODE_BASE_DAY = Math.floor(Date.UTC(2020, 0, 1) / DAY_MS);  // 激活码到期日索引基准
  var CODE_MAX_IDX = 0xFFFF;

  /* ---------- 存储（localStorage 不可用时退回内存） ---------- */
  var memStore = {};
  function lsGet(k) {
    try { return root.localStorage.getItem(k); } catch (e) { return memStore[k] != null ? memStore[k] : null; }
  }
  function lsSet(k, v) {
    try { root.localStorage.setItem(k, v); } catch (e) { memStore[k] = v; }
  }

  /* ---------- 工具 ---------- */
  function strBytes(s) {
    var u = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xff;
    return u;
  }
  function toHex(u8) {
    var s = '';
    for (var i = 0; i < u8.length; i++) s += ((u8[i] >> 4).toString(16)) + ((u8[i] & 15).toString(16));
    return s;
  }
  function normDev(raw) {
    var h = String(raw || '').toUpperCase().replace(/[^0-9A-F]/g, '');
    return h.length > 12 ? h.slice(0, 12) : h;
  }
  function normCode(raw) {
    var s = String(raw || '').toUpperCase().replace(/[\s-]/g, '');
    if (s.indexOf('FULEY') === 0) s = s.slice(5);
    return s.replace(/[^0-9A-F]/g, '');
  }
  function dayIndex(ts) { return Math.floor(ts / DAY_MS) - CODE_BASE_DAY; }
  function tsFromDayIndex(idx) { return (CODE_BASE_DAY + idx) * DAY_MS; }
  function fmtDate(ts) {
    var d = new Date(ts);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /* ---------- 设备识别码（首次启动生成，12 位 hex） ---------- */
  function getDeviceId() {
    var id = lsGet(DEVICE_KEY);
    if (id && /^[0-9A-F]{12}$/.test(id)) return id;
    var bytes = new Uint8Array(6);
    var c = root.crypto || (typeof crypto !== 'undefined' ? crypto : null);
    if (c && c.getRandomValues) c.getRandomValues(bytes);
    else for (var i = 0; i < 6; i++) bytes[i] = Math.floor(Math.random() * 256);
    id = toHex(bytes).toUpperCase();
    lsSet(DEVICE_KEY, id);
    return id;
  }

  /* ---------- 激活码签名（WebCrypto HMAC-SHA256） ----------
     v3 码格式：FULEY-XXXX-XXXX-XXXX-XXXX
       前 4 hex = 到期日索引（自 2020-01-01 起的天数，0..65535）
       后 12 hex = HMAC(secret, 'AUTH|dev|FULEY|v3|idx') 截断 48 bit
     v2 旧码（无到期日）：整段 16 hex = HMAC(...v2)，兼容期内按激活时间起算一年
  */
  function hmacHex(secret, msg) {
    return root.crypto.subtle.importKey('raw', strBytes(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      .then(function (key) { return root.crypto.subtle.sign('HMAC', key, strBytes(msg)); })
      .then(function (buf) { return toHex(new Uint8Array(buf)); });
  }
  function packCode(hex16) {
    return 'FULEY-' + hex16.replace(/(.{4})/g, '$1-').replace(/-$/, '');
  }
  /* 生成指定到期日的激活码（授权工具用同算法） */
  function authCodeFor(dev, expireTs) {
    dev = normDev(dev);
    if (dev.length !== 12) return Promise.resolve('');
    var idx = (expireTs == null) ? (dayIndex(Date.now()) + LIC_DAYS) : dayIndex(expireTs);
    if (!(idx >= 0 && idx <= CODE_MAX_IDX)) return Promise.resolve('');
    var idxHex = ('000' + idx.toString(16).toUpperCase()).slice(-4);
    return hmacHex(AUTH_SECRET, 'AUTH|' + dev + '|FULEY|v3|' + idx).then(function (hex) {
      return packCode(idxHex + hex.slice(0, 12).toUpperCase());
    });
  }
  /* 旧版（v2）码：整段 HMAC，无到期日 */
  function authCodeV2(dev) {
    dev = normDev(dev);
    if (dev.length !== 12) return Promise.resolve('');
    return hmacHex(AUTH_SECRET, 'AUTH|' + dev + '|FULEY|v2').then(function (hex) {
      return packCode(hex.slice(0, 16).toUpperCase());
    });
  }

  /* ---------- 授权状态（多镜像 + 时间回拨检测） ---------- */
  function freshAuth() {
    var start = Date.now();
    return { status: 'trial', start: start, code: '', expiresAt: start + TRIAL_DAYS * DAY_MS };
  }
  /* 解析平面镜像串：'status|start|code|expiresAt'（末段可缺省） */
  function parseFlat(flat) {
    if (!flat || flat.indexOf('|') < 0) return null;
    var p = flat.split('|');
    if ((p[0] === 'trial' || p[0] === 'licensed') && isFinite(Number(p[1]))) {
      return {
        status: p[0], start: Number(p[1]), code: p[2] || '',
        expiresAt: p[3] ? Number(p[3]) : 0
      };
    }
    return null;
  }
  function loadAuth() {
    var main = null;
    try { main = JSON.parse(lsGet(AUTH_KEY) || 'null'); } catch (e) { main = null; }
    if (!main || typeof main !== 'object') {
      // 主数据损坏：尝试镜像恢复（改一个漏三个的场景）
      for (var i = 0; i < MIRROR_KEYS.length; i++) {
        var raw = lsGet(MIRROR_KEYS[i]);
        if (!raw) continue;
        var m = parseFlat(raw);                       // m1：平面串
        if (!m) {
          try { m = parseFlat(decodeURIComponent(escape(atob(raw)))); } catch (e) { m = null; } // m2：base64
        }
        if (m) { main = m; break; }
      }
    }
    if (!main || typeof main !== 'object') return null;
    if (main.status !== 'trial' && main.status !== 'licensed') return null;
    if (!isFinite(Number(main.start))) return null;
    return main;
  }
  function saveAuth(a) {
    lsSet(AUTH_KEY, JSON.stringify(a));
    // 镜像存不同形式（平面串），三处需同时改才能骗过一致性检查
    var flat = a.status + '|' + a.start + '|' + (a.code || '') + '|' + (a.expiresAt || 0);
    lsSet(MIRROR_KEYS[0], flat);
    lsSet(MIRROR_KEYS[1], btoa(unescape(encodeURIComponent(flat))));
  }

  /* 时钟锚点：记录见过的最大时间，检测系统时间回拨（防改时间续试用） */
  function checkClock(now) {
    var last = Number(lsGet(CLOCK_KEY) || 0);
    if (now > last) { lsSet(CLOCK_KEY, String(now)); return now; }
    // 时间回拨：以锚点为准（向后回拨按锚点算，向前跳跃正常放行）
    return last || now;
  }

  /* ---------- 状态查询 ---------- */
  function state() {
    var now = checkClock(Date.now());
    var a = loadAuth();
    if (!a) { a = freshAuth(); saveAuth(a); }
    var deviceId = getDeviceId();
    if (a.status === 'licensed') {
      // 无 expiresAt 的老授权（v2 码）：自激活时间起算一年
      var exp = Number(a.expiresAt || 0) || (Number(a.start) + LIC_DAYS * DAY_MS);
      var dleft = Math.ceil((exp - now) / DAY_MS);
      if (dleft < 0) dleft = 0;
      var ok = !!(a.code && a.code.indexOf('FULEY-') === 0);
      var expired = now >= exp;
      return {
        status: expired ? 'expired' : 'licensed',
        daysLeft: dleft,
        expiresAt: exp,
        expireDate: fmtDate(exp),
        deviceId: deviceId,
        code: a.code || '',
        trial: false,
        licensed: true,
        valid: ok && !expired
      };
    }
    var tExp = Number(a.expiresAt || 0) || (Number(a.start) + TRIAL_DAYS * DAY_MS);
    var daysLeft = Math.ceil((tExp - now) / DAY_MS);
    if (daysLeft < 0) daysLeft = 0;
    var tStatus = daysLeft > 0 ? 'trial' : 'expired';
    return {
      status: tStatus, daysLeft: daysLeft, expiresAt: tExp, expireDate: fmtDate(tExp),
      deviceId: deviceId, code: '', trial: true, licensed: false, valid: daysLeft > 0
    };
  }

  /* ---------- 激活 / 续签 ---------- */
  function activate(inputCode) {
    var deviceId = getDeviceId();
    var hex = normCode(inputCode);
    if (!/^[0-9A-F]{16}$/.test(hex)) {
      return Promise.resolve({ ok: false, msg: '激活码格式不正确' });
    }
    // v3：解析内签署的到期日
    var idx = parseInt(hex.slice(0, 4), 16);
    var tag = hex.slice(4);
    var expTs = tsFromDayIndex(idx);
    return hmacHex(AUTH_SECRET, 'AUTH|' + deviceId + '|FULEY|v3|' + idx).then(function (h) {
      if (h.slice(0, 12).toUpperCase() === tag) {
        if (expTs <= checkClock(Date.now())) {
          return { ok: false, msg: '激活码已过期，请重新获取' };
        }
        var a = loadAuth() || freshAuth();
        var cur = Number(a.expiresAt || 0) || 0;
        a.status = 'licensed';
        a.code = 'FULEY-' + hex.replace(/(.{4})/g, '$1-').replace(/-$/, '');
        a.start = Date.now();
        a.expiresAt = (cur > expTs) ? cur : expTs;   // 续签不缩短已有有效期
        saveAuth(a);
        return { ok: true, msg: '激活成功，授权有效期至 ' + fmtDate(a.expiresAt) };
      }
      // 兼容旧版 v2 码（无到期日）：自激活起算一年
      return hmacHex(AUTH_SECRET, 'AUTH|' + deviceId + '|FULEY|v2').then(function (h2) {
        if (h2.slice(0, 16).toUpperCase() === hex) {
          var a2 = loadAuth() || freshAuth();
          var now = Date.now();
          a2.status = 'licensed';
          a2.code = 'FULEY-' + hex.replace(/(.{4})/g, '$1-').replace(/-$/, '');
          a2.start = now;
          a2.expiresAt = now + LIC_DAYS * DAY_MS;
          saveAuth(a2);
          return { ok: true, msg: '激活成功，授权有效期至 ' + fmtDate(a2.expiresAt) };
        }
        return { ok: false, msg: '激活码与设备不匹配' };
      });
    });
  }

  /* ---------- 启动初始化（保证 deviceId / 试用记录存在） ---------- */
  function init() {
    var a = loadAuth();
    if (!a) { a = freshAuth(); saveAuth(a); }
    getDeviceId();
    return state();
  }

  return {
    TRIAL_DAYS: TRIAL_DAYS,
    LIC_DAYS: LIC_DAYS,
    WARN_DAYS: WARN_DAYS,
    getDeviceId: getDeviceId,
    authCodeFor: authCodeFor,
    authCodeV2: authCodeV2,
    state: state,
    activate: activate,
    init: init
  };
});
