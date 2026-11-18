// 全局配置：改这里就能切换能力，不用动业务代码

// 本地私有配置（不入版本库）：复制 local.example.js 为 local.js 后填写。
// 文件不存在时使用默认值，不影响直接运行。
var local = {}
try { local = require('./local.js') || {} } catch (e) { local = {} }

module.exports = {
  // TTS 通道：'plugin' = 微信同声传译插件；'cloud' = 云函数 + 腾讯云 TTS
  // 该插件未对个人主体开放，因此默认走 cloud；企业主体可改回 'plugin'
  // 并恢复 app.json 中的插件声明
  ttsEngine: 'cloud',

  // 云开发环境 ID。留空 = 使用账号的默认环境（只有一个环境时无需配置）。
  // 多环境时在 local.js 中填写，模板见 local.example.js
  cloudEnvId: local.cloudEnvId || '',

  // 云函数名（需先在微信开发者工具中右键「上传并部署」）
  cloudFn: {
    tts: 'tts',
    ocr: 'ocr',
    asr: 'asr'
  },

  // 🎤 语音输入开关。默认关闭（首页不显示「说话」按钮）。
  // 开启前需满足：部署 asr 云函数、开通腾讯云语音识别、隐私指引已声明麦克风。
  enableAsr: false,

  // 语速档位：映射到音频 playbackRate / 云端 Speed 参数
  speedLevels: [
    { key: 'slow', label: '慢', rate: 0.75, cloudSpeed: -1 },
    { key: 'normal', label: '中', rate: 1.0, cloudSpeed: 0 },
    { key: 'fast', label: '快', rate: 1.25, cloudSpeed: 2 }
  ],

  // 字号档位（朗读区 rpx）
  fontLevels: [
    { key: 'xl', label: '超大', value: 80 },
    { key: 'lg', label: '大', value: 60 },
    { key: 'md', label: '中', value: 46 }
  ],

  // 云端音色（仅 ttsEngine = 'cloud' 时可选）
  // 来源：腾讯云语音合成 VoiceType
  voiceTypes: [
    { key: 1002, label: '温柔女声', desc: '智聆 · 通用女声' },
    { key: 10001, label: '沉稳男声', desc: '智远 · 适合长文' },
    { key: 1003, label: '清晰女声', desc: '智美 · 吐字清楚' },
    { key: 0, label: '标准女声', desc: '云小宁' }
  ],

  // 隐私协议强制校验开关。⚠️ 必须与 app.json 里的 "__usePrivacyCheck__" 保持一致！
  // false = 调试模式：不校验隐私协议，剪贴板、相册、摄像头、麦克风可直接调用，
  //         便于在开发版 / 体验版做真机功能验证。
  // true  = 正式模式：调用隐私接口前必须弹出《用户隐私保护指引》授权。
  //         小程序尚未发布时后台没有现网版指引，平台会拦截隐私接口（错误码 112），
  //         此时需临时置 false 才能调试。
  // 👉 正式发布前，务必与 app.json 同步改回 true。
  privacyCheck: true,

  // 历史记录条数上限
  historyLimit: 20,

  // 单句合成的最大字符数（超过则继续切分，防止 TTS 接口拒收）
  // 腾讯云 TTS 基础版单次上限 110 字符，这里留 10 字余量
  maxSentenceLen: 100,
  // 超过该长度即触发按逗号二次切分。
  // 定 45 而不是 60，是因为老人用慢速念 60 字要 16 秒不换气，偏长；
  // 切到 20 字一段听起来更自然，「上一句/下一句」也更好控制。
  softSentenceLen: 45
}
