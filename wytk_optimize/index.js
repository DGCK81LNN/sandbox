/**
 * @typedef {{
 *   image: File,
 *   imageURL: string,
 *   result?: File | Error,
 *   resultURL?: string,
 * }} DecoderTask
 */

window.vm = new Vue({
  el: "#app",
  data: {
    isDraggingIntoDecoder: false,
    /** @type {DecoderTask[]} */
    decoder: []
  },
  methods: {
    decoderOnDragEnter() {
      vm.isDraggingIntoDecoder = true;
    },
    /** @param {DragEvent} event */
    decoderOnDragLeave(event) {
      if (event.target.classList.contains("can-drag-into"))
        vm.isDraggingIntoDecoder = false;
    },
    /** @param {DragEvent} event */
    decoderOnDragOver(event) {
      event.preventDefault();
    },
    /** @param {DragEvent} event */
    decoderOnDrop(event) {
      vm.isDraggingIntoDecoder = false;
      event.preventDefault();
      var foundAnyImage = false;
      [...event.dataTransfer.items].forEach(item => {
        if (item.kind != "file") return;
        if (!item.type.startsWith("image/")) return;
        foundAnyImage = true;
        vm.decoderStartTask(item.getAsFile());
      });
      if (!foundAnyImage) { // 如果拖拽的项目中没有图片
        alert("没有找到图片，请下载图片再拖拽解码");
      }
    },
    decoderSelectFiles() {
      var fileSelector = document.createElement("input");
      fileSelector.type = "file";
      fileSelector.multiple = true;
      fileSelector.onchange = () => {
        fileSelector.onchange = null;
        [...fileSelector.files].forEach(file => {
        if (!file.type.startsWith("image/")) return;
        vm.decoderStartTask(file);
      })
      };
      fileSelector.click();
    },
    /** @param {Blob} imageBlob */
    decoderStartTask(imageBlob) {
      /** @type {DecoderTask} */
      var task = {
        image: imageBlob,
        imageURL: window.URL.createObjectURL(imageBlob),
        result: null,
        resultURL: null,
      };
      vm.decoder.push(task);
      decode(imageBlob).then(result => {
        task.result = result;
        task.resultURL = window.URL.createObjectURL(result);
        vm.$forceUpdate();
      }, error => {
        task.result = error;
        console.error(error);
        vm.$forceUpdate();
      });
    },
    decoderSaveResult(index) {
      /** @type {DecoderTask} */
      var task = vm.decoder[index];
      window.URL.revokeObjectURL(task.imageURL);
      if (!(task.result instanceof Error)) {
        let a = document.createElement("a");
        a.download = task.result.name;
        a.href = task.resultURL;
        a.click();
        setTimeout(() => {
          window.URL.revokeObjectURL(task.resultURL);
        }, 60000);
      }
      else window.URL.revokeObjectURL(task.resultURL);
      vm.decoder.splice(index, 1);
    },
    decoderDeleteTask(index) {
      /** @type {DecoderTask} */
      var task = vm.decoder[index];
      window.URL.revokeObjectURL(task.imageURL);
      if (task.resultURL) window.URL.revokeObjectURL(task.resultURL);
      vm.decoder.splice(index, 1);
    },
    decoderSaveAll() {
      while (vm.decoder.length) vm.decoderSaveResult(0);
    },
    async decoderDeleteAll() {
      if (await this.$bvModal.msgBoxConfirm("确定删除所有已解码的文件吗？", { okVariant: "danger" }))
        while (vm.decoder.length) vm.decoderDeleteTask(0);
    },
    formatSize,
    isError(thing) {
      return thing instanceof Error;
    },
  }
});

const TAG_IMAGE_CALLBACK = (cxt, width) => {
  cxt.font = "16px Arial";
  cxt.textBaseline = "middle";
  cxt.fillStyle = "rgba(48, 160, 144, 0.75)";
  cxt.fillRect(0, 0, cxt.measureText(ENCODE_TAG).width + 8, 28);
  cxt.fillStyle = "#ffffff";
  cxt.fillText(ENCODE_TAG, 4, 14, width - 8);
};

var textDecoder = new TextDecoder(), textEncoder = new TextEncoder();
const MAX_METADATA_SIZE = 4096;
const REST_SPACE_FILL = textEncoder.encode(" dgck81lnn.github.io");
/** @type {{ [fileExtension: string]: string }} */
const MIME_CORRECT = [
  { extension: ".mp4", mime: "video/mp4" },
  { extension: ".webm", mime: "video/webm" },
  { extension: ".zip", mime: "application/zip" },
  { extension: ".txt", mime: "text/plain" },
];

/**
 * 坦克现形
 * @param {Blob | string} img 坦克图Blob或图片URL（不能跨域）
 * @returns {Promise<File>}
 */
async function decode(img) {
  var imgEl = new Image();
  var cvs = document.createElement("canvas");
  var cxt = cvs.getContext("2d");

  // 读取图片
  // performance.mark("decoder read image start");
  await new Promise((res, rej) => {
    imgEl.onload = () => res(imgEl);
    imgEl.onerror = () => rej(new Error("读取图片失败"));
    imgEl.src = typeof img === "string" ? img : window.URL.createObjectURL(img);
  });
  var width = cvs.width = imgEl.naturalWidth, height = cvs.height = imgEl.naturalHeight;
  cxt.drawImage(imgEl, 0, 0);
  var imgdata = cxt.getImageData(0, 0, width, height);
  // performance.measure("decoder read image", "decoder read image start");

  // 识别坦克
  // performance.mark("decoder identify tank start");
  var mode = imgdata.data[2] & 7;
  if ((imgdata.data[0] & 7) !== 0 || (imgdata.data[1] & 7) !== 3 || mode === 0)
    throw new Error("无法识别坦克");
  // performance.measure("decoder identify tank", "decoder identify tank start");

  // 读取坦克元数据
  // performance.mark("decoder read metadata start");
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
    var byte = bitBuffer.dequeue();
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
  // performance.measure("decoder read metadata", "decoder read metadata start");

  // 读取里图
  // performance.mark("decoder read file start");
  bytes = new Uint8Array(fileSize);
  j = 0;
  while (i < pixelCount && j < fileSize) {
    while (bitBuffer.length < 8) {
      bitBuffer.enqueue(imgdata.data[i << 2], mode);
      bitBuffer.enqueue(imgdata.data[i << 2 | 1], mode);
      bitBuffer.enqueue(imgdata.data[i << 2 | 2], mode);
      ++i;
    }
    var byte = bitBuffer.dequeue();
    bytes[j++] = byte;
  }
  // performance.measure("decoder read file", "decoder read file start");

  // 纠正MIME类型
  MIME_CORRECT.some(({ mime, extension }) => {
    if (fileName.endsWith(extension)) {
      fileType = mime;
      return true;
    }
  });

  return new File([bytes], fileName, { type: fileType });
}

/**
 * 制作坦克
 * @param {Blob | string} img 表图Blob或URL（不能跨域）
 * @param {File} fileBlob 里图
 * @param {1 | 2 | 3 | 4 | 5} mode 隐写深度（aka 表图压缩度）
 * @param {(cxt: CanvasRenderingContext2D, width: number, height: number) => void} [drawTagCallback=] 绘制备注回调
 * @returns {Promise<Blob>}
 */
async function encode(img, fileBlob, mode, drawTagCallback) {
  var imgEl = new Image();
  var cvs = document.createElement("canvas");
  var cxt = cvs.getContext("2d");

  // 读取里图
  // performance.mark("encoder read file start");
  var fileArrayBuffer;
  if (typeof Blob.prototype.arrayBuffer === "function")
    fileArrayBuffer = await fileBlob.arrayBuffer();
  else fileArrayBuffer = await new Promise((res, rej) => {
    var reader = new FileReader();
    reader.onload = () => res(reader.result);
    reader.onerror = () => rej("读取里图失败");
    reader.readAsArrayBuffer();
  });
  var fileBytes = new Uint8Array(fileArrayBuffer);
  var fileSize = fileBytes.length;
  // performance.measure("encoder read file", "encoder read file start");

  // 编码元数据
  // performance.mark("encoder encode metadata start");
  var fileMetadata = [fileSize, fileBlob.name, fileBlob.type];
  var fileMetadataBytes = textEncoder.encode(fileMetadata.join('\x01'));
  var fileMetadataSize = fileMetadataBytes.length;
  // performance.measure("encoder encode metadata", "encoder encode metadata start");

  // 读取表图
  // performance.mark("encoder read image start");
  await new Promise((res, rej) => {
    imgEl.onload = () => res();
    imgEl.onerror = () => rej(new Error("读取表图失败"));
    imgEl.src = typeof img === "string" ? img : window.URL.createObjectURL(img);
  });
  // performance.measure("encoder read image", "encoder read image start");

  // 缩放表图到合适的大小
  // performance.mark("encoder scale image start");
  var encodeRate = mode * 0.375; // 3 / 8
  var fileAndMetadataSize = fileMetadataSize + 1 + fileSize;
  var imgZoom = Math.sqrt(fileAndMetadataSize / encodeRate / (imgEl.width * imgEl.height - 1));
  var width = Math.ceil(imgEl.width * imgZoom), height = Math.ceil(imgEl.height * imgZoom);
  cvs.width = width, cvs.height = height;
  cxt.drawImage(imgEl, 0, 0, width, height);
  // performance.measure("encoder scale image", "encoder scale image start");

  // 调用绘制备注回调
  if (drawTagCallback) drawTagCallback(cxt, width, height);
  var imgdata = cxt.getImageData(0, 0, width, height);

  // 组合数据序列
  // performance.mark("encoder combine data seq start");
  var pixelCount = width * height;
  var bytes = new Uint8Array(Math.ceil((pixelCount - 1) * encodeRate));
  bytes.set(fileMetadataBytes, 0);
  bytes.set(fileBytes, fileMetadataBytes.length + 1);
  fileBytes = fileMetadataBytes = null; // GC ;)
  // 然后把剩下的空白部分随便填满
  for (let i = 0, l = bytes.length - fileAndMetadataSize; i < l; ++i)
    bytes[fileAndMetadataSize + i] = REST_SPACE_FILL[i % REST_SPACE_FILL.length];
  // performance.measure("encoder combine data seq", "encoder combine data seq start");

  // 写入识别信息
  closer(imgdata.data, 0, 3, 0);
  closer(imgdata.data, 1, 3, 3);
  closer(imgdata.data, 2, 3, mode);

  // 写入数据
  // performance.mark("encoder write data start");
  var bitBuffer = new BitQueue32();
  for (let i = 1, j = 0; i < pixelCount; ++i) {
    while (bitBuffer.length < 3 * mode) bitBuffer.enqueue(bytes[j++]);
    closer(imgdata.data, i << 2, mode, bitBuffer.dequeue(mode));
    closer(imgdata.data, i << 2 | 1, mode, bitBuffer.dequeue(mode));
    closer(imgdata.data, i << 2 | 2, mode, bitBuffer.dequeue(mode));
  }
  // performance.measure("encoder write data", "encoder write data start");

  cvs.width += 0; // 清空画布
  cxt.putImageData(imgdata, 0, 0);
  return await new Promise(res => {
    cvs.toBlob(res, "image/png");
  });
}

/**
 * 快捷方式：在数组`array`的索引`index`的最低`len`位写入数据`value`
 * @param {ArrayLike<number>} array 
 * @param {number} index 
 * @param {number} len 
 * @param {number} value 
 */
function closer(array, index, len, value) {
  array[index] &= -1 << len;
  array[index] |= value & ~(-1 << len);
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
