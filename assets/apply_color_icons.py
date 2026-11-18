# -*- coding: utf-8 -*-
"""批量替换：wxml 图标路径加色目录 + guide 页 emoji 转 image + wxss 尺寸阶梯。"""
import io, os, re

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PG = os.path.join(BASE, 'miniprogram', 'pages')

# 语义配色表：图标名 → 色目录（white/ 的引用保持不变）
COLOR_MAP = {
    # 绿：播放控制 / 声音
    'speaker': 'green', 'play': 'green', 'pause': 'green', 'prev': 'green',
    'next': 'green', 'talk': 'green', 'studio': 'green', 'pulse': 'green',
    'mic': 'green', 'speed': 'green',
    # 蓝：输入来源 / 设置项 / 导航
    'paste': 'blue', 'camera': 'blue', 'image': 'blue', 'doc': 'blue',
    'redo': 'blue', 'font': 'blue', 'book': 'blue', 'wave': 'blue',
    'history': 'blue', 'back': 'blue', 'gear': 'blue', 'lock': 'blue', 'sun': 'blue',
    # 红：停止 / 删除
    'stop': 'red', 'trash': 'red',
}


def sub_wxml(path):
    s = io.open(path, encoding='utf-8').read()
    def rep(m):
        name = m.group(1)
        color = COLOR_MAP.get(name)
        if not color:
            return m.group(0)
        return '/images/icons/%s/%s.png' % (color, name)
    s2 = re.sub(r'/images/icons/(?!white/)([a-z]+)\.png', rep, s)
    # 历史页动态来源图标：iconKey ∈ paste/camera/mic/doc，全部走 blue
    s2 = s2.replace('/images/icons/{{item.iconKey}}.png',
                    '/images/icons/blue/{{item.iconKey}}.png')
    if s2 != s:
        io.open(path, 'w', encoding='utf-8', newline='\n').write(s2)
        return True
    return False


def sub_file(path, pairs):
    s = io.open(path, encoding='utf-8').read()
    orig = s
    for old, new in pairs:
        if old not in s:
            print('  !! 未命中:', path.replace(BASE, ''), '->', old[:60])
        s = s.replace(old, new)
    if s != orig:
        io.open(path, 'w', encoding='utf-8', newline='\n').write(s)


changed = 0
for root, _, files in os.walk(PG):
    for f in files:
        if f.endswith('.wxml') and sub_wxml(os.path.join(root, f)):
            changed += 1
            print('wxml 替换:', os.path.relpath(os.path.join(root, f), BASE))
print('共 %d 个 wxml 更新\n' % changed)

# ---- guide 页：emoji → image ----
sub_file(os.path.join(PG, 'guide', 'guide.js'), [
    ("icon: '📋',", "icon: '/images/icons/blue/paste.png',"),
    ("icon: '🔊',", "icon: '/images/icons/green/speaker.png',"),
    ("icon: '📷',", "icon: '/images/icons/blue/camera.png',"),
])
sub_file(os.path.join(PG, 'guide', 'guide.wxml'), [
    ('<text class="card__icon">{{item.icon}}</text>',
     '<image class="card__icon" src="{{item.icon}}" mode="aspectFit" />'),
])
sub_file(os.path.join(PG, 'guide', 'guide.wxss'), [
    (""".card__icon {
  font-size: 180rpx;
  line-height: 1;
  display: block;
  margin-bottom: 40rpx;
}""",
     """.card__icon {
  width: 180rpx;
  height: 180rpx;
  display: block;
  margin: 0 auto 40rpx;
}"""),
])

# ---- 尺寸阶梯（rpx）----
sub_file(os.path.join(BASE, 'miniprogram', 'app.wxss'), [
    # 按钮内图标 44 → 48（按钮文字 36rpx，图标略大更醒目）
    (""".btn__icon {
  width: 44rpx;
  height: 44rpx;
  margin-right: 14rpx;
  flex: none;
}""",
     """.btn__icon {
  width: 48rpx;
  height: 48rpx;
  margin-right: 14rpx;
  flex: none;
}"""),
    # 空状态 140 → 150（与首页空状态统一）
    (""".empty__icon {
  width: 140rpx;
  height: 140rpx;
  display: block;
  margin: 0 auto 24rpx;
}""",
     """.empty__icon {
  width: 150rpx;
  height: 150rpx;
  display: block;
  margin: 0 auto 24rpx;
}"""),
])

for page in ['index', 'history', 'settings']:
    sub_file(os.path.join(PG, page, page + '.wxss'), [
        # 顶栏图标 36 → 40
        ('.topbar__ico { width: 36rpx; height: 36rpx; margin: 0 8rpx; flex: none; }',
         '.topbar__ico { width: 40rpx; height: 40rpx; margin: 0 8rpx; flex: none; }'),
    ])

sub_file(os.path.join(PG, 'index', 'index.wxss'), [
    # 主按钮图标 96 → 104（240rpx 圆内占 43%）
    (""".main__ico {
  width: 96rpx;
  height: 96rpx;
}""",
     """.main__ico {
  width: 104rpx;
  height: 104rpx;
}"""),
    # 入口按钮图标 52 → 64（图标是入口按钮的主角）
    (""".entry .btn__icon {
  width: 52rpx;
  height: 52rpx;
  margin: 0 0 4rpx;
}""",
     """.entry .btn__icon {
  width: 64rpx;
  height: 64rpx;
  margin: 0 0 6rpx;
}"""),
])

sub_file(os.path.join(PG, 'history', 'history.wxss'), [
    ('.card__ico { width: 36rpx; height: 36rpx; margin-right: 10rpx; flex: none; }',
     '.card__ico { width: 40rpx; height: 40rpx; margin-right: 10rpx; flex: none; }'),
    ('.card__del-ico { width: 40rpx; height: 40rpx; }',
     '.card__del-ico { width: 44rpx; height: 44rpx; }'),
])

sub_file(os.path.join(PG, 'settings', 'settings.wxss'), [
    ('.grp__ico { width: 40rpx; height: 40rpx; margin-right: 10rpx; flex: none; }',
     '.grp__ico { width: 44rpx; height: 44rpx; margin-right: 10rpx; flex: none; }'),
])

print('\n全部替换完成')
