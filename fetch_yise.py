#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取 S1~S3 精灵的异色图（常规图 = JL_{pinyin}.png，异色图 = JL_{pinyin}_yise.png）。
异色图存 images/S{赛季}/{精灵名}_异色.png；页面无 _yise 文件则跳过（前端不交替）。
"""
import os, sys, re, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_images import api, download, ROOT

def yise_url(page):
    d = api({"action": "parse", "page": page, "prop": "images", "format": "json"})
    if not d or "parse" not in d:
        return None
    files = d["parse"].get("images", [])
    jls = [f for f in files if re.search(r"JL_.*\.png", f, re.I)]
    # 找第一个普通 JL（非 _yise / _shouling）作为主图 base
    base = None
    for f in jls:
        low = f.lower()
        if "_yise" in low or "_shouling" in low:
            continue
        m = re.match(r"JL_([A-Za-z0-9_]+)\.png", f, re.I)
        if m:
            base = m.group(1)
            break
    if not base:
        return None
    yf = f"JL_{base}_yise.png"
    if yf not in files:
        return None
    d2 = api({"action": "query", "titles": f"File:{yf}",
              "prop": "imageinfo", "iiprop": "url", "format": "json"})
    if not d2 or "query" not in d2:
        return None
    for p in d2["query"]["pages"].values():
        ii = (p.get("imageinfo") or [{}])[0]
        if ii.get("url"):
            return ii["url"]
    return None

def main():
    jobs = []
    for season in ["S1", "S2", "S3"]:
        with open(os.path.join(ROOT, "data", f"{season}.json"), encoding="utf-8") as f:
            d = json.load(f)
        for s in d["sprites"]:
            jobs.append((season, s["name"]))

    ok = skip = no = 0
    for i, (season, name) in enumerate(jobs, 1):
        path = os.path.join(ROOT, "images", season, f"{name}_异色.png")
        if os.path.exists(path) and os.path.getsize(path) > 1000:
            skip += 1
            print(f"[{i}/{len(jobs)}] skip(exists)\t{name}", flush=True)
            continue
        url = yise_url(name)
        if url and download(url, path):
            ok += 1
            print(f"[{i}/{len(jobs)}] ok\t{name}", flush=True)
        else:
            no += 1
            print(f"[{i}/{len(jobs)}] NO_YISE\t{name}", flush=True)
        time.sleep(2)

    print(f"DONE ok={ok} skip={skip} no_yise={no}", flush=True)

if __name__ == "__main__":
    main()
