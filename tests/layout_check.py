# -*- coding: utf-8 -*-
"""
布局 / 结构静态体检
------------------------------------------------------------
只做静态检查，不依赖开发者工具，用来在编译前抓出这些坑：
  1. JS 语法错误
  2. wxml 标签未闭合 / 嵌套错乱
  3. wxml 里引用的图片不存在
  4. wxml 里用了 class，但 wxss 里没定义（样式写了不生效）
  5. wxml 绑定了事件，但页面 js 里没有对应方法
  6. wxml 用了 {{变量}}，但 js 的 data / setData 里找不到来源
  7. app.json 注册的页面文件是否齐全
用法：python tests/layout_check.py
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MP = os.path.join(ROOT, 'miniprogram')

# wxml 里不需要闭合的空元素
VOID_TAGS = {'image', 'input', 'br', 'icon', 'import', 'include', 'wxs', 'slot'}

problems = []   # 确定的问题
warnings = []   # 提醒，不一定是错


def rel(p):
    return os.path.relpath(p, ROOT).replace('\\', '/')


def read(p):
    try:
        return open(p, encoding='utf-8').read()
    except Exception as e:
        problems.append('读文件失败 %s：%s' % (rel(p), e))
        return ''


# ---------- 1. JS 语法 ----------
def check_js():
    errs = []
    for r, d, fs in os.walk(MP):
        for f in fs:
            if not f.endswith('.js'):
                continue
            p = os.path.join(r, f)
            code = os.system('node --check "%s" >nul 2>nul' % p)
            if code != 0:
                errs.append(rel(p))
    if errs:
        for e in errs:
            problems.append('JS 语法错误：%s' % e)


# ---------- 2. wxml 标签配对 ----------
def check_tags():
    for r, d, fs in os.walk(MP):
        for f in fs:
            if not f.endswith('.wxml'):
                continue
            p = os.path.join(r, f)
            s = read(p)
            stack = []
            for m in re.finditer(r'<(/?)([a-zA-Z][\w-]*)([^>]*?)(/?)>', s):
                close, tag, attrs, self_close = m.groups()
                if close:
                    if not stack:
                        problems.append('%s：多余的 </%s>' % (rel(p), tag))
                    elif stack[-1] != tag:
                        problems.append('%s：</%s> 与 <%s> 不匹配' % (rel(p), tag, stack[-1]))
                        if tag in stack:
                            while stack and stack.pop() != tag:
                                pass
                    else:
                        stack.pop()
                    continue
                if self_close or tag in VOID_TAGS:
                    continue
                stack.append(tag)
            if stack:
                problems.append('%s：标签未闭合 %s' % (rel(p), stack))


# ---------- 收集全局样式里定义的 class 与变量 ----------
def collect_css():
    classes = set()
    variables = set()
    for r, d, fs in os.walk(MP):
        for f in fs:
            if not f.endswith('.wxss'):
                continue
            s = read(os.path.join(r, f))
            for m in re.finditer(r'\.([A-Za-z][\w-]*)', s):
                classes.add(m.group(1))
            for m in re.finditer(r'(--[\w-]+)\s*:', s):
                variables.add(m.group(1))
    return classes, variables


# ---------- 3/4/5/6. wxml 内部检查 ----------
def check_wxml(global_classes, css_vars):
    for r, d, fs in os.walk(MP):
        for f in fs:
            if not f.endswith('.wxml'):
                continue
            p = os.path.join(r, f)
            page_dir = os.path.dirname(p)
            js_path = os.path.join(page_dir, f.replace('.wxml', '.js'))
            s = read(p)
            js = read(js_path) if os.path.exists(js_path) else ''

            # --- 图片引用是否存在 ---
            for m in re.finditer(r'src="(/[^"{}]+)"', s):
                img = m.group(1)
                if not os.path.exists(os.path.join(MP, img.lstrip('/'))):
                    problems.append('%s：图片不存在 %s' % (rel(p), img))

            # --- class 是否有样式定义 ---
            local_css = read(os.path.join(page_dir, f.replace('.wxml', '.wxss')))
            defined = set(global_classes)
            for m in re.finditer(r'\.([A-Za-z][\w-]*)', local_css):
                defined.add(m.group(1))
            for m in re.finditer(r'class="([^"{}]*)"', s):
                for c in m.group(1).split():
                    if c and c not in defined:
                        warnings.append('%s：class「%s」没有对应样式' % (rel(p), c))

            # --- 事件方法是否存在 ---
            for m in re.finditer(r'\b(?:bind|catch|capture-bind|capture-catch):?([a-zA-Z]+)="([A-Za-z_][\w]*)"', s):
                handler = m.group(2)
                if not re.search(r'\b' + re.escape(handler) + r'\s*[(:]', js):
                    problems.append('%s：事件 %s 在 js 里没有定义' % (rel(p), handler))

            # --- {{变量}} 是否有来源 ---
            data_fields = set()
            for m in re.finditer(r'data:\s*\{', js):
                pass
            # data 里的字段
            for m in re.finditer(r'^\s{4,}([A-Za-z_]\w*)\s*:', js, re.M):
                data_fields.add(m.group(1))
            # setData 里的字段
            for m in re.finditer(r'setData\(\{\s*([^}]*)\}', js):
                for mm in re.finditer(r'([A-Za-z_]\w*)\s*:', m.group(1)):
                    data_fields.add(mm.group(1))
            for m in re.finditer(r'\{\{([^}]+)\}\}', s):
                expr = m.group(1)
                for mm in re.finditer(r'\b([A-Za-z_]\w*)\b', expr):
                    name = mm.group(1)
                    if name in ('true', 'false', 'null', 'undefined', 'item', 'index', 'length',
                                'String', 'Number', 'Boolean', 'Array', 'Object', 'JSON', 'Math'):
                        continue
                    if name in data_fields:
                        continue
                    # 模板里 wx:for 定义的局部变量
                    if re.search(r'wx:for-item="%s"|wx:for-index="%s"' % (name, name), s):
                        continue
                    warnings.append('%s：模板变量「%s」在 js 里没找到来源' % (rel(p), name))


# ---------- 7. app.json 页面文件齐全 ----------
def check_pages():
    import json
    app_json = os.path.join(MP, 'app.json')
    try:
        cfg = json.load(open(app_json, encoding='utf-8'))
    except Exception as e:
        problems.append('app.json 解析失败：%s' % e)
        return
    for pg in cfg.get('pages', []):
        for ext in ('.js', '.wxml'):
            f = os.path.join(MP, pg + ext)
            if not os.path.exists(f):
                problems.append('app.json 注册了页面 %s，但缺少 %s' % (pg, ext))


def main():
    check_js()
    check_tags()
    classes, css_vars = collect_css()
    check_wxml(classes, css_vars)
    check_pages()

    print('=' * 60)
    print('布局 / 结构静态体检')
    print('=' * 60)

    if not problems and not warnings:
        print('全部通过，没有发现问题。')
        return 0

    if problems:
        print('\n【必须修的问题】 %d 条' % len(problems))
        for p in problems:
            print('  x ' + p)
    else:
        print('\n【必须修的问题】 无')

    if warnings:
        print('\n【提醒】 %d 条' % len(warnings))
        for w in warnings:
            print('  ! ' + w)

    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
