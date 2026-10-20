(() => {
  const canvas = document.getElementById("intro-cut");
  const section = document.getElementById("introduction");
  if (!canvas || !section) return;

  const TOTAL = 106;
  const HOLD = 34;
  const PAPER = "#f6f1e8";
  const frames = new Array(TOTAL);
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  const buf = document.createElement("canvas");
  const bctx = buf.getContext("2d", { alpha: false });
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const state = { p: 0 };
  let shown = -1;
  let dpr = 1;
  let queued = false;

  function src(i) {
    return `assets/cut/frames/${String(i + 1).padStart(3, "0")}.webp`;
  }

  function ready(img) {
    return !!(img && img.complete && img.naturalWidth);
  }

  function nearestReady(want) {
    const i = Math.max(0, Math.min(TOTAL - 1, want));
    if (ready(frames[i])) return i;
    for (let d = 1; d < TOTAL; d += 1) {
      if (i - d >= 0 && ready(frames[i - d])) return i - d;
      if (i + d < TOTAL && ready(frames[i + d])) return i + d;
    }
    return -1;
  }

  function wantedIndex(p) {
    const t = Math.max(0, Math.min(1, p));
    if (t <= 0.001) return HOLD;
    return HOLD + Math.round(t * ((TOTAL - 1) - HOLD));
  }

  function stableIndex(p) {
    const want = wantedIndex(p);
    const target = nearestReady(want);
    if (target < 0) return shown;
    if (shown < 0) return target;
    if (p <= 0.001) return nearestReady(HOLD);
    if (want >= shown + 1) return nearestReady(Math.min(TOTAL - 1, shown + 1));
    if (want <= shown - 1) return nearestReady(Math.max(HOLD, shown - 1));
    return shown;
  }

  function fit() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, canvas.clientWidth || 300);
    const h = Math.max(1, canvas.clientHeight || 400);
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    if (canvas.width === bw && canvas.height === bh) return false;
    canvas.width = bw;
    canvas.height = bh;
    buf.width = bw;
    buf.height = bh;
    shown = -1;
    return true;
  }

  function blit(idx) {
    const img = frames[idx];
    if (!ready(img)) return;
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.fillStyle = PAPER;
    bctx.fillRect(0, 0, buf.width, buf.height);
    bctx.drawImage(img, 0, 0, buf.width, buf.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(buf, 0, 0);
    shown = idx;
  }

  function paint() {
    queued = false;
    fit();
    const idx = reduced ? nearestReady(0) : stableIndex(state.p);
    if (idx < 0 || idx === shown) return;
    blit(idx);
  }

  function requestPaint() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(paint);
  }

  canvas.style.background = PAPER;
  fit();

  function loadFrame(i) {
    if (frames[i]) return;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (shown < 0 || i === shown || (state.p <= 0.001 && i === HOLD)) requestPaint();
    };
    img.src = src(i);
    frames[i] = img;
  }

  loadFrame(HOLD);
  const loadRest = () => {
    for (let i = 0; i < TOTAL; i += 1) loadFrame(i);
  };
  if ("requestIdleCallback" in window) requestIdleCallback(loadRest, { timeout: 900 });
  else setTimeout(loadRest, 280);

  window.addEventListener("resize", requestPaint);

  if (reduced || typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
    requestPaint();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  const startAt = section.querySelector(".chapter__body p:not(.chapter__lead)") || section;
  gsap.to(state, {
    p: 1,
    ease: "none",
    scrollTrigger: {
      id: "intro-cut",
      trigger: startAt,
      start: "top 36%",
      end: "+=150%",
      scrub: true,
      invalidateOnRefresh: true,
    },
    onUpdate: requestPaint,
  });

  const refresh = () => ScrollTrigger.refresh();
  window.addEventListener("load", refresh);
  window.addEventListener("intro-done", refresh);
})();
