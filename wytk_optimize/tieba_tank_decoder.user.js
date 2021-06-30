// ==UserScript==
// @name         无影坦克LNN版贴吧解码脚本
// @namespace    https://dgck81lnn.github.io/sandbox/wytk_optimize/
// @version      1.0.1
// @author       DGCK81LNN
// @match        http*://tieba.baidu.com/p/*
// ==/UserScript==

(function() {
  'use strict';

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
        bitBuffer.enqueue(imgdata.data[i << 2    ], mode);
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

  [...document.querySelectorAll(".BDE_Image")].forEach(img=>{
    var url = img.src.replace("http://", "https://").replace(/w%3D[^\/]+\/sign=[^\/]+/, "pic/item");
    var btnContainer = img.parentNode.insertBefore(document.createElement("div"), img);
    var btn = btnContainer.appendChild(document.createElement("button"));
    btn.textContent = "解码无影坦克";
    btn.style.cssText = "font-size: 1.5rem; padding: 0.5rem; border: 1px solid";
    btn.onclick = async () => {
      try {
        var next = btn.parentElement.nextElementSibling;
        if (!img.isConnected) img = next.querySelector(".BDE_Image");
        var imgResponse = await unsafeWindow.fetch(url);
        var imgBlob = await imgResponse.blob();
        var result = await decode(imgBlob);
        console.log(result);
        var el;
        if (result.type.startsWith("video/")) {
          el = document.createElement("video");
          el.controls = true;
        }
        else {
          el = document.createElement("img");
        }
        el.alt = el.title = `${result.name} (MIME类型：${result.type})`;
        el.style.cssText = "max-width: 100%";
        el.src = window.URL.createObjectURL(result);
        next.parentNode.replaceChild(el, next);
        btn.textContent = `保存 ${result.name} (${formatSize(result.size)})`;
        btn.onclick = () => {
          var a = document.createElement("a");
          a.download = result.name;
          a.href = el.src;
          a.click();
        };
        var btn2 = btnContainer.appendChild(document.createElement("button"));
        btn2.textContent = `保存坦克图原图 (${formatSize(imgBlob.size)})`;
        btn2.style.cssText = "font-size: 1.5rem; padding: 0.5rem; border: 1px solid";
        btn2.onclick = () => {
          var a = document.createElement("a");
          a.download = result.name;
          a.href = URL.createObjectURL(imgBlob);
          a.click();
        };
      } catch(error) {
        btn.textContent = String(error);
        console.error(error);
      }
    };
  });
})();
