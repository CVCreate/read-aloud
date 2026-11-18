// pages/history/history.js —— 最近听过的，点一下重听
const Store = require('../../utils/store.js')
const Sentence = require('../../utils/sentence.js')
const Common = require('../../utils/common.js')

const app = getApp()

const SOURCE_ICON = {
  paste: 'paste',
  ocr: 'camera',
  asr: 'mic',
  manual: 'doc'
}

Page({
  data: {
    list: [],
    statusBarHeight: 20
  },

  onLoad() {
    const nav = Common.navMetrics()
    this.setData({ statusBarHeight: nav.statusBarHeight, capsulePad: nav.capsulePad })
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const raw = Store.loadHistory()
    const list = raw.map(function (item) {
      return {
        id: item.id,
        text: item.text,
        preview: Sentence.preview(item.text, 46),
        time: Common.formatTime(item.time),
        source: item.source || 'manual',
        iconKey: SOURCE_ICON[item.source] || 'doc',
        count: Sentence.split(item.text).length
      }
    })
    this.setData({ list: list })
  },

  /** 点卡片 → 回到首页开始念 */
  onReplay(e) {
    const id = e.currentTarget.dataset.id
    const item = Store.loadHistory().filter(function (i) { return i.id === id })[0]
    if (!item) return

    Common.tapFeedback()
    app.globalData.pendingText = item.text

    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
    } else {
      wx.redirectTo({ url: '/pages/index/index' })
    }
  },

  onRemove(e) {
    const id = e.currentTarget.dataset.id
    Common.tapFeedback()
    Store.removeHistory(id)
    this.refresh()
    Common.toast('已删掉')
  },

  onClearAll() {
    wx.showModal({
      title: '确定要清空吗',
      content: '以前的记录都会没有，找不回来了',
      confirmText: '清空',
      confirmColor: '#D32F2F',
      cancelText: '不要',
      success: (res) => {
        if (!res.confirm) return
        Store.clearHistory()
        this.refresh()
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
