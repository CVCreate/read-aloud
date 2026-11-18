// 本地存储：设置 + 历史。纯端上，不上传任何数据。
const CONFIG = require('../config/index.js')

const KEY_SETTINGS = 'ra_settings'
const KEY_HISTORY = 'ra_history'

/**
 * 设置结构版本号。
 * 以后再改任何默认值：这里 +1，并在 migrate() 里补一条一次性迁移，
 * 否则老用户本地存着的旧值不会变，会误以为「改了没生效」。
 */
const SETTINGS_VER = 2

const DEFAULT_SETTINGS = {
  ver: SETTINGS_VER,
  speed: 'normal',    // 默认「中速」（2026-10-13：由慢速改为此值）
  fontSize: 'lg',     // 默认「大」
  keepScreenOn: true, // 朗读时不息屏
  autoReadClipboard: true, // 进入时自动识别剪贴板
  voiceType: 1002,    // 云端音色
  ttsEngine: 'cloud', // 默认走云函数，不依赖插件
  // 真机上「点一下抖一下」让人反感 → 默认关。
  // 已有语音回执 + 按钮变色作为反馈，震动不是必需通道
  haptic: false
}

/**
 * 一次性迁移旧版本存下来的设置。
 * ver 1 → 2：旧版默认语速是「慢」，这里统一改成新的默认值「中速」。
 *   老人基本不会自己去调语速，本地存着的大概率就是旧的默认值，重置是安全的；
 *   且迁移只在版本号落后时执行一次，之后用户自己改过的值不会再被覆盖。
 */
function migrate(saved) {
  const from = Number(saved.ver || 1)
  if (from < 2) {
    saved.ver = 2
    saved.speed = 'normal'
  }
  return saved
}

/** 读取设置，字段缺失自动补齐 */
function loadSettings() {
  let saved = {}
  try {
    saved = wx.getStorageSync(KEY_SETTINGS) || {}
  } catch (e) {
    saved = {}
  }
  if (Object.keys(saved).length) {
    saved = migrate(saved)
    try {
      wx.setStorageSync(KEY_SETTINGS, saved)
    } catch (e) {}
  }
  const out = Object.assign({}, DEFAULT_SETTINGS)
  Object.keys(DEFAULT_SETTINGS).forEach(function (k) {
    if (saved[k] !== undefined && saved[k] !== null) out[k] = saved[k]
  })
  return out
}

/** 增量保存设置 */
function saveSettings(patch) {
  const current = loadSettings()
  const next = Object.assign({}, current, patch || {})
  try {
    wx.setStorageSync(KEY_SETTINGS, next)
  } catch (e) {}
  return next
}

/** 读取历史（新的在前） */
function loadHistory() {
  try {
    return wx.getStorageSync(KEY_HISTORY) || []
  } catch (e) {
    return []
  }
}

/**
 * 写入一条历史。相同文本只保留最新一条。
 * @param {string} text 原文
 * @param {string} source paste | ocr | asr | manual
 */
function pushHistory(text, source) {
  const t = String(text || '').trim()
  if (!t) return loadHistory()

  let list = loadHistory()
  // 去重：同文本提到最前
  list = list.filter(function (item) { return item.text !== t })
  list.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text: t,
    source: source || 'manual',
    time: Date.now()
  })
  if (list.length > CONFIG.historyLimit) {
    list = list.slice(0, CONFIG.historyLimit)
  }
  try {
    wx.setStorageSync(KEY_HISTORY, list)
  } catch (e) {}
  return list
}

/** 删除一条历史 */
function removeHistory(id) {
  const list = loadHistory().filter(function (item) { return item.id !== id })
  try {
    wx.setStorageSync(KEY_HISTORY, list)
  } catch (e) {}
  return list
}

/** 清空历史 */
function clearHistory() {
  try {
    wx.setStorageSync(KEY_HISTORY, [])
  } catch (e) {}
  return []
}

/* ============ 首次使用引导标记 ============ */

const KEY_ONBOARDED = 'ra_onboarded'

function isOnboarded() {
  try {
    return !!wx.getStorageSync(KEY_ONBOARDED)
  } catch (e) {
    return false
  }
}

function setOnboarded() {
  try {
    wx.setStorageSync(KEY_ONBOARDED, true)
  } catch (e) {}
}

function clearOnboarded() {
  try {
    wx.removeStorageSync(KEY_ONBOARDED)
  } catch (e) {}
}

module.exports = {
  DEFAULT_SETTINGS: DEFAULT_SETTINGS,
  loadSettings: loadSettings,
  saveSettings: saveSettings,
  loadHistory: loadHistory,
  pushHistory: pushHistory,
  removeHistory: removeHistory,
  clearHistory: clearHistory,
  isOnboarded: isOnboarded,
  setOnboarded: setOnboarded,
  clearOnboarded: clearOnboarded
}
