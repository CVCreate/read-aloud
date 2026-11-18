# -*- coding: utf-8 -*-
"""把 AI 生成的 5x5 图标表切成独立 PNG，处理成透明底单色，输出深/白两套。"""
import os
from PIL import Image, ImageFilter

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

SRC = BASE + "/assets/图标素材表_纯白背景_严格对齐的_5_行___5_列正方形网_2026-10-12T07-59-32.png"
OUT_DARK = BASE + "/miniprogram/images/icons"
OUT_WHITE = BASE + "/miniprogram/images/icons/white"

# 网格顺序（行优先）→ 文件名
NAMES = [
    "history", "speaker", "gear", "redo", "image",
    "doc", "stop", "prev", "play", "pause",
    "next", "paste", "camera", "mic", "speed",
    "font", "sun", "wave", "talk", "studio",
    "pulse", "book", "lock", "trash", "back",
]

DARK = (26, 26, 26)      # #1A1A1A 与全局 --ink 一致
WHITE = (255, 255, 255)
SIZE = 128               # 输出尺寸

os.makedirs(OUT_DARK, exist_ok=True)
os.makedirs(OUT_WHITE, exist_ok=True)

img = Image.open(SRC).convert("RGB")
w, h = img.size
cell = w / 5.0
print("源图:", w, h, "每格:", round(cell, 1))

def process(tile):
    """白底黑线 → 透明底单色：alpha = 255 - 亮度，色值统一。"""
    g = tile.convert("L")
    px = g.load()
    out = Image.new("RGBA", tile.size)
    op = out.load()
    for y in range(tile.size[1]):
        for x in range(tile.size[0]):
            a = 255 - px[x, y]           # 越黑越不透明
            a = max(0, min(255, int(a * 1.15)))  # 稍微提一点实心度
            op[x, y] = (0, 0, 0, a)
    return out

def trim_alpha(im, pad_ratio=0.10):
    bbox = im.getbbox()
    if not bbox:
        return im
    im = im.crop(bbox)
    # 等比放大到目标尺寸的 80%，再居中（四周留 10% 呼吸）
    target = int(SIZE * (1 - pad_ratio * 2))
    s = min(target / im.width, target / im.height)
    nw, nh = max(1, int(im.width * s)), max(1, int(im.height * s))
    im = im.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(im, ((SIZE - nw) // 2, (SIZE - nh) // 2), im)
    return canvas

made = []
for idx, name in enumerate(NAMES):
    row, col = divmod(idx, 5)
    # 每格向内收 8%，裁掉格与格之间的间隙和水印
    x0 = int(col * cell + cell * 0.08)
    y0 = int(row * cell + cell * 0.08)
    x1 = int((col + 1) * cell - cell * 0.08)
    y1 = int((row + 1) * cell - cell * 0.08)
    tile = img.crop((x0, y0, x1, y1))
    tile = tile.filter(ImageFilter.MedianFilter(3))  # 去掉轻噪点

    mono = process(tile)
    dark = trim_alpha(mono)
    # 深色版：重新着色为 --ink
    dark_rgb = Image.new("RGBA", dark.size)
    dp = dark.load(); rp = dark_rgb.load()
    for y in range(dark.size[1]):
        for x in range(dark.size[0]):
            r, g, b, a = dp[x, y]
            rp[x, y] = (DARK[0], DARK[1], DARK[2], a)
    dark_rgb.save(os.path.join(OUT_DARK, name + ".png"))

    # 白色版
    white = Image.new("RGBA", dark.size)
    wp = white.load()
    for y in range(dark.size[1]):
        for x in range(dark.size[0]):
            r, g, b, a = dp[x, y]
            wp[x, y] = (255, 255, 255, a)
    white.save(os.path.join(OUT_WHITE, name + ".png"))

    made.append(name)

print("已生成 %d 组（深+白）" % len(made))
print(" ".join(made))
