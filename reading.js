(() => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const items = [...document.querySelectorAll("[data-rd]")];
  const zones = [...document.querySelectorAll(".statement, .chapter, .contents, .endnote")];
  if (!items.length && !zones.length) return;

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function wrapWords(el) {
    if (el.dataset.lit === "1") return;
    const frag = document.createDocumentFragment();
    [...el.childNodes].forEach((node) => {
      if (node.nodeType === 3) {
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(part));
            return;
          }
          const s = document.createElement("span");
          s.className = "lit";
          s.textContent = part;
          frag.appendChild(s);
        });
        return;
      }
      if (node.nodeType === 1 && (node.classList.contains("inl") || node.classList.contains("nb"))) {
        const s = document.createElement("span");
        s.className = "lit";
        s.appendChild(node);
        frag.appendChild(s);
        return;
      }
      frag.appendChild(node);
    });
    el.replaceChildren(frag);
    el.dataset.lit = "1";
  }

  const statements = items.filter((el) => el.classList.contains("statement__text"));
  const blocks = items.filter((el) => !el.classList.contains("statement__text"));
  if (!reduced) statements.forEach(wrapWords);
  const groups = statements.map((el) => ({ el, words: [...el.querySelectorAll(".lit")] }));

  function setVar(el, name, value) {
    if (el.dataset[name] === value) return;
    el.dataset[name] = value;
    el.style.setProperty(`--${name}`, value);
  }

  function lightWords(vh) {
    const line = vh * 0.98;
    groups.forEach(({ el, words }) => {
      const box = el.getBoundingClientRect();
      if (box.bottom < -80 || box.top > vh + 80) return;
      words.forEach((word) => {
        const r = word.getBoundingClientRect();
        if (r.bottom < -40 || r.top > vh + 40) {
          setVar(word, "mix", r.top > 0 ? "0%" : "100%");
          return;
        }
        const t = clamp((line - r.top) / (vh * 0.06), 0, 1);
        setVar(word, "mix", `${(t * 100).toFixed(1)}%`);
      });
    });
  }

  function focus() {
    if (reduced) return;
    const vh = window.innerHeight;
    lightWords(vh);
    const rects = blocks.map((el) => el.getBoundingClientRect());
    blocks.forEach((el, i) => {
      const r = rects[i];
      if (r.top > vh * 1.2 || r.bottom < -vh * 0.2) {
        setVar(el, "o", r.top > 0 ? "0.14" : "0.35");
        return;
      }
      const enter = clamp((vh * 0.9 - r.top) / (vh * 0.24), 0, 1);
      const leave = clamp((r.bottom - vh * 0.04) / (vh * 0.26), 0, 1);
      const o = (0.14 + 0.86 * enter) * (0.35 + 0.65 * leave);
      setVar(el, "o", o.toFixed(3));
    });
  }

  const over = new Set();
  const setHeader = () => document.body.classList.toggle("on-reading", over.size > 0);
  if ("IntersectionObserver" in window && zones.length) {
    const watch = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) over.add(entry.target);
          else over.delete(entry.target);
        });
        setHeader();
      },
      { rootMargin: "0px 0px -92% 0px" }
    );
    zones.forEach((zone) => watch.observe(zone));
  }

  let ticking = false;
  const requestFocus = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      focus();
    });
  };

  window.addEventListener("scroll", requestFocus, { passive: true });
  window.addEventListener("resize", requestFocus);
  window.addEventListener("load", requestFocus);
  focus();

  document.querySelectorAll("video[autoplay]").forEach((video) => {
    if (!("IntersectionObserver" in window)) return;
    const watch = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      });
    }, { rootMargin: "160px 0px" });
    watch.observe(video);
  });
})();
