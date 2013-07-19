(function () {
  "use strict";
  var mainbutton, gifSizes = {
    small: [200, 150],
    square: [250, 250],
    normal: [320, 240],
    full: [640, 480]
  };

  function thisBrowserIsBad() {
    track('streaming', 'not supported');
    alert(facetogif.str.nope);
  }

  function getStream(callback, fail) {
    (navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia || thisBrowserIsBad).call(navigator, {video: true}, callback, fail);
  }

  var facetogif = {
    gifSettings: {
      w: 320,
      h: 240,
      ms: 100,
      preset: 'normal'
    },
    changeSize: function (presetName) {
      var preset = gifSizes[presetName];
      if (preset) {
        facetogif.gifSettings.w = preset[0];
        facetogif.gifSettings.h = preset[1];
        facetogif.gifSettings.preset = presetName;
        track('recording', 'changed-size', presetName);
      } else {
        console.log(presetName, 'not found');
      }
      return facetogif.gifSettings;
    },
    recorderFrame: function () {
      var frame = {
        x: 0, y: 0,
        w: null, h: null
      };
      switch (facetogif.gifSettings.preset) {
        case 'normal':
        case 'full':
        case 'small':
          frame.w = facetogif.gifSettings.w;
          frame.h = facetogif.gifSettings.h;
          break;
        case 'square':
          frame.x = -35;
          frame.w = 320;
          frame.h = facetogif.gifSettings.h;
          break;
      }
      return frame;

    },
    canvas: null,
    video: null,
    initCanvas: function () {
      var c = facetogif.canvas;
      c.width = facetogif.gifSettings.w;
      c.height = facetogif.gifSettings.h;
      return c;
    },
    stream: null,
    gifContainer: null,
    controls: null,
    recIndicator: null,
    str: {
      ASK_FOR_PERMISSION: "put your face here",
      STOP_STREAMING: "stop streaming",
      START_RECORDING: "start recording",
      STOP_RECORDING: "make gif",
      COMPILING: "\"it's compiling...\"",
      PAUSE: "▮▮",
      RESUME: "►",
      UPLOADED: "uploaded",
      UPLOADING: "uploading",
      OPTIMISING: "optimising",
      nope: "This browser does not support getUserMedia yet.",
      rusure: "Are you sure?"
    },

    displayGIF: function (img) {
      var article = document.createElement('article');
      article.appendChild(facetogif.controls.cloneNode(true));
      article.appendChild(img);
      article.className = "generated-gif separate " + facetogif.gifSettings.preset;
      img.className = "generated-img";
      facetogif.gifContainer.appendChild(article);
    },

    blobs: [],
    frames: [],
    imgur_client_id: '886730f5763b437',
    do_up: function (blob, callback) {
      var fd = new FormData(),
        xhr = new XMLHttpRequest();
      fd.append('image', blob);
      xhr.open("POST", "https://api.imgur.com/3/image.json");
      xhr.onload = function () {
        callback && callback(JSON.parse(xhr.response));
      }
      xhr.setRequestHeader('Authorization', 'Client-ID ' + facetogif.imgur_client_id);
      xhr.send(fd);
    },
    upload: function (opts) {
      var blob = opts.blob || facetogif.blobs[opts.img.dataset.blobindex];
      if (facetogif.is_blob_too_big(blob)) {
        if (!opts.is_secod_pass) {
          opts.onoptimize && opts.onoptimize();
          opts.is_secod_pass = true;
          facetogif.optimise(facetogif.frames[opts.img.dataset.framesindex], function (blob) {
            opts.blob = blob;
            facetogif.upload(opts);
          });
        } else {
          opts.oncannotupload && opts.oncannotupload();
        }
      } else {
        opts.oncanupload && opts.oncanupload();
        facetogif.do_up(blob, opts.onuploaded);
      }
    },

    // it's not really an optimization, rather a re-export with very low quality, using a different tool
    optimise: function (frames, callback) {
      //start with the second writer!
      var w = facetogif.secondWorker || (facetogif.secondWorker = new Worker('js/vendor/gifwriter.worker.js'));
      w.onmessage = function (e) {
        var blob = new Blob([e.data.bytes], {type: 'image/gif'});
        callback(blob);
      }
      w.postMessage({
        imageDataList: frames.filter(function (e, i) { return !!i%3 }),
        width: facetogif.gifSettings.width,
        height: facetogif.gifSettings.height,
        paletteSize: 95,
        delayTimeInMS: facetogif.gifSettings.ms
      });
    },

    is_blob_too_big: function (blob, max) {
      return blob.size > (max || (2048 * 1024));
    }
  };
  var recorder = {
    state: 0,
    gif: null,
    interval: null,
    frames: [],
    ctx: null,
    states: {
      IDLE: 0,
      RECORDING: 1,
      PAUSED: 2,
      COMPILING: 3,
      FINISHED: 4,
      BUSY: 5
    },
    setBusy: function () {
      facetogif.video.dataset.state = recorder.state = recorder.states.BUSY;
    },
    setFinished: function () {
      recorder.state = recorder.states.FINISHED;
    },
    start: function () {
      facetogif.video.dataset.state = recorder.state = recorder.states.RECORDING;
      recorder.interval = setInterval(recorder_fn(recorder.ctx, recorder.gif, recorder.frames), facetogif.gifSettings.ms);
    },
    pause: function () {
      facetogif.video.dataset.state = recorder.state = recorder.states.PAUSED;
      clearInterval(recorder.interval);
    },
    compile: function (callback) {
      facetogif.video.dataset.state = recorder.state = recorder.states.COMPILING;
      recorder.gif.on('finished', function (blob) {
        recorder.setFinished();
        callback(blob);
        delete facetogif.video.dataset.state;
      });
      recorder.gif.render();
    }

  };

  function recorder_fn(ctx, gif, frames) {
    var coords = facetogif.recorderFrame(),
      drawW = facetogif.gifSettings.w,
      drawH = facetogif.gifSettings.h;
      ctx.translate(coords.w, 0);
      ctx.scale(-1, 1);
    return function () {
      if (facetogif.video.src) {
        ctx.drawImage(facetogif.video, coords.x,coords.y, coords.w,coords.h);
        var frame = ctx.getImageData(0,0, drawW,drawH);
        frames.push(frame);
        gif.addFrame(frame, {delay: facetogif.gifSettings.ms});
      } else {
        clearInterval(recorder.interval);
        facetogif.recIndicator.classList.remove('on');
        recorder.state = recorder.states.IDLE;
      }
    }
  }

  function countdown(node, callback) {
    var s = 3, fn;
    fn = function () {
      node.innerHTML = s;
      s--;
      if (s < 0) {
        callback();
      } else {
        setTimeout(fn, 1000);
      }
    }
    fn();
  }

  function track() {
    if (typeof ga !== "undefined") {
      ga.apply(ga, ['send', 'event'].concat([].slice.call(arguments)));
    }
  }


  document.addEventListener('DOMContentLoaded', function (e) {
    facetogif.video = document.querySelector('video');
    facetogif.controls = document.getElementById('controls-template');
    facetogif.controls.parentNode.removeChild(facetogif.controls);
    facetogif.controls.removeAttribute('id');

    facetogif.recIndicator = document.getElementById('recording-indicator');

    facetogif.canvas = document.createElement('canvas');
    facetogif.gifContainer = document.getElementById('gifs-go-here');

    facetogif.gifContainer.addEventListener('click', function (e) {
      var container = (function (e) {
        while (e.parentNode && !e.classList.contains('generated-gif') && (e = e.parentNode)) ;
        return e;
      } (e.target));
      if (e.target.classList.contains('download')) {
        track('generated-gif', 'download');
        e.target.href = container.querySelector('.generated-img').src;
      } else if (e.target.classList.contains('remove')) {
        e.preventDefault();
        track('generated-gif', 'remove');
        if (confirm(facetogif.str.rusure)) {
          var img = container.querySelector('.generated-img');
          img.src = null;
          facetogif.blobs[img.dataset.blobindex] = null;
          facetogif.frames[img.dataset.framesindex] = null;
          container.parentNode.removeChild(container);
        }
      } else if (e.target.classList.contains('upload')) {
        e.preventDefault();
        track('generated-gif', 'imgur');
        facetogif.upload({
          img: container.querySelector('.generated-img'),
          onuploaded: function (json) {
            e.target.innerHTML = facetogif.str.UPLOADED;
            e.target.href = 'http://imgur.com/' + json.data.id;
            e.target.classList.remove('processing');
            e.target.classList.add('uploaded');
            track('generated-gif', 'is on imgur.com');
          },
          oncanupload: function () {
            e.target.classList.remove('upload');
            e.target.classList.add('processing');
            e.target.innerHTML = facetogif.str.UPLOADING;
          },
          oncannotupload: function () {
            e.target.parentNode.removeChild(e.target);
            alert('The gif is still too big for imgur. :-(');
            track('generated-gif', 'toobig');
          },
          onoptimize: function () {
            track('generated-gif', 'optimising');
            e.target.classList.add('processing');
            e.target.innerHTML = facetogif.str.OPTIMISING;
          }
        });
      }
    }, false);

    document.getElementById('put-your-face-here').addEventListener('click', function (e) {
      var button = e.target;
      if (button.classList.contains('clicked') && facetogif.stream) {
        track('streaming', 'stop');
        facetogif.stream.stop();
        facetogif.stream = null;
        facetogif.video.removeAttribute('src');
        button.innerHTML = facetogif.str.ASK_FOR_PERMISSION;
        button.classList.remove('streaming');
      } else {
        track('streaming', 'request');
        getStream(function (stream) {
          track('streaming', 'start');
          button.innerHTML = facetogif.str.STOP_STREAMING;
          button.classList.add('streaming');
          facetogif.video.src = window.URL.createObjectURL(stream);
          facetogif.stream = stream;
        }, function (fail) {
          track('streaming', 'failed');
          console.log(fail);
        });
      }
      button.classList.toggle('clicked');
    }, false);

    mainbutton = document.getElementById('start-recording');
    var pause = document.getElementById('pause-recording');
    mainbutton.addEventListener('click', function (e) {
      if (recorder.state === recorder.states.RECORDING || recorder.state === recorder.states.PAUSED) {
        mainbutton.classList.remove('recording');
        mainbutton.innerHTML = facetogif.str.COMPILING;
        pause.innerHTML = facetogif.str.PAUSE;
        recorder.pause();
        facetogif.recIndicator.classList.remove('on');
        mainbutton.disabled = true;
        mainbutton.classList.add('processing');
        mainbutton.parentNode.classList.add('busy');
        recorder.state = recorder.states.COMPILING;
        recorder.compile(function (blob) {
          var img = document.createElement('img');
          img.src = URL.createObjectURL(blob);
          img.dataset.blobindex = facetogif.blobs.push(blob) -1;
          img.dataset.framesindex = facetogif.frames.push(recorder.frames) -1;
          facetogif.displayGIF(img);
          mainbutton.removeAttribute('disabled');
          mainbutton.classList.remove('processing');
          mainbutton.parentNode.classList.remove('busy');
          mainbutton.innerHTML = facetogif.str.START_RECORDING;
          track('generated-gif', 'created');
        });
        track('recording', 'finished');
      } else if (recorder.state === recorder.states.IDLE || recorder.state === recorder.states.FINISHED) {
        track('recording', 'start');
        recorder.gif = new GIF({
          workers: 2,
          width: facetogif.gifSettings.w,
          height: facetogif.gifSettings.h,
          quality: 20,
          workerScript: 'js/vendor/gif.worker.js'
        });
        recorder.setBusy();
        recorder.frames = [];
        recorder.ctx = facetogif.initCanvas().getContext('2d');
        countdown(mainbutton, function () {
          facetogif.recIndicator.classList.add('on');
          mainbutton.classList.add('recording');
          mainbutton.innerHTML = facetogif.str.STOP_RECORDING;
          recorder.start();
        });
      }
    }, false);
    pause.addEventListener('click', function (e) {
      if (recorder.state === recorder.states.RECORDING) {
        track('recording', 'pause');
        recorder.pause();
        pause.innerHTML = facetogif.str.RESUME;
        facetogif.recIndicator.classList.remove('on');
      } else if (recorder.state === recorder.states.PAUSED) {
        recorder.setBusy();
        track('recording', 'resume');
        countdown(pause, function () {
          facetogif.recIndicator.classList.add('on');
          pause.innerHTML = facetogif.str.PAUSE;
          recorder.start();
        });
      }
    }, false);

    var sizeSettings = document.querySelector('.gif-maker-size-controls');
    sizeSettings.addEventListener('change', function (ev) {
      facetogif.changeSize(ev.target.value);
    }, false);
    sizeSettings.querySelector('[value=normal]').checked = true;

  }, false);


} ());
