# -*- coding: utf-8 -*-
"""
图标归一化：把 blue/green/red/white 下所有 PNG 的图形内容
统一缩放到画布的 76% 并几何居中。
------------------------------------------------------------
背景：图标最初从 AI 生成的 5x5 网格图切片而来，各图形在画布内
位置/占比不一致（时钟 79% 满格居中，喇叭 60% 偏下 16px……），
小程序里同尺寸显示就会大小不齐、上下不齐。
用法：C:/Python314/python.exe assets/normalize_icons.py
（会先备份原文件到 assets/icons_backup_<日期>/）
"""
import os
import shutil
import sys
from datetime import datetime

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS = os.path.join(ROOT, 'miniprogram', 'images', 'icons')
CANVAS = 128
FILL = 0.76      # 内容最长边占画布比例（统一后的视觉大小）
ALPHA_MIN = 16   # alpha 低于此值视为透明（抗锯齿边不算内容）

def process(path):
    im = Image.open(path).convert('RGBA')
    if im.size != (CANVAS, CANVAS):
        im = im.resize((CANVAS, CANVAS), Image.LANCZOS)
    alpha = im.getchannel('A').point(lambda v: 255 if v >= ALPHA_MIN else 0)
    bbox = alpha.getbbox()
    if not bbox:
        print('  跳过（空白图）:', os.path.relpath(path, ICONS))
        return
    content = im.crop(bbox)
    w, h = content.size
    scale = (CANVAS * FILL) / max(w, h)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    if (nw, nh) != (w, h):
        content = content.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.paste(content, ((CANVAS - nw) // 2, (CANVAS - nh) // 2), content)
    canvas.save(path)
    print('  已归一:', os.path.relpath(path, ICONS))

def main():
    backup = os.path.join(ROOT, 'assets', 'icons_backup_' + datetime.now().strftime('%Y%m%d'))
    changed = 0
    for sub in ('blue', 'green', 'red', 'white'):
        d = os.path.join(ICONS, sub)
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if not f.endswith('.png'):
                continue
            src = os.path.join(d, f)
            bdir = os.path.join(backup, sub)
            os.makedirs(bdir, exist_ok=True)
            shutil.copy2(src, os.path.join(bdir, f))
            process(src)
            changed += 1
    print('完成，共处理 %d 个图标；原件备份在 %s' % (changed, os.path.relpath(backup, ROOT)))

if __name__ == '__main__':
    sys.exit(main())
