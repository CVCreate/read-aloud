// app.js —— 全局初始化
const { loadSettings, DEFAULT_SETTINGS } = require('./utils/store.js')
const { normalizeFontScale } = require('./utils/common.js')

App({
  globalData: {
    settings: Object.assign({}, DEFAULT_SETTINGS),
    // 当前正在朗读的文本，供历史/设置页回显
    currentText: ''
  },

  onLaunch() {
    // 【无障碍关键】iOS 拨到静音模式也要出声，否则老人以为手机坏了
    if (wx.setInnerAudioOption) {
      wx.setInnerAudioOption({
        obeyMuteSwitch: false,
        autoplayUnrestricted: true
      })
    }

    // 云开发按需初始化：没开通就静默跳过，OCR / 云端音色会降级提示
    try {
      if (wx.cloud && typeof wx.cloud.init === 'function') {
        const envId = require('./config/index.js').cloudEnvId
        // 没填环境 ID 就用默认环境；填了就锁定对应环境（多环境账号必填）
        wx.cloud.init(envId ? { env: envId, traceUser: false } : { traceUser: false })
      }
    } catch (e) {
      console.warn('[app] cloud 未开通，云端能力不可用：', e)
    }

    this.globalData.settings = loadSettings()
    this.applyFontScale()
  },

  onShow() {
    // 从设置页返回时，字号可能改过
    this.globalData.settings = loadSettings()
    this.applyFontScale()
  },

  applyFontScale() {
    // 用 this 而不是 getApp()：onLaunch 阶段 getApp() 可能还没就绪
    this.globalData.fontScale = normalizeFontScale(this.globalData.settings.fontSize)
  },

  saveSettings(patch) {
    const { saveSettings } = require('./utils/store.js')
    this.globalData.settings = saveSettings(patch)
    this.applyFontScale()
    return this.globalData.settings
  }
})
