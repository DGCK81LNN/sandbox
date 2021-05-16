/*
 * 变量命名规则说明
 * 
 * 以`El`结尾：HTML元素
 * 以`Xel`结尾：XML剧情树中的元素
 */

/**
 * 输出容器
 * @type {HTMLElement}
 */
var mainEl = document.getElementById("main");
/**
 * 剧情树
 * @type {XMLDocument}
 */
var xml;
/**
 * 需要存储的数据
 * @typedef {{
 *   epidemicRecord: number[],
 *   volumesUnlocked: boolean,
 *   restoreVolume: string,
 *   restoreData: number[],
 * }} Data
 * @type {Data}
 */
var data = {
  epidemicRecord: [],
  volumesUnlocked: false,
  restoreVolume: "",
  restoreData: [],
};
/**
 * 内嵌Js的变量“作用域”
 */
var vars = { data };
/**
 * 当前运行的`volume`
 * @type {Element}
 */
var volumeXel;

try {
  Object.assign(data, JSON.parse(localStorage["soulSandboxLoveWithRichardData"]));
} catch (_) { console.log("恢复数据失败，已忽略\n", _) }


// 请求剧情树
{
  clearMainEl();
  mainEl.innerHTML = "<p>正在加载数据……<span id='progress' role='status'>正在等待连接</span></p>";
  let progressEl = document.getElementById("progress");
  const xhr = new XMLHttpRequest();
  xhr.open("get", "lwr.xml");
  xhr.overrideMimeType("application/xml");
  xhr.addEventListener("progress", event => {
    progressEl.textContent = `${(event.loaded / 1024).toFixed(1)}KB / ${event.lengthComputable ? (event.total / 1024).toFixed(1) : '?'}KB`;
  });
  xhr.addEventListener("load", () => {
    xml = xhr.responseXML;
    console.log(xml);
    init();
  });
  xhr.addEventListener("error", () => {
    mainEl.innerHTML = "<p>数据加载失败！</p>"
  });
  xhr.send();
}

const volumeIds = ['epidemic', 'senior', 'sports'];
const volumeNames = [
  "Love with Richard under Epidemic",
  "Love with Richard to Senior",
  "Love with Richard: 9/30 Sports Meet"
];
function init() {
  mainEl.innerHTML = '<h1 lang=en>Love with Richard <small>3 in 1</small></h1>';
  const ulEl = mainEl.appendChild(document.createElement("ol"));
  for (let i = 0; i < 3; ++i) {
    const volumeId = volumeIds[i], volumeName = volumeNames[i];
    const itemEl = ulEl.appendChild(document.createElement("li")).appendChild(document.createElement("p"));
    const nameEl = itemEl.appendChild(document.createElement("cite"));
    nameEl.textContent = volumeName;
    nameEl.setAttribute("lang", "en");
    itemEl.appendChild(document.createTextNode(" "));
    const startEl = itemEl.appendChild(document.createElement("button"));
    startEl.textContent = "开始";
    startEl.onclick = () => { run(volumeId) };
    itemEl.appendChild(document.createTextNode(" "));
    if (volumeId == data.restoreVolume) {
      const resumeEl = itemEl.appendChild(document.createElement("button"));
      resumeEl.textContent = "继续上次";
      resumeEl.onclick = () => { run(volumeId, data.restoreData) };
    }
  }
}

/**
 * 清空`mainEl`的内容
 */
function clearMainEl() {
  while (mainEl.firstChild) mainEl.removeChild(mainEl.firstChild);
}

/**
 * 运行剧情树的一个`volume`
 * @param {string} volumeId 要运行的`volume`的`id`
 * @param {number[]} restoreData 恢复之前进度
 */
async function run(volumeId, restoreData = []) {
  restoreData = restoreData.slice(0);
  clearMainEl();

  try {
    data.restoreVolume = volumeId;
    data.restoreData = restoreData;
    volumeXel = xml.getElementById(volumeId);

    const titleXel = xml.evaluate("title", volumeXel).iterateNext();
    mainEl.appendChild(importContent(titleXel, "h1"));

    await iterate(volumeXel, mainEl);

    data.restoreVolume = "";
    data.restoreData = [];
    save();

    init();
  } catch (err) {
    mainEl.appendChild(document.createElement("p"))
      .appendChild(document.createElement("i"))
      .textContent = "运行出错！" + err;
    throw err;
  }
}

/**
 * 运行剧情树的一个节点
 * @param {Element} xel 
 */
async function iterate(xel, el) {
  var skipElseBlocks = false;
  childLoop: for (let childXel of xel.children) {
    switch (childXel.nodeName) {
      case "p":
        el.appendChild(importContent(childXel, "p"));
        break;
      case "h":
        el.appendChild(importContent(childXel, "h2"));
      case "i":
        el.appendChild(document.createElement("p"))
          .appendChild(importContent(childXel, "i"));
        break;
      case "a":
        await execJs(childXel.getAttribute("js"));
        break;
      case "b": {
        let childEl = document.createElement(childXel.hasAttribute("is") ? childXel.getAttribute("is") : "div");
        if (childXel.hasAttribute("lang")) childEl.setAttribute("lang", childXel.getAttribute("lang"));
        if (childXel.hasAttribute("class")) childEl.setAttribute("class", childXel.getAttribute("class"));
        if (childXel.hasAttribute("style")) childEl.setAttribute("style", childXel.getAttribute("style"));
        await iterate(childXel, el.appendChild(childEl));
        break;
      }
      case "js":
        await execJs(childXel.textContent);
        break;
      case "separator":
        el.appendChild(document.createElement("hr"));
        break;
      case "pause":
        await pause();
        break;
      case "choose":
        vars._ = await choose(childXel);
        break;
      case "if":
        if (skipElseBlocks = await execJs(childXel.getAttribute("js")))
          await iterate(childXel, el);
        break;
      case "elif":
        if (!skipElseBlocks && (skipElseBlocks = await execJs(childXel.getAttribute("js"))))
          await iterate(childXel, el);
        break;
      case "else":
        if (!skipElseBlocks)
          await iterate(childXel, el);
        break;
      case "case":
        for (let when of childXel.children) {
          if (when.nodeName === "else" ||
            when.nodeName === "when" && await execJs(when.getAttribute("js"))) {
            await iterate(when, el);
            continue childLoop;
          }
        }
        // 没有找到匹配的<when>，抛出错误
        console.error("iterate(): <case>块中所有<when>都不匹配，<case>元素：\n", childXel);
        throw new Error("iterate(): <case>块中所有<when>都不匹配");
      case "call":
      // TODO: Implement expansive modules
    }
  }
}

/**
 * 运行JavaScript代码片段
 * @param {string} js 
 * @returns {*} 运行结果
 */
function execJs(js) {
  try {
    let result = new Function("$", "__js", `with ($) { return eval(__js) }`)(vars, js);
    return result;
  } catch (err) {
    console.error(
      "execJs(): 捕获到错误，运行的代码：\n", js,
      "\nvars数据：\n", vars,
      "\n错误将再次抛出，错误信息应显示在下方。"
    );
    throw err;
  }
}

/** `choose()` 当前互动选择题的序号（做唯一标识用） */
var chooseIndex = 1;
/** 遍历`data.restoreData`的索引 */
var restoreIndex = 0;
/**
 * 显示互动选择
 * @param {Element} xel 选项节点
 * @returns {Promise<number>} 所选选项索引
 */
function choose(xel) {
  /** 已选选项索引 */
  var chosenIndex = -1;
  const choicesName = "choose" + chooseIndex++;

  const chooseEl = mainEl.appendChild(document.createElement("fieldset"));
  chooseEl.className = "choose";

  const choicesEl = chooseEl.appendChild(document.createElement("div"));
  choicesEl.className = "choose-choices";

  var willRestore = restoreIndex < data.restoreData.length;
  if (willRestore) {
    chosenIndex = data.restoreData[restoreIndex++];
    chooseEl.disabled = true;
  }

  [...xel.children].forEach((item, index) => {
    const itemId = `${choicesName}-choice${index}`;
    const itemEl = choicesEl.appendChild(document.createElement("div"));
    const radio = itemEl.appendChild(document.createElement("input"));
    radio.type = "radio";
    radio.name = choicesName;
    radio.id = itemId;
    radio.checked = index === chosenIndex;
    radio.addEventListener("change", function () {
      chosenIndex = index;
      button.disabled = false;
    });

    const label = itemEl.appendChild(importContent(item, "label"));
    label.setAttribute("for", itemId);
    label.htmlFor = itemId;
  });

  if (willRestore) return Promise.resolve(chosenIndex);

  const button = chooseEl.appendChild(document.createElement("button"));
  button.disabled = true;
  button.textContent = "确定";
  return new Promise(resolve => {
    button.onclick = function () {
      chooseEl.disabled = true;
      button.remove();
      data.restoreData.push(chosenIndex);
      restoreIndex++;
      save();
      resolve(chosenIndex);
    }
  });
}

/**
 * 显示“继续”按钮
 * @returns {Promise<void>}
 */
function pause() {
  mainEl.appendChild(document.createElement("hr"));

  if (restoreIndex < data.restoreData.length) {
    restoreIndex++;
    return Promise.resolve();
  }

  const pauseEl = mainEl.appendChild(document.createElement("div"));
  const button = pauseEl.appendChild(document.createElement("button"));
  button.className = "pause";
  button.textContent = "继续";
  return new Promise(resolve => {
    button.onclick = function () {
      pauseEl.remove();
      data.restoreData.push(0);
      restoreIndex++;
      save();
      resolve();
    }
  });
}

/**
 * 保存`data`
 */
function save() {
  try {
    localStorage["soulSandboxLoveWithRichardData"] = JSON.stringify(data);
  } catch (_) { }
}

/**
 * 导入一个元素内的文本
 * @param {Element} xel
 * @param {string} elName
 */
function importContent(xel, elName) {
  var el = document.createElement(elName);
  if (xel.hasAttribute("lang")) el.setAttribute("lang", xel.getAttribute("lang"));
  if (xel.hasAttribute("class")) el.setAttribute("class", xel.getAttribute("class"));
  if (xel.hasAttribute("style")) el.setAttribute("style", xel.getAttribute("style"));
  for (let childXel of xel.childNodes) {
    if (childXel instanceof Text)
      el.appendChild(document.importNode(childXel));
    else if (childXel instanceof Element)
      el.appendChild(importContent(childXel, childXel.getAttribute("is") || "span"));
  }
  return el;
}
