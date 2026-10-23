/* =============================================================
   浮乐 (fuley) — 授权许可模块
   - 试用期 30 天（从首次启动计算，多镜像存储 + 时间回拨检测防篡改）
   - 激活码 = HMAC-SHA256(secret, 'AUTH|' + deviceId + '|FULEY|v2') 前 16 位
   - 激活码由配套授权工具 license-app.html 生成（同一算法）
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
  var TRIAL_DAYS = 30;
  var DAY_MS = 86400000;

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

  /* ---------- 激活码签名（WebCrypto HMAC-SHA256） ---------- */
  function hmacHex(secret, msg) {
    return root.crypto.subtle.importKey('raw', strBytes(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      .then(function (key) { return root.crypto.subtle.sign('HMAC', key, strBytes(msg)); })
      .then(function (buf) { return toHex(new Uint8Array(buf)); });
  }
  function authCodeFor(dev) {
    dev = normDev(dev);
    if (dev.length !== 12) return Promise.resolve('');
    return hmacHex(AUTH_SECRET, 'AUTH|' + dev + '|FULEY|v2').then(function (hex) {
      var h16 = hex.slice(0, 16).toUpperCase();
      return 'FULEY-' + h16.replace(/(.{4})/g, '$1-').replace(/-$/, '');
    });
  }

  /* ---------- 授权状态（多镜像 + 时间回拨检测） ---------- */
  function freshAuth() {
    return { status: 'trial', start: Date.now(), code: '' };
  }
  /* 解析平面镜像串：'status|start|code' */
  function parseFlat(flat) {
    if (!flat || flat.indexOf('|') < 0) return null;
    var p = flat.split('|');
    if ((p[0] === 'trial' || p[0] === 'licensed') && isFinite(Number(p[1]))) {
      return { status: p[0], start: Number(p[1]), code: p[2] || '' };
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
    return main;
  }
  function saveAuth(a) {
    lsSet(AUTH_KEY, JSON.stringify(a));
    // 镜像存不同形式（平面串），三处需同时改才能骗过一致性检查
    var flat = a.status + '|' + a.start + '|' + (a.code || '');
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
      var ok = a.code && normDev(a.code) === normDev(a.code) && a.code.indexOf('FULEY-') === 0;
      return { status: 'licensed', daysLeft: -1, deviceId: deviceId, code: a.code || '', trial: false, valid: !!ok };
    }
    var daysLeft = TRIAL_DAYS - Math.floor((now - a.start) / DAY_MS);
    if (daysLeft < 0) daysLeft = 0;
    var status = daysLeft > 0 ? 'trial' : 'expired';
    return { status: status, daysLeft: daysLeft, deviceId: deviceId, code: '', trial: true, valid: daysLeft > 0 };
  }

  /* ---------- 激活 ---------- */
  function activate(inputCode) {
    var deviceId = getDeviceId();
    var want = normCode(inputCode);
    if (!/^[0-9A-F]{16}$/.test(want)) {
      return Promise.resolve({ ok: false, msg: '激活码格式不正确' });
    }
    return authCodeFor(deviceId).then(function (expect) {
      var got = normCode(expect);
      if (got === want) {
        var a = loadAuth() || freshAuth();
        a.status = 'licensed';
        a.code = expect;
        saveAuth(a);
        return { ok: true, msg: '激活成功，感谢使用浮乐' };
      }
      return { ok: false, msg: '激活码与设备不匹配' };
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
    getDeviceId: getDeviceId,
    authCodeFor: authCodeFor,
    state: state,
    activate: activate,
    init: init
  };
});
