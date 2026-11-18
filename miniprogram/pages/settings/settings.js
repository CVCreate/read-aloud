// pages/settings/settings.js —— 全部是大按钮，不做二级菜单
const CONFIG = require('../../config/index.js')
const Store = require('../../utils/store.js')
const Tts = require('../../utils/tts.js')
const Common = require('../../utils/common.js')
const Feedback = require('../../utils/feedback.js')
const Privacy = require('../../utils/privacy.js')

const app = getApp()

Page({
  data: {
    speedLevels: CONFIG.speedLevels,
    fontLevels: CONFIG.fontLevels,
    voiceTypes: CONFIG.voiceTypes,

    speed: 'normal',
    fontSize: 'lg',
    voiceType: 1002,
    keepScreenOn: true,
    autoReadClipboard: true,
    haptic: false,

    // 能力状态
    cloudOk: false,
    // 隐私校验开关（读 config，用于提示「现在是调试模式」）
    privacyCheck: CONFIG.privacyCheck !== false,
    // 声音自检结果（逐行显示，便于定位「为什么没声音」）
    checkLines: [],
    statusBarHeight: 20
  },

  onLoad() {
    const nav = Common.navMetrics()
    this.setData({ statusBarHeight: nav.statusBarHeight, capsulePad: nav.capsulePad })
  },

  onShow() {
    const s = app.globalData.settings
    const p = Tts.probe()
    this.setData({
      speed: s.speed,
      fontSize: s.fontSize,
      voiceType: s.voiceType,
      keepScreenOn: !!s.keepScreenOn,
      autoReadClipboard: !!s.autoReadClipboard,
      haptic: s.haptic === true,
      cloudOk: p.cloud
    })
  },

  pick(e) {
    const key = e.currentTarget.dataset.key
    const val = e.currentTarget.dataset.val
    Common.tapFeedback()
    const patch = {}
    patch[key] = val
    app.saveSettings(patch)
    this.onShow()
    Common.toast('已经改好了')
  },

  pickNum(e) {
    const key = e.currentTarget.dataset.key
    const val = Number(e.currentTarget.dataset.val)
    Common.tapFeedback()
    const patch = {}
    patch[key] = val
    app.saveSettings(patch)
    this.onShow()
    Common.toast('已经改好了')
  },

  /**
   * 布尔开关。
   * 注意：dataset 里的 true/false 在不同基础库下可能是字符串，
   * 所以统一用 "1"/"0" 传递，这里再转成真正的布尔值。
   */
  pickBool(e) {
    const key = e.currentTarget.dataset.key
    const raw = e.currentTarget.dataset.val
    const val = raw === '1' || raw === 1 || raw === true || raw === 'true'
    Common.tapFeedback()
    const patch = {}
    patch[key] = val
    app.saveSettings(patch)
    this.onShow()
    Common.toast('已经改好了')
  },

  onReplayGuide() {
    Common.tapFeedback()
    // 回首页并带 coach=1，让首页 onReady 直接开启遮罩引导。
    Store.clearOnboarded()
    wx.reLaunch({ url: '/pages/index/index?coach=1' })
  },

  /**
   * 声音自检：一步一步查出「为什么没声音」
   * 结果直接显示在页面上，可整段复制发给帮忙配置的人
   */
  onAudioCheck() {
    Common.tapFeedback()
    const self = this
    const lines = []
    const push = function (t) {
      lines.push(t)
      self.setData({ checkLines: lines.slice() })
    }

    lines.length = 0
    this.setData({ checkLines: ['正在检查，请稍等…'] })

    // ① 云开发
    const hasCloud = !!(wx.cloud && typeof wx.cloud.callFunction === 'function')
    if (!hasCloud) {
      lines[0] = '① 云开发：没开通（去开发者工具点「云开发」开通）'
      self.setData({ checkLines: lines.slice() })
      return
    }
    lines[0] = '① 云开发：正常'
    self.setData({ checkLines: lines.slice() })

    // ② 云函数 tts + ③ 合成 + ④ 播放
    wx.cloud.callFunction({
      name: CONFIG.cloudFn.tts,
      data: { text: '声音检查，能听到这一句就说明没问题', speed: 0, voiceType: 1002 },
      success: function (res) {
        const r = (res && res.result) || {}
        // 指纹先行：一眼看出云函数用的是不是当前账号的密钥
        push('② 云函数 tts：已部署')
        if (r.keyHint) {
          push('　正在用的密钥：' + r.keyHint)
          push('　↑ 去腾讯云控制台「访问管理 → API密钥」比对前 8 位')
        } else {
          push('　正在用的密钥：没读到（环境变量 SECRET_ID 是空的）')
        }

        if (!r.ok || !r.audio) {
          push('③ 合成失败：' + (r.msg || '未知原因'))
          const msg = String(r.msg || '')
          // 只有确实是密钥问题时才提示环境变量，避免误导
          if (msg.indexOf('密钥') >= 0) {
            push('→ 云函数的环境变量没填：SECRET_ID / SECRET_KEY')
          } else if (msg.indexOf('service is not open') >= 0 || msg.indexOf('未开通') >= 0) {
            push('→ 腾讯云账号没开通「语音合成」服务，或密钥属于别的账号')
            push('→ 开通页：https://console.cloud.tencent.com/tts')
            push('→ 若已开通，多半是密钥不属于当前账号，按上面指纹换一把')
          } else {
            push('→ 密钥是通的，问题出在腾讯云服务侧，看上面那句报错')
          }
          return
        }
        push('③ 合成：成功')

        const file = `${wx.env.USER_DATA_PATH}/chk.mp3`
        try {
          wx.getFileSystemManager().writeFileSync(file, r.audio, 'base64')
        } catch (e) {
          push('③ 写入文件失败：' + ((e && e.errMsg) || e))
          return
        }
        const a = wx.createInnerAudioContext()
        if (a.obeyMuteSwitch !== undefined) a.obeyMuteSwitch = false
        a.src = file
        a.onEnded(function () {
          push('④ 播放：正常（应该听到声音了）')
          try { a.destroy() } catch (e) {}
        })
        a.onError(function (err) {
          push('④ 播放失败：' + ((err && err.errMsg) || '未知'))
          try { a.destroy() } catch (e) {}
        })
        a.play()
      },
      fail: function (err) {
        const raw = String((err && err.errMsg) || '未知错误')
        const noFn = /FunctionName|not\s*found|找不到|不存在|env/i.test(raw)
        push('② 云函数 tts：' + (noFn ? '没部署（要在开发者工具里右键上传部署）' : '调用失败'))
        push('③ 原始错误：' + raw)
      }
    })
  },

  /** 复制自检结果（给帮忙配置的人看） */
  onCopyCheck() {
    Common.tapFeedback()
    const text = (this.data.checkLines || []).join('\n')
    if (!text) return
    wx.setClipboardData({ data: text })
  },

  /** 打开《用户隐私保护指引》全文（平台提供的官方页面） */
  onOpenPrivacy() {
    Common.tapFeedback()
    // 后台没填《用户隐私保护指引》时 wx.openPrivacyContract 会直接失败，
    // 静默吞掉的话，老人点了没反应会以为手机卡了
    Privacy.openContract(function (ok) {
      if (!ok) Common.toast('还没配置隐私保护指引，暂时打不开')
    })
  },

  /**
   * 填入自己的音色 ID（子女操作，老人不用碰）
   * 来源：腾讯云「声音复刻」生成的 VoiceId，一串数字
   */
  onCustomVoice() {
    Common.tapFeedback()
    if (!this.data.cloudOk) {
      Common.toast('要先开通云函数才能换声音')
      return
    }
    const self = this
    wx.showModal({
      title: '用我自己的声音',
      content: '把腾讯云声音复刻生成的音色 ID 填进来（一串数字）',
      editable: true,
      placeholderText: '例如 1000000001',
      confirmText: '用这个',
      cancelText: '先不用',
      success(res) {
        if (!res.confirm) return
        const raw = String(res.content || '').trim()
        const id = Number(raw)
        // 复刻音色 ID 通常是 10 位以上的大数字，这里只做基本合法性判断
        if (!raw || !Number.isFinite(id) || id <= 0) {
          Common.toast('这不是有效的音色 ID，请检查一下')
          return
        }
        app.saveSettings({ voiceType: Math.round(id) })
        self.setData({ voiceType: Math.round(id) })
        Common.toast('换成你的声音了')
        Feedback.say('speed')
      }
    })
  },

  onClearHistory() {
    wx.showModal({
      title: '确定要清空吗',
      content: '以前的记录都会没有，找不回来了',
      confirmText: '清空',
      confirmColor: '#D32F2F',
      cancelText: '不要',
      success: (res) => {
        if (!res.confirm) return
        Store.clearHistory()
        Common.toast('已经清空')
      }
    })
  },

  goBack() {
    Common.tapFeedback()
    const pages = getCurrentPages()
    if (pages.length > 1) wx.navigateBack()
    else wx.redirectTo({ url: '/pages/index/index' })
  }
})
