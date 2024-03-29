// ==UserScript==
// @name         无影坦克LNN版贴吧解码脚本
// @author       DGCK81LNN
// @homepage     https://dgck81lnn.github.io/sandbox/wytk_optimize/
// @version      1.2.1
// @updateURL    https://dgck81lnn.github.io/sandbox/wytk_optimize/tieba_tank_decoder.user.js
// @match        http*://tieba.baidu.com/p/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

/*
 * 启用本脚本，打开一个贴吧主题帖，鼠标悬浮在图片上会出现“解码无影坦克”按钮。
 *
 * 解码成功后，里图会出现在坦克图原来的位置。鼠标悬浮在里图上会显示里图的文件名。
 *
 * 在控制台运行此代码可解码当前页上的所有图片：
 *
 *     LNNTk.decodeAll()
 *
 * 也可以使用 LNNTk.autoShowDecodeResult 来设置解码完成后是否自动显示里图：
 *
 *     LNNTk.autoShowDecodeResult = false // 不自动显示里图
 *     LNNTk.autoShowDecodeResult = true // 自动显示里图（默认）
 */

(function () {
  'use strict';

  if (typeof unsafeWindow !== "object") var unsafeWindow = window;

  var img = new Image();
  var cvs = document.createElement("canvas");
  var cxt = cvs.getContext("2d");
  var textDecoder = new TextDecoder();
  const MAX_METADATA_SIZE = 4096;

  /**
   * 坦克现形
   * @param {Blob} imgBlob
   * @returns {Promise<File>}
   */
  async function decode(imgBlob) {
    // 读取图片
    await new Promise((res, rej) => {
      img.onload = () => res(img);
      img.onerror = () => rej(new Error("读取图片失败"));
      img.src = window.URL.createObjectURL(imgBlob);
    });
    var width = cvs.width = img.width, height = cvs.height = img.height; // todo: caniuse HTMLImageElement.width, .height
    cxt.drawImage(img, 0, 0);
    var imgdata = cxt.getImageData(0, 0, width, height);

    // 识别坦克
    var mode = imgdata.data[2] & 7;
    if ((imgdata.data[0] & 7) !== 0 || (imgdata.data[1] & 7) !== 3 || mode === 0)
      throw new Error("无法识别坦克");

    // 读取坦克元数据
    var pixelCount = width * height;
    var bitBuffer = new BitQueue32();
    var i = 1, j = 0, bytes = new Uint8Array(MAX_METADATA_SIZE);
    while (i < pixelCount) {
      while (bitBuffer.length < 8) {
        bitBuffer.enqueue(imgdata.data[i << 2], mode);
        bitBuffer.enqueue(imgdata.data[i << 2 | 1], mode);
        bitBuffer.enqueue(imgdata.data[i << 2 | 2], mode);
        ++i;
      }
      let byte = bitBuffer.dequeue();
      if (byte === 0) break;
      bytes[j++] = byte;
      if (j >= MAX_METADATA_SIZE) throw new Error(`元数据过长（超过${formatSize(MAX_METADATA_SIZE)}）`);
    }
    var fileMetadata = textDecoder.decode(new Uint8Array(bytes.slice(0, j))).split('\x01');
    var [fileSize, fileName, fileType] = fileMetadata;
    console.log({ fileSize, fileName, fileType });
    fileSize = Number(fileSize);
    if (
      fileMetadata.length < 3 ||
      isNaN(fileSize) ||
      (0 | fileSize) !== fileSize || // 判断是否为32位整数
      fileSize < 0
    ) throw new Error("坦克元数据无效");

    // 读取里图
    bytes = new Uint8Array(fileSize);
    j = 0;
    while (i < pixelCount && j < fileSize) {
      while (bitBuffer.length < 8) {
        bitBuffer.enqueue(imgdata.data[i << 2], mode);
        bitBuffer.enqueue(imgdata.data[i << 2 | 1], mode);
        bitBuffer.enqueue(imgdata.data[i << 2 | 2], mode);
        ++i;
      }
      let byte = bitBuffer.dequeue();
      bytes[j++] = byte;
    }

    // 检查常见的错误MIME类型
    if (fileName.endsWith(".mp4")) fileType = "video/mp4";
    if (fileName.endsWith(".webm")) fileType = "video/webm";
    if (fileName.endsWith(".zip")) fileType = "application/zip";
    if (fileName.endsWith(".txt")) fileType = "text/plain";

    return new File([bytes], fileName, { type: fileType });
  }

  /**
   * 格式化文件大小
   *
   * 单位最高只能到GB
   * @param {number} bytes
   * @returns string
   */
  function formatSize(bytes) {
    if (bytes < 1e+3) return bytes + "B"
    if (bytes < 1e+6) return (bytes / 0x400).toFixed(2) + "KB"
    if (bytes < 1e+9) return (bytes / 0x100000).toFixed(2) + "MB"
    return (bytes / 0x40000000).toFixed(2) + "GB"
  }

  /**
   * 比特队列
   */
  class BitQueue32 {
    constructor() {
      this.value = 0;
      this.length = 0;
    }
    /**
     * 入队列指定长度的比特串；最高位先进
     * @param {number} value 入队列的数据；只有低`len`位有效
     * @param {number} len 入队列数据的比特数，默认为8；只有低5位有效
     */
    enqueue(value, len = 8) {
      len &= 31, value &= ~(-1 << len);
      if (this.length + len > 32) throw new RangeError("BitQueue32.prototype.enqueue(): Overflow");
      this.length += len;
      this.value <<= len, this.value |= value;
    }
    /**
     * 出队列指定长度的比特串；最高位先出
     * @param {number} len 出队列数据的比特数，默认为8；只有低5位有效
     * @returns 出队列的数据
     */
    dequeue(len = 8) {
      len &= 31;
      var newLength = this.length - len;
      var result;
      if (newLength < 0) {
        result = this.value << (-newLength);
        this.value = 0;
        this.length = 0;
      } else {
        result = this.value >>> newLength;
        this.value &= ~(-1 << newLength);
        this.length = newLength;
      }
      return result;
    }
  }

  var style = document.head.appendChild(document.createElement("style"));
  style.textContent = `
.lnntk {
position: relative;
}
.lnntk-hover {
position: absolute;
top: 0;
right: 0;
transition: opacity 0.25s;
}
.lnntk:not(:hover) .lnntk-hover {
opacity: 0;
}
@media (hover: none) {
.lnntk:not(:hover) .lnntk-hover {
opacity: 0.3;
}
}
.lnntk-hover button {
padding: 0.5rem;
border: 1px solid;
}
.lnntk-result {
max-width: 100%;
}`;

  var decodeFuncs = new Set();

  setInterval(() => {
    [...document.querySelectorAll(".BDE_Image:not(.lnntk-orig)")].forEach(origEl => {
      var wrapperEl = document.createElement("div");
      wrapperEl.className = "lnntk";
      origEl.parentNode.replaceChild(wrapperEl, origEl);
      origEl.className = "lnntk-orig";
      var hoverEl = wrapperEl.appendChild(document.createElement("div"));
      hoverEl.className = "lnntk-hover";
      var decodeButton = hoverEl.appendChild(document.createElement("button"));
      decodeButton.textContent = "解码无影坦克";
      wrapperEl.appendChild(origEl);

      var origUrl = origEl.src.replace("http://", "https://").replace(/w%3D[^\/]+\/sign=[^\/]+/, "pic/item");
      const decodeFunc = async () => {
        try {
          decodeButton.textContent = "解码中……";

          var origBlob = await (await unsafeWindow.fetch(origUrl)).blob();
          var resultBlob = await decode(origBlob);
          console.log("lnntk decode result: ", resultBlob);
          var resultUrl = window.URL.createObjectURL(resultBlob);
          var origDownloadedUrl = window.URL.createObjectURL(origBlob);

          hoverEl.textContent = "";
          var saveFileButton = hoverEl.appendChild(document.createElement("button"));
          saveFileButton.textContent = `保存里图 (${formatSize(resultBlob.size)})`;
          saveFileButton.onclick = () => {
            var a = document.createElement("a");
            a.download = resultBlob.name;
            a.href = resultUrl;
            a.click();
          };
          var saveImgButton = hoverEl.appendChild(document.createElement("button"));
          saveImgButton.textContent = `保存原坦克图 (${formatSize(origBlob.size)})`;
          saveImgButton.onclick = () => {
            var a = document.createElement("a");
            a.download = resultBlob.name + "_TK.png";
            a.href = origDownloadedUrl;
            a.click();
          };

          var resultEl;
          if (resultBlob.type.startsWith("video/")) {
            resultEl = document.createElement("video");
            resultEl.controls = true;
          }
          else {
            resultEl = document.createElement("img");
          }
          resultEl.alt = resultEl.title = `${resultBlob.name} (MIME类型：${resultBlob.type}) — 点击显示表图`;
          resultEl.className = "lnntk-result";
          resultEl.src = resultUrl;
          resultEl.onclick = () => { resultEl.hidden = true; origEl.hidden = false };
          origEl = document.createElement("img");
          origEl.title = `${resultBlob.name} (MIME类型：${resultBlob.type}) — 点击显示里图`;
          origEl.className = "lnntk-result";
          origEl.src = origDownloadedUrl;
          origEl.onclick = () => { resultEl.hidden = false; origEl.hidden = true };
          (LNNTk.autoShowDecodeResult ? origEl : resultEl).hidden = true;
          wrapperEl.textContent = "";
          wrapperEl.appendChild(hoverEl);
          wrapperEl.appendChild(resultEl);
          wrapperEl.appendChild(origEl);

          decodeFuncs.delete(decodeFunc);
        }
        catch (error) {
          decodeButton.textContent = String(error);
          console.error(error);
        }
      };

      decodeButton.onclick = () => { decodeFunc(); };
      decodeFuncs.add(decodeFunc);
    });
  }, 3000);

  var LNNTk = unsafeWindow.LNNTk = {
    async decodeAll() {
      for (let decodeFunc of decodeFuncs.values()) {
        await decodeFunc();
      }
    },
    get autoShowDecodeResult() {
      return GM_getValue("autoShowDecodeResult", true);
    },
    set autoShowDecodeResult(value) {
      GM_setValue("autoShowDecodeResult", Boolean(value));
    },
  };
  GM_setValue("autoShowDecodeResult", GM_getValue("autoShowDecodeResult", true));
})();
