#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取精灵立绘：S1~S3 精灵图 + 高星光值精灵图 + 星光值图标。
策略一：action=parse&prop=text 正则提取 patchwiki 的 NNNpx-JL_*.png 缩略图 → 推导原图 URL。
策略二（text 无 JL 图时）：action=parse&prop=images 列出页面嵌入文件 → 找 JL_ 文件 → imageinfo 拿 URL。
wiki 主站 EdgeOne 偶发拦截（返回 HTML 挑战页 / error），需重试；patchwiki CDN 稳定。
"""
import urllib.parse, json, subprocess, re, os, time, sys

API = "https://wiki.biligame.com/rocom/api.php"
DL = "https://patchwiki.biligame.com/images/rocom"
ROOT = os.path.dirname(os.path.abspath(__file__))
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36"

def curl(url, out=None, timeout=60):
    cmd = ["curl", "-sk", "--max-time", str(timeout), "-A", UA]
    if out:
        cmd += ["-o", out]
    cmd.append(url)
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.stdout

def api(params, retries=8, wait=5):
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(retries):
        try:
            out = curl(url, timeout=40)
            d = json.loads(out)
        except Exception:
            time.sleep(wait); continue
        if isinstance(d, dict) and "parse" in d:
            return d
        if isinstance(d, dict) and "query" in d:
            return d
        # error dict 或挑战页 → 视为失败重试
        time.sleep(wait)
    return None

def jl_from_text(html):
    """策略一：从页面 HTML 提取 JL 立绘原图 URL"""
    m = re.search(
        r'src="(https://patchwiki\.biligame\.com/images/rocom/thumb/'
        r'([0-9a-f]/[0-9a-f]{2}/[^/"]+\.png)/\d+px-JL_[^"]+\.png)"', html)
    if m:
        return f"{DL}/{m.group(2)}"
    return None

def jl_from_images(page):
    """策略二：通过 prop=images 列文件，找 JL_ 文件拿 URL"""
    d = api({"action": "parse", "page": page, "prop": "images", "format": "json"})
    if not d or "parse" not in d:
        return None
    files = d["parse"].get("images", [])
    jl = [f for f in files if re.search(r"JL_.*\.png", f, re.I)]
    if not jl:
        return None
    # 取第一个 JL 图（页面本体立绘通常排前）
    d2 = api({"action": "query", "titles": jl[0],
              "prop": "imageinfo", "iiprop": "url", "format": "json"})
    if not d2 or "query" not in d2:
        return None
    for p in d2["query"]["pages"].values():
        ii = (p.get("imageinfo") or [{}])[0]
        if ii.get("url"):
            return ii["url"]
    return None

def jl_original(page):
    d = api({"action": "parse", "page": page, "prop": "text", "format": "json"})
    if d and "parse" in d:
        url = jl_from_text(d["parse"]["text"]["*"])
        if url:
            return url
    return jl_from_images(page)

def download(url, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    curl(url, out=path)
    ok = os.path.exists(path) and os.path.getsize(path) > 1000
    if not ok and os.path.exists(path):
        os.remove(path)
    return ok

def fetch_sprite(page, path):
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        return "skip(exists)"
    url = jl_original(page)
    if not url:
        return "NO_IMAGE"
    return "ok" if download(url, path) else "DL_FAIL"

def load_season_sprites():
    jobs = []
    for season in ["S1", "S2", "S3"]:
        with open(os.path.join(ROOT, "data", f"{season}.json"), encoding="utf-8") as f:
            d = json.load(f)
        for s in d["sprites"]:
            jobs.append((s["name"], os.path.join(ROOT, "images", season, f"{s['name']}.png")))
    return jobs

def load_high_value_sprites():
    with open(os.path.join(ROOT, "data", "high_value_sprites.json"), encoding="utf-8") as f:
        d = json.load(f)
    return [(s["name"], os.path.join(ROOT, "images", "high_value", f"{s['name']}.png"))
            for s in d["sprites"]]

def main():
    jobs = load_season_sprites() + load_high_value_sprites()
    star_path = os.path.join(ROOT, "images", "star_value.png")
    jobs.append(("信息图标 星光值", star_path))

    log = open(os.path.join(ROOT, "fetch_images.log"), "w", encoding="utf-8")
    ok = skip = fail = 0
    for i, (name, path) in enumerate(jobs, 1):
        if os.path.basename(path) == "star_value.png":
            if os.path.exists(star_path) and os.path.getsize(star_path) > 1000:
                status = "skip(exists)"
            else:
                d = api({"action": "query", "titles": "File:信息图标 星光值.png",
                         "prop": "imageinfo", "iiprop": "url", "format": "json"})
                url = None
                if d and "query" in d:
                    for p in d["query"]["pages"].values():
                        ii = (p.get("imageinfo") or [{}])[0]
                        url = ii.get("url")
                status = "ok" if (url and download(url, star_path)) else "NO_IMAGE"
        else:
            status = fetch_sprite(name, path)
        if status == "ok": ok += 1
        elif status.startswith("skip"): skip += 1
        else: fail += 1
        log.write(f"[{i}/{len(jobs)}] {status}\t{name}\n")
        log.flush()
        print(f"[{i}/{len(jobs)}] {status}\t{name}", flush=True)
        time.sleep(2)  # 限速，降低被 EdgeOne 拦截概率
    log.write(f"\nDONE ok={ok} skip={skip} fail={fail}\n")
    log.close()
    print(f"DONE ok={ok} skip={skip} fail={fail}")

if __name__ == "__main__":
    main()
