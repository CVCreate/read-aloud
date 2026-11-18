/**
 * 断句引擎测试
 * ---------------------------------------------------------------
 * 运行： node tests/sentence.test.js
 * 退出码： 0 = 全部通过， 1 = 有失败
 *
 * 不依赖任何 npm 包，也不需要小程序环境（sentence.js 与 config/index.js
 * 都不调用 wx.* API），可以直接在 Node 里跑。
 */
const path = require('path')

const S = require(path.join(__dirname, '..', 'miniprogram', 'utils', 'sentence.js'))
const CONFIG = require(path.join(__dirname, '..', 'miniprogram', 'config', 'index.js'))

let pass = 0
let fail = 0

function check(name, cond, detail) {
  if (cond) {
    pass++
    console.log('  ✅ ' + name)
  } else {
    fail++
    console.log('  ❌ ' + name + (detail ? '\n     → ' + detail : ''))
  }
}

function group(title) {
  console.log('\n【' + title + '】')
}

/* ============ 1. 基本断句 ============ */
group('基本断句')

{
  const t = '今天天气很好。我下午去了菜市场，买了两斤西红柿！你晚饭想吃什么？'
  const out = S.split(t)
  check('按三种句末标点切成 3 段', out.length === 3, '实际 ' + out.length + ' 段')
  check('句末标点保留在片段末尾', out[0].endsWith('。') && out[1].endsWith('！') && out[2].endsWith('？'))
}

{
  const out = S.split('第一行\n第二行\n第三行')
  check('换行当作断点，切成 3 段', out.length === 3, '实际 ' + out.length + ' 段')
  check('片段内不含换行符', out.every(function (s) { return s.indexOf('\n') < 0 }))
}

/* ============ 2. 长句二次切分 ============ */
group('长句二次切分')

{
  // 69 字，超过 45 阈值，应按四个逗号切成分句
  const t = '早上起来我先去厨房烧了一壶水，然后走到阳台把花浇了一遍，接着打开电视看了一会儿新闻，后来邻居老王来敲门说他家的网线坏了想借我的工具用一下。'
  const out = S.split(t)
  check('带逗号长句按逗号再切成 4 段', out.length === 4, '实际 ' + out.length + ' 段')
  check('每段都不超过硬切上限', out.every(function (s) { return s.length <= CONFIG.maxSentenceLen }))
  check('拼接后与原文一致（不丢字）', out.join('') === S.normalize(t))
}

{
  // 短句不该被过度切碎，保持完整一口气念完
  const out = S.split('记得吃药！')
  check('短句不被过度切分', out.length === 1 && out[0] === '记得吃药！')
}

/* ============ 3. 硬切兜底与丢字检测 ============ */
group('硬切兜底与丢字检测')

{
  let t = ''
  for (let i = 0; i < 10; i++) t += '这是一段没有标点的话需要被硬切开来处理'
  const out = S.split(t)
  check('无标点长文被切成多段', out.length > 1, '实际 ' + out.length + ' 段')
  check('拼接后与原文完全一致（不丢字）', out.join('') === t)
  check('每段都不超过硬切上限', out.every(function (s) { return s.length <= CONFIG.maxSentenceLen }))
}

{
  const en = 'abcdefghijklmnopqrstuvwxyz'.repeat(8)
  const out = S.split(en)
  check('超长英文硬切后不丢字', out.join('') === en)
}

/* ============ 4. 数字处理 ============ */
group('数字处理')

{
  const out = S.split('有事打我电话13812345678，记住了吗？')
  check('长数字串被转成中文数字', out[0].indexOf('一 三 八') >= 0, out[0])
  check('长数字串不再保留阿拉伯数字', !/13812345678/.test(out[0]))
}

{
  const out = S.split('这盒药128.50元，一天吃3次。')
  check('含小数点的金额保持原样', out[0].indexOf('128.50') >= 0, out[0])
  check('短数字保持原样', out[0].indexOf('3次') >= 0)
}

/* ============ 5. 符号净化 ============ */
group('符号净化')

{
  const out = S.split('你好呀😊今天*天气#不错^_^我们去公园吧')
  check('emoji 被剔除', out[0].indexOf('😊') < 0)
  check('噪音符号被剔除', out[0].indexOf('*') < 0 && out[0].indexOf('#') < 0)
}

{
  const out = S.split('他说………好吧。。。那就这样吧！！！')
  check('省略号转成逗号', out[0].indexOf('，') >= 0, out[0])
  check('重复句末标点被合并', out[0].indexOf('。。。') < 0)
}

/* ============ 6. 边界情况 ============ */
group('边界情况')

{
  check('空字符串返回空数组', S.split('').length === 0)
  check('纯空白返回空数组', S.split('   \n\n  ').length === 0)
  check('纯标点不产生朗读片段', S.split('。，！？').length === 0)
  check('单句无标点正常返回 1 段', S.split('你好').length === 1)
  check('中英混排正常切分', S.split('这个WiFi密码是abc12345，打开WeChat就行。').length === 1)
}

/* ============ 7. 真实场景回归 ============ */
group('真实场景回归')

{
  // 子女发给父母的微信消息
  const msg = '妈，我今天晚上加班，不回去吃饭了。冰箱里有昨天买的饺子，你自己煮一下。记得吃药！血压药在电视柜第二个抽屉里，一天一片。'
  const out = S.split(msg)
  check('微信消息切成 4 句', out.length === 4, '实际 ' + out.length + ' 句')
  check('每句长度适中（≤40字）', out.every(function (s) { return s.length <= 40 }), out.map(function (s) { return s.length }).join(','))
}

{
  // 药品说明书风格
  const drug = '用法用量：口服，一次2片，一日3次，饭后服用。不良反应：偶见恶心、头晕。【禁忌】对本品过敏者禁用。'
  const out = S.split(drug)
  check('药品说明书能正常切分', out.length >= 2)
  const joined = out.join('')
  check('关键信息未被吃掉', joined.indexOf('一次2片') >= 0 && joined.indexOf('一日3次') >= 0)
}

/* ============ 结果 ============ */
console.log('\n============================')
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项')
console.log('============================\n')

process.exit(fail > 0 ? 1 : 0)
