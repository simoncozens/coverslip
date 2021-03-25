import * as $ from "jquery";
import { MyFont } from "./font";
import * as titles from "./titles.json";
import * as words from "./words.json";
import * as hbjs from "./hbjs";
var font: MyFont;

var ENDPOINT =
  "https://67ubhe3vi0.execute-api.us-east-1.amazonaws.com/v1/get-sentences";

declare let window: any;
var shapableWords: string[];
type WordTuple = [number, string[]];
var wordsByEm: WordTuple[];

var sentences: string[];

fetch("harfbuzz.wasm")
  .then((response) => response.arrayBuffer())
  .then((bytes) => WebAssembly.instantiate(bytes))
  .then((results) => {
    // @ts-ignore
    results.instance.exports.memory.grow(800);
    const hb = hbjs(results.instance); // Dirty but works
    window.harfbuzz = results.instance;
    window.hbjs = hb;
  });

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function round(x, tolerance = 10) {
  return Math.trunc(x / tolerance) * tolerance;
}

function binarySearch(ar, el, compare_fn) {
  var m = 0;
  var n = ar.length - 1;
  while (m <= n) {
    var k = (n + m) >> 1;
    var cmp = compare_fn(el, ar[k]);
    if (cmp > 0) {
      m = k + 1;
    } else if (cmp < 0) {
      n = k - 1;
    } else {
      return k;
    }
  }
  return n;
}

function randElement(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function rebuild() {
  console.log("Rebuild called");
  if (!font) return;
  fitHeadline();
  fitWaterfall();
  fitBody();
}

function fitBody() {
  $("#newspaper_body").text(sentences.join(""));
}

function fitWaterfall() {
  if (!wordsByEm.length) {
    shapableWords = [];
    var wordCache: Record<number, WordTuple> = {};
    words.forEach((w) => {
      if (font.canShape(w)) {
        shapableWords.push(w);
        var width = round(font.shapedWidth(w, font.otFont.unitsPerEm));
        if (!wordCache[width]) {
          wordCache[width] = [width, []];
        }
        wordCache[width][1].push(w);
      }
    });
    wordsByEm = Object.values(wordCache).sort((el1, el2) => el1[0] - el2[0]);
  }

  var text = "";
  $("#waterfall div").each(function (index) {
    var width = $(this).width();
    var fontsize = parseInt(
      window.getComputedStyle(this).fontSize.replace("px", ""),
      10
    );
    console.log("Row ", index, ": width", width, " font size ", fontsize);
    var target_units = (width / fontsize) * font.otFont.unitsPerEm;
    var onespace = font.otFont.charToGlyph(" ").advanceWidth;
    var eachword = (target_units - index * onespace) / (1 + index);
    var text = "";
    for (var i = 0; i <= index; i++) {
      console.log("Looking for a word of " + eachword + " Units");
      // Grab best
      var wordIdx = binarySearch(wordsByEm, eachword, function (units, tuple) {
        return units - tuple[0];
      });
      console.log("Got ", wordsByEm[wordIdx]);
      var word = randElement(wordsByEm[wordIdx][1]);
      text = text + word + " ";
    }
    $(this).text(text);
  });
}

function fitHeadline() {
  var headline = $("#newspaper_headline");
  var headlineWidth = headline.width() - 50;
  var fontsize = parseInt(
    window.getComputedStyle(headline[0]).fontSize.replace("px", ""),
    10
  );
  shuffleArray(titles);
  var chosen = titles.find(
    (c) => font.canShape(c) && font.fits(c, fontsize, headlineWidth)
  );
  console.log(fontsize, chosen, font.shapedWidth(chosen, fontsize));
  if (!chosen) {
    headline.addClass("failed");
    headline.text("I don't have a headline you can shape");
  } else {
    headline.text(chosen);
    headline.removeClass("failed");
  }
}

function _base64ToArrayBuffer(base64) {
  var binary_string = window.atob(base64);
  var len = binary_string.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

function getSentences() {
  var cpstring = String.fromCodePoint(...font.supportedCodepoints);
  $.getJSON(ENDPOINT, { cps: cpstring })
    .done(function (data) {
      console.log("Got sentences");
      console.log(sentences);
      sentences = data.filter(font.canShape);
    })
    .fail(function (xhr, status, error) {
      $("#newspaper_body").text("Oops - something went wrong. " + error);
    });
}

window["fontDropCallback"] = function (newFont) {
  console.log("Dropped", newFont);
  var css = `"${newFont.title}", "Adobe NotDef"`;
  $("#fontdrop_view").css("font-family", css);
  // @ts-ignore: CSS stylesheets are messy.
  var fontUrl = document.styleSheets[1].rules[0].style.src;
  fontUrl = fontUrl.slice(4, -1); // url( ... )
  var fontData = _base64ToArrayBuffer(fontUrl.split(",")[1]);

  font = new MyFont(fontData);
  shapableWords = [];
  wordsByEm = [];
  sentences = [];

  getSentences();
  rebuild();
};

$(function () {
  var rtime;
  var timeout = false;
  var delta = 10;
  $(window).resize(function () {
    rtime = new Date();
    if (timeout === false) {
      timeout = true;
      setTimeout(resizeend, delta);
    }
  });

  function resizeend() {
    if (+new Date() - rtime < delta) {
      setTimeout(resizeend, delta);
    } else {
      timeout = false;
      rebuild();
    }
  }
});
