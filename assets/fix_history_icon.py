# -*- coding: utf-8 -*-
"""手画一个时钟图标替换 AI 误生成的「禁止符号」，并更新 blue/white 两个版本。"""
import os
from PIL import Image, ImageDraw

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
ICONS = os.path.join(BASE, 'miniprogram', 'images', 'icons')
S, W, INK = 128, 11, (26, 26, 26, 255)

img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# 外圈（表盘）
pad = 14
d.ellipse([pad, pad, S - pad, S - pad], outline=INK, width=W)

# 指针：时针竖直向上 + 分针水平向右（3 点整），圆头端点
def stroke(p1, p2, width=W, color=INK):
    d.line([p1, p2], fill=color, width=width)
    r = width / 2.0
    for (x, y) in (p1, p2):
        d.ellipse([x - r, y - r, x + r, y + r], fill=color)

cx = S / 2.0
stroke((cx, cx), (cx, 44))          # 时针：中心 → 上
stroke((cx, cx), (84, cx))          # 分针：中心 → 右

img.save(os.path.join(ICONS, 'history.png'), 'PNG', optimize=True)
print('时钟蒙版已覆盖 icons/history.png')

# 重新着色 blue 与 white 两个引用版本
for sub, rgb in [('blue', (0x15, 0x65, 0xC0)), ('white', (0xFF, 0xFF, 0xFF))]:
    colored = Image.new('RGBA', img.size)
    colored.putdata([(rgb[0], rgb[1], rgb[2], a) for (_, _, _, a) in img.getdata()])
    colored.save(os.path.join(ICONS, sub, 'history.png'), 'PNG', optimize=True)
    print('已更新 %s/history.png' % sub)
