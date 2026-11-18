/**
 * 云函数 ocr —— 图片识字（腾讯云 通用印刷体识别·高精度版）
 * ---------------------------------------------------------------
 * 零 npm 依赖。密钥从环境变量读取。
 *
 * 入参：{ image: '<base64>' }
 * 出参：{ ok: true, text: '...' } | { ok: false, msg }
 */
const crypto = require('crypto')
const https = require('https')

const HOST = 'ocr.tencentcloudapi.com'
const SERVICE = 'ocr'
// 主接口：高精度版（印刷体平均 95%+，适合药盒小字、通知单）
const ACTION = 'GeneralAccurateOCR'
// 兜底接口：通用版。高精度失败（额度用尽/限频/偶发）时自动换它再试一次，
// 两个接口同属「文字识别」服务，开通一次都能用，各有 1000 次/月免费额度。
const FALLBACK_ACTION = 'GeneralBasicOCR'
const VERSION = '2018-11-19'
const REGION = 'ap-guangzhou'
// 云函数入参上限约 1MB，base64 后留点余量
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

function request(payload, secretId, secretKey, timestamp, action) {
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
        'X-TC-Action': action,
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
  const secretId = process.env.SECRET_ID || process.env.OCR_SECRET_ID
  const secretKey = process.env.SECRET_KEY || process.env.OCR_SECRET_KEY

  if (!secretId || !secretKey) {
    return { ok: false, msg: '识字功能还没开通，请先配置云函数密钥' }
  }

  const b64 = String((event && event.image) || '')
  if (!b64) return { ok: false, msg: '没有拿到图片' }
  if (b64.length > MAX_B64) {
    return { ok: false, msg: '图片太大了，换张清楚点的小图' }
  }

  try {
    const payload = JSON.stringify({ ImageBase64: b64 })
    const ts = Math.floor(Date.now() / 1000)
    const raw = await request(payload, secretId, secretKey, ts, ACTION)
    let json = JSON.parse(raw)
    let resp = json.Response || {}
    if (resp.Error) {
      const ecode = String(resp.Error.Code || '')
      const emsg = String(resp.Error.Message || '')
      // 服务没开通：换接口也没用（两个接口同一服务），直接报给用户去开通
      if (/not open/i.test(ecode) || /not open/i.test(emsg)) {
        return { ok: false, msg: '认字失败：' + (emsg || ecode) }
      }
      // 其余失败（额度用尽/限频/偶发）→ 用通用印刷体版兜底再试一次
      const raw2 = await request(payload, secretId, secretKey, ts, FALLBACK_ACTION)
      json = JSON.parse(raw2)
      resp = json.Response || {}
      if (resp.Error) {
        return { ok: false, msg: '认字失败：' + (resp.Error.Message || resp.Error.Code) }
      }
    }
    const dets = resp.TextDetections || []
    // 按识别顺序拼成段落；每行之间换行，断句引擎会把换行当断点
    const lines = dets
      .map(function (d) { return String(d.DetectedText || '').trim() })
      .filter(function (t) { return !!t })

    if (!lines.length) return { ok: false, msg: '这张图里没认出字' }

    return { ok: true, text: lines.join('\n') }
  } catch (e) {
    return { ok: false, msg: '网络不好，没认出来' }
  }
}
