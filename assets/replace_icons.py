# -*- coding: utf-8 -*-
"""把 wxml 里的 emoji 图标批量替换为 image 标签，同步改 history.js 的来源图标映射。"""
import io
import os

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'miniprogram'))


def sub(path, pairs):
    p = os.path.join(BASE, path)
    s = io.open(p, encoding="utf-8").read()
    for old, new in pairs:
        if old not in s:
            print("!! 未命中 [%s]: %s" % (path, old[:50]))
            continue
        s = s.replace(old, new)
    io.open(p, "w", encoding="utf-8", newline="\n").write(s)
    print("OK", path)


I = "/images/icons/"
W = "/images/icons/white/"

# ---------- index.wxml ----------
sub("pages/index/index.wxml", [
    ('<text class="topbar__ico">🕘</text>', '<image class="topbar__ico" src="' + I + 'history.png" />'),
    ('设置<text class="topbar__ico">⚙️</text>', '设置<image class="topbar__ico" src="' + I + 'gear.png" />'),
    # 绿底按钮 → 白色图标
    ('<button class="btn btn--go clip__btn" bindtap="onClipRead"><text class="btn__icon">🔊</text>念</button>',
     '<button class="btn btn--go clip__btn" bindtap="onClipRead"><image class="btn__icon" src="' + W + 'speaker.png" />念</button>'),
    ('<text class="btn__icon">🔁</text>', '<image class="btn__icon" src="' + I + 'redo.png" />'),
    ('<text class="btn__icon">🖼</text>', '<image class="btn__icon" src="' + I + 'image.png" />'),
    ('<text class="reader__empty-ico">📝</text>', '<image class="reader__empty-ico" src="' + I + 'doc.png" />'),
    # 大圆按钮：红/绿底 → 白色，动态切换
    ("<text class=\"main__ico\">{{status === 'playing' || status === 'loading' ? '⏹' : '🔊'}}</text>",
     "<image class=\"main__ico\" src=\"{{status === 'playing' || status === 'loading' ? '" + W + "stop.png' : '" + W + "speaker.png'}}\" />"),
    ('<text class="btn__icon">⏮</text>', '<image class="btn__icon" src="' + I + 'prev.png" />'),
    ("<text class=\"btn__icon\">{{status === 'paused' ? '▶️' : '⏸'}}</text>",
     "<image class=\"btn__icon\" src=\"{{status === 'paused' ? '" + I + "play.png' : '" + I + "pause.png'}}\" />"),
    ('<text class="btn__icon">⏭</text>', '<image class="btn__icon" src="' + I + 'next.png" />'),
    ('<text class="btn__icon">📋</text>', '<image class="btn__icon" src="' + I + 'paste.png" />'),
    ('<text class="btn__icon">📷</text>', '<image class="btn__icon" src="' + I + 'camera.png" />'),
    ('<text class="btn__icon">🎤</text>', '<image class="btn__icon" src="' + I + 'mic.png" />'),
])

# ---------- history.wxml ----------
sub("pages/history/history.wxml", [
    ('<text class="topbar__ico">⬅️</text>', '<image class="topbar__ico" src="' + I + 'back.png" />'),
    ('<text class="empty__icon">🕘</text>', '<image class="empty__icon" src="' + I + 'history.png" />'),
    # 来源小图标改用 iconKey（history.js 已同步）
    ('<text class="card__ico">{{item.icon}}</text>', '<image class="card__ico" src="' + I + '{{item.iconKey}}.png" />'),
    ('<view class="card__cta"><text class="btn__icon">🔊</text>再念一遍</view>',
     '<view class="card__cta"><image class="btn__icon" src="' + I + 'speaker.png" />再念一遍</view>'),
    # 删除按钮整个是 emoji，改成图标
    ('<button class="card__del" data-id="{{item.id}}" bindtap="onRemove">🗑</button>',
     '<button class="card__del" data-id="{{item.id}}" bindtap="onRemove"><image class="card__del-ico" src="' + I + 'trash.png" /></button>'),
])

# ---------- settings.wxml ----------
sub("pages/settings/settings.wxml", [
    ('<text class="topbar__ico">⬅️</text>', '<image class="topbar__ico" src="' + I + 'back.png" />'),
    ('<text class="grp__ico">🐢</text>', '<image class="grp__ico" src="' + I + 'speed.png" />'),
    ('<text class="grp__ico">🔠</text>', '<image class="grp__ico" src="' + I + 'font.png" />'),
    ('<text class="grp__ico">💡</text>', '<image class="grp__ico" src="' + I + 'sun.png" />'),
    ('<text class="grp__ico">📋</text>', '<image class="grp__ico" src="' + I + 'paste.png" />'),
    ('<text class="grp__ico">📳</text>', '<image class="grp__ico" src="' + I + 'wave.png" />'),
    ('<text class="grp__ico">🗣</text>', '<image class="grp__ico" src="' + I + 'talk.png" />'),
    ('<text class="grp__ico">🩺</text>', '<image class="grp__ico" src="' + I + 'pulse.png" />'),
    ('<text class="btn__icon">🎙</text>', '<image class="btn__icon" src="' + I + 'studio.png" />'),
    ('<text class="btn__icon">📖</text>', '<image class="btn__icon" src="' + I + 'book.png" />'),
    ('<text class="btn__icon">🔒</text>', '<image class="btn__icon" src="' + I + 'lock.png" />'),
    ('<text class="btn__icon">🗑</text>', '<image class="btn__icon" src="' + I + 'trash.png" />'),
])

# ---------- history.js：来源 emoji → 图标文件名 ----------
sub("pages/history/history.js", [
    ("""const SOURCE_ICON = {
  paste: '📋',
  ocr: '📷',
  asr: '🎤',
  manual: '✍️'
}""",
     """const SOURCE_ICON = {
  paste: 'paste',
  ocr: 'camera',
  asr: 'mic',
  manual: 'doc'
}"""),
    ("iconMap: SOURCE_ICON,\n    statusBarHeight: 20", "statusBarHeight: 20"),
    ("icon: SOURCE_ICON[item.source] || '✍️',", "iconKey: SOURCE_ICON[item.source] || 'doc',"),
])

print("\n全部完成")
