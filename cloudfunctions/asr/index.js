/**
 * 云函数 asr —— 语音识别（腾讯云 一句话识别 SentenceRecognition）
 * ---------------------------------------------------------------
 * 存在的理由：微信同声传译插件未对个人主体开放，因此自建云端识别通道。
 * 对不识字的人来说「说话」是最自然的输入方式，所以这里用云端识别补回来。
 *
 * 零 npm 依赖。密钥从环境变量读取（SECRET_ID / SECRET_KEY）。
 *
 * 入参：{ audio: '<base64 of mp3>', format: 'mp3' }
 * 出参：{ ok: true, text: '...' } | { ok: false, msg }
 */
const crypto = require('crypto')
const https = require('https')

const HOST = 'asr.tencentcloudapi.com'
const SERVICE = 'asr'
const ACTION = 'SentenceRecognition'
const VERSION = '2019-06-14'
const REGION = 'ap-guangzhou'
// 一句话识别：音频时长 ≤ 60s；云函数入参约 1MB，base64 后再留余量
const MAX_B64 = 900 * 1024

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
    'POST', '/', '',
    canonicalHeaders,
    signedHeaders,
    sha256hex(payload)
  ].join('\n')

  const algorithm = 'TC3-HMAC-SHA256'
  const credentialScope = date + '/' + SERVICE + '/tc3_request'
  const stringToSign = [
    algorithm, String(timestamp), credentialScope, sha256hex(canonicalRequest)
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
      res.on('data', function (c) { data += c })
      res.on('end', function () { resolve(data) })
    })
    req.on('error', reject)
    req.setTimeout(20000, function () { req.destroy(new Error('timeout')) })
    req.write(body)
    req.end()
  })
}

exports.main = async function (event) {
  // 注意：云开发环境变量名禁止使用 SCF_ / QCLOUD_ / TENCENTCLOUD_ 前缀，
  // 所以这里只能用 SECRET_ID / SECRET_KEY
  const secretId = process.env.SECRET_ID || process.env.ASR_SECRET_ID
  const secretKey = process.env.SECRET_KEY || process.env.ASR_SECRET_KEY

  if (!secretId || !secretKey) {
    return { ok: false, msg: '说话功能还没开通，请先配置云函数密钥' }
  }

  const b64 = String((event && event.audio) || '')
  if (!b64) return { ok: false, msg: '没有听到声音，请再说一次' }
  if (b64.length > MAX_B64) {
    return { ok: false, msg: '说得太长了，请分几次说' }
  }

  const format = String((event && event.format) || 'mp3')
  // 一句话识别只认 16k 采样率的中英文模型
  const engine = '16k_zh'

  const payload = JSON.stringify({
    ProjectId: 0,
    SubServiceType: 2,        // 2 = 一句话识别
    EngSerViceType: engine,
    SourceType: 1,            // 1 = 音频数据的 base64
    VoiceFormat: format,
    UsrAudioKey: 'ra-' + Date.now(),
    Data: b64,
    DataLen: Buffer.from(b64, 'base64').length
  })

  try {
    const ts = Math.floor(Date.now() / 1000)
    const raw = await request(payload, secretId, secretKey, ts)
    const json = JSON.parse(raw)
    const resp = json.Response || {}

    if (resp.Error) {
      const code = String(resp.Error.Code || '')
      const msg = String(resp.Error.Message || '识别失败')
      // 常见：没声音 / 太短 / 采样率不对
      if (code.indexOf('InvalidParameterValue') >= 0 || code.indexOf('FailedOperation') >= 0) {
        return { ok: false, msg: '没听清，请靠近手机再说一次' }
      }
      return { ok: false, msg: msg }
    }

    const text = String(resp.Result || '').trim()
    if (!text) return { ok: false, msg: '没听清，请再说一次' }
    return { ok: true, text: text }
  } catch (e) {
    return { ok: false, msg: '网络不太好，请检查一下' }
  }
}
