# -*- coding: utf-8 -*-
"""Push local commit to GitHub via Git Data API (bypasses git TLS handshake failure)."""
import json
import subprocess
import sys
import urllib.request
import urllib.error

TOKEN = sys.argv[1]
OWNER, REPO = "koelregb", "lldca"
REPO_DIR = r"C:\Users\2531649\WorkBuddy\2026-10-20-19-10-40\mag7-dca"
NEW_COMMIT = sys.argv[2] if len(sys.argv) > 2 else "HEAD"
BRANCH = "main"


def git(*args, binary=False):
    r = subprocess.run(["git"] + list(args), cwd=REPO_DIR, capture_output=True)
    if r.returncode != 0:
        raise RuntimeError("git %s failed: %s" % (" ".join(args), r.stderr.decode("utf-8", "replace")))
    return r.stdout if binary else r.stdout.decode("utf-8")


def api(method, path, data=None):
    url = "https://api.github.com/repos/%s/%s%s" % (OWNER, REPO, path)
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Authorization", "Bearer " + TOKEN)
    req.add_header("Accept", "application/vnd.github+json")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError("API %s %s -> %s: %s" % (method, path, e.code, e.read().decode()[:500]))


def parse_tree(raw):
    """Parse binary tree object into list of (mode, name, sha_hex)."""
    entries = []
    i = 0
    while i < len(raw):
        j = raw.index(b" ", i)
        mode = raw[i:j].decode()
        k = raw.index(b"\0", j)
        name = raw[j + 1:k]
        sha = raw[k + 1:k + 21].hex()
        entries.append((mode, name, sha))
        i = k + 21
    return entries


def create_blob(local_sha):
    content = git("cat-file", "blob", local_sha, binary=True)
    b64 = __import__("base64").b64encode(content).decode()
    # Content is ASCII/base64 -> JSON safe
    return api("POST", "/git/blobs", {"content": b64, "encoding": "base64"})["sha"]


def create_tree(local_sha, cache):
    if local_sha in cache:
        return cache[local_sha]
    raw = git("cat-file", "tree", local_sha, binary=True)
    tree_entries = []
    for mode, name, sha in parse_tree(raw):
        m = mode.lstrip("0") or "0"
        etype = {"100644": "blob", "100755": "blob", "40000": "tree", "120000": "blob", "160000": "commit"}[m]
        out_mode = {"tree": "040000", "blob": mode if m in ("100644", "100755", "120000") else "100644", "commit": "160000"}[etype]
        if etype == "blob":
            remote_sha = create_blob(sha)
        elif etype == "tree":
            remote_sha = create_tree(sha, cache)
        else:
            remote_sha = sha  # submodule, pass through
        tree_entries.append({"path": name.decode("utf-8"), "mode": out_mode, "type": etype, "sha": remote_sha})
    remote = api("POST", "/git/trees", {"tree": tree_entries})["sha"]
    cache[local_sha] = remote
    return remote


def main():
    commit_sha = git("rev-parse", NEW_COMMIT).strip()
    parent_sha = (sys.argv[3] if len(sys.argv) > 3 else "") or git("rev-parse", commit_sha + "^").strip()
    meta = git("cat-file", "commit", commit_sha)
    lines = meta.splitlines()
    msg_lines = []
    i = 0
    while i < len(lines) and lines[i]:
        msg_lines.append(lines[i])
        i += 1
    i += 1  # blank line
    message = "\n".join(lines[i:])
    author = next(l for l in msg_lines if l.startswith("author "))
    committer = next(l for l in msg_lines if l.startswith("committer "))
    def parse_ident(line):
        # "author Name <email> 1792561503 +0800"
        rest = line.split(" ", 1)[1]
        name_email, ts, tz = rest.rsplit(" ", 2)
        name, email = name_email.rsplit(" <", 1)
        import datetime
        sign = 1 if tz[0] == "+" else -1
        tzinfo = datetime.timezone(sign * datetime.timedelta(hours=int(tz[1:3]), minutes=int(tz[3:5])))
        dt = datetime.datetime.fromtimestamp(int(ts), tz=tzinfo)
        return {"name": name, "email": email.rstrip(">"), "date": dt.isoformat()}
    local_tree = git("rev-parse", commit_sha + "^{tree}").strip()
    remote_tree = create_tree(local_tree, {})
    remote_commit = api("POST", "/git/commits", {
        "message": message,
        "tree": remote_tree,
        "parents": [parent_sha],
        "author": parse_ident(author),
        "committer": parse_ident(committer),
    })["sha"]
    ref = api("PATCH", "/git/refs/heads/" + BRANCH, {"sha": remote_commit, "force": False})
    print("OK local=%s remote=%s" % (commit_sha, remote_commit))
    print("REF", ref["ref"], ref["object"]["sha"])


if __name__ == "__main__":
    main()
