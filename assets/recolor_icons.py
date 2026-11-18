# -*- coding: utf-8 -*-
"""
图标着色：把单色（深黑）图标按项目色板重新着色，输出到分色子目录。

源图标是「黑色描边 + alpha 通道」，只替换 RGB、保留 alpha，
所以抗锯齿边缘不受影响，颜色精确等于 CSS 变量值。

用法：python recolor_icons.py
"""
import os
from PIL import Image

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = os.path.join(BASE, 'miniprogram', 'images', 'icons')
OUT = SRC

# 与 app.wxss 的 CSS 变量严格一致
COLORS = {
    'green': (0x1B, 0x8A, 0x2E),   # --go      播放控制 / 声音
    'blue':  (0x15, 0x65, 0xC0),   # --accent  输入来源 / 设置项 / 导航
    'red':   (0xD3, 0x2F, 0x2F),   # --stop    停止 / 删除
}

# 三色语义方案，25 个图标全覆盖，无遗漏
PLAN = {
    # 绿 = 会让东西「出声」或控制播放
    'green': ['speaker', 'play', 'pause', 'prev', 'next',
              'talk', 'studio', 'pulse', 'mic', 'speed'],
    # 蓝 = 内容从哪来、界面怎么调、页面间导航
    'blue':  ['paste', 'camera', 'image', 'doc', 'redo',
              'font', 'book', 'wave', 'history', 'back',
              'gear', 'lock', 'sun'],
    # 红 = 停下 / 删掉
    'red':   ['stop', 'trash'],
}


def recolor(src_path, dst_path, rgb):
    img = Image.open(src_path).convert('RGBA')
    data = img.getdata()
    out = []
    for r, g, b, a in data:
        out.append((rgb[0], rgb[1], rgb[2], a))
    img.putdata(out)
    img.save(dst_path, 'PNG', optimize=True)


def main():
    total = 0
    for color, names in PLAN.items():
        d = os.path.join(OUT, color)
        if not os.path.isdir(d):
            os.makedirs(d)
        for n in names:
            src = os.path.join(SRC, n + '.png')
            if not os.path.exists(src):
                print('  跳过（源不存在）:', n)
                continue
            recolor(src, os.path.join(d, n + '.png'), COLORS[color])
            total += 1
        print('%s: %d 个' % (color, len(names)))
    print('\n着色完成，共生成 %d 个彩色图标' % total)

    # 体积报告
    size = 0
    for root, _, files in os.walk(SRC):
        for f in files:
            if f.endswith('.png'):
                size += os.path.getsize(os.path.join(root, f))
    print('images/icons 总大小: %.0f KB' % (size / 1024.0))


if __name__ == '__main__':
    main()
