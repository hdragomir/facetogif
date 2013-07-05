/**
 * GifWriter.js 0.1.0
 * The MIT License ( http://opensource.org/licenses/MIT )
 * Copyright (c) 2013 nobuoka
 */

var vividcode;
(function (vividcode) {
    (function (image) {
        var IndexedColorImage = (function () {
            function IndexedColorImage(size, data, paletteData) {
                this.width = size.width;
                this.height = size.height;
                this.data = data;
                this.paletteData = paletteData;
            }
            return IndexedColorImage;
        })();
        image.IndexedColorImage = IndexedColorImage;        
        var GifCompressedCodesToByteArrayConverter = (function () {
            function GifCompressedCodesToByteArrayConverter() {
                this.__out = [];
                this.__remNumBits = 0;
                this.__remVal = 0;
            }
            GifCompressedCodesToByteArrayConverter.prototype.push = function (code, numBits) {
                while(numBits > 0) {
                    this.__remVal = ((code << this.__remNumBits) & 255) + this.__remVal;
                    if(numBits + this.__remNumBits >= 8) {
                        this.__out.push(this.__remVal);
                        numBits = numBits - (8 - this.__remNumBits);
                        code = (code >> (8 - this.__remNumBits));
                        this.__remVal = 0;
                        this.__remNumBits = 0;
                    } else {
                        this.__remNumBits = numBits + this.__remNumBits;
                        numBits = 0;
                    }
                }
            };
            GifCompressedCodesToByteArrayConverter.prototype.flush = function () {
                this.push(0, 8);
                this.__remNumBits = 0;
                this.__remVal = 0;
                var out = this.__out;
                this.__out = [];
                return out;
            };
            return GifCompressedCodesToByteArrayConverter;
        })();        
        function compressWithLZW(actualCodes, numBits) {
            var bb = new GifCompressedCodesToByteArrayConverter();
            var clearCode = (1 << numBits);
            var endOfInfoCode = clearCode + 1;
            var nextCode;
            var curNumCodeBits;
            var dict;
            function resetAllParamsAndTablesToStartUpState() {
                nextCode = endOfInfoCode + 1;
                curNumCodeBits = numBits + 1;
                dict = Object.create(null);
            }
            resetAllParamsAndTablesToStartUpState();
            bb.push(clearCode, curNumCodeBits);
            var concatedCodesKey = "";
            for(var i = 0, len = actualCodes.length; i < len; ++i) {
                var code = actualCodes[i];
                var dictKey = String.fromCharCode(code);
                if(!(dictKey in dict)) {
                    dict[dictKey] = code;
                }
                var oldKey = concatedCodesKey;
                concatedCodesKey += dictKey;
                if(!(concatedCodesKey in dict)) {
                    bb.push(dict[oldKey], curNumCodeBits);
                    if(nextCode <= 4095) {
                        dict[concatedCodesKey] = nextCode;
                        if(nextCode === (1 << curNumCodeBits)) {
                            curNumCodeBits++;
                        }
                        nextCode++;
                    } else {
                        bb.push(clearCode, curNumCodeBits);
                        resetAllParamsAndTablesToStartUpState();
                        dict[dictKey] = code;
                    }
                    concatedCodesKey = dictKey;
                }
            }
            bb.push(dict[concatedCodesKey], curNumCodeBits);
            bb.push(endOfInfoCode, curNumCodeBits);
            return bb.flush();
        }
        var GifWriter = (function () {
            function GifWriter(outputStream) {
                this.__os = outputStream;
            }
            GifWriter.prototype.__writeInt2 = function (v) {
                this.__os.writeBytes([
                    v & 255, 
                    (v >> 8) & 255
                ]);
            };
            GifWriter.prototype.__writeDataSubBlocks = function (data) {
                var os = this.__os;
                var curIdx = 0;
                var blockLastIdx;
                while(curIdx < (blockLastIdx = Math.min(data.length, curIdx + 254))) {
                    var subarray = data.slice(curIdx, blockLastIdx);
                    os.writeByte(subarray.length);
                    os.writeBytes(subarray);
                    curIdx = blockLastIdx;
                }
            };
            GifWriter.prototype.__writeBlockTerminator = function () {
                this.__os.writeByte(0);
            };
            GifWriter.prototype.writeHeader = function () {
                var os = this.__os;
                os.writeBytes([
                    71, 
                    73, 
                    70
                ]);
                os.writeBytes([
                    56, 
                    57, 
                    97
                ]);
            };
            GifWriter.prototype.writeTrailer = function () {
                this.__os.writeByte(59);
            };
            GifWriter.prototype.writeLogicalScreenInfo = function (imageSize, options) {
                if(!options) {
                    options = {
                    };
                }
                var sizeOfColorTable = "sizeOfColorTable" in options ? options.sizeOfColorTable : options.colorTableData ? this.__calcSizeOfColorTable(options.colorTableData) : 7;
                var bgColorIndex = ("bgColorIndex" in options ? options.bgColorIndex : 0);
                var pxAspectRatio = ("pxAspectRatio" in options ? options.pxAspectRatio : 0);
                this.__writeLogicalScreenDescriptor(imageSize, !!options.colorTableData, !!options.colorTableSortFlag, sizeOfColorTable, bgColorIndex, pxAspectRatio);
                if(!!options.colorTableData) {
                    this.__writeColorTable(options.colorTableData, sizeOfColorTable);
                }
            };
            GifWriter.prototype.__calcSizeOfColorTable = function (colorTableData) {
                var numColors = colorTableData.length / 3;
                var sct = 0;
                var v = 2;
                while(v < numColors) {
                    sct++;
                    v = v << 1;
                }
                return sct;
            };
            GifWriter.prototype.__writeLogicalScreenDescriptor = function (imageSize, useGlobalColorTable, colorTableSortFlag, sizeOfColorTable, bgColorIndex, pxAspectRatio) {
                var os = this.__os;
                this.__writeInt2(imageSize.width);
                this.__writeInt2(imageSize.height);
                os.writeByte((useGlobalColorTable ? 128 : 0) | 112 | (colorTableSortFlag ? 8 : 0) | sizeOfColorTable);
                os.writeByte(bgColorIndex);
                os.writeByte(pxAspectRatio);
            };
            GifWriter.prototype.writeTableBasedImage = function (indexedColorImage, options) {
                if(!options) {
                    options = {
                    };
                }
                var useLocalColorTable = true;
                var sizeOfLocalColorTable = this.__calcSizeOfColorTable(indexedColorImage.paletteData);
                this.__writeImageDescriptor(indexedColorImage, useLocalColorTable, sizeOfLocalColorTable, options);
                if(useLocalColorTable) {
                    this.__writeColorTable(indexedColorImage.paletteData, (useLocalColorTable ? sizeOfLocalColorTable : 0));
                }
                this.__writeImageData(indexedColorImage.data, sizeOfLocalColorTable + 1);
            };
            GifWriter.prototype.writeTableBasedImageWithGraphicControl = function (indexedColorImage, gcOpts) {
                this.__writeGraphicControlExtension(gcOpts);
                this.writeTableBasedImage(indexedColorImage, gcOpts);
            };
            GifWriter.prototype.__writeImageDescriptor = function (indexedColorImage, useLocalColorTable, sizeOfLocalColorTable, opts) {
                var os = this.__os;
                os.writeByte(44);
                var leftPos = ("leftPosition" in opts ? opts.leftPosition : 0);
                this.__writeInt2(leftPos);
                var topPos = ("topPosition" in opts ? opts.topPosition : 0);
                this.__writeInt2(topPos);
                this.__writeInt2(indexedColorImage.width);
                this.__writeInt2(indexedColorImage.height);
                os.writeByte((useLocalColorTable ? 128 : 0) | 0 | 0 | 0 | sizeOfLocalColorTable);
            };
            GifWriter.prototype.__writeImageData = function (data, numBitsForCode) {
                var os = this.__os;
                if(numBitsForCode === 1) {
                    numBitsForCode = 2;
                }
                var compressedBytes = compressWithLZW(data, numBitsForCode);
                os.writeByte(numBitsForCode);
                this.__writeDataSubBlocks(compressedBytes);
                this.__writeBlockTerminator();
            };
            GifWriter.prototype.__writeColorTable = function (colorTableData, sizeOfColorTable) {
                var os = this.__os;
                os.writeBytes(colorTableData);
                var rem = (3 * Math.pow(2, sizeOfColorTable + 1)) - colorTableData.length;
                var remBytes = [];
                while(--rem >= 0) {
                    remBytes.push(0);
                }
                os.writeBytes(remBytes);
            };
            GifWriter.prototype.__writeGraphicControlExtension = function (options) {
                if(!options) {
                    options = {
                    };
                }
                var os = this.__os;
                var delay = Math.round((options.delayTimeInMS || 0) / 10);
                var disposalMethod = ("disposalMethod" in options ? options.disposalMethod : 2);
                var transparentColorIndex;
                var transparentColorFlag;
                if(options.transparentColorIndex >= 0) {
                    transparentColorIndex = options.transparentColorIndex & 255;
                    transparentColorFlag = 1;
                } else {
                    transparentColorIndex = 0;
                    transparentColorFlag = 0;
                }
                os.writeBytes([
                    33, 
                    249, 
                    4
                ]);
                os.writeByte(0 | (disposalMethod << 2) | 0 | transparentColorFlag);
                this.__writeInt2(delay);
                os.writeByte(transparentColorIndex);
                os.writeByte(0);
            };
            GifWriter.prototype.writeLoopControlInfo = function (repeatCount) {
                this.__os.writeBytes([
                    33, 
                    255, 
                    11, 
                    78, 
                    69, 
                    84, 
                    83, 
                    67, 
                    65, 
                    80, 
                    69, 
                    50, 
                    46, 
                    48, 
                    3, 
                    1, 
                    (repeatCount & 255), 
                    ((repeatCount >> 8) & 255), 
                    0, 
                    
                ]);
            };
            return GifWriter;
        })();
        image.GifWriter = GifWriter;        
    })(vividcode.image || (vividcode.image = {}));
    var image = vividcode.image;
})(vividcode || (vividcode = {}));
var vividcode;
(function (vividcode) {
    (function (image) {
        function swap(array, idx1, idx2) {
            var tmp = array[idx1];
            array[idx1] = array[idx2];
            array[idx2] = tmp;
        }
        function partition(a, left, right, pivotIndex) {
            var pivotValue = a[pivotIndex];
            swap(a, pivotIndex, right);
            var storeIndex = left;
            for(var i = left; i < right; ++i) {
                if(a[i] <= pivotValue) {
                    swap(a, storeIndex, i);
                    storeIndex = storeIndex + 1;
                }
            }
            swap(a, right, storeIndex);
            return storeIndex;
        }
        function selectKthElem(list, left, right, k) {
            while(true) {
                var pivotIndex = Math.floor((right + left) / 2);
                var pivotNewIndex = partition(list, left, right, pivotIndex);
                var pivotDist = pivotNewIndex - left + 1;
                if(k === pivotDist) {
                    return list[pivotNewIndex];
                } else if(k < pivotDist) {
                    right = pivotNewIndex - 1;
                } else {
                    k = k - pivotDist;
                    left = pivotNewIndex + 1;
                }
            }
        }
        function searchClosestColor(color, palette) {
            var idx = searchClosestColorIndex(color, palette);
            return palette[idx];
        }
        function searchClosestColorIndex(color, palette) {
            var min = 0;
            var found = false;
            var foundIndex = -1;
            var closestIndex = -1;
            var index = 0;
            palette.forEach(function (p, idx) {
                var d = Math.floor(Math.pow(color.red - p.red, 2) + Math.pow(color.green - p.green, 2) + Math.pow(color.blue - p.blue, 2));
                if(d == 0) {
                    found = true;
                    foundIndex = idx;
                    closestIndex = idx;
                } else if(min == 0 || d < min) {
                    closestIndex = idx;
                    min = d;
                }
            });
            return (found ? foundIndex : closestIndex);
        }
        var ColorCube = (function () {
            function ColorCube(colors) {
                this.colors = colors;
                var minR = 255;
                var maxR = 0;
                var minG = 255;
                var maxG = 0;
                var minB = 255;
                var maxB = 0;
                colors.forEach(function (color) {
                    if(color.red < minR) {
                        minR = color.red;
                    }
                    if(color.red > maxR) {
                        maxR = color.red;
                    }
                    if(color.green < minG) {
                        minG = color.green;
                    }
                    if(color.green > maxG) {
                        maxG = color.green;
                    }
                    if(color.blue < minB) {
                        minB = color.blue;
                    }
                    if(color.blue > maxB) {
                        maxB = color.blue;
                    }
                });
                this.__minR = minR;
                this.__maxR = maxR;
                this.__minG = minG;
                this.__maxG = maxG;
                this.__minB = minB;
                this.__maxB = maxB;
            }
            ColorCube.prototype.divide = function () {
                var cut = this.largestEdge();
                var med = this.median(cut);
                var r = this.divideBy(cut, med);
                return r;
            };
            ColorCube.prototype.divideBy = function (cutTargetColor, median) {
                var list0 = [];
                var list1 = [];
                this.colors.forEach(function (c) {
                    if(c[cutTargetColor] < median) {
                        list0.push(c);
                    } else {
                        list1.push(c);
                    }
                });
                if(list0.length > 0 && list1.length > 0) {
                    return [
                        new ColorCube(list0), 
                        new ColorCube(list1)
                    ];
                } else {
                    return [];
                }
            };
            ColorCube.prototype.median = function (cutTargetColor) {
                var cc = [];
                var colors = this.colors;
                for(var i = 0, len = colors.length; i < len; ++i) {
                    cc.push(colors[i][cutTargetColor]);
                }
                var med2 = selectKthElem(cc, 0, cc.length - 1, Math.floor(cc.length / 2) + 1);
                return med2;
            };
            ColorCube.prototype.largestEdge = function () {
                var diffR = (this.__maxR - this.__minR) * 1.0;
                var diffG = (this.__maxG - this.__minG) * 0.8;
                var diffB = (this.__maxB - this.__minB) * 0.5;
                if(diffG >= diffB) {
                    if(diffR >= diffG) {
                        return "red";
                    } else {
                        return "green";
                    }
                } else {
                    if(diffR >= diffB) {
                        return "red";
                    } else {
                        return "blue";
                    }
                }
            };
            ColorCube.prototype.getNumberOfColors = function () {
                return this.colors.length;
            };
            ColorCube.prototype.average = function () {
                var sumR = 0;
                var sumG = 0;
                var sumB = 0;
                this.colors.forEach(function (c) {
                    sumR += c.red;
                    sumG += c.green;
                    sumB += c.blue;
                });
                var size = this.colors.length;
                return {
                    red: Math.floor(sumR / size),
                    green: Math.floor(sumG / size),
                    blue: Math.floor(sumB / size)
                };
            };
            return ColorCube;
        })();        
        var MedianCutColorReducer = (function () {
            function MedianCutColorReducer(imageData, maxPaletteSize) {
                this.__imageData = imageData;
                this.__maxPaletteSize = maxPaletteSize || 255;
            }
            MedianCutColorReducer.prototype.process = function () {
                var imageData = this.__imageData;
                var maxcolor = this.__maxPaletteSize;
                var colors = this.__extractColors(imageData);
                var cubes = this.__medianCut(colors, maxcolor);
                var palette = [];
                var colorReductionMap = Object.create(null);
                cubes.forEach(function (cube, idx) {
                    palette.push(cube.average());
                    cube.colors.forEach(function (c) {
                        var rgb = ((c.red << 16) | (c.green << 8) | (c.blue << 0)).toString(16);
                        while(6 - rgb.length) {
                            rgb = "0" + rgb;
                        }
                        colorReductionMap[rgb] = idx;
                    });
                });
                this.__palette = palette;
                this.__colorReductionMap = colorReductionMap;
                var paletteData = [];
                palette.forEach(function (color) {
                    paletteData.push(color.red);
                    paletteData.push(color.green);
                    paletteData.push(color.blue);
                });
                return paletteData;
            };
            MedianCutColorReducer.prototype.map = function (r, g, b) {
                var rgb = ((r << 16) | (g << 8) | (b << 0)).toString(16);
                while(6 - rgb.length) {
                    rgb = "0" + rgb;
                }
                if(!(rgb in this.__colorReductionMap)) {
                    this.__colorReductionMap[rgb] = searchClosestColorIndex({
                        red: r,
                        green: g,
                        blue: b
                    }, this.__palette);
                }
                return this.__colorReductionMap[rgb];
            };
            MedianCutColorReducer.prototype.__extractColors = function (imageData) {
                var maxIndex = imageData.width * imageData.height;
                var colorHash = {
                };
                var colors = [];
                for(var i = 0; i < maxIndex; ++i) {
                    var r = imageData.data[i * 4 + 0];
                    var g = imageData.data[i * 4 + 1];
                    var b = imageData.data[i * 4 + 2];
                    var rgb = ((r << 16) | (g << 8) | (b << 0)).toString(16);
                    while(6 - rgb.length) {
                        rgb = "0" + rgb;
                    }
                    if(!colorHash[rgb]) {
                        colorHash[rgb] = true;
                        colors.push({
                            red: r,
                            green: g,
                            blue: b
                        });
                    }
                }
                return colors;
            };
            MedianCutColorReducer.prototype.__medianCut = function (colors, maxColor) {
                var cube = new ColorCube(colors);
                var divided = this.__divideUntil([
                    cube
                ], maxColor);
                return divided;
            };
            MedianCutColorReducer.prototype.__divideUntil = function (cubes, limit) {
                while(true) {
                    if(cubes.length >= limit) {
                        break;
                    }
                    var largestCube = this.__getLargestCube(cubes);
                    var dcubes = largestCube.divide();
                    if(dcubes.length < 2) {
                        break;
                    }
                    cubes = cubes.filter(function (c) {
                        return c !== largestCube;
                    }).concat(dcubes);
                }
                return cubes;
            };
            MedianCutColorReducer.prototype.__getLargestCube = function (cubes) {
                var max = null;
                var maxCount = 0;
                cubes.forEach(function (x) {
                    var cc = x.getNumberOfColors();
                    if(cc > maxCount) {
                        max = x;
                        maxCount = cc;
                    }
                });
                return max;
            };
            return MedianCutColorReducer;
        })();
        image.MedianCutColorReducer = MedianCutColorReducer;        
    })(vividcode.image || (vividcode.image = {}));
    var image = vividcode.image;
})(vividcode || (vividcode = {}));
