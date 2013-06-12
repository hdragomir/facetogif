(function () {
  var video, button, canvas, ctx, interval, gif;

  function thisBrowserIsBad() {
    console.log('nope');
  }

  function getStream(callback, fail) {
    (navigator.getUserMedia || navigator.webkitGetUserMedia || thisBrowserIsBad).call(navigator, {video: true}, callback, fail);
  }

  var facetogif = {
    stream: null,
    video: null,
    gifContainer: null,
    controls: null,
    str: {
      ASK_FOR_PERMISSION: "put your face here",
      STOP_STREAMING: "stop streaming",
      START_RECORDING: "start recording",
      STOP_RECORDING: "make gif",
      COMPILING: "\"it's compiling...\""
    },

    displayGIF: function (img) {
      var article = document.createElement('article');
      article.appendChild(facetogif.controls.cloneNode(true));
      article.appendChild(img);
      article.className = "generated-gif";
      img.className = "generated-img";
      facetogif.gifContainer.appendChild(article);
    }
  };

  document.addEventListener('DOMContentLoaded', function (e) {
    facetogif.video = document.querySelector('video');
    facetogif.controls = document.getElementById('controls-template');
    facetogif.controls.parentNode.removeChild(facetogif.controls);
    facetogif.controls.removeAttribute('id');

    canvas = document.querySelector('canvas');
    facetogif.gifContainer = document.getElementById('gifs-go-here');
    facetogif.gifContainer.addEventListener('click', function (e) {
      var container = (function (e) {
        while (e.parentNode && !e.classList.contains('generated-gif') && (e = e.parentNode)) ;
        return e;
      } (e.srcElement));
      if (e.srcElement.classList.contains('img')) {
        e.srcElement.href = container.querySelector('.generated-img').src;
      }
    }, false);

    document.getElementById('put-your-face-here').addEventListener('click', function (e) {
      var button = e.srcElement;
      if (button.classList.contains('clicked')) {
        facetogif.stream.stop();
        facetogif.stream = null;
        facetogif.video.removeAttribute('src');
        button.innerText = facetogif.str.ASK_FOR_PERMISSION;
        button.classList.remove('streaming');
      } else {
        getStream(function (stream) {
          button.innerText = facetogif.str.STOP_STREAMING;
          button.classList.add('streaming');
          facetogif.video.src = window.URL.createObjectURL(stream);
          facetogif.stream = stream;
        }, function (fail) { console.log(fail); });
      }
      button.classList.toggle('clicked');
    }, false);

    button = document.getElementById('start-recording');
    button.addEventListener('click', function (e) {
      button.classList.toggle('recording');
      if (ctx) {
        button.innerText = facetogif.str.COMPILING;
        clearInterval(interval);
        button.disabled = true;
        gif.on('finished', function (blob) {
          var img = document.createElement('img');
          img.src = URL.createObjectURL(blob);
          facetogif.displayGIF(img);
          button.removeAttribute('disabled');
          button.innerText = facetogif.str.START_RECORDING;
        });
        gif.render();

        ctx = null;
      } else {
        button.innerText = facetogif.str.STOP_RECORDING;
        ctx = canvas.getContext('2d');
        gif = new GIF({ workers: 2, width: 640, height: 480 });
        interval = setInterval(function () {
          ctx.drawImage(facetogif.video, 0,0, 640,480);
          gif.addFrame(ctx, {delay: 67, copy: true});
        }, 67);
      }
    }, false);

  }, false);

} ());
