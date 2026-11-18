/**
 * 语音回执：用「说话」代替「弹提示」
 * ---------------------------------------------------------------
 * 对不识字的老人，toast 里的字他看不懂，
 * 振动手指未必察觉。语音是这个产品唯一的兜底反馈通道。
 *
 * 三条铁律：
 *   1. 不复用正文播放器 —— 用独立音频实例，播完即毁，不打断朗读
 *   2. 回执播放时把正文音量压到 25%（ducking），播完恢复
 *   3. 忙时丢弃新请求 —— 回执不是关键信息，丢了比排队堆积好
 *
 * 合成走云函数（方案 B 主通道），失败时静默跳过，绝不阻塞业务。
 */
const CONFIG = require('../config/index.js')
const Tts = require('./tts.js')

const FS = wx.getFileSystemManager()
const TMP_DIR = `${wx.env.USER_DATA_PATH}/fb_cache/`

try {
  FS.mkdirSync(TMP_DIR, true)
} catch (e) {}

/** 回执文案。全部是口语，不用书面语 */
const PRESETS = {
  start: '好，我开始念了，想停就点红色的大按钮',
  stop: '已经停下了',
  pause: '先停一下',
  resume: '接着念',
  empty: '还没有内容，请先粘贴，或者拍张照片',
  clipEmpty: '没有复制过文字，请长按文字，点复制',
  ocrOk: '认出来了，我念给您听',
  ocrFail: '没认出字来，换个清楚点的照片试试',
  done: '念完啦',
  donePartial: '念完啦，有几句没念出来',
  netFail: '网络不太好，请检查一下',
  speed: '语速改好了',
  recording: '请说话，说完再点一次',
  // 「上一句 / 暂停 / 下一句」常驻显示，但没在念时点了不该没反应 —— 说一句提示
  needPlay: '先点绿色的圆按钮，我就开始念'
}

let audio = null
let busy = false
const cache = {}   // key → 文件路径（固定文件名，不会堆积）

/**
 * 播放令牌
 * ---------------------------------------------------------------
 * stop() 时令牌 +1；异步合成返回后若发现令牌已变，直接丢弃，
 * 既不播放也不占用 busy 通道。
 * 用途：切屏 / 跳过时上一段讲解不会继续念。
 */
let token = 0

function stale(my) {
  return my !== token
}

/**
 * 失败原因分类：noconfig（没配密钥）/ nocloud（没开云开发）/ net（网络或合成失败）
 * 引导页要据此显示不同的大字提示，不能只说「失败了」
 */
function fail(kind, raw) {
  const e = new Error(raw || kind)
  e.kind = kind
  return e
}

/** 一次合成尝试 */
function synthOnce(text, file) {
  return new Promise(function (resolve, reject) {
    if (!(wx.cloud && typeof wx.cloud.callFunction === 'function')) {
      reject(fail('nocloud', 'no cloud'))
      return
    }
    wx.cloud.callFunction({
      name: CONFIG.cloudFn.tts,
      data: { text: text, speed: 0, voiceType: 1002 },
      success: function (res) {
        const r = (res && res.result) || {}
        if (r.ok && r.audio) {
          try {
            FS.writeFileSync(file, r.audio, 'base64')
            resolve(file)
          } catch (e) {
            reject(fail('net', 'write fail'))
          }
        } else {
          const msg = String(r.msg || '')
          // 云函数没配密钥时会明确回这句话，要跟「网络不好」区分开
          reject(fail(msg.indexOf('密钥') >= 0 ? 'noconfig' : 'net', msg || 'tts fail'))
        }
      },
      fail: function (err) {
        const raw = String((err && err.errMsg) || 'callFunction fail')
        // 云函数没部署 / 环境 ID 不对，微信会回这几类错误，
        // 不能一律说成「网络不好」——那是两种完全不同的修法
        const noFn = /FunctionName|not\s*found|找不到|不存在|is\s*not\s*exist|env/i.test(raw) ||
          /-(501000|501001|501003|501004)/.test(raw)
        reject(fail(noFn ? 'nofunc' : 'net', raw))
      }
    })
  })
}

/**
 * 合成一句回执（回执固定走 cloud，与正文通道解耦）
 * 自动重试一次：首次使用时一次网络抖动，不该让老人以为软件坏了
 */
function synth(text, file) {
  return synthOnce(text, file).catch(function (e1) {
    if (e1 && e1.kind === 'noconfig') return Promise.reject(e1)  // 配置问题重试没用
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        synthOnce(text, file).then(resolve, function () { reject(e1) })
      }, 700)
    })
  })
}

/** 失败原因 → 给人看的话（引导页用，口语、不提技术名词） */
function humanFail(kind) {
  if (kind === 'noconfig') return '念声音的服务还没配好密钥，请让家里人帮忙弄一下'
  if (kind === 'nofunc') return '念声音的服务还没装好，需要家里人在电脑上部署一次'
  if (kind === 'nocloud') return '还没开通云开发，暂时听不到讲解'
  return '网络不太好，讲解没念出来'
}

function cleanup() {
  Tts.duck(false)
  if (audio) {
    try { audio.stop() } catch (e) {}
    try { audio.destroy() } catch (e) {}
    audio = null
  }
  busy = false
}

/**
 * 播放一条回执
 * @param {string} key PRESETS 的 key
 * @param {function} [then] 播完后的回调（失败也会调，保证业务不断流）
 */
function say(key, then) {
  const text = PRESETS[key]
  const done = function () {
    cleanup()
    if (typeof then === 'function') then()
  }

  if (!text) { if (typeof then === 'function') then(); return }
  if (busy) { if (typeof then === 'function') then(); return }

  const my = ++token
  if (cache[key]) {
    busy = true
    Tts.duck(true)
    playFile(cache[key], done, my)
    return
  }

  busy = true
  Tts.duck(true)
  const file = TMP_DIR + key + '.mp3'
  synth(text, file).then(function (f) {
    cache[key] = f
    playFile(f, done, my)
  }).catch(function () {
    // 合成失败：静默跳过，业务回调照常执行
    if (stale(my)) { Tts.duck(false); busy = false; return }
    done()
  })
}

function playFile(file, done, my) {
  // 令牌已失效 = 期间调用过 stop()：不要再出声
  if (stale(my)) {
    Tts.duck(false)
    busy = false
    return
  }
  audio = wx.createInnerAudioContext()
  if (audio.obeyMuteSwitch !== undefined) audio.obeyMuteSwitch = false
  audio.src = file
  // 已经被 stop() 作废的播放，即便系统仍回调了结束事件也不执行后续业务
  const wrapDone = function () {
    if (stale(my)) return
    done()
  }
  audio.onEnded(wrapDone)
  audio.onError(wrapDone)
  audio.play()
}

/**
 * 立刻停止当前回执 / 讲解语音
 * ---------------------------------------------------------------
 * 场景：引导页切下一屏、跳过、页面销毁。
 * 只作用于回执通道，不会碰正文中那个播放器（Tts），
 * 所以从首页「听一遍怎么用」进出引导页时，正文朗读不受影响。
 */
function stop() {
  token++
  cleanup()
}

/**
 * 通用文本回执（引导页用，长文案不做预置）
 * @param {string} text 要念的文字
 * @param {function} [then] 回调 (ok:boolean, kind:string)，kind 见 fail()
 */
function sayText(text, then) {
  const t = String(text || '').trim()
  const cb = function (ok, kind) {
    cleanup()
    if (typeof then === 'function') then(!!ok, kind || '')
  }

  if (!t) { cb(false, 'empty'); return }
  if (busy) { cb(false, 'busy'); return }

  const file = TMP_DIR + 't_' + hash(t) + '.mp3'
  const my = ++token
  busy = true
  Tts.duck(true)

  if (cache[file]) {
    playFile(cache[file], function () { cb(true) }, my)
    return
  }
  synth(t, file).then(function (f) {
    cache[file] = f
    playFile(f, function () { cb(true) }, my)
  }).catch(function (e) {
    // 合成失败：静默跳过业务，但把原因交给调用方（引导页要显示大字提示）
    if (stale(my)) { Tts.duck(false); busy = false; return }
    cb(false, (e && e.kind) || 'net')
  })
}

function hash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(36)
}

/** 是否正在播回执 */
function isBusy() {
  return busy
}

module.exports = {
  say: say,
  sayText: sayText,
  stop: stop,
  isBusy: isBusy,
  humanFail: humanFail
}
