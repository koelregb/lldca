# -*- coding: utf-8 -*-
"""Create GitHub release and upload assets via REST API (gh CLI 卡死时的替代).

仓库开启 immutable releases 后，已发布的 release 不能再追加资产，
因此采用「草稿 → 上传资产 → 发布」三步流程。
"""
import json
import sys
import urllib.request
import urllib.error

TOKEN = sys.argv[1]
TAG = sys.argv[2]
NAME = sys.argv[3]
BODY_FILE = sys.argv[4]
ASSETS = sys.argv[5:]  # local file paths

with open(BODY_FILE, "r", encoding="utf-8") as f:
    body = f.read()


def api(method, url, data=None, ctype="application/vnd.github+json", timeout=180):
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", "Bearer " + TOKEN)
    req.add_header("Accept", "application/vnd.github+json")
    if ctype:
        req.add_header("Content-Type", ctype)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            return json.loads(raw.decode()) if raw else {}
    except urllib.error.HTTPError as e:
        raise RuntimeError("API %s %s -> %s: %s" % (method, url, e.code, e.read().decode()[:400]))


# 1. create release (draft first — immutable release cannot accept assets after publish)
payload = {"tag_name": TAG, "name": NAME, "body": body, "draft": True}
if len(sys.argv) > 5 and sys.argv[5] == "--target":
    payload["target_commitish"] = sys.argv[6]
    ASSETS = sys.argv[7:]
else:
    ASSETS = sys.argv[5:]
d = api("POST", "https://api.github.com/repos/koelregb/lldca/releases",
        json.dumps(payload).encode())
rid = d["id"]
print("draft release created:", TAG, "id", rid)

# 2. upload assets (allowed while draft)
for path in ASSETS:
    name = path.replace("\\", "/").split("/")[-1]
    with open(path, "rb") as f:
        content = f.read()
    url = "https://uploads.github.com/repos/koelregb/lldca/releases/%d/assets?name=%s" % (rid, name)
    api("POST", url, content, ctype="application/octet-stream")
    print("uploaded:", name, len(content), "bytes")

# 3. publish
api("PATCH", "https://api.github.com/repos/koelregb/lldca/releases/%d" % rid,
    json.dumps({"draft": False}).encode())
print("published:", TAG)

print("DONE")
