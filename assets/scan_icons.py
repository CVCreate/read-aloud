# -*- coding: utf-8 -*-
# 扫描所有 wxml，列出用到的 emoji / 符号图标及其出现位置
import os
import re
import unicodedata
import collections

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'miniprogram')

# 只保留「可能用作图标」的字符：emoji、箭头、几何符号、杂项符号等（排除中文、标点、字母数字）
ICON_RANGES = [
    (0x2190, 0x21FF),   # 箭头
    (0x2300, 0x23FF),   # 杂项技术符号
    (0x25A0, 0x27BF),   # 几何 / 装饰符号
    (0x2B00, 0x2BFF),   # 杂项符号箭头
    (0x1F000, 0x1FAFF),  # emoji
    (0xFE0F, 0xFE0F),   # 变体选择符
]


def is_icon(ch):
    cp = ord(ch)
    for a, b in ICON_RANGES:
        if a <= cp <= b:
            return True
    return False


per = collections.OrderedDict()
total = collections.Counter()

for root, _, files in os.walk(BASE):
    for name in files:
        if not name.endswith('.wxml'):
            continue
        path = os.path.join(root, name)
        rel = os.path.relpath(path, BASE)
        src = open(path, encoding='utf-8').read()
        hits = [(i, ch) for i, ch in enumerate(src) if is_icon(ch)]
        if not hits:
            continue
        # 合并变体选择符
        merged = []
        for i, ch in hits:
            if ord(ch) == 0xFE0F and merged:
                merged[-1][1] = merged[-1][1] + ch
            else:
                merged.append([i, ch])
        if rel not in per:
            per[rel] = []
        for i, ch in merged:
            per[rel].append((i, ch))
            total[ch] += 1

print('==== 每个文件用到的图标 ====')
for rel, items in per.items():
    # 按行号输出
    lines = open(os.path.join(BASE, rel), encoding='utf-8').read().split('\n')
    print('\n[%s]' % rel)
    for i, ch in items:
        line_no = len(open(os.path.join(BASE, rel), encoding='utf-8').read()[:i].split('\n'))
        text = lines[line_no - 1].strip()
        if len(text) > 60:
            text = text[:60] + '…'
        print('  L%-3d %-4s  %s' % (line_no, ch, text))

print('\n==== 汇总：共 %d 种 ====' % len(total))
for ch, n in total.most_common():
    try:
        nm = unicodedata.name(ch[0])
    except Exception:
        nm = '?'
    print('%-4s x%-3d  U+%-8X %s' % (ch, n, ord(ch[0]), nm))
