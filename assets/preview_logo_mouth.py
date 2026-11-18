import os
# -*- coding: utf-8 -*-
# 嘴方案对比：A(念+声波) / D(嘴·绘制) / E(嘴·AI) / 旧版，圆角预览
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.abspath(os.path.dirname(__file__))
OUT = BASE + "/logo_compare_mouth.png"

CELL, GAP, LABEL_H = 420, 40, 64


def rounded(img, radius):
    mask = Image.new("L", img.size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, img.size[0] - 1, img.size[1] - 1], radius=radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


# 方案E：中心裁剪去右下角水印
e = Image.open(BASE + "/Modern_flat_mobile_app_icon__s_2026-10-14T01-41-46.png").convert("RGB")
w, h = e.size
side = int(min(w, h) / 1.14)
left, top = (w - side) // 2, (h - side) // 2
e = e.crop((left, top, left + side, top + side)).resize((1024, 1024), Image.LANCZOS)

names = ["方案F：小喇叭+声波", "方案D：嘴+声波·绘制", "方案E：嘴+声波·AI", "旧版（参考）"]
imgs = [Image.open(BASE + "/logo_candidate_F.png"),
        Image.open(BASE + "/logo_candidate_D.png"),
        e,
        Image.open(BASE + "/logo.png")]

total_w = CELL * 4 + GAP * 5
total_h = CELL + LABEL_H + GAP * 2
canvas = Image.new("RGB", (total_w, total_h), (245, 247, 250))
d = ImageDraw.Draw(canvas)
font = ImageFont.truetype(r"C:/Windows/Fonts/msyh.ttc", 34)

for i, (im, name) in enumerate(zip(imgs, names)):
    x = GAP + i * (CELL + GAP)
    y_top = GAP
    r = rounded(im.resize((CELL, CELL), Image.LANCZOS), 72)
    canvas.paste(r, (x, y_top), r)
    bbox = d.textbbox((0, 0), name, font=font)
    tw = bbox[2] - bbox[0]
    d.text((x + (CELL - tw) // 2 - bbox[0], y_top + CELL + 14), name, font=font, fill=(60, 64, 70))

canvas.save(OUT, "PNG")
print("对比图:", OUT, canvas.size)
