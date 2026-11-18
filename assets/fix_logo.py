# -*- coding: utf-8 -*-
# 裁掉边缘水印：主体居中，中心裁剪 1.30 倍即可去水印且不伤图形
from PIL import Image

import os
BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

SRC = BASE + "/assets/现代扁平风格的移动应用图标_正方形_青绿色到蓝绿色的对角平滑_2026-10-12T07-45-27.png"
OUT = BASE + "/assets/logo.png"

img = Image.open(SRC).convert("RGB")
w, h = img.size
print("原图尺寸:", w, h)

# 中心裁剪：保留中间 1/1.3 ≈ 77% 区域（每边裁约 11.5%）
scale = 1.30
side = int(min(w, h) / scale)
left = (w - side) // 2
top = (h - side) // 2
img2 = img.crop((left, top, left + side, top + side))
img2 = img2.resize((1024, 1024), Image.LANCZOS)
img2.save(OUT, "PNG")
print("已输出:", OUT, img2.size)
