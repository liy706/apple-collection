// Optical left alignment.
// Every glyph carries a little empty space on its left (the "A" of Apple has almost
// none, the "C" of Collection has a lot), so lines set flush-left still look ragged.
// Measure the ink of each line's first letter and pull the line over by exactly that
// much, so the letters themselves, not their boxes, sit on one vertical edge.
(() => {
  const targets = ".reading .kicker, .reading h1 span, .reading .line, .reading .scroll, header .mark a";
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  function align() {
    document.querySelectorAll(targets).forEach((el) => {
      const raw = el.textContent.trim();
      if (!raw) return;
      const style = getComputedStyle(el);
      let glyph = raw[0];
      if (style.textTransform === "uppercase") glyph = glyph.toUpperCase();
      ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const metrics = ctx.measureText(glyph);
      // actualBoundingBoxLeft is how far the ink reaches left of the origin
      // (negative when the ink starts to the right of it).
      el.style.marginLeft = `${metrics.actualBoundingBoxLeft.toFixed(2)}px`;
    });
  }

  const run = () => requestAnimationFrame(align);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
  window.addEventListener("load", run);
  window.addEventListener("resize", run);
  run();
})();
