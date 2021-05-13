const xhr = new XMLHttpRequest();
xhr.open("get", "lwr.xml");
xhr.overrideMimeType("application/xml");
xhr.onload = main;
xhr.send();

/** @type {HTMLElement} */
var el;
/** @type {XMLDocument} */
var doc;
var data = {
  loveBonus: 100,
  volumesUnlocked: false,
  volumeId: null,
  /** @type {number[]} */
  restoreData: [],
  /** @type {(80 | 100 | 120)[]} */
  epidemicRecord: [],
};
/** 内嵌Js的变量 */
var vars = { data };

function main() {
  el = document.getElementById("main");
  doc = xhr.responseXML;
  console.log(doc);

  run("epidemic");
}

/**
 * 运行richard剧情文件
 * 
 * @param {string} volumeId 要运行的`volume`的`id`
 */
async function run(volumeId) {
  try {
    data.volumeId = volumeId;
    const volume = doc.getElementById(volumeId);
    el.appendChild(document.createElement("h1"))
      .textContent = doc.evaluate("title", volume).iterateNext().textContent;

    /** `choose()` 当前互动选择题的序号（做唯一标识用） */
    var chooseIndex = 1;

    await iterate(volume);
  } catch (err) {
    el.appendChild(document.createElement("p"))
      .appendChild(document.createElement("i"))
      .textContent = "运行出错！" + err;
    throw err;
  }

  /**
   * 运行一个`richard`节点
   * 
   * @param {Element} element 
   */
  async function iterate(element) {
    for (let child of element.children) {
      if (child.nodeName === "p") {
        el.appendChild(document.createElement("p"))
          .textContent = child.textContent;
      } else if (child.nodeName === "i") {
        el.appendChild(document.createElement("p"))
          .appendChild(document.createElement("i"))
          .textContent = child.textContent;
      } else if (child.nodeName === "a") {
        await execJs(child.getAttribute("js"));
      } else if (child.nodeName === "js") {
        await execJs(child.textContent);
      } else if (child.nodeName === "separator") {
        el.appendChild(document.createElement("hr"));
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
      return new Function("$", "__js", `with ($) { return eval(__js) }`)(vars, js);
    } catch (err) {
      console.error(
        "execJs(): 捕获到错误，运行的代码：\n", js,
        "\nvars数据：\n", vars,
        "\n错误将再次抛出，错误信息应显示在下方。"
      );
      throw err;
    }
  }

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

    const chooseEl = el.appendChild(document.createElement("fieldset"));
    chooseEl.className = "choose";

    const choicesEl = chooseEl.appendChild(document.createElement("div"));
    choicesEl.className = "choose-choices";

    choices.forEach((item, index) => {
      const itemId = `${choicesName}-choice${index}`;
      const itemEl = choicesEl.appendChild(document.createElement("div"));
      const radio = itemEl.appendChild(document.createElement("input"));
      radio.type = "radio";
      radio.name = choicesName;
      radio.id = itemId;
      radio.addEventListener("change", function () {
        chosenIndex = index;
        button.disabled = false;
      });
      const label = itemEl.appendChild(document.createElement("label"));
      label.setAttribute("for", itemId);
      label.htmlFor = itemId;
      label.textContent = item;
    });

    const button = chooseEl.appendChild(document.createElement("button"));
    button.disabled = true;
    button.textContent = "确定";
    return new Promise(resolve => {
      button.onclick = function () {
        chooseEl.disabled = true;
        button.remove();
        resolve(chosenIndex);
      }
    });
  }
}
