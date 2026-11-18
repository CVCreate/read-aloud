import os
# -*- coding: utf-8 -*-
# 拼 logo 对比图：旧版 + 方案A/B/C，圆角 + 小尺寸模拟微信列表显示
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.abspath(os.path.dirname(__file__))
OLD = BASE + "/logo.png"
A = BASE + "/logo_candidate_A.png"
B = BASE + "/logo_candidate_B.png"
C = BASE + "/Modern_flat_mobile_app_icon__s_2026-10-14T01-37-44.png"
OUT = BASE + "/logo_compare.png"

CELL = 420          # 单元格图片尺寸
GAP = 40
LABEL_H = 64


def rounded(img, radius):
    mask = Image.new("L", img.size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, img.size[0] - 1, img.size[1] - 1], radius=radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


# 方案C：中心裁剪去掉右下角 AI 水印
c = Image.open(C).convert("RGB")
w, h = c.size
side = int(min(w, h) / 1.14)
left, top = (w - side) // 2, (h - side) // 2
c = c.crop((left, top, left + side, top + side)).resize((1024, 1024), Image.LANCZOS)

names = ["旧版（像信号）", "方案A：念+声波", "方案B：大念居中", "方案C：书+声浪"]
imgs = [Image.open(OLD).convert("RGB"), Image.open(A).convert("RGB"),
        Image.open(B).convert("RGB"), c]

total_w = CELL * 4 + GAP * 5
total_h = CELL + LABEL_H * 2 + GAP * 3
canvas = Image.new("RGB", (total_w, total_h), (245, 247, 250))
d = ImageDraw.Draw(canvas)
font = ImageFont.truetype(r"C:/Windows/Fonts/msyh.ttc", 34)

for i, (im, name) in enumerate(zip(imgs, names)):
    x = GAP + i * (CELL + GAP)
    y_top = GAP
    # 圆角版
    r = rounded(im.resize((CELL, CELL), Image.LANCZOS), 72)
    canvas.paste(r, (x, y_top), r)
    # 名字
    bbox = d.textbbox((0, 0), name, font=font)
    tw = bbox[2] - bbox[0]
    d.text((x + (CELL - tw) // 2 - bbox[0], y_top + CELL + 14), name, font=font, fill=(60, 64, 70))

canvas.save(OUT, "PNG")
print("对比图:", OUT, canvas.size)
