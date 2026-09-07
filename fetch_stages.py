#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取高星光值精灵的进化阶段数据与各阶段图片。
进化链解析：页面 HTML 中 <div class="sprite-evolve-section"> 每段含
sprite-evolve-img 的 JL 缩略图（推导原图 URL）与 data-link 阶段名。
阶段图存 images/high_value/{阶段名}.png；阶段列表写回 high_value_sprites.json。
"""
import os, sys, re, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_images import api, download, ROOT

# 用户指定覆盖（wiki 与用户认知不符时以用户为准）
OVERRIDES = {}

def parse_stages(page):
    """返回 [(阶段名, JL原图URL), ...] 或 None（页面无进化链）。
    忽略首领化（_shouling）形态，它们不算正常进化阶段。"""
    d = api({"action": "parse", "page": page, "prop": "text", "format": "json"})
    if not d or "parse" not in d:
        return None
    html = d["parse"]["text"]["*"]
    pat = re.compile(
        r'<div class="sprite-evolve-section">.*?'
        r'<img[^>]*src="(https://patchwiki[^"]+?)"[^>]*>.*?'
        r'data-link="([^"]+)"', re.S)
    out = []
    for m in pat.finditer(html):
        thumb, name = m.group(1), m.group(2)
        if "_shouling" in thumb.lower():  # 首领化：不算正常进化形态
            continue
        mm = re.search(
            r'https://patchwiki\.biligame\.com/images/rocom/thumb/([0-9a-f]/[0-9a-f]{2}/[^/]+\.png)/',
            thumb)
        if mm:
            out.append((name, f"https://patchwiki.biligame.com/images/rocom/{mm.group(1)}"))
    return out or None

def main():
    path = os.path.join(ROOT, "data", "high_value_sprites.json")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    ok = skip = fail = 0
    for i, sp in enumerate(data["sprites"], 1):
        name = sp["name"]
        if name in OVERRIDES:
            stages = OVERRIDES[name]
            urls = {}
            print(f"[{i}/{len(data['sprites'])}] override\t{name} -> {stages}", flush=True)
        else:
            found = parse_stages(name)
            if not found:
                stages, urls = [name], {}
                print(f"[{i}/{len(data['sprites'])}] no_chain\t{name}", flush=True)
            else:
                stages = [n for n, _ in found]
                urls = {n: u for n, u in found}
                print(f"[{i}/{len(data['sprites'])}] chain\t{name} -> {stages}", flush=True)

        for s in stages:
            p = os.path.join(ROOT, "images", "high_value", f"{s}.png")
            if os.path.exists(p) and os.path.getsize(p) > 1000:
                skip += 1
                continue
            u = urls.get(s)
            if u and download(u, p):
                ok += 1
            else:
                fail += 1
                print(f"  DL_FAIL {s}", flush=True)
            time.sleep(1)

        sp["stages"] = stages

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"DONE ok={ok} skip={skip} fail={fail}", flush=True)

if __name__ == "__main__":
    main()
