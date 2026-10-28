# -*- coding: utf-8 -*-
"""Force-push local changed files onto remote main HEAD via Git Data API.
用法: push_now.py <token> [files...]
自动以远端 main HEAD 为父提交，把指定本地文件的内容构建成新 tree/commit 并更新 main。
"""
import base64
import json
import os
import subprocess
import sys
import urllib.request
import urllib.error

TOKEN = sys.argv[1]
MSG = sys.argv[2]
FILES = sys.argv[3:]
REPO_DIR = r"C:\Users\2531649\WorkBuddy\2026-10-20-19-10-40\mag7-dca"
OWNER, REPO = "koelregb", "lldca"


def api(method, path, data=None, ctype="application/vnd.github+json", timeout=180):
    url = "https://api.github.com/repos/%s/%s%s" % (OWNER, REPO, path)
    body = data if isinstance(data, (bytes, type(None))) else json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Authorization", "Bearer " + TOKEN)
    req.add_header("Accept", "application/vnd.github+json")
    if ctype:
        req.add_header("Content-Type", ctype)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            return json.loads(raw.decode()) if raw else {}
    except urllib.error.HTTPError as e:
        raise RuntimeError("API %s %s -> %s: %s" % (method, path, e.code, e.read().decode()[:500]))


# 1) 远端 main HEAD
head = api("GET", "/git/ref/heads/main")
parent_sha = head["object"]["sha"]
print("remote main HEAD:", parent_sha)
parent = api("GET", "/git/commits/" + parent_sha)
parent_tree = parent["tree"]["sha"]
print("parent tree:", parent_tree)

# 2) 远端整棵 tree（recursive）
tree = api("GET", "/git/trees/%s?recursive=1" % parent_tree)
entries = []
for e in tree["tree"]:
    if e["type"] == "blob":
        entries.append({"path": e["path"], "mode": e["mode"], "type": "blob", "sha": e["sha"]})
print("remote blobs:", len(entries), "truncated:", tree.get("truncated"))
if tree.get("truncated"):
    raise SystemExit("tree truncated, need nested-tree strategy")

# 3) 本地改动文件 → 建 blob，替换 tree 条目
def local_git_sha(rel):
    r = subprocess.run(["git", "rev-parse", "HEAD:" + rel], cwd=REPO_DIR, capture_output=True)
    return r.stdout.decode().strip() if r.returncode == 0 else None

for rel in FILES:
    full = os.path.join(REPO_DIR, rel)
    with open(full, "rb") as f:
        content = f.read()
    git_sha = local_git_sha(rel)
    if git_sha:
        # 已知对象 sha，直接引用（省流量）
        new_sha = git_sha
        try:
            api("GET", "/git/blobs/" + new_sha)
            print("reuse existing blob:", rel, new_sha[:8])
        except RuntimeError:
            d = api("POST", "/git/blobs", {"content": base64.b64encode(content).decode(), "encoding": "base64"})
            new_sha = d["sha"]
            print("upload blob:", rel, new_sha[:8])
    else:
        d = api("POST", "/git/blobs", {"content": base64.b64encode(content).decode(), "encoding": "base64"})
        new_sha = d["sha"]
        print("upload blob:", rel, new_sha[:8])
    found = False
    for e in entries:
        if e["path"] == rel:
            e["sha"] = new_sha
            found = True
            break
    if not found:
        entries.append({"path": rel, "mode": "100644", "type": "blob", "sha": new_sha})

# 4) 新 tree → 新 commit → 更新 ref
new_tree = api("POST", "/git/trees", {"tree": entries})
msg = MSG
commit = api("POST", "/git/commits", {"message": msg, "tree": new_tree["sha"], "parents": [parent_sha]})
print("new commit:", commit["sha"])
api("PATCH", "/git/refs/heads/main", {"sha": commit["sha"], "force": True})
print("main updated ->", commit["sha"])
