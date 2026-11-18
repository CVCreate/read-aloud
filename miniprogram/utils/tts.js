/**
 * 朗读引擎：断句 → 逐句合成 → 顺序播放
 * ---------------------------------------------------------------
 * TTS 通道：
 *   A. 云函数 + 腾讯云 TTS（默认，可调音色与语速）
 *   B. 微信同声传译插件（WechatSI，需企业主体，作备选）
 * 通道不可用时自动降级，不会白屏。
 * ---------------------------------------------------------------
 */
const CONFIG = require('../config/index.js')
const Sentence = require('./sentence.js')

// 插件引用：没在后台添加插件时 requirePlugin 会抛错，这里必须兜住
let SI = null
let siError = ''
try {
  SI = requirePlugin('WechatSI')
} catch (e) {
  SI = null
  siError = String((e && e.message) || e || '')
}

const FS = wx.getFileSystemManager()
const TMP_DIR = `${wx.env.USER_DATA_PATH}/tts_cache/`

// 保证缓存目录存在
try {
  FS.mkdirSync(TMP_DIR, true)
} catch (e) {}

/* ============ 能力探测 ============ */

/**
 * 探测可用的 TTS 通道
 * @returns {{ plugin: boolean, cloud: boolean, asr: boolean, reason: string }}
 */
function probe() {
  const cloud = !!(wx.cloud && typeof wx.cloud.callFunction === 'function')
  return {
    plugin: !!SI,
    cloud: cloud,
    // 语音输入走 asr 云函数；云开发与插件都不可用时才隐藏 🎤 按钮
    asr: cloud || !!(SI && typeof SI.getRecordRecognitionManager === 'function'),
    reason: siError
  }
}

/* ============ 合成：把一句话变成一个本地音频文件 ============ */

function synthWithPlugin(text) {
  return new Promise(function (resolve, reject) {
    SI.textToSpeech({
      lang: 'zh_CN',
      tts: true,
      content: text,
      success: function (res) {
        if (res && res.filename) resolve(res.filename)
        else reject(new Error('tts empty'))
      },
      fail: function (err) {
        reject(new Error('plugin tts fail: ' + JSON.stringify(err)))
      }
    })
  })
}

function synthWithCloud(text, opts) {
  return new Promise(function (resolve, reject) {
    wx.cloud.callFunction({
      name: CONFIG.cloudFn.tts,
      data: {
        text: text,
        speed: opts.cloudSpeed,
        voiceType: opts.voiceType
      },
      success: function (res) {
        const r = (res && res.result) || {}
        if (r.ok && r.audio) {
          // base64 → 本地文件
          const file = TMP_DIR + 'c_' + Date.now() + '_' + Math.floor(Math.random() * 1e6) + '.' + (r.format || 'mp3')
          try {
            FS.writeFileSync(file, r.audio, 'base64')
            resolve(file)
          } catch (e) {
            reject(new Error('write file fail'))
          }
        } else {
          reject(new Error(r.msg || 'cloud tts fail'))
        }
      },
      fail: function (err) {
        reject(new Error('callFunction fail: ' + ((err && err.errMsg) || '')))
      }
    })
  })
}

/** 按当前设置的通道合成一句 */
function synth(text, opts) {
  if (opts.engine === 'cloud') return synthWithCloud(text, opts)
  if (SI) return synthWithPlugin(text)
  if (opts.engine === 'plugin') {
    // 指定了插件但插件不可用 —— 有云就降级到云
    if (wx.cloud && typeof wx.cloud.callFunction === 'function') {
      return synthWithCloud(text, opts)
    }
    return Promise.reject(new Error('no plugin'))
  }
  return Promise.reject(new Error('no engine'))
}

/* ============ 播放器 ============ */

function createPlayer() {
  const S = {
    sentences: [],
    index: -1,
    cache: {},        // index → filePath
    audio: null,
    status: 'idle',   // idle | loading | playing | paused | finished
    opts: {},
    failed: 0,
    cb: {},           // onStatus / onSentence / onProgress / onError / onEnd
    seq: 0            // 每次 speak 自增，用于作废过期的异步回调
  }

  function emit(name, a, b) {
    const fn = S.cb[name]
    if (typeof fn === 'function') {
      try { fn(a, b) } catch (e) {}
    }
  }

  function setStatus(st) {
    S.status = st
    emit('onStatus', st, {
      index: S.index,
      total: S.sentences.length
    })
  }

  function ensureAudio() {
    if (!S.audio) {
      S.audio = wx.createInnerAudioContext()
      // 【无障碍关键】静音模式下也要出声
      if (S.audio.obeyMuteSwitch !== undefined) S.audio.obeyMuteSwitch = false

      S.audio.onEnded(function () { handleEnded() })
      S.audio.onError(function (err) {
        // 播放出错：跳过这一句，继续下一句，不让老人卡住
        S.failed++
        emit('onError', (err && err.errMsg) || 'play error')
        next(true)
      })
      S.audio.onStop(function () {})
    }
    return S.audio
  }

  function destroyAudio() {
    if (S.audio) {
      try { S.audio.stop() } catch (e) {}
      try { S.audio.destroy() } catch (e) {}
      S.audio = null
    }
  }

  function playFile(file) {
    const a = ensureAudio()
    try { a.stop() } catch (e) {}
    a.src = file
    if (S.opts.rate && a.playbackRate !== undefined) {
      a.playbackRate = S.opts.rate
    }
    setStatus('playing')
    a.play()
  }

  function handleEnded() {
    if (S.index + 1 < S.sentences.length) {
      playAt(S.index + 1)
    } else {
      setStatus('finished')
      emit('onEnd', S.failed)
      // 释放音频实例，避免长期占用
      destroyAudio()
    }
  }

  /** 播放第 i 句（会自动预取下一句） */
  function playAt(i, isRetry) {
    if (i < 0 || i >= S.sentences.length) {
      setStatus('finished')
      emit('onEnd', S.failed)
      destroyAudio()
      return
    }

    const mySeq = S.seq
    S.index = i
    emit('onSentence', i, S.sentences[i])

    const cached = S.cache[i]
    if (cached) {
      playFile(cached)
      prefetch(i + 1)
      return
    }

    setStatus('loading')
    synth(S.sentences[i], S.opts).then(function (file) {
      if (mySeq !== S.seq) return       // 已经被新的朗读任务取代
      S.cache[i] = file
      if (S.status === 'idle') return   // 期间已被停止
      playFile(file)
      prefetch(i + 1)
    }).catch(function (err) {
      if (mySeq !== S.seq) return
      // 失败重试一次；再失败就跳过，不卡住整段
      if (!isRetry) {
        setTimeout(function () { playAt(i, true) }, 400)
        return
      }
      S.failed++
      emit('onError', String((err && err.message) || err))
      next(true)
    })
  }

  /** 后台预合成下一句，消掉句间停顿 */
  function prefetch(i) {
    if (i < 0 || i >= S.sentences.length) return
    if (S.cache[i]) return
    if (S.prefetching) return
    S.prefetching = true
    synth(S.sentences[i], S.opts).then(function (file) {
      S.cache[i] = file
      S.prefetching = false
    }).catch(function () {
      S.prefetching = false
    })
  }

  function next(auto) {
    if (S.index + 1 >= S.sentences.length) {
      setStatus('finished')
      emit('onEnd', S.failed)
      destroyAudio()
      return
    }
    playAt(S.index + 1)
  }

  function prev() {
    if (S.index - 1 >= 0) playAt(S.index - 1)
    else playAt(0)
  }

  /**
   * 开始朗读
   * @param {string} text 原文
   * @param {object} opts { engine, rate, cloudSpeed, voiceType }
   */
  function speak(text, opts) {
    const parts = Sentence.split(text)
    if (!parts.length) {
      emit('onError', 'empty')
      return false
    }

    stop(true)

    S.seq++
    S.sentences = parts
    S.cache = {}
    S.failed = 0
    S.opts = opts || {}
    playAt(0)
    return true
  }

  function pause() {
    if (S.audio && S.status === 'playing') {
      try { S.audio.pause() } catch (e) {}
      setStatus('paused')
    }
  }

  function resume() {
    if (S.audio && S.status === 'paused') {
      try {
        if (S.opts.rate && S.audio.playbackRate !== undefined) {
          S.audio.playbackRate = S.opts.rate
        }
        S.audio.play()
      } catch (e) {}
      setStatus('playing')
    }
  }

  function toggle() {
    if (S.status === 'playing') pause()
    else if (S.status === 'paused') resume()
  }

  /** 停止。silent = true 时不触发 onEnd */
  function stop(silent) {
    S.seq++
    S.status = 'idle'
    if (S.audio) {
      try { S.audio.stop() } catch (e) {}
    }
    if (!silent) emit('onStatus', 'idle', { index: -1, total: S.sentences.length })
  }

  /** 跳到第 i 句（朗读中或已停止都可调用） */
  function seek(i) {
    if (S.status === 'idle' || S.status === 'finished') {
      // 没在播，就从头启动
      if (S.sentences.length) {
        S.status = 'loading'
        playAt(Math.max(0, Math.min(i, S.sentences.length - 1)))
      }
      return
    }
    playAt(Math.max(0, Math.min(i, S.sentences.length - 1)))
  }

  /** 改变语速（立即对当前播放生效） */
  function setRate(rate) {
    S.opts.rate = rate
    if (S.audio && S.audio.playbackRate !== undefined) {
      try { S.audio.playbackRate = rate } catch (e) {}
    }
  }

  /** 释放资源（页面卸载时调用） */
  function destroy() {
    stop(true)
    destroyAudio()
    S.sentences = []
    S.cache = {}
  }

  return {
    _state: S,
    on: function (name, fn) { S.cb[name] = fn },
    off: function (name) { delete S.cb[name] },
    speak: speak,
    pause: pause,
    resume: resume,
    toggle: toggle,
    stop: stop,
    next: next,
    prev: prev,
    seek: seek,
    setRate: setRate,
    destroy: destroy,
    getStatus: function () { return S.status },
    getIndex: function () { return S.index },
    getTotal: function () { return S.sentences.length },
    getSentences: function () { return S.sentences.slice() }
  }
}

/** 全局单例：首页/历史页共用同一个播放器 */
const player = createPlayer()

/**
 * 压低/恢复正文音量（ducking）
 * 语音回执播放时调用 duck(true)，播完 duck(false)。
 * 用音量渐变而不是停止正文，老人听感更连续。
 */
function duck(on) {
  const a = player._state.audio
  if (a && typeof a.volume !== 'undefined') {
    try { a.volume = on ? 0.25 : 1 } catch (e) {}
  }
}

module.exports = {
  probe: probe,
  player: player,
  createPlayer: createPlayer,
  duck: duck
}
