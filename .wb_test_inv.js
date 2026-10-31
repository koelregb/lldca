/* 冒烟测试：已定投子tab（quoteCodeFor / invHoldings / fetchInvestQuotes / renderInvests / 表单校验） */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const www = path.join(__dirname, 'www');
const appSrc = fs.readFileSync(path.join(www, 'app.js'), 'utf8');
const i18nSrc = fs.readFileSync(path.join(www, 'i18n.js'), 'utf8');

/* ---------- 最小 DOM / 存储 / fetch stub ---------- */
function mkEl(id) {
  return {
    id: id, innerHTML: '', textContent: '', value: '', style: {},
    attrs: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k] != null ? this.attrs[k] : null; },
    addEventListener() {}, removeEventListener() {},
    appendChild() {}, removeChild() {}, querySelectorAll() { return []; },
  };
}
const els = {};
function el(id) { if (!els[id]) els[id] = mkEl(id); return els[id]; }
const documentStub = {
  getElementById(id) { return el(id); },
  querySelectorAll() { return []; },
  querySelector() { return null; },
  createTreeWalker() { return { nextNode() { return null; } }; },
  createElement() { return mkEl('tmp'); },
  addEventListener() {},
  readyState: 'complete',
  documentElement: mkEl('html'),
  body: mkEl('body'),
};
const localStorageStub = {
  store: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
};
/* 腾讯行情假响应：f[3]=现价 f[30]=时间 */
function quoteResp(code, price, tm) {
  const f = [];
  for (let i = 0; i < 34; i++) f.push(i === 3 ? String(price) : i === 30 ? tm : 'x' + i);
  f[1] = '测试标的'; f[2] = code;
  return 'v_' + code + '="' + f.join('~') + '";\n';
}
const fetchLog = [];
const fetchStub = function (url) {
  fetchLog.push(url);
  let body = '';
  if (url.indexOf('sh510300') >= 0) body += quoteResp('sh510300', 4.123, '20261023112742');
  if (url.indexOf('usNVDA') >= 0) body += quoteResp('usNVDA', 182.5, '20261023112742');
  return Promise.resolve({ text: function () { return Promise.resolve(body); } });
};
const windowStub = {
  navigator: { language: 'zh-CN' },
  localStorage: localStorageStub,
  document: documentStub,
  location: { reload() {} },
  addEventListener() {},
};
const sandbox = {
  window: windowStub,
  document: documentStub,
  localStorage: localStorageStub,
  navigator: windowStub.navigator,
  location: windowStub.location,
  fetch: fetchStub,
  console: console,
  setTimeout: setTimeout, clearTimeout: clearTimeout,
  setInterval: function () { return 0; }, clearInterval: function () {},
};
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(i18nSrc, sandbox);
vm.runInContext(appSrc, sandbox);

/* ---------- 断言 ---------- */
let pass = 0, fail = 0;
const toasts = [];          // 供多个 then 段共用
function eq(label, got, want) {
  const ok = got === want;
  if (ok) pass++; else fail++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + label + (ok ? '' : '  got=' + JSON.stringify(got) + ' want=' + JSON.stringify(want)));
}
function ok(label, cond, detail) {
  if (cond) pass++; else fail++;
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + label + (cond ? '' : '  ' + (detail || '')));
}

const A = sandbox;   // app.js 顶层 var 挂在 context 上

/* 1) 代码转换规则（沪 6/5/9 · 深 0/1/2/3 · 北 4/8/92） */
eq('quoteCodeFor A股6位(6开头)', A.quoteCodeFor('600519'), 'sh600519');
eq('quoteCodeFor 沪ETF(5开头)', A.quoteCodeFor('510300'), 'sh510300');
eq('quoteCodeFor 科创板(688)', A.quoteCodeFor('688981'), 'sh688981');
eq('quoteCodeFor 深市A股', A.quoteCodeFor('000001'), 'sz000001');
eq('quoteCodeFor 创业板(300)', A.quoteCodeFor('300750'), 'sz300750');
eq('quoteCodeFor 北交所(430)', A.quoteCodeFor('430047'), 'bj430047');
eq('quoteCodeFor 北交所(920)', A.quoteCodeFor('920819'), 'bj920819');
eq('quoteCodeFor 港股5位', A.quoteCodeFor('00700'), 'hk00700');
eq('quoteCodeFor 美股字母', A.quoteCodeFor('NVDA'), 'usNVDA');
eq('quoteCodeFor 带前缀原样', A.quoteCodeFor('sh000001'), 'sh000001');
eq('quoteCodeFor 空串', A.quoteCodeFor(''), '');

/* 2) 格式化 */
eq('fmtQty 整数', A.fmtQty(500), '500');
eq('fmtQty 小数', A.fmtQty(100.5), '100.50');
eq('fmtPx <100 三位', A.fmtPx(3.85), '3.850');
eq('fmtPx >=100 两位', A.fmtPx(182.5), '182.50');

/* 3) 聚合统计：同名同码两笔 → 加权均价 */
A.invests.length = 0;
A.invests.push({ id: 'a', name: '沪深300ETF', code: '510300', ts: '2026-09-01', price: 3.8, qty: 500 });
A.invests.push({ id: 'b', name: '沪深300ETF', code: '510300', ts: '2026-10-01', price: 3.9, qty: 500 });
A.invests.push({ id: 'c', name: '英伟达', code: 'NVDA', ts: '2026-10-02', price: 180, qty: 2 });
const hs = A.invHoldings();
eq('聚合成 2 个头寸', hs.length, 2);
const hEtf = hs.filter(function (h) { return h.name === '沪深300ETF'; })[0];
eq('ETF 数量合计', hEtf.qty, 1000);
ok('ETF 加权均价≈3.85', Math.abs(hEtf.avg - 3.85) < 1e-9, 'avg=' + hEtf.avg);
eq('ETF 行明细 2 条', hEtf.rows.length, 2);
eq('行按日期升序', hEtf.rows[0].ts, '2026-09-01');
ok('未取价前 cur=null', hEtf.cur === null && hEtf.pnl === null && hEtf.rate === null);

/* 4) 联网取价 */
return A.fetchInvestQuotes().then(function (changed) {
  ok('fetchInvestQuotes 价格有更新', changed === true, 'changed=' + changed);
  const invUrl = fetchLog.filter(function (u) { return u.indexOf('q=sh510300') >= 0; })[0];
  ok('请求为腾讯行情批量接口', invUrl === 'https://qt.gtimg.cn/q=sh510300,usNVDA', invUrl);
  eq('A股价入缓存', A.invQuotes['510300'].price, 4.123);
  eq('美股价入缓存', A.invQuotes['NVDA'].price, 182.5);

  /* 5) 渲染（含浮盈：现价 4.123 > 均价 3.85 → up 红） */
  A.renderInvests();
  const listHtml = els['invList'].innerHTML, sumHtml = els['invSum'].innerHTML;
  ok('列表含标的名', listHtml.indexOf('沪深300ETF') >= 0);
  ok('列表含代码徽章', listHtml.indexOf('>510300<') >= 0);
  ok('列表含加权均价 3.850', listHtml.indexOf('¥3.850') >= 0);
  ok('列表含现价 4.123', listHtml.indexOf('¥4.123') >= 0);
  ok('列表含单笔定投价 3.900', listHtml.indexOf('¥3.900') >= 0);
  ok('汇总含累计投入 ¥4,210', sumHtml.indexOf('4,210') >= 0, sumHtml);
  ok('浮盈用 up 红（涨）', listHtml.indexOf('inv-rate up') >= 0);
  /* 币种：A股 ¥ / 美股 $ / 混币种合计不误标符号 */
  ok('美股价格用 $（定投价 180.00）', listHtml.indexOf('$180.00') >= 0, listHtml);
  ok('美股现价用 $（182.50）', listHtml.indexOf('$182.50') >= 0);
  ok('A股仍用 ¥（3.850）', listHtml.indexOf('¥3.850') >= 0);
  ok('混币种合计不误标 ¥', sumHtml.indexOf('¥4,210') < 0 && sumHtml.indexOf('4,210') >= 0, sumHtml);
  ok('汇总浮动盈亏带 +', sumHtml.indexOf('+278') >= 0, sumHtml);
  ok('单笔行可点编辑', listHtml.indexOf("editInv('a')") >= 0);

  /* 6) 表单校验：空名称 / 空价 / 空量 */
  A.toast = function (m) { toasts.push(m); };
  el('ifName').value = ''; el('ifCode').value = '510300';
  el('ifTs').value = '2026-10-20'; el('ifPrice').value = ''; el('ifQty').value = '100';
  A.saveInvForm();
  eq('缺名称 → 提示', toasts[toasts.length - 1], '请填写股票名称');
  el('ifName').value = '测试';
  A.saveInvForm();
  eq('缺价格 → 提示', toasts[toasts.length - 1], '请填写定投股价');
  el('ifPrice').value = '0';
  A.saveInvForm();
  eq('价格为0 → 提示', toasts[toasts.length - 1], '请填写定投股价');
  el('ifPrice').value = '4';
  el('ifQty').value = '';
  A.saveInvForm();
  eq('缺数量 → 提示', toasts[toasts.length - 1], '请填写定投数量');

  /* 7) 合法保存 → 新增一条并落库 */
  const before = A.invests.length;
  el('ifName').value = '中证500'; el('ifCode').value = '510500';
  el('ifTs').value = '2026-10-15'; el('ifPrice').value = '6.423'; el('ifQty').value = '300';
  A.saveInvForm();
  eq('新增一条记录', A.invests.length, before + 1);
  const r = A.invests[A.invests.length - 1];
  eq('记录字段-名称', r.name, '中证500');
  eq('记录字段-代码', r.code, '510500');
  eq('记录字段-股价', r.price, 6.423);
  eq('记录字段-数量', r.qty, 300);
  ok('localStorage 已写入', (localStorageStub.store['fuley.invests.v1'] || '').indexOf('中证500') >= 0);
  ok('保存 toast', toasts.indexOf('已保存定投记录') >= 0);

  /* 8) 删除 */
  A.editInv(r.id);
  eq('editInv 置编辑 id', A.editInvId, r.id);
  A.delInv();
  eq('删除后条数还原', A.invests.length, before);
  ok('删除 toast', toasts.indexOf('已删除该定投记录') >= 0);

  /* 9) 空态 */
  A.invests.length = 0;
  A.renderInvests();
  ok('空态提示', els['invList'].innerHTML.indexOf('还没有定投记录') >= 0);
  eq('空态汇总清空', els['invSum'].innerHTML, '');

  /* 10) 仅无代码记录 → 不触发取价请求 */
  A.invests.length = 0;
  const n0 = fetchLog.length;
  A.invests.push({ id: 'd', name: '无代码标的', code: '', ts: '2026-10-01', price: 10, qty: 1 });
  return A.fetchInvestQuotes().then(function () {
    eq('无代码不发请求', fetchLog.length, n0);
    A.renderInvests();
    ok('无代码也渲染', els['invList'].innerHTML.indexOf('无代码标的') >= 0);
    ok('无代码无现价占位', els['invList'].innerHTML.indexOf('¥—') < 0);
  });
}).then(function () {
  /* ============ 收益子 tab ============ */
  A.invests.length = 0;
  A.invests.push({ id: 'a', name: '沪深300ETF', code: '510300', ts: '2026-09-01', price: 3.8, qty: 500 });
  A.invests.push({ id: 'b', name: '沪深300ETF', code: '510300', ts: '2026-10-01', price: 3.9, qty: 500 });
  A.invests.push({ id: 'c', name: '英伟达', code: 'NVDA', ts: '2026-10-02', price: 180, qty: 2 });
  return A.fetchInvestQuotes().then(function () {
    A.renderPnl();
    const sumHtml = els['pnlSum'].innerHTML, rankHtml = els['pnlRank'].innerHTML, monHtml = els['pnlMonths'].innerHTML;
    ok('汇总含总收益率', sumHtml.indexOf('总收益率') >= 0);
    ok('总收益率 +6.60%', sumHtml.indexOf('+6.60%') >= 0, sumHtml);
    ok('汇总浮动盈亏 +278', sumHtml.indexOf('+278') >= 0, sumHtml);
    ok('排行标题', rankHtml.indexOf('收益排行') >= 0);
    ok('ETF 收益 +7.09%', rankHtml.indexOf('+7.09%') >= 0);
    ok('NVDA 收益 +1.39%', rankHtml.indexOf('+1.39%') >= 0);
    ok('ETF 盈亏 +¥273', rankHtml.indexOf('+¥273') >= 0);
    ok('按收益率降序（ETF 在前）', rankHtml.indexOf('沪深300ETF') < rankHtml.indexOf('英伟达'));
    ok('按月投入标题', monHtml.indexOf('按月投入') >= 0);
    ok('9 月 ¥1,900 1 笔', monHtml.indexOf('¥1,900') >= 0 && monHtml.indexOf('1 笔') >= 0);
    ok('10 月 ¥2,310 2 笔', monHtml.indexOf('2,310') >= 0 && monHtml.indexOf('2 笔') >= 0, monHtml);
    ok('混币种月份不误标 ¥2,310', monHtml.indexOf('¥2,310') < 0, monHtml);
    /* 空态 */
    A.invests.length = 0;
    A.renderPnl();
    ok('空态引导', els['pnlRank'].innerHTML.indexOf('暂无收益数据') >= 0);
    eq('空态汇总清空', els['pnlSum'].innerHTML, '');
  });
}).then(function () {
  /* ============ 加减仓：关联价格 ============ */
  A.signals.length = 0;
  A.sigQuotes = {};
  /* 1) 带代码的新信号 → 首次取价 changed=true */
  A.signals.push({ id: 't1', name: '英伟达', code: 'NVDA', type: 'price', dir: 1, price: 200, fired: false });

  return A.fetchSignalQuotes().then(function (changed) {
    ok('信号取价有更新', changed === true);
    eq('美股现价入缓存', A.sigQuotes['NVDA'].price, 182.5);
    ok('信号取价请求命中', fetchLog.filter(function (u) { return u.indexOf('usNVDA') >= 0; }).length >= 1);
    const sg = A.signals[0];
    eq('提醒方向=加仓', sg.dir, 1);
    ok('sigQuote 返回现价+昨收', A.sigQuote(sg).price === 182.5 && A.sigQuote(sg).prev === 182.5);

    /* 列表显示：现价 / 距触发（涨到 200，现价 182.5 → 还需 +9.6%） */
    A.renderSignals();
    const sigHtml = els['sigList'].innerHTML;
    ok('列表显示代码徽章', sigHtml.indexOf('>NVDA<') >= 0);
    ok('列表显示现价 $182.50', sigHtml.indexOf('现价 $182.50') >= 0, sigHtml);
    ok('条件文案带币种（涨到 $200.00）', sigHtml.indexOf('涨到 $200.00') >= 0, sigHtml);
    ok('列表显示距触发 +9.6%', sigHtml.indexOf('距触发 +9.6%') >= 0);
    ok('未触发显示监控中', sigHtml.indexOf('监控中') >= 0);

    /* 触发判定：目标 200 未到（182.5 < 200）→ 不触发 */
    A.checkSignalTriggers();
    ok('未到价不触发', sg.fired !== true);
    /* 改目标 180（低于现价）→ 触发 */
    sg.price = 180;
    A.checkSignalTriggers();
    eq('到价即触发', sg.fired, true);
    ok('触发后 toast 通知（含美元符号）', toasts.some(function (t) { return t.indexOf('英伟达 已到 $182.50') >= 0; }), toasts.join('|'));

    /* 2) 表单流：保存带代码的减仓提醒（A股 ETF） */
    A.signals.length = 0;
    A.editSigId = null; A.sheetDir = -1;
    el('sfName').value = '沪深300ETF'; el('sfCode').value = '510300';
    el('sfType').value = 'price'; el('sfPrice').value = '3.5';
    el('sfTime').value = ''; el('sfPe').value = '';
    A.saveSignalForm();
    eq('新增减仓提醒', A.signals.length, 1);
    eq('提醒带代码', A.signals[0].code, '510300');
    eq('提醒方向=减仓', A.signals[0].dir, -1);
    ok('localStorage 已写入提醒', (localStorageStub.store['fuley.signals.v1'] || '').indexOf('510300') >= 0);
    return A.fetchSignalQuotes().then(function () {
      const sg2 = A.signals[0];
      ok('A股ETF取价成功', A.sigQuotes['510300'].price === 4.123);
      A.checkSignalTriggers();
      ok('未跌破目标价不触发', sg2.fired !== true);
      A.renderSignals();
      ok('列表显示 ETF 现价', els['sigList'].innerHTML.indexOf('现价 ¥4.123') >= 0);
      ok('距触发为负（需下跌）', els['sigList'].innerHTML.indexOf('距触发 -15.1%') >= 0, els['sigList'].innerHTML);

      /* 填入现价：表单代码 → 缓存价直接填入 */
      el('sfName').value = ''; el('sfCode').value = 'NVDA'; el('sfPrice').value = '';
      A.fillSigPrice();
      eq('填入现价-缓存', el('sfPrice').value, '182.50');
      /* 无代码无名称 → 提示 */
      el('sfName').value = ''; el('sfCode').value = '';
      A.fillSigPrice();
      ok('无代码提示填写', toasts.some(function (t) { return t.indexOf('请先填写代码') >= 0; }));

      /* 指数名称回退：不填代码也能关联指数行情（恒生 / 上证已下线） */
      const sp = A.INDICES.filter(function (x) { return x.name === '标普500'; })[0];
      sp.price = 7800;
      ok('sigQuote 指数名回退', A.sigQuote({ type: 'price', name: '标普500', code: '' }).price === 7800);
      ok('恒生 / 上证已移除', A.INDICES.length === 2 && !A.INDICES.some(function (x) { return /恒生|上证/.test(x.name); }));
      A.renderIdxStrip();
      const stripHtml = els['idxStrip'].innerHTML;
      ok('顶部报价条含纳指与标普', stripHtml.indexOf('纳斯达克') >= 0 && stripHtml.indexOf('标普500') >= 0, stripHtml);
      ok('报价条带涨跌百分比', /[+-]\d+\.\d{2}%/.test(stripHtml), stripHtml);

      /* 定时提醒不取价 */
      A.signals.length = 0;
      A.editSigId = null; A.sheetDir = 1;
      el('sfName').value = '每周复盘'; el('sfCode').value = '';
      el('sfType').value = 'time'; el('sfTime').value = '每周五 14:30'; el('sfPrice').value = '';
      A.saveSignalForm();
      eq('新增定时提醒', A.signals.length, 1);
      const before2 = fetchLog.length;
      return A.fetchSignalQuotes().then(function () {
        eq('定时提醒不发行情请求', fetchLog.length, before2);
        A.renderSignals();
        ok('定时提醒正常渲染', els['sigList'].innerHTML.indexOf('定时 每周五 14:30') >= 0);
      });
    });
  });
}).then(function () {
  /* ============ 财报日历 ============ */
  const codes = {};
  A.EARN.forEach(function (e) { codes[e.c] = 1; });
  ok('财报表覆盖七巨头', Object.keys(codes).length === 7, Object.keys(codes).join(','));
  ok('财报表 ≥ 4 个季度', A.EARN.length >= 28, 'n=' + A.EARN.length);
  ok('财报日期格式统一', A.EARN.every(function (e) { return /^\d{4}-\d{2}-\d{2}$/.test(e.d); }));
  ok('财报日期全在工作日', A.EARN.every(function (e) {
    const w = new Date(e.d + 'T00:00:00').getDay();
    return w >= 1 && w <= 5;
  }), A.EARN.filter(function (e) { const w = new Date(e.d + 'T00:00:00').getDay(); return w < 1 || w > 5; }).map(function (e) { return e.d; }).join(','));
  ok('每家每季度唯一', (function () {
    const seen = {};
    for (const e of A.EARN) { const k = e.c + e.d; if (seen[k]) return false; seen[k] = 1; }
    return true;
  })());

  /* 渲染：下一个财报 + 列表 */
  A.renderEarn();
  const nextHtml = els['earnNext'].innerHTML, listHtml2 = els['earnList'].innerHTML;
  ok('下一个财报卡片有标题', nextHtml.indexOf('下一个财报') >= 0, nextHtml);
  ok('下一个财报带倒计时', nextHtml.indexOf('en-cd') >= 0 && (nextHtml.indexOf('天后') >= 0 || nextHtml.indexOf('今天') >= 0), nextHtml);
  ok('列表按月分组', listHtml2.indexOf('pnl-t') >= 0);
  ok('列表行可点设提醒', listHtml2.indexOf('toggleEarnRemind(') >= 0);

  /* 只显示未过期：首行日期 = 今天之后最近的 */
  const todayS = A.fullToday();
  const upcoming = A.EARN.filter(function (e) { return e.d >= todayS; }).sort(function (a, b) { return a.d < b.d ? -1 : 1; });
  ok('已过日期不显示', upcoming.length === 0 || listHtml2.indexOf(upcoming[0].d.slice(5)) >= 0);
  ok('倒计时无 NaN', listHtml2.indexOf('NaN') < 0 && nextHtml.indexOf('NaN') < 0, nextHtml);
  ok('倒计时天数正确（首条）', upcoming.length === 0 || nextHtml.indexOf(A.daysUntil(upcoming[0].d) + ' 天后') >= 0 || A.daysUntil(upcoming[0].d) <= 0);
  ok('过期财报不进列表', todayS <= '2026-10-21' || listHtml2.indexOf('>10-21<') < 0, listHtml2.slice(0, 120));

  /* 提醒开关：加 / 删 + 持久化 */
  if (upcoming.length) {
    const t0 = upcoming[0];
    A.earnRemind.length = 0;
    A.toggleEarnRemind(t0.c, t0.d);
    eq('提醒写入内存', A.earnRemind.length, 1);
    ok('提醒落盘', (localStorageStub.getItem('fuley.earnremind.v1') || '').indexOf(t0.c) >= 0);
    A.renderEarn();
    ok('列表标记已提醒', els['earnList'].innerHTML.indexOf('已提醒') >= 0);
    A.toggleEarnRemind(t0.c, t0.d);
    eq('再点取消提醒', A.earnRemind.length, 0);
  }

  /* 与日历打通：财报日出现在事件日历里 */
  const ev = A.eventsOn('2026-11-18');
  ok('日历含英伟达财报', ev.some(function (e) { return e.t === 'earnings' && e.zh.indexOf('英伟达') >= 0; }), JSON.stringify(ev));
  ok('日历备注区分确认/预计', ev.length > 0 && /预计|已确认/.test(ev[ev.length - 1].note || ''));

  /* 日历：财报日整格标红 */
  A.calY = 2026; A.calM = 9;              // 2026 年 10 月（含 10-21 / 10-27~29 财报）
  A.calSel = '2026-10-21';
  A.renderCal();
  ok('财报日加 ern 类', els['calGrid'].innerHTML.indexOf('cal-day ern') >= 0, els['calGrid'].innerHTML.slice(0, 120));
  ok('财报月网格加 ern-month', String(els['calGrid'].className || '').indexOf('ern-month') >= 0, els['calGrid'].className);
  ok('非财报日不加 ern', (function () {
    A.calY = 2026; A.calM = 6;            // 7 月无财报
    A.renderCal();
    return els['calGrid'].innerHTML.indexOf('ern') < 0 && String(els['calGrid'].className || '').indexOf('ern-month') < 0;
  })(), els['calGrid'].innerHTML.slice(0, 120));

  /* 建仓法则子 tab */
  const htmlB = fs.readFileSync(path.join(www, 'index.html'), 'utf8');
  ok('建仓法则子 tab 存在', htmlB.indexOf('data-pane="build"') >= 0 && htmlB.indexOf('id="buildPane"') >= 0);
  A.renderBuildRules();
  const buildHtml = els['buildRules'].innerHTML;
  ok('四张卡：正/倒 × 加/减', ['正金字塔 · 加仓', '倒金字塔 · 加仓', '正金字塔 · 减仓', '倒金字塔 · 减仓'].every(function (t) { return buildHtml.indexOf(t) >= 0; }), buildHtml.slice(0, 200));
  ok('含倍数模板', buildHtml.indexOf('1 - 1 - 1.5 - 2 - 2 - 2.5') >= 0);
  ok('含五条铁律标题', buildHtml.indexOf('五条铁律') >= 0);

  /* 黄金页指标块已移除 */
  ok('黄金指标块已移除', fs.readFileSync(path.join(www, 'index.html'), 'utf8').indexOf('id="goldStats"') < 0);
}).then(function () {
  /* ============ 定投页改版：去掉 已定投 / 收益，仓位比可手动加标的 ============ */
  const htmlSrc = fs.readFileSync(path.join(www, 'index.html'), 'utf8');
  ok('已移除已定投面板', htmlSrc.indexOf('id="invPane"') < 0 && htmlSrc.indexOf('id="invList"') < 0);
  ok('已移除收益面板', htmlSrc.indexOf('id="pnlPane"') < 0 && htmlSrc.indexOf('id="pnlRank"') < 0);
  ok('定投页只剩 2 个子 tab', (htmlSrc.match(/data-pane="(list|pos|inv|pnl)"/g) || []).length === 2,
    (htmlSrc.match(/data-pane="(list|pos|inv|pnl)"/g) || []).join(','));
  ok('仓位比页保留占比容器', htmlSrc.indexOf('id="posAlloc"') >= 0);

  /* 空态 */
  A.allocs.length = 0;
  A.renderPosRatio();
  ok('占比空态引导', els['posAlloc'].innerHTML.indexOf('还没有标的占比') >= 0, els['posAlloc'].innerHTML.slice(0, 160));

  /* 新增：股票名称 + 占比 */
  el('afName').value = '英伟达'; el('afCode').value = 'nvda'; el('afPct').value = '30';
  A.openAllocForm();
  A.sheetSave();
  eq('新增一条占比', A.allocs.length, 1);
  eq('名称正确', A.allocs[0].name, '英伟达');
  eq('代码转大写', A.allocs[0].code, 'NVDA');
  eq('占比数值', A.allocs[0].pct, 30);
  ok('占比落盘', (localStorageStub.getItem('fuley.alloc.v1') || '').indexOf('英伟达') >= 0);

  el('afName').value = '苹果'; el('afCode').value = 'AAPL'; el('afPct').value = '45';
  A.openAllocForm(); A.sheetSave();
  el('afName').value = '微软'; el('afCode').value = 'MSFT'; el('afPct').value = '25';
  A.openAllocForm(); A.sheetSave();
  eq('合计三条', A.allocs.length, 3);
  eq('合计占比 100', A.allocTotal(), 100);

  /* 校验：空名称 / 超范围占比 */
  const n0 = A.allocs.length;
  el('afName').value = '  '; el('afPct').value = '10';
  A.openAllocForm(); A.sheetSave();
  eq('空名称不加', A.allocs.length, n0);
  el('afName').value = '测试'; el('afPct').value = '130';
  A.openAllocForm(); A.sheetSave();
  eq('占比超 100 不加', A.allocs.length, n0);
  el('afName').value = '测试'; el('afPct').value = '0';
  A.openAllocForm(); A.sheetSave();
  eq('占比为 0 不加', A.allocs.length, n0);

  /* 编辑 */
  const firstId = A.allocs[0].id;
  A.openAllocForm(firstId);
  el('afPct').value = '40';
  A.sheetSave();
  eq('编辑后占比更新', A.allocs.filter(function (a) { return a.id === firstId; })[0].pct, 40);
  eq('编辑不新增', A.allocs.length, 3);

  /* 渲染：合计超 100 标红 + 折算金额 */
  A.plans.length = 0;
  A.plans.push({ id: 'p1', name: '计划A', code: '510300', day: 1, amount: 2000 });
  A.posCfg.override = 100;                 // 固定 100%，折算可预期
  A.renderPosRatio();
  const allocHtml = els['posAlloc'].innerHTML;
  ok('合计超 100% 标红', allocHtml.indexOf('pos-alloc-sum over') >= 0, allocHtml.slice(0, 200));
  ok('显示合计数值 110%', allocHtml.indexOf('110%') >= 0);
  ok('仓位比页不显示金额', allocHtml.indexOf('¥') < 0, allocHtml);
  ok('不再出现三格汇总', allocHtml.indexOf('每月定投总额') < 0 && allocHtml.indexOf('留存现金') < 0);
  ok('行可点编辑', allocHtml.indexOf('openAllocForm(') >= 0);

  /* 删除 */
  A.openAllocForm(firstId);
  A.delAlloc();
  eq('删除后剩两条', A.allocs.length, 2);
  eq('删除后合计 70', A.allocTotal(), 70);
  A.renderPosRatio();
  ok('合计不足不标 over', els['posAlloc'].innerHTML.indexOf('over') < 0);
  A.posCfg.override = null;
}).then(function () {
  console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
}).catch(function (e) {
  console.error('测试执行异常:', e);
  process.exit(1);
});
