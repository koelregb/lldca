## 最新版本 v1.6.9

| 项目 | 下载 / 入口 |
| --- | --- |
| Android 安装包 | [fuley-v1.6.9.apk](https://github.com/koelregb/lldca/releases/download/v1.6.9/fuley-v1.6.9.apk)（仓库内：`fuley-v1.6.9.apk`、`tools/fuley-v1.6.9.apk`） |
| 版本信息 | v1.6.9 / versionCode 40 / Android 7.0+ |
| 全部历史版本 | [Releases](https://github.com/koelregb/lldca/releases) |
| 页面模型（原型） | [lldca-v1.6.9-mockup.html](lldca-v1.6.9-mockup.html)（手机壳内即当前版本 App 本体） |
| 原型生成脚本 | `python tools/make-mockup.py`（改完 `www/` 重新生成） |

> 本版要点：建仓法则顶部显示**当前加仓模式 / 当前减仓模式**，四张卡可选为当前模式（选中卡**绿色背景框**）；卡片里的时机 / 档位 / 档差 / 用途 / 注意等条目支持**编辑、保存、取消、删除、新增一行**，全部本机保存。


## 功能一览

| 模块 | 说明 |
| --- | --- |
| 首页 | 总市值 / 总投入 / 累计收益（红涨绿跌）、本月定投进度、下次定投倒计时、持仓分布环形图、累计投入 vs 当前市值曲线、最近记录 |
| 持仓 | 选中的每只股票展示持股、摊薄成本、现价、市值、盈亏比例；点击进入详情可改现价、跳转记一笔 |
| 计划 | 每只股票设置月投金额（人民币/美元计价自动换算）、定投日（1-28）、本月完成度进度条；右上角「+」打开股票选择器：41 只预设池搜索勾选，或输入任意美股代码（1-5 字母）自定义添加 |
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
├── tools/                      # 备用工具（当前版本未启用授权）
│   ├── gen-license.js          # 授权码生成器（命令行）
│   └── license.html            # 授权码生成器（浏览器版）
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

> 环境要求：JDK 21（Capacitor 7 要求）、Android SDK（Android Studio 默认安装即可）。
> 若本机是 JDK 17，构建会报「无效的源发行版: 21」，安装 JDK 21 后设置 `JAVA_HOME` 即可。
> 国内网络建议在 `android/build.gradle` 中保留阿里云 Maven 镜像（已配置）。
> 应用图标目前为 SVG 占位方案；如需生成全套 PNG 启动图标：
> `npm install @capacitor/assets --save-dev && npx @capacitor/assets generate --iconBackgroundColor "#2b5cff" --splashBackgroundColor "#f3f5f9"`

## 授权码（License）说明 — 当前版本未启用

当前版本**打开即用，无需激活**。授权码机制的代码与工具已保留在仓库中，将来需要时可随时开启。

### 如需开启授权

1. 在 `www/app.js` 的 `boot()` 中恢复调用 `initLicenseGate()`；
2. 在 `www/index.html` 中恢复授权门 DOM（`#licenseGate`，结构见 git 历史）；
3. 在 `www/styles.css` 中恢复 `.gate` 相关样式。

### 授权码如何生成（开启后）

授权码由「设备识别码」按固定算法离线推导，**一一对应、仅在该设备有效**：

1. 用户打开 App，激活页会显示一串 12 位十六进制**设备识别码**（如 `4F2A9C1B7D3E`），点「复制」发给作者；
2. 作者用项目自带工具生成授权码：

```bash
# 命令行版（Node.js）
node tools/gen-license.js 4F2A9C1B7D3E
# 输出：
# 设备识别码: 4F2A9C1B7D3E
# 授权码:     ED5A-6CCE-CEFF-D7BF
# 自校验:     OK
```

或双击打开 `tools/license.html`（浏览器版，输入设备码即得授权码，无需联网）；

3. 把 `LLDCA-XXXX-XXXX-XXXX-XXXX` 格式的授权码发给用户，在激活页输入即完成激活。

### 算法原理

```
授权码 = HMAC-SHA256(内置密钥, 设备识别码) 的前 16 位十六进制，分 4 组显示
```

- App 与生成器使用同一算法（`www/app.js` 中的 `licenseCodeFor()`），本地比对，**无需服务器**；
- 输入时大小写、横线、`LLDCA-` 前缀均可忽略。

> ⚠️ 安全边界：纯前端离线校验可被逆向（密钥在 JS 中），**仅防止随手分享，不防专业破解**。如需强校验，应改为服务端发放与校验（可配合 `cloud-service` 等后端方案）。

## 现价自动获取说明

- App 通过腾讯财经行情接口 `qt.gtimg.cn/q=usXXX` 获取七巨头实时价（美元/股），该接口允许跨域访问，国内网络可直接使用；
- 自动获取依赖联网；失败时会提示手动输入（持仓/我的/更新现价弹层均可输入）；
- 若未来接口变动，可在 `www/app.js` 中的 `fetchPrice()` 候选列表里增删行情源（已内置 stooq 与 CORS 代理作为备选）；
- 进阶方案：安装 `@capacitor-community/http` 改用原生 HTTP 请求，可彻底绕过 WebView 跨域限制。

## 数据与隐私

- 所有记录仅存于本机 localStorage（Key：`mag7dca.v1`），卸载 App 或清除浏览器数据会一并删除；
- 换机/备份：「我的 → 导出备份」生成 JSON 文件，新设备「导入备份」恢复；
- 演示数据中的历史价格由 2026-10-20 前后真实价格回溯模拟生成，仅用于功能演示。

## 免责声明

本应用仅用于个人投资记录与统计，**不构成任何投资建议**。股市有风险，投资需谨慎。
