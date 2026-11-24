/* qrcode-generator (MIT, Kazuhiko Arase) */
//---------------------------------------------------------------------
//
// QR Code Generator for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//
// The word 'QR Code' is registered trademark of
// DENSO WAVE INCORPORATED
//  http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

var qrcode = function() {

  //---------------------------------------------------------------------
  // qrcode
  //---------------------------------------------------------------------

  /**
   * qrcode
   * @param typeNumber 1 to 40
   * @param errorCorrectionLevel 'L','M','Q','H'
   */
  var qrcode = function(typeNumber, errorCorrectionLevel) {

    var PAD0 = 0xEC;
    var PAD1 = 0x11;

    var _typeNumber = typeNumber;
    var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    var _modules = null;
    var _moduleCount = 0;
    var _dataCache = null;
    var _dataList = [];

    var _this = {};

    var makeImpl = function(test, maskPattern) {

      _moduleCount = _typeNumber * 4 + 17;
      _modules = function(moduleCount) {
        var modules = new Array(moduleCount);
        for (var row = 0; row < moduleCount; row += 1) {
          modules[row] = new Array(moduleCount);
          for (var col = 0; col < moduleCount; col += 1) {
            modules[row][col] = null;
          }
        }
        return modules;
      }(_moduleCount);

      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);

      if (_typeNumber >= 7) {
        setupTypeNumber(test);
      }

      if (_dataCache == null) {
        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }

      mapData(_dataCache, maskPattern);
    };

    var setupPositionProbePattern = function(row, col) {

      for (var r = -1; r <= 7; r += 1) {

        if (row + r <= -1 || _moduleCount <= row + r) continue;

        for (var c = -1; c <= 7; c += 1) {

          if (col + c <= -1 || _moduleCount <= col + c) continue;

          if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
              || (0 <= c && c <= 6 && (r == 0 || r == 6) )
              || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    };

    var getBestMaskPattern = function() {

      var minLostPoint = 0;
      var pattern = 0;

      for (var i = 0; i < 8; i += 1) {

        makeImpl(true, i);

        var lostPoint = QRUtil.getLostPoint(_this);

        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }

      return pattern;
    };

    var setupTimingPattern = function() {

      for (var r = 8; r < _moduleCount - 8; r += 1) {
        if (_modules[r][6] != null) {
          continue;
        }
        _modules[r][6] = (r % 2 == 0);
      }

      for (var c = 8; c < _moduleCount - 8; c += 1) {
        if (_modules[6][c] != null) {
          continue;
        }
        _modules[6][c] = (c % 2 == 0);
      }
    };

    var setupPositionAdjustPattern = function() {

      var pos = QRUtil.getPatternPosition(_typeNumber);

      for (var i = 0; i < pos.length; i += 1) {

        for (var j = 0; j < pos.length; j += 1) {

          var row = pos[i];
          var col = pos[j];

          if (_modules[row][col] != null) {
            continue;
          }

          for (var r = -2; r <= 2; r += 1) {

            for (var c = -2; c <= 2; c += 1) {

              if (r == -2 || r == 2 || c == -2 || c == 2
                  || (r == 0 && c == 0) ) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    };

    var setupTypeNumber = function(test) {

      var bits = QRUtil.getBCHTypeNumber(_typeNumber);

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
      }

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    };

    var setupTypeInfo = function(test, maskPattern) {

      var data = (_errorCorrectionLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);

      // vertical
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 6) {
          _modules[i][8] = mod;
        } else if (i < 8) {
          _modules[i + 1][8] = mod;
        } else {
          _modules[_moduleCount - 15 + i][8] = mod;
        }
      }

      // horizontal
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 8) {
          _modules[8][_moduleCount - i - 1] = mod;
        } else if (i < 9) {
          _modules[8][15 - i - 1 + 1] = mod;
        } else {
          _modules[8][15 - i - 1] = mod;
        }
      }

      // fixed module
      _modules[_moduleCount - 8][8] = (!test);
    };

    var mapData = function(data, maskPattern) {

      var inc = -1;
      var row = _moduleCount - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      var maskFunc = QRUtil.getMaskFunction(maskPattern);

      for (var col = _moduleCount - 1; col > 0; col -= 2) {

        if (col == 6) col -= 1;

        while (true) {

          for (var c = 0; c < 2; c += 1) {

            if (_modules[row][col - c] == null) {

              var dark = false;

              if (byteIndex < data.length) {
                dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
              }

              var mask = maskFunc(row, col - c);

              if (mask) {
                dark = !dark;
              }

              _modules[row][col - c] = dark;
              bitIndex -= 1;

              if (bitIndex == -1) {
                byteIndex += 1;
                bitIndex = 7;
              }
            }
          }

          row += inc;

          if (row < 0 || _moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    };

    var createBytes = function(buffer, rsBlocks) {

      var offset = 0;

      var maxDcCount = 0;
      var maxEcCount = 0;

      var dcdata = new Array(rsBlocks.length);
      var ecdata = new Array(rsBlocks.length);

      for (var r = 0; r < rsBlocks.length; r += 1) {

        var dcCount = rsBlocks[r].dataCount;
        var ecCount = rsBlocks[r].totalCount - dcCount;

        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);

        dcdata[r] = new Array(dcCount);

        for (var i = 0; i < dcdata[r].length; i += 1) {
          dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;

        var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);

        var modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (var i = 0; i < ecdata[r].length; i += 1) {
          var modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;
        }
      }

      var totalCodeCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalCodeCount += rsBlocks[i].totalCount;
      }

      var data = new Array(totalCodeCount);
      var index = 0;

      for (var i = 0; i < maxDcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < dcdata[r].length) {
            data[index] = dcdata[r][i];
            index += 1;
          }
        }
      }

      for (var i = 0; i < maxEcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < ecdata[r].length) {
            data[index] = ecdata[r][i];
            index += 1;
          }
        }
      }

      return data;
    };

    var createData = function(typeNumber, errorCorrectionLevel, dataList) {

      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);

      var buffer = qrBitBuffer();

      for (var i = 0; i < dataList.length; i += 1) {
        var data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
        data.write(buffer);
      }

      // calc num max data.
      var totalDataCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalDataCount += rsBlocks[i].dataCount;
      }

      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw 'code length overflow. ('
          + buffer.getLengthInBits()
          + '>'
          + totalDataCount * 8
          + ')';
      }

      // end code
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }

      // padding
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }

      // padding
      while (true) {

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD0, 8);

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD1, 8);
      }

      return createBytes(buffer, rsBlocks);
    };

    _this.addData = function(data, mode) {

      mode = mode || 'Byte';

      var newData = null;

      switch(mode) {
      case 'Numeric' :
        newData = qrNumber(data);
        break;
      case 'Alphanumeric' :
        newData = qrAlphaNum(data);
        break;
      case 'Byte' :
        newData = qr8BitByte(data);
        break;
      case 'Kanji' :
        newData = qrKanji(data);
        break;
      default :
        throw 'mode:' + mode;
      }

      _dataList.push(newData);
      _dataCache = null;
    };

    _this.isDark = function(row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
        throw row + ',' + col;
      }
      return _modules[row][col];
    };

    _this.getModuleCount = function() {
      return _moduleCount;
    };

    _this.make = function() {
      if (_typeNumber < 1) {
        var typeNumber = 1;

        for (; typeNumber < 40; typeNumber++) {
          var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
          var buffer = qrBitBuffer();

          for (var i = 0; i < _dataList.length; i++) {
            var data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
            data.write(buffer);
          }

          var totalDataCount = 0;
          for (var i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
          }

          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            break;
          }
        }

        _typeNumber = typeNumber;
      }

      makeImpl(false, getBestMaskPattern() );
    };

    _this.createTableTag = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var qrHtml = '';

      qrHtml += '<table style="';
      qrHtml += ' border-width: 0px; border-style: none;';
      qrHtml += ' border-collapse: collapse;';
      qrHtml += ' padding: 0px; margin: ' + margin + 'px;';
      qrHtml += '">';
      qrHtml += '<tbody>';

      for (var r = 0; r < _this.getModuleCount(); r += 1) {

        qrHtml += '<tr>';

        for (var c = 0; c < _this.getModuleCount(); c += 1) {
          qrHtml += '<td style="';
          qrHtml += ' border-width: 0px; border-style: none;';
          qrHtml += ' border-collapse: collapse;';
          qrHtml += ' padding: 0px; margin: 0px;';
          qrHtml += ' width: ' + cellSize + 'px;';
          qrHtml += ' height: ' + cellSize + 'px;';
          qrHtml += ' background-color: ';
          qrHtml += _this.isDark(r, c)? '#000000' : '#ffffff';
          qrHtml += ';';
          qrHtml += '"/>';
        }

        qrHtml += '</tr>';
      }

      qrHtml += '</tbody>';
      qrHtml += '</table>';

      return qrHtml;
    };

    _this.createSvgTag = function(cellSize, margin, alt, title) {

      var opts = {};
      if (typeof arguments[0] == 'object') {
        // Called by options.
        opts = arguments[0];
        // overwrite cellSize and margin.
        cellSize = opts.cellSize;
        margin = opts.margin;
        alt = opts.alt;
        title = opts.title;
      }

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      // Compose alt property surrogate
      alt = (typeof alt === 'string') ? {text: alt} : alt || {};
      alt.text = alt.text || null;
      alt.id = (alt.text) ? alt.id || 'qrcode-description' : null;

      // Compose title property surrogate
      title = (typeof title === 'string') ? {text: title} : title || {};
      title.text = title.text || null;
      title.id = (title.text) ? title.id || 'qrcode-title' : null;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var c, mc, r, mr, qrSvg='', rect;

      rect = 'l' + cellSize + ',0 0,' + cellSize +
        ' -' + cellSize + ',0 0,-' + cellSize + 'z ';

      qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
      qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : '';
      qrSvg += ' viewBox="0 0 ' + size + ' ' + size + '" ';
      qrSvg += ' preserveAspectRatio="xMinYMin meet"';
      qrSvg += (title.text || alt.text) ? ' role="img" aria-labelledby="' +
          escapeXml([title.id, alt.id].join(' ').trim() ) + '"' : '';
      qrSvg += '>';
      qrSvg += (title.text) ? '<title id="' + escapeXml(title.id) + '">' +
          escapeXml(title.text) + '</title>' : '';
      qrSvg += (alt.text) ? '<description id="' + escapeXml(alt.id) + '">' +
          escapeXml(alt.text) + '</description>' : '';
      qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
      qrSvg += '<path d="';

      for (r = 0; r < _this.getModuleCount(); r += 1) {
        mr = r * cellSize + margin;
        for (c = 0; c < _this.getModuleCount(); c += 1) {
          if (_this.isDark(r, c) ) {
            mc = c*cellSize+margin;
            qrSvg += 'M' + mc + ',' + mr + rect;
          }
        }
      }

      qrSvg += '" stroke="transparent" fill="black"/>';
      qrSvg += '</svg>';

      return qrSvg;
    };

    _this.createDataURL = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      return createDataURL(size, size, function(x, y) {
        if (min <= x && x < max && min <= y && y < max) {
          var c = Math.floor( (x - min) / cellSize);
          var r = Math.floor( (y - min) / cellSize);
          return _this.isDark(r, c)? 0 : 1;
        } else {
          return 1;
        }
      } );
    };

    _this.createImgTag = function(cellSize, margin, alt) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;

      var img = '';
      img += '<img';
      img += '\u0020src="';
      img += _this.createDataURL(cellSize, margin);
      img += '"';
      img += '\u0020width="';
      img += size;
      img += '"';
      img += '\u0020height="';
      img += size;
      img += '"';
      if (alt) {
        img += '\u0020alt="';
        img += escapeXml(alt);
        img += '"';
      }
      img += '/>';

      return img;
    };

    var escapeXml = function(s) {
      var escaped = '';
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charAt(i);
        switch(c) {
        case '<': escaped += '&lt;'; break;
        case '>': escaped += '&gt;'; break;
        case '&': escaped += '&amp;'; break;
        case '"': escaped += '&quot;'; break;
        default : escaped += c; break;
        }
      }
      return escaped;
    };

    var _createHalfASCII = function(margin) {
      var cellSize = 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r1, r2, p;

      var blocks = {
        '██': '█',
        '█ ': '▀',
        ' █': '▄',
        '  ': ' '
      };

      var blocksLastLineNoMargin = {
        '██': '▀',
        '█ ': '▀',
        ' █': ' ',
        '  ': ' '
      };

      var ascii = '';
      for (y = 0; y < size; y += 2) {
        r1 = Math.floor((y - min) / cellSize);
        r2 = Math.floor((y + 1 - min) / cellSize);
        for (x = 0; x < size; x += 1) {
          p = '█';

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
            p = ' ';
          }

          if (min <= x && x < max && min <= y+1 && y+1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
            p += ' ';
          }
          else {
            p += '█';
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          ascii += (margin < 1 && y+1 >= max) ? blocksLastLineNoMargin[p] : blocks[p];
        }

        ascii += '\n';
      }

      if (size % 2 && margin > 0) {
        return ascii.substring(0, ascii.length - size - 1) + Array(size+1).join('▀');
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.createASCII = function(cellSize, margin) {
      cellSize = cellSize || 1;

      if (cellSize < 2) {
        return _createHalfASCII(margin);
      }

      cellSize -= 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r, p;

      var white = Array(cellSize+1).join('██');
      var black = Array(cellSize+1).join('  ');

      var ascii = '';
      var line = '';
      for (y = 0; y < size; y += 1) {
        r = Math.floor( (y - min) / cellSize);
        line = '';
        for (x = 0; x < size; x += 1) {
          p = 1;

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
            p = 0;
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          line += p ? white : black;
        }

        for (r = 0; r < cellSize; r += 1) {
          ascii += line + '\n';
        }
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.renderTo2dContext = function(context, cellSize) {
      cellSize = cellSize || 2;
      var length = _this.getModuleCount();
      for (var row = 0; row < length; row++) {
        for (var col = 0; col < length; col++) {
          context.fillStyle = _this.isDark(row, col) ? 'black' : 'white';
          context.fillRect(row * cellSize, col * cellSize, cellSize, cellSize);
        }
      }
    }

    return _this;
  };

  //---------------------------------------------------------------------
  // qrcode.stringToBytes
  //---------------------------------------------------------------------

  qrcode.stringToBytesFuncs = {
    'default' : function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        bytes.push(c & 0xff);
      }
      return bytes;
    }
  };

  qrcode.stringToBytes = qrcode.stringToBytesFuncs['default'];

  //---------------------------------------------------------------------
  // qrcode.createStringToBytes
  //---------------------------------------------------------------------

  /**
   * @param unicodeData base64 string of byte array.
   * [16bit Unicode],[16bit Bytes], ...
   * @param numChars
   */
  qrcode.createStringToBytes = function(unicodeData, numChars) {

    // create conversion map.

    var unicodeMap = function() {

      var bin = base64DecodeInputStream(unicodeData);
      var read = function() {
        var b = bin.read();
        if (b == -1) throw 'eof';
        return b;
      };

      var count = 0;
      var unicodeMap = {};
      while (true) {
        var b0 = bin.read();
        if (b0 == -1) break;
        var b1 = read();
        var b2 = read();
        var b3 = read();
        var k = String.fromCharCode( (b0 << 8) | b1);
        var v = (b2 << 8) | b3;
        unicodeMap[k] = v;
        count += 1;
      }
      if (count != numChars) {
        throw count + ' != ' + numChars;
      }

      return unicodeMap;
    }();

    var unknownChar = '?'.charCodeAt(0);

    return function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        if (c < 128) {
          bytes.push(c);
        } else {
          var b = unicodeMap[s.charAt(i)];
          if (typeof b == 'number') {
            if ( (b & 0xff) == b) {
              // 1byte
              bytes.push(b);
            } else {
              // 2bytes
              bytes.push(b >>> 8);
              bytes.push(b & 0xff);
            }
          } else {
            bytes.push(unknownChar);
          }
        }
      }
      return bytes;
    };
  };

  //---------------------------------------------------------------------
  // QRMode
  //---------------------------------------------------------------------

  var QRMode = {
    MODE_NUMBER :    1 << 0,
    MODE_ALPHA_NUM : 1 << 1,
    MODE_8BIT_BYTE : 1 << 2,
    MODE_KANJI :     1 << 3
  };

  //---------------------------------------------------------------------
  // QRErrorCorrectionLevel
  //---------------------------------------------------------------------

  var QRErrorCorrectionLevel = {
    L : 1,
    M : 0,
    Q : 3,
    H : 2
  };

  //---------------------------------------------------------------------
  // QRMaskPattern
  //---------------------------------------------------------------------

  var QRMaskPattern = {
    PATTERN000 : 0,
    PATTERN001 : 1,
    PATTERN010 : 2,
    PATTERN011 : 3,
    PATTERN100 : 4,
    PATTERN101 : 5,
    PATTERN110 : 6,
    PATTERN111 : 7
  };

  //---------------------------------------------------------------------
  // QRUtil
  //---------------------------------------------------------------------

  var QRUtil = function() {

    var PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ];
    var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

    var _this = {};

    var getBCHDigit = function(data) {
      var digit = 0;
      while (data != 0) {
        digit += 1;
        data >>>= 1;
      }
      return digit;
    };

    _this.getBCHTypeInfo = function(data) {
      var d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
        d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );
      }
      return ( (data << 10) | d) ^ G15_MASK;
    };

    _this.getBCHTypeNumber = function(data) {
      var d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
        d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );
      }
      return (data << 12) | d;
    };

    _this.getPatternPosition = function(typeNumber) {
      return PATTERN_POSITION_TABLE[typeNumber - 1];
    };

    _this.getMaskFunction = function(maskPattern) {

      switch (maskPattern) {

      case QRMaskPattern.PATTERN000 :
        return function(i, j) { return (i + j) % 2 == 0; };
      case QRMaskPattern.PATTERN001 :
        return function(i, j) { return i % 2 == 0; };
      case QRMaskPattern.PATTERN010 :
        return function(i, j) { return j % 3 == 0; };
      case QRMaskPattern.PATTERN011 :
        return function(i, j) { return (i + j) % 3 == 0; };
      case QRMaskPattern.PATTERN100 :
        return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };
      case QRMaskPattern.PATTERN101 :
        return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
      case QRMaskPattern.PATTERN110 :
        return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };
      case QRMaskPattern.PATTERN111 :
        return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };

      default :
        throw 'bad maskPattern:' + maskPattern;
      }
    };

    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
      var a = qrPolynomial([1], 0);
      for (var i = 0; i < errorCorrectLength; i += 1) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );
      }
      return a;
    };

    _this.getLengthInBits = function(mode, type) {

      if (1 <= type && type < 10) {

        // 1 - 9

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 10;
        case QRMode.MODE_ALPHA_NUM : return 9;
        case QRMode.MODE_8BIT_BYTE : return 8;
        case QRMode.MODE_KANJI     : return 8;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 27) {

        // 10 - 26

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 12;
        case QRMode.MODE_ALPHA_NUM : return 11;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 10;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 41) {

        // 27 - 40

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 14;
        case QRMode.MODE_ALPHA_NUM : return 13;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 12;
        default :
          throw 'mode:' + mode;
        }

      } else {
        throw 'type:' + type;
      }
    };

    _this.getLostPoint = function(qrcode) {

      var moduleCount = qrcode.getModuleCount();

      var lostPoint = 0;

      // LEVEL1

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount; col += 1) {

          var sameCount = 0;
          var dark = qrcode.isDark(row, col);

          for (var r = -1; r <= 1; r += 1) {

            if (row + r < 0 || moduleCount <= row + r) {
              continue;
            }

            for (var c = -1; c <= 1; c += 1) {

              if (col + c < 0 || moduleCount <= col + c) {
                continue;
              }

              if (r == 0 && c == 0) {
                continue;
              }

              if (dark == qrcode.isDark(row + r, col + c) ) {
                sameCount += 1;
              }
            }
          }

          if (sameCount > 5) {
            lostPoint += (3 + sameCount - 5);
          }
        }
      };

      // LEVEL2

      for (var row = 0; row < moduleCount - 1; row += 1) {
        for (var col = 0; col < moduleCount - 1; col += 1) {
          var count = 0;
          if (qrcode.isDark(row, col) ) count += 1;
          if (qrcode.isDark(row + 1, col) ) count += 1;
          if (qrcode.isDark(row, col + 1) ) count += 1;
          if (qrcode.isDark(row + 1, col + 1) ) count += 1;
          if (count == 0 || count == 4) {
            lostPoint += 3;
          }
        }
      }

      // LEVEL3

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount - 6; col += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row, col + 1)
              &&  qrcode.isDark(row, col + 2)
              &&  qrcode.isDark(row, col + 3)
              &&  qrcode.isDark(row, col + 4)
              && !qrcode.isDark(row, col + 5)
              &&  qrcode.isDark(row, col + 6) ) {
            lostPoint += 40;
          }
        }
      }

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount - 6; row += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row + 1, col)
              &&  qrcode.isDark(row + 2, col)
              &&  qrcode.isDark(row + 3, col)
              &&  qrcode.isDark(row + 4, col)
              && !qrcode.isDark(row + 5, col)
              &&  qrcode.isDark(row + 6, col) ) {
            lostPoint += 40;
          }
        }
      }

      // LEVEL4

      var darkCount = 0;

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount; row += 1) {
          if (qrcode.isDark(row, col) ) {
            darkCount += 1;
          }
        }
      }

      var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;

      return lostPoint;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // QRMath
  //---------------------------------------------------------------------

  var QRMath = function() {

    var EXP_TABLE = new Array(256);
    var LOG_TABLE = new Array(256);

    // initialize tables
    for (var i = 0; i < 8; i += 1) {
      EXP_TABLE[i] = 1 << i;
    }
    for (var i = 8; i < 256; i += 1) {
      EXP_TABLE[i] = EXP_TABLE[i - 4]
        ^ EXP_TABLE[i - 5]
        ^ EXP_TABLE[i - 6]
        ^ EXP_TABLE[i - 8];
    }
    for (var i = 0; i < 255; i += 1) {
      LOG_TABLE[EXP_TABLE[i] ] = i;
    }

    var _this = {};

    _this.glog = function(n) {

      if (n < 1) {
        throw 'glog(' + n + ')';
      }

      return LOG_TABLE[n];
    };

    _this.gexp = function(n) {

      while (n < 0) {
        n += 255;
      }

      while (n >= 256) {
        n -= 255;
      }

      return EXP_TABLE[n];
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrPolynomial
  //---------------------------------------------------------------------

  function qrPolynomial(num, shift) {

    if (typeof num.length == 'undefined') {
      throw num.length + '/' + shift;
    }

    var _num = function() {
      var offset = 0;
      while (offset < num.length && num[offset] == 0) {
        offset += 1;
      }
      var _num = new Array(num.length - offset + shift);
      for (var i = 0; i < num.length - offset; i += 1) {
        _num[i] = num[i + offset];
      }
      return _num;
    }();

    var _this = {};

    _this.getAt = function(index) {
      return _num[index];
    };

    _this.getLength = function() {
      return _num.length;
    };

    _this.multiply = function(e) {

      var num = new Array(_this.getLength() + e.getLength() - 1);

      for (var i = 0; i < _this.getLength(); i += 1) {
        for (var j = 0; j < e.getLength(); j += 1) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );
        }
      }

      return qrPolynomial(num, 0);
    };

    _this.mod = function(e) {

      if (_this.getLength() - e.getLength() < 0) {
        return _this;
      }

      var ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );

      var num = new Array(_this.getLength() );
      for (var i = 0; i < _this.getLength(); i += 1) {
        num[i] = _this.getAt(i);
      }

      for (var i = 0; i < e.getLength(); i += 1) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);
      }

      // recursive call
      return qrPolynomial(num, 0).mod(e);
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // QRRSBlock
  //---------------------------------------------------------------------

  var QRRSBlock = function() {

    var RS_BLOCK_TABLE = [

      // L
      // M
      // Q
      // H

      // 1
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],

      // 2
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],

      // 3
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],

      // 4
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],

      // 5
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],

      // 6
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],

      // 7
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],

      // 8
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],

      // 9
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],

      // 10
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16],

      // 11
      [4, 101, 81],
      [1, 80, 50, 4, 81, 51],
      [4, 50, 22, 4, 51, 23],
      [3, 36, 12, 8, 37, 13],

      // 12
      [2, 116, 92, 2, 117, 93],
      [6, 58, 36, 2, 59, 37],
      [4, 46, 20, 6, 47, 21],
      [7, 42, 14, 4, 43, 15],

      // 13
      [4, 133, 107],
      [8, 59, 37, 1, 60, 38],
      [8, 44, 20, 4, 45, 21],
      [12, 33, 11, 4, 34, 12],

      // 14
      [3, 145, 115, 1, 146, 116],
      [4, 64, 40, 5, 65, 41],
      [11, 36, 16, 5, 37, 17],
      [11, 36, 12, 5, 37, 13],

      // 15
      [5, 109, 87, 1, 110, 88],
      [5, 65, 41, 5, 66, 42],
      [5, 54, 24, 7, 55, 25],
      [11, 36, 12, 7, 37, 13],

      // 16
      [5, 122, 98, 1, 123, 99],
      [7, 73, 45, 3, 74, 46],
      [15, 43, 19, 2, 44, 20],
      [3, 45, 15, 13, 46, 16],

      // 17
      [1, 135, 107, 5, 136, 108],
      [10, 74, 46, 1, 75, 47],
      [1, 50, 22, 15, 51, 23],
      [2, 42, 14, 17, 43, 15],

      // 18
      [5, 150, 120, 1, 151, 121],
      [9, 69, 43, 4, 70, 44],
      [17, 50, 22, 1, 51, 23],
      [2, 42, 14, 19, 43, 15],

      // 19
      [3, 141, 113, 4, 142, 114],
      [3, 70, 44, 11, 71, 45],
      [17, 47, 21, 4, 48, 22],
      [9, 39, 13, 16, 40, 14],

      // 20
      [3, 135, 107, 5, 136, 108],
      [3, 67, 41, 13, 68, 42],
      [15, 54, 24, 5, 55, 25],
      [15, 43, 15, 10, 44, 16],

      // 21
      [4, 144, 116, 4, 145, 117],
      [17, 68, 42],
      [17, 50, 22, 6, 51, 23],
      [19, 46, 16, 6, 47, 17],

      // 22
      [2, 139, 111, 7, 140, 112],
      [17, 74, 46],
      [7, 54, 24, 16, 55, 25],
      [34, 37, 13],

      // 23
      [4, 151, 121, 5, 152, 122],
      [4, 75, 47, 14, 76, 48],
      [11, 54, 24, 14, 55, 25],
      [16, 45, 15, 14, 46, 16],

      // 24
      [6, 147, 117, 4, 148, 118],
      [6, 73, 45, 14, 74, 46],
      [11, 54, 24, 16, 55, 25],
      [30, 46, 16, 2, 47, 17],

      // 25
      [8, 132, 106, 4, 133, 107],
      [8, 75, 47, 13, 76, 48],
      [7, 54, 24, 22, 55, 25],
      [22, 45, 15, 13, 46, 16],

      // 26
      [10, 142, 114, 2, 143, 115],
      [19, 74, 46, 4, 75, 47],
      [28, 50, 22, 6, 51, 23],
      [33, 46, 16, 4, 47, 17],

      // 27
      [8, 152, 122, 4, 153, 123],
      [22, 73, 45, 3, 74, 46],
      [8, 53, 23, 26, 54, 24],
      [12, 45, 15, 28, 46, 16],

      // 28
      [3, 147, 117, 10, 148, 118],
      [3, 73, 45, 23, 74, 46],
      [4, 54, 24, 31, 55, 25],
      [11, 45, 15, 31, 46, 16],

      // 29
      [7, 146, 116, 7, 147, 117],
      [21, 73, 45, 7, 74, 46],
      [1, 53, 23, 37, 54, 24],
      [19, 45, 15, 26, 46, 16],

      // 30
      [5, 145, 115, 10, 146, 116],
      [19, 75, 47, 10, 76, 48],
      [15, 54, 24, 25, 55, 25],
      [23, 45, 15, 25, 46, 16],

      // 31
      [13, 145, 115, 3, 146, 116],
      [2, 74, 46, 29, 75, 47],
      [42, 54, 24, 1, 55, 25],
      [23, 45, 15, 28, 46, 16],

      // 32
      [17, 145, 115],
      [10, 74, 46, 23, 75, 47],
      [10, 54, 24, 35, 55, 25],
      [19, 45, 15, 35, 46, 16],

      // 33
      [17, 145, 115, 1, 146, 116],
      [14, 74, 46, 21, 75, 47],
      [29, 54, 24, 19, 55, 25],
      [11, 45, 15, 46, 46, 16],

      // 34
      [13, 145, 115, 6, 146, 116],
      [14, 74, 46, 23, 75, 47],
      [44, 54, 24, 7, 55, 25],
      [59, 46, 16, 1, 47, 17],

      // 35
      [12, 151, 121, 7, 152, 122],
      [12, 75, 47, 26, 76, 48],
      [39, 54, 24, 14, 55, 25],
      [22, 45, 15, 41, 46, 16],

      // 36
      [6, 151, 121, 14, 152, 122],
      [6, 75, 47, 34, 76, 48],
      [46, 54, 24, 10, 55, 25],
      [2, 45, 15, 64, 46, 16],

      // 37
      [17, 152, 122, 4, 153, 123],
      [29, 74, 46, 14, 75, 47],
      [49, 54, 24, 10, 55, 25],
      [24, 45, 15, 46, 46, 16],

      // 38
      [4, 152, 122, 18, 153, 123],
      [13, 74, 46, 32, 75, 47],
      [48, 54, 24, 14, 55, 25],
      [42, 45, 15, 32, 46, 16],

      // 39
      [20, 147, 117, 4, 148, 118],
      [40, 75, 47, 7, 76, 48],
      [43, 54, 24, 22, 55, 25],
      [10, 45, 15, 67, 46, 16],

      // 40
      [19, 148, 118, 6, 149, 119],
      [18, 75, 47, 31, 76, 48],
      [34, 54, 24, 34, 55, 25],
      [20, 45, 15, 61, 46, 16]
    ];

    var qrRSBlock = function(totalCount, dataCount) {
      var _this = {};
      _this.totalCount = totalCount;
      _this.dataCount = dataCount;
      return _this;
    };

    var _this = {};

    var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {

      switch(errorCorrectionLevel) {
      case QRErrorCorrectionLevel.L :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectionLevel.M :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectionLevel.Q :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectionLevel.H :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default :
        return undefined;
      }
    };

    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {

      var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);

      if (typeof rsBlock == 'undefined') {
        throw 'bad rs block @ typeNumber:' + typeNumber +
            '/errorCorrectionLevel:' + errorCorrectionLevel;
      }

      var length = rsBlock.length / 3;

      var list = [];

      for (var i = 0; i < length; i += 1) {

        var count = rsBlock[i * 3 + 0];
        var totalCount = rsBlock[i * 3 + 1];
        var dataCount = rsBlock[i * 3 + 2];

        for (var j = 0; j < count; j += 1) {
          list.push(qrRSBlock(totalCount, dataCount) );
        }
      }

      return list;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrBitBuffer
  //---------------------------------------------------------------------

  var qrBitBuffer = function() {

    var _buffer = [];
    var _length = 0;

    var _this = {};

    _this.getBuffer = function() {
      return _buffer;
    };

    _this.getAt = function(index) {
      var bufIndex = Math.floor(index / 8);
      return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
    };

    _this.put = function(num, length) {
      for (var i = 0; i < length; i += 1) {
        _this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
      }
    };

    _this.getLengthInBits = function() {
      return _length;
    };

    _this.putBit = function(bit) {

      var bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) {
        _buffer.push(0);
      }

      if (bit) {
        _buffer[bufIndex] |= (0x80 >>> (_length % 8) );
      }

      _length += 1;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrNumber
  //---------------------------------------------------------------------

  var qrNumber = function(data) {

    var _mode = QRMode.MODE_NUMBER;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var data = _data;

      var i = 0;

      while (i + 2 < data.length) {
        buffer.put(strToNum(data.substring(i, i + 3) ), 10);
        i += 3;
      }

      if (i < data.length) {
        if (data.length - i == 1) {
          buffer.put(strToNum(data.substring(i, i + 1) ), 4);
        } else if (data.length - i == 2) {
          buffer.put(strToNum(data.substring(i, i + 2) ), 7);
        }
      }
    };

    var strToNum = function(s) {
      var num = 0;
      for (var i = 0; i < s.length; i += 1) {
        num = num * 10 + chatToNum(s.charAt(i) );
      }
      return num;
    };

    var chatToNum = function(c) {
      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      }
      throw 'illegal char :' + c;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrAlphaNum
  //---------------------------------------------------------------------

  var qrAlphaNum = function(data) {

    var _mode = QRMode.MODE_ALPHA_NUM;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var s = _data;

      var i = 0;

      while (i + 1 < s.length) {
        buffer.put(
          getCode(s.charAt(i) ) * 45 +
          getCode(s.charAt(i + 1) ), 11);
        i += 2;
      }

      if (i < s.length) {
        buffer.put(getCode(s.charAt(i) ), 6);
      }
    };

    var getCode = function(c) {

      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      } else if ('A' <= c && c <= 'Z') {
        return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
      } else {
        switch (c) {
        case ' ' : return 36;
        case '$' : return 37;
        case '%' : return 38;
        case '*' : return 39;
        case '+' : return 40;
        case '-' : return 41;
        case '.' : return 42;
        case '/' : return 43;
        case ':' : return 44;
        default :
          throw 'illegal char :' + c;
        }
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qr8BitByte
  //---------------------------------------------------------------------

  var qr8BitByte = function(data) {

    var _mode = QRMode.MODE_8BIT_BYTE;
    var _data = data;
    var _bytes = qrcode.stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _bytes.length;
    };

    _this.write = function(buffer) {
      for (var i = 0; i < _bytes.length; i += 1) {
        buffer.put(_bytes[i], 8);
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrKanji
  //---------------------------------------------------------------------

  var qrKanji = function(data) {

    var _mode = QRMode.MODE_KANJI;
    var _data = data;

    var stringToBytes = qrcode.stringToBytesFuncs['SJIS'];
    if (!stringToBytes) {
      throw 'sjis not supported.';
    }
    !function(c, code) {
      // self test for sjis support.
      var test = stringToBytes(c);
      if (test.length != 2 || ( (test[0] << 8) | test[1]) != code) {
        throw 'sjis not supported.';
      }
    }('\u53cb', 0x9746);

    var _bytes = stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return ~~(_bytes.length / 2);
    };

    _this.write = function(buffer) {

      var data = _bytes;

      var i = 0;

      while (i + 1 < data.length) {

        var c = ( (0xff & data[i]) << 8) | (0xff & data[i + 1]);

        if (0x8140 <= c && c <= 0x9FFC) {
          c -= 0x8140;
        } else if (0xE040 <= c && c <= 0xEBBF) {
          c -= 0xC140;
        } else {
          throw 'illegal char at ' + (i + 1) + '/' + c;
        }

        c = ( (c >>> 8) & 0xff) * 0xC0 + (c & 0xff);

        buffer.put(c, 13);

        i += 2;
      }

      if (i < data.length) {
        throw 'illegal char at ' + (i + 1);
      }
    };

    return _this;
  };

  //=====================================================================
  // GIF Support etc.
  //

  //---------------------------------------------------------------------
  // byteArrayOutputStream
  //---------------------------------------------------------------------

  var byteArrayOutputStream = function() {

    var _bytes = [];

    var _this = {};

    _this.writeByte = function(b) {
      _bytes.push(b & 0xff);
    };

    _this.writeShort = function(i) {
      _this.writeByte(i);
      _this.writeByte(i >>> 8);
    };

    _this.writeBytes = function(b, off, len) {
      off = off || 0;
      len = len || b.length;
      for (var i = 0; i < len; i += 1) {
        _this.writeByte(b[i + off]);
      }
    };

    _this.writeString = function(s) {
      for (var i = 0; i < s.length; i += 1) {
        _this.writeByte(s.charCodeAt(i) );
      }
    };

    _this.toByteArray = function() {
      return _bytes;
    };

    _this.toString = function() {
      var s = '';
      s += '[';
      for (var i = 0; i < _bytes.length; i += 1) {
        if (i > 0) {
          s += ',';
        }
        s += _bytes[i];
      }
      s += ']';
      return s;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64EncodeOutputStream
  //---------------------------------------------------------------------

  var base64EncodeOutputStream = function() {

    var _buffer = 0;
    var _buflen = 0;
    var _length = 0;
    var _base64 = '';

    var _this = {};

    var writeEncoded = function(b) {
      _base64 += String.fromCharCode(encode(b & 0x3f) );
    };

    var encode = function(n) {
      if (n < 0) {
        // error.
      } else if (n < 26) {
        return 0x41 + n;
      } else if (n < 52) {
        return 0x61 + (n - 26);
      } else if (n < 62) {
        return 0x30 + (n - 52);
      } else if (n == 62) {
        return 0x2b;
      } else if (n == 63) {
        return 0x2f;
      }
      throw 'n:' + n;
    };

    _this.writeByte = function(n) {

      _buffer = (_buffer << 8) | (n & 0xff);
      _buflen += 8;
      _length += 1;

      while (_buflen >= 6) {
        writeEncoded(_buffer >>> (_buflen - 6) );
        _buflen -= 6;
      }
    };

    _this.flush = function() {

      if (_buflen > 0) {
        writeEncoded(_buffer << (6 - _buflen) );
        _buffer = 0;
        _buflen = 0;
      }

      if (_length % 3 != 0) {
        // padding
        var padlen = 3 - _length % 3;
        for (var i = 0; i < padlen; i += 1) {
          _base64 += '=';
        }
      }
    };

    _this.toString = function() {
      return _base64;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64DecodeInputStream
  //---------------------------------------------------------------------

  var base64DecodeInputStream = function(str) {

    var _str = str;
    var _pos = 0;
    var _buffer = 0;
    var _buflen = 0;

    var _this = {};

    _this.read = function() {

      while (_buflen < 8) {

        if (_pos >= _str.length) {
          if (_buflen == 0) {
            return -1;
          }
          throw 'unexpected end of file./' + _buflen;
        }

        var c = _str.charAt(_pos);
        _pos += 1;

        if (c == '=') {
          _buflen = 0;
          return -1;
        } else if (c.match(/^\s$/) ) {
          // ignore if whitespace.
          continue;
        }

        _buffer = (_buffer << 6) | decode(c.charCodeAt(0) );
        _buflen += 6;
      }

      var n = (_buffer >>> (_buflen - 8) ) & 0xff;
      _buflen -= 8;
      return n;
    };

    var decode = function(c) {
      if (0x41 <= c && c <= 0x5a) {
        return c - 0x41;
      } else if (0x61 <= c && c <= 0x7a) {
        return c - 0x61 + 26;
      } else if (0x30 <= c && c <= 0x39) {
        return c - 0x30 + 52;
      } else if (c == 0x2b) {
        return 62;
      } else if (c == 0x2f) {
        return 63;
      } else {
        throw 'c:' + c;
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // gifImage (B/W)
  //---------------------------------------------------------------------

  var gifImage = function(width, height) {

    var _width = width;
    var _height = height;
    var _data = new Array(width * height);

    var _this = {};

    _this.setPixel = function(x, y, pixel) {
      _data[y * _width + x] = pixel;
    };

    _this.write = function(out) {

      //---------------------------------
      // GIF Signature

      out.writeString('GIF87a');

      //---------------------------------
      // Screen Descriptor

      out.writeShort(_width);
      out.writeShort(_height);

      out.writeByte(0x80); // 2bit
      out.writeByte(0);
      out.writeByte(0);

      //---------------------------------
      // Global Color Map

      // black
      out.writeByte(0x00);
      out.writeByte(0x00);
      out.writeByte(0x00);

      // white
      out.writeByte(0xff);
      out.writeByte(0xff);
      out.writeByte(0xff);

      //---------------------------------
      // Image Descriptor

      out.writeString(',');
      out.writeShort(0);
      out.writeShort(0);
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(0);

      //---------------------------------
      // Local Color Map

      //---------------------------------
      // Raster Data

      var lzwMinCodeSize = 2;
      var raster = getLZWRaster(lzwMinCodeSize);

      out.writeByte(lzwMinCodeSize);

      var offset = 0;

      while (raster.length - offset > 255) {
        out.writeByte(255);
        out.writeBytes(raster, offset, 255);
        offset += 255;
      }

      out.writeByte(raster.length - offset);
      out.writeBytes(raster, offset, raster.length - offset);
      out.writeByte(0x00);

      //---------------------------------
      // GIF Terminator
      out.writeString(';');
    };

    var bitOutputStream = function(out) {

      var _out = out;
      var _bitLength = 0;
      var _bitBuffer = 0;

      var _this = {};

      _this.write = function(data, length) {

        if ( (data >>> length) != 0) {
          throw 'length over';
        }

        while (_bitLength + length >= 8) {
          _out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );
          length -= (8 - _bitLength);
          data >>>= (8 - _bitLength);
          _bitBuffer = 0;
          _bitLength = 0;
        }

        _bitBuffer = (data << _bitLength) | _bitBuffer;
        _bitLength = _bitLength + length;
      };

      _this.flush = function() {
        if (_bitLength > 0) {
          _out.writeByte(_bitBuffer);
        }
      };

      return _this;
    };

    var getLZWRaster = function(lzwMinCodeSize) {

      var clearCode = 1 << lzwMinCodeSize;
      var endCode = (1 << lzwMinCodeSize) + 1;
      var bitLength = lzwMinCodeSize + 1;

      // Setup LZWTable
      var table = lzwTable();

      for (var i = 0; i < clearCode; i += 1) {
        table.add(String.fromCharCode(i) );
      }
      table.add(String.fromCharCode(clearCode) );
      table.add(String.fromCharCode(endCode) );

      var byteOut = byteArrayOutputStream();
      var bitOut = bitOutputStream(byteOut);

      // clear code
      bitOut.write(clearCode, bitLength);

      var dataIndex = 0;

      var s = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;

      while (dataIndex < _data.length) {

        var c = String.fromCharCode(_data[dataIndex]);
        dataIndex += 1;

        if (table.contains(s + c) ) {

          s = s + c;

        } else {

          bitOut.write(table.indexOf(s), bitLength);

          if (table.size() < 0xfff) {

            if (table.size() == (1 << bitLength) ) {
              bitLength += 1;
            }

            table.add(s + c);
          }

          s = c;
        }
      }

      bitOut.write(table.indexOf(s), bitLength);

      // end code
      bitOut.write(endCode, bitLength);

      bitOut.flush();

      return byteOut.toByteArray();
    };

    var lzwTable = function() {

      var _map = {};
      var _size = 0;

      var _this = {};

      _this.add = function(key) {
        if (_this.contains(key) ) {
          throw 'dup key:' + key;
        }
        _map[key] = _size;
        _size += 1;
      };

      _this.size = function() {
        return _size;
      };

      _this.indexOf = function(key) {
        return _map[key];
      };

      _this.contains = function(key) {
        return typeof _map[key] != 'undefined';
      };

      return _this;
    };

    return _this;
  };

  var createDataURL = function(width, height, getPixel) {
    var gif = gifImage(width, height);
    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        gif.setPixel(x, y, getPixel(x, y) );
      }
    }

    var b = byteArrayOutputStream();
    gif.write(b);

    var base64 = base64EncodeOutputStream();
    var bytes = b.toByteArray();
    for (var i = 0; i < bytes.length; i += 1) {
      base64.writeByte(bytes[i]);
    }
    base64.flush();

    return 'data:image/gif;base64,' + base64;
  };

  //---------------------------------------------------------------------
  // returns qrcode function.

  return qrcode;
}();

// multibyte support
!function() {

  qrcode.stringToBytesFuncs['UTF-8'] = function(s) {
    // http://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array
    function toUTF8Array(str) {
      var utf8 = [];
      for (var i=0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6),
              0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
          utf8.push(0xe0 | (charcode >> 12),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
          i++;
          // UTF-16 encodes 0x10000-0x10FFFF by
          // subtracting 0x10000 and splitting the
          // 20 bits of 0x0-0xFFFFF into two halves
          charcode = 0x10000 + (((charcode & 0x3ff)<<10)
            | (str.charCodeAt(i) & 0x3ff));
          utf8.push(0xf0 | (charcode >>18),
              0x80 | ((charcode>>12) & 0x3f),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
      }
      return utf8;
    }
    return toUTF8Array(s);
  };

}();

(function (factory) {
  if (typeof define === 'function' && define.amd) {
      define([], factory);
  } else if (typeof exports === 'object') {
      module.exports = factory();
  }
}(function () {
    return qrcode;
}));

/* ===== QRX：QR 碼外觀引擎＋編輯器（需要 qrcode-generator） ===== */
(function(){
if (window.qrcode && qrcode.stringToBytesFuncs) qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

const DEFAULT = {
  pattern:'square', eyeOuter:'square', eyeInner:'square',
  fill:'solid', fg:'#000000', fg2:'#3d6b5a', angle:45,
  customEye:false, eyeOuterColor:'#000000', eyeInnerColor:'#000000',
  bg:'#ffffff', transparent:false,
  logo:'', logoSize:0.22, logoPlate:true, logoX:0, logoY:0, ec:'M', margin:4, dotSize:1, version:0,
  frame:'none', frameColor:'#000000', frameText:'SCAN ME'
};

const PATTERNS = [
  ['square','方塊'], ['small','小方塊'], ['rounded','圓角'], ['connected','流線'], ['dot','圓點'],
  ['classy','葉片'], ['diamond','菱形'], ['plus','十字'], ['vbar','直條'], ['hbar','橫條']
];
const EYE_OUTER = [['square','方形'], ['rounded','圓角'], ['extra','大圓角'], ['circle','圓形'], ['leaf','葉片']];
const EYE_INNER = [['square','方形'], ['rounded','圓角'], ['circle','圓形'], ['leaf','葉片'], ['diamond','菱形']];
const FRAMES = [['none','無'], ['bottom','底部文字'], ['top','頂部文字'], ['bubble','對話框'], ['circle','圓形徽章'], ['outline','細線框']];

const TEMPLATES = [
  ['經典', {}],
  ['森林', {pattern:'rounded', eyeOuter:'rounded', eyeInner:'rounded', fill:'linear', fg:'#2a4a3e', fg2:'#4b8068', frame:'bottom', frameColor:'#2a4a3e'}],
  ['海洋', {pattern:'dot', eyeOuter:'extra', eyeInner:'circle', fill:'linear', fg:'#1e3a8a', fg2:'#0369a1', customEye:true, eyeOuterColor:'#1e3a8a', eyeInnerColor:'#0284c7', frame:'bubble', frameColor:'#1e3a8a'}],
  ['莓果', {pattern:'classy', eyeOuter:'leaf', eyeInner:'leaf', fill:'linear', fg:'#7e22ce', fg2:'#db2777', frame:'bottom', frameColor:'#7e22ce'}],
  ['夕陽', {pattern:'connected', eyeOuter:'rounded', eyeInner:'square', fill:'radial', fg:'#c2410c', fg2:'#7c2d12', bg:'#fff7ed', frame:'top', frameColor:'#c2410c'}],
  ['墨水徽章', {pattern:'dot', eyeOuter:'circle', eyeInner:'circle', fg:'#111827', frame:'circle', frameColor:'#111827'}],
  ['書店', {pattern:'vbar', eyeOuter:'rounded', eyeInner:'rounded', fg:'#5b3a29', bg:'#fdf6ec', customEye:true, eyeOuterColor:'#5b3a29', eyeInnerColor:'#b45309', frame:'outline', frameColor:'#5b3a29'}],
  ['極簡', {pattern:'small', eyeOuter:'extra', eyeInner:'circle', fg:'#334155', frame:'none'}]
];

/* ---------- 色彩 ---------- */
function lum(hex){
  const v = (hex || '#000').replace('#',''), rgb = [0,2,4].map(i => parseInt(v.substr(i,2),16) / 255)
    .map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126*rgb[0] + 0.7152*rgb[1] + 0.0722*rgb[2];
}
function contrast(a, b){ const x = lum(a), y = lum(b); return (Math.max(x,y) + 0.05) / (Math.min(x,y) + 0.05); }
function ink(bg){ return lum(bg) > 0.4 ? '#111111' : '#ffffff'; }
function escX(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ---------- 形狀 ---------- */
const f = v => +v.toFixed(3);
function rr4(x, y, w, h, r){ // r = [tl,tr,br,bl]
  var a = Math.min(r[0], w/2, h/2), b = Math.min(r[1], w/2, h/2), c = Math.min(r[2], w/2, h/2), d = Math.min(r[3], w/2, h/2);
  var arc = function(rad, ex, ey){ return rad ? 'A' + f(rad) + ' ' + f(rad) + ' 0 0 1 ' + f(ex) + ' ' + f(ey) : ''; };
  return 'M' + f(x+a) + ' ' + f(y) + 'H' + f(x+w-b) + arc(b, x+w, y+b) + 'V' + f(y+h-c) + arc(c, x+w-c, y+h)
       + 'H' + f(x+d) + arc(d, x, y+h-d) + 'V' + f(y+a) + arc(a, x+a, y) + 'Z';
}
const rr = (x, y, w, h, r) => rr4(x, y, w, h, [r,r,r,r]);
const circ = (cx, cy, r) => `M${f(cx-r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2*r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2*r)} 0Z`;
const diam = (x, y, s) => `M${f(x+s/2)} ${f(y)}L${f(x+s)} ${f(y+s/2)}L${f(x+s/2)} ${f(y+s)}L${f(x)} ${f(y+s/2)}Z`;

function eyeOuterPath(shape, x, y){
  switch(shape){
    case 'rounded': return rr(x,y,7,7,2) + rr(x+1,y+1,5,5,1.2);
    case 'extra':   return rr(x,y,7,7,3) + rr(x+1,y+1,5,5,2.2);
    case 'circle':  return circ(x+3.5,y+3.5,3.5) + circ(x+3.5,y+3.5,2.5);
    case 'leaf':    return rr4(x,y,7,7,[3,0,3,0]) + rr4(x+1,y+1,5,5,[2.2,0,2.2,0]);
    default:        return rr(x,y,7,7,0) + rr(x+1,y+1,5,5,0);
  }
}
function eyeInnerPath(shape, x, y){
  x += 2; y += 2;
  switch(shape){
    case 'rounded': return rr(x,y,3,3,0.9);
    case 'circle':  return circ(x+1.5,y+1.5,1.5);
    case 'leaf':    return rr4(x,y,3,3,[1.4,0,1.4,0]);
    case 'diamond': return diam(x-0.3,y-0.3,3.6);
    default:        return rr(x,y,3,3,0);
  }
}

/* ---------- 產生 SVG ---------- */
let GID = 0, LAST = null;
function build(text, st){
  const gid = 'qg' + (++GID) + Math.random().toString(36).slice(2, 6);
  st = Object.assign({}, DEFAULT, st || {});
  const order = ['L','M','Q','H'];
  let ec = order.indexOf(st.ec) < 0 ? 1 : order.indexOf(st.ec);
  // 格數：0 = 自動用最小尺寸；指定尺寸時，在裝得下的前提下自動用最高容錯（更耐髒）
  let q = null;
  const want = Math.max(0, Math.min(40, Math.round(+st.version || 0)));
  if (want){
    for (let e = 3; e >= ec && !q; e--){
      try { const t = qrcode(want, order[e]); t.addData(text || ' '); t.make(); q = t; ec = e; } catch (err) {}
    }
  }
  if (!q){ q = qrcode(0, order[ec]); q.addData(text || ' '); q.make(); }
  const n = q.getModuleCount(), Q = Math.max(1, Math.min(8, Math.round(+st.margin >= 0 ? +st.margin : 4))), S = n + Q*2;
  const dark = (r, c) => r >= 0 && c >= 0 && r < n && c < n && q.isDark(r, c);
  const inEye = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n-7) || (r >= n-7 && c < 7);

  // logo 區
  let lg = null;
  if (st.logo){
    const sz = Math.max(3, Math.round(n * Math.min(0.3, Math.max(0.08, +st.logoSize || 0.22))));
    const lo = (n - sz) / 2, lim = (a, v) => Math.max(8, Math.min(n - 8 - sz, v)); // 不能蓋到三個定位角
    lg = { x: lim(0, lo + (+st.logoX || 0) * n), y: lim(0, lo + (+st.logoY || 0) * n), s: sz };
  }
  const covered = (r, c) => lg && (c + 0.5) > lg.x - 0.6 && (c + 0.5) < lg.x + lg.s + 0.6 && (r + 0.5) > lg.y - 0.6 && (r + 0.5) < lg.y + lg.s + 0.6;
  const on = (r, c) => dark(r, c) && !inEye(r, c) && !covered(r, c);

  // 點
  let d = '';
  const K = Math.max(0.5, Math.min(1, +st.dotSize || 1));
  const P = st.pattern;
  if (P === 'vbar' || P === 'hbar'){
    for (let a = 0; a < n; a++){
      let start = -1;
      for (let b = 0; b <= n; b++){
        const r = P === 'vbar' ? b : a, c = P === 'vbar' ? a : b;
        const isOn = b < n && on(r, c);
        if (isOn && start < 0) start = b;
        if (!isOn && start >= 0){
          const len = b - start;
          const t = 0.8 * K, o = (1 - t) / 2;
          d += P === 'vbar' ? rr(Q+a+o, Q+start+0.05, t, len-0.1, t/2) : rr(Q+start+0.05, Q+a+o, len-0.1, t, t/2);
          start = -1;
        }
      }
    }
  } else {
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++){
      if (!on(r, c)) continue;
      const x = Q + c, y = Q + r;
      const sq = (w, rad) => { const o = (1 - w * K) / 2; return rr(x + o, y + o, w * K, w * K, rad * K); };
      switch(P){
        case 'small':   d += sq(0.76, 0); break;
        case 'rounded': d += sq(0.9, 0.3); break;
        case 'dot':     d += circ(x+0.5, y+0.5, 0.45 * K); break;
        case 'diamond': { const w = 1.04 * K, o = (1 - w) / 2; d += diam(x+o, y+o, w); break; }
        case 'plus':    { const a = 0.3 * K, b = 0.4 * K, o = (1 - K) / 2, X0 = x + o, Y0 = y + o;
                          d += `M${f(X0+a)} ${f(Y0)}h${f(b)}v${f(a)}h${f(a)}v${f(b)}h${f(-a)}v${f(a)}h${f(-b)}v${f(-a)}h${f(-a)}v${f(-b)}h${f(a)}Z`; break; }
        case 'classy':  { const w = 0.92 * K, o = (1 - w) / 2; d += rr4(x+o, y+o, w, w, [0.42*K,0,0.42*K,0]); break; }
        case 'connected': {
          const u = on(r-1,c), dn = on(r+1,c), l = on(r,c-1), rt = on(r,c+1), R = 0.5;
          d += rr4(x, y, 1, 1, [(!u&&!l)?R:0, (!u&&!rt)?R:0, (!dn&&!rt)?R:0, (!dn&&!l)?R:0]); break;
        }
        default: d += K >= 1 ? `M${x} ${y}h1v1h-1Z` : sq(1, 0);
      }
    }
  }

  // 定位角
  let eo = '', ei = '';
  [[0,0],[0,n-7],[n-7,0]].forEach(([r, c]) => {
    eo += eyeOuterPath(st.eyeOuter, Q+c, Q+r);
    ei += eyeInnerPath(st.eyeInner, Q+c, Q+r);
  });

  // 填色
  const bgColor = st.transparent ? 'none' : st.bg;
  let defs = '', fill = st.fg;
  if (st.fill === 'linear' || st.fill === 'radial'){
    if (st.fill === 'linear'){
      const a = (+st.angle || 0) * Math.PI / 180, cx = S/2, cy = S/2, L = S/2;
      defs += `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${f(cx-Math.cos(a)*L)}" y1="${f(cy-Math.sin(a)*L)}" x2="${f(cx+Math.cos(a)*L)}" y2="${f(cy+Math.sin(a)*L)}"><stop offset="0" stop-color="${st.fg}"/><stop offset="1" stop-color="${st.fg2}"/></linearGradient>`;
    } else {
      defs += `<radialGradient id="${gid}" gradientUnits="userSpaceOnUse" cx="${S/2}" cy="${S/2}" r="${f(S*0.6)}"><stop offset="0" stop-color="${st.fg}"/><stop offset="1" stop-color="${st.fg2}"/></radialGradient>`;
    }
    fill = `url(#${gid})`;
  }
  const eoFill = st.customEye ? st.eyeOuterColor : fill, eiFill = st.customEye ? st.eyeInnerColor : fill;

  let qr = '';
  qr += `<path d="${d}" fill="${fill}"/>`;
  qr += `<path d="${eo}" fill="${eoFill}" fill-rule="evenodd"/>`;
  qr += `<path d="${ei}" fill="${eiFill}"/>`;
  if (lg){
    const pad = 0.4, plateFill = st.transparent ? '#ffffff' : st.bg;
    if (st.logoPlate) qr += `<rect x="${f(Q+lg.x-pad)}" y="${f(Q+lg.y-pad)}" width="${f(lg.s+pad*2)}" height="${f(lg.s+pad*2)}" rx="${f(lg.s*0.18)}" fill="${plateFill}"/>`;
    const ins = st.logoPlate ? lg.s * 0.06 : 0;
    qr += `<image href="${st.logo}" xlink:href="${st.logo}" x="${f(Q+lg.x+ins)}" y="${f(Q+lg.y+ins)}" width="${f(lg.s-ins*2)}" height="${f(lg.s-ins*2)}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  // 外框
  const fr = st.frame, fc = st.frameColor, txt = escX(st.frameText || '');
  const font = `font-family='-apple-system,"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif' font-weight='700' text-anchor='middle'`;
  let W = S, H = S, body = '', ox = 0, oy = 0;
  const qrBg = `<rect width="${S}" height="${S}" fill="${bgColor}"/>`;

  if (fr === 'bottom' || fr === 'top'){
    const p = 1.6, bar = S * 0.2;
    W = S + p*2; H = S + p*2 + bar;
    oy = fr === 'top' ? p + bar : p; ox = p;
    const ty = fr === 'top' ? p + bar*0.55 : p + S + bar*0.45;
    body = `<rect width="${f(W)}" height="${f(H)}" rx="${f(S*0.07)}" fill="${fc}"/>`
         + `<rect x="${ox}" y="${f(oy)}" width="${S}" height="${S}" rx="${f(S*0.04)}" fill="${st.transparent ? '#ffffff' : st.bg}"/>`
         + `<text x="${f(W/2)}" y="${f(ty)}" dy="0.35em" font-size="${f(bar*0.46)}" fill="${ink(fc)}" ${font}>${txt}</text>`;
  } else if (fr === 'bubble'){
    const p = 1.2, gap = S*0.06, bar = S*0.17, tri = S*0.05;
    W = S + p*2; H = S + p*2 + gap + bar;
    ox = p; oy = p;
    const by = S + p*2 + gap;
    body = `<rect x="${f(p*0.4)}" y="${f(p*0.4)}" width="${f(W-p*0.8)}" height="${f(S+p*1.2)}" rx="${f(S*0.05)}" fill="${st.transparent ? '#ffffff' : st.bg}" stroke="${fc}" stroke-width="${f(p*0.8)}"/>`
         + `<path d="M${f(W/2-tri)} ${f(by+0.01)}L${f(W/2)} ${f(by-tri)}L${f(W/2+tri)} ${f(by+0.01)}Z" fill="${fc}"/>`
         + `<rect x="${f(S*0.12)}" y="${f(by)}" width="${f(W-S*0.24)}" height="${f(bar)}" rx="${f(bar/2)}" fill="${fc}"/>`
         + `<text x="${f(W/2)}" y="${f(by+bar/2)}" dy="0.35em" font-size="${f(bar*0.5)}" fill="${ink(fc)}" ${font}>${txt}</text>`;
  } else if (fr === 'circle'){
    const R = S * 0.74, ring = S * 0.05;
    W = H = R*2; ox = R - S/2; oy = R - S/2 - S*0.06;
    body = `<circle cx="${f(R)}" cy="${f(R)}" r="${f(R)}" fill="${fc}"/>`
         + `<circle cx="${f(R)}" cy="${f(R)}" r="${f(R-ring)}" fill="${st.transparent ? '#ffffff' : st.bg}"/>`
         + `<text x="${f(R)}" y="${f(oy+S+(R*2-oy-S)*0.42)}" dy="0.35em" font-size="${f(S*0.085)}" fill="${fc}" ${font}>${txt}</text>`;
  } else if (fr === 'outline'){
    const p = 1.6, bar = S*0.16;
    W = S + p*2; H = S + p*2 + bar; ox = p; oy = p;
    body = `<rect x="0.3" y="0.3" width="${f(W-0.6)}" height="${f(H-0.6)}" rx="${f(S*0.06)}" fill="${st.transparent ? 'none' : st.bg}" stroke="${fc}" stroke-width="0.6"/>`
         + `<text x="${f(W/2)}" y="${f(p+S+bar*0.4)}" dy="0.35em" font-size="${f(bar*0.5)}" fill="${fc}" ${font}>${txt}</text>`;
  }

  const inner = (fr === 'none' ? qrBg : '') + qr;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${f(W)} ${f(H)}" width="${f(W*10)}" height="${f(H*10)}">`
    + (defs ? `<defs>${defs}</defs>` : '')
    + body
    + `<g transform="translate(${f(ox)} ${f(oy)})">${inner}</g></svg>`;
  // logo 蓋住多少點（用來估算讀不到的風險）
  let cov = 0;
  if (lg){
    let hidden = 0, total = 0;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++){ if (inEye(r, c)) continue; total++; if (covered(r, c)) hidden++; }
    cov = hidden / total;
  }
  const info = { n, ec: order[ec], cov, cap: { L:0.07, M:0.15, Q:0.25, H:0.30 }[order[ec]] };
  LAST = info;
  return { svg, w: W, h: H, n, info };
}

function toPNG(text, st, width, jpg){
  const b = build(text, st);
  const scale = (width || 1200) / b.w;
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.round(b.w * scale); c.height = Math.round(b.h * scale);
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      if (jpg){ x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height); }
      x.drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL(jpg ? 'image/jpeg' : 'image/png', 0.95));
    };
    img.onerror = rej;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(b.svg);
  });
}

function logoRisk(info){
  if (!info || !info.cov) return null;
  const ratio = info.cov / info.cap;
  const level = ratio < 0.45 ? 'ok' : ratio < 0.75 ? 'warn' : 'bad';
  return { level, ratio, cov: Math.round(info.cov * 100), cap: Math.round(info.cap * 100),
    text: 'logo 蓋住約 ' + (Math.round(info.cov * 1000) / 10) + '% 的點，目前容錯率最多可修復約 ' + Math.round(info.cap * 100) + '%',
    label: level === 'ok' ? '風險低' : level === 'warn' ? '風險中：印刷有髒污或反光時可能讀不到' : '風險高：很可能讀不到，請縮小 logo 或調密' };
}
function warnings(st, info){
  st = Object.assign({}, DEFAULT, st || {});
  const out = [], bg = st.transparent ? '#ffffff' : st.bg;
  if (st.logo){
    const rk = logoRisk(info || LAST);
    if (rk && rk.level !== 'ok') out.push('⚠️ ' + rk.text + '，' + rk.label);
  }
  const cols = [st.fg].concat(st.fill !== 'solid' ? [st.fg2] : []).concat(st.customEye ? [st.eyeOuterColor, st.eyeInnerColor] : []);
  const worst = Math.min.apply(null, cols.map(c => contrast(c, bg)));
  if (worst < 3) out.push('⚠️ 顏色對比太低，可能掃不到');
  else if (cols.some(c => lum(c) > lum(bg))) out.push('⚠️ 淺色點配深色底（反白），部分舊手機或掃描 App 讀不到');
  if ((+st.dotSize || 1) < 0.7) out.push('⚠️ 點縮得很小，遠距離或印刷較小時可能讀不到');
  if (!out.length && st.transparent) out.push('透明背景：請放在淺色底上使用');
  return out.join('\n');
}

function normalize(st){ // 相容舊版設定
  st = Object.assign({}, st || {});
  if (st.dot){ st.pattern = {round:'rounded', dot:'dot', square:'square'}[st.dot] || 'square'; delete st.dot; }
  if (st.eye){ st.eyeOuter = {round:'rounded', circle:'circle'}[st.eye] || 'square'; st.eyeInner = {round:'rounded', circle:'circle'}[st.eye] || 'square'; delete st.eye; }
  if (st.eyeColor){ if (st.eyeColor.toLowerCase() !== (st.fg || '#000000').toLowerCase()){ st.customEye = true; st.eyeOuterColor = st.eyeInnerColor = st.eyeColor; } delete st.eyeColor; }
  if (st.cta !== undefined){ st.frameText = st.cta; delete st.cta; }
  return Object.assign({}, DEFAULT, st);
}

/* ---------- 編輯器 ---------- */
const CSS = `
.qx{font-size:14px}
.qx-tabs{display:flex;gap:4px;overflow-x:auto;border-bottom:1px solid #e6e2da;margin-bottom:12px;-webkit-overflow-scrolling:touch}
.qx-tabs button{background:none;border:0;border-bottom:2px solid transparent;color:#4a524e;padding:9px 12px;font-weight:500;font:inherit;white-space:nowrap;cursor:pointer;border-radius:0}
.qx-tabs button.on{color:#2e7a55;border-bottom-color:#2e7a55;font-weight:700}
.qx-pane{display:none}.qx-pane.on{display:block}
.qx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:8px}
.qx-opt{background:#fff;border:1.5px solid #e6e2da;border-radius:12px;padding:8px 6px 6px;transition:border-color .15s,background .15s;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px;color:#555}
.qx-opt.on{border-color:#2e7a55;background:#e4eedf;color:#256646;font-weight:700}
.qx-opt svg{width:100%;height:auto;max-width:72px}
.qx-row{display:grid;grid-template-columns:96px 1fr;gap:10px;align-items:center;margin:10px 0}
.qx-row label{color:#555}
.qx input[type=color]{width:56px;height:36px;padding:2px;border:1px solid #e6e2da;border-radius:8px;background:#fff}
.qx input[type=text]{width:100%;padding:8px 10px;border:1px solid #e6e2da;border-radius:8px;font:inherit}
.qx input[type=range]{width:100%}
.qx-seg{display:flex;flex-wrap:wrap;gap:6px}
.qx-seg button{background:#fff;color:#2b2b2b;border:1px solid #e6e2da;border-radius:8px;padding:6px 11px;font:inherit;font-size:13px;cursor:pointer}
.qx-seg button.on{background:#2e7a55;color:#fff;border-color:#2e7a55}
.qx-h{font-weight:700;margin:14px 0 6px;color:#333}
.qx-note{color:#888;font-size:12px;margin-top:6px}
.qx-logo{display:flex;gap:10px;align-items:center}
.qx-logo .pv{width:56px;height:56px;border:1px dashed #ccc;border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#fafafa}
.qx-logo .pv img{max-width:100%;max-height:100%}

.qx-opt:hover{border-color:#d9d4ca;background:#faf9f6}
.qx input[type=range]{accent-color:#2e7a55}

.qx-opt{background:#fffef9;border-color:#e2ddcb;border-radius:6px}
.qx-opt.on{background:#e4eedf}
.qx-seg button{border-radius:999px;background:transparent;border-color:#d3cdb6;color:#4e5548;box-shadow:none;font-weight:500;padding:6px 13px}
.qx-seg button.on,.qx-seg button.on:hover{background:linear-gradient(110deg,#2a7a5a,#3c8a4c);border-color:transparent;color:#fff}
.qx-tabs{border-color:#e2ddcb}
.qx-tabs button{box-shadow:none;letter-spacing:.1em;padding:9px 12px;border-radius:0;background:none}
.qx-tabs button.on{color:#2e7a55;border-bottom-color:#2e7a55}
.qx-h{color:#3f7d45;letter-spacing:.12em}
.qx-row label{color:#3f7d45}
.qx input[type=text]{background:#fffef9;border-color:#d3cdb6;border-radius:6px}

.qx-h,.qx-row label{color:#4e5548}
.qx-opt.on{background:#f1efe3;border-color:#2e7a55;color:#2b2f27}

.qx-risk{margin:6px 0 4px}
.qx-meter{height:8px;border-radius:6px;background:#e7e3d2;overflow:hidden}
.qx-meter i{display:block;height:100%;border-radius:6px;background:#2e7a55;transition:width .2s}
.qx-meter.warn i{background:#c58a00}.qx-meter.bad i{background:#b42318}
.qx-rt{font-size:12.5px;margin-top:6px;line-height:1.6;color:#2e7a55}
.qx-rt.warn{color:#9a6700}.qx-rt.bad{color:#b42318}

#warn{white-space:pre-line;line-height:1.6}
`;

function editor(root, opts){
  if (!document.getElementById('qx-css')){ const s = document.createElement('style'); s.id = 'qx-css'; s.textContent = CSS; document.head.appendChild(s); }
  let st = normalize(opts.style);
  const sampleText = 'https://example.com/qr';
  const thumb = patch => build(sampleText, Object.assign({}, DEFAULT, {frame:'none'}, patch)).svg;
  const eyeThumb = (outer, inner) => `<svg viewBox="-0.5 -0.5 8 8"><path d="${eyeOuterPath(outer||'square',0,0)}" fill="#222" fill-rule="evenodd"/><path d="${eyeInnerPath(inner||'square',0,0)}" fill="#222"/></svg>`;
  const patThumb = p => {
    const b = build('QX', Object.assign({}, DEFAULT, {pattern:p}));
    return b.svg.replace(/viewBox="[^"]+"/, `viewBox="13 13 9 7"`);
  };

  const opt = (key, val, label, svg) => `<div class="qx-opt" data-k="${key}" data-v="${val}">${svg}<span>${label}</span></div>`;
  const seg = (key, items) => `<div class="qx-seg" data-k="${key}">${items.map(([v,l]) => `<button type="button" data-v="${v}">${l}</button>`).join('')}</div>`;

  root.classList.add('qx');
  root.innerHTML = `
    <div class="qx-tabs">
      <button type="button" data-t="tpl" class="on">範本</button><button type="button" data-t="pat">圖樣</button>
      <button type="button" data-t="eye">定位角</button><button type="button" data-t="col">顏色</button>
      <button type="button" data-t="logo">Logo</button><button type="button" data-t="frame">外框</button>
    </div>
    <div class="qx-pane on" data-p="tpl"><div class="qx-grid">${TEMPLATES.map(([name, p], i) => `<div class="qx-opt" data-tpl="${i}">${thumb(Object.assign({frameText:'SCAN'}, p))}<span>${name}</span></div>`).join('')}</div>
      <div class="qx-note">套用範本會覆蓋目前的樣式（logo 會保留）。</div></div>
    <div class="qx-pane" data-p="pat"><div class="qx-grid">${PATTERNS.map(([v,l]) => opt('pattern', v, l, patThumb(v))).join('')}</div>
      <div class="qx-h">細緻度（格數）</div>
      <div class="qx-row" style="margin:4px 0"><label data-vlabel></label><input type="range" min="1" max="40" step="1" data-r="version"></div>
      <div class="qx-note" data-vnote>往左最疏（最少點）；往右格子變多、看起來更細緻，多出來的空間會自動用來提高容錯，更耐髒污。</div>
      <div class="qx-h">最低容錯率</div>
      ${seg('ec', [['L','最疏'],['M','標準'],['Q','較密'],['H','最密']])}
      <div class="qx-note" data-ecinfo></div>
      <div class="qx-h">點的大小</div>
      <div class="qx-row" style="margin:4px 0"><label data-dlabel></label><input type="range" min="0.5" max="1" step="0.05" data-r="dotSize"></div>
      <div class="qx-note">點縮小後看起來比較疏、比較精緻，但太小會不好掃，建議 70% 以上。</div>
      <div class="qx-h">四周留白</div>
      <div class="qx-row" style="margin:4px 0"><label data-mlabel></label><input type="range" min="1" max="8" step="1" data-r="margin"></div>
      <div class="qx-note">建議至少 2 格，印刷時旁邊有其他圖文就留 4 格。</div>
    </div>
    <div class="qx-pane" data-p="eye">
      <div class="qx-h">外框</div><div class="qx-grid">${EYE_OUTER.map(([v,l]) => opt('eyeOuter', v, l, eyeThumb(v, 'square'))).join('')}</div>
      <div class="qx-h">內心</div><div class="qx-grid">${EYE_INNER.map(([v,l]) => opt('eyeInner', v, l, eyeThumb('square', v))).join('')}</div>
    </div>
    <div class="qx-pane" data-p="col">
      <div class="qx-row"><label>填色方式</label>${seg('fill', [['solid','單色'],['linear','線性漸層'],['radial','放射漸層']])}</div>
      <div class="qx-row"><label>主色</label><input type="color" data-c="fg"></div>
      <div class="qx-row qx-g"><label>漸層色</label><input type="color" data-c="fg2"></div>
      <div class="qx-row qx-gl"><label>漸層方向</label>${seg('angle', [['0','→'],['45','↘'],['90','↓'],['135','↙']])}</div>
      <div class="qx-row"><label>定位角配色</label>${seg('customEye', [['false','同主色'],['true','自訂']])}</div>
      <div class="qx-row qx-e"><label>定位角外框</label><input type="color" data-c="eyeOuterColor"></div>
      <div class="qx-row qx-e"><label>定位角內心</label><input type="color" data-c="eyeInnerColor"></div>
      <div class="qx-row"><label>背景</label><input type="color" data-c="bg"></div>
      <div class="qx-row"><label>透明背景</label>${seg('transparent', [['false','否'],['true','是']])}</div>
    </div>
    <div class="qx-pane" data-p="logo">
      <div class="qx-logo"><div class="pv" data-logopv></div>
        <div class="qx-seg"><button type="button" data-act="pick">上傳圖片</button><button type="button" data-act="rm">移除</button></div>
        <input type="file" accept="image/*" data-file style="display:none"></div>
      <div class="qx-row"><label data-llabel>大小</label><input type="range" min="0.08" max="0.3" step="0.01" data-r="logoSize"></div>
      <div class="qx-risk" data-risk></div>
      <div class="qx-row"><label>容錯率</label>${seg('ec', [['L','最低 7%'],['M','標準 15%'],['Q','較高 25%'],['H','最高 30%']])}</div>
      <div class="qx-row"><label data-xlabel>水平位置</label><input type="range" min="-0.3" max="0.3" step="0.01" data-r="logoX"></div>
      <div class="qx-row"><label data-ylabel>垂直位置</label><input type="range" min="-0.3" max="0.3" step="0.01" data-r="logoY"></div>
      <div class="qx-seg" style="margin:-2px 0 8px 106px"><button type="button" data-act="center">回到正中央</button></div>
      <div class="qx-row"><label>logo 底板</label>${seg('logoPlate', [['true','有'],['false','無']])}</div>
      <div class="qx-note">紅色代表很可能讀不到：把 logo 縮小，或把容錯率調高到紅字消失。正式印刷前請一定用手機實際掃過。</div>
    </div>
    <div class="qx-pane" data-p="frame">
      <div class="qx-grid">${FRAMES.map(([v,l]) => opt('frame', v, l, thumb({frame:v, frameText:'SCAN'}))).join('')}</div>
      <div class="qx-row"><label>外框顏色</label><input type="color" data-c="frameColor"></div>
      <div class="qx-row"><label>文字</label><input type="text" maxlength="18" data-tx="frameText" placeholder="例：掃我看更多"></div>
    </div>`;

  const $$ = s => root.querySelectorAll(s);
  function sync(){
    $$('.qx-opt[data-k]').forEach(o => o.classList.toggle('on', String(st[o.dataset.k]) === o.dataset.v));
    $$('.qx-seg[data-k] button').forEach(b => b.classList.toggle('on', String(st[b.parentNode.dataset.k]) === b.dataset.v));
    $$('[data-c]').forEach(i => i.value = st[i.dataset.c]);
    $$('[data-r]').forEach(i => i.value = st[i.dataset.r]);
    $$('[data-tx]').forEach(i => { if (document.activeElement !== i) i.value = st[i.dataset.tx]; });
    $$('.qx-g').forEach(e => e.style.display = st.fill === 'solid' ? 'none' : '');
    $$('.qx-gl').forEach(e => e.style.display = st.fill === 'linear' ? '' : 'none');
    $$('.qx-e').forEach(e => e.style.display = st.customEye ? '' : 'none');
    root.querySelector('[data-mlabel]').textContent = st.margin + ' 格';
    if (opts.text){
      const text = opts.text() || ' ';
      const base = build(text, Object.assign({}, st, { version: 0, frame:'none' }));
      const vmin = (base.n - 17) / 4, vmax = Math.min(40, vmin + 10);
      const vr = root.querySelector('[data-r="version"]');
      vr.min = vmin; vr.max = vmax;
      const cur = st.version && st.version >= vmin ? Math.min(st.version, vmax) : vmin;
      vr.value = cur;
      const now = build(text, Object.assign({}, st, { version: cur === vmin ? 0 : cur, frame:'none' }));
      const ecName = { L:'最低', M:'標準', Q:'較高', H:'最高' }[now.info.ec];
      root.querySelector('[data-vlabel]').textContent = now.n + '×' + now.n;
      root.querySelector('[data-vnote]').textContent = '目前 ' + now.n + '×' + now.n + '，容錯率自動用到「' + ecName + '」。往左最疏（最少點）；往右格子變多、看起來更細緻，多出來的空間會自動提高容錯，更耐髒污。';
    }
    root.querySelector('[data-dlabel]').textContent = Math.round((+st.dotSize || 1) * 100) + '%';
    const pos = v => { v = Math.round((+v || 0) * 100); return v === 0 ? '置中' : (v > 0 ? '+' : '') + v + '%'; };
    root.querySelector('[data-xlabel]').textContent = '水平 ' + pos(st.logoX);
    root.querySelector('[data-ylabel]').textContent = '垂直 ' + pos(st.logoY);
    root.querySelector('[data-llabel]').textContent = '大小 ' + Math.round((+st.logoSize || 0.22) * 100) + '%';
    const rbox = root.querySelector('[data-risk]');
    if (st.logo && opts.text){
      const rk = logoRisk(build(opts.text() || ' ', Object.assign({}, st, { frame:'none' })).info);
      const pct = Math.min(100, Math.round(rk.ratio * 100));
      rbox.innerHTML = '<div class="qx-meter ' + rk.level + '"><i style="width:' + pct + '%"></i></div>'
        + '<div class="qx-rt ' + rk.level + '"><b>' + rk.label + '</b><br>' + rk.text + '。</div>';
    } else rbox.innerHTML = st.logo ? '' : '<div class="qx-note">上傳 logo 後，這裡會顯示讀不到的風險。</div>';
    root.querySelector('[data-ecinfo]').textContent = '容錯率越高越耐髒污，但點會變多。' + (st.logo ? '有 logo 時請看 Logo 分頁的風險條。' : '') + '拉大格數時，系統會在這個基礎上自動再提高。';
    root.querySelector('[data-logopv]').innerHTML = st.logo ? `<img src="${st.logo}">` : '<span style="color:#bbb;font-size:12px">無</span>';
  }
  const fire = () => { sync(); opts.onChange && opts.onChange(Object.assign({}, st)); };
  const parse = v => v === 'true' ? true : v === 'false' ? false : (/^\d+$/.test(v) ? +v : v);

  root.addEventListener('click', e => {
    const t = e.target.closest('[data-t]');
    if (t){ $$('.qx-tabs button').forEach(b => b.classList.toggle('on', b === t)); $$('.qx-pane').forEach(p => p.classList.toggle('on', p.dataset.p === t.dataset.t)); return; }
    const tp = e.target.closest('[data-tpl]');
    if (tp){ const logo = st.logo, size = st.logoSize, txt = st.frameText; st = Object.assign({}, DEFAULT, TEMPLATES[+tp.dataset.tpl][1], {logo, logoSize:size, frameText: txt}); return fire(); }
    const o = e.target.closest('.qx-opt[data-k]');
    if (o){ st[o.dataset.k] = o.dataset.v; if (o.dataset.k === 'frame' && o.dataset.v !== 'none' && !st.frameText) st.frameText = 'SCAN ME'; return fire(); }
    const b = e.target.closest('.qx-seg[data-k] button');
    if (b){ st[b.parentNode.dataset.k] = parse(b.dataset.v); return fire(); }
    const act = e.target.closest('[data-act]');
    if (act && act.dataset.act === 'pick') root.querySelector('[data-file]').click();
    if (act && act.dataset.act === 'rm'){ st.logo = ''; fire(); }
    if (act && act.dataset.act === 'center'){ st.logoX = 0; st.logoY = 0; fire(); }
  });
  root.addEventListener('input', e => {
    const i = e.target;
    if (i.dataset.c){ st[i.dataset.c] = i.value; fire(); }
    if (i.dataset.r){ st[i.dataset.r] = (i.dataset.r === 'version' && +i.value === +i.min) ? 0 : +i.value; fire(); }
    if (i.dataset.tx !== undefined){ st[i.dataset.tx] = i.value; fire(); }
  });
  root.querySelector('[data-file]').addEventListener('change', e => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = opts.logoMax || 600, s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        const cx = c.getContext('2d'); cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
        cx.drawImage(img, 0, 0, c.width, c.height);
        let url = c.toDataURL('image/png');
        if (opts.logoLimit && url.length > opts.logoLimit) url = c.toDataURL('image/jpeg', 0.85);
        st.logo = url; fire();
      };
      img.onerror = () => alert('無法讀取這張圖片');
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });

  sync();
  return {
    get: () => Object.assign({}, st),
    set: s => { st = normalize(s); sync(); }
  };
}

window.QRX = { DEFAULT, build, toPNG, warnings, normalize, editor };
})();
