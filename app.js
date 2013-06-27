(function () {
  "use strict";
  var video, mainbutton, canvas;

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
      ms: 100
    },
    stream: null,
    video: null,
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
      nope: "This browser does not support getUserMedia yet.",
      rusure: "Are you sure?"
    },

    displayGIF: function (img) {
      var article = document.createElement('article');
      article.appendChild(facetogif.controls.cloneNode(true));
      article.appendChild(img);
      article.className = "generated-gif separate";
      img.className = "generated-img";
      facetogif.gifContainer.appendChild(article);
    },

    blobs: [],
    imgur_client_id: '886730f5763b437',
    upload: function (img, callback) {
      var blob = facetogif.blobs[img.dataset.blobindex],
        fd,
        xhr;
      if (blob.size / 1024 > 2048) {
        alert("Image is too big for imgur. Please use an optimizer");
        return false;
      } else {
        fd = new FormData;
        xhr = new XMLHttpRequest();
        fd.append('image', blob);
        xhr.open("POST", "https://api.imgur.com/3/image.json");
        xhr.onload = function () {
          callback && callback(JSON.parse(xhr.response));
        }
        xhr.setRequestHeader('Authorization', 'Client-ID ' + facetogif.imgur_client_id);
        xhr.send(fd);
        return true;
      }
    }
  };

  document.addEventListener('DOMContentLoaded', function (e) {
    facetogif.video = document.querySelector('video');
    facetogif.controls = document.getElementById('controls-template');
    facetogif.controls.parentNode.removeChild(facetogif.controls);
    facetogif.controls.removeAttribute('id');

    facetogif.recIndicator = document.getElementById('recording-indicator');

    canvas = document.querySelector('canvas');
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
          container.parentNode.removeChild(container);
        }
      } else if (e.target.classList.contains('upload')) {
        e.preventDefault();
        track('generated-gif', 'imgur');
        if (facetogif.upload(container.querySelector('.generated-img'), function (json) {
          e.target.innerHTML = facetogif.str.UPLOADED;
          e.target.href = 'http://imgur.com/' + json.data.id;
          e.target.classList.remove('processing');
          e.target.classList.add('uploaded');
        })) {
          e.target.classList.remove('upload');
          e.target.classList.add('processing');
          e.target.innerHTML = facetogif.str.UPLOADING;
        } else {
          e.target.parentNode.removeChild(e.target);
          track('generated-gif', 'toobig');
        }
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
        recorder.gif.on('finished', function (blob) {
          var img = document.createElement('img');
          img.src = URL.createObjectURL(blob);
          img.dataset.blobindex = facetogif.blobs.push(blob) -1;
          facetogif.displayGIF(img);
          mainbutton.removeAttribute('disabled');
          mainbutton.classList.remove('processing');
          mainbutton.parentNode.classList.remove('busy');
          mainbutton.innerHTML = facetogif.str.START_RECORDING;
          recorder.state = recorder.states.FINISHED;
          track('generated-gif', 'created');
        });
        track('recording', 'finished');
        recorder.gif.render();

        recorder.ctx = null;
      } else if (recorder.state === recorder.states.IDLE || recorder.state === recorder.states.FINISHED) {
        track('recording', 'start');
        canvas.height = facetogif.gifSettings.h;
        canvas.width = facetogif.gifSettings.w;
        recorder.gif = new GIF({ workers: 2, width: facetogif.gifSettings.w, height: facetogif.gifSettings.h, quality: 20 });
        recorder.state = recorder.states.BUSY;
        recorder.frames = [];
        recorder.ctx = canvas.getContext('2d');
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
        recorder.state = recorder.states.BUSY;
        track('recording', 'resume');
        countdown(pause, function () {
          facetogif.recIndicator.classList.add('on');
          recorder.state = recorder.states.RECORDING;
          pause.innerHTML = facetogif.str.PAUSE;
          recorder.start();
        });
      }
    }, false);

  }, false);

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
    start: function () {
      recorder.state = recorder.states.RECORDING;
      recorder.interval = setInterval(recorder_fn(recorder.ctx, recorder.gif, recorder.frames), facetogif.gifSettings.ms);
    },
    pause: function () {
      recorder.state = recorder.states.PAUSED;
      clearInterval(recorder.interval);
    }
  };

  function recorder_fn(ctx, gif, frames) {
    return function () {
      if (facetogif.video.src) {
        var w = facetogif.gifSettings.w,
          h = facetogif.gifSettings.h,
          frame;
        ctx.drawImage(facetogif.video, 0,0, w,h);
        frame = ctx.getImageData(0,0, w,h);
        //frames.push(frame);
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


} ());
