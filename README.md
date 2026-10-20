# 定投 (lldca)

美股「七巨头」（苹果 / 微软 / 谷歌 / 亚马逊 / 英伟达 / Meta / 特斯拉）**月度定投**记录与收益统计 App。

- 技术路线：移动端 PWA（纯前端、零依赖构建）+ Capacitor 封装原生 Android 工程
- 数据全部存储在本地（localStorage），不上传任何服务器
- 现价支持**腾讯财经行情自动获取**（国内可直连，无需 API Key），失败时可手动输入
- 配色遵循 A 股惯例：**红涨绿跌**

## 功能一览

| 模块 | 说明 |
| --- | --- |
| 首页 | 总市值 / 总投入 / 累计收益（红涨绿跌）、本月定投进度、下次定投倒计时、持仓分布环形图、累计投入 vs 当前市值曲线、最近记录 |
| 持仓 | 七巨头逐一展示持股、摊薄成本、现价、市值、盈亏比例；点击进入详情可改现价、跳转记一笔 |
| 计划 | 每只股票设置月投金额（人民币/美元计价自动换算）、定投日（1-28）、本月完成度进度条、一键「+1 期」 |
| 记录 | 按月份分组的全部投资记录，支持按股票筛选、单条删除；每笔记录显示相对现价的盈亏 |
| 我的 | 现价批量管理 + 自动获取、显示货币/汇率/主题、导出/导入 JSON 备份、载入演示数据、清空数据 |

## 目录结构

```
lldca/
├── www/                        # Web 应用本体（Capacitor 的 webDir）
│   ├── index.html              # 入口页面
│   ├── styles.css              # 样式（浅色/深色双主题）
│   ├── app.js                  # 全部逻辑（计算 / 渲染 / 图表 / 行情）
│   ├── manifest.webmanifest    # PWA 清单
│   ├── sw.js                   # Service Worker（离线可用）
│   └── icons/                  # 应用图标（SVG）
├── capacitor.config.json       # Capacitor 配置（appId: com.lldca.app）
├── package.json
├── android/                    # 生成的 Android Studio 工程
└── README.md
```

## 方式一：直接使用（PWA，最快）

1. 用 Chrome 打开 `www/index.html`（或任意静态服务器托管 `www/` 目录）；
2. 手机 Chrome 访问同一地址后，菜单选择「添加到主屏幕」，即可以独立窗口、离线使用；
3. 建议先到「我的 → 载入演示数据」体验全部功能，再清空开始真实记录。

## 方式二：打包为安卓 APK（Capacitor）

`android/` 目录已经生成好，你也可以随时重新生成：

```bash
# 1. 安装依赖（已安装可跳过）
npm install

# 2. 如 android/ 目录不存在，生成原生工程
npx cap add android

# 3. 同步 Web 资源到原生工程（每次修改 www/ 后执行）
npx cap sync

# 4. 用 Android Studio 打开 android/ 目录
npx cap open android
```

然后在 Android Studio 中：

- 连接手机或模拟器，点击 Run ▶ 直接安装；
- 或菜单 **Build → Build APK(s)** 产出 `android/app/build/outputs/apk/debug/app-debug.apk`；
- 正式发布签名包：**Build → Generate Signed Bundle / APK**。

命令行构建（本机已配置 JDK 17 与 ANDROID_HOME 时）：

```bash
cd android
gradlew.bat assembleDebug        # Windows
./gradlew assembleDebug          # macOS / Linux
```

> 环境要求：JDK 17+、Android SDK（Android Studio 默认安装即可）。
> 应用图标目前为 SVG 占位方案；如需生成全套 PNG 启动图标：
> `npm install @capacitor/assets --save-dev && npx @capacitor/assets generate --iconBackgroundColor "#2b5cff" --splashBackgroundColor "#f3f5f9"`

## 现价自动获取说明

- App 通过腾讯财经行情接口 `qt.gtimg.cn/q=usXXX` 获取七巨头实时价（美元/股），该接口允许跨域访问，国内网络可直接使用；
- 自动获取依赖联网；失败时会提示手动输入（持仓/我的/更新现价弹层均可输入）；
- 若未来接口变动，可在 `www/app.js` 中的 `fetchPrice()` 候选列表里增删行情源（已内置 stooq 与 CORS 代理作为备选）；
- 进阶方案：安装 `@capacitor-community/http` 改用原生 HTTP 请求，可彻底绕过 WebView 跨域限制。

## 数据与隐私

- 所有记录仅存于本机 localStorage（Key：`mag7dca.v1`），卸载 App 或清除浏览器数据会一并删除；
- 换机/备份：「我的 → 导出备份」生成 JSON 文件，新设备「导入备份」恢复；
- 演示数据中的历史价格由 2026-10-20 真实价格回溯模拟生成，仅用于功能演示。

## 免责声明

本应用仅用于个人投资记录与统计，**不构成任何投资建议**。股市有风险，投资需谨慎。
