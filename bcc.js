// Blob.prototype.arrayBuffer() polyfill
if (typeof Blob.prototype.arrayBuffer !== "function") {
    Blob.prototype.arrayBuffer = function () {
        return new Promise((resolve, reject) => {
            var fileReader = new FileReader();
            fileReader.onload = () => resolve(fileReader.result);
            fileReader.onerror = () => reject(fileReader.error);
            fileReader.readAsArrayBuffer(this);
        });
    };
}

if (typeof AudioContext !== "function")
    var AudioContext = this.webkitAudioContext;
// AudioContext.prototype.decodeAudioData() (returning Promise) polyfill
if (AudioContext.prototype.decodeAudioData.length > 1) {
    var old = AudioContext.prototype.decodeAudioData;
    AudioContext.prototype.decodeAudioData = function (arrayBuffer, successCallback, errorCallback) {
        if (!successCallback)
            return new Promise((resolve, reject) => old.call(this, arrayBuffer, resolve, reject));
        else
            return old.call(this, arrayBuffer, successCallback, errorCallback);
    }
}

const WAVE_PIXELS_PER_SECOND = 160;
const WAVE_VERTICAL_SCALE = 0.8;

/** @type {HTMLDivElement} */      var videoWrapper;
/** @type {HTMLVideoElement} */    var videoEl;
/** @type {HTMLDivElement} */      var titlesWrapper;
/** @type {HTMLDivElement} */      var titlesEl;
/** @type {HTMLButtonElement} */   var openVideoBtn;
/** @type {HTMLButtonElement} */   var openTitlesBtn;
/** @type {HTMLButtonElement} */   var saveTitlesBtn;
/** @type {HTMLButtonElement} */   var skipBackBtn;
/** @type {HTMLButtonElement} */   var playPauseBtn;
/** @type {HTMLButtonElement} */   var skipFwdBtn;
/** @type {HTMLInputElement} */    var fromEl;
/** @type {HTMLInputElement} */    var toEl;
/** @type {HTMLInputElement} */    var scrollEl;
/** @type {HTMLOListElement} */    var listEl;
/** @type {HTMLCanvasElement} */   var waveEl;
/** @type {HTMLSpanElement} */     var statusEl;
/** @type {HTMLProgressElement} */ var statusProgressEl;
getElementsLNN(); // fills these variables

var saveTitlesEl = document.createElement("a"),
    videoSelectEl = document.createElement("input"),
    titlesSelectEl = document.createElement("input");
videoSelectEl.type = titlesSelectEl.type = "file";

var utf8Encoder = new TextEncoder();
var waveCtx = waveEl.getContext("2d");

/** @type {AudioContext} */ var audioContext;
/** @type {{
 *   font_size: 0.4,
 *   font_color: "#FFFFFF",
 *   background_alpha: 0.5,
 *   background_color: "#9C27B0",
 *   Stroke: "none",
 *   body: {
 *     from: number,
 *     to: number,
 *     content: string,
 *     location: 2,
 *   }[],
 * }} */
var titles = {
    font_size: 0.4,
    font_color: "#FFFFFF",
    background_alpha: 0.5,
    background_color: "#9C27B0",
    Stroke: "none",
    body: []
};
var currentLineIndex = null;
var peakDataMin = null, peakDataMax = null;

function update() {
    requestAnimationFrame(update);

    // 更新字幕
    let s = "";
    let newIndex = null;
    let time = videoEl.currentTime;
    if (titles) {
        for (let i in titles.body) {
            let line = titles.body[i];
            if (time >= line.from && time < line.to) {
                s = line.content;
                newIndex = i;
                break;
            }
        }
    }
    titlesEl.textContent = s;
    if (currentLineIndex !== newIndex) {
        if (currentLineIndex !== null)
            listEl.children[currentLineIndex].className = "";
        if (newIndex !== null) {
            listEl.children[newIndex].className = "current-line";
            listEl.scrollTop = listEl.children[newIndex].offsetTop - 100;
        }
        currentLineIndex = newIndex;
    }

    // 更新波形图
    var width = waveEl.width = waveEl.offsetWidth;
    var height = waveEl.height;
    waveCtx.fillStyle = "#808080";
    waveCtx.fillRect(0, height >> 1, width, 1);
    waveCtx.setTransform(1, 0, 0, -height * WAVE_VERTICAL_SCALE >> 1, 0, height >> 1);
    if (peakDataMin) {
        var i = (0 | videoEl.currentTime * WAVE_PIXELS_PER_SECOND) - (width >> 1); // 当前列在peakData中的索引
        var x = 0; // 当前列在画布中的横坐标
        if (i < 0) x = -i, i = 0;
        for (; x < width; ++i, ++x) {
            waveCtx.fillRect(x, peakDataMin[i], 1, peakDataMax[i] - peakDataMin[i]);
        }
    }
    waveCtx.fillStyle = "#ff0000";
    waveCtx.setTransform(1, 0, 0, 1, 0, 0);
    waveCtx.fillRect((width >> 1) - 1, 0, 3, height);
}

function updateList() {
    [...listEl.children].forEach(c => c.remove());
    titles.body.forEach((line, i) => {
        let itemEl = listEl.appendChild(document.createElement("li"));
        let btn = itemEl.appendChild(document.createElement("button"));
        btn.textContent = line.from;
        btn.addEventListener("click", () => {
            videoEl.currentTime = line.from;
        });
        btn = itemEl.appendChild(document.createElement("button"));
        btn.textContent = line.to;
        btn.addEventListener("click", () => {
            videoEl.currentTime = line.to;
        });
        let itemContentEl = itemEl.appendChild(document.createElement("div"));
        itemContentEl.className = "item-content";
        itemContentEl.textContent = line.content;
        btn = itemEl.appendChild(document.createElement("button"));
        btn.textContent = "删除并重新编辑";
        btn.addEventListener("click", () => {
            fromEl.value = line.from;
            toEl.value = line.to;
            contentEl.value = line.content;
            titles.body.splice(i, 1);
            updateList();
        });
    });
}

async function generatePeakData(blob) {
    statusProgressEl.hidden = false;
    statusProgressEl.removeAttribute("value");
    statusEl.textContent = "读取视频文件...";

    /** @type {Blob} */
    var arrayBuffer = await blob.arrayBuffer();

    statusEl.textContent = "解析音轨数据...";

    audioContext = new AudioContext();
    var audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    statusEl.textContent = "生成波形数据...";

    var channels = [],
        channelCount = audioBuffer.numberOfChannels;
    for (let channelI = 0; channelI < channelCount; ++channelI)
        channels.push(audioBuffer.getChannelData(channelI));

    var peakDataLength = Math.ceil(audioBuffer.duration * WAVE_PIXELS_PER_SECOND),
        delta = Math.ceil(audioBuffer.sampleRate / WAVE_PIXELS_PER_SECOND);
    peakDataMin = new Float32Array(peakDataLength);
    peakDataMax = new Float32Array(peakDataLength);
    // performance.mark("generatePeakData-working");
    statusProgressEl.max = peakDataLength;
    for (let peakDataI = 0, sampleI = 0; peakDataI < peakDataLength; ++peakDataI, sampleI += delta) {
        statusProgressEl.value = peakDataI;
        let min = 0,
            max = 0;
        for (let channelI = 0; channelI < channelCount; ++channelI) {
            let sampleSlice = channels[channelI].slice(sampleI, sampleI + delta);
            min += Math.min(...sampleSlice);
            max += Math.max(...sampleSlice);
        }
        peakDataMin[peakDataI] = min / channelCount;
        peakDataMax[peakDataI] = max / channelCount;
        if (!(peakDataI & 255)) {
            // performance.mark("generatePeakData-break");
            // performance.measure("generatePeakData", "generatePeakData-working", "generatePeakData-break");

            await new Promise(resolve => setTimeout(resolve));
            // performance.mark("generatePeakData-working");
        }
    }
    // performance.mark("generatePeakData-done");
    // performance.measure("generatePeakData", "generatePeakData-working", "generatePeakData-done");

    statusEl.textContent = "就绪";
    statusProgressEl.hidden = true;
};

function openVideo() {
    videoSelectEl.click();
};
function openTitles() {
    titlesSelectEl.click();
    updateList();
};
function saveTitles() {
    let filename = prompt("文件名", "titles.bcc");
    if (!filename) return;
    if (saveTitlesEl.href)
        window.URL.revokeObjectURL(saveTitlesEl.href);
    saveTitlesEl.href = window.URL.createObjectURL(new Blob([utf8Encoder.encode(JSON.stringify(titles)).buffer]));
    saveTitlesEl.download = filename;
    saveTitlesEl.click();
};
function skipBack() {
    videoEl.currentTime -= 2;
};
function playPause() {
    videoEl.paused ? videoEl.play() : videoEl.pause();
};
function skipFwd() {
    videoEl.currentTime += 2;
};
function setFrom() {
    fromEl.value = videoEl.currentTime.toFixed(6);
}
function setTo() {
    toEl.value = videoEl.currentTime.toFixed(6);
}
function insertLine() {
    let from = Number(fromEl.value),
        to = Number(toEl.value);
    if (isNaN(from) || isNaN(to) || from >= to)
        return;
    let content = contentEl.value;
    fromEl.value = toEl.value = contentEl.value = "";
    titles.body.push({
        from,
        to,
        content,
        location: 2,
    });
    titles.body.sort((a, b) => a.from - b.from);
    updateList();
}
function deleteLine() {
    if (currentLineIndex === null)
        return;
    titles.body.splice(currentLineIndex, 1);
    updateList();
}

document.body.addEventListener("keydown", event => {
    let preventDefault = true;
    let doDisableArrowKeys =
        event.target instanceof HTMLInputElement && ![
            "button", "checkbox", "color", "file", "hidden", "image", "radio", "reset", "submit"
        ].includes(event.target.type.toLowerCase()) ||
        event.target instanceof HTMLTextAreaElement;
    if (event.target === document.body && event.key === " ")
        playPause();
    else if (!doDisableArrowKeys && event.key === "ArrowLeft")
        skipBack();
    else if (!doDisableArrowKeys && event.key === "ArrowRight")
        skipFwd();
    else if (event.altKey && event.shiftKey && event.key === "KeyO")
        openTitles();
    else if (event.altKey && event.shiftKey && event.key === "KeyS")
        saveTitles();
    else if (event.ctrlKey !== event.shiftKey && event.key === "Enter")
        insertLine();
    else preventDefault = false;
    if (preventDefault) event.preventDefault();
})
videoEl.addEventListener("durationchange", () => {
    scrollEl.max = videoEl.duration;
});
videoEl.addEventListener("timeupdate", () => {
    let time = videoEl.currentTime;
    scrollEl.value = time;
    currTimeEl.textContent =
        time >= 3600 ?
            `${Math.floor(time / 3600)}:${String(Math.floor(time / 60) % 60).padStart(2, "0")}:${String(Math.floor(time % 60)).padStart(2, "0")}.${String(Math.floor(time % 1 * 1000)).padStart(3, "0")}` :
            `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, "0")}.${String(Math.floor(time % 1 * 1000)).padStart(3, "0")}`;
});
videoEl.addEventListener("playing", () => {
    scrollEl.disabled = true;
});
videoEl.addEventListener("pause", () => {
    scrollEl.disabled = false;
});
videoEl.addEventListener("click", () => {
    playPause();
});
videoSelectEl.addEventListener("change", () => {
    if (!videoSelectEl.files[0]) return;
    videoEl.src && window.URL.revokeObjectURL(videoEl.src);
    videoEl.src = window.URL.createObjectURL(videoSelectEl.files[0]);
    peakDataMin = peakDataMax = null;
    generatePeakData(videoSelectEl.files[0]);
});
titlesSelectEl.addEventListener("change", () => {
    if (!titlesSelectEl.files[0]) return;
    let reader = new FileReader();
    reader.addEventListener("load", () => {
        titles = JSON.parse(reader.result);
        updateList();
    });
    reader.readAsText(titlesSelectEl.files[0]);
});
scrollEl.addEventListener("change", () => {
    videoEl.currentTime = Number(scrollEl.value);
});
{
    var waveScrolling = false,
        waveScrollInitialPos = NaN,
        waveScrollInitialValue = NaN;
    let mouseDown = event => {
        videoEl.pause();
        waveScrolling = true;
        waveScrollInitialPos = event.pageX;
        waveScrollInitialValue = videoEl.currentTime;
        event.preventDefault();
    };
    let mouseMove = event => {
        if (!waveScrolling) return;
        var time = waveScrollInitialValue + (waveScrollInitialPos - event.pageX) / WAVE_PIXELS_PER_SECOND;
        if (time < 0) time = 0;
        if (time > videoEl.duration) time = videoEl.duration;
        videoEl.currentTime = time;
        event.preventDefault();
    }
    let mouseUp = event => {
        waveScrolling = false;
        event.preventDefault();
    }
    waveEl.addEventListener("mousedown", mouseDown);
    waveEl.addEventListener("mousemove", mouseMove);
    window.addEventListener("mouseup", mouseUp);
    waveEl.addEventListener("touchstart", mouseDown);
    waveEl.addEventListener("touchmove", mouseMove);
    window.addEventListener("touchend", mouseUp);
    waveEl.addEventListener("touchcancel", () => {
        videoEl.currentTime = waveScrollInitialValue;
    });
}

update();
