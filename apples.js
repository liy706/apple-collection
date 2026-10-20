(function () {
  "use strict";
  var GROUPS = {"red": ["a00", "a01", "a02"], "green": ["b00", "b01", "b02"], "yellow": ["c00", "c01", "c02"], "wine": ["d00", "d01", "d02"]};
  var DIR = "assets/inline/", EXT = ".webp";
  var group = {}, ALL = [];
  Object.keys(GROUPS).forEach(function (g) { GROUPS[g].forEach(function (n) { group[n] = g; ALL.push(n); }); });

  var imgs = [].slice.call(document.querySelectorAll(".inl img"));
  if (!imgs.length) return;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function vis(i) { var r = i.getBoundingClientRect(); return r.bottom > -80 && r.top < (window.innerHeight || 800) + 80; }

  function nameOf(img) { var m = /([a-z]\d\d)\.webp/.exec(img.getAttribute("src") || ""); return m && m[1]; }
  function sentence(img) { return img.closest(".statement__text, .chapter__lead") || img.parentNode; }
  function near(a, b) { return a !== b && (sentence(a) === sentence(b) || (vis(a) && vis(b))); }
  function taken(img) {
    var t = {}, g = {};
    imgs.forEach(function (o) {
      if (!near(img, o)) return;
      var n = o.__next || o.__name;
      if (n) { t[n] = 1; g[group[n]] = 1; }
    });
    return { names: t, groups: g };
  }
  function pick(img) {
    var t = taken(img);
    var free = ALL.filter(function (n) { return !t.names[n] && n !== img.__name; });
    var fresh = free.filter(function (n) { return !t.groups[group[n]]; });
    var from = fresh.length ? fresh : free;
    return from.length ? from[Math.floor(Math.random() * from.length)] : null;
  }

  imgs.forEach(function (img) {
    var n = nameOf(img), clash = !n;
    imgs.forEach(function (o) { if (o !== img && o.__name === n && sentence(o) === sentence(img)) clash = true; });
    if (clash) { img.__name = null; n = pick(img); if (n) img.src = DIR + n + EXT; }
    img.__name = n;
  });

  if (reduce) return;

  function settle(img) {
    var t = taken(img);
    if (t.names[img.__name]) {
      var n = pick(img);
      if (n) { img.src = DIR + n + EXT; img.__name = n; }
    }
  }
  var tick = 0;
  addEventListener("scroll", function () {
    if (tick) return;
    tick = setTimeout(function () { tick = 0; imgs.forEach(function (i) { if (vis(i)) settle(i); }); }, 160);
  }, { passive: true });
  imgs.forEach(function (i) { if (vis(i)) settle(i); });

  function swap(img) {
    if (!vis(img) || document.hidden || img.__busy) return;
    var n = pick(img);
    if (!n) return;
    img.__busy = true; img.__next = n;
    var pre = new Image();
    pre.onload = function () {
      if (img.animate) img.animate([{ transform: "none", opacity: 1 }, { transform: "scale(0.5) rotate(-14deg)", opacity: 0 }],
        { duration: 170, easing: "ease-in" });
      setTimeout(function () {
        img.src = pre.src;
        img.__name = n; img.__next = null;
        if (img.animate) img.animate([
          { transform: "scale(0.5) rotate(-14deg)", opacity: 0 },
          { transform: "scale(1.08) rotate(3deg)", opacity: 1, offset: 0.62 },
          { transform: "none", opacity: 1 }], { duration: 400, easing: "cubic-bezier(0.2, 0.9, 0.3, 1)" });
        img.__busy = false;
      }, 170);
    };
    pre.onerror = function () { img.__next = null; img.__busy = false; };
    pre.src = DIR + n + EXT;
  }

  function loop(img) {
    setTimeout(function () { swap(img); loop(img); }, 2600 + Math.random() * 2600);
  }
  imgs.forEach(function (img) { setTimeout(function () { loop(img); }, Math.random() * 2600); });
})();
