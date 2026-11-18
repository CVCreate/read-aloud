# -*- coding: utf-8 -*-
# 生成 red/close.png（取消用 X 图标），与现有图标同规格：96×96、主色 #D12D2D、圆头笔画
from PIL import Image, ImageDraw, ImageFilter

import os
BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

S = 96
RED = (209, 45, 45, 255)
W = 12          # 笔画宽
PAD = 20        # 与归一化脚本的 76% 画布占比一致

im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
# 先画粗 X，再用「模糊+阈值」把两端变成圆头（与 logo 圆角化同一招）
d = ImageDraw.Draw(im)
d.line([(PAD, PAD), (S - PAD, S - PAD)], fill=RED, width=W)
d.line([(S - PAD, PAD), (PAD, S - PAD)], fill=RED, width=W)
im = im.filter(ImageFilter.GaussianBlur(6))
# 阈值化恢复锐利边缘但端点圆润
px = im.load()
out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
po = out.load()
for y in range(S):
    for x in range(S):
        r, g, b, a = px[x, y]
        if a > 140:
            po[x, y] = RED
out.save(BASE + '/miniprogram/images/icons/red/close.png')
print('close.png 已生成')
