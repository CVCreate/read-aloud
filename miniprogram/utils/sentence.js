/**
 * 自然断句引擎
 * ---------------------------------------------------------------
 * 目标：把任意一段文字切成「念起来顺气」的小段。
 * 两条铁律：
 *   1. 只切分，不丢字（所有片段拼回去 === 净化后的原文）
 *   2. 绝不把数字/英文单词切成两半
 * ---------------------------------------------------------------
 */
const CONFIG = require('../config/index.js')

const CN_NUM = {
  '0': '零', '1': '一', '2': '二', '3': '三', '4': '四',
  '5': '五', '6': '六', '7': '七', '8': '八', '9': '九'
}

// 句末标点（硬断点）—— 念到这里可以换气
const HARD = '。！？!?；;'
// 句中标点（软断点）—— 句子太长时才在这里切
const SOFT = '，,、：:；;—–~～'
// 闭合符号：紧跟在句末标点后面时，要一起带走
const CLOSERS = '"\'’”」》〉】）)］]｝}〉」』】'
// 开合符号：成对噪音，直接剔除
const NOISE = /[*#^_|\\<>【】\[\]{}]/g

/**
 * 第 0 步：归一化
 * - 各种换行统一成 \n
 * - 连续空白折叠为单个空格
 * - 去掉 emoji、零宽字符、控制字符
 */
function normalize(text) {
  let s = String(text == null ? '' : text)
  if (!s) return ''

  // 去掉 emoji 与零宽/控制字符（TTS 遇到这些会念出乱码）
  s = s.replace(/[\u{1F000}-\u{1FAFF}]/gu, '')
  s = s.replace(/[\u{2600}-\u{27BF}]/gu, '')
  s = s.replace(/[\u200B-\u200F\uFEFF\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')

  // 换行统一
  s = s.replace(/\r\n?/g, '\n')
  // 连续空白（不含换行）折叠成一个空格
  s = s.replace(/[ \t\f\v]+/g, ' ')
  // 连续空行折叠
  s = s.replace(/\n{2,}/g, '\n')

  return s.trim()
}

/**
 * 第 1 步：符号净化
 * - 剔除噪音符号
 * - 省略号 → 逗号
 * - 连续重复的句末标点合并成一个
 */
function sanitize(s) {
  if (!s) return ''
  let out = s

  out = out.replace(NOISE, '')            // 剔除成对噪音
  out = out.replace(/…+/g, '，')          // 中文省略号
  out = out.replace(/\.{3,}/g, '，')      // 英文省略号 ...
  out = out.replace(/。{2,}/g, '。')      // 。。。→ 。
  out = out.replace(/！{2,}/g, '！')
  out = out.replace(/？{2,}/g, '？')
  out = out.replace(/！？+/g, '！')
  out = out.replace(/？！+/g, '？')
  out = out.replace(/，{2,}/g, '，')      // ，，→ ，

  return out
}

/**
 * 第 2 步：数字保护
 * 纯数字串 ≥ 7 位（手机号 / 身份证 / 快递单号 / 银行卡号）
 * → 逐位转中文数字并用空格分隔，TTS 会一位一位念清楚。
 * 含小数点或前后紧贴数字/点的（金额 128.50、温度 36.5）保持原样，交给 TTS。
 */
function protectNumbers(s) {
  if (!s) return ''
  // 不用 lookbehind：老版本 iOS 的 JS 引擎不支持，会导致整段代码报错
  return s.replace(/\d{7,}/g, function (m, offset, str) {
    const before = offset > 0 ? str.charAt(offset - 1) : ''
    const after = str.charAt(offset + m.length)
    if (before && /[\d.]/.test(before)) return m
    if (after && /[\d.]/.test(after)) return m
    return m.split('').map(function (d) { return CN_NUM[d] || d }).join(' ')
  })
}

/** 判断是否硬断点 */
function isHard(ch) {
  return HARD.indexOf(ch) >= 0
}
/** 判断是否软断点 */
function isSoft(ch) {
  return SOFT.indexOf(ch) >= 0
}
/** 判断是否闭合符号（要粘在上一句末尾） */
function isCloser(ch) {
  return CLOSERS.indexOf(ch) >= 0
}
/** 判断该字符是否属于「不可切分」的数字/英文序列内部 */
function isWordChar(ch) {
  return /[0-9A-Za-z]/.test(ch)
}

/**
 * 第 3 步：按断点扫描切分
 * @param {string} s 已净化文本
 * @param {function} isBreak 断点判定函数
 * @returns {string[]}
 */
function scanSplit(s, isBreak) {
  const out = []
  let buf = ''

  for (let i = 0; i < s.length; i++) {
    const ch = s.charAt(i)

    // 换行单独处理：既是断点，也不保留在句内
    if (ch === '\n') {
      if (buf.trim()) out.push(buf.trim())
      buf = ''
      continue
    }

    buf += ch

    if (isBreak(ch)) {
      // 断点后紧跟的闭合符号一起带走，避免出现 「你好」 + 「」 这种空句
      let j = i + 1
      while (j < s.length && isCloser(s.charAt(j))) {
        buf += s.charAt(j)
        j++
      }
      i = j - 1
      if (buf.trim()) out.push(buf.trim())
      buf = ''
    }
  }

  if (buf.trim()) out.push(buf.trim())
  return out
}

/**
 * 第 5 步：硬切兜底
 * 只在「整段没有任何标点」时启用。尽量在空格处切，绝不劈开英文单词/数字。
 */
function hardSplit(s, max) {
  const out = []
  let rest = s

  while (rest.length > max) {
    let cut = max
    // 若切点落在单词/数字中间，往回找最近的空格
    if (isWordChar(rest.charAt(cut - 1)) && isWordChar(rest.charAt(cut))) {
      const sp = rest.lastIndexOf(' ', cut)
      if (sp > max * 0.5) cut = sp + 1
    }
    out.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut)
  }
  if (rest.trim()) out.push(rest.trim())
  return out
}

/**
 * 主入口：把文本切成朗读片段
 * @param {string} text 原文
 * @returns {string[]} 片段数组（长度 ≥ 1；空输入返回 []）
 */
function split(text) {
  let s = normalize(text)
  if (!s) return []

  s = protectNumbers(s)   // 数字先保护，后面切分才不会误伤
  s = sanitize(s)
  if (!s) return []

  // —— 主切分：句末标点 / 换行
  let parts = scanSplit(s, isHard)

  // —— 长句再切：按逗号等软断点
  const fine = []
  parts.forEach(function (p) {
    if (p.length > CONFIG.softSentenceLen) {
      scanSplit(p, isSoft).forEach(function (q) {
        fine.push(q)
      })
    } else {
      fine.push(p)
    }
  })

  // —— 硬切兜底：仍然过长的（大段无标点文字）
  const final = []
  fine.forEach(function (p) {
    if (p.length > CONFIG.maxSentenceLen) {
      hardSplit(p, CONFIG.maxSentenceLen).forEach(function (q) {
        final.push(q)
      })
    } else {
      final.push(p)
    }
  })

  // —— 清洗：去空、去纯符号句
  return final
    .map(function (p) { return p.trim() })
    .filter(function (p) {
      if (!p) return false
      // 纯标点没有朗读价值
      return /[^，。！？、：；,.!?;:\s'"]/.test(p)
    })
}

/** 摘要：历史列表用 */
function preview(text, n) {
  const t = normalize(text).replace(/\n/g, ' ')
  const len = n || 40
  return t.length > len ? t.slice(0, len) + '…' : t
}

module.exports = {
  split: split,
  normalize: normalize,
  preview: preview
}
