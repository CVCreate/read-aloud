# -*- coding: utf-8 -*-
# 分享卡片封面：5:4（500x400）
# 沿用 logo 的「小喇叭 + 三条声波」造型与青绿→蓝渐变，保证品牌一致
from PIL import Image, ImageDraw, ImageFilter

import os
BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

W, H = 500, 400
SS = 4                      # 超采样倍数，缩小后边缘更平滑
CW, CH = W * SS, H * SS
OUT = BASE + "/miniprogram/images/share.png"

BG1, BG2 = (23, 195, 163), (27, 127, 212)


def gradient(w, h):
    """先画 100x80 小图再放大：渐变平滑且耗时极低"""
    sw, sh = 100, 80
    small = Image.new("RGB", (sw, sh))
    px = small.load()
    for y in range(sh):
        for x in range(sw):
            t = (x / (sw - 1) + y / (sh - 1)) / 2
            px[x, y] = tuple(int(a + (b - a) * t) for a, b in zip(BG1, BG2))
    return small.resize((w, h), Image.LANCZOS)


# ---- 1) 掩膜上画剪影（24 网格比例，与 logo 同源）----
mask = Image.new("L", (CW, CH), 0)
d = ImageDraw.Draw(mask)
s = 13.5 * SS
# 包围盒中心 x=12.65、y=12；整体略上移，横版下方留白更好看
ox = (W / 2 - 12.95 * 13.5) * SS
oy = (190 - 12 * 13.5) * SS

body = [(3, 9), (3, 15), (7, 15), (12, 20), (12, 4), (7, 9)]
d.polygon([(ox + x * s, oy + y * s) for x, y in body], fill=255)

cx, cy = ox + 14.5 * s, oy + 12 * s
# 三条弧等间距 2.4s、线宽 1.0s：间隙 1.4s 明显大于模糊半径，圆角化后不会粘连
for k in (3.6, 6.0, 8.4):
    r = k * s
    d.arc([cx - r, cy - r, cx + r, cy + r], start=-48, end=48, fill=255, width=int(1.0 * s))

# ---- 2) 模糊 + 阈值：尖角与笔画端点全部圆润（与 logo 同一手法）----
mask = mask.filter(ImageFilter.GaussianBlur(0.56 * s))
mask = mask.point(lambda p: 255 if p >= 128 else 0)

# ---- 3) 白图形贴到渐变底，再缩回目标尺寸 ----
img = gradient(CW, CH)
white = Image.new("RGB", (CW, CH), (255, 255, 255))
img.paste(white, (0, 0), mask)
img = img.resize((W, H), Image.LANCZOS)
img.save(OUT, "PNG", optimize=True)
print("分享图:", OUT, img.size)
