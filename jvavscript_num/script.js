/**
 * Encode a number using JvavScript.
 *
 * @param {number} n
 * @param {boolean} coerce If false, the expression returned may evaluate to a
 * string that converts to the given number; if true, the expression will always
 * return a number.
 * @returns {string}
 */
 function encodeNum(n, coerce, _noLog) {
  n = +n
  if (isNaN(n)) return "+_"
  if (Object.is(n, 0)) return "+[]"
  if (Object.is(n, -0)) return "-[]"

  var lit=numToLit(n)
  _noLog||_indent("编码数字:", inspect(n))
  const [res, type] = encodeLit(lit)
  _noLog||_outdent()
  if (coerce && type === "string") return `+(${res})`
  return res
}

function numToLit(n) {
  n = +n
  let lit = String(n)
  if (lit.includes("Infinity")) lit = lit.replace("Infinity", "1e1000")
  if (lit.includes(".")) lit = n.toExponential()
  if (lit.includes("e"))
    lit = lit.replace(
      /([-]?\d+)(?:\.(\d+))?e([+-]\d+)?$/,
      (_, int, fra, exp) => {
        int += fra || ""
        exp -= fra ? fra.length : 0
        if (exp >= 0 && exp < 10) {
          int += "0".repeat(exp)
          return int
        }
        return `${int}e${exp}`
      }
    )
  else lit = lit.replace(/[0]{10,}$/, z => `e${z.length}`)
  return lit
}

function encodeLit(lit) {
  lit += ""

  let res = ""
  let type = ""
  let state
  let _ts = Date.now()
  _indent("拼数:", lit)
  while (!type || lit.length) {
    if (Date.now() - _ts > 500) throw "timeouts" + (_ts+"").slice(-3)

    let [unitLen, unitRes, unitType, noParen, unitState] = invert(lit) || generalDig(lit)
    lit = lit.slice(unitLen)
    if (!type) {
      res += unitRes
      type = unitType
    } else {
      if (type === "number" && unitType === "number") {
        if (noParen) res = `[${res}]`
        else {
          unitRes = `[${unitRes}]`
          noParen = true
        }
      }
      res += noParen ? `+${unitRes}` : `+(${unitRes})`
      type = "string"
    }
    state = unitState
  }
  _outdent()
  return [res, type]
}

function generalDig(lit) {
  const match = lit.match(/^\d|^-[1-9]|^e/)
  if (!match) return
  _log("直接:", match)
  if (lit[0] === "e") return [1, "$([+!!_]+-[]+(+!!_))", "string", true]
  if (lit[0] === "-") return [2, "-!!_".repeat(+lit[1]), "number", lit[1] === "1"]
  if (lit[0] === "0") return [1, "-[]", "number", true]
  if (lit[0] === "1") return [1, "+!!_", "number"]
  return [1, "!!_" + "+!!_".repeat(lit[0] - 1), "number"]
}

function invert(lit) {
  let match = lit.match(/^(-?)([1-9][0-9]*|)([6-9])/)
  if (!match) return

  let neg = match[1]
  let init = match[2]
  let fina = match[3]
  if (
    fina === "6" &&
    init.slice(-1) < "6" &&
    (init.length < 2 || init.slice(-2, -1) < "6")
  ) {
    // 以 6 结尾，倒数第二、第三位都小于 6，此时不划算，去掉最后两位
    return invert(match[0].slice(0, -2))
  }
  let num = init + fina
  let ceil = getCeil(init)
  let diff = getDiff(num, ceil)
  if (!diff) {
    // 浮点误差影响计算结果，需要减少数位
    if (num[0] < 7 && num[1] < 7) {
      // 可以先直接编码第一个数位
      _log("(减法数字", match[0], "太大，暂时放弃减法数字…)")
      return
    }
    // 调整一下正则表达式，丢掉末尾的一些数位
    _log("(减法数字", match[0], "太大，先编码一部分…)")
    //if (_logs.length > 4096) throw _logs
    const match2 = lit.match(/^(-?)([1-9][0-9]*?[7-9]*)([7-9])/)
    let lit2 = match2[0]
    if (lit2 === match[0]) {
      // 新正则表达式的匹配结果跟原来一样，干脆直接扔掉最后一个数位
      lit2 = match[0].slice(0, -1)
    }
    // 重来
    return invert(lit2)
  }

  _indent("减法:", neg+init+fina,"=",(neg?"-(":"")+ceil,"-",diff+(neg?")":""))
  let res = encodeNum(ceil, false, true)
  res += "-!!_".repeat(diff)
  if (neg) res = `-(${res})`
  _outdent()
  return [
    neg.length + init.length + fina.length,
    res,
    "number",
    neg,
  ]

  function getCeil(init) {
    return +(+(init) + 1 + "0")
  }
  function getDiff(num, ceil) {
    let actual = ceil
    for (let diff = 1; diff <= 4; diff++) {
      actual -= 1
      if (String(actual) === num) return diff
    }
    return 0
  }
}

function explain(s) {
  return s
    .replace(/!!_/g, "true")
    .replace(/!_/g, "false")
}
function explain2(s) {
  return s
    .replace(/(?<p>\(|\[|^)\+\[\]/g, "$<p>0")
    .replace(/-\[\]/g, "-0")
    .replace(/(?:true)?(?:\+true)+/g, a => (a[0] === "+" ? "+" : "") + Math.ceil(a.length / 5))
    .replace(/(?:-true)+/g, a => a.length / -5)
    .replace(/\([+]?(\d+)\)/g, "$1")
    .replace(/^\+(\d+)/g, "$1")
    .replace(/([\[(\-])\+(?=\d)/g, "$1")
    .replace(/\+-0/g, "+0")
    .replace(/\((false|true)\+\[\]\)/g, '"$1"')
}
function inspect(n) {
  if (typeof n === "string") return JSON.stringify(n)
  if (Object.is(-0, n))return "-0"
  return String(n)
}

var _logs=""
function _indent(...m) {_logs+="<li>"+m.join(" ")+"<ul>"}
function _outdent() {_logs+="</ul></li>"}
function _log(...m){_logs+="<li>"+m.join(" ")+"</li>"}

function tryUpdate() {
_logs = ""
var n = num.value
var coerce=false
if(n[0]==="+"){
n=n.slice(1)
coerce=true
}
if (n.length >= 4 && "-infinity".startsWith(n.toLowerCase())) n = -Infinity
else if (n.length >= 3 && "infinity".startsWith(n.toLowerCase())) n = Infinity
try{
if(isNaN(n)&&n.toLowerCase()!=="nan")throw "不是数字"
n=+n
var o =encodeNum(n,coerce)
var p=explain(o)
var q
try{
const _ = function alert() {}
const __ = function prompt() { return null }
const $ = String.fromCharCode
const $$ = self
q=eval(o)
}catch(e){q=e}
var c = coerce ? q : +q
out.innerHTML= `\
<dl>
<dt>输入<dd><code>${inspect(n)}</code>
<dt>长度<dd><code>${o.length}</code>
<dt>输出<dd><code>${o}</code>
<dt>求值<dd><code>${inspect(q)}</code>
<dt>强转<dd>${coerce?"内置":`<code>${inspect(c)}</code>`}
<dt>同一<dd><code>${Object.is(c,n)}</code>
<dt>你品<dd><code>${p}</code>
<dt>细品<dd><code>${explain2(p)}</code>
<dt>调试<dd class=treeview><ul>${_logs}</ul>
</dl>`
}catch(e){return e}
}
function update() {
var err=tryUpdate()
if (err)out.textContent=[]+err
}
function roll() {
if (Math.random() < 0.1)var n=[0,0,-0,NaN,-Infinity,Infinity][0|Math.random()*6]
else {
let s= (0|Math.random()*9)+1+[]
let p = 0 | Math.random() * 16
if(p)s+="."
while(p--)s+=(0|Math.random()*10)
  s+="e"+(0|Math.random()**3 *308)
  if(Math.random()<.3)var n=-s
  else var n=+s
}
num.value = inspect(n)
update()
}
update()