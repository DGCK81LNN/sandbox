const xhr = new XMLHttpRequest();
xhr.open("get", "lwr.xml");
xhr.overrideMimeType("application/xml");
xhr.onload = init;
xhr.send();

/** @type {HTMLElement} */
var outEl;
/** @type {XMLDocument} */
var doc;
var data = {
  /** @type {(-1 | 0 | 1)[]} */
  epidemicRecord: [],
  volumesUnlocked: false,
  restoreVolume: "",
  /** @type {number[]} */
  restoreData: [],
};
/** 内嵌Js的变量 */
var vars = { data };
/** @type {Element} */
var volume;
var restoreIndex = 0;

try {
  Object.assign(data, JSON.parse(localStorage["soulSandboxLoveWithRichardData"]));
} catch (_) { console.log(_) }

function init() {
  outEl = document.getElementById("main");
  doc = xhr.responseXML;
  console.log(doc);

  const resumeButton = document.getElementById("selectvolume-resume");
  const epidemicButton = document.getElementById("selectvolume-epidemic");
  const seniorButton = document.getElementById("selectvolume-senior");
  const sportsButton = document.getElementById("selectvolume-sports");

  resumeButton.parentElement.hidden = !data.restoreVolume;
  resumeButton.onclick = () => { run(data.restoreVolume) };
  epidemicButton.onclick = () => { run('epidemic') };
  seniorButton.disabled = sportsButton.disabled = !data.volumesUnlocked;
  seniorButton.onclick = () => { run('senior') };
  sportsButton.onclick = () => { run('sports') };
}

/**
 * 运行richard剧情文件
 * 
 * @param {string} volumeId 要运行的`volume`的`id`
 * @param {number[]} restoreData 恢复之前进度
 */
async function run(volumeId, restoreData = []) {
  restoreData = restoreData.slice(0);

  try {
    data.restoreVolume = volumeId;
    volume = doc.getElementById(volumeId);

    while (outEl.firstChild) outEl.removeChild(outEl.firstChild);
    outEl.appendChild(document.createElement("h1"))
      .textContent = doc.evaluate("title", volume).iterateNext().textContent;

    await iterate(volume);

    data.restoreVolume = "";
    data.restoreData = [];
    save();
  } catch (err) {
    outEl.appendChild(document.createElement("p"))
      .appendChild(document.createElement("i"))
      .textContent = "运行出错！" + err;
    throw err;
  }
}

/**
 * 运行一个`richard`节点
 * 
 * @param {Element} element 
 */
async function iterate(element) {
  for (let child of element.children) {
    if (child.nodeName === "p") {
      outEl.appendChild(document.createElement("p"))
        .textContent = child.textContent;
    } else if (child.nodeName === "h") {
      outEl.appendChild(document.createElement("h2"))
        .textContent = child.textContent;
    } else if (child.nodeName === "i") {
      outEl.appendChild(document.createElement("p"))
        .appendChild(document.createElement("i"))
        .textContent = child.textContent;
    } else if (child.nodeName === "a") {
      await execJs(child.getAttribute("js"));
    } else if (child.nodeName === "js") {
      await execJs(child.textContent);
    } else if (child.nodeName === "separator") {
      outEl.appendChild(document.createElement("hr"));
    } else if (child.nodeName === "choose") {
      let choices = [];
      for (let el of child.children) {
        if (el.nodeName === "choice") {
          choices.push(el.textContent);
        }
      }
      vars._ = await choose(choices);
    } else if (child.nodeName === "case") {
      for (let el of child.children) {
        if (el.nodeName === "else" ||
          el.nodeName === "when" && await execJs(el.getAttribute("js"))) {
          await iterate(el);
          break;
        }
      }
    }
  }
}

/**
 * 运行JavaScript代码片段
 * 
 * @param {string} js 
 * @returns {*} 运行结果
 */
function execJs(js) {
  try {
    let result = new Function("$", "__js", `with ($) { return eval(__js) }`)(vars, js);
    save();
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
 * 
 * @param {string[]} choices 选项列表
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

  choices.forEach((item, index) => {
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
    const label = itemEl.appendChild(document.createElement("label"));
    label.setAttribute("for", itemId);
    label.htmlFor = itemId;
    label.textContent = item;
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
 * 保存`data`
 */
function save() {
  try {
    localStorage["soulSandboxLoveWithRichardData"] = JSON.stringify(data);
  } catch (_) { }
}
