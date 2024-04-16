/**
 * @param {number} start
 * @param {number} [end=]
 * @param {number} [step=]
 */
function* range(start, end, step) {
  if (end == null) {
    end = start
    start = 0
  }
  if (step == null) step = end < start ? -1 : 1
  const steps = (end - start) / step
  if (steps > Number.MAX_SAFE_INTEGER)
    throw new RangeError("range(): too many steps")
  if (!(steps > 0)) return
  for (let i = 0; i < steps; i++) {
    yield start + step * i
  }
}

/**
 * @template {string} T
 * @param {string} id
 * @param {T} _tagName
 * @returns {T extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[T] : HTMLElement}
 */
function $$$(id, _tagName) {
  return document.getElementById(id)
}

/**
 * @template T
 * @typedef {{ [P in keyof T as T[P] extends (...args: any[]) => any ? never : (<T>() => T extends { [Q in P]: T[P] } ? 1 : 2) extends <T>() => T extends { -readonly [Q in P]: T[P] } ? 1 : 2 ? P : never]?: T[P]}} Assignable
 */
/**
 * @template {keyof HTMLElementTagNameMap} T
 * @param {T} tagName
 * @param {ParentNode} [parent=]
 * @param {Assignable<HTMLElementTagNameMap[T]>} [props=]
 */
function E(tagName, parent, props) {
  const el = document.createElement(tagName)
  if (props) Object.assign(el, props)
  if (parent) parent.appendChild(el)
  return el
}

/**
 * @param {string} caption
 * @param {() => Iterable<string>} cb
 */
function group(caption, cb) {
  const section = E("section", $$$("container"), {
    className: "glyph-group",
  })
  E("h3", section, { textContent: caption })
  for (const glyph of cb()) {
    if (!glyph) {
      E("div", section, { className: "glyph-break" })
      continue
    }
    const el = E("div", section, { className: "glyph" })
    E("div", el, {
      className: "glyph-caption",
      textContent: glyph,
    })
    E("div", el, {
      className: "glyph-content",
      textContent: glyph.replace(/\\([0-9A-F]{1,6})/gi, (_, hex) =>
        String.fromCodePoint(parseInt(hex, 16))
      ),
    })
  }
}

const chatBasic = [..."bpmwjqxynzDsrHNldtgkh45vF7BcfuaoeEAYL62T83V1i"]
const chatSingle = [...chatBasic, "", ..."X9WPJURZO0KQGISMC"]
const chat = [
  "!`",
  ...chatSingle,
  ...Array.from("srPRQk85mwYaNxOCqgvLp6$¥yWn", char => char + "`"),
]

function xdpua(ind, cas) {
  return 0xe020 + (ind % 16) + cas * 16 + ~~(ind / 16) * 48
}
function ucsur(ind, cas, base = 0xf1b00) {
  return base + ind + cas * 0x60
}
function hex(num) {
  return (+num).toString(16).toUpperCase()
}

group("希顶 PUA 编码", function* () {
  for (let cas = 0; cas < 3; cas++) {
    for (let ind = 0; ind <= 45; ind++) yield `\\${hex(xdpua(ind, cas))}`
    yield ""
  }
  for (let i = 0xe015; i <= 0xe01f; i++) yield `\\${hex(i)}`
  yield ""
  for (let i = 0xe001; i <= 0xe00f; i++) yield `\\${hex(i)}`
})
group("希顶 PUA 编码（扩充字母）", function* () {
  for (let cas = 0; cas < 3; cas++) {
    for (let ind = 46; ind <= 88; ind++) yield `\\${hex(xdpua(ind, cas))}`
    yield ""
  }
})
group("聊天字母码位", function* () {
  yield* chat
})
group("⇧ + 聊天字母码位", function* () {
  for (const char of chat) yield char && "⇧" + char
})
group("⇩ + 聊天字母码位", function* () {
  for (const char of chat) yield char && "⇩" + char
})
group("^ + 聊天字母码位", function* () {
  for (const char of chat) yield char && "^" + char
})
group("~ + 聊天字母码位", function* () {
  for (const char of chat) yield char && "~" + char
})
group("全角聊天字母码位", function* () {
  for (const char of chatSingle)
    yield char && String.fromCodePoint(char.codePointAt(0) + 0xfee0)
})
group("扩展拉丁字母码位", function* () {
  for (const char of [..."[\\]", ...chatSingle])
    yield char && String.fromCodePoint(char.codePointAt(0) + 151)
})
group("UCSUR 码位", function* () {
  for (let cas = 0; cas < 3; cas++) {
    for (let ind = 0; ind <= 88; ind++) yield `\\${hex(ucsur(ind, cas))}`
    yield ""
  }
  for (let i = 0xf1bbd; i <= 0xf1bbf; i++) yield `\\${hex(i)}`
  yield ""
  for (let i = 0xf1c20; i <= 0xf1c2b; i++) yield `\\${hex(i)}`
  yield ""
  for (let i = 0xf1c30; i <= 0xf1c32; i++) yield `\\${hex(i)}`
})

let dragFlag = 0
document.documentElement.addEventListener("dragenter", function (ev) {
  if (!ev.dataTransfer.types.includes("Files")) return
  ev.preventDefault()
  ev.stopPropagation()
  ev.dataTransfer.dropEffect = "copy"
  dragFlag++
  this.style.backgroundColor = "aliceblue"
})
document.documentElement.addEventListener("dragover", function (ev) {
  if (!ev.dataTransfer.types.includes("Files")) return
  ev.preventDefault()
  ev.stopPropagation()
  ev.dataTransfer.dropEffect = "copy"
})
document.documentElement.addEventListener("drop", function (ev) {
  if (!ev.dataTransfer.types.includes("Files")) return
  ev.preventDefault()
  ev.stopPropagation()
  dragFlag = 0
  this.style.backgroundColor = ""

  handleFiles(ev.dataTransfer.files)
})
document.documentElement.addEventListener("dragleave", function (ev) {
  ev.preventDefault()
  ev.stopPropagation()
  if (!(dragFlag && --dragFlag)) this.style.backgroundColor = ""
})

function openFile() {
  const el = document.createElement("input")
  el.type = "file"
  el.accept = ".ttf,.otf,.woff,.woff2"
  el.addEventListener("change", function () {
    handleFiles(this.files)
  })
  el.click()
}

/** @param {FileList} files */
async function handleFiles(files) {
  try {
    if (files.length !== 1) throw "请选择单个字体"
    const file = files[0]
    const font = new FontFace("-xdi8", await file.arrayBuffer())
    await font.loaded // rejects on error
    document.fonts.clear()
    document.fonts.add(font)
  } catch (err) {
    alert(err)
    throw err
  }
}

new FontFace(
  "-xdi8",
  'url("https://dgck81lnn.github.io/bootstrap-lnn/fonts/XEGOEPUAall.woff2") format(woff2)'
)
  .load()
  .then(font => {
    document.fonts.add(font)
  })
