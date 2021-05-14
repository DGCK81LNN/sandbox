const xhr = new XMLHttpRequest();
xhr.open("get", "lwr.xml");
xhr.overrideMimeType("application/xml");
xhr.onload = init;
xhr.send();

/** @type {HTMLElement} */
var outEl;
/** @type {XMLDocument} */
var doc;
/**
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
/** 内嵌Js的变量“作用域” */
var vars = { data };
/** @type {Element} */
var volume;
var restoreIndex = 0;

try {
  Object.assign(data, JSON.parse(localStorage["soulSandboxLoveWithRichardData"]));
} catch (_) { console.log("恢复数据失败，已忽略\n", _) }

function init() {
  outEl = document.getElementById("main");
  doc = xhr.responseXML;
  console.log(doc);

  const resumeButton = document.getElementById("selectvolume-resume");
  const epidemicButton = document.getElementById("selectvolume-epidemic");
  const seniorButton = document.getElementById("selectvolume-senior");
  const sportsButton = document.getElementById("selectvolume-sports");

  resumeButton.parentElement.hidden = !data.restoreVolume;
  resumeButton.onclick = () => { run(data.restoreVolume, data.restoreData) };
  epidemicButton.onclick = () => { run('epidemic') };
  seniorButton.disabled = sportsButton.disabled = !data.volumesUnlocked;
  seniorButton.onclick = () => { run('senior') };
  sportsButton.onclick = () => { run('sports') };
}

/**
 * 运行richard剧情文件
 * @param {string} volumeId 要运行的`volume`的`id`
 * @param {number[]} restoreData 恢复之前进度
 */
async function run(volumeId, restoreData = []) {
  restoreData = restoreData.slice(0);

  try {
    data.restoreVolume = volumeId;
    data.restoreData = restoreData;
    volume = doc.getElementById(volumeId);

    while (outEl.firstChild) outEl.removeChild(outEl.firstChild);
    const titleEl = doc.evaluate("title", volume).iterateNext();
    outEl.appendChild(importContent(titleEl, "h1"));

    await iterate(volume);

    data.restoreVolume = "";
    data.restoreData = [];
    save();

    location.reload();
  } catch (err) {
    outEl.appendChild(document.createElement("p"))
      .appendChild(document.createElement("i"))
      .textContent = "运行出错！" + err;
    throw err;
  }
}

/**
 * 运行一个`richard`节点
 * @param {Element} element 
 */
async function iterate(element) {
  var skipElseBlocks = false;
  childLoop: for (let child of element.children) {
    switch (child.nodeName) {
      case "p":
        outEl.appendChild(importContent(child, "p"));
        break;
      case "h":
        outEl.appendChild(importContent(child, "h2"));
      case "i":
        outEl.appendChild(document.createElement("p"))
          .appendChild(importContent(child, "i"));
        break;
      case "a":
        await execJs(child.getAttribute("js"));
        break;
      case "js":
        await execJs(child.textContent);
        break;
      case "separator":
        outEl.appendChild(document.createElement("hr"));
        break;
      case "pause":
        await pause();
        break;
      case "choose":
        vars._ = await choose(child);
        break;
      case "if":
        if (skipElseBlocks = await execJs(child.getAttribute("js")))
          await iterate(child);
        break;
      case "elif":
        if (!skipElseBlocks && (skipElseBlocks = await execJs(child.getAttribute("js"))))
          await iterate(child);
        break;
      case "else":
        if (!skipElseBlocks)
          await iterate(child);
        break;
      case "case":
        for (let when of child.children) {
          if (when.nodeName === "else" ||
            when.nodeName === "when" && await execJs(when.getAttribute("js"))) {
            await iterate(when);
            continue childLoop;
          }
        }
        // 没有找到匹配的<when>，抛出错误
        console.error("iterate(): <case>块中所有<when>都不匹配，<case>元素：\n", child);
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
/**
 * 显示互动选择
 * @param {Element} choices 选项列表
 * @returns {Promise<number>} 所选选项索引
 */
function choose(choices) {
  /** 已选选项索引 */
  var chosenIndex = -1;
  const choicesName = "choose" + chooseIndex++;

  const chooseEl = outEl.appendChild(document.createElement("fieldset"));
  chooseEl.className = "choose";

  const choicesEl = chooseEl.appendChild(document.createElement("div"));
  choicesEl.className = "choose-choices";

  var willRestore = restoreIndex < data.restoreData.length;
  if (willRestore) {
    chosenIndex = data.restoreData[restoreIndex++];
    chooseEl.disabled = true;
  }

  [...choices.children].forEach((item, index) => {
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
  outEl.appendChild(document.createElement("hr"));

  if (restoreIndex < data.restoreData.length) {
    restoreIndex++;
    return Promise.resolve();
  }

  const pauseEl = outEl.appendChild(document.createElement("div"));
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
 * @param {Element} origNode
 * @param {string} destNodeName
 */
function importContent(origNode, destNodeName) {
  var destNode = document.createElement(destNodeName);
  if (origNode.hasAttribute("lang")) destNode.setAttribute("lang", origNode.getAttribute("lang"));
  if (origNode.hasAttribute("class")) destNode.setAttribute("class", origNode.getAttribute("class"));
  if (origNode.hasAttribute("style")) destNode.setAttribute("style", origNode.getAttribute("style"));
  for (let child of origNode.childNodes) {
    if (child.nodeType === Node.TEXT_NODE)
      destNode.appendChild(document.importNode(child));
    else
      destNode.appendChild(importContent(child, child.getAttribute("is") || "span"));
  }
  return destNode;
}
