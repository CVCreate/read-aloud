# -*- coding: utf-8 -*-
"""
PNG 图标瘦身：在不损失视觉质量的前提下压缩 miniprogram/images 下所有 PNG。
------------------------------------------------------------
方法：
  1. 缩到实际需要的尺寸（图标在界面最大显示 104rpx ≈ 52px@2x，96px 足够）；
     已小于 96px 的保持原尺寸。
  2. 转 256 色调色板（P 模式）+ optimize —— 纯色图标能减 50%~70%。
  3. 原件备份到 assets/png_backup_<日期>/。
用法：C:/Python314/python.exe assets/optimize_png.py
"""
import os
import shutil
import sys
from datetime import datetime

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'miniprogram', 'images')
MAX_SIDE = 96  # 图标显示最大 104rpx，96px 绰绰有余


def process(path):
    im = Image.open(path)
    had_alpha = im.mode in ('RGBA', 'LA') or 'transparency' in im.info
    im = im.convert('RGBA')
    w, h = im.size
    if max(w, h) > MAX_SIDE:
        scale = MAX_SIDE / max(w, h)
        im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    # 量化到 256 色（保留 alpha），再存优化 PNG
    q = im.quantize(colors=256, method=Image.FASTOCTREE)
    before = os.path.getsize(path)
    q.save(path, optimize=True)
    after = os.path.getsize(path)
    return before, after


def main():
    backup = os.path.join(ROOT, 'assets', 'png_backup_' + datetime.now().strftime('%Y%m%d'))
    total_before = total_after = 0
    count = 0
    for r, d, fs in os.walk(IMG):
        for f in sorted(fs):
            if not f.endswith('.png'):
                continue
            src = os.path.join(r, f)
            rel = os.path.relpath(src, IMG)
            bdir = os.path.join(backup, os.path.dirname(rel))
            os.makedirs(bdir, exist_ok=True)
            shutil.copy2(src, os.path.join(bdir, f))
            before, after = process(src)
            total_before += before
            total_after += after
            count += 1
    print('处理 %d 个 PNG：%d KB → %d KB（省 %.0f%%）'
          % (count, total_before / 1024, total_after / 1024,
             100 * (1 - total_after / max(1, total_before))))
    print('备份：' + os.path.relpath(backup, ROOT))


if __name__ == '__main__':
    sys.exit(main())
