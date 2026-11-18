# -*- coding: utf-8 -*-
# 方案 F：小喇叭 + 声波（圆润版：先画剪影，再模糊+阈值圆角化，无硬线条）
from PIL import Image, ImageDraw, ImageFilter

import os
BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

SIZE = 1024
OUT = BASE + "/assets/logo_candidate_F.png"


def diagonal_gradient(c1, c2):
    img = Image.new("RGB", (SIZE, SIZE))
    px = img.load()
    for y in range(SIZE):
        for x in range(SIZE):
            t = (x + y) / (2 * SIZE - 2)
            px[x, y] = tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))
    return img


A_BG1, A_BG2 = (23, 195, 163), (27, 127, 212)

# ---- 1) 在掩膜上画剪影（喇叭 + 弧），先画粗一点补偿模糊损耗 ----
mask = Image.new("L", (SIZE, SIZE), 0)
d = ImageDraw.Draw(mask)
s = 36
ox, oy = 62, 74
body = [(3, 9), (3, 15), (7, 15), (12, 20), (12, 4), (7, 9)]
pts = [(ox + x * s, oy + y * s) for x, y in body]
d.polygon(pts, fill=255)

cx, cy = ox + 14.5 * s, oy + 12 * s
for r in [112, 198, 284]:
    d.arc([cx - r, cy - r, cx + r, cy + r], start=-48, end=48, fill=255, width=46)

# ---- 2) 圆角化：高斯模糊 + 阈值，所有尖角与端点变圆润 ----
mask = mask.filter(ImageFilter.GaussianBlur(22))
mask = mask.point(lambda p: 255 if p >= 128 else 0)

# ---- 3) 贴白到渐变背景 ----
img = diagonal_gradient(A_BG1, A_BG2)
white = Image.new("RGB", (SIZE, SIZE), (255, 255, 255))
img.paste(white, (0, 0), mask)

img.save(OUT, "PNG")
print("方案F圆润版:", OUT)
