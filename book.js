const SHEETS = [
  { section: "Introduction", title: "The Apple as a System of Forms", folio: ["02", "03"], front: "p01", back: null },
  { section: "Contents", title: "Contents", folio: ["04", "05"], front: "p03", back: "p04" },
  { section: "Form", title: "Measure / Shape", folio: ["06", "07"], front: "p05", back: "p06" },
  { section: "Form", title: "Variation / Compare", folio: ["08", "09"], front: "p07", back: null },
  { section: "Form", title: "Form", folio: ["10", "11"], front: "p09", back: "p10" },
  { section: "Variety", title: "Reading Difference", folio: ["12", "13"], front: "p11", back: "p12" },
  { section: "Variety", title: "Color and Surface", folio: ["14", "15"], front: "p13", back: null },
  { section: "Variety", title: "Taste", folio: ["16", "17"], front: "p15", back: null },
  { section: "Cut", title: "From Whole to Section", folio: ["18", "19"], front: "p17", back: "p18" },
  { section: "Cut", title: "Peel, Core, Slice", folio: ["20", "21"], front: "p19", back: null },
  { section: "Interior", title: "Core, Seed, and Symmetry", folio: ["22", "23"], front: "p21", back: null },
  { section: "Marks", title: "Traces of Handling", folio: ["24", "25"], front: "p23", back: null },
  { section: "Time", title: "Storage, Browning, and Change", folio: ["26", "27"], front: "p25", back: null },
  { section: "Time", title: "Browning", folio: ["28", "29"], front: "p27", back: null },
  { section: "End", title: "Research Sources", folio: ["30", "31"], front: "p29", back: "p30" }
];

const CONTENTS = [
  { sheet: 0, num: "02", name: "Introduction", sub: "The Apple as a System of Forms" },
  { sheet: 2, num: "06", name: "Form", sub: "How an Apple Becomes a Shape" },
  { sheet: 5, num: "12", name: "Variety", sub: "Reading Difference" },
  { sheet: 8, num: "18", name: "Cut", sub: "From Whole to Section" },
  { sheet: 10, num: "22", name: "Interior", sub: "Core, Seed, and Symmetry" },
  { sheet: 11, num: "24", name: "Marks", sub: "Traces of Handling" },
  { sheet: 12, num: "26", name: "Time", sub: "Storage, Browning, and Change" },
  { sheet: 14, num: "30", name: "End", sub: "Research Sources" }
];

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const state = { left: 0, right: 0, showingBack: false };
const view = { x: 14, y: 0, held: false };
let orbit = null;
const locks = { left: false, right: false };
const sides = { left: [], right: [] };
let busy = false;

const book = document.getElementById("book");
const whereEl = document.getElementById("where");
const hintEl = document.getElementById("hint");
const folioEl = document.getElementById("folio");
const contentsEl = document.getElementById("contents");
const scrim = document.getElementById("scrim");

function leafMarkup(side, front, back, label) {
  const backFace = back
    ? `<div class="face back"><img alt="" src="assets/${back}.jpg" draggable="false" /></div>`
    : `<div class="face back paper"></div>`;
  return `
    <div class="leaf" data-side="${side}">
      <div class="face front"><img alt="${label}" src="assets/${front}.jpg" draggable="false" /></div>
      ${backFace}
    </div>`;
}

function rings() {
  return `<div class="coil" aria-hidden="true"></div>`;
}

function build() {
  const leftPad = document.querySelector(".pad-left");
  const rightPad = document.querySelector(".pad-right");
  const cover = { front: "cover01", back: "cover02", label: "Apple Collection cover" };
  const leaves = [cover, ...SHEETS.map((sheet) => ({
    front: sheet.front,
    back: sheet.back,
    label: `${sheet.section} ${sheet.folio.join(" ")}`
  }))];

  leftPad.innerHTML = rings() + leaves.map((leaf) => leafMarkup("left", leaf.front, leaf.back, leaf.label)).join("");
  rightPad.innerHTML = rings() + leaves.map((leaf) => leafMarkup("right", leaf.front, leaf.back, leaf.label)).join("");
  sides.left = [...leftPad.querySelectorAll(".leaf")];
  sides.right = [...rightPad.querySelectorAll(".leaf")];
  sides.left[0].classList.add("is-cover");
  sides.right[0].classList.add("is-cover");

  sides.left.forEach((leaf, index) => bindLeaf(leaf, "left", index));
  sides.right.forEach((leaf, index) => bindLeaf(leaf, "right", index));
  applyZ("left");
  applyZ("right");

  const list = document.getElementById("contents-list");
  list.innerHTML = CONTENTS.map((item) => `
    <button class="row" type="button" data-sheet="${item.sheet}">
      <span class="num">${item.num}</span>
      <span><b>${item.name}</b><span>${item.sub}</span></span>
    </button>`).join("");
  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-sheet]");
    if (!button) return;
    closeContents();
    goTo(Number(button.dataset.sheet));
  });
}

function restAngle(side, turned) {
  if (!turned) return 0;
  return side === "left" ? -180 : 180;
}

function applyZ(side) {
  const count = state[side];
  sides[side].forEach((leaf, index) => {
    const turned = index < count;
    leaf.style.zIndex = turned ? String(12 + index) : String(60 - index);
    leaf.style.visibility = turned ? "hidden" : "visible";
    const active = index === count;
    leaf.style.pointerEvents = active ? "auto" : "none";
  });
}

function faceOf(side) {
  const count = state[side];
  if (count === 0) return { section: state.showingBack ? "Back cover" : "Cover", title: "Apple Collection", folio: ["", ""] };
  if (count >= sides[side].length) return { section: "Inside back", title: "Back cover", folio: ["", ""] };
  return SHEETS[count - 1];
}

function norm(angle) {
  let value = angle % 360;
  if (value > 180) value -= 360;
  if (value < -180) value += 360;
  return value;
}

function defaultTilt() {
  const open = state.left > 0 || state.right > 0;
  const reading = document.body.classList.contains("is-reading");
  if (reading) return 2;
  return open ? 6 : 12;
}

function syncRear() {
  const rear = state.left === 0 && state.right === 0 && Math.abs(Math.abs(norm(view.y)) - 180) < 75;
  document.body.classList.toggle("is-rear", rear);
  state.showingBack = rear;
}

function updateUI() {
  const open = state.left > 0 || state.right > 0;
  const orbiting = document.body.classList.contains("is-orbit");
  document.body.classList.toggle("is-open", open);
  const left = faceOf("left");
  const right = faceOf("right");
  const same = left.section === right.section && left.title === right.title;
  whereEl.textContent = same ? left.section : `${left.section}  /  ${right.section}`;
  if (orbiting) {
    hintEl.textContent = "Drag to turn the whole book.";
    folioEl.textContent = state.showingBack ? "Back cover" : (open ? `${left.folio?.[0] || "—"}   ${right.folio?.[1] || "—"}` : "Cover");
  } else if (!open) {
    folioEl.textContent = state.showingBack ? "Back cover" : "Cover";
    hintEl.textContent = state.showingBack ? "Click to return to the front" : "Click the cover to open";
  } else if (state.left >= sides.left.length && state.right >= sides.right.length) {
    folioEl.textContent = "Inside back cover";
    hintEl.textContent = "Inside back cover. Click an outer page to turn it back.";
  } else {
    const lf = left.folio?.[0] || "—";
    const rf = right.folio?.[1] || "—";
    folioEl.textContent = `${lf}   ${rf}`;
    hintEl.textContent = "Click a page to turn it. Shift-click turns it back.";
  }
  document.getElementById("btn-rotate").textContent = orbiting ? "Done" : "Rotate";
  document.getElementById("btn-front").hidden = orbiting || !view.held;
  document.getElementById("btn-back").hidden = open;
  document.getElementById("btn-read").hidden = !open;
  document.getElementById("btn-close").hidden = !open;
}

function fitBook() {
  const open = state.left > 0 || state.right > 0;
  const reading = document.body.classList.contains("is-reading");
  const panels = reading ? 2 : 2.15;
  const gutter = open ? 20 : 0;
  const size = Math.min((window.innerWidth - 72 - gutter) / panels, window.innerHeight - 176, reading ? 760 : 520);
  document.documentElement.style.setProperty("--page", Math.max(112, Math.floor(size)) + "px");
}

function layoutBook() {
  const open = state.left > 0 || state.right > 0;
  fitBook();
  if (!view.held) view.x = defaultTilt();
  const duration = reduce ? 0 : 0.7;
  gsap.to(book, {
    scale: 1,
    rotationX: view.x,
    rotationY: view.y,
    duration,
    ease: "power2.inOut",
    overwrite: "auto",
    onUpdate: syncRear
  });
  gsap.set(".wing", { width: 0 });
}

function resetView() {
  document.body.classList.remove("is-orbit");
  view.held = false;
  view.y = 0;
  view.x = defaultTilt();
  state.showingBack = false;
  document.body.classList.remove("is-rear");
  layoutBook();
  updateUI();
}

function turn(side, dir, speed, fromRiffle) {
  if (locks[side]) return Promise.resolve();
  if (!fromRiffle && busy) return Promise.resolve();
  if (state.showingBack) return Promise.resolve();
  const next = state[side] + dir;
  if (next < 0 || next > sides[side].length) return Promise.resolve();
  const index = dir > 0 ? state[side] : state[side] - 1;
  const leaf = sides[side][index];
  const dest = dir > 0 ? restAngle(side, true) : 0;
  locks[side] = true;
  leaf.style.visibility = "visible";
  leaf.style.zIndex = "140";
  const duration = reduce ? 0.01 : (speed || 0.82);
  return new Promise((resolve) => {
    gsap.to(leaf, {
      rotationY: dest,
      duration,
      ease: "power2.inOut",
      force3D: true,
      onComplete() {
        state[side] = next;
        locks[side] = false;
        applyZ(side);
        const open = state.left > 0 || state.right > 0;
        const was = document.body.classList.contains("is-open");
        if (open !== was) {
          if (!open) document.body.classList.remove("is-reading");
          updateUI();
          requestAnimationFrame(layoutBook);
        } else {
          updateUI();
        }
        resolve();
      }
    });
  });
}

function openCover() {
  if (state.showingBack || busy) return;
  if (state.left === 0 && state.right === 0) {
    document.body.classList.add("is-open");
    updateUI();
    requestAnimationFrame(() => {
      layoutBook();
      turn("left", 1);
      turn("right", 1);
    });
  }
}

async function riffle(side, target) {
  const going = target > state[side] ? 1 : -1;
  while (state[side] !== target) {
    await turn(side, going, reduce ? 0.01 : 0.28, true);
  }
}

async function goTo(sheet) {
  if (busy) return;
  const target = sheet + 1;
  busy = true;
  if (state.showingBack) {
    state.showingBack = false;
    setCoverArt("cover01");
  }
  document.body.classList.add("is-open");
  updateUI();
  requestAnimationFrame(layoutBook);
  await Promise.all([riffle("left", target), riffle("right", target)]);
  busy = false;
  updateUI();
}

async function closeBook() {
  if (busy) return;
  busy = true;
  document.body.classList.remove("is-reading");
  await Promise.all([riffle("left", 0), riffle("right", 0)]);
  busy = false;
  updateUI();
  layoutBook();
}

function flipClosed() {
  if (busy || state.left || state.right) return;
  busy = true;
  const dest = state.showingBack ? 0 : 180;
  view.y = dest;
  view.held = dest !== 0;
  gsap.to(book, {
    rotationY: dest,
    rotationX: view.x,
    duration: reduce ? 0.01 : 0.85,
    ease: "power2.inOut",
    onUpdate: syncRear,
    onComplete() {
      busy = false;
      syncRear();
      updateUI();
    }
  });
}

let drag = null;

function bindLeaf(leaf, side, index) {
  leaf.addEventListener("pointerenter", (event) => {
    if (document.body.classList.contains("is-orbit")) return;
    if (reduce || drag || locks[side] || busy || event.pointerType === "touch") return;
    if (index !== state[side] && index !== state[side] - 1) return;
    const turned = index < state[side];
    const rest = restAngle(side, turned);
    const delta = turned ? (side === "left" ? 14 : -14) : (side === "left" ? -14 : 14);
    gsap.to(leaf, { rotationY: rest + delta, duration: 0.28, ease: "power2.out", overwrite: "auto" });
  });

  leaf.addEventListener("pointerleave", () => {
    if (drag || locks[side]) return;
    if (index !== state[side] && index !== state[side] - 1) return;
    const turned = index < state[side];
    gsap.to(leaf, { rotationY: restAngle(side, turned), duration: 0.28, ease: "power2.out", overwrite: "auto" });
  });

  leaf.addEventListener("pointerdown", (event) => {
    if (document.body.classList.contains("is-orbit")) return;
    if (event.button !== 0 || locks[side] || busy) return;
    if (index !== state[side] && index !== state[side] - 1) return;
    try { leaf.setPointerCapture(event.pointerId); } catch (err) {}
    const turned = index < state[side];
    drag = { leaf, side, index, turned, x: event.clientX, moved: false, shift: event.shiftKey };
    gsap.killTweensOf(leaf);
  });
}

document.querySelector(".stage").addEventListener("pointerdown", (event) => {
  if (!document.body.classList.contains("is-orbit") || event.button !== 0) return;
  orbit = {
    x: event.clientX,
    y: event.clientY,
    rx: view.x,
    ry: view.y,
    lastX: event.clientX,
    lastT: performance.now(),
    vx: 0
  };
  gsap.killTweensOf(book);
});

window.addEventListener("pointermove", (event) => {
  if (orbit) {
    const dx = event.clientX - orbit.x;
    const dy = event.clientY - orbit.y;
    const now = performance.now();
    const dt = Math.max(16, now - orbit.lastT);
    orbit.vx = (event.clientX - orbit.lastX) / dt;
    orbit.lastX = event.clientX;
    orbit.lastT = now;
    view.y = orbit.ry + dx * 0.5;
    view.x = gsap.utils.clamp(-28, 62, orbit.rx - dy * 0.28);
    view.held = true;
    gsap.set(book, { rotationX: view.x, rotationY: view.y });
    syncRear();
    return;
  }
  if (!drag) return;
  const dx = event.clientX - drag.x;
  if (Math.abs(dx) > 8) drag.moved = true;
  const outward = drag.side === "left" ? -dx : dx;
  const sign = drag.side === "left" ? -1 : 1;
  let rotation;
  if (!drag.turned) {
    rotation = sign * Math.max(0, Math.min(155, outward * 0.55));
  } else {
    rotation = sign * (180 - Math.max(0, Math.min(155, -outward * 0.55)));
  }
  gsap.set(drag.leaf, { rotationY: rotation });
});

window.addEventListener("pointerup", () => {
  if (orbit) {
    const kick = gsap.utils.clamp(-70, 70, orbit.vx * 180);
    orbit = null;
    if (Math.abs(kick) > 10) {
      view.y += kick;
      view.held = true;
      gsap.to(book, {
        rotationY: view.y,
        duration: 0.65,
        ease: "power3.out",
        onUpdate: syncRear,
        onComplete() {
          syncRear();
          updateUI();
        }
      });
    } else {
      syncRear();
      updateUI();
    }
    return;
  }
  if (!drag) return;
  const current = drag;
  drag = null;
  const rot = Math.abs(Number(gsap.getProperty(current.leaf, "rotationY")));
  if (!current.moved) {
    if (current.shift) {
      turn(current.side, -1);
      return;
    }
    if (state.showingBack && state.left === 0 && state.right === 0) {
      gsap.set(current.leaf, { rotationY: 0 });
      flipClosed();
      return;
    }
    if (current.index === 0 && !current.turned && state.left === 0 && state.right === 0) {
      openCover();
      return;
    }
    turn(current.side, current.turned ? -1 : 1);
    return;
  }
  const progress = current.turned ? (180 - rot) / 180 : rot / 180;
  if (progress > 0.22) {
    if (current.index === 0 && !current.turned && state.left === 0 && state.right === 0) {
      gsap.set(current.leaf, { rotationY: 0 });
      openCover();
      return;
    }
    turn(current.side, current.turned ? -1 : 1);
  } else {
    gsap.to(current.leaf, {
      rotationY: restAngle(current.side, current.turned),
      duration: 0.3,
      ease: "power2.out"
    });
  }
});

function openContents() {
  contentsEl.hidden = false;
  scrim.hidden = false;
  requestAnimationFrame(() => contentsEl.classList.add("is-on"));
}

function closeContents() {
  contentsEl.classList.remove("is-on");
  scrim.hidden = true;
  setTimeout(() => {
    if (!contentsEl.classList.contains("is-on")) contentsEl.hidden = true;
  }, 400);
}

document.getElementById("btn-rotate").addEventListener("click", () => {
  document.body.classList.toggle("is-orbit");
  updateUI();
});
document.getElementById("btn-front").addEventListener("click", resetView);
document.getElementById("btn-contents").addEventListener("click", () => {
  if (contentsEl.classList.contains("is-on")) closeContents();
  else openContents();
});
document.getElementById("btn-read").addEventListener("click", () => {
  document.body.classList.toggle("is-reading");
  document.getElementById("btn-read").textContent = document.body.classList.contains("is-reading") ? "Whole book" : "Read";
  requestAnimationFrame(layoutBook);
});
document.getElementById("btn-close").addEventListener("click", closeBook);
document.getElementById("btn-back").addEventListener("click", flipClosed);
scrim.addEventListener("click", closeContents);

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (contentsEl.classList.contains("is-on")) closeContents();
    else if (document.body.classList.contains("is-orbit") || view.held) resetView();
    else if (document.body.classList.contains("is-reading")) {
      document.body.classList.remove("is-reading");
      document.getElementById("btn-read").textContent = "Read";
      layoutBook();
    }
    return;
  }
  if (event.target.closest("input, textarea")) return;
  if (document.body.classList.contains("is-orbit")) return;
  if (event.key === "ArrowLeft") turn("left", event.shiftKey ? -1 : 1);
  if (event.key === "ArrowRight") turn("right", event.shiftKey ? -1 : 1);
  if (event.key === " ") {
    event.preventDefault();
    const dir = event.shiftKey ? -1 : 1;
    turn("left", dir);
    turn("right", dir);
  }
  if (event.key === "c" || event.key === "C") {
    if (contentsEl.classList.contains("is-on")) closeContents();
    else openContents();
  }
});

let wheelAt = 0;
window.addEventListener("wheel", (event) => {
  if (event.target.closest(".contents")) return;
  if (document.body.classList.contains("is-orbit")) {
    event.preventDefault();
    view.y += event.deltaY * 0.12;
    view.held = Math.abs(norm(view.y)) > 2;
    gsap.set(book, { rotationY: view.y });
    syncRear();
    updateUI();
    return;
  }
  if (!document.body.classList.contains("is-open")) return;
  event.preventDefault();
  const now = performance.now();
  if (now < wheelAt) return;
  if (Math.abs(event.deltaY) < 8) return;
  wheelAt = now + 520;
  const dir = event.deltaY > 0 ? 1 : -1;
  turn("left", dir);
  turn("right", dir);
}, { passive: false });

window.addEventListener("resize", () => layoutBook());

function preload() {
  const files = new Set(["cover01", "cover02", "back01", "back02"]);
  SHEETS.forEach((sheet) => {
    files.add(sheet.front);
    if (sheet.back) files.add(sheet.back);
  });
  return Promise.all([...files].map((file) => new Promise((resolve) => {
    const image = new Image();
    image.onload = image.onerror = resolve;
    image.src = `assets/${file}.jpg`;
  })));
}

build();
fitBook();
gsap.set(book, { scale: 1, rotationX: view.x, rotationY: view.y, transformOrigin: "50% 55%" });
gsap.set(".wing", { width: 0 });
updateUI();

preload().then(() => {
  document.body.classList.add("is-ready");
  document.body.classList.remove("is-loading");
});
