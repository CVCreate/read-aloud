# -*- coding: utf-8 -*-
"""字号正常化：界面 chrome 从适老超大字降为正常大小；图标跟随协调；清语速 emoji。"""
import io, os

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
MP = os.path.join(BASE, 'miniprogram')


def sub(rel, pairs):
    p = os.path.join(MP, rel)
    s = io.open(p, encoding='utf-8').read()
    orig = s
    miss = []
    for old, new in pairs:
        if old not in s:
            miss.append(old.splitlines()[0][:60])
            continue
        s = s.replace(old, new)
    if s != orig:
        io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
    tag = 'OK  ' if not miss else 'PART'
    print(tag, rel, ('' if not miss else ' 未命中: ' + ' | '.join(miss)))


# ---------- app.wxss ----------
sub(os.path.join('app.wxss'), [
    ("  font-size: 34rpx;\n  line-height: 1.7;",
     "  font-size: 30rpx;\n  line-height: 1.7;"),
    (".btn {\n  min-height: 96rpx;", ".btn {\n  min-height: 88rpx;"),
    ("  border-radius: 24rpx;\n  background: var(--card);\n  font-size: 36rpx;",
     "  border-radius: 24rpx;\n  background: var(--card);\n  font-size: 30rpx;"),
    (".btn__icon {\n  width: 48rpx;\n  height: 48rpx;",
     ".btn__icon {\n  width: 44rpx;\n  height: 44rpx;"),
    ("  border: 3rpx solid var(--line);\n  font-size: 32rpx;\n  color: var(--ink);",
     "  border: 3rpx solid var(--line);\n  font-size: 28rpx;\n  color: var(--ink);"),
    (".empty {\n  padding: 120rpx 40rpx;\n  text-align: center;\n  color: var(--ink-2);\n  font-size: 34rpx;\n}",
     ".empty {\n  padding: 120rpx 40rpx;\n  text-align: center;\n  color: var(--ink-2);\n  font-size: 30rpx;\n}"),
    (".empty__icon {\n  width: 150rpx;\n  height: 150rpx;",
     ".empty__icon {\n  width: 120rpx;\n  height: 120rpx;"),
])

# ---------- index.wxss ----------
sub(os.path.join('pages', 'index', 'index.wxss'), [
    (".topbar__btn {\n  min-width: 150rpx;\n  height: 72rpx;",
     ".topbar__btn {\n  min-width: 132rpx;\n  height: 68rpx;"),
    ("  justify-content: center;\n  font-size: 30rpx;\n  font-weight: 700;",
     "  justify-content: center;\n  font-size: 28rpx;\n  font-weight: 700;"),
    (".topbar__ico { width: 40rpx; height: 40rpx; margin: 0 8rpx; flex: none; }",
     ".topbar__ico { width: 36rpx; height: 36rpx; margin: 0 8rpx; flex: none; }"),
    ("  overflow: hidden;\n  font-size: 34rpx;\n  font-weight: 800;",
     "  overflow: hidden;\n  font-size: 32rpx;\n  font-weight: 800;"),
    ("  color: #000;\n  font-size: 32rpx;\n  font-weight: 700;",
     "  color: #000;\n  font-size: 28rpx;\n  font-weight: 700;"),
    (".clip__t {\n  font-size: 40rpx;", ".clip__t {\n  font-size: 34rpx;"),
    ("  margin-top: 12rpx;\n  font-size: 30rpx;\n  color: var(--ink-2);\n  line-height: 1.6;",
     "  margin-top: 12rpx;\n  font-size: 28rpx;\n  color: var(--ink-2);\n  line-height: 1.6;"),
    (".ocrbox__t {\n  font-size: 34rpx;", ".ocrbox__t {\n  font-size: 30rpx;"),
    (".ocrbox__p {\n  margin-top: 12rpx;\n  font-size: 32rpx;",
     ".ocrbox__p {\n  margin-top: 12rpx;\n  font-size: 30rpx;"),
    (".ocrbox__btn {\n  flex: 1;\n  height: 96rpx;\n  font-size: 32rpx;\n}",
     ".ocrbox__btn {\n  flex: 1;\n  height: 88rpx;\n  font-size: 30rpx;\n}"),
    (".reader__empty-ico {\n  display: block;\n  width: 150rpx;\n  height: 150rpx;",
     ".reader__empty-ico {\n  display: block;\n  width: 120rpx;\n  height: 120rpx;"),
    (".reader__empty-t {\n  display: block;\n  font-size: 38rpx;",
     ".reader__empty-t {\n  display: block;\n  font-size: 30rpx;"),
    (".main__ico {\n  width: 104rpx;\n  height: 104rpx;\n}",
     ".main__ico {\n  width: 96rpx;\n  height: 96rpx;\n}"),
    (".main__t {\n  margin-top: 8rpx;\n  font-size: 42rpx;",
     ".main__t {\n  margin-top: 8rpx;\n  font-size: 36rpx;"),
    (".subbtn {\n  font-size: 32rpx;\n  min-height: 104rpx;\n}",
     ".subbtn {\n  font-size: 30rpx;\n  min-height: 88rpx;\n}"),
    (".entry {\n  font-size: 36rpx;\n  min-height: 112rpx;",
     ".entry {\n  font-size: 30rpx;\n  min-height: 100rpx;"),
    (".entry .btn__icon {\n  width: 64rpx;\n  height: 64rpx;",
     ".entry .btn__icon {\n  width: 56rpx;\n  height: 56rpx;"),
    (".speed__lab {\n  flex: none;\n  font-size: 32rpx;",
     ".speed__lab {\n  flex: none;\n  font-size: 28rpx;"),
    (".speedbtn {\n  font-size: 34rpx;\n  min-height: 96rpx;",
     ".speedbtn {\n  font-size: 30rpx;\n  min-height: 88rpx;"),
])

# ---------- history.wxss ----------
sub(os.path.join('pages', 'history', 'history.wxss'), [
    (".topbar__btn {\n  min-width: 150rpx;\n  height: 72rpx;",
     ".topbar__btn {\n  min-width: 132rpx;\n  height: 68rpx;"),
    ("  justify-content: center;\n  font-size: 30rpx;\n  font-weight: 700;",
     "  justify-content: center;\n  font-size: 28rpx;\n  font-weight: 700;"),
    (".topbar__ico { width: 40rpx; height: 40rpx; margin: 0 8rpx; flex: none; }",
     ".topbar__ico { width: 36rpx; height: 36rpx; margin: 0 8rpx; flex: none; }"),
    ("  overflow: hidden;\n  font-size: 34rpx;\n  font-weight: 800;",
     "  overflow: hidden;\n  font-size: 32rpx;\n  font-weight: 800;"),
    (".card__ico { width: 40rpx; height: 40rpx; margin-right: 10rpx; flex: none; }",
     ".card__ico { width: 36rpx; height: 36rpx; margin-right: 10rpx; flex: none; }"),
    (".card__del-ico { width: 44rpx; height: 44rpx; }",
     ".card__del-ico { width: 40rpx; height: 40rpx; }"),
    (".card__time {\n  font-size: 28rpx;", ".card__time {\n  font-size: 26rpx;"),
    (".card__text {\n  font-size: 38rpx;", ".card__text {\n  font-size: 30rpx;"),
    (".card__cta {\n  margin-top: 14rpx;\n  font-size: 30rpx;",
     ".card__cta {\n  margin-top: 14rpx;\n  font-size: 28rpx;"),
    ("  justify-content: center;\n  font-size: 44rpx;\n  border-left: 4rpx solid var(--line);",
     "  justify-content: center;\n  font-size: 36rpx;\n  border-left: 4rpx solid var(--line);"),
])

# ---------- settings.wxss ----------
sub(os.path.join('pages', 'settings', 'settings.wxss'), [
    (".topbar__btn {\n  min-width: 150rpx;\n  height: 72rpx;",
     ".topbar__btn {\n  min-width: 132rpx;\n  height: 68rpx;"),
    ("  justify-content: center;\n  font-size: 30rpx;\n  font-weight: 700;",
     "  justify-content: center;\n  font-size: 28rpx;\n  font-weight: 700;"),
    (".topbar__ico { width: 40rpx; height: 40rpx; margin: 0 8rpx; flex: none; }",
     ".topbar__ico { width: 36rpx; height: 36rpx; margin: 0 8rpx; flex: none; }"),
    ("  overflow: hidden;\n  font-size: 34rpx;\n  font-weight: 800;",
     "  overflow: hidden;\n  font-size: 32rpx;\n  font-weight: 800;"),
    (".grp__t {\n  font-size: 38rpx;", ".grp__t {\n  font-size: 32rpx;"),
    (".grp__ico { width: 44rpx; height: 44rpx; margin-right: 10rpx; flex: none; }",
     ".grp__ico { width: 40rpx; height: 40rpx; margin-right: 10rpx; flex: none; }"),
    (".grp__hint {\n  margin-top: 14rpx;\n  font-size: 28rpx;",
     ".grp__hint {\n  margin-top: 14rpx;\n  font-size: 26rpx;"),
    (".opt {\n  min-height: 104rpx;\n  font-size: 36rpx;\n}",
     ".opt {\n  min-height: 88rpx;\n  font-size: 30rpx;\n}"),
    (".voice {\n  min-height: 110rpx;", ".voice {\n  min-height: 100rpx;"),
    (".voice__l { font-size: 36rpx; font-weight: 800; }",
     ".voice__l { font-size: 30rpx; font-weight: 800; }"),
    (".voice__d { font-size: 26rpx; color: var(--ink-2); margin-top: 4rpx; }",
     ".voice__d { font-size: 24rpx; color: var(--ink-2); margin-top: 4rpx; }"),
    (".stat__k {\n  font-size: 32rpx;", ".stat__k {\n  font-size: 28rpx;"),
    ("  margin-left: auto;\n  font-size: 32rpx;\n  font-weight: 800;",
     "  margin-left: auto;\n  font-size: 28rpx;\n  font-weight: 800;"),
    (".info {\n  width: 100%;\n  min-height: 112rpx;\n  font-size: 36rpx;",
     ".info {\n  width: 100%;\n  min-height: 96rpx;\n  font-size: 30rpx;"),
    (".custom {\n  width: 100%;\n  min-height: 112rpx;\n  font-size: 36rpx;",
     ".custom {\n  width: 100%;\n  min-height: 96rpx;\n  font-size: 30rpx;"),
    (".danger {\n  width: 100%;\n  min-height: 112rpx;\n  font-size: 36rpx;",
     ".danger {\n  width: 100%;\n  min-height: 96rpx;\n  font-size: 30rpx;"),
])

# ---------- guide.wxss ----------
sub(os.path.join('pages', 'guide', 'guide.wxss'), [
    (".skip {\n  min-height: 80rpx;\n  padding: 0 36rpx;\n  font-size: 32rpx;",
     ".skip {\n  min-height: 72rpx;\n  padding: 0 36rpx;\n  font-size: 28rpx;"),
    (".card__icon {\n  width: 180rpx;\n  height: 180rpx;",
     ".card__icon {\n  width: 150rpx;\n  height: 150rpx;"),
    (".card__title {\n  font-size: 60rpx;", ".card__title {\n  font-size: 40rpx;"),
    (".card__line {\n  display: block;\n  font-size: 44rpx;",
     ".card__line {\n  display: block;\n  font-size: 30rpx;"),
    (".next {\n  width: 100%;\n  min-height: 128rpx;",
     ".next {\n  width: 100%;\n  min-height: 104rpx;"),
    ("  color: #FFFFFF;\n  font-size: 46rpx;\n  font-weight: 800;\n}",
     "  color: #FFFFFF;\n  font-size: 34rpx;\n  font-weight: 800;\n}"),
])

# ---------- 语速 emoji 清理 ----------
sub(os.path.join('config', 'index.js'), [
    ("    { key: 'slow', label: '慢', icon: '🐢', rate: 0.75, cloudSpeed: -1 },",
     "    { key: 'slow', label: '慢', rate: 0.75, cloudSpeed: -1 },"),
    ("    { key: 'normal', label: '中', icon: '🚶', rate: 1.0, cloudSpeed: 0 },",
     "    { key: 'normal', label: '中', rate: 1.0, cloudSpeed: 0 },"),
    ("    { key: 'fast', label: '快', icon: '🐇', rate: 1.25, cloudSpeed: 2 }",
     "    { key: 'fast', label: '快', rate: 1.25, cloudSpeed: 2 }"),
])
sub(os.path.join('pages', 'settings', 'settings.wxml'), [
    (">{{item.icon}}{{item.label}}</button>", ">{{item.label}}</button>"),
])

print('\n字号正常化完成')
