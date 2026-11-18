// pages/index/index.js —— 朗读台（主页面）
const CONFIG = require('../../config/index.js')
const Store = require('../../utils/store.js')
const Sentence = require('../../utils/sentence.js')
const Tts = require('../../utils/tts.js')
const Privacy = require('../../utils/privacy.js')
const Feedback = require('../../utils/feedback.js')
const Common = require('../../utils/common.js')
const Asr = require('../../utils/asr.js')

const app = getApp()
const player = Tts.player

/**
 * 新手引导步骤：sel = 要高亮的元素，voice = 语音讲稿。
 * 顺序与界面一致，每个可点元素单独一步；改动布局时同步这里的 sel。
 */
const COACH_STEPS = [
  {
    sel: '#btnHistory',
    title: '历史',
    text: '念过的内容都存在这里，点开随时能再念一遍。',
    voice: '这个是历史。念过的内容都存在这里，点开随时能再念一遍。'
  },
  {
    sel: '#btnGuide',
    title: '说明',
    text: '忘了怎么用，点这里就能再看一遍这个教学。',
    voice: '这个是说明。忘了怎么用，点它就能再看一遍这个教学。'
  },
  {
    sel: '#btnSettings',
    title: '设置',
    text: '字的大小、念得快慢、屏幕常亮，都在这里调。',
    voice: '这个是设置。想把字调大、念得慢一点，都在这里调。'
  },
  {
    sel: '#rowReader',
    title: '这里显示要念的话',
    text: '粘贴进来、或拍出来的文字都显示在这里，正在念的句子会变成蓝色。',
    voice: '中间这块是念给您听的地方。粘贴进来或拍出来的文字都在这里，正在念的句子会变成蓝色。'
  },
  {
    sel: '#btnMain',
    title: '最大的绿色按钮',
    text: '点它就开始念。念的时候它会变成红色的「停止」，想停下就点它。',
    voice: '这个绿色的大按钮，点一下我就开始念。念的时候它会变成红色，写着停止，想停下就点它。'
  },
  {
    sel: '#btnPrev',
    title: '上一句',
    text: '这句没听清？点它，把刚才那句再念一遍。',
    voice: '这个是上一句。这句没听清，点它，把刚才那句再念一遍。'
  },
  {
    sel: '#btnPause',
    title: '暂停',
    text: '想歇一会就点它停一下，再点一下接着念。',
    voice: '这个是暂停。想歇一会就点它停一下，再点一下就接着念。'
  },
  {
    sel: '#btnNext',
    title: '下一句',
    text: '这句不想听？点它直接跳到下一句。',
    voice: '这个是下一句。这句不想听，点它直接跳到下一句。'
  },
  {
    sel: '#btnPaste',
    title: '粘贴',
    text: '在微信里长按别人发来的话，点「复制」，回来点这里，我就能念了。',
    voice: '在微信里，用手按住别人发来的话，点复制，回来点这个粘贴，我就能念了。'
  },
  {
    sel: '#btnOcr',
    title: '照片识字',
    text: '药盒、通知单、纸上的字：拍张照，框出要念的那块，我认出来念给您听。',
    voice: '纸上的字也一样。点照片识字，拍一张，把要念的字框出来，我认出来就念给您听。'
  },
  {
    sel: '#sp-slow',
    title: '语速：慢',
    text: '觉得念得太快，点它，我念得慢一些。',
    voice: '这是语速的慢。觉得念得太快，点它，我念得慢一些。'
  },
  {
    sel: '#sp-normal',
    title: '语速：中',
    text: '不快不慢，平时用这个就刚好。',
    voice: '这是语速的中。不快不慢，平时用这个就刚好。'
  },
  {
    sel: '#sp-fast',
    title: '语速：快',
    text: '想听快一点的，点它。',
    voice: '这是语速的快。想听快一点的，点它。'
  }
]

Page({
  data: {
    text: '',
    sentences: [],
    curIndex: -1,
    status: 'idle',          // idle | loading | playing | paused | finished
    // 是否在朗读中（决定「上一句 / 暂停 / 下一句」可不可点）
    active: false,
    fontSize: 60,
    speed: 'normal',
    speedLevels: CONFIG.speedLevels,
    keepScreenOn: true,

    // 剪贴板提示条
    clipHint: false,
    clipText: '',

    // 识字结果卡：拍糊了可以重拍 / 换一张
    ocrBox: '',

    // 能力
    canAsr: false,
    canOcr: false,

    // 语音输入状态
    recording: false,

    // 顶部短提示
    banner: '',

    // 状态栏高度（自定义导航栏用）+ 右侧胶囊避让宽度
    statusBarHeight: 20,
    capsulePad: 0,

    // 新手引导（遮罩高亮式）：非首次且未点说明时 active 恒为 false
    coach: { active: false }
  },

  onLoad(options) {
    const nav = Common.navMetrics()
    this.setData({ statusBarHeight: nav.statusBarHeight, capsulePad: nav.capsulePad })

    this.applySettings()
    this.bindPlayer()

    // 从设置页「重新看一遍使用说明」回来时带 coach=1，进页面直接开引导
    this._wantCoach = !!(options && options.coach && options.coach !== '0')

    // 打开右上角菜单的转发入口。
    // 页面不实现 onShareAppMessage 时，菜单里的「转发」是灰色的；
    // 「分享到朋友圈」还需 onShareTimeline，且仅 Android + 小程序已发布后才可用。
    wx.showShareMenu({
      withShareTicket: false,
      menus: ['shareAppMessage', 'shareTimeline']
    })
  },

  onReady() {
    // 优先级 0：第一次用 → 在真实界面上做遮罩式引导（说明按钮也会再走一遍）。
    // 放 onReady：要等节点渲染完才能量到各按钮的位置
    if (!Store.isOnboarded() || this._wantCoach) {
      this._wantCoach = false
      this.startCoach(true)
    }
  },

  onHide() {
    // 切后台 / 被其他页面盖住：引导讲解立刻停（回来 onShow 会重播当前步）
    if (this.data.coach.active) Feedback.stop()

    // 正文朗读不强行停止：切到微信聊天 / 锁屏后继续念
    // （app.json 已声明 requiredBackgroundModes: audio）
    // 老人可以把手机放下去做事，回来点红色大按钮就能停
    // 屏幕常亮要关掉，后台一直亮着很费电
    this.setScreenOn(false)
  },

  onShow() {
    this.applySettings()

    // 引导进行中从后台回来：重播当前这一步的讲解
    if (this.data.coach.active) {
      const s = COACH_STEPS[this.data.coach.idx || 0]
      if (s) { Feedback.stop(); Feedback.sayText(s.voice) }
    }

    // 优先级 0.5：从「框选」页面回来 → 拿裁剪好的图接着识字
    // （裁剪页只负责画框，不碰 OCR，文件路径经 globalData 传回来）
    const cropFile = app.globalData.pendingOcrFile
    if (cropFile) {
      app.globalData.pendingOcrFile = ''
      this.doOcr(cropFile)
      return
    }

    // 从后台/锁屏回来：把界面状态同步成播放器的真实状态
    // 否则会出现「声音还在念，界面却显示待机、没有停止按钮」
    const st = player.getStatus()
    if (st === 'playing' || st === 'loading' || st === 'paused') {
      this.setData({
        status: st,
        active: st === 'playing' || st === 'paused',
        curIndex: player.getIndex() >= 0 ? player.getIndex() : 0
      })
    }

    // 优先级 1：历史页点过来的文本 → 直接念
    const pending = app.globalData.pendingText
    if (pending) {
      app.globalData.pendingText = ''
      this.setData({ text: pending })
      this.startSpeak(pending, 'manual')
      return
    }

    // 优先级 2：剪贴板里有别人发来的话
    // 真机上 getClipboardData 是系统级调用，会拖慢页面切换；
    // 一次会话只自动问一次，且等过渡动画结束（400ms）后再读
    if (app.globalData.settings.autoReadClipboard && !this.data.text && !this._clipChecked) {
      this._clipChecked = true
      setTimeout(() => this.checkClipboard(), 400)
    }
  },

  onUnload() {
    player.off('onStatus')
    player.off('onSentence')
    player.off('onEnd')
    player.off('onError')
    player.stop(true)
    player.destroy()
    this.setScreenOn(false)
  },

  /* ============ 转发 / 分享 ============ */

  /**
   * 转发给微信好友 / 群
   * 标题用直白说法，老人一看就知道是什么；卡片图按 5:4 出
   */
  onShareAppMessage() {
    return {
      title: '念念有声 · 把文字念给你听',
      path: '/pages/index/index',
      imageUrl: '/images/share.png'
    }
  },

  /**
   * 分享到朋友圈
   * 限制条件：仅 Android 微信 + 基础库 2.11.3 以上 + 小程序已发布上线。
   * iOS 微信不支持小程序分享到朋友圈，该入口不出现属于正常现象。
   */
  onShareTimeline() {
    return {
      title: '念念有声 · 把文字念给你听',
      query: '',
      imageUrl: '/images/share.png'
    }
  },

  /* ============ 设置 ============ */

  applySettings() {
    const s = app.globalData.settings
    const speedHit = CONFIG.speedLevels.filter(function (i) { return i.key === s.speed })[0] || CONFIG.speedLevels[0]
    const p = Tts.probe()
    // 一次 setData 搞定，避免 onShow 里连续三次触发渲染
    const patch = {
      fontSize: Common.normalizeFontScale(s.fontSize),
      speed: speedHit.key,
      keepScreenOn: !!s.keepScreenOn,
      // 🎤 显隐由 config.enableAsr 总控：false 时按钮不渲染
      canAsr: p.asr && CONFIG.enableAsr !== false,
      canOcr: p.cloud,
      banner: (s.ttsEngine === 'plugin' && !p.plugin && !p.cloud)
        ? '还没开通朗读功能，请到设置里检查'
        : ''
    }
    this.setData(patch)
  },

  /* ============ 播放器事件绑定 ============ */

  /**
   * 只在值真的变了才 setData。
   * 首页正文可能有一两百个句子节点，每句播完都会回调一次，
   * 无脑 setData 会让整个列表反复 diff —— 这是真机卡顿的主因之一。
   */
  setIfChanged(key, value) {
    if (this.data[key] === value) return false
    const patch = {}
    patch[key] = value
    this.setData(patch)
    return true
  },

  bindPlayer() {
    player.on('onStatus', (status, info) => {
      this.setIfChanged('status', status)
      // 只有真在念（或暂停）时，句控制才可用
      this.setIfChanged('active', status === 'playing' || status === 'paused')
      if (status === 'playing' || status === 'loading') {
        this.setScreenOn(this.data.keepScreenOn)
      }
      if (status === 'idle' || status === 'finished') {
        this.setScreenOn(false)
      }
      if (status === 'loading') {
        this.setIfChanged('banner', '正在准备…')
      } else if (status === 'playing') {
        // 常驻提示打断方式：老人念到一半想停，得看得见「怎么停」
        this.setIfChanged('banner', '正在念 · 点红色大按钮停下')
      }
    })

    player.on('onSentence', (i, sentence) => {
      this.setIfChanged('curIndex', i)
    })

    player.on('onEnd', (failed) => {
      this.setData({ status: 'finished', active: false, banner: failed > 0 ? '念完啦，有 ' + failed + ' 句没念出来' : '念完啦' })
      this.setScreenOn(false)
      Common.tapFeedback()
      // 语音回执：念完啦 / 念完啦，有几句没念出来
      Feedback.say(failed > 0 ? 'donePartial' : 'done')
    })

    player.on('onError', (msg) => {
      // 单句失败不打断整段，只在顶部轻提示
      console.warn('[tts]', msg)
    })
  },

  setScreenOn(on) {
    if (wx.setKeepScreenOn) {
      wx.setKeepScreenOn({ isKeepScreenOn: !!on, fail: function () {} })
    }
  },

  /* ============ 朗读控制 ============ */

  startSpeak(text, source) {
    const t = String(text || '').trim()
    if (!t) {
      Common.toast('还没有内容，请先粘贴或拍照')
      return
    }

    const s = app.globalData.settings
    const speedHit = CONFIG.speedLevels.filter(function (i) { return i.key === s.speed })[0] || CONFIG.speedLevels[0]

    // 先把断句结果渲染出来，让老人立刻看到字
    const parts = Sentence.split(t)
    this.setData({
      text: t,
      sentences: parts,
      curIndex: -1,
      clipHint: false
    })

    const ok = player.speak(t, {
      engine: s.ttsEngine,
      rate: speedHit.rate,
      cloudSpeed: speedHit.cloudSpeed,
      voiceType: s.voiceType
    })

    if (!ok) {
      Common.toast('这段文字念不出来，换一段试试')
      return
    }

    // 存历史
    Store.pushHistory(t, source || 'manual')
  },

  /** 绿色/红色大圆按钮 */
  onMainTap() {
    Common.tapFeedback()
    const st = this.data.status
    if (st === 'playing' || st === 'loading') {
      this.stopSpeak()
      Feedback.say('stop')
    } else if (st === 'paused') {
      // 先念「接着念」，念完再恢复正文，两个声音不打架
      Feedback.say('resume', () => player.resume())
    } else if (!String(this.data.text || '').trim()) {
      Feedback.say('empty')
    } else {
      // 先念「好，我开始念了」，念完再开始正文
      Feedback.say('start', () => this.startSpeak(this.data.text, 'manual'))
    }
  },

  stopSpeak(silent) {
    player.stop(silent)
    this.setData({ status: 'idle', active: false, curIndex: -1, banner: silent ? '' : '已停下' })
    this.setScreenOn(false)
  },

  /**
   * 没在念的时候，这三个按钮是「弱化」样式（不是 disabled）：
   * disabled 点了完全没反应，老人会以为手机卡住 —— 所以改成点了就语音提醒。
   */
  guardActive() {
    Common.tapFeedback()
    if (this.data.active) return true
    Feedback.say('needPlay')
    return false
  },

  onTogglePlay() {
    if (!this.guardActive()) return
    if (this.data.status === 'playing') {
      player.pause()
      Feedback.say('pause')
    } else if (this.data.status === 'paused') {
      Feedback.say('resume', () => player.resume())
    }
  },

  onPrev() {
    if (!this.guardActive()) return
    player.prev()
  },

  onNext() {
    if (!this.guardActive()) return
    player.next()
  },

  /**
   * 点任意一句 → 立刻跳到那句念（打断 + 重定位）
   * 念错了、没听清，点一下那句话就行，不用上一句下一句地按
   */
  onSegTap(e) {
    const i = Number(e.currentTarget.dataset.i)
    if (isNaN(i)) return
    Common.tapFeedback()
    player.seek(i)
    this.setData({ curIndex: i })
  },

  /* ============ 输入：粘贴 ============ */

  async onPaste() {
    Common.tapFeedback()
    const p = await Privacy.ensurePrivacy()
    if (!p.ok) {
      Common.toast(Privacy.humanReason(p.reason))
      return
    }
    wx.getClipboardData({
      success: (res) => {
        const t = String((res && res.data) || '').trim()
        if (!t) {
          Feedback.say('clipEmpty')
          Common.toast('没有复制过文字，请先长按文字点「复制」')
          return
        }
        this.setData({ text: t })
        Feedback.say('start', () => this.startSpeak(t, 'paste'))
      },
      fail: (err) => {
        Feedback.say('netFail')
        Common.toast(Common.humanError(err && err.errMsg))
      }
    })
  },

  /** 进入时自动探测剪贴板，弹一个大提示条 */
  async checkClipboard() {
    const p = await Privacy.ensurePrivacy()
    if (!p.ok) return
    wx.getClipboardData({
      success: (res) => {
        const t = String((res && res.data) || '').trim()
        // 太短的（验证码、单个词）不打扰；太长的只取前 500 字
        if (!t || t.length < 6) return
        if (this._lastClip === t) return
        this._lastClip = t
        this.setData({
          clipHint: true,
          clipText: Sentence.preview(t, 60)
        })
      },
      fail: () => {}
    })
  },

  onOcrClose() {
    Common.tapFeedback()
    this.setData({ ocrBox: '' })
  },

  onClipRead() {
    Common.tapFeedback()
    const t = this._lastClip || ''
    this.setData({ clipHint: false, ocrBox: '', text: t })
    Feedback.say('start', () => this.startSpeak(t, 'paste'))
  },

  onClipDismiss() {
    this.setData({ clipHint: false })
  },

  /* ============ 输入：拍照识字 ============ */

  /**
   * @param {object} e 可带 data-src：'camera' 只拍照 / 'album' 只选相册
   *                  留空则两个都给（首次进入的默认行为）
   */
  async onOcr(e) {
    Common.tapFeedback()
    const src = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.src) || ''
    const ok = await Privacy.ensurePrivacy()
    if (!ok.ok) {
      Common.toast(Privacy.humanReason(ok.reason))
      return
    }
    if (!this.data.canOcr) {
      Common.toast('识字功能还没开通，请先在设置里配置')
      return
    }

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: src ? [src] : ['camera', 'album'],
      sizeType: ['compressed'],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0]
        if (!file) return
        // 先去框选页面让用户把「要念的那一块」框出来：
        // 整图 OCR 会把截屏里的状态栏、头像、时间戳、广告一起念出来。
        wx.navigateTo({
          url: '/pages/crop/crop?src=' + encodeURIComponent(file.tempFilePath)
        })
      },
      fail: (err) => {
        const m = String((err && err.errMsg) || '')
        if (m.indexOf('cancel') < 0) Common.toast(Common.humanError(m))
      }
    })
  },

  doOcr(filePath) {
    wx.showLoading({ title: '正在认字…', mask: true })
    // 先压缩：云函数入参有大小上限，原图很可能传不上去
    wx.compressImage({
      src: filePath,
      quality: 60,
      success: (r) => this.readAndOcr(r.tempFilePath),
      fail: () => this.readAndOcr(filePath)
    })
  },

  readAndOcr(filePath) {
    const FS = wx.getFileSystemManager()
    try {
      const b64 = FS.readFileSync(filePath, 'base64')
      wx.cloud.callFunction({
        name: CONFIG.cloudFn.ocr,
        data: { image: b64 },
        success: (r) => {
          wx.hideLoading()
          const result = (r && r.result) || {}
          if (result.ok && result.text) {
            // 保留识别结果：拍糊了能直接重拍，不用退回首页重来一遍
            this.setData({ text: result.text, ocrBox: result.text })
            Feedback.say('ocrOk', () => this.startSpeak(result.text, 'ocr'))
          } else {
            Feedback.say('ocrFail')
            Common.toast(result.msg || '没认出字来，换个清楚点的照片试试')
          }
        },
        fail: (err) => {
          wx.hideLoading()
          Feedback.say('netFail')
          Common.toast(Common.humanError(err && err.errMsg))
        }
      })
    } catch (e) {
      wx.hideLoading()
      Common.toast('读图片失败，再试一次')
    }
  },

  /* ============ 输入：说话 ============ */

  onAsr() {
    Common.tapFeedback()
    if (!this.data.canAsr) {
      Common.toast('说话功能还没开通，请先部署 asr 云函数')
      return
    }
    if (this.data.recording) {
      this.stopRecord()
      return
    }
    // 麦克风同样受隐私指引约束：弹窗拒绝 / 后台没配置都要给准确提示
    const self = this
    Privacy.ensurePrivacy().then(function (p) {
      if (!p.ok) {
        Common.toast(Privacy.humanReason(p.reason))
        return
      }
      self.startRecord()
    })
  },

  /**
   * 录音走云端识别（插件未对个人主体开放，因此自建 ASR 通道）
   * 按住 → 说话 → 点「说完了」→ 云函数识别 → 立刻念出来
   */
  startRecord() {
    Asr.start({
      onStart: () => {
        this.setData({ recording: true, banner: '请说话，说完点「说完了」' })
        Feedback.say('recording')
      },
      onResult: (text) => {
        this.setData({ recording: false, banner: '', text: text })
        Feedback.say('start', () => this.startSpeak(text, 'asr'))
      },
      onFail: (msg) => {
        this.setData({ recording: false, banner: '' })
        Common.toast(msg || '没听清，请再说一次')
      }
    })
  },

  stopRecord() {
    Asr.stop()
    this.setData({ recording: false, banner: '正在听写，请稍等…' })
  },

  _getSI() {
    try {
      return requirePlugin('WechatSI')
    } catch (e) {
      return null
    }
  },

  /* ============ 语速 ============ */

  onSpeed(e) {
    const key = e.currentTarget.dataset.key
    Common.tapFeedback()
    const hit = CONFIG.speedLevels.filter(function (i) { return i.key === key })[0]
    if (!hit) return
    app.saveSettings({ speed: key })
    this.setData({ speed: key })
    player.setRate(hit.rate)
    Feedback.say('speed')
    Common.toast('语速：' + hit.label)
  },

  /**
   * 「说明」：在主界面上重新走一遍新手引导（遮罩高亮真实按钮）。
   * 不再跳独立引导页 —— 高亮的是眼前的按钮，比看截图直观得多。
   */
  onReplayGuide() {
    Common.tapFeedback()
    this.startCoach(false)
  },

  /* ============ 跳转 ============ */

  /**
   * 跳设置页时刻意不停朗读，也不做多余 setData：
   * 与「切后台继续念」的设计一致；首页句子节点多，
   * 全量更新叠加页面初始化会造成明显卡顿。
   */
  goHistory() {
    Common.tapFeedback()
    wx.navigateTo({ url: '/pages/history/history' })
  },

  goSettings() {
    Common.tapFeedback()
    wx.navigateTo({ url: '/pages/settings/settings' })
  },

  /* ============ 新手引导（遮罩高亮真实按钮） ============ */
  /**
   * 遮罩式引导：半透明遮罩只露出当前要讲的按钮，配大字说明与语音，
   * 点屏幕任意处（或「下一步」）推进，可跳过。
   * 触发时机只有两个：① 首次进入 ② 点顶栏「说明」重看。
   */
  startCoach(first) {
    if (this.data.coach.active) return
    this._coachFirst = !!first
    // 先隐藏气泡量位置，量到后进入第 0 步
    this.setData({
      coach: { active: true, idx: 0, total: COACH_STEPS.length, title: '', desc: '', ring: 'display:none', tip: 'display:none' }
    })
    wx.nextTick(() => this.showCoachStep(0))
  },

  showCoachStep(idx) {
    const step = COACH_STEPS[idx]
    if (!step) { this.endCoach(); return }
    const query = wx.createSelectorQuery().in(this)
    query.select(step.sel).boundingClientRect()
    query.selectViewport().scrollOffset()
    query.exec(res => {
      const rect = res && res[0]
      if (!rect || !rect.width) { this.endCoach(); return }
      const win = (wx.getWindowInfo && wx.getWindowInfo()) || { windowWidth: 375, windowHeight: 667 }
      const pad = 8   // 高亮圈比按钮大一圈，看着不那么挤
      const ring =
        `left:${rect.left - pad}px;top:${rect.top - pad}px;` +
        `width:${rect.width + pad * 2}px;height:${rect.height + pad * 2}px`
      const tipW = win.windowWidth - 32
      // 气泡高度按 200px 估算：下方放不下→试上方→上下都放不下（目标太高，如朗读区）→贴屏幕底部放完整
      const tipH = 200
      let tip
      const belowTop = rect.bottom + 16
      if (belowTop + tipH <= win.windowHeight - 24) {
        tip = `left:16px;top:${belowTop}px;width:${tipW}px`
      } else if (rect.top - 16 - tipH >= 24) {
        // 用 bottom 定位，不用估气泡真实高度
        tip = `left:16px;bottom:${win.windowHeight - rect.top + 16}px;width:${tipW}px`
      } else {
        const top = Math.max(win.windowHeight - tipH - 30, 24)
        tip = `left:16px;top:${top}px;width:${tipW}px`
      }
      this.setData({
        coach: {
          active: true, idx: idx, total: COACH_STEPS.length,
          title: step.title, desc: step.text, ring: ring, tip: tip
        }
      })
      // 每步都配语音讲解（先停掉上一步的，保证「说到哪、亮到哪」）
      Feedback.stop()
      Feedback.sayText(step.voice)
    })
  },

  /** 点遮罩任意处 / 点「下一步」：推进；最后一步变「知道了，开始用」 */
  onCoachNext() {
    const next = (this.data.coach.idx || 0) + 1
    if (next >= COACH_STEPS.length) this.endCoach()
    else this.showCoachStep(next)
  },

  onCoachSkip() {
    this.endCoach()
  },

  endCoach() {
    Feedback.stop()
    if (this._coachFirst) {
      Store.setOnboarded()
      this._coachFirst = false
    }
    this.setData({ coach: { active: false } })
  }
})
