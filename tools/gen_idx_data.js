// 生成指数历史走势数据（嵌入前端模型/App）
// - 恒生(hkHSI)/上证(sh000001)：腾讯 fqkline 真实月K(320根≈2000年至今) + 真实日K(320根)
// - 标普(usINX)/纳指(usIXIC)：腾讯美股指数K线不可用，用公开历史锚点+插值生成演示曲线
// - 今日分时：接口无有效分钟数据，按「昨收→现价」随机游走生成演示曲线
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2] || path.join(__dirname, 'idx-data.js');

/* ---------- 1. 读取真实快照 ---------- */
const snap = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'idx_kline_snapshot.json'), 'utf-8'));

/* ---------- 2. 确定性伪随机 ---------- */
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/* ---------- 3. 月锚点 -> 320 个月度点（对数插值 + 微噪声） ---------- */
function simMonthly(anchors, seed) {
  // anchors: [["2000-03", 1498.58], ...] 首尾为真实值
  const rnd = seeded(seed);
  const start = anchors[0][0], end = anchors[anchors.length - 1][0];
  const [sy, sm] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  const months = [];
  for (let y = sy, m = sm; ; ) {
    months.push([y, m]);
    if (y === ey && m === em) break;
    m++; if (m > 12) { m = 1; y++; }
  }
  const ai = a => a[0].split('-').map(Number);
  const pts = months.map(([y, m], i) => {
    const key = y + '-' + String(m).padStart(2, '0');
    // 找相邻锚点
    let lo = anchors[0], hi = anchors[anchors.length - 1];
    for (let k = 0; k < anchors.length - 1; k++) {
      if (ai(anchors[k])[0] * 12 + ai(anchors[k])[1] <= y * 12 + m &&
          y * 12 + m <= ai(anchors[k + 1])[0] * 12 + ai(anchors[k + 1])[1]) {
        lo = anchors[k]; hi = anchors[k + 1]; break;
      }
    }
    const x0 = ai(lo)[0] * 12 + ai(lo)[1], x1 = ai(hi)[0] * 12 + ai(hi)[1];
    const t = x1 === x0 ? 1 : (y * 12 + m - x0) / (x1 - x0);
    // 价格用对数空间插值（指数长期复利增长）
    const v = Math.exp(Math.log(lo[1]) * (1 - t) + Math.log(hi[1]) * t);
    const noise = 1 + (rnd() - 0.5) * 0.018; // ±0.9% 微噪声
    return [key, +(v * noise).toFixed(2)];
  });
  // 首尾对齐真实锚点
  pts[0][1] = anchors[0][1];
  pts[pts.length - 1][1] = anchors[anchors.length - 1][1];
  return pts;
}

/* ---------- 4. 月曲线 -> 近一年日K（每月 ~21 个交易日随机游走收敛） ---------- */
function simDaily(monthly, endDate, seed) {
  const rnd = seeded(seed);
  const last16 = monthly.slice(-16);
  const days = [];
  let d = new Date(endDate);
  d.setDate(d.getDate() - 320 * 7 / 5); // 往前推约320个交易日
  for (let mi = 0; mi < last16.length; mi++) {
    const mStart = mi === 0 ? last16[0][1] : last16[mi - 1][1];
    const mEnd = last16[mi][1];
    for (let k = 0; k < 20; k++) {
      const t = k / 19;
      const trend = Math.log(mStart) * (1 - t) + Math.log(mEnd) * t;
      const noise = (rnd() - 0.5) * 0.02;
      days.push(+Math.exp(trend + noise).toFixed(2));
    }
  }
  // 贴真实交易日期（跳过周末）
  const out = [];
  let cur = new Date(d);
  let i = 0;
  while (out.length < 320) {
    const wd = cur.getDay();
    if (wd !== 0 && wd !== 6 && i < days.length) {
      out.push([cur.toISOString().slice(0, 10), days[i++]]);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/* ---------- 5. 今日分时（昨收 → 现价 随机游走） ---------- */
function simMinute(prev, last, seed) {
  const rnd = seeded(seed);
  const n = 240, out = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const drift = Math.log(last / prev) * t;
    const noise = (rnd() - 0.5) * 0.0016 * (1 - Math.abs(t - 0.5));
    out.push(+(prev * Math.exp(drift + noise)).toFixed(2));
  }
  out[0] = prev; out[n - 1] = last;
  return out;
}

/* ---------- 6. 组装 ---------- */
const SP_ANCHORS = [
  ['2000-03', 1498.58], ['2002-10', 885.76], ['2007-10', 1549.38], ['2009-03', 797.70],
  ['2013-12', 1848.36], ['2015-05', 2107.39], ['2018-09', 2913.98], ['2020-03', 2584.59],
  ['2020-12', 3756.07], ['2021-12', 4766.18], ['2022-10', 3871.98], ['2024-12', 5881.63],
  ['2026-10', 7757.17]
];
const ND_ANCHORS = [
  ['2000-03', 5048.62], ['2002-10', 1119.40], ['2007-10', 2859.12], ['2009-03', 1268.64],
  ['2015-07', 5088.62], ['2018-12', 4198.45], ['2020-03', 6860.67], ['2021-11', 15843.44],
  ['2022-12', 10466.48], ['2024-12', 19310.79], ['2026-10', 26702.86]
];

const END_DATE = '2026-10-22';
const spMonth = simMonthly(SP_ANCHORS, 101);
const ndMonth = simMonthly(ND_ANCHORS, 202);

const data = {
  usINX:  { demo: true,  all: spMonth, year: simDaily(spMonth, END_DATE, 303), min: null },
  usIXIC: { demo: true,  all: ndMonth, year: simDaily(ndMonth, END_DATE, 404), min: null },
  hkHSI:  { demo: false, all: snap.hkHSI.all,  year: snap.hkHSI.year,  min: null },
  sh000001: { demo: false, all: snap.sh000001.all, year: snap.sh000001.year, min: null }
};
// 分时（昨收/现价来自今日真实行情）
data.usINX.min = simMinute(7712.57, 7757.17, 505);
data.usIXIC.min = simMinute(26424.82, 26702.86, 606);
data.hkHSI.min = simMinute(23513.79, 22934.68, 707);
data.sh000001.min = simMinute(3714.48, 3658.03, 808);

for (const k of Object.keys(data)) {
  const d = data[k];
  console.log(k, '| all', d.all.length, '根', d.all[0][0], '->', d.all[d.all.length - 1][0],
    '| year', d.year.length, '根', '| min', d.min.length, '点');
}

const js = '// 自动生成：指数历史走势数据（真实快照 + 锚点插值演示）\n'
  + '// hkHSI/sh000001 = 腾讯 fqkline 真实数据；usINX/usIXIC = 公开历史锚点插值（演示）\n'
  + 'var IDX_KLINES = ' + JSON.stringify(data) + ';\n';
fs.writeFileSync(OUT, js);
console.log('written:', OUT, fs.statSync(OUT).size, 'bytes');
