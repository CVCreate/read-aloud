/**
 * 隐私授权包裹
 * ---------------------------------------------------------------
 * 微信要求：读取剪贴板、相册、麦克风前，需先弹出《隐私保护指引》授权。
 *
 * 调用失败通常有两种原因，需要区分：
 *   A. 用户在弹窗里点了「拒绝」→ 再点一次按钮会重新弹
 *   B. 后台没有配置《用户隐私保护指引》→ 平台没有协议可弹，
 *      requirePrivacyAuthorize 直接 fail（errMsg 含 not declared）。
 *      这种情况只能去后台配置，代码无解。
 * ---------------------------------------------------------------
 */

/**
 * @returns {Promise<{ok: boolean, reason: string}>}
 *   reason: '' | 'denied'（用户拒绝）| 'undeclared'（后台没配置指引）
 */
function ensurePrivacy() {
  return new Promise(function (resolve) {
    // 低版本基础库没有这个 API：平台不做强制授权，直接放行
    if (typeof wx.requirePrivacyAuthorize !== 'function') {
      resolve({ ok: true, reason: '', skipped: true })
      return
    }
    // 先问一句「这次到底要不要弹授权」。
    // 调试模式（app.json __usePrivacyCheck__ = false）或用户此前已同意时，
    // 平台返回 needAuthorization = false，此时直接放行，不必多走一次授权。
    if (typeof wx.getPrivacySetting === 'function') {
      try {
        wx.getPrivacySetting({
          success: function (r) {
            if (r && r.needAuthorization === false) {
              resolve({ ok: true, reason: '', skipped: true })
              return
            }
            callAuthorize(resolve)
          },
          fail: function () { callAuthorize(resolve) }
        })
        return
      } catch (e) {}
    }
    callAuthorize(resolve)
  })
}

/** 真正发起授权；把官方的两种失败原因区分开 */
function callAuthorize(resolve) {
  try {
    wx.requirePrivacyAuthorize({
      success: function () { resolve({ ok: true, reason: '' }) },
      fail: function (err) {
        const msg = String((err && err.errMsg) || '')
        console.warn('[privacy] 授权未通过：', msg)
        // 官方 errMsg：接口没有在后台《用户隐私保护指引》里声明
        // 另一种常见表现：错误码 112（隐私接口未声明，平台直接禁用）
        if (
          msg.indexOf('not declared') >= 0 ||
          msg.indexOf('privacy agreement') >= 0 ||
          msg.indexOf('112') >= 0
        ) {
          resolve({ ok: false, reason: 'undeclared' })
          return
        }
        resolve({ ok: false, reason: 'denied' })
      }
    })
  } catch (e) {
    resolve({ ok: true, reason: '', skipped: true })
  }
}

/**
 * 把失败原因翻译成给子女/老人都看得懂的话
 */
function humanReason(reason) {
  if (reason === 'undeclared') {
    return '后台还没填《用户隐私保护指引》，需要开发者（家人）去小程序后台配置后才能用'
  }
  if (reason === 'denied') {
    return '刚才的弹窗点了「拒绝」。再点一次，在弹窗里点「允许」'
  }
  return '需要先同意隐私保护指引才能用这个功能'
}

/**
 * 打开《隐私保护指引》全文（供设置页等处放一个「查看协议」入口）
 * @param {function} [cb] cb(ok) —— 后台没配指引时会打开失败，必须让用户知道
 */
function openContract(cb) {
  if (typeof wx.openPrivacyContract !== 'function') {
    if (typeof cb === 'function') cb(false, 'api')
    return
  }
  wx.openPrivacyContract({
    success: function () { if (typeof cb === 'function') cb(true) },
    fail: function (e) { if (typeof cb === 'function') cb(false, (e && e.errMsg) || 'fail') }
  })
}

module.exports = {
  ensurePrivacy: ensurePrivacy,
  humanReason: humanReason,
  openContract: openContract
}
