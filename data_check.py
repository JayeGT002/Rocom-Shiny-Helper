#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""数据一致性校验：seasons.json 与 high_value_sprites.json。

检查内容：
1. seasons.json 的赛季 id 唯一、可解析为 S<数字>，且文件按「新→旧」降序排列
   （本站约定：新增赛季插入文件头部，最新赛季在前，与页面下拉顺序一致）。
2. high_value_sprites.json 的精灵名唯一。
3. 精灵的 notBeforeSeason / notAfterSeason 必须引用 seasons.json 中存在的赛季；
   两者同时设置时 notBeforeSeason 必须早于 notAfterSeason。

用法：python3 data_check.py
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))

def load(name):
    with open(os.path.join(ROOT, 'data', name), encoding='utf-8') as f:
        return json.load(f)

def season_num(tok):
    m = re.match(r'^S(\d+)$', str(tok or '').strip())
    return int(m.group(1)) if m else None

def main():
    errors = []

    seasons = load('seasons.json')['seasons']
    ids = [s['id'] for s in seasons]

    dups = sorted({x for x in ids if ids.count(x) > 1})
    if dups:
        errors.append(f'seasons.json 存在重复赛季 id：{dups}')

    nums = [season_num(x) for x in ids]
    bad = [x for x, n in zip(ids, nums) if n is None]
    if bad:
        errors.append(f'seasons.json 存在无法解析的赛季 id：{bad}（应为 S<数字>）')
    elif nums != sorted(nums, reverse=True):
        errors.append('seasons.json 应保持「新→旧」降序（最新赛季在最前），新增赛季请插入文件头部')

    rank = {sid: i + 1 for i, sid in enumerate(reversed(ids))}

    sprites = load('high_value_sprites.json')['sprites']
    names = [s['name'] for s in sprites]
    dups = sorted({x for x in names if names.count(x) > 1})
    if dups:
        errors.append(f'high_value_sprites.json 存在重复精灵名：{dups}')

    for sp in sprites:
        nm = sp['name']
        nb = str(sp.get('notBeforeSeason') or '').strip()
        na = str(sp.get('notAfterSeason') or '').strip()
        for field, val in (('notBeforeSeason', nb), ('notAfterSeason', na)):
            if val and val not in rank:
                errors.append(f'{nm} 的 {field}={val!r} 未在 seasons.json 中，请检查写法或补充赛季')
        if nb in rank and na in rank and rank[nb] >= rank[na]:
            errors.append(f'{nm} 的 notBeforeSeason({nb}) 应早于 notAfterSeason({na})')

    if errors:
        print('校验未通过：')
        for e in errors:
            print('  -', e)
        sys.exit(1)
    print(f'OK：seasons.json {len(seasons)} 个赛季、high_value_sprites {len(sprites)} 只精灵，赛季数据一致。')

if __name__ == '__main__':
    main()
