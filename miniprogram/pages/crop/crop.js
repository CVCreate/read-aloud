/**
 * pages/crop/crop.js —— 框选识别区域
 * ---------------------------------------------------------------
 * 起因：整张照片（尤其手机截屏）直接 OCR 会把状态栏、聊天头像、
 * 时间戳、广告位一起念出来，听感混乱。
 * 解法：先让用户框出「要念的那一块」，只把框内送给 OCR。
 *
 * 交互按老人设计：
 *   · 默认给出一个大框，多数情况拖一下位置即可
 *   · 拖框内任意处 = 移动；拖四个角 = 改大小（角做得很大）
 *   · 「整张都要」= 跳过裁剪，走整图识别
 *   · 进页面有语音讲解，弄好后有大按钮，不需要识字
 *
 * 输出：裁剪后的临时文件路径写入 app.globalData.pendingOcrFile，
 *       首页 onShow 检测到就接着做 OCR。
 */
const app = getApp()
const Common = require('../../utils/common.js')
const Feedback = require('../../utils/feedback.js')

const MIN_SEL = 60      // 选区最小边长（屏幕 px）
const MAX_OUT = 1280    // 输出图最长边，超出会拖慢上传、云函数也吃不下

const COACH_KEY = 'crop_coached'   // 本地标记：框选页引导已看过

/** 首次使用引导：逐步逐钮讲，点任意处推进，可跳过（与首页遮罩引导同款交互） */
const COACH_STEPS = [
  {
    sel: '#stage',
    title: '先框出要念的字',
    text: '手指拖绿框挪位置，拖四个角可以改大小。',
    voice: '先把您要听的字框住。手指拖着绿框可以挪位置，拖四个角可以改大小。'
  },
  {
    sel: '#btnCancel',
    title: '取消',
    text: '不想要了，点它就回去，什么都不做。',
    voice: '这个带红叉的是取消。不想要了，点它就回去，什么都不做。'
  },
  {
    sel: '#btnAll',
    title: '整张都要',
    text: '整张照片上的字都念，不框也行。',
    voice: '这个是整张都要。整张照片上的字都念，不想框就用它。'
  },
  {
    sel: '#btnGo',
    title: '就认这块',
    text: '框好了点这个大绿钮，我只认框里的字念给您听。',
    voice: '框好了，点这个大绿钮：就认这块。我只认框里的字，念给您听。'
  }
]

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(v, hi))
}

Page({
  data: {
    imgSrc: '',
    ready: false,
    box: { x: 0, y: 0, w: 0, h: 0 },
    cvW: 100,
    cvH: 100,
    coach: { active: false, idx: 0, total: COACH_STEPS.length, title: '', desc: '', ring: 'display:none', tip: 'display:none' }
  },

  onLoad(options) {
    // 首页跳转时对路径做了 encodeURIComponent，这里必须解码，
    // 否则 <image> 拿到的是 http%3A%2F%2Ftmp%2F... 根本加载不出来（黑屏事故）
    let src = ''
    if (options && options.src) src = decodeURIComponent(options.src)
    if (!src) src = app.globalData.pendingCropSrc || ''
    if (!src) { wx.navigateBack(); return }
    this.setData({ imgSrc: src })

    const self = this
    // 原图尺寸必须拿到：要把屏幕上的框换算回图片上的像素
    wx.getImageInfo({
      src: src,
      success(r) {
        self._natural = { w: r.width, h: r.height }
        self.initBox()
      },
      fail() {
        Common.toast('读不到这张图，请重拍一张')
        setTimeout(function () { wx.navigateBack() }, 1500)
      }
    })
  },

  /** 量出舞台尺寸与图片实际显示区，给一个居中大框当起点 */
  initBox() {
    const self = this
    const q = wx.createSelectorQuery().in(this)
    q.select('#stage').boundingClientRect()
    q.exec(function (res) {
      const rect = res && res[0]
      const n = self._natural
      if (!rect || !rect.width || !n || !n.w) { self.setData({ ready: true }); return }

      self._stage = { left: rect.left, top: rect.top, w: rect.width, h: rect.height }
      // aspectFit 的实际绘制区域
      const scale = Math.min(rect.width / n.w, rect.height / n.h)
      const dw = n.w * scale
      const dh = n.h * scale
      const ox = (rect.width - dw) / 2
      const oy = (rect.height - dh) / 2
      self._disp = { ox: ox, oy: oy, w: dw, h: dh }

      const w = dw * 0.88
      const h = Math.min(dh * 0.55, dh - 24)
      self.setData({
        ready: true,
        box: {
          x: ox + (dw - w) / 2,
          y: oy + Math.max((dh - h) / 2, 10),
          w: w,
          h: h
        }
      })

      // 只讲一次：首次用遮罩引导一步步讲（语音在引导里），之后进页面只播一句话说明
      if (!wx.getStorageSync(COACH_KEY)) {
        setTimeout(function () { self.startCoach() }, 350)   // 等布局稳定再量位置
      } else {
        Feedback.sayText('把您想听的字框住。手指拖着绿框可以移动，拖四个角可以改大小。弄好了，点下面的大按钮：就认这块。')
      }
    })
  },

  /** ---------- 首次使用引导（交互与首页同款） ---------- */

  /** 顶部「听说明」：随时重听一遍（首次进页面是自动开始的，之后靠这个按钮） */
  onReplayCoach() {
    Common.tapFeedback()
    Feedback.stop()
    this.startCoach()
  },

  startCoach() {
    if (this.data.coach.active) return
    this.setData({ coach: { active: true, idx: 0, total: COACH_STEPS.length, title: '', desc: '', ring: 'display:none', tip: 'display:none' } })
    const self = this
    wx.nextTick(function () { self.showStep(0) })
  },

  showStep(idx) {
    const step = COACH_STEPS[idx]
    if (!step) { this.endCoach(); return }
    const self = this
    const query = wx.createSelectorQuery().in(this)
    query.select(step.sel).boundingClientRect()
    query.exec(function (res) {
      const rect = res && res[0]
      if (!rect || !rect.width) { self.endCoach(); return }
      const win = (wx.getWindowInfo && wx.getWindowInfo()) || { windowWidth: 375, windowHeight: 667 }
      const pad = 8
      const ring =
        'left:' + (rect.left - pad) + 'px;top:' + (rect.top - pad) + 'px;' +
        'width:' + (rect.width + pad * 2) + 'px;height:' + (rect.height + pad * 2) + 'px'
      const tipW = win.windowWidth - 32
      // 气泡高度按 200px 估算：下方放不下→试上方→上下都放不下（目标太大）→贴屏幕底部放完整
      const tipH = 200
      let tip
      const belowTop = rect.bottom + 16
      if (belowTop + tipH <= win.windowHeight - 24) {
        tip = 'left:16px;top:' + belowTop + 'px;width:' + tipW + 'px'
      } else if (rect.top - 16 - tipH >= 24) {
        // 用 bottom 定位，不用估气泡真实高度
        tip = 'left:16px;bottom:' + (win.windowHeight - rect.top + 16) + 'px;width:' + tipW + 'px'
      } else {
        const top = Math.max(win.windowHeight - tipH - 30, 24)
        tip = 'left:16px;top:' + top + 'px;width:' + tipW + 'px'
      }
      self.setData({
        coach: {
          active: true, idx: idx, total: COACH_STEPS.length,
          title: step.title, desc: step.desc, ring: ring, tip: tip
        }
      })
      Feedback.stop()
      Feedback.sayText(step.voice)
    })
  },

  onCoachNext() {
    const next = (this.data.coach.idx || 0) + 1
    if (next >= COACH_STEPS.length) this.endCoach()
    else this.showStep(next)
  },

  onCoachSkip() {
    this.endCoach()
  },

  endCoach() {
    Feedback.stop()
    try { wx.setStorageSync(COACH_KEY, 1) } catch (e) { }
    this.setData({ coach: { active: false, idx: 0, total: COACH_STEPS.length, title: '', desc: '', ring: 'display:none', tip: 'display:none' } })
  },

  localPoint(t) {
    const s = this._stage
    return { x: t.clientX - s.left, y: t.clientY - s.top }
  },

  onTStart(e) {
    if (!this._disp) return
    this._mode = (e.target && e.target.dataset && e.target.dataset.mode) || 'move'
    this._start = { p: this.localPoint(e.touches[0]), box: Object.assign({}, this.data.box) }
  },

  onTMove(e) {
    if (!this._start || !this._disp) return
    const d = this._disp
    const b0 = this._start.box
    const p = this.localPoint(e.touches[0])
    const dx = p.x - this._start.p.x
    const dy = p.y - this._start.p.y
    const m = this._mode

    if (m === 'move') {
      this.setData({
        box: {
          x: clamp(b0.x + dx, d.ox, d.ox + d.w - b0.w),
          y: clamp(b0.y + dy, d.oy, d.oy + d.h - b0.h),
          w: b0.w,
          h: b0.h
        }
      })
      return
    }

    // 四角缩放：拖动的那条边动，对边钉住
    let left = b0.x
    let top = b0.y
    let right = b0.x + b0.w
    let bottom = b0.y + b0.h
    if (m.indexOf('n') >= 0) top = clamp(b0.y + dy, d.oy, bottom - MIN_SEL)
    if (m.indexOf('s') >= 0) bottom = clamp(b0.y + b0.h + dy, top + MIN_SEL, d.oy + d.h)
    if (m.indexOf('w') >= 0) left = clamp(b0.x + dx, d.ox, right - MIN_SEL)
    if (m.indexOf('e') >= 0) right = clamp(b0.x + b0.w + dx, left + MIN_SEL, d.ox + d.w)
    this.setData({ box: { x: left, y: top, w: right - left, h: bottom - top } })
  },

  onTEnd() {
    this._start = null
  },

  /** 就认这块：裁剪 → 回首页做 OCR */
  onConfirm() {
    Common.tapFeedback()
    Feedback.stop()
    const self = this
    this.exportCrop(this.data.box, function (path) {
      app.globalData.pendingOcrFile = path
      wx.navigateBack()
    })
  },

  /** 整张都要：跳过裁剪，老流程 */
  onWhole() {
    Common.tapFeedback()
    Feedback.stop()
    app.globalData.pendingOcrFile = this.data.imgSrc
    wx.navigateBack()
  },

  onCancel() {
    Common.tapFeedback()
    Feedback.stop()
    wx.navigateBack()
  },

  /** 系统手势/胶囊返回也会走到这里：讲解语音不能留着继续念 */
  onUnload() {
    Feedback.stop()
  },

  /** 屏幕上的框 → 原图像素 → 输出图尺寸 */
  exportCrop(box, done) {
    const self = this
    const d = this._disp
    const n = this._natural

    const scale = n.w / d.w
    let sx = Math.round((box.x - d.ox) * scale)
    let sy = Math.round((box.y - d.oy) * scale)
    let sw = Math.round(box.w * scale)
    let sh = Math.round(box.h * scale)
    sx = clamp(sx, 0, n.w - 1)
    sy = clamp(sy, 0, n.h - 1)
    sw = clamp(sw, 1, n.w - sx)
    sh = clamp(sh, 1, n.h - sy)

    const outScale = Math.min(1, MAX_OUT / Math.max(sw, sh))
    const dw = Math.max(1, Math.round(sw * outScale))
    const dh = Math.max(1, Math.round(sh * outScale))

    this.setData({ cvW: dw, cvH: dh }, function () {
      self.drawCrop(sx, sy, sw, sh, dw, dh, done)
    })
  },

  drawCrop(sx, sy, sw, sh, dw, dh, done) {
    const self = this
    const fallback = function (msg) {
      if (msg) Common.toast(msg + '，已按整张识别')
      done(self.data.imgSrc)
    }

    wx.createSelectorQuery().in(this).select('#cv').fields({ node: true, size: true }).exec(function (res) {
      const el = res && res[0]
      if (!el || !el.node) { fallback('这个版本的微信不支持裁剪'); return }

      const canvas = el.node
      canvas.width = dw
      canvas.height = dh
      const ctx = canvas.getContext('2d')
      const img = canvas.createImage()

      img.onload = function () {
        ctx.clearRect(0, 0, dw, dh)
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh)
        wx.canvasToTempFilePath({
          canvas: canvas,
          x: 0, y: 0, width: dw, height: dh,
          destWidth: dw, destHeight: dh,
          fileType: 'jpg',
          quality: 0.92,
          success(r) { done(r.tempFilePath) },
          fail() { fallback('裁剪没成功') }
        })
      }
      img.onerror = function () { fallback('图片打开失败') }
      img.src = self.data.imgSrc
    })
  }
})
