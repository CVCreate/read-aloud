/**
 * 云函数 tts —— 文本转语音（腾讯云语音合成 基础版 TextToVoice）
 * ---------------------------------------------------------------
 * 零 npm 依赖：签名与请求全用 Node 内置 crypto / https。
 * 密钥从环境变量读取，绝不写在代码里。
 *
 * 入参：{ text, speed, voiceType }
 * 出参：{ ok: true, audio: '<base64>', format: 'mp3' } | { ok: false, msg }
 */
const crypto = require('crypto')
const https = require('https')

const HOST = 'tts.tencentcloudapi.com'
const SERVICE = 'tts'
// ⚠️ 接口名必须是 TextToVoice（基础语音合成）。
// 写成 TextToProcess 等错误名称时，腾讯云返回 action invalid，
// 表现为小程序完全没有声音。修改后需重新上传部署本函数。
const ACTION = 'TextToVoice'
const VERSION = '2019-08-23'
const REGION = 'ap-guangzhou'
const MAX_TEXT = 110 // 基础版单次合成上限（字符）

/* ---------- TC3-HMAC-SHA256 ---------- */
function sha256hex(s) {
  return crypto.createHash('sha256').update(s).digest('hex')
}
function hmacsha256(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest()
}

function buildAuth(secretId, secretKey, payload, timestamp) {
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
  const canonicalHeaders = 'content-type:application/json; charset=utf-8\nhost:' + HOST + '\n'
  const signedHeaders = 'content-type;host'
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    sha256hex(payload)
  ].join('\n')

  const algorithm = 'TC3-HMAC-SHA256'
  const credentialScope = date + '/' + SERVICE + '/tc3_request'
  const stringToSign = [
    algorithm,
    String(timestamp),
    credentialScope,
    sha256hex(canonicalRequest)
  ].join('\n')

  const secretDate = hmacsha256('TC3' + secretKey, date)
  const secretService = hmacsha256(secretDate, SERVICE)
  const secretSigning = hmacsha256(secretService, 'tc3_request')
  const signature = crypto.createHmac('sha256', secretSigning)
    .update(stringToSign, 'utf8')
    .digest('hex')

  return algorithm +
    ' Credential=' + secretId + '/' + credentialScope +
    ', SignedHeaders=' + signedHeaders +
    ', Signature=' + signature
}

function request(payload, secretId, secretKey, timestamp) {
  return new Promise(function (resolve, reject) {
    const body = Buffer.from(payload, 'utf8')
    const options = {
      hostname: HOST,
      port: 443,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Host': HOST,
        'X-TC-Action': ACTION,
        'X-TC-Version': VERSION,
        'X-TC-Timestamp': String(timestamp),
        'X-TC-Region': REGION,
        'Authorization': buildAuth(secretId, secretKey, payload, timestamp),
        'Content-Length': body.length
      }
    }

    const req = https.request(options, function (res) {
      let data = ''
      res.setEncoding('utf8')
      res.on('data', function (chunk) { data += chunk })
      res.on('end', function () { resolve(data) })
    })
    req.on('error', reject)
    req.setTimeout(12000, function () {
      req.destroy(new Error('timeout'))
    })
    req.write(body)
    req.end()
  })
}

/**
 * 密钥指纹：只回传 SecretId 前 8 位，方便在小程序「检查声音」里
 * 跟腾讯云控制台的密钥列表比对，确认云函数用的是不是当前账号的钥匙。

 */
function keyHint(id) {
  const s = String(id || '')
  if (!s) return ''
  return s.slice(0, 8) + '…（' + s.length + '位）'
}

exports.main = async function (event) {
  // 注意：云开发环境变量名禁止使用 SCF_ / QCLOUD_ / TENCENTCLOUD_ 前缀，
  // 所以这里只能用 SECRET_ID / SECRET_KEY
  const secretId = process.env.SECRET_ID || process.env.TTS_SECRET_ID
  const secretKey = process.env.SECRET_KEY || process.env.TTS_SECRET_KEY
  const hint = keyHint(secretId)

  if (!secretId || !secretKey) {
    return { ok: false, msg: '云函数还没配置密钥，请用系统默认声音', keyHint: '' }
  }

  const text = String((event && event.text) || '').trim()
  if (!text) return { ok: false, msg: '没有要念的内容' }
  if (text.length > MAX_TEXT) {
    return { ok: false, msg: '这句话太长了', keyHint: hint }
  }

  // Speed 范围 -2 ~ 6；VoiceType 见 config/index.js
  const speed = Number.isFinite(Number(event.speed)) ? Number(event.speed) : 0
  const voiceType = Number.isFinite(Number(event.voiceType)) ? Number(event.voiceType) : 1002

  const payloadObj = {
    Text: text,
    SessionId: 'ra-' + Date.now() + '-' + Math.floor(Math.random() * 1e6),
    ModelType: 1,
    VoiceType: voiceType,
    Speed: Math.max(-2, Math.min(6, speed)),
    Volume: 5,
    SampleRate: 16000,
    Codec: 'mp3',
    ProjectId: 0
  }

  try {
    const payload = JSON.stringify(payloadObj)
    const raw = await request(payload, secretId, secretKey, Math.floor(Date.now() / 1000))
    const json = JSON.parse(raw)
    const resp = json.Response || {}
    if (resp.Error) {
      return {
        ok: false,
        msg: '合成失败：' + (resp.Error.Message || resp.Error.Code),
        code: resp.Error.Code || '',
        keyHint: hint
      }
    }
    if (!resp.Audio) {
      return { ok: false, msg: '没合成出声音', keyHint: hint }
    }
    return { ok: true, audio: resp.Audio, format: 'mp3', keyHint: hint }
  } catch (e) {
    return { ok: false, msg: '网络不好，没合成成功', keyHint: hint }
  }
}
