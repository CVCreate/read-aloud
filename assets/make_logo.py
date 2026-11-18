# -*- coding: utf-8 -*-
# 生成新 logo：渐变背景 + 大字「念」+ 声波弧（贴合"我来念"主题）
# 用法: C:/Python314/python.exe assets/make_logo.py
from PIL import Image, ImageDraw, ImageFont

import os
BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

SIZE = 1024
FONT = r"C:/Windows/Fonts/msyhbd.ttc"  # 微软雅黑 粗体
OUT_A = BASE + "/assets/logo_candidate_A.png"
OUT_B = BASE + "/assets/logo_candidate_B.png"


def diagonal_gradient(c1, c2):
    """左上 c1 -> 右下 c2 的对角平滑渐变"""
    img = Image.new("RGB", (SIZE, SIZE))
    px = img.load()
    for y in range(SIZE):
        for x in range(SIZE):
            t = (x + y) / (2 * SIZE - 2)
            px[x, y] = tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))
    return img


def draw_waves(draw, cx, cy, radii, span, width, color):
    """以 (cx, cy) 为圆心、向右张开的声波弧组"""
    for r in radii:
        draw.arc([cx - r, cy - r, cx + r, cy + r],
                 start=-span, end=span, fill=color, width=width)


def draw_dot(draw, cx, cy, r, color):
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)


# ---- 方案 A：青绿→蓝渐变 + 白字「念」+ 右侧声波 ----
A_BG1, A_BG2 = (23, 195, 163), (27, 127, 212)  # 与界面 --go/--accent 同色系
img = diagonal_gradient(A_BG1, A_BG2)
d = ImageDraw.Draw(img)

font = ImageFont.truetype(FONT, 560)
# 「念」居左，声波在右
bbox = d.textbbox((0, 0), "念", font=font)
tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
tx, ty = 330 - tw // 2 - bbox[0], 512 - th // 2 - bbox[1]
d.text((tx, ty), "念", font=font, fill=(255, 255, 255))

draw_waves(d, 640, 512, [95, 175, 255], 52, 34, (255, 255, 255))
img.save(OUT_A, "PNG")
print("方案A:", OUT_A)

# ---- 方案 B：深青→深蓝渐变 + 大字居中 + 底部小声波点缀 ----
B_BG1, B_BG2 = (16, 138, 120), (21, 82, 158)
img = diagonal_gradient(B_BG1, B_BG2)
d = ImageDraw.Draw(img)

font = ImageFont.truetype(FONT, 620)
bbox = d.textbbox((0, 0), "念", font=font)
tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
tx, ty = 512 - tw // 2 - bbox[0], 470 - th // 2 - bbox[1]
d.text((tx, ty), "念", font=font, fill=(255, 255, 255))

# 底部居中：小圆点 + 三条向右短弧（缩小版声波）
draw_dot(d, 392, 810, 16, (255, 255, 255))
draw_waves(d, 442, 810, [30, 58, 86], 55, 14, (255, 255, 255))
img.save(OUT_B, "PNG")
print("方案B:", OUT_B)
