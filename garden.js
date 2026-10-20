import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildKnife } from "./knife.js?v=1";
import { buildBee, flyBee } from "./bee.js?v=6";
import { sliceApple } from "./slice.js?v=4";

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
gsap.registerPlugin(ScrollTrigger);

const canvas = document.getElementById("garden-view");
const root = document.getElementById("garden");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1;
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
// The halves of a cut apple are clipped by planes that belong to each half.
renderer.localClippingEnabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
scene.add(new THREE.HemisphereLight(0xfff6ee, 0xd8cdc0, 0.6));

const sun = new THREE.DirectionalLight(0xfff0e0, 2.1);
sun.position.set(-4.5, 7.5, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -5;
sun.shadow.camera.right = 5;
sun.shadow.camera.top = 5;
sun.shadow.camera.bottom = -5;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 22;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun);

const rim = new THREE.DirectionalLight(0xfff0e6, 0.5);
rim.position.set(4, 3, -6);
scene.add(rim);

// A faint shadow under the island so it sits on the white instead of floating.
const shadowCatcher = new THREE.Mesh(
  new THREE.CircleGeometry(9, 64),
  new THREE.ShadowMaterial({ opacity: 0.16 })
);
shadowCatcher.rotation.x = -Math.PI / 2;
shadowCatcher.position.y = -0.55;
shadowCatcher.receiveShadow = true;
scene.add(shadowCatcher);

const view = {
  position: new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0, 5.2, 13.5),
      new THREE.Vector3(7.8, 3.6, 8.4),
      new THREE.Vector3(5.6, 1.8, 4.2),
      new THREE.Vector3(1.2, 1.5, 5.4),
      new THREE.Vector3(-4.8, 2.4, 3.6),
      new THREE.Vector3(-6.4, 4.2, -3.4),
      new THREE.Vector3(-2, 5.2, 11.8)
    ],
    false,
    "centripetal"
  ),
  look: new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0, 1.6, 0),
      new THREE.Vector3(0, 1.7, 0),
      new THREE.Vector3(0.9, 1.0, 0.4),
      new THREE.Vector3(0, 2.1, 0),
      new THREE.Vector3(0, 2.3, 0),
      new THREE.Vector3(0, 2.0, 0),
      new THREE.Vector3(0, 1.25, 0)
    ],
    false,
    "centripetal"
  )
};

let progress = 0;
let smooth = 0;
let loaded = false;
const lookAt = new THREE.Vector3();

const pathPosition = new THREE.Vector3();
const pathLook = new THREE.Vector3();

// Drag turns the island at any point of the walk: the camera swings around it,
// and keeps drifting a little after you let go.
const spin = { yaw: 0, goal: 0, speed: 0, lift: 0, liftGoal: 0, dragging: false, x: 0, y: 0, id: null };
const UP = new THREE.Vector3(0, 1, 0);

function place(amount) {
  const t = Math.min(1, Math.max(0, amount));
  view.position.getPoint(t, pathPosition);
  view.look.getPoint(t, pathLook);
  pathPosition.applyAxisAngle(UP, spin.yaw);
  pathLook.applyAxisAngle(UP, spin.yaw);
  pathPosition.y += spin.lift;
  camera.position.copy(pathPosition);
  lookAt.copy(pathLook);
  camera.lookAt(lookAt);
}

// When the scroll has run its course the island is handed over to you: drag to turn it.
const controls = new OrbitControls(camera, canvas);
controls.enabled = false;
controls.enableZoom = true;
controls.zoomSpeed = 0.8;
controls.minDistance = 4.2;
controls.maxDistance = 15;
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.rotateSpeed = 0.7;
controls.minPolarAngle = 0.35;
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.7;
controls.addEventListener("start", () => {
  controls.autoRotate = false;
});
// OrbitControls claims all touch gestures; hand vertical scrolling back until it is actually in use.
canvas.style.touchAction = "pan-y";
canvas.addEventListener("pointerdown", (event) => {
  if (orbit.active || table.active || event.button !== 0) return;
  spin.dragging = true;
  spin.speed = 0;
  spin.x = event.clientX;
  spin.y = event.clientY;
  spin.id = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (!spin.dragging || event.pointerId !== spin.id) return;
  const dx = event.clientX - spin.x;
  const dy = event.clientY - spin.y;
  spin.x = event.clientX;
  spin.y = event.clientY;
  spin.goal -= dx * 0.004;
  spin.speed = -dx * 0.004;
  if (event.pointerType !== "touch") spin.liftGoal = Math.min(2.2, Math.max(-1.2, spin.liftGoal + dy * 0.012));
});
function endSpin(event) {
  if (event.pointerId !== spin.id) return;
  spin.dragging = false;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}
canvas.addEventListener("pointerup", endSpin);
canvas.addEventListener("pointercancel", endSpin);

// A plain wheel still scrolls the page (that is how you leave); only a pinch gesture
// (ctrl + wheel on a trackpad) or the + / - buttons zoom the island.
canvas.addEventListener(
  "wheel",
  (event) => {
    if (!event.ctrlKey) event.stopImmediatePropagation();
  },
  { capture: true, passive: true }
);
const zoomState = { length: 0 };
function zoomBy(factor) {
  if (!orbit.active) return;
  const offset = camera.position.clone().sub(controls.target);
  zoomState.length = offset.length();
  const goal = Math.min(controls.maxDistance, Math.max(controls.minDistance, zoomState.length * factor));
  controls.autoRotate = false;
  gsap.killTweensOf(zoomState);
  gsap.to(zoomState, {
    length: goal,
    duration: 0.45,
    ease: "power2.out",
    onUpdate: () => {
      const dir = camera.position.clone().sub(controls.target).normalize();
      camera.position.copy(controls.target).addScaledVector(dir, zoomState.length);
      controls.update();
    }
  });
}
document.getElementById("zoom-in").addEventListener("click", () => zoomBy(0.72));
document.getElementById("zoom-out").addEventListener("click", () => zoomBy(1 / 0.72));
const orbit = { active: false, blend: 0, fromPosition: new THREE.Vector3(), fromTarget: new THREE.Vector3() };
const orbitHint = document.getElementById("orbit-hint");

function startOrbit() {
  orbit.active = true;
  orbit.blend = 0;
  controls.target.copy(pathLook);
  controls.autoRotate = true;
  controls.enabled = true;
  controls.update();
  canvas.style.touchAction = "none";
  orbitHint.classList.add("is-on");
}

function stopOrbit() {
  orbit.active = false;
  controls.enabled = false;
  orbit.fromPosition.copy(camera.position);
  orbit.fromTarget.copy(controls.target);
  orbit.blend = 1;
  canvas.style.touchAction = "pan-y";
  orbitHint.classList.remove("is-on");
}

// Scroll back up and the camera glides back onto its path.
function followPath() {
  place(smooth);
  if (orbit.blend <= 0) return;
  orbit.blend = Math.max(0, orbit.blend - 0.035);
  const k = orbit.blend * orbit.blend * (3 - 2 * orbit.blend);
  camera.position.lerpVectors(pathPosition, orbit.fromPosition, k);
  lookAt.lerpVectors(pathLook, orbit.fromTarget, k);
  camera.lookAt(lookAt);
}

// 1 on the island, 0 at the table (the table frames its own picture, nothing to make room for).
const shift = { k: 1 };
function applyView() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  // The island sits dead centre. Only on narrower windows is it nudged right,
  // so the caption on the left never touches it.
  if (w > 820 && w <= 1180 && shift.k > 0.001) camera.setViewOffset(w, h, -w * 0.06 * shift.k, 0, w, h);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}

function resize() {
  applyView();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

function render() {
  renderer.render(scene, camera);
}

resize();
place(0);
let onScreen = false;
if (root && "IntersectionObserver" in window) {
  const watch = new IntersectionObserver((entries) => {
    onScreen = entries.some((entry) => entry.isIntersecting);
  }, { rootMargin: "80px 0px" });
  watch.observe(root);
}

window.addEventListener("resize", () => {
  resize();
  if (table.active && table.framed && !table.leaving) {
    const frame = tableFrame();
    camera.position.copy(frame.to);
    table.look.copy(frame.look);
  }
  if (onScreen) render();
});

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (!reduced) {
  ScrollTrigger.create({
    trigger: "#garden",
    start: "top top",
    end: "bottom bottom",
    scrub: 1.2,
    onUpdate: (self) => {
      progress = self.progress;
    }
  });
}

// The orchard is a choice, not the next scroll: it stays out of the page until
// you enter it from the last screen of the peeling field.
const enter = document.getElementById("enter-garden");
const veil = document.getElementById("veil");
let entering = false;
enter.addEventListener("click", () => {
  if (entering) return;
  entering = true;
  gsap.to(veil, {
    opacity: 1,
    duration: 0.8,
    ease: "power2.inOut",
    onComplete: () => {
      root.hidden = false;
      progress = 0;
      smooth = 0;
      resize();
      ScrollTrigger.refresh();
      window.scrollTo(0, root.offsetTop);
      place(0);
      render();
      gsap.to(veil, { opacity: 0, duration: 1.2, ease: "power2.out", delay: 0.15, onComplete: () => (entering = false) });
    }
  });
});

/* ---------- picking: take an apple from the tree, put it in the basket ---------- */

const tally = document.getElementById("tally");
const tallyN = document.getElementById("tally-n");
const tallyTotal = document.getElementById("tally-total");
const apples = [];
// Where the table apple was lifted from, and the free spot in the tree it moves to.
let tablePlate = null;
const TREE_SPOT = new THREE.Vector3(-2.7, 3.05, 0.75);
const KNIFE = { scale: 1, turn: 0.5, dx: -0.55, dz: 0.05, lift: -0.02 };
let knifeRoot = null;
let knifeRest = null;
let gardenModel = null;
let bee = null;
let basket = null;
let basketCount = 0;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const rayPoint = new THREE.Vector3();
let hovered = null;

function bodyOf(group) {
  let body = null;
  let most = 0;
  group.traverse((child) => {
    if (child.isMesh && child.geometry.attributes.position.count > most) {
      most = child.geometry.attributes.position.count;
      body = child;
    }
  });
  return body;
}

function collect(model) {
  model.updateMatrixWorld(true);
  const found = [];
  const tree = model.getObjectByName("Apple_Tree");
  tree.children.forEach((child) => {
    if (/^Apple_0\d/.test(child.name)) found.push(child);
  });
  // The apple that sat on the table now hangs in the tree; the table keeps only its plate.
  let tableApple = null;
  model.traverse((child) => {
    if (/^Apple_0\d/.test(child.name) && child.parent !== tree && child.children.length) tableApple = child;
  });
  if (tableApple) {
    const spot = new THREE.Box3().setFromObject(bodyOf(tableApple));
    tablePlate = { centre: spot.getCenter(new THREE.Vector3()), bottom: spot.min.y };
    found.push(tableApple);
  }
  found.forEach((group) => {
    const body = bodyOf(group);
    const box = new THREE.Box3().setFromObject(body);
    const centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    // A pivot at the apple's centre, so it can turn on the spot.
    const pivot = new THREE.Group();
    // It lives directly under the model root (world space), because the tree
    // and the table are offset groups and the flight is worked out in world space.
    pivot.position.copy(centre);
    model.add(pivot);
    pivot.updateMatrixWorld(true);
    pivot.attach(group);
    const entry = { group, pivot, radius: Math.max(size.x, size.y, size.z) / 2, picked: false, lift: 0, baseScale: 1, pop: 1 };
    if (group === tableApple) {
      // Hang it among the others: a free spot on the front of the canopy, sized like its neighbours.
      pivot.position.copy(TREE_SPOT);
      entry.baseScale = 0.87;
      pivot.scale.setScalar(entry.baseScale);
      entry.radius *= entry.baseScale;
    }
    entry.home = { position: pivot.position.clone(), rotation: pivot.rotation.clone() };
    apples.push(entry);
  });
  tallyTotal.textContent = apples.length;

  // The basket is the last group in the garden.
  const garden = model.getObjectByName("Apple_Collection_Garden");
  const last = garden.children[garden.children.length - 1];
  const box = new THREE.Box3().setFromObject(last);
  basket = {
    centre: box.getCenter(new THREE.Vector3()),
    floor: box.min.y,
    radius: Math.min(box.max.x - box.min.x, box.max.z - box.min.z) / 2
  };
}

// Where the n-th apple comes to rest: a ring around the middle, then a second layer.
function slotFor(n, radius) {
  // Four on the bottom, three nested on top; wider apples are kept inside the rim.
  // The basket narrows toward its base, so the bottom layer sits tight and a little high.
  const ring = Math.min(radius * 1.1, basket.radius - radius - 0.06);
  const layer = n < 4 ? 0 : 1;
  const k = layer === 0 ? n : n - 4;
  const angle = (k / (layer === 0 ? 4 : 3)) * Math.PI * 2 + (layer === 0 ? 0.4 : 0.4 + Math.PI / 4);
  const spread = layer === 0 ? ring : ring * 0.62;
  return new THREE.Vector3(
    basket.centre.x + Math.cos(angle) * spread,
    basket.floor + 0.1 + radius + layer * radius * 1.3,
    basket.centre.z + Math.sin(angle) * spread
  );
}

function pointerRay(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -(((event.clientY - rect.top) / rect.height) * 2 - 1));
  raycaster.setFromCamera(pointer, camera);
}

// Nearest un-picked apple under the pointer; small or far apples get a wider catch.
function appleAt(event) {
  pointerRay(event);
  let best = null;
  let bestDistance = Infinity;
  apples.forEach((apple) => {
    if (apple.picked) return;
    apple.pivot.getWorldPosition(rayPoint);
    const away = camera.position.distanceTo(rayPoint);
    const reach = Math.max(apple.radius * 1.3, away * 0.016);
    if (raycaster.ray.distanceSqToPoint(rayPoint) < reach * reach && away < bestDistance) {
      best = apple;
      bestDistance = away;
    }
  });
  return best;
}

const pickedOrder = [];

function pick(apple) {
  apple.picked = true;
  pickedOrder.push(apple);
  hovered = null;
  canvas.classList.remove("can-pick");
  tally.classList.add("is-started");
  const from = apple.pivot.position.clone();
  const to = slotFor(basketCount, apple.radius);
  basketCount += 1;
  const mid = from.clone().lerp(to, 0.5);
  mid.y = Math.max(from.y, to.y) + 0.7;
  const spin = { x: (Math.random() - 0.5) * 2.2, y: Math.PI * 2 + Math.random() * 2, z: (Math.random() - 0.5) * 1.6 };
  const state = { t: 0 };
  const point = new THREE.Vector3();
  gsap.timeline()
    // Pull free of the branch, then carry it over in an arc and let it down.
    .to(apple.pivot.scale, { x: 1.12, y: 1.12, z: 1.12, duration: 0.18, ease: "power2.out" })
    .to(state, {
      t: 1,
      duration: 1.15,
      ease: "power2.inOut",
      onUpdate: () => {
        const u = state.t;
        point.set(0, 0, 0)
          .addScaledVector(from, (1 - u) * (1 - u))
          .addScaledVector(mid, 2 * (1 - u) * u)
          .addScaledVector(to, u * u);
        apple.pivot.position.copy(point);
        apple.pivot.rotation.set(spin.x * u, spin.y * u, spin.z * u);
      }
    })
    .to(apple.pivot.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: "bounce.out" }, "<0.7")
    .to(apple.pivot.position, { y: to.y - 0.012, duration: 0.14, ease: "power1.in" })
    .to(apple.pivot.position, { y: to.y, duration: 0.3, ease: "bounce.out" })
    .add(() => {
      tallyN.textContent = basketCount;
      if (basketCount === apples.length) {
        tally.classList.add("is-done");
        // Every apple is in the basket: carry them to the table.
        gsap.delayedCall(1.3, enterTable);
      }
    }, ">-0.3");
}

canvas.addEventListener("pointermove", (event) => {
  if (!loaded || table.active || event.pointerType === "touch") return;
  const apple = appleAt(event);
  hovered = apple;
  bookWanted = !apple && hitBook(event);
  canvas.classList.toggle("can-pick", Boolean(apple) || bookWanted);
  bookTip.style.transform = `translate(${event.clientX + 16}px, ${event.clientY + 14}px)`;
  bookTip.classList.toggle("is-on", bookWanted);
});
canvas.addEventListener("pointerleave", () => {
  bookWanted = false;
  bookTip.classList.remove("is-on");
});

let downAt = null;
canvas.addEventListener("pointerdown", (event) => {
  downAt = { x: event.clientX, y: event.clientY };
});

canvas.addEventListener("click", (event) => {
  if (!loaded || table.active) return;
  // A drag that turned the island is not a click.
  if (downAt && Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 6) return;
  const apple = appleAt(event);
  if (apple) {
    pick(apple);
    return;
  }
  if (hitBook(event)) openBook();
});


/* ---------- the table: once every apple is picked, you cut them ---------- */

const tableUi = document.getElementById("table-ui");
const tableHint = document.getElementById("table-hint");
const tableN = document.getElementById("table-n");
const tableTotal = document.getElementById("table-total");
const tableBack = document.getElementById("table-back");

const TABLE = {
  radius: 0.215,
  // Camera offset from the plate, and where it looks relative to the plate.
  cameraOffset: new THREE.Vector3(-0.3, 1.5, 1.95),
  aim: new THREE.Vector3(-0.42, -0.1, 0.05),
  knifeScale: 1.3
};
const table = {
  active: false,
  leaving: false,
  queue: [],
  current: null,
  ready: false,
  busy: false,
  cuts: 0,
  slices: [],
  look: new THREE.Vector3(),
  framed: false,
  down: null,
  pointer: null,
  heading: 0,
  knifePose: 0
};
const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const tableHit = new THREE.Vector3();

function tablePoint(event, y) {
  pointerRay(event);
  tablePlane.constant = -y;
  return raycaster.ray.intersectPlane(tablePlane, tableHit) ? tableHit.clone() : null;
}

function tableLevel() {
  return tablePlate.bottom + TABLE.radius;
}

function setTableHint(text) {
  tableHint.textContent = text;
}

// Where the camera stands at the table. It backs off on narrow windows, so the whole
// apple and room on both sides of it for the stroke are always on screen.
function tableFrame() {
  const plate = new THREE.Vector3(tablePlate.centre.x, tablePlate.bottom, tablePlate.centre.z);
  const look = plate.clone().add(TABLE.aim);
  const home = plate.clone().add(TABLE.cameraOffset).sub(look);
  const aspect = camera.aspect;
  // Half the width of the table, in world units, that has to fit: the apple and the
  // stroke around it on a phone, the stored halves on the left as well on a wide screen.
  const half = Math.min(1.07, Math.max(0.78, 0.66 + (aspect - 0.6) * 0.8));
  const seen = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect * home.length();
  const back = Math.max(1, half / seen);
  return { to: look.clone().addScaledVector(home, back), look };
}

function currentLook() {
  return orbit.active ? controls.target.clone() : lookAt.clone();
}

function enterTable() {
  if (table.active || !tablePlate) return;
  table.active = true;
  table.leaving = false;
  table.queue = pickedOrder.slice();
  table.cuts = 0;
  table.ready = false;
  table.busy = false;
  tableN.textContent = 0;
  tableTotal.textContent = apples.length;
  setTableHint("Taking the apples to the table.");

  const wasOrbit = orbit.active;
  const from = camera.position.clone();
  const fromLook = currentLook();
  if (wasOrbit) {
    orbit.active = false;
    controls.enabled = false;
  }
  orbitHint.classList.remove("is-on");
  tally.classList.add("is-hidden");
  canvas.style.touchAction = "none";
  canvas.classList.remove("can-pick");
  canvas.classList.add("is-table");
  root.classList.add("is-table");
  tableUi.classList.add("is-on");

  const frame = tableFrame();
  const to = frame.to;
  const toLook = frame.look;
  table.framed = false;
  gsap.to(shift, { k: 0, overwrite: true, duration: 2.4, ease: "power3.inOut", onUpdate: applyView });
  table.look.copy(fromLook);
  const state = { t: 0 };
  table.enterTween = gsap.to(state, {
    t: 1,
    duration: 2.4,
    ease: "power3.inOut",
    onUpdate: () => {
      camera.position.lerpVectors(from, to, state.t);
      camera.position.y += Math.sin(state.t * Math.PI) * 0.5;
      table.look.lerpVectors(fromLook, toLook, state.t);
    },
    onComplete: () => {
      camera.position.copy(to);
      table.look.copy(toLook);
      table.framed = true;
      // The knife leaves its place on the table and becomes your hand.
      if (knifeRoot) {
        gsap.to(knifeRoot.scale, { x: TABLE.knifeScale, y: TABLE.knifeScale, z: TABLE.knifeScale, duration: 0.8, ease: "power2.out" });
        gsap.to(table, { knifePose: 1, duration: 0.8, ease: "power2.out" });
      }
      nextApple();
    }
  });
}

// The next apple comes out of the basket and settles on the plate.
function nextApple() {
  const apple = table.queue.shift();
  table.current = apple || null;
  table.ready = false;
  if (!apple) {
    finishTable();
    return;
  }
  setTableHint(table.cuts === 0 ? "Click the apple to cut it." : "Next apple. Click it to cut.");
  const r0 = apple.radius / apple.baseScale;
  const scale = TABLE.radius / r0;
  const from = apple.pivot.position.clone();
  const to = new THREE.Vector3(tablePlate.centre.x, tablePlate.bottom + TABLE.radius + 0.002, tablePlate.centre.z);
  const mid = from.clone().lerp(to, 0.5);
  mid.y = Math.max(from.y, to.y) + 0.9;
  const startRotation = apple.pivot.rotation.clone();
  const yaw = Math.random() * Math.PI * 2;
  const state = { t: 0 };
  const point = new THREE.Vector3();
  const startScale = apple.pivot.scale.x;
  apple.pivot.visible = true;
  table.flight = gsap.to(state, {
    t: 1,
    duration: 0.8,
    ease: "power2.inOut",
    onUpdate: () => {
      const u = state.t;
      point.set(0, 0, 0)
        .addScaledVector(from, (1 - u) * (1 - u))
        .addScaledVector(mid, 2 * (1 - u) * u)
        .addScaledVector(to, u * u);
      apple.pivot.position.copy(point);
      apple.pivot.rotation.set(startRotation.x * (1 - u), startRotation.y + (yaw - startRotation.y) * u, startRotation.z * (1 - u));
      apple.pivot.scale.setScalar(startScale + (scale - startScale) * u);
    },
    onComplete: () => {
      apple.pivot.position.copy(to);
      if (table.active && !table.leaving) table.ready = true;
    }
  });
}

// The text of the Cut chapter: after the last apple it rises over the table and can be read.
const cutSheet = document.getElementById("cut-sheet");
const tableRead = document.getElementById("table-read");

function openCutText() {
  if (!table.active || table.leaving) return;
  root.classList.add("is-reading");
  cutSheet.scrollTop = 0;
  cutSheet.setAttribute("aria-hidden", "false");
  cutSheet.focus({ preventScroll: true });
}

function closeCutText() {
  if (table.textTimer) table.textTimer.kill();
  root.classList.remove("is-reading");
  cutSheet.setAttribute("aria-hidden", "true");
}

function finishTable() {
  setTableHint("All cut. Read the text, or go back to the island.");
  tableBack.classList.add("is-ready");
  tableUi.classList.add("is-finished");
}

tableRead.addEventListener("click", openCutText);
document.getElementById("cut-table").addEventListener("click", closeCutText);
document.getElementById("cut-island").addEventListener("click", () => {
  closeCutText();
  exitTable();
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && root.classList.contains("is-reading")) closeCutText();
});

function tryCut(point) {
  const apple = table.current;
  if (!table.down || !point) return;
  // A press made while the apple is still landing or the last cut is settling starts over once it is ready.
  if (!table.ready || table.busy || !apple) {
    table.down.start = point;
    return;
  }
  const c = apple.pivot.position;
  const a = table.down.start;
  const R = TABLE.radius;
  const dx = point.x - a.x;
  const dz = point.z - a.z;
  const length = Math.hypot(dx, dz);
  if (length < R) return;
  const d = new THREE.Vector3(dx / length, 0, dz / length);
  const behind = (a.x - c.x) * d.x + (a.z - c.z) * d.z;
  const ahead = (point.x - c.x) * d.x + (point.z - c.z) * d.z;
  const off = Math.abs((c.x - a.x) * d.z - (c.z - a.z) * d.x);
  // The blade has gone in on one side of the middle and come past it, roughly through the centre.
  if (behind < -R * 0.15 && ahead > R * 0.15 && off < R * 0.78) cutApple(apple, d);
}

// A single click (or tap) on the apple is enough: it is cut across the screen, left to right.
function quickCut(point) {
  const apple = table.current;
  if (!table.ready || table.busy || !apple || !point) return;
  const c = apple.pivot.position;
  if (Math.hypot(point.x - c.x, point.z - c.z) > TABLE.radius * 1.5) return;
  const across = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  across.y = 0;
  if (across.lengthSq() < 1e-6) across.set(1, 0, 0);
  cutApple(apple, across.normalize());
}

function cutApple(apple, d) {
  table.busy = true;
  table.ready = false;
  // One stroke, one cut: lift the knife and start again for the next apple.
  table.down = null;
  const normal = new THREE.Vector3(-d.z, 0, d.x);
  const slice = sliceApple({ apple, body: bodyOf(apple.group), normal, scene, renderer });
  apple.pivot.visible = false;
  table.slices.push(slice);
  const pair = table.cuts;
  table.cuts += 1;
  tableN.textContent = table.cuts;
  setTableHint(table.queue.length ? "Cut" : "Last one");
  // The halves stay a moment on the plate, then are set cut-side up on the left of the table.
  gsap.delayedCall(0.7, () => {
    if (!table.active || table.leaving) return;
    storeHalves(slice, pair, d);
  });
  gsap.delayedCall(1.05, () => {
    if (!table.active || table.leaving) return;
    table.busy = false;
    nextApple();
  });
}

// The left panel of the table: found by its size and place among the table's own parts.
function leftPanel(model) {
  const garden = model.getObjectByName("Apple_Collection_Garden");
  const tableGroup = garden.children[garden.children.length - 3];
  tableGroup.updateMatrixWorld(true);
  let best = null;
  tableGroup.children.forEach((child) => {
    if (!child.isMesh || !child.visible) return;
    const box = new THREE.Box3().setFromObject(child);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    if (size.y > 0.05 || size.x < 0.5 || size.z < 0.5) return;
    if (centre.x > tablePlate.centre.x - 0.3) return;
    if (!best || size.x * size.z > best.size.x * best.size.z) best = { box, centre, size };
  });
  const yaw = tableGroup.rotation.y;
  return {
    centre: best ? best.centre : new THREE.Vector3(tablePlate.centre.x - 0.95, tablePlate.bottom - 0.04, tablePlate.centre.z - 0.14),
    top: best ? best.box.max.y : tablePlate.bottom - 0.04,
    right: new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)),
    forward: new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw))
  };
}

// Pair `pair` takes the next two places in a 4 x 4 grid: back row first, two apples to a row.
const HALF_SCALE = 0.48;
function storeHalves(slice, pair, d) {
  if (!table.panel) table.panel = leftPanel(gardenModel);
  const panel = table.panel;
  const diameter = TABLE.radius * 2 * HALF_SCALE;
  const step = diameter + 0.01;
  const row = Math.floor(pair / 2);
  slice.halves.forEach((half, j) => {
    const col = (pair % 2) * 2 + j;
    const slot = panel.centre.clone()
      .addScaledVector(panel.right, (col - 1.5) * step)
      .addScaledVector(panel.forward, (row - 1.5) * step);
    const finalScale = half.scale * HALF_SCALE;
    slot.y = panel.top + half.depth * finalScale + 0.003;
    // Cut face up, turned a little at random so they do not look stamped out.
    const flip = new THREE.Quaternion().setFromUnitVectors(half.face, new THREE.Vector3(0, 1, 0));
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 1.6);
    const target = yaw.multiply(flip).multiply(half.base);
    const fromPosition = half.root.position.clone();
    const fromQuaternion = half.root.quaternion.clone();
    const fromScale = half.root.scale.x;
    const mid = fromPosition.clone().lerp(slot, 0.5);
    mid.y = Math.max(fromPosition.y, slot.y) + 0.45;
    const state = { t: 0 };
    const point = new THREE.Vector3();
    if (half.tween) half.tween.kill();
    gsap.to(state, {
      t: 1,
      duration: 1.15,
      delay: j * 0.12,
      ease: "power2.inOut",
      onUpdate: () => {
        const u = state.t;
        point.set(0, 0, 0)
          .addScaledVector(fromPosition, (1 - u) * (1 - u))
          .addScaledVector(mid, 2 * (1 - u) * u)
          .addScaledVector(slot, u * u);
        half.root.position.copy(point);
        half.root.quaternion.slerpQuaternions(fromQuaternion, target, u);
        half.root.scale.setScalar(fromScale + (finalScale - fromScale) * u);
      }
    });
  });
}

function pathAt(amount, outPosition, outLook) {
  const t = Math.min(1, Math.max(0, amount));
  view.position.getPoint(t, outPosition);
  view.look.getPoint(t, outLook);
  outPosition.applyAxisAngle(UP, spin.yaw);
  outLook.applyAxisAngle(UP, spin.yaw);
  outPosition.y += spin.lift;
}

function resetApples() {
  pickedOrder.length = 0;
  basketCount = 0;
  tallyN.textContent = 0;
  tally.classList.remove("is-started", "is-done", "is-hidden");
  apples.forEach((apple, index) => {
    apple.picked = false;
    apple.lift = 0;
    apple.pop = 0.001;
    apple.pivot.position.copy(apple.home.position);
    apple.pivot.rotation.copy(apple.home.rotation);
    apple.pivot.visible = true;
    gsap.to(apple, { pop: 1, duration: 0.7, delay: 0.1 + index * 0.08, ease: "back.out(2)" });
  });
}

function exitTable() {
  if (!table.active || table.leaving) return;
  table.leaving = true;
  gsap.killTweensOf(table);
  if (table.enterTween) table.enterTween.kill();
  if (table.flight) table.flight.kill();
  table.slices.forEach((slice) => slice.remove(0, 0.5));
  table.slices = [];
  table.panel = null;
  table.busy = true;
  table.ready = false;
  table.framed = false;
  table.down = null;
  closeCutText();
  tableUi.classList.remove("is-finished");
  gsap.to(shift, { k: 1, overwrite: true, duration: 2.2, ease: "power3.inOut", onUpdate: applyView });
  tableUi.classList.remove("is-on");
  tableBack.classList.remove("is-ready");
  canvas.classList.remove("is-table");
  root.classList.remove("is-table");
  if (table.current) table.current.pivot.visible = false;
  if (knifeRoot && knifeRest) {
    gsap.to(table, { knifePose: 0, duration: 0.8, ease: "power2.inOut" });
    gsap.to(knifeRoot.scale, { x: knifeRest.scale, y: knifeRest.scale, z: knifeRest.scale, duration: 0.8 });
    gsap.to(knifeRoot.position, { x: knifeRest.position.x, y: knifeRest.position.y, z: knifeRest.position.z, duration: 0.9, ease: "power2.inOut" });
    gsap.to(knifeRoot.rotation, { x: 0, y: knifeRest.yaw, z: 0, duration: 0.9, ease: "power2.inOut" });
  }
  const from = camera.position.clone();
  const fromLook = table.look.clone();
  const target = new THREE.Vector3();
  const targetLook = new THREE.Vector3();
  const state = { t: 0 };
  gsap.to(state, {
    t: 1,
    duration: 2.2,
    ease: "power3.inOut",
    onUpdate: () => {
      pathAt(smooth, target, targetLook);
      camera.position.lerpVectors(from, target, state.t);
      camera.position.y += Math.sin(state.t * Math.PI) * 0.5;
      table.look.lerpVectors(fromLook, targetLook, state.t);
    },
    onComplete: () => {
      table.active = false;
      table.leaving = false;
      table.busy = false;
      table.current = null;
      canvas.style.touchAction = "pan-y";
      resetApples();
    }
  });
}
tableBack.addEventListener("click", exitTable);

canvas.addEventListener("pointerdown", (event) => {
  if (!table.active || table.leaving || event.button !== 0) return;
  const p = tablePoint(event, tableLevel());
  if (!p) return;
  table.down = { start: p, id: event.pointerId };
  table.pointer = p;
  quickCut(p);
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch (error) {
    // A pointer that is already gone cannot be captured; the click has been handled anyway.
  }
});
canvas.addEventListener("pointermove", (event) => {
  if (!table.active || table.leaving) return;
  const p = tablePoint(event, tableLevel());
  if (!p) return;
  table.pointer = p;
  if (table.down) tryCut(p);
});
function endCut(event) {
  if (!table.down || event.pointerId !== table.down.id) return;
  table.down = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}
canvas.addEventListener("pointerup", endCut);
canvas.addEventListener("pointercancel", endCut);

// The knife follows the pointer, blade standing on edge and turned along the stroke.
const knifeAim = new THREE.Vector3();
function updateKnife() {
  if (!knifeRoot || !knifeRest) return;
  const pose = table.knifePose;
  if (pose <= 0.001 || table.leaving) return;
  const scale = knifeRoot.scale.x;
  const bladeMid = 0.17 * scale;
  const point = table.pointer || new THREE.Vector3(tablePlate.centre.x - 0.5, tablePlate.bottom, tablePlate.centre.z + 0.4);
  // Heading: along the stroke while cutting, otherwise toward where the pointer is moving.
  if (table.down) {
    const dx = point.x - table.down.start.x;
    const dz = point.z - table.down.start.z;
    if (Math.hypot(dx, dz) > 0.03) table.heading = Math.atan2(-dz, dx);
  } else if (table.pointer) {
    const dx = point.x - knifeAim.x;
    const dz = point.z - knifeAim.z;
    if (Math.hypot(dx, dz) > 0.004) table.heading = Math.atan2(-dz, dx);
  }
  knifeAim.copy(point);
  let diff = table.heading - knifeRoot.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  const yaw = knifeRoot.rotation.y + diff * 0.18;
  // Hovering clear above the apple; pressed, the blade runs through its middle.
  const height = tableLevel() + 0.03 * scale + (table.down ? 0 : 0.14);
  const goalX = point.x - Math.cos(yaw) * bladeMid;
  const goalZ = point.z + Math.sin(yaw) * bladeMid;
  const k = 0.3 * pose;
  knifeRoot.position.x += (goalX - knifeRoot.position.x) * k;
  knifeRoot.position.z += (goalZ - knifeRoot.position.z) * k;
  knifeRoot.position.y += (height - knifeRoot.position.y) * k;
  knifeRoot.rotation.y = yaw;
  knifeRoot.rotation.x += (Math.PI / 2 - knifeRoot.rotation.x) * 0.2 * pose;
}

// The wordmark at the top left is the way home: back to the first screen, and
// the orchard closes again until you choose to enter it.
const homeLink = document.getElementById("home-link");
homeLink.addEventListener("click", (event) => {
  event.preventDefault();
  if (entering) return;
  if (root.hidden) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  entering = true;
  gsap.to(veil, {
    opacity: 1,
    duration: 0.6,
    ease: "power2.inOut",
    onComplete: () => {
      root.hidden = true;
      progress = 0;
      smooth = 0;
      ScrollTrigger.refresh();
      window.scrollTo(0, 0);
      gsap.to(veil, { opacity: 0, duration: 0.9, ease: "power2.out", delay: 0.1, onComplete: () => (entering = false) });
    }
  });
});


/* ---------- the book on the grass: the real book model, and a way into it ---------- */

const bookTip = document.getElementById("book-tip");
let bookRoot = null;
let bookMeshes = [];
let bookHover = 0;
let bookWanted = false;
let leaving = false;

// The same spiral the book itself uses for its binding.
class HelixCurve extends THREE.Curve {
  constructor(radius, height, turns, sign) {
    super();
    this.radius = radius;
    this.height = height;
    this.turns = turns;
    this.sign = sign;
  }
  getPoint(t, target = new THREE.Vector3()) {
    const angle = t * this.turns * Math.PI * 2;
    return target.set(Math.cos(angle) * this.radius * this.sign, (t - 0.5) * this.height, Math.sin(angle) * this.radius);
  }
}

function buildBook() {
  // Same proportions as the printed book: two square halves side by side, 34-turn red coil on each outer edge.
  const PAGE = 1.35;
  const DEPTH = 17 * 0.0044;
  const WIDTH = PAGE * 2 - 0.016;
  const textures = new THREE.TextureLoader();
  const load = (file) => {
    const tex = textures.load(`assets/${file}.jpg`, () => render());
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  };
  const paper = new THREE.MeshStandardMaterial({ color: 0xf6f2ea, roughness: 0.94 });
  const face = (file) => new THREE.MeshStandardMaterial({ map: load(file), roughness: 0.88, metalness: 0 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(WIDTH, PAGE, DEPTH), [paper, paper, paper, paper, face("cover01"), face("back01")]);
  const coilMat = new THREE.MeshPhysicalMaterial({ color: 0xe10612, roughness: 0.28, metalness: 0.02, clearcoat: 0.62, clearcoatRoughness: 0.25 });
  const radius = Math.max(DEPTH / 2 + 0.018, 0.036);
  const coils = [-1, 1].map((sign) => {
    const curve = new HelixCurve(radius, PAGE * 0.992, 34, -sign);
    const coil = new THREE.Mesh(new THREE.TubeGeometry(curve, 34 * 24, 0.0085, 8, false), coilMat);
    coil.position.x = sign * (WIDTH / 2 - 0.008 - radius * 0.55 + 0.03);
    return coil;
  });
  const lying = new THREE.Group();
  lying.add(body, ...coils);
  // Lay it flat, cover up.
  lying.rotation.x = -Math.PI / 2;
  const root = new THREE.Group();
  root.add(lying);
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });
  return { root, lying, depth: DEPTH, width: WIDTH };
}

function placeBook(model) {
  const garden = model.getObjectByName("Apple_Collection_Garden");
  const old = garden.children[garden.children.length - 2];
  old.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(old);
  const centre = box.getCenter(new THREE.Vector3());
  const yaw = new THREE.Euler().setFromQuaternion(old.getWorldQuaternion(new THREE.Quaternion()), "YXZ").y;
  old.visible = false;

  const { root, depth } = buildBook();
  const scale = 0.36;
  root.scale.setScalar(scale);
  root.rotation.y = yaw;
  root.position.set(centre.x, box.min.y + (depth * scale) / 2 + 0.004, centre.z);
  root.userData.restY = root.position.y;
  model.add(root);
  bookRoot = root;
  bookMeshes = [];
  root.traverse((child) => child.isMesh && bookMeshes.push(child));
}

function hitBook(event) {
  if (!bookRoot) return false;
  pointerRay(event);
  return raycaster.intersectObjects(bookMeshes, false).length > 0;
}

function removeTableText(model) {
  // The table is the third-to-last group; its flat printed labels are the 4-vertex planes.
  const garden = model.getObjectByName("Apple_Collection_Garden");
  const table = garden.children[garden.children.length - 3];
  table.children.forEach((child) => {
    if (child.isMesh && child.geometry.attributes.position.count === 4) child.visible = false;
  });
}

function placeKnife(model) {
  if (!tablePlate) return;
  const garden = model.getObjectByName("Apple_Collection_Garden");
  const table = garden.children[garden.children.length - 3];
  const yaw = new THREE.Euler().setFromQuaternion(table.getWorldQuaternion(new THREE.Quaternion()), "YXZ").y;
  const knife = buildKnife();
  knife.scale.setScalar(KNIFE.scale);
  knife.rotation.y = yaw + KNIFE.turn;
  // Table-local offset from the plate, turned by the table's own yaw.
  const dx = Math.cos(yaw) * KNIFE.dx + Math.sin(yaw) * KNIFE.dz;
  const dz = -Math.sin(yaw) * KNIFE.dx + Math.cos(yaw) * KNIFE.dz;
  knife.position.set(tablePlate.centre.x + dx, tablePlate.bottom + KNIFE.lift, tablePlate.centre.z + dz);
  knife.rotation.order = "YXZ";
  model.add(knife);
  knifeRoot = knife;
  knifeRest = { position: knife.position.clone(), yaw: knife.rotation.y, scale: knife.scale.x };
}

function openBook() {
  if (leaving) return;
  leaving = true;
  gsap.to(veil, {
    opacity: 1,
    duration: 0.7,
    ease: "power2.inOut",
    onComplete: () => {
      window.location.href = "book.html";
    }
  });
}

new GLTFLoader().load("models/environment.glb", (gltf) => {
  const model = gltf.scene;
  model.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });
  scene.add(model);
  gardenModel = model;
  collect(model);
  removeTableText(model);
  placeBook(model);
  placeKnife(model);
  bee = buildBee();
  bee.scale.setScalar(1);
  const tree = model.getObjectByName("Apple_Tree");
  if (tree) {
    const box = new THREE.Box3().setFromObject(tree);
    const centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    bee.userData.tree = {
      x: centre.x,
      z: centre.z,
      r: Math.max(size.x, size.z) * 0.52 + 0.4
    };
  }
  scene.add(bee);
  flyBee(bee, 0);
  const box = new THREE.Box3().setFromObject(model);
  loaded = true;
  render();
});

gsap.ticker.add(() => {
  if (!loaded || !onScreen || document.hidden) return;
  smooth += (progress - smooth) * 0.08;
  if (table.active) {
    if (bee) bee.visible = false;
    camera.lookAt(table.look);
    updateKnife();
    render();
    return;
  }
  if (bee) {
    bee.visible = true;
    if (!reduced) flyBee(bee, performance.now() * 0.001);
  }
  const settledAtEnd = progress > 0.995 && smooth > 0.985;
  if (settledAtEnd && !orbit.active) {
    place(1);
    startOrbit();
  } else if (orbit.active && progress < 0.96) stopOrbit();
  if (orbit.active) controls.update();
  else {
    if (!spin.dragging) {
      spin.goal += spin.speed;
      spin.speed *= 0.93;
    }
    spin.yaw += (spin.goal - spin.yaw) * 0.14;
    spin.lift += (spin.liftGoal - spin.lift) * 0.14;
    followPath();
  }
  // A hovered apple swells a touch, so it reads as something you can take.
  apples.forEach((apple) => {
    if (apple.picked) return;
    apple.lift += ((apple === hovered ? 1 : 0) - apple.lift) * 0.2;
    apple.pivot.scale.setScalar(apple.baseScale * (1 + apple.lift * 0.09) * apple.pop);
  });
  // The book rises a little when you point at it.
  if (bookRoot) {
    bookHover += ((bookWanted ? 1 : 0) - bookHover) * 0.15;
    bookRoot.position.y = bookRoot.userData.restY + bookHover * 0.06;
    bookRoot.scale.setScalar(0.36 * (1 + bookHover * 0.05));
  }
  render();
});
