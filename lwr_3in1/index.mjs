import * as Volumes from "./volumes.mjs"

const el = document.getElementById("main");

var data = {
    loveBonus: 1,
};

/**
 * 创建<p>元素
 * @param {string} html
 */
function p(html) {
    el.appendChild(document.createElement("p")).innerHTML= html;
}

var choicesI = 1;
function choose(...choices) {
    var chosenIndex = undefined;
    const choicesName = "choose" + choicesI++;
    const choicesEl = el.appendChild(document.createElement("fieldset"));
    choicesEl.setAttribute("role", "radiogroup");
    choicesEl.className = "choose";
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
        label.htmlFor = itemId;
        label.textContent = item;
    });
    const button = choicesEl.appendChild(document.createElement("button"));
    button.disabled = true;
    button.textContent = "确定";
    return new Promise(resolve => {
        button.onclick = function () {
            choicesEl.disabled = true;
            resolve(chosenIndex);
        }
    });
}

Volumes.epidemic({ data, el, p, choose })
