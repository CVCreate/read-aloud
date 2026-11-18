// 通用小工具
const CONFIG = require('../config/index.js')

/** 把字号档位 key 转成 rpx 数值，非法输入回退到「大」 */
function normalizeFontScale(key) {
  const hit = CONFIG.fontLevels.filter(function (item) { return item.key === key })[0]
  return hit ? hit.value : 60
}

/** 生成简易唯一 id */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/** 时间戳 → YYYY-MM-DD HH:mm */
function formatTime(ts) {
  const d = new Date(ts)
  const p = function (n) { return n < 10 ? '0' + n : '' + n }
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
    ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
}

/**
 * 人话错误提示：老人看不懂「request:fail」
 * @param {string} raw 原始错误信息
 */
function humanError(raw) {
  const s = String(raw || '')
  if (s.indexOf('fail file not found') >= 0 || s.indexOf('network') >= 0 || s.indexOf('timeout') >= 0) {
    return '网络不太好，请检查一下，稍后再试'
  }
  if (s.indexOf('privacy') >= 0) {
    return '需要先同意隐私保护指引才能用这个功能'
  }
  if (s.indexOf('auth deny') >= 0 || s.indexOf('authorize') >= 0) {
    return '您还没有允许这个权限，请在弹窗里点「允许」'
  }
  if (s.indexOf('cancel') >= 0) {
    return '已取消'
  }
  return '没成功，请再试一次'
}

/** 轻量 toast，统一人话输出 */
function toast(title, icon) {
  wx.showToast({
    title: title,
    icon: icon || 'none',
    duration: 2200
  })
}

/**
 * 自定义导航栏度量：状态栏高度 + 右侧胶囊避让宽度
 * 不做胶囊避让时，「设置 / 清空」按钮会被微信胶囊压住
 */
// 同一台机器上这些值不会变，缓存起来：
// 每次进页面都调 getMenuButtonBoundingClientRect 会拖慢页面切换
let _navCache = null

function navMetrics() {
  if (_navCache) return _navCache

  let statusBarHeight = 20
  let capsulePad = 0
  try {
    const info = (wx.getWindowInfo && wx.getWindowInfo()) || wx.getSystemInfoSync()
    statusBarHeight = info.statusBarHeight || 20
    const rect = wx.getMenuButtonBoundingClientRect && wx.getMenuButtonBoundingClientRect()
    if (rect && rect.width > 0 && info.windowWidth) {
      // 胶囊左边缘到屏幕右缘，再留 8px 呼吸空间
      capsulePad = Math.max(0, info.windowWidth - rect.left + 8)
    }
  } catch (e) {}

  _navCache = { statusBarHeight: statusBarHeight, capsulePad: capsulePad }
  return _navCache
}

/**
 * 点击反馈。
 * 真机上每点一下都震动，老人会觉得「手机在抖」，观感不佳。
 * 本产品已有更强的反馈通道（语音回执 + 按钮变色），震动并非必需。
 * → 默认关闭，设置页可开。
 */
function tapFeedback() {
  let on = false
  try {
    const g = getApp() && getApp().globalData
    const s = (g && g.settings) || {}
    on = s.haptic === true
  } catch (e) {}
  if (!on) return
  wx.vibrateShort({ type: 'light', fail: function () {} })
}

module.exports = {
  normalizeFontScale: normalizeFontScale,
  uid: uid,
  formatTime: formatTime,
  humanError: humanError,
  toast: toast,
  tapFeedback: tapFeedback,
  navMetrics: navMetrics
}
