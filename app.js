(function () {
  var video, mainbutton, canvas, ctx, interval;

  function thisBrowserIsBad() {
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
        }, function (fail) { console.log(fail); });
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
        clearInterval(recorder.interval);
        facetogif.recIndicator.classList.remove('on');
        mainbutton.disabled = true;
        mainbutton.classList.add('processing');
        mainbutton.parentNode.classList.add('busy');
        recorder.state = recorder.states.COMPILING;
        recorder.gif.on('finished', function (blob) {
          var img = document.createElement('img');
          img.src = URL.createObjectURL(blob);
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

        ctx = null;
      } else if (recorder.state === recorder.states.IDLE || recorder.state === recorder.states.FINISHED) {
        track('recording', 'start');
        canvas.height = facetogif.gifSettings.h;
        canvas.width = facetogif.gifSettings.w;
        ctx = canvas.getContext('2d');
        recorder.gif = new GIF({ workers: 2, width: facetogif.gifSettings.w, height: facetogif.gifSettings.h, quality: 20 });
        recorder.state = recorder.states.BUSY;
        countdown(mainbutton, function () {
          facetogif.recIndicator.classList.add('on');
          mainbutton.classList.add('recording');
          recorder.state = recorder.states.RECORDING;
          mainbutton.innerHTML = facetogif.str.STOP_RECORDING;
          recorder.interval = setInterval(recorder_fn(ctx, recorder.gif), facetogif.gifSettings.ms);
        });
      }
    }, false);
    pause.addEventListener('click', function (e) {
      if (recorder.state === recorder.states.RECORDING) {
        track('recording', 'pause');
        clearInterval(recorder.interval);
        recorder.state = recorder.states.PAUSED;
        pause.innerHTML = facetogif.str.RESUME;
        facetogif.recIndicator.classList.remove('on');
      } else if (recorder.state === recorder.states.PAUSED) {
        recorder.state = recorder.states.BUSY;
        track('recording', 'resume');
        countdown(pause, function () {
          facetogif.recIndicator.classList.add('on');
          recorder.state = recorder.states.RECORDING;
          pause.innerHTML = facetogif.str.PAUSE;
          recorder.interval = setInterval(recorder_fn(ctx, recorder.gif), facetogif.gifSettings.ms);
        });
      }
    }, false);

  }, false);

  var recorder = {
    state: 0,
    gif: null,
    interval: null,
    states: {
      IDLE: 0,
      RECORDING: 1,
      PAUSED: 2,
      COMPILING: 3,
      FINISHED: 4,
      BUSY: 5
    }
  };

  function recorder_fn(ctx, gif) {
    return function () {
      if (facetogif.video.src) {
        ctx.drawImage(facetogif.video, 0,0, facetogif.gifSettings.w,facetogif.gifSettings.h);
        gif.addFrame(ctx, {delay: facetogif.gifSettings.ms, copy: true});
      } else {
        clearInterval(recorder.interval);
        facetogif.recIndicator.classList.remove('on');
        recorder.state = recorder.states.IDLE;
      }
    }
  }

  function countdown(node, callback) {
    var s = 3;
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
      ga.apply(ga, ['send', 'event'].concat(arguments));
    }
  }


} ());
