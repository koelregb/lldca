# -*- coding: utf-8 -*-
"""生成「页面模型」单文件原型（对齐当前 App）。

做法：把 www/ 的 index.html + styles.css + i18n.js + app.js + license.js
内联成一个独立 HTML，Base64 后放进手机壳页面，用 iframe.srcdoc 载入。
好处：原型即 App 本体，永不与代码分叉；改动 App 后重跑本脚本即可。

用法：
    python tools/make-mockup.py            # 版本号取 package.json
    python tools/make-mockup.py --out ../lldca-v1.6.6-mockup.html
"""
import base64
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WWW = os.path.join(ROOT, 'www')

SHELL = """<!DOCTYPE html>
<html lang="zh-CN" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>浮乐 (fuley) 页面模型 · 对齐 v__VER__</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
    background: #dfe4ec; min-height: 100vh; display: flex; flex-direction: column;
    align-items: center; padding: 28px 12px; color: #1a2233;
  }
  .page-head { text-align: center; margin-bottom: 18px; }
  .page-head h1 { font-size: 20px; font-weight: 700; margin: 0; }
  .page-head p { font-size: 13px; color: #7d8698; margin-top: 6px; line-height: 1.6; }
  .phone {
    width: 100%; max-width: 390px; height: 800px; background: #eef1f6; border-radius: 42px;
    box-shadow: 0 24px 60px rgba(20,30,50,.28), 0 0 0 10px #1c2230, 0 0 0 12px #3a4356;
    overflow: hidden; position: relative; display: flex; flex-direction: column;
  }
  .statusbar {
    height: 34px; display: flex; align-items: center; justify-content: space-between;
    padding: 0 26px; font-size: 12.5px; font-weight: 600; color: #1a2233;
    background: #fff; flex: none;
  }
  .main { flex: 1; overflow: hidden; position: relative; }
  .app-frame { width: 100%; height: 100%; border: 0; display: block; background: #eef1f6; }
</style>
</head>
<body>

<div class="page-head">
  <h1>浮乐 (fuley) · 页面模型（对齐 v__VER__）</h1>
  <p>手机壳内即当前版本 App 本体，随代码实时一致：可切换 Tab、添加弹层、中英文切换、登录/注册/找回密码。</p>
</div>

<div class="phone">
  <div class="statusbar"><span>9:41</span><span>5G ▮▮▮ 100%</span></div>
  <div class="main"><iframe id="appFrame" class="app-frame" title="浮乐 App"></iframe></div>
</div>

<script type="text/plain" id="appSrc">__B64__</script>
<script>
var APP_HTML = null;
function loadApp() {
  var el = document.getElementById('appSrc');
  if (APP_HTML == null) {
    var bin = atob(el.textContent.replace(/\\s+/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    APP_HTML = new TextDecoder('utf-8').decode(bytes);
  }
  document.getElementById('appFrame').srcdoc = APP_HTML;
}
loadApp();
/* 壳内 App 切换语言时不再 location.reload：about:srcdoc 下导航不可靠，
   会丢掉登录态、弹回注册/登录页。改为原地重建 srcdoc：同源、存储不变、不导航。 */
window.addEventListener('message', function (e) {
  if (e.data === 'fuley:reload' && APP_HTML != null) loadApp();
});
</script>
</body>
</html>
"""

# 只在「页面模型」里生效的小样式（手机壳内不显示滚动条，避免右侧留一条灰带）
MOCK_ONLY_CSS = """
/* mockup-only: 手机壳内隐藏滚动条 */
html, body { overflow-x: hidden; }
::-webkit-scrollbar { width: 0; height: 0; }
"""


def read(name):
    p = os.path.join(WWW, name)
    with open(p, encoding='utf-8') as f:
        return f.read()


def build_inline_app():
    idx = read('index.html')
    css = read('styles.css') + MOCK_ONLY_CSS
    i18n = read('i18n.js')
    app = read('app.js')
    lic = read('license.js') if os.path.exists(os.path.join(WWW, 'license.js')) else ''

    # 原型专用 shim：把「切换语言」的整页 reload 改成通知外壳原地重建 iframe
    idx = idx.replace(
        '<head>',
        '<head>\n<script>window.__fuleyReload=function(){try{parent.postMessage("fuley:reload","*");}catch(e){}};</script>',
        1)
    idx = idx.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + css + '\n</style>')
    for pat in ('<link rel="manifest" href="manifest.webmanifest">',
                '<link rel="icon" type="image/svg+xml" href="icons/icon.svg">',
                '<link rel="apple-touch-icon" href="icons/icon.svg">'):
        idx = idx.replace(pat, '')
    idx = idx.replace('<script src="i18n.js"></script>', '<script>\n' + i18n + '\n</script>')
    if lic:
        idx = idx.replace('<script src="license.js"></script>', '<script>\n' + lic + '\n</script>')
    idx = idx.replace('<script src="app.js" defer></script>', '<script>\n' + app + '\n</script>')

    left = [t for t in ('src="app.js"', 'src="i18n.js"', 'href="styles.css"') if t in idx]
    if left:
        raise SystemExit('仍有外链资源未内联: %s' % left)
    return idx


def main():
    with open(os.path.join(ROOT, 'package.json'), encoding='utf-8') as f:
        ver = json.load(f).get('version', '0.0.0')

    out = os.path.join(os.path.dirname(ROOT), 'lldca-v%s-mockup.html' % ver)
    args = sys.argv[1:]
    if '--out' in args:
        out = args[args.index('--out') + 1]

    inline = build_inline_app()
    b64 = base64.b64encode(inline.encode('utf-8')).decode()
    html = SHELL.replace('__VER__', ver).replace('__B64__', b64)

    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)

    print('app inline: %.1f KB' % (len(inline.encode('utf-8')) / 1024))
    print('mockup    : %.1f KB -> %s' % (len(html.encode('utf-8')) / 1024, out))


if __name__ == '__main__':
    main()
