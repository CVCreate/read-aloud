/**
 * 云端语音输入（不依赖微信同声传译插件）
 * ---------------------------------------------------------------
 * 为什么需要它：WechatSI 插件未对个人主体开放，无法依赖插件的语音识别。
 * 但对不识字的人来说，「说」才是最自然的输入方式 —— 只能自己造。
 *
 * 链路：录音(mp3/16k) → 云函数 asr → 腾讯云一句话识别 → 文本
 *
 * 一个硬约束：一句话识别最长 60 秒。到点自动停，不会让老人一直按着。
 */
const CONFIG = require('../config/index.js')

const FS = wx.getFileSystemManager()
const MAX_MS = 58000 // 留 2 秒余量

let rec = null
let recording = false
let autoStopTimer = null
let handlers = {}

function ensureRec() {
  if (!rec) rec = wx.getRecorderManager()
  return rec
}

function clearTimer() {
  if (autoStopTimer) {
    clearTimeout(autoStopTimer)
    autoStopTimer = null
  }
}

/**
 * 开始录音。说完后需调用 stop()，或到 58 秒自动停。
 * @param {object} opts { onStart, onResult(text), onFail(msg) }
 */
function start(opts) {
  opts = opts || {}
  handlers = opts

  if (recording) return
  if (!wx.getRecorderManager) {
    if (opts.onFail) opts.onFail('这个手机不支持录音')
    return
  }

  const r = ensureRec()

  r.onStart(function () {
    recording = true
    clearTimer()
    // 兜底：老人可能说完就忘了点「说完了」
    autoStopTimer = setTimeout(function () {
      if (recording) stop()
    }, MAX_MS)
    if (handlers.onStart) handlers.onStart()
  })

  r.onStop(function (res) {
    clearTimer()
    recording = false
    const file = res && res.tempFilePath
    if (!file) {
      if (handlers.onFail) handlers.onFail('没录到声音，请再说一次')
      return
    }
    recognize(file)
  })

  r.onError(function (err) {
    clearTimer()
    recording = false
    const msg = String((err && err.errMsg) || '')
    // 用户拒绝麦克风授权是最常见的情况
    if (msg.indexOf('auth deny') >= 0 || msg.indexOf('authorize') >= 0) {
      if (handlers.onFail) handlers.onFail('您还没允许用麦克风，请在弹窗里点「允许」')
      return
    }
    if (handlers.onFail) handlers.onFail('打不开麦克风，请再试一次')
  })

  try {
    r.start({
      duration: MAX_MS,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'mp3' // 腾讯云一句话识别认 mp3；默认 aac 它不收
    })
    recording = true
  } catch (e) {
    recording = false
    if (handlers.onFail) handlers.onFail('打不开麦克风，请再试一次')
  }
}

function stop() {
  if (!recording) return
  clearTimer()
  try {
    ensureRec().stop()
  } catch (e) {
    recording = false
  }
}

function isRecording() {
  return recording
}

/** 把录音文件交给云函数识别 */
function recognize(filePath) {
  if (!(wx.cloud && typeof wx.cloud.callFunction === 'function')) {
    if (handlers.onFail) handlers.onFail('说话功能还没开通')
    return
  }

  let b64 = ''
  try {
    b64 = FS.readFileSync(filePath, 'base64')
  } catch (e) {
    if (handlers.onFail) handlers.onFail('没录到声音，请再说一次')
    return
  }
  if (!b64) {
    if (handlers.onFail) handlers.onFail('没录到声音，请再说一次')
    return
  }

  wx.cloud.callFunction({
    name: CONFIG.cloudFn.asr,
    data: { audio: b64, format: 'mp3' },
    success: (r) => {
      const result = (r && r.result) || {}
      if (result.ok && result.text) {
        if (handlers.onResult) handlers.onResult(result.text)
      } else {
        if (handlers.onFail) handlers.onFail(result.msg || '没听清，请再说一次')
      }
    },
    fail: (err) => {
      const msg = String((err && err.errMsg) || '')
      if (msg.indexOf('-501') >= 0 || msg.indexOf('not found') >= 0) {
        if (handlers.onFail) handlers.onFail('说话功能还没开通，请先部署 asr 云函数')
        return
      }
      if (handlers.onFail) handlers.onFail('网络不太好，请检查一下')
    }
  })
}

module.exports = {
  start: start,
  stop: stop,
  isRecording: isRecording
}
