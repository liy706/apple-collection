(() => {
  const loader = document.getElementById("loading");
  if (!loader) {
    window.__introDone = true;
    return;
  }
  window.__introHold = true;
  const Matter = window.Matter;
  const gsap = window.gsap;
  const counter = document.getElementById("progress");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const NS = "http://www.w3.org/2000/svg";
  const HOLD_AT_FULL = 320;

  const FILLS = [
    "#a51a14", "#c8262c", "#d94a0f", "#e07a10", "#f2a900", "#ffcd00",
    "#7a3410", "#9a4a1f", "#c26a2b", "#4a2418", "#7d1a3a", "#5b2a63", "#b03a48", "#e0442a"
  ];
  const SHAPES = Array.isArray(window.APPLE_SHAPES) ? window.APPLE_SHAPES : [];
  const pick = (list, index) => list[index % list.length];
  const shuffle = (list) => {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  function smoothPath(points, scale) {
    const n = points.length;
    const p = (i) => points[(i + n) % n];
    let d = `M${(p(0)[0] * scale).toFixed(1)} ${(p(0)[1] * scale).toFixed(1)}`;
    for (let i = 0; i < n; i += 1) {
      const p0 = p(i - 1);
      const p1 = p(i);
      const p2 = p(i + 1);
      const p3 = p(i + 2);
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += `C${(c1x * scale).toFixed(1)} ${(c1y * scale).toFixed(1)} ${(c2x * scale).toFixed(1)} ${(c2y * scale).toFixed(1)} ${(p2[0] * scale).toFixed(1)} ${(p2[1] * scale).toFixed(1)}`;
    }
    return `${d}Z`;
  }

  function buildApple(shape, scale, fill) {
    const all = shape.body.concat(...shape.stems);
    const xs = all.map((p) => p[0] * scale);
    const ys = all.map((p) => p[1] * scale);
    const pad = 4;
    const box = {
      x: Math.min(...xs) - pad,
      y: Math.min(...ys) - pad,
      w: Math.max(...xs) - Math.min(...xs) + pad * 2,
      h: Math.max(...ys) - Math.min(...ys) + pad * 2
    };

    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `${box.x} ${box.y} ${box.w} ${box.h}`);
    svg.setAttribute("width", box.w);
    svg.setAttribute("height", box.h);
    svg.classList.add("loading__apple");
    svg.setAttribute("aria-hidden", "true");

    const body = document.createElementNS(NS, "path");
    body.setAttribute("d", smoothPath(shape.body, scale));
    body.setAttribute("fill", fill);
    svg.appendChild(body);
    shape.stems.forEach((stem) => {
      const part = document.createElementNS(NS, "path");
      part.setAttribute("d", smoothPath(stem, scale));
      part.setAttribute("fill", fill);
      part.setAttribute("stroke", fill);
      part.setAttribute("stroke-width", "1.5");
      part.setAttribute("stroke-linejoin", "round");
      svg.appendChild(part);
    });

    const hull = Matter.Vertices.hull(shape.body.map((p) => ({ x: p[0] * scale, y: p[1] * scale })));
    return { svg, hull, origin: { x: -box.x, y: -box.y } };
  }

  function warp(shape, gentle) {
    const g = gentle ? 0.4 : 1;
    const ys = shape.body.map((p) => p[1]);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const cy = (minY + maxY) / 2;
    const half = (maxY - minY) / 2 || 1;
    const sx = 1 + (Math.random() - 0.5) * 0.3 * g;
    const sy = 1 + (Math.random() - 0.5) * 0.3 * g;
    const taper = (Math.random() * 0.26 - 0.22) * g;
    const lean = (Math.random() - 0.5) * 0.2 * g;
    const flip = Math.random() < 0.5 ? -1 : 1;
    const move = ([x, y]) => {
      const n = (y - cy) / half;
      return [(x * (1 + taper * n) + lean * (y - cy)) * sx * flip, y * sy];
    };
    let body = shape.body.map(move);
    let stems = shape.stems.map((stem) => stem.map(move));
    const spanOf = (list, axis) => Math.max(...list.map((p) => p[axis])) - Math.min(...list.map((p) => p[axis]));
    const w = spanOf(body, 0);
    let h = spanOf(body, 1);
    if (!gentle && w / h > 1.12) {
      const k = w / h / 1.12;
      const taller = ([x, y]) => [x, y * k];
      body = body.map(taller);
      stems = stems.map((stem) => stem.map(taller));
      h *= k;
    }
    return { w, h, body, stems };
  }

  const stage = document.createElement("div");
  stage.className = "loading__stage";
  loader.appendChild(stage);
  const sweep = document.createElement("div");
  sweep.className = "loading__sweep";
  loader.appendChild(sweep);

  let target = 0;
  let shown = 0;
  let failed = false;
  window.addEventListener("site-progress", (event) => {
    target = Math.max(target, event.detail || 0);
  });
  window.addEventListener("site-failed", () => {
    failed = true;
    if (counter) counter.classList.add("is-failed");
  });
  const isReady = () => document.body.classList.contains("is-ready");

  const stopScroll = (event) => event.preventDefault();
  loader.addEventListener("wheel", stopScroll, { passive: false });
  loader.addEventListener("touchmove", stopScroll, { passive: false });

  let closing = false;
  function close() {
    if (closing) return;
    closing = true;
    window.__introHold = false;
    loader.removeEventListener("wheel", stopScroll);
    loader.removeEventListener("touchmove", stopScroll);
    const finish = () => {
      stopPhysics();
      loader.remove();
      window.__introDone = true;
      window.dispatchEvent(new Event("intro-done"));
    };
    if (!gsap || reduced) {
      loader.style.transition = "opacity 0.4s ease";
      loader.style.opacity = "0";
      setTimeout(finish, 420);
      return;
    }
    const text = loader.querySelectorAll("#progress");
    const tl = gsap.timeline({ onComplete: finish });
    tl.to(text, { opacity: 0, y: -10, duration: 0.3, ease: "power2.in" }, 0)
      .fromTo(sweep, { yPercent: 100 }, { yPercent: 0, duration: 0.8, ease: "power3.inOut" }, 0.1)
      .add(() => {
        loader.style.background = "transparent";
        stage.style.visibility = "hidden";
        loader.style.pointerEvents = "none";
      })
      .to(sweep, { yPercent: -100, duration: 0.9, ease: "power3.inOut" }, ">0.05");
  }

  let stopPhysics = () => {};
  const startedAt = performance.now();
  let fullAt = 0;
  let lastText = "";

  function tickCounter(now) {
    const elapsed = now - startedAt;
    const byTime = 1 - Math.pow(1 - Math.min(1, elapsed / 2000), 3);
    const limit = isReady() ? 1 : target > 0 ? Math.min(0.99, target * 0.98 + 0.01) : 0.9;
    const goal = Math.min(limit, byTime);
    shown += (goal - shown) * 0.2;
    if (goal >= 1 && shown > 0.995) shown = 1;
    if (shown === 1 && !fullAt) fullAt = now;
    const text = `${Math.round(shown * 100)}%`;
    if (counter && !failed && text !== lastText) {
      lastText = text;
      counter.textContent = text;
    }
  }

  function shouldClose(now) {
    if (closing) return false;
    return isReady() && fullAt > 0 && now - fullAt > HOLD_AT_FULL;
  }

  if (!Matter || reduced) {
    let raf = 0;
    const loop = (now) => {
      tickCounter(now);
      if (shouldClose(now)) close();
      if (!closing) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    stopPhysics = () => cancelAnimationFrame(raf);
    return;
  }

  const { Engine, Bodies, Body, Composite, Mouse, MouseConstraint, Events, Vertices } = Matter;
  const engine = Engine.create({ gravity: { x: 0, y: 3, scale: 0.001 } });
  engine.positionIterations = 8;

  let width = stage.clientWidth || window.innerWidth;
  let height = stage.clientHeight || window.innerHeight;
  const WALL = 400;
  const floor = Bodies.rectangle(width / 2, height + WALL / 2, width * 3, WALL, { isStatic: true });
  const leftWall = Bodies.rectangle(-WALL / 2, height / 2, WALL, height * 6, { isStatic: true });
  const rightWall = Bodies.rectangle(width + WALL / 2, height / 2, WALL, height * 6, { isStatic: true });
  Composite.add(engine.world, [floor, leftWall, rightWall]);

  const narrow = width <= 480;
  const tablet = width <= 1024;
  const base = narrow
    ? Math.min(300, Math.max(180, width * 0.24))
    : tablet
      ? Math.min(507, Math.max(253, width * 0.34))
      : Math.min(440, Math.max(220, 28.96 + width * 0.18));
  const UNUSUAL = [1, 2, 4, 11, 16, 20, 31, 35].filter((i) => i < SHAPES.length);
  const SQUAT = SHAPES.map((shape, i) => ((shape.w / shape.h > 1.27 && i !== 20) || shape.h / shape.w > 2 ? i : -1)).filter((i) => i >= 0);
  const common = shuffle(SHAPES.map((_, i) => i).filter((i) => !UNUSUAL.includes(i) && !SQUAT.includes(i)));
  const rare = shuffle(UNUSUAL);
  const order = [];
  for (let k = 0; k < Math.max(common.length, rare.length); k += 1) {
    if (rare[k] !== undefined) order.push(rare[k]);
    if (common[k] !== undefined) order.push(common[k]);
  }
  const colours = shuffle(FILLS);
  const items = [];

  const budget = width * height * 0.3;
  let covered = 0;
  const large = new Set([1]);
  if (Math.random() < 0.65) large.add(4 + Math.floor(Math.random() * 3));
  for (let i = 0; i < 28 && (covered < budget || i < 9); i += 1) {
    const original = SHAPES[order[i % order.length]];
    const shape = warp(original, false);
    const scale = (base * (large.has(i) ? 0.9 + Math.random() * 0.1 : 0.54 + Math.random() * 0.06)) / shape.w;
    const target = shape.w * scale;
    const size = shape.h * scale;
    covered += shape.w * shape.h * scale * scale * 0.78;
    const built = buildApple(shape, scale, pick(colours, i));
    const centre = Vertices.centre(built.hull);
    const x = target * 0.55 + Math.random() * Math.max(10, width - target * 1.1);
    const y = -size * 0.8 - i * (20 + Math.random() * 40) * (target / 250);
    const body = Bodies.fromVertices(x, y, [built.hull], {
      restitution: 0.32,
      friction: 0.35,
      frictionAir: 0.008,
      density: 0.0012,
      angle: (Math.random() - 0.5) * 2.4
    });
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.09);
    built.svg.style.transformOrigin = `${built.origin.x + centre.x}px ${built.origin.y + centre.y}px`;
    stage.appendChild(built.svg);
    items.push({ body, el: built.svg, ox: built.origin.x + centre.x, oy: built.origin.y + centre.y });
  }
  Composite.add(engine.world, items.map((item) => item.body));

  const mouse = Mouse.create(stage);
  const grab = MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.2, render: { visible: false } } });
  Composite.add(engine.world, grab);
  const blast = (event) => {
    const rect = stage.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const reach = Math.max(160, width * 0.12);
    items.forEach(({ body }) => {
      const dx = body.position.x - px;
      const dy = body.position.y - py;
      const d = Math.hypot(dx, dy);
      if (d > reach) return;
      const k = 1 - d / reach;
      const nx = d ? dx / d : (Math.random() - 0.5) * 2;
      const ny = d ? dy / d : -1;
      const push = 16 * (0.35 + 0.65 * k);
      Body.setVelocity(body, { x: body.velocity.x + nx * push, y: body.velocity.y + ny * push - 8 * k });
      Body.setAngularVelocity(body, body.angularVelocity + nx * k * 0.16);
    });
  };
  stage.addEventListener("pointerdown", blast);

  const draw = () => {
    for (const { body, el, ox, oy } of items) {
      el.style.transform = `translate(${body.position.x - ox}px, ${body.position.y - oy}px) rotate(${body.angle}rad)`;
    }
  };
  draw();

  const onResize = () => {
    width = stage.clientWidth || window.innerWidth;
    height = stage.clientHeight || window.innerHeight;
    Body.setPosition(floor, { x: width / 2, y: height + WALL / 2 });
    Body.setPosition(leftWall, { x: -WALL / 2, y: height / 2 });
    Body.setPosition(rightWall, { x: width + WALL / 2, y: height / 2 });
  };
  window.addEventListener("resize", onResize);

  let raf = 0;
  let last = performance.now();
  let accumulator = 0;
  const STEP = 1000 / 60;

  const frame = (now) => {
    accumulator += Math.min(64, now - last);
    last = now;
    let steps = 0;
    while (accumulator >= STEP && steps < 4) {
      Engine.update(engine, STEP);
      accumulator -= STEP;
      steps += 1;
    }
    draw();
    tickCounter(now);

    if (shouldClose(now)) close();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  stopPhysics = () => {
    cancelAnimationFrame(raf);
    stage.removeEventListener("pointerdown", blast);
    window.removeEventListener("resize", onResize);
    Events.off(engine);
    Composite.clear(engine.world, false);
    Engine.clear(engine);
  };
})();
