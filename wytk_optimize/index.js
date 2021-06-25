const ENCODE_TAG = "TK-LNN";

var vm = new Vue({
  el: "#app",
  data: {
    encodeData: {
      image: null,
      file: null,
      depth: 4,
      result: null,
    },
    decodeData: {
      image: null,
      msgType: "",
      msg: null,
      result: null,
      resultName: null,
      resultType: null,
      resultSize: null,
      resultIsImage: undefined,
    },
  },
  methods: {
    encode() {
      encode(vm.encodeData.image, vm.encodeData.file, vm.encodeData.depth, (cxt, width, _height) => {
        cxt.font = "16px Arial";
        cxt.textBaseline = "middle";
        cxt.fillStyle = "rgba(48, 160, 144, 0.75)";
        cxt.fillRect(0, 0, cxt.measureText(ENCODE_TAG).width + 8, 28);
        cxt.fillStyle = "#ffffff";
        cxt.fillText(ENCODE_TAG, 4, 14, width - 8);
      }).then(blob => {
        if (vm.encodeData.result) window.URL.revokeObjectURL(vm.encode.result);
        vm.encodeData.result = window.URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.setAttribute("download", vm.decodeData.resultName);
        a.setAttribute("href", vm.encodeData.result);
        a.click();
      });
    },
    decode() {
      if (vm.decodeData.result) window.URL.revokeObjectURL(vm.decodeData.result);
      vm.decodeData.error = vm.decodeData.result = null;
      decode(vm.decodeData.image).then(result => {
        vm.decodeData.msgType = "";
        vm.decodeData.result = window.URL.createObjectURL(result);
        vm.decodeData.resultName = result.name;
        vm.decodeData.resultType = result.type;
        vm.decodeData.resultSize = result.size;
        vm.decodeData.resultIsImage = result.type.startsWith("image/");
      }, error => {
        vm.decodeData.msgType = "error";
        vm.decodeData.msg = String(error);
        console.error(error);
      });
    },
    saveDecoded() {
      var a = document.createElement("a");
      a.setAttribute("download", vm.decodeData.resultName);
      a.setAttribute("href", vm.decodeData.result);
      a.click();
    },
    formatSize,
  }
});

var img = new Image();
var cvs = document.createElement("canvas");
var cxt = cvs.getContext("2d");
var textDecoder = new TextDecoder(), textEncoder = new TextEncoder();
const MAX_METADATA_SIZE = 4096;
const REST_SPACE_FILL = textEncoder.encode(" dgck81lnn.github.io");

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
  var width = cvs.width = img.width, height = cvs.height = img.height;
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
    var byte = bitBuffer.dequeue();
    bytes[j++] = byte;
  }

  return new File([bytes], fileName, { type: fileType });
}

/**
 * 制作坦克
 * @param {Blob} imgBlob 表图
 * @param {File} fileBlob 里图
 * @param {1 | 2 | 3 | 4 | 5} mode 隐写深度（aka 表图压缩度）
 * @param {(cxt: CanvasRenderingContext2D, width: number, height: number) => void} [drawTagCallback=] 绘制备注回调
 * @returns {Promise<Blob>}
 */
async function encode(imgBlob, fileBlob, mode, drawTagCallback) {
  // 读取文件
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

  // 编码元数据
  var fileMetadata = [fileSize, fileBlob.name, fileBlob.type];
  var fileMetadataBytes = textEncoder.encode(fileMetadata.join('\x01'));
  var fileMetadataSize = fileMetadataBytes.length;

  // 读取图片
  await new Promise((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("读取表图失败"));
    img.src = window.URL.createObjectURL(imgBlob);
  });

  // 缩放表图到合适的大小
  var encodeRate = mode * 0.375; // 3 / 8
  var fileAndMetadataSize = fileMetadataSize + 1 + fileSize;
  var imgZoom = Math.sqrt(fileAndMetadataSize / encodeRate / (img.width * img.height - 1));
  var width = Math.ceil(img.width * imgZoom), height = Math.ceil(img.height * imgZoom);
  cvs.width = width, cvs.height = height;
  cxt.drawImage(img, 0, 0, width, height);

  // 调用绘制备注回调
  if (drawTagCallback) drawTagCallback(cxt, width, height);
  var imgdata = cxt.getImageData(0, 0, width, height);

  // 组合数据序列
  var pixelCount = width * height;
  var bytes = new Uint8Array(Math.ceil((pixelCount - 1) * encodeRate));
  bytes.set(fileMetadataBytes, 0);
  bytes.set(fileBytes, fileMetadataBytes.length + 1);
  fileBytes = fileMetadataBytes = null; // GC ;)
  // 然后把剩下的空白部分随便填满
  for (let i = 0, l = bytes.length - fileAndMetadataSize; i < l; ++i)
    bytes[fileAndMetadataSize + i] = REST_SPACE_FILL[i % REST_SPACE_FILL.length];

  // 写入识别信息
  closer(imgdata.data, 0, 3, 0);
  closer(imgdata.data, 1, 3, 3);
  closer(imgdata.data, 2, 3, mode);

  // 写入数据
  var bitBuffer = new BitQueue32();
  for (let i = 1, j = 0; i < pixelCount; ++i) {
    while (bitBuffer.length < 3 * mode) bitBuffer.enqueue(bytes[j++]);
    closer(imgdata.data, i << 2    , mode, bitBuffer.dequeue(mode));
    closer(imgdata.data, i << 2 | 1, mode, bitBuffer.dequeue(mode));
    closer(imgdata.data, i << 2 | 2, mode, bitBuffer.dequeue(mode));
  }

  cvs.width += 0; // 清空画布
  cxt.putImageData(imgdata, 0, 0);
  return await new Promise(res => {
    cvs.toBlob(res, "image/png");
  });
}

/**
 * LSB隐写：在数组`array`的索引`index`的最低`len`位写入数据`value`
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
