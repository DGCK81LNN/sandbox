var vm = new Vue({
  el: "#app",
  data: {
    encryptData: {
      image: null,
      file: null,
      label: "TK",
      compressionLevel: 4,
      result: "",
    },
    decryptData: {
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
    decrypt() {
      if (vm.decryptData.result) window.URL.revokeObjectURL(vm.decryptData.result);
      vm.decryptData.error = vm.decryptData.result = null;
      vm.decryptData.msgType = "info";
      decrypt(vm.decryptData.image, msg => { vm.decryptData.msg = msg }).then(result => {
        vm.decryptData.msgType = "";
        vm.decryptData.result = window.URL.createObjectURL(result);
        vm.decryptData.resultName = result.name;
        vm.decryptData.resultType = result.type;
        vm.decryptData.resultSize = result.size;
        vm.decryptData.resultIsImage = result.type.startsWith("image/");
      }, error => {
        vm.decryptData.msgType = "error";
        vm.decryptData.msg = String(error);
        console.error(error);
      });
    },
    saveDecrypted() {
      var a = document.createElement("a");
      a.setAttribute("download", vm.decryptData.resultName);
      a.setAttribute("href", vm.decryptData.result);
      a.click();
    },
    formatSize,
  }
});

var img = new Image();
var cvs = document.createElement("canvas");
var cxt = cvs.getContext("2d");
var textDecoder = new TextDecoder();

/**
 * 坦克现形
 * @param {Blob} imgBlob
 * @param {(string) => void} log 进度信息回调
 * @returns {Promise<File>}
 */
async function decrypt(imgBlob, log = () => { }) {
  log("读取图片...");
  await new Promise((res, rej) => {
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("读取图片失败"));
    img.src = window.URL.createObjectURL(imgBlob);
  });
  let width = cvs.width = img.width, height = cvs.height = img.height;
  cxt.drawImage(img, 0, 0);
  let imgdata = cxt.getImageData(0, 0, width, height);

  log("校验...");
  let mode = imgdata.data[2] & 7;
  if (
    (imgdata.data[0] & 7) !== 0 ||
    (imgdata.data[1] & 7) !== 3 ||
    mode === 0 || mode > 5
  ) {
    throw new Error("🔨");
  }

  log("读取元数据...");
  let pixelCount = width * height;
  let bitBuffer = new BitQueue32(), i = 1, metadataBytes = [];
  while (i < pixelCount) {
    while (bitBuffer.length < 8) {
      bitBuffer.enqBits(mode, imgdata.data[i << 2]);
      bitBuffer.enqBits(mode, imgdata.data[i << 2 | 1]);
      bitBuffer.enqBits(mode, imgdata.data[i << 2 | 2]);
      ++i;
    }
    let byte = bitBuffer.deqByte();
    if (!byte) break;
    metadataBytes.push(byte);
  }
  let fileMetadata = textDecoder.decode(new Uint8Array(metadataBytes)).split("\x01");
  let [fileSize, fileName, fileType] = fileMetadata;
  console.log({ fileSize, fileName, fileType });
  fileSize = Number(fileSize);
  if (
    fileMetadata.length < 3 ||
    isNaN(fileSize) ||
    (0 | fileSize) !== fileSize || // 判断是否为32位整数
    fileSize < 0
  ) throw new Error("头部信息无效");

  log("读取里图...");
  let blist = new Uint8Array(fileSize), j = 0;
  while (i < pixelCount && j < fileSize) {
    while (bitBuffer.length < 8) {
      bitBuffer.enqBits(mode, imgdata.data[i << 2]);
      bitBuffer.enqBits(mode, imgdata.data[i << 2 | 1]);
      bitBuffer.enqBits(mode, imgdata.data[i << 2 | 2]);
      ++i;
    }
    let byte = bitBuffer.deqByte();
    blist[j++] = byte;
  }

  return new File([blist], fileName, { type: fileType });
}

/**
 * 格式化文件大小
 * 
 * 单位最高只能到GB
 * @param {number} bytes
 * @returns {string}
 */
 function formatSize(bytes) {
  if (bytes < 1e+3) return bytes + "B"
  if (bytes < 1e+6) return (bytes / 0x400).toFixed(2) + "KB"
  if (bytes < 1e+9) return (bytes / 0x100000).toFixed(2) + "MB"
  return (bytes / 0x40000000).toFixed(2) + "GB"
}

class BitQueue32 {
  constructor() {
    this.data = 0;
    this.length = 0;
  }
  enqBits(valueLength, value) {
    if (this.length + valueLength > 32) throw new RangeError("BitQueue32.prototype.pushBits(): Overflow");
    this.length += valueLength;
    this.data <<= valueLength;
    this.data |= value & ~(-1 << valueLength);
  }
  peekByte() {
    var newLength = this.length - 8;
    if (newLength < 0) return this.data << (-newLength);
    else return this.data >>> newLength;
  }
  deqByte() {
    var newLength = this.length - 8;
    var result;
    if (newLength < 0) {
      result = this.data << (-newLength);
      this.data = 0;
      this.length = 0;
    } else {
      result = this.data >>> newLength;
      this.data &= ~(-1 << newLength);
      this.length = newLength;
    }
    return result;
  }
}
