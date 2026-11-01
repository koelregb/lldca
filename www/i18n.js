/* =============================================================================
   浮乐 i18n —— 中英双语（默认跟随系统语言，可在「我的」页切换）
   ---------------------------------------------------------------
   机制：
   1) 语言为 en 时，给 Element.prototype.innerHTML / Node.prototype.textContent
      装钩子，所有渲染输出自动过 tr()，因此不改动各页 render 函数。
   2) 静态 HTML（index.html 里写死的文案）在 DOM 就绪后由 applyStatic() 扫一遍。
   3) 结构化拼接（如「第X康波 · NN年」）用 L(zh, en) 显式双语。
   4) 语言为 zh 时不安装任何钩子，行为与改动前完全一致。
   ============================================================================= */
(function (root) {
  'use strict';

  var STORE_KEY = 'fuley.lang.v1';
  var CJK = /[\u4e00-\u9fa5]/;

  function lang() {
    var v = null;
    try { v = localStorage.getItem(STORE_KEY); } catch (e) { /* ignore */ }
    if (v === 'en' || v === 'zh') return v;
    var n = '';
    try { n = String((root.navigator && root.navigator.language) || 'zh').toLowerCase(); } catch (e) { n = 'zh'; }
    return n.indexOf('zh') === 0 ? 'zh' : 'en';
  }
  function setLang(l) {
    try { localStorage.setItem(STORE_KEY, l === 'en' ? 'en' : 'zh'); } catch (e) { /* ignore */ }
  }
  function isEn() { return lang() === 'en'; }
  /* 显式双语：结构化句子里含中文标点 / 数字单位时用这个 */
  function L(zh, en) { return isEn() ? en : zh; }

  /* ---------------- 词条表：中文原文 -> 英文 ---------------- */
  var EN = {
    /* ---- 页面 / 子 Tab ---- */
    '走势': 'Stocks',
    '股票': 'Stocks',
    '周期': 'Cycles',
    '黄金': 'Gold',
    '日历': 'Calendar',
    '我的': 'Me',
    '定投提醒': 'DCA',
    '定投': 'DCA',
    '官方日程': 'Official calendar',
    '定投计划': 'Plans',
    '定投仓位比': 'Position ratio',
    '已定投': 'Invested',
    '收益': 'Returns',
    '收益 = 当前市值 − 累计投入 · 现价自动联网更新 · 红 = 盈利，绿 = 亏损 · 数据来自「已定投」记录':
      'Returns = market value − total cost · live price updates online · red = profit, green = loss · data from the "Invested" tab',
    '本期建议仓位比': 'Suggested ratio',
    '手动微调': 'Fine tune',
    '自动': 'Auto',
    '手动': 'Manual',
    '每月定投总额': 'Monthly total',
    '本期建议投入': 'Invest now',
    '留存现金': 'Cash left',
    '低位区 · 加码定投': 'Cheap · add more',
    '偏低区 · 适度加码': 'Below average · add a bit',
    '中性区 · 按计划投': 'Neutral · stay on plan',
    '偏高区 · 降低投入': 'Above average · trim',
    '高位区 · 少投多留': 'Expensive · mostly cash',
    '定投数量': 'Units',
    '定投股价': 'Avg cost',
    '现价': 'Price',
    '市值': 'Value',
    '累计投入': 'Total cost',
    
    
    '记录定投': 'Log DCA',
    '编辑定投记录': 'Edit record',
    '删除此记录': 'Delete record',
    '定投日期': 'Date',
    '股票名称': 'Asset name',
    '记录每笔定投的股票名称 / 数量 / 定投股价 · 现价自动联网更新 · 红 = 浮盈，绿 = 浮亏':
      'Log each DCA buy: asset name / units / price · live price updates online · red = profit, green = loss',
    '代码（可选，填了自动取现价）': 'Code (optional — enables the live price)',
    '定投数量（股）': 'Units',
    '如 沪深300ETF / 英伟达': 'e.g. CSI 300 ETF / NVDA',
    '如 3.856': 'e.g. 3.856',
    '如 500': 'e.g. 500',
    '金额 = 股价 × 数量，自动计算；多条同名记录会合并统计浮盈浮亏':
      'Amount = price × units · same-asset rows merge into one position with floating P/L',
    '请填写股票名称': 'Enter an asset name',
    '请填写定投股价': 'Enter the DCA price',
    '请填写定投数量': 'Enter the units',
    '已保存定投记录': 'DCA record saved',
    '已删除该定投记录': 'Record deleted',
    '红绿灯': 'Rules',
    '加减仓': 'Trades',
    '加减仓条件': 'Checklist',
    '信号提醒': 'Alerts',
    '恐慌级别': 'Panic',
    '浮乐': 'Fuley',

    /* ---- 股票详情页 ---- */
    '分时': 'Intraday',
    '五日': '5D',
    '日K': '1D',
    '周K': '1W',
    '月K': '1M',
    '季K': '1Q',
    '年K': '1Y',
    '更多': 'More',
    '今开': 'Open',
    '昨收': 'Prev',
    '最新': 'Last',
    '最高': 'High',
    '最低': 'Low',
    '均价': 'Avg',
    '振幅': 'Amp',
    '涨跌': 'Chg',
    '样本': 'Points',
    '已收盘': 'Closed',
    '区间': 'Range',
    '标普500': 'S&P 500',
    '纳斯达克': 'Nasdaq',
    '恒生指数': 'Hang Seng',
    '上证指数': 'SSE Comp',
    '行情每 60 秒自动刷新 · 曲线可左右拖动平移、滚轮缩放、双击重置、单击看全屏大图':
      'Quotes refresh every 60s · drag to pan, scroll to zoom, double-tap to reset, tap the chart for fullscreen',

    /* ---- 定投页 ---- */
    
    '标的名称': 'Name',
    '代码': 'Code',
    '每月定投日': 'Day of month',
    '每期金额（元）': 'Amount (CNY)',
    '添加定投计划': 'Add plan',
    '删除此定投': 'Delete this plan',
    '还没有定投计划': 'No DCA plan yet',
    '点右下角 + 添加第一个': 'Tap + to add your first one',
    '到定投日自动推送本地通知 · 点击条目可编辑':
      'Local reminder on the DCA day · tap a row to edit',
    '到定投日当天 9:00 自动推送本地通知':
      'Local notification at 09:00 on the DCA day',

    /* ---- 红绿灯页 ---- */
    '红线 · 禁忌': 'Red · Never',
    '绿线 · 可重复': 'Green · Repeat',
    /* ---- v1.5.4 交易法则 / 走势截图标注 / 恐慌引导 ---- */
    '绿线 · 重复': 'Green · Repeat',
    '交易法则': 'Trading Rules',
    '耐心　信心　恒心': 'Patience \u00b7 Faith \u00b7 Perseverance',
    '耐心 信心 恒心': 'Patience \u00b7 Faith \u00b7 Perseverance',
    '等 ': 'Wait for ',
    /* ---- v1.5.7 题库（加仓 10 题） ---- */
    '标的属于「第一或唯一」：市占率第一，且护城河不易被复制？': 'Is the asset #1 or unique — top market share with a hard-to-copy moat?',
    '这一档的买入节点与资金体量，事先已经排好（不是临时起意）？': 'Was this tier\u2019s buy point and size planned in advance (not impulsive)?',
    '现价较上一档回落，价差已拉开到 8%–15% 的档位？': 'Has price pulled back 8\u201315% from the last tier?',
    '越跌越买：本档买入量大于上一档（金字塔加仓）？': 'Buy more as it falls: is this tier\u2019s size larger than the last (pyramid)?',
    '加仓后总仓位仍不超过 8 成（常态 7–7.5 成）？': 'After adding, is total position still \u226480% (normally 70\u201375%)?',
    '这笔钱不是应急金，3 年内不需要动用？': 'Is this money not an emergency fund and not needed within 3 years?',
    '三表健康：有息负债低、净现金为正、经营现金流为正？': 'Healthy statements: low interest-bearing debt, positive net cash & operating cash flow?',
    '估值讲得清：远期 PE / PEG / FCF 增长可解释，PEG 未接近 2？': 'Valuation is explainable: forward PE / PEG / FCF growth clear, PEG not near 2?',
    '不是在追高：若已高于上档 30% 以上，理由是趋势确认而非怕错过？': 'Not chasing: if already >30% above the last tier, is the reason trend confirmation, not FOMO?',
    '若再跌 10%，仍能按计划加下一档而不动摇？': 'If it falls another 10%, can you still add the next tier without wavering?',
    /* ---- v1.5.7 题库（减仓 10 题） ---- */
    '卖出属于四类之一：做 T 小减、PEG≥2、有更好标的、基本面恶化？': 'Is this sell one of four cases: trim-T, PEG\u22652, better asset, or deteriorating fundamentals?',
    '持仓已有 30% 以上涨幅（小体量再平衡除外）？': 'Is the position up 30%+ (excluding small rebalances)?',
    'PEG 已 ≥ 2，成长速度跟不上股价？': 'Is PEG \u22652, growth unable to keep up with the price?',
    '基本面出现恶化迹象（现金流 / 毛利率 / 订单）？': 'Any signs of deteriorating fundamentals (cash flow / margin / orders)?',
    '出现了确定性更高、性价比更好的标的（机会成本）？': 'Is there a higher-certainty, better-value asset (opportunity cost)?',
    '总仓位已超 8 成，需要再平衡、转配置防御型资产？': 'Is total position >80%, needing rebalancing into defensive assets?',
    '按倒金字塔卖出：本档卖出量大于上一档？': 'Inverted pyramid: is this tier\u2019s sell larger than the last?',
    '按 2-3-3-2 节奏：30–50% 阶段只卖约 20%，不是一次清仓？': '2-3-3-2 pace: sell only ~20% in the 30\u201350% stage, not all at once?',
    '趋势确实走坏：震荡区反复无法突破且无确定性利好？': 'Is the trend truly broken: stuck in a range with no clear catalyst?',
    '若卖出后继续涨 10%，不会因卖飞而追回？': 'If it rises 10% more after selling, will you not chase it back?',
    /* ---- v1.5.7 表单字段 / 提示 ---- */
    '日期': 'Date',   
    '价格触发': 'Price trigger',   
    '打勾': 'Check', '当前市值': 'Market value', '浮动盈亏': 'Floating P/L', '下一个财报': 'Next earnings',
    '自定义': 'Custom',   
    '减仓': 'Trim',   
    '≤ 低于': '≤ Below',  '每月': 'Monthly', '每年': 'Yearly',
    '当天没有日程 · 可点击下方按钮标记': 'No events today · use the button below to mark one',
    '还没有加减仓提醒<br>点右下角 + 添加第一个': 'No scale alerts yet<br>tap + at bottom right to add one',
    '点击上方数字，评估自己当前的恐慌等级': 'Tap a number above to rate your current panic level',
    '激活即授权 1 年（一年一签）· 到期前 15 天会提醒续签': 'Activates a 1-year license (annual) · renew reminder 15 days before expiry',
    '题目会追加到当前（': 'Questions will be appended to the current (',
    ' · <span class="warn">超出预算，请调低</span>': ' · <span class="warn">over budget, lower it</span>',
    ' · <span class="warn">超过持仓，请调低</span>': ' · <span class="warn">exceeds holding, lower it</span>',
    '添加定投提醒': 'Add DCA alert', '编辑定投提醒': 'Edit DCA alert',
    '添加标的占比': 'Add allocation', '编辑标的占比': 'Edit allocation',
    '添加加减仓提醒': 'Add scale alert', '编辑加减仓提醒': 'Edit scale alert',
    '添加仓位提醒': 'Add price alert', '编辑仓位提醒': 'Edit price alert',
    '添加事件': 'Add event', '编辑事件': 'Edit event',
    '保存': 'Save',  '确定': 'OK',  '编辑': 'Edit',
    /* ---- v1.5.8 说明长句 / SVG 标签整句英化 ---- */
    '外盘价来自腾讯行情 · 曲线反映沪金 ETF（518880）国内金价 · 分时为当日已成交部分': 'Offshore quotes from Tencent · curve shows SH Gold ETF (518880) domestic price in CNY/g · intraday = trades so far today',
    '财报 / 经济指标 / 选举日程 · ': 'Earnings / macro data / election calendar · ',
    '黄底 = 财报月 / 财报日': 'amber = earnings month / earnings day',
    ' · 底部按钮可自定义标记 · 点击日期查看当天': ' · bottom button adds custom events · tap a date to view',
    '七巨头财报节奏：1 月末 / 4 月末 / 7 月末 / 10 月末（英伟达晚一个月）· 全部为盘后发布 · 点一行可设「前一天 21:00」系统提醒': 'Magnificent 7 earnings rhythm: end of Jan / Apr / Jul / Oct (NVIDIA a month later) · all after close · tap a row to set a \u201cday-before 21:00\u201d reminder',
    '到定投日自动推送本地通知 · 点击条目可编辑': 'Auto local notification on the DCA day · tap a row to edit',
    '仓位比 = 本期投入比例 · 剩余留作现金 · 依据 VIX 情绪分位': 'Ratio = share invested this round · the rest stays in cash · based on VIX sentiment percentile',
    '加仓 / 减仓各十道题 · 打勾计分，8 分及以上判定为「加仓 / 减仓」，不到 8 分为「不建议」': '10 questions each for add / trim · check to score; 8+ means go ahead, below 8 means not advised',
    '题库依据公开分享的加减仓体系整理：选股「第一或唯一」· 仓位 7–8.5 成 · 金字塔加减仓（档差 8%–15%）· 卖出四情形 · 2-3-3-2 节奏 · 仅作纪律检查清单，非投资建议': 'Question bank compiled from a publicly shared scaling framework: pick #1/unique stocks · 70\u201385% position · pyramid scaling (8\u201315% spacing) · four sell cases · 2-3-3-2 pace · discipline checklist only, not investment advice',
    '应对下跌': 'Falling', '应对上涨': 'Rising',
    '正金字塔加仓': 'Pyramid adding', '倒金字塔减仓': 'Inverted-pyramid trim',
    ' 事件': ' events',
    '下跌加仓 · 摊薄成本': 'Add on dips · average down',
    '上涨减仓 · 收回本金再循环': 'Trim on rallies · recover principal & recycle',
    '各档触发与买入比例（以建仓价为起点）': 'Tier triggers & buy ratios (from entry)',
    '各档触发与卖出比例（以建仓价为起点）': 'Tier triggers & sell ratios (from entry)',
    ' · 两条纪律': ' · two rules',
    '参数取自公开分享的加减仓体系 · 仅作纪律参考，不构成投资建议': 'Parameters from a publicly shared scaling framework · discipline reference only, not investment advice',
    '建议 <b>4–8 档</b>：第 1 档建仓，之后以建仓价为基准每跌 5%–10% 加一档，越跌买越多。例：10 万预算按 1/2/3/4 万递增排 4 档。': 'Suggested <b>4–8 tiers</b>: tier 1 opens, then add one tier every 5–10% below entry, buying more as it falls. e.g. a 100k budget split 1/2/3/4 into 4 tiers.',
    '建议 <b>3–4 档</b>：以建仓价（底部）为基准，每涨 5%–10% 卖一档，累计涨 20% 以上清到只剩底仓。': 'Suggested <b>3–4 tiers</b>: sell one tier every 5–10% above entry; above +20% trim down to a bare core.',
    '加减仓法则': 'Scale Rules',
    '应对下跌（正金字塔加仓）': 'Falling (pyramid add)',
    '应对上涨（倒金字塔减仓）': 'Rising (inverted-pyramid trim)',
    '各档触发与比例（可改）': 'Tier triggers & ratios (editable)',
    '恢复默认': 'Reset defaults',
    '档数': 'Tiers',
    '2–10 档，比例随档数增减': '2–10 tiers, ratios scale with count',
    '塔尖第 1 层 = 建仓（0%），越往下跌幅越大、买得越多': 'Peak tier 1 = open (0%); the deeper the fall, the more you buy',
    '塔底为建仓价 0% 起点，越往上涨幅越大、卖得越多': 'Base = 0% entry; the higher the rise, the more you sell',
    '档位': 'Tier', '跌幅%': 'Drop %', '买入%': 'Buy %', '涨幅%': 'Gain %', '卖出%': 'Sell %',
    '以建仓价为起点设跌幅阈值，第 1 档建底仓，每跌一档买得更多，低位重仓摊薄成本。比例是各档买入金额占总预算的 %。': 'Set drop thresholds from entry; tier 1 builds the base, buying more with each drop. Ratios = each tier\u2019s buy as % of total budget.',
    '以建仓价为起点设涨幅阈值，越高卖得越多，先收回本金，最后只留底仓跟随行情。比例是各档卖出量占期初持仓的 %。': 'Set gain thresholds from entry; sell more as it rises, recover principal first, keep a core position. Ratios = each tier\u2019s sell as % of initial holding.',
    '建议 4–8 档：第 1 档建仓，之后以建仓价为基准每跌 5%–10% 加一档，越跌买越多。例：10 万预算按 1/2/3/4 万递增排 4 档。': 'Suggested 4–8 tiers: tier 1 opens, then add one tier every 5–10% below entry, buying more as it falls.',
    '建议 3–4 档：以建仓价（底部）为基准，每涨 5%–10% 卖一档，累计涨 20% 以上清到只剩底仓。': 'Suggested 3–4 tiers: sell one tier every 5–10% above entry; above +20% trim down to a bare core.',
    '先定这只标的的总预算，再排档位；至少分 4 档，别两三次打完': 'Set the total budget first, then tiers; use at least 4, not 2–3 shots',
    '永远不满仓：留 30% 现金，总仓位 80% 以上停止加仓': 'Never go full-in: keep 30% cash, stop adding above 80%',
    '越涨越卖时先收回本金，卖到成本出清后，剩下的仓位才是利润在跑': 'Recover principal first; after cost is out, the rest runs as pure profit',
    '跌破启动价（或回撤 10%）就停止卖出计划，别把底部筹码也交出去': 'Stop the sell plan if it breaks the start price (or -10%); don\u2019t give away the cheap base',
    '恐慌级别评估': 'Panic Level Assessment',
    '市场恐慌等级(自评)': 'Market Panic Level (self-rated)',
    '围绕当前市场的恐慌情况做 1–10 级自评：1 = 几乎无恐慌，10 = 极度恐慌。级别越高，越要按纪律而非情绪操作。': 'Rate the current market panic from 1 to 10: 1 = almost no panic, 10 = extreme panic. The higher the level, the more you should act by discipline rather than emotion.',
    '红线 = 绝不做 · 绿线 = 重复 · 交易法则 = 纪律原则 · 案例 = 复盘存档': 'Red = never do · Green = repeat · Rules = discipline · Cases = post-mortems',
    '右侧交易 · 顺势': 'Right-side · Trend-following',
    '左侧交易 · 逆向': 'Left-side · Contrarian',
    '适用人群': 'Who It Fits',
    '适用场景': 'When to Use',
    '右侧交易点': 'Right-side trading point',
    '左侧交易点': 'Left-side trading point',
    '突破·顺势买': 'Breakout · trend-follow buy',
    '逢低·逆向买': 'Dip · contrarian buy',
    '红点': 'red dot',
    '绿点': 'Green dot',
    '图中': 'In the chart the ',
    '：突破·顺势买——右侧交易点。': ': breakout · trend-follow buy — the right-side trading point.',
    '：逢低·逆向买——左侧交易点。': ': dip · contrarian buy — the left-side trading point.',
    '：下跌途中（行情左侧）逢低逆向买入，越跌越买摊薄成本；红点': ': contrarian buy on dips during the decline (market left side), averaging down as it falls; the red dot ',
    '：底部反转、均线金叉后顺势突破买入。图中真实走势：高位回落后中段触底强势拉升，右段冲高回落创新低——可分别作为左右交易的教学示例。红阳绿阴，三条均线（MA5/10/20）辅助判断趋势强弱。': ': trend-follow breakout buy after the bottom reversal and MA golden cross. The real chart shows: pullback from highs, a strong lift off the mid-section bottom, then the right side rallying into a new low — teaching examples for both sides. Red up / green down candles, with MA5/10/20 to gauge trend strength.',
    '大多数普通投资者——资金、研究深度、心态都有限时，': 'For most ordinary investors — with limited capital, research depth and mindset, ',
    '右侧是最优解': 'right-side is the best solution',
    '不擅长抄底、怕"抄在半山腰"的人。': 'Those who can\u2019t bottom-fish and fear \"buying halfway down the cliff\".',
    '追求胜率优先、不想在下跌途中"接飞刀"的人。': 'Those who put win-rate first and don\u2019t want to \"catch falling knives\" on the way down.',
    '筑底信号明确': 'clear bottoming signals',
    '后再进场：缩量下跌、假破位能收回、筹码稳定（俗称"想跌却跌不动"）。': ' before entering: shrinking-volume declines, false breakdowns quickly reclaimed, stable chips (aka \"wants to fall but can\u2019t\").',
    '趋势反转确认、均线（MA5/10/20）金叉后': 'After the trend reversal is confirmed and MA (5/10/20) golden cross, ',
    '顺势突破': 'buy the upside breakout',
    '不猜底，等市场自己走出来再跟进，': 'Don\u2019t guess the bottom; follow only after the market proves itself, ',
    '只做确认': 'confirm only',
    '只用右侧信号加仓，': 'Add only on right-side signals; ',
    '不在下跌途中接飞刀': 'never catch falling knives on the way down',
    '突破 / 金叉后买入，用三条均线辅助判断趋势强弱。': 'Buy on breakouts / golden crosses; use the three MAs to gauge trend strength.',
    '顺势跟随，不追高也不逆势；便宜不是充分条件，': 'Follow the trend — don\u2019t chase highs or fight it; cheapness is not sufficient, ',
    '估值够低 + 市场确认': 'low valuation + market confirmation',
    '才动手。': ' before acting.',
    '当市场围绕反复震荡、': 'When the market keeps oscillating, ',
    '跌不动了、多次探底': 'can\u2019t fall further and keeps retesting the bottom',
    '，可认为已达底部；目前市场极其敏感，': ', it can be seen as a bottom; today\u2019s market is extremely sensitive, ',
    '快起快落': 'whipsawing up and down',
    '——这种场景不多见了。': ' — such scenes are getting rare.',
    '资金充裕、经验丰富、有': 'Investors with ample capital, rich experience and ',
    '深度研究': 'deep research',
    '的投资者（如金渐成本人）。': ' (e.g. Jin Jiancheng himself).',
    '具备': 'those with ',
    '强大心理承受力 + 充足现金储备': 'strong psychological resilience + ample cash reserves',
    '的人。': ' will fit.',
    '不适合普通投资者': 'Not for ordinary investors',
    '：容易接飞刀、抄在半山腰，或接刀耗尽现金。': ': easy to catch knives, buy halfway down the cliff, or burn all cash catching.',
    '下跌途中、行情': 'On the way down (market ',
    '左侧': 'left side',
    '，价格进入价值区间后逢低逆向买入。': '), buy contra-trend on dips once price enters the value zone.',
    '越跌越买、越买越多': 'buy more as it falls',
    '，摊薄持仓成本。': ', averaging down the cost.',
    '在预期价格范围内逐步买入（': 'Buy step by step within your expected price range (',
    '金字塔加仓': 'pyramid adding',
    '，每跌约 10% 加一层）。': ', one layer per ~10% drop).',
    '必须有充足现金储备，避免"接飞刀"耗尽弹药、底部到来时无钱可买。': 'Keep ample cash reserves so \"catching knives\" never exhausts your ammo before the bottom arrives.',
    '控制组合集中度，': 'Control portfolio concentration; ',
    '不要无限加仓': 'never add without limit',
    '导致仓位失控。': ' or the position gets out of control.',
    '从"价格决定仓位"转向"': 'Shift from \"price decides position\" to \"',
    '风险预算决定仓位': 'risk budget decides position',
    '"：单只 / 行业 / 账户各设最大可承受风险。': '\": set the max tolerable risk per stock / sector / account.',
    '便宜是必要条件非充分条件，': 'Cheapness is necessary but not sufficient — ',
    '大仓位留待右侧确认': 'keep big positions for right-side confirmation',
    '（左侧试仓 + 右侧加仓）。': ' (left-side trial + right-side adding)',
    '案例': 'Cases',
    '如 2000': 'e.g. 2000',
    '还没有记录': 'No entries yet',

    /* ---- 加减仓：信号 ---- */
    '加仓': 'Buy more',
    '加': 'B',
    '减': 'S',
    '触发类型': 'Trigger type',
    '定时提醒': 'Time',
    '触发价（价格触发时填写）': 'Trigger price (for price alerts)',
    '定时（定时提醒时填写）': 'Schedule (for time alerts)',
    '市盈率 P/E 条件（可选，显示在价格后）': 'P/E condition (optional, shown after price)',
    '≥ 高于': '≥ Above',
    '如 205.00': 'e.g. 205.00',
    '如 每周五 14:30': 'e.g. Fri 14:30',
    '删除此提醒': 'Delete this alert',
    '还没有加减仓提醒': 'No alerts yet',
    '监控中': 'Watching',
    '已触发': 'Triggered',
    '待提醒': 'Pending',
    '已提醒': 'Notified',
    '支持价格触发与定时提醒 · 价格触发可关联四大指数或任意股票代码，现价与距触发幅度实时刷新 · 到价推送本地通知':
      'Price and time triggers · price alerts can track the four indices or any security by code, with live price and distance to trigger · local notification on hit',
    '价格触发盯四大指数实时行情 · 命名需与指数一致（标普500 / 纳斯达克 / 恒生指数 / 上证指数）· P/E 条件记录在提醒中，触发时一并提示':
      'Price alerts track the four indices in real time · name must match (S&P 500 / Nasdaq / Hang Seng / SSE Comp) · the P/E condition is stored and shown with the alert',
    '标普500 / 恒生指数 / 英伟达': 'S&P 500 / Hang Seng / NVDA',
    '如 英伟达 / 沪深300 ETF': 'e.g. NVDA / CSI 300 ETF',

    /* ---- 加减仓：条件（测验） ---- */
    '已完成': 'Done',
    '删除本题': 'Delete',
    '题目内容': 'Question',
    '+ 自定义题目': '+ Custom question',
    '自定义加仓题目': 'Custom buy question',
    '自定义减仓题目': 'Custom trim question',
    '重置，再来一轮': 'Reset and retry',
    '加分': 'points',
    '不建议加仓': 'Not advised to buy more',
    '不建议减仓': 'Not advised to trim',
    '通过线': 'Pass line',
    '纪律确认达标': 'Discipline check passed',
    '未达标，暂缓操作': 'Below the line — hold off',
    '分': 'pts',
    '得分': 'Score',

    /* ---- 加仓 10 题 ---- */
    '这笔操作在计划名单内，不是临时起意？': 'Is this trade on your plan list, not an impulse?',
    '加仓触发条件（价格 / 市盈率 / 时间）已确认满足？': 'Are your buy triggers (price / P/E / time) confirmed met?',
    '加仓后单一标的仓位仍不超过总仓位 20%？': 'After buying, is any single holding still under 20% of the portfolio?',
    '应急金与日常开支不受这笔钱影响？': 'Is your emergency fund and living cost unaffected by this money?',
    '投入的资金 3 年内不需要动用？': 'Can this money sit untouched for at least 3 years?',
    '当前估值相对历史分位仍处于偏低区间？': 'Is the current valuation still in a low historical percentile?',
    '若反向波动 10%，能按原计划执行、不情绪化操作？': 'If it drops 10% instead, will you stick to the plan without emotional trading?',
    '没有陷入「这次不一样」的追高叙事？': 'Are you free of the "this time is different" chase narrative?',
    '金额与计划比例一致，没有被情绪放大？': 'Does the amount match the planned size, not inflated by emotion?',
    '这笔操作敢不敢被未来的自己复盘？': 'Would you be comfortable reviewing this trade with your future self?',

    /* ---- 减仓 10 题 ---- */
    '这笔卖出在计划名单内，不是临时起意？': 'Is this sale on your plan list, not an impulse?',
    '减仓触发条件（价格 / 市盈率 / 时间）已确认满足？': 'Are your trim triggers (price / P/E / time) confirmed met?',
    '卖出理由属于计划内动作（估值过高 / 逻辑破坏 / 再平衡）？': 'Is the reason a planned one (overvaluation / broken thesis / rebalancing)?',
    '卖出后现有持仓仍能覆盖原定的配置目标？': 'Do the remaining holdings still meet your target allocation?',
    '不依赖这笔资金应付已知的近期开支？': 'Do you not depend on this cash for known near-term expenses?',
    '当前估值相对历史分位已进入偏高区间？': 'Is the current valuation already in a high historical percentile?',
    '若继续上涨 10%，不会因为卖飞而追回？': 'If it rises another 10%, will you resist chasing it back?',
    '没有陷入「再等等能卖更高」的贪婪叙事？': 'Are you free of the "wait for a higher price" greed narrative?',
    '卖出比例与计划一致，没有被情绪放大？': 'Does the sell ratio match the plan, not inflated by emotion?',

    /* ---- 恐慌级别 ---- */
    '当前恐慌等级（自评）': 'Current panic level (self-rated)',
    '阶段特征': 'What it looks like',
    '常说的话': 'What you tell yourself',
    '市场几乎无恐慌 · 贪婪区': 'Almost no panic · greed zone',
    '轻微波动 · 情绪平稳': 'Mild swings · calm mood',
    '正常': 'Normal',
    '中等波动 · 多空分歧': 'Moderate swings · bulls vs bears',
    '温和': 'Mild',
    '恐慌升温 · 抛压加大': 'Panic rising · heavy selling',
    '极端': 'Extreme',
    '极度恐慌 · 危机模式': 'Extreme panic · crisis mode',
    '平静': 'Calm',
    '高波动': 'High volatility',
    '历史性机会区，果断出手': 'Historic opportunity zone — act decisively',
    '可启动分批加仓': 'Can start adding in batches',
    '留意潜在加仓机会': 'Watch for potential buying chances',
    '维持正常定投节奏': 'Keep your normal DCA pace',
    '定投照常，切忌追高': 'Keep DCA going, avoid chasing',
    '谈笑风生': 'All smiles',
    '强作镇定': 'Feigning calm',
    '躁动不安': 'Restless',
    '吐槽咒骂': 'Ranting',
    '抱头鼠窜': 'Running for cover',
    '鬼哭狼嚎': 'Howling',
    '无言以对': 'Speechless',
    '欲哭无泪': 'Too numb to cry',
    '心如死灰': 'Utterly numb',
    '就当没买': 'Pretend I never bought',
    'VIX 低位，回调当上车': 'VIX low, every dip looks like a entry',
    '开始看宏观解释': 'Start reading macro explanations',
    '频繁看盘，群聊变多': 'Checking quotes constantly, group chats buzzing',
    '骂美联储 / 财报 / 庄家': 'Blaming the Fed / earnings / market makers',
    '砍仓、降杠杆': 'Cutting positions, deleveraging',
    '恐慌指数飙升，相关性趋 1': 'VIX spikes, correlations go to 1',
    '利好不涨，利空暴跌': 'Good news ignored, bad news crushed',
    '深度回撤，麻木': 'Deep drawdown, numb',
    '成交萎缩 / 流动性差': 'Volume dries up / poor liquidity',
    '卸载软件，假装没开户': 'Delete the app, pretend no account',
    '“正常波动”': '"Just normal noise"',
    '“基本面没变”': '"Fundamentals are intact"',
    '“是不是要调整了？”': '"Is a correction coming?"',
    '“这市场有病”': '"This market is broken"',
    '“先出来再说”': '"Get out first, think later"',
    '“全都在跌”': '"Everything is falling"',
    '“……”': '"……"',
    '“算了不看账户了”': '"Whatever, not checking anymore"',
    '“股市关了算了”': '"Just close the market"',
    '“我没买过股票”': '"I never bought stocks"',

    /* ---- Kübler-Ross ---- */
    'Kübler-Ross 哀伤五阶段': 'Kübler-Ross five stages of grief',
    '否认': 'Denial',
    '愤怒': 'Anger',
    '讨价还价': 'Bargaining',
    '抑郁': 'Depression',
    '接受': 'Acceptance',
    '“这不是真的”“只是暂时回调”“不看账户就没亏”': '"Not real" · "just a pullback" · "no loss if I don\'t look"',
    '“都怪美联储”“都怪空头”“都怪财报造假”': '"Blame the Fed" · "blame the shorts" · "blame fake earnings"',
    '“反弹到成本价我就卖”“再跌一点我就补仓”': '"Sell at breakeven" · "add a bit if it drops more"',
    '沉默、无力、不想看账户、觉得没救了': 'Silence, fatigue, avoiding the account, feeling hopeless',
    '承认现实，重新评估仓位，该割割、该拿拿': 'Accept reality, re-assess positions, cut what must be cut, hold what should be held',
    '市场恐慌时的情绪地图：多数人在 1-5 级时追涨杀跌 · 级别越高越接近底部，也越需要按纪律执行':
      'An emotional map of panic: most people chase and dump between levels 1-5 · the higher the level, the closer to the bottom, and the more discipline matters',

    /* ---- 康波周期 ---- */
    '康波周期 · 当前所处阶段': 'Kondratiev wave · current stage',
    '五次长波与第六波猜想': 'Five long waves and a guess at the sixth',
    '长波曲线（1782 – 2050）': 'Long-wave curve (1782 – 2050)',
    '回升': 'Recovery',
    '繁荣': 'Prosperity',
    '衰退': 'Recession',
    '萧条': 'Depression',
    '纺织和蒸汽周期': 'Textiles & steam',
    '钢铁和铁路周期': 'Steel & railways',
    '电力和汽车周期': 'Electricity & autos',
    '半导体、计算机周期': 'Semiconductors & computers',
    '信息技术周期': 'Information technology',
    '？周期': '? cycle',
    '第一次工业革命': 'First Industrial Revolution',
    '确立英国霸主地位': 'Britain becomes the hegemon',
    '第二次工业革命中': 'Second Industrial Revolution',
    '德国、美国崛起': 'Germany and the US rise',
    '日本、苏联崛起': 'Japan and the USSR rise',
    '“亚洲四小龙”崛起': 'Asian Tigers take off',
    '处于萧条期': 'In the depression phase',
    '第六康波猜想': 'A guess at the sixth wave',
    '新技术周期孕育中': 'A new tech cycle is incubating',
    '纺织机 · 蒸汽机': 'Loom · steam engine',
    '铁路 · 钢铁 · 煤炭': 'Rail · steel · coal',
    '电力 · 内燃机 · 化工': 'Power · combustion engine · chemicals',
    '石油 · 汽车 · 航空 · 电子': 'Oil · autos · aviation · electronics',
    '信息技术 · 互联网 · AI': 'IT · internet · AI',
    '权益资产最佳阶段': 'Best stage for equities',
    '商品 / 实物资产韧性强': 'Commodities / real assets hold up',
    '现金 / 黄金避险 · 孕育下一代技术': 'Cash / gold as shelter · next tech gestates',
    '第五次长波 · 处于萧条期': 'Fifth wave · depression',
    '经济触底反弹 · 货币宽松': 'Economy bottoms, money loosens',
    '增长强劲 · 通胀温和': 'Strong growth · mild inflation',
    '增长放缓 · 政策收紧': 'Slowing growth · tightening policy',
    '过剩出清 · 债务违约频发': 'Overcapacity clears · defaults pile up',
    '黄金 / 成长资产率先表现': 'Gold and growth assets lead first',
    '信息技术 / AI 主导 · 新一轮回升的孕育窗口': 'IT / AI lead · a window for the next recovery',
    '周期长度与阶段划分为学术参考（周金涛 / 陈长江等流派，各家略有差异）· 仅供学习，非投资建议':
      'Cycle lengths and stage splits are academic references (Zhou Jintao / Chen Changjiang schools differ slightly) · for learning only, not investment advice',

    /* ---- VIX ---- */
    'VIX 恐慌指数': 'VIX fear index',
    '数据缺失': 'No data',
    '数据来源：CBOE / FRED（VIXCLS）· 历史极值 82.69（2020-03-16）· 数值越高市场越恐慌':
      'Source: CBOE / FRED (VIXCLS) · all-time high 82.69 (2020-03-16) · higher means more fear',

    /* ---- 黄金 ---- */
    '伦敦金现': 'London spot gold',
    '纽约期金': 'COMEX gold futures',
    '美元/盎司': 'USD/oz',
    '沪金 ETF 现价': 'Gold ETF (518880)',
    '一年区间': '1Y range',
    '近一年涨跌': '1Y change',
    '近一年走势': '1Y trend',
    '趋势信号': 'Trend signal',
    '均线': 'MAs',
    '多头排列': 'Bullish stack',
    '空头排列': 'Bearish stack',
    '震荡整理': 'Range-bound',
    '均线交织，方向不明': 'MAs tangled, direction unclear',
    '外盘价来自腾讯行情 · 沪金 ETF（518880）曲线反映国内金价（人民币/克）· 分时为当日已成交部分':
      'Spot prices from Tencent quotes · the 518880 ETF tracks domestic gold in CNY/g · intraday shows traded part only',

    /* ---- 日历 ---- */
    '类型': 'Type',
    '事件标题': 'Event title',
    '财报': 'Earnings',
    '经济': 'Economy',
    '选举': 'Election',
    '+ 标记事件': '+ Add event',
    '财报 / 经济指标 / 选举日程 · 底部按钮可自定义标记 · 点击日期查看当天':
      'Earnings / economic data / elections · add your own with the button · tap a date to see that day',
    '如：NVDA 回调到 180 复盘': 'e.g. Review NVDA at 180',

    /* ---- 我的 / 账号 ---- */
    '未登录': 'Not signed in',
    '登录': 'Sign in',
    '去登录': 'Sign in',
    '去注册': 'Sign up',
    '账号': 'Account',
    '昵称': 'Nickname',
    '确认密码': 'Confirm password',
    '密码（6-32 位，仅字母 / 数字）': 'Password (6-32 chars, letters / digits only)',
    '账号（3-20 位字母 / 数字 / 下划线）': 'Account (3-20 letters / digits / underscore)',
    '请输入账号': 'Enter your account',
    '怎么称呼你': 'What should we call you',
    '再输一次': 'Type it again',
    '如 fuley2026': 'e.g. fuley2026',
    '注册并开始': 'Sign up and start',
    '注册账号后可多设备云端同步': 'Sign up to sync across devices',
    '注册账号后即可使用 · 数据仅保存在本机': 'Sign up to start · data stays on this device',
    '欢迎使用浮乐': 'Welcome to Fuley',
    '注册成功，已登录': 'Signed up and signed in',
    '登录成功': 'Signed in',
    '已退出登录': 'Signed out',
    '账号不存在，请先注册': 'Account not found — please sign up first',
    '密码不正确': 'Wrong password',
    '该账号已注册，请直接登录': 'Account exists — please sign in',
    '两次密码不一致': 'Passwords do not match',
    '账号需 3-20 位字母 / 数字 / 下划线': 'Account must be 3-20 letters / digits / underscore',
    '密码至少 6 位': 'Password needs at least 6 characters',
    '密码仅支持字母和数字': 'Password: letters and digits only',
    '请填写昵称': 'Please enter a nickname',
    '数据管理': 'Data',
    '导出数据': 'Export',
    '备份数据': 'Backup',
    '恢复数据': 'Restore',
    '未备份': 'No backup',
    'JSON 文件': 'JSON file',
    '选择备份文件': 'Choose a file',
    '已备份': 'Backed up',
    '关于': 'About',
    '当前版本': 'Version',
    '检查更新': 'Check updates',
    '已是最新': 'Up to date',
    '已是最新版本': 'You are on the latest version',
    '数据仅保存在本机 · 导出 / 备份可用于换机迁移':
      'Data stays on this device · export / backup to move it',
    '语言': 'Language',
    '语言 / Language': 'Language',
    '已导出到剪贴板': 'Copied to clipboard',
    '已备份数据到本机': 'Backed up locally',
    '恢复成功': 'Restored',
    '该文件不是有效的备份文件': 'Not a valid backup file',
    '确定要恢复吗？当前数据将被覆盖': 'Restore now? Current data will be overwritten',

    /* ---- 授权 ---- */
    '授权': 'License',
    '授权许可': 'License',
    '激活': 'Activate',
    '激活码': 'Activation code',
    '试用期 30 天': '30-day trial',
    '试用期已结束': 'Trial ended',
    '授权已到期': 'License expired',
    '已授权': 'Licensed',
    '试用期': 'Trial',
    '已过期': 'Expired',
    '试用中 · 剩 ': 'Trial · ',
    '设备识别码（长按复制，发给作者获取激活码）': 'Device ID (long-press to copy, send it to get a code)',
    '购买 / 咨询：联系作者获取激活码': 'Purchase / support: contact the author for a code',
    '输入激活码继续使用浮乐 · 激活后授权 1 年': 'Enter a code to keep using Fuley · 1-year license',
    '激活码格式不正确': 'Invalid code format',
    '激活码与设备不匹配': 'Code does not match this device',
    '激活码已过期，请重新获取': 'Code expired — please get a new one',
    '激活成功，授权有效期至': 'Activated — valid until',
    '知道了': 'Got it',
    '以后再说': 'Later',
    '取消': 'Cancel',
    '添加': 'Add',
    '删除': 'Delete',
    '重置': 'Reset',
    '全部': 'All',
    '近一年': '1Y',
    '今日分时': 'Intraday',
    '一年一签': 'Renewed yearly',

    /* ---- 通用 toast ---- */
    '已保存': 'Saved',
    '已删除': 'Deleted',
    '请填写触发价': 'Enter a trigger price',
    '请填写定时': 'Enter a schedule',
    '请填写标的名称': 'Enter a name',
    '请先输入题目内容': 'Enter a question first',
    '请填写日期': 'Enter a date',
    '请填写事件标题': 'Enter an event title',
    '刷新行情': 'Refresh',
    '切换主题': 'Theme',

    /* ---- 授权许可 App ---- */
    '生成激活码': 'Generate code',
    '校验激活码': 'Verify code',
    '复制': 'Copy',
    '已复制': 'Copied'
  };

  /* ---------------- 动态模式：{} 为数字/价格占位 ---------------- */
  var RULES = [
    ['剩 {} 天', '{} days left'],
    ['还有 {} 天', '{} days left'],
    ['剩余 {} 天', '{} days left'],
    ['已授权 · 剩 ', 'Licensed · '],
    ['到期日 ', 'Expires '],
    ['今 ', 'Now '],
    ['{} 元/克', 'CNY {}/g'],
    ['{} 点', '{} points'],
    ['试用期剩余 {} 天', '{} days left in trial'],
    ['授权还有 {} 天到期', 'License expires in {} days'],
    ['第 {} 天', 'Day {}'],
    ['第{}天', 'Day {}']
  ].map(function (r) {
    return {
      re: new RegExp(r[0].split('{}').map(function (p) {
        return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }).join('([0-9]+(?:[.,][0-9]+)?)'), 'g'),
      to: r[1]
    };
  });

  /* 词条按长度降序，长短语优先替换（避免「加仓」被「加」先吃掉） */
  var PHRASES = Object.keys(EN)
    .filter(function (k) { return k.length >= 2; })
    .sort(function (a, b) { return b.length - a.length; })
    .map(function (k) { return { k: k, v: EN[k] }; });

  function fill(tpl, nums, offset) {
    var i = offset;
    return tpl.replace(/\{\}/g, function () { return nums[i++]; });
  }

  /* 主翻译函数：输入任意字符串，输出英文（zh 模式原样返回） */
  /* 用户数据保护：渲染用户输入（笔记/标的名称/自定义事件）时用 raw() 包裹，
     翻译时跳过保护区间，避免把用户的中文内容当作 UI 文案替换掉。 */
  var RAW_L = String.fromCharCode(0xE000), RAW_R = String.fromCharCode(0xE001);
  function raw(s) { return RAW_L + String(s == null ? '' : s) + RAW_R; }

  /* 扫描字符码处理保护段：SOH(1)..STX(2) 之间为用户原文，不翻译 */
  function tr(s) {
    if (typeof s !== 'string') return s;
    var i0 = s.indexOf(RAW_L);
    if (i0 === -1) return _tr(s);
    var out = _tr(s.slice(0, i0));
    var i = i0;
    while (i < s.length) {
      var a = s.indexOf(RAW_L, i);
      if (a === -1) { out += _tr(s.slice(i)); break; }
      out += _tr(s.slice(i, a));                 // 保护段之前的 UI 文案
      var b = s.indexOf(RAW_R, a + 1);
      if (b === -1) { out += s.slice(a + 1); break; }  // 未闭合，余下视为原文
      out += s.slice(a + 1, b);                  // 保护段原文
      i = b + 1;
    }
    return out;
  }

  function _tr(s) {
    if (!isEn() || typeof s !== 'string' || !CJK.test(s)) return s;
    if (EN[s] != null) return EN[s];              // 1) 整串精确命中
    var out = s;
    for (var i = 0; i < RULES.length; i++) {      // 2) 带数字的动态句式
      var r = RULES[i];
      var nums = [];
      out = out.replace(r.re, function () {
        for (var a = 1; a < arguments.length - 2; a++) nums.push(arguments[a]);
        return fill(r.to, nums.splice(0), 0);
      });
    }
    for (var j = 0; j < PHRASES.length; j++) {    // 3) 长短语优先替换
      if (out.indexOf(PHRASES[j].k) >= 0) out = out.split(PHRASES[j].k).join(PHRASES[j].v);
    }
    return out;
  }

  /* ---------------- DOM 钩子 ---------------- */
  var hooked = false;
  function hook() {
    if (hooked || !isEn() || typeof Element === 'undefined') return;
    hooked = true;
    var ih = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (ih && ih.set) {
      Object.defineProperty(Element.prototype, 'innerHTML', {
        configurable: true, enumerable: ih.enumerable, get: ih.get,
        set: function (v) { ih.set.call(this, tr(String(v))); }
      });
    }
    var tc = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
    if (tc && tc.set) {
      Object.defineProperty(Node.prototype, 'textContent', {
        configurable: true, enumerable: tc.enumerable, get: tc.get,
        set: function (v) { tc.set.call(this, tr(String(v))); }
      });
    }
  }

  /* 静态 HTML 扫一遍（跳过 script / style） */
  function applyStatic(rootEl) {
    if (!isEn() || typeof document === 'undefined') return;
    var scope = rootEl || document.body;
    if (!scope) return;
    var walker = document.createTreeWalker(scope, 4 /* SHOW_TEXT */, null);
    var node, list = [];
    while ((node = walker.nextNode())) {
      var p = node.parentNode;
      var tag = p && p.nodeName ? p.nodeName.toLowerCase() : '';
      if (tag === 'script' || tag === 'style') continue;
      if (node.nodeValue && CJK.test(node.nodeValue)) list.push(node);
    }
    list.forEach(function (n) {
      var v = n.nodeValue;
      var r = tr(v);
      if (r !== v) n.nodeValue = r;
    });
    var attrs = scope.querySelectorAll ? scope.querySelectorAll('[placeholder],[title],[aria-label]') : [];
    [].forEach.call(attrs, function (el) {
      ['placeholder', 'title', 'aria-label'].forEach(function (a) {
        var v = el.getAttribute(a);
        if (v && CJK.test(v)) {
          var r = tr(v);
          if (r !== v) el.setAttribute(a, r);
        }
      });
    });
  }

  function switchLang(l) {
    setLang(l);
    try { root.location.reload(); } catch (e) { /* ignore */ }
  }

  var api = {
    lang: lang, isEn: isEn, setLang: setLang, switchLang: switchLang,
    tr: tr, L: L, raw: raw, hook: hook, applyStatic: applyStatic, dict: EN
  };
  root.FuleyI18N = api;
  root.L = L;
  root.setLang = switchLang;

  /* 立即装钩子（app.js 在其后执行，渲染输出自动英文化） */
  hook();
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { applyStatic(); });
    } else {
      setTimeout(function () { applyStatic(); }, 0);
    }
  }
})(typeof window !== 'undefined' ? window : this);
