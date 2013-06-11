importScripts("gifwriter.js");

(function () {
"use strict";

var GifWriter = vividcode.image.GifWriter;
var IndexedColorImage = vividcode.image.IndexedColorImage;
var MedianCutColorReducer = vividcode.image.MedianCutColorReducer;

this.onmessage = function (evt) {
    var msg = evt.data;

    var imageDataList = msg.imageDataList;
    var paletteSize = msg.paletteSize;
    var delayTimeInMS = msg.delayTimeInMS;

    var indexedColorImages = imageDataList.map(function (e) {
        return convertImgDataToIndexedColorImage(e, paletteSize);
    });
    var os = {
        buffer: [],
        writeByte: function (b) { this.buffer.push(b) },
        writeBytes: function (bb) { Array.prototype.push.apply(this.buffer, bb) },
    };
    var gifWriter = new GifWriter(os);
    gifWriter.writeHeader();
    gifWriter.writeLogicalScreenInfo({ width: msg.width, height: msg.height });
    gifWriter.writeLoopControlInfo(0);
    indexedColorImages.forEach(function (img) {
        gifWriter.writeTableBasedImageWithGraphicControl(img, { delayTimeInMS: delayTimeInMS });
    });
    gifWriter.writeTrailer();

    var gifDataStr = os.buffer.map(function (b) { return String.fromCharCode(b) }).join("");
    this.postMessage({ gifDataStr: gifDataStr });
};

function convertImgDataToIndexedColorImage(imgData, paletteSize) {
var reducer = new MedianCutColorReducer(imgData, paletteSize);
var paletteData = reducer.process();
var dat = Array.prototype.slice.call(imgData.data);
var indexedColorImageData = [];
for (var idx = 0, len = dat.length; idx < len; idx += 4) {
  var d = dat.slice(idx, idx+4); // r,g,b,a
  indexedColorImageData.push(reducer.map(d[0],d[1],d[2]));
}
return new IndexedColorImage({ width: imgData.width, height: imgData.height },
      indexedColorImageData, paletteData);
}
}).call(this);
