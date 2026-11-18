# -*- coding: utf-8 -*-
# 方案 D：张开的嘴 + 右侧声波（程序绘制，简洁可认）
from PIL import Image, ImageDraw, ImageFont

import os
BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

SIZE = 1024
FONT = r"C:/Windows/Fonts/msyhbd.ttc"
OUT = BASE + "/assets/logo_candidate_D.png"


def diagonal_gradient(c1, c2):
    img = Image.new("RGB", (SIZE, SIZE))
    px = img.load()
    for y in range(SIZE):
        for x in range(SIZE):
            t = (x + y) / (2 * SIZE - 2)
            px[x, y] = tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))
    return img


A_BG1, A_BG2 = (23, 195, 163), (27, 127, 212)  # 与界面 --go/--accent 同色系
img = diagonal_gradient(A_BG1, A_BG2)
d = ImageDraw.Draw(img)
W = (255, 255, 255)

# ---- 张开的嘴：上唇带唇峰，下唇圆拱，白色实心 ----
# 以嘴中心 (MX, MY) 为原点的相对点列（上唇 -> 右角 -> 下唇 -> 左角闭合）
MX, MY = 400, 500
upper = [(-260, 0), (-225, -55), (-155, -108), (-70, -128), (0, -80),
         (70, -128), (155, -108), (225, -55), (260, 0)]
lower = [(260, 0), (215, 85), (140, 150), (60, 185), (0, 196),
         (-60, 185), (-140, 150), (-215, 85), (-260, 0)]
# 在上唇唇峰/谷之间补插值点，让曲线更圆润
def densify(points, extra=3):
    out = []
    for i in range(len(points) - 1):
        (x1, y1), (x2, y2) = points[i], points[i + 1]
        out.append((x1, y1))
        for k in range(1, extra):
            t = k / extra
            # 用轻微的二次弯曲平滑折角
            out.append((x1 + (x2 - x1) * t, y1 + (y2 - y1) * t))
    out.append(points[-1])
    return out

pts = [(MX + x, MY + y) for x, y in densify(upper + lower)]
d.polygon(pts, fill=W)

# ---- 唇缝：沿嘴中线画一条渐变色细缝（颜色取该位置渐变值，视觉即两片唇） ----
GAP_W = 26
for i in range(60):
    x0 = MX - 246 + i * (492 / 60)
    x1 = x0 + 516 / 60 + 2
    for xx in (x0, x1):
        pass
    t = ((x0 + x1) / 2 + MY) / (2 * SIZE - 2)
    col = tuple(int(a + (b - a) * t) for a, b in zip(A_BG1, A_BG2))
    d.line([(x0, MY), (x0 + 492 / 60 + 1, MY)], fill=col, width=GAP_W)

# ---- 右侧三条声波弧 ----
for r in [85, 160, 235]:
    d.arc([660 - r, MY - r, 660 + r, MY + r], start=-50, end=50, fill=W, width=36)

img.save(OUT, "PNG")
print("方案D:", OUT)
