import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const PAGE = 1.35;
const THICK = 0.0044;
const OPEN_GAP = 0.006;
const TURNS = 34;

const SHEETS = [
  { section: "Introduction", folio: ["02", "03"], front: "p01", back: null },
  { section: "Contents", folio: ["04", "05"], front: "p03", back: "p04" },
  { section: "Form", folio: ["06", "07"], front: "p05", back: "p06" },
  { section: "Form", folio: ["08", "09"], front: "p07", back: null },
  { section: "Form", folio: ["10", "11"], front: "p09", back: "p10" },
  { section: "Variety", folio: ["12", "13"], front: "p11", back: "p12" },
  { section: "Variety", folio: ["14", "15"], front: "p13", back: null },
  { section: "Variety", folio: ["16", "17"], front: "p15", back: null },
  { section: "Cut", folio: ["18", "19"], front: "p17", back: "p18" },
  { section: "Cut", folio: ["20", "21"], front: "p19", back: null },
  { section: "Interior", folio: ["22", "23"], front: "p21", back: null },
  { section: "Marks", folio: ["24", "25"], front: "p23", back: null },
  { section: "Time", folio: ["26", "27"], front: "p25", back: null },
  { section: "Time", folio: ["28", "29"], front: "p27", back: null },
  { section: "End", folio: ["30", "31"], front: "p29", back: "p30" }
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

const canvas = document.getElementById("view");
const whereEl = document.getElementById("where");
const hintEl = document.getElementById("hint");
const folioEl = document.getElementById("folio");
const contentsEl = document.getElementById("contents");
const scrim = document.getElementById("scrim");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0xe8e2d8, 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe8e2d8);

const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 40);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.6;
controls.maxDistance = 8;
controls.maxPolarAngle = Math.PI / 2 + 0.22;
controls.target.set(0, 0, 0);

scene.add(new THREE.HemisphereLight(0xfff6ee, 0xd8d0c4, 0.85));
scene.add(new THREE.AmbientLight(0xffffff, 0.22));
const sun = new THREE.DirectionalLight(0xffffff, 1.55);
sun.position.set(-2.2, 4.8, 3.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 16;
sun.shadow.camera.left = -4;
sun.shadow.camera.right = 4;
sun.shadow.camera.top = 3;
sun.shadow.camera.bottom = -3;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.025;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.ShadowMaterial({ opacity: 0.28 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -PAGE / 2 - 0.012;
ground.receiveShadow = true;
scene.add(ground);

const book = new THREE.Group();
scene.add(book);
let backBoard = null;
let insideBack = null;

const paper = new THREE.MeshStandardMaterial({ color: 0xf6f2ea, roughness: 0.94, metalness: 0 });
const holeMat = new THREE.MeshStandardMaterial({ color: 0x14110f, roughness: 0.8, metalness: 0 });
const coilMat = new THREE.MeshPhysicalMaterial({
  color: 0xe10612,
  roughness: 0.28,
  metalness: 0.02,
  clearcoat: 0.62,
  clearcoatRoughness: 0.25
});

class HelixCurve extends THREE.Curve {
  constructor(radiusX, radiusZ, height, turns, xSign) {
    super();
    this.radiusX = radiusX;
    this.radiusZ = radiusZ;
    this.height = height;
    this.turns = turns;
    this.xSign = xSign;
  }
  getPoint(t, target = new THREE.Vector3()) {
    const angle = t * this.turns * Math.PI * 2;
    return target.set(
      Math.cos(angle) * this.radiusX * this.xSign,
      (t - 0.5) * this.height,
      Math.sin(angle) * this.radiusZ
    );
  }
}

// Each side keeps its own count of turned leaves, so the left and right pages turn on their own.
const state = { left: 0, right: 0 };
const locks = { left: false, right: false };
const sides = { left: [], right: [] };
const roots = {};
let sequencing = false;
const loader = new THREE.TextureLoader();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const home = new THREE.Vector3();

function loadTexture(file) {
  return new Promise((resolve) => {
    loader.load(`assets/${file}.jpg`, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      resolve(tex);
    }, undefined, () => resolve(null));
  });
}

function half(source, side, backFace) {
  if (!source) return null;
  const tex = source.clone();
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  // Viewed from behind, the book's left side sits on the right of the screen,
  // and the back face's U runs from local +X to local -X. Swapping the halves
  // makes the printed back cover read left-to-right.
  if (backFace) {
    tex.repeat.set(0.5, 1);
    tex.offset.set(side === "left" ? 0.5 : 0, 0);
  } else {
    tex.repeat.set(0.5, 1);
    tex.offset.set(side === "right" ? 0.5 : 0, 0);
  }
  tex.needsUpdate = true;
  return tex;
}

function sheetMaterial(frontTex, backTex) {
  const face = (tex, fallback) => new THREE.MeshStandardMaterial({
    map: tex || null,
    color: tex ? 0xffffff : fallback,
    roughness: 0.9,
    metalness: 0
  });
  return [paper, paper, paper, paper, face(frontTex, 0xf7f4ee), face(backTex, 0xf3eee6)];
}

function makeCoil(depth, xSign) {
  const radius = Math.max(depth / 2 + 0.018, 0.036);
  const height = PAGE * 0.992;
  const curve = new HelixCurve(radius, radius, height, TURNS, xSign);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, TURNS * 28, 0.0074, 10, false),
    coilMat
  );
  tube.castShadow = true;
  tube.receiveShadow = true;

  const through = Math.min(0.92, (depth / 2) / radius);
  const crossing = Math.sqrt(Math.max(0.04, 1 - through * through));
  const holeX = xSign * radius * crossing;
  const holeGeo = new THREE.CylinderGeometry(0.0085, 0.0085, depth * 0.98, 10);
  const holes = new THREE.Group();
  const angle0 = Math.asin(through);
  for (let k = 0; k < TURNS; k += 1) {
    const t = (angle0 + k * Math.PI * 2) / (TURNS * Math.PI * 2);
    if (t <= 0.01 || t >= 0.99) continue;
    const hole = new THREE.Mesh(holeGeo, holeMat);
    hole.rotation.x = Math.PI / 2;
    hole.position.set(holeX, (t - 0.5) * height, 0);
    holes.add(hole);
  }

  const group = new THREE.Group();
  group.name = "coil";
  group.add(tube);
  group.add(holes);
  return { group, radius };
}

function attachCoil(root, side, depth) {
  const previous = root.getObjectByName("coil");
  if (previous) {
    previous.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
    });
    root.remove(previous);
  }
  const block = Math.max(depth, THICK * 2);
  const { group, radius } = makeCoil(block, side === "left" ? 1 : -1);
  const sign = side === "left" ? 1 : -1;
  const count = Math.max(1, Math.round(block / THICK));
  group.position.z = ((count - 1) * THICK) / 2;
  group.position.x = sign * radius * 0.55;
  root.add(group);
}

// The camera looks from +z. A leaf turning about its outer ring swings toward +z when the
// left one turns by -PI and the right one by +PI, so it passes in front of the book. The
// resting pose is the same as with the opposite sign; only the way it gets there differs.
function leafAngle(side) {
  return side === "left" ? -Math.PI : Math.PI;
}

function restack(side) {
  const list = sides[side];
  const current = state[side];
  const angle = leafAngle(side);
  const innerCount = list.length - current;
  list.forEach((pivot, index) => {
    const mesh = pivot.children[0];
    gsap.killTweensOf(pivot.rotation);
    pivot.visible = true;
    if (index < current) {
      pivot.rotation.y = angle;
      mesh.position.z = (current - 1 - index) * THICK;
    } else {
      pivot.rotation.y = 0;
      mesh.position.z = (innerCount - 1 - (index - current)) * THICK;
    }
  });
}

function buildSide(side, textures) {
  const root = new THREE.Group();
  const records = [
    { front: textures.cover01, back: textures.cover02 },
    ...SHEETS.map((sheet) => ({
      front: textures[sheet.front],
      back: sheet.back ? textures[sheet.back] : null
    })),
    { front: textures.back02, back: null }
  ];
  records.forEach((record, index) => {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(PAGE, PAGE, THICK),
      sheetMaterial(half(record.front, side, false), half(record.back, side, true))
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.x = side === "left" ? PAGE / 2 : -PAGE / 2;
    mesh.userData.side = side;
    mesh.userData.index = index;
    pivot.add(mesh);
    root.add(pivot);
    sides[side].push(pivot);
  });
  roots[side] = root;
  book.add(root);
  restack(side);
  attachCoil(root, side, records.length * THICK);
  return root;
}

function lastIndex() {
  return sides.left.length - 1;
}

function isBackCover() {
  return sides.left.length > 0 && state.left === lastIndex() && state.right === lastIndex();
}

function isClosed() {
  return state.left === 0 && state.right === 0;
}

function boardsTogether() {
  return isClosed() || isBackCover();
}

function folioOf(side) {
  const count = state[side];
  if (count <= 0 || count > SHEETS.length) return "";
  return SHEETS[count - 1].folio[side === "left" ? 0 : 1];
}

function sectionOf(side) {
  const count = state[side];
  if (count <= 0) return "Cover";
  if (count > SHEETS.length) return "Back cover";
  return SHEETS[count - 1].section;
}

function updateUI() {
  const open = !isClosed();
  if (backBoard) backBoard.visible = true;
  if (insideBack) insideBack.visible = isBackCover();
  document.body.classList.toggle("is-open", open);
  const leftSection = sectionOf("left");
  const rightSection = sectionOf("right");
  whereEl.textContent = leftSection === rightSection || !open ? leftSection : `${leftSection} / ${rightSection}`;
  if (!open) {
    folioEl.textContent = "Cover";
    hintEl.textContent = "Drag to turn the book. Click the cover to open.";
  } else {
    folioEl.textContent = `${folioOf("left") || "—"}   ${folioOf("right") || "—"}`;
    hintEl.textContent = "Click a page to turn it. Click a turned page to bring it back.";
  }
  document.getElementById("btn-back").hidden = open;
  document.getElementById("btn-read").hidden = !open;
  document.getElementById("btn-close").hidden = !open;
}

function closedX(side) {
  return side === "left" ? -PAGE + 0.008 : PAGE - 0.008;
}

function openX(side) {
  return side === "left" ? -PAGE - OPEN_GAP : PAGE + OPEN_GAP;
}

function placeStacks(animate) {
  const leftX = boardsTogether() ? closedX("left") : openX("left");
  const rightX = boardsTogether() ? closedX("right") : openX("right");
  const duration = animate ? 0.65 : 0;
  gsap.to(roots.left.position, { x: leftX, duration, ease: "power2.inOut" });
  gsap.to(roots.right.position, { x: rightX, duration, ease: "power2.inOut" });
}

function frameDistance() {
  const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
  const wide = !isClosed() && !isBackCover();
  const span = wide ? PAGE * 4 + OPEN_GAP * 2 + 0.45 : PAGE * 2 + 0.5;
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  return Math.max((PAGE + 0.85) / 2 / Math.tan(vFov / 2), span / 2 / Math.tan(hFov / 2));
}

function applyHome(animate) {
  const dist = frameDistance();
  home.set(0, dist * 0.18, dist);
  if (!animate) {
    camera.position.copy(home);
    controls.target.set(0, -0.02, 0);
    controls.update();
    return;
  }
  gsap.to(camera.position, {
    x: home.x, y: home.y, z: home.z, duration: 0.7, ease: "power2.inOut"
  });
  gsap.to(controls.target, {
    x: 0, y: -0.02, z: 0, duration: 0.7, ease: "power2.inOut",
    onUpdate: () => controls.update()
  });
}

// Turn one leaf on one side. Nothing here looks at the other side.
function flip(side, dir, fast) {
  if (locks[side]) return Promise.resolve();
  const next = state[side] + dir;
  if (next < 0 || next > lastIndex()) return Promise.resolve();
  const index = dir > 0 ? state[side] : next;
  const wasClosed = isClosed();
  const wasBack = isBackCover();
  locks[side] = true;
  // Only the covers move the two boards. A single inner page stays put and turns beside its coil.
  if (dir > 0 && wasClosed) placeStacks(true);
  const pivot = sides[side][index];
  const mesh = pivot.children[0];
  pivot.visible = true;
  if (dir < 0) pivot.rotation.y = leafAngle(side);
  const destZ = dir > 0 ? 0 : (sides[side].length - next - 1) * THICK;
  return new Promise((resolve) => {
    const done = { n: 0, ok() { done.n += 1; if (done.n === 2) resolve(); } };
    gsap.to(pivot.rotation, {
      y: dir > 0 ? leafAngle(side) : 0,
      duration: fast ? 0.28 : 0.58,
      ease: "power2.in",
      onComplete: done.ok
    });
    gsap.to(mesh.position, {
      z: destZ,
      duration: fast ? 0.28 : 0.58,
      ease: "power2.in",
      onComplete: done.ok
    });
  }).then(() => {
    state[side] = next;
    locks[side] = false;
    restack(side);
    const nowClosed = isClosed();
    const nowBack = isBackCover();
    if (wasClosed !== nowClosed || wasBack !== nowBack) {
      placeStacks(true);
      applyHome(true);
    }
    updateUI();
  });
}

// Both sides together: used to open and close the covers, and by the space bar.
function turnSpread(dir, fromSeq) {
  if (sequencing && !fromSeq) return Promise.resolve();
  if (state.left !== state.right) return Promise.resolve();
  return Promise.all([flip("left", dir, fromSeq), flip("right", dir, fromSeq)]);
}

// One page on its own. The covers always open and close with both sides.
function turnPage(side, dir) {
  if (sequencing) return Promise.resolve();
  const next = state[side] + dir;
  const coverMove = next === 0 || state[side] === 0;
  if (coverMove) return turnSpread(dir);
  return flip(side, dir, false);
}

// Walk both sides to the same page, a leaf at a time.
async function settle(target) {
  if (sequencing) return;
  sequencing = true;
  const other = { left: "right", right: "left" };
  let guard = 0;
  while ((state.left !== target || state.right !== target) && guard < 80) {
    guard += 1;
    const moves = ["left", "right"].filter((side) => {
      if (state[side] === target) return false;
      const dir = target > state[side] ? 1 : -1;
      // A cover only comes back once the other side is down to it as well.
      if (state[side] + dir === 0 && state[other[side]] > 1) return false;
      return true;
    }).map((side) => flip(side, target > state[side] ? 1 : -1, true));
    if (!moves.length) break;
    await Promise.all(moves);
  }
  sequencing = false;
  updateUI();
}

function goTo(sheet) {
  return settle(Math.min(Math.max(sheet + 1, 0), lastIndex()));
}

async function closeBook() {
  document.body.classList.remove("is-reading");
  document.getElementById("btn-read").textContent = "Read";
  await settle(0);
  applyHome(true);
  updateUI();
}

function showBack() {
  const dist = frameDistance();
  gsap.to(camera.position, { x: 0, y: dist * 0.18, z: -dist, duration: 0.9, ease: "power2.inOut" });
  gsap.to(controls.target, { x: 0, y: -0.02, z: 0, duration: 0.9, onUpdate: () => controls.update() });
}

function onPointerUp(event) {
  if (controls._moved) return;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(book.children, true).find((item) => item.object.userData.side);
  if (!hit) return;
  const side = hit.object.userData.side;
  const index = hit.object.userData.index;
  if (isClosed()) {
    if (!event.shiftKey) turnSpread(1);
    return;
  }
  // A page already turned to the outside comes back; any other page turns over.
  const turned = index < state[side];
  turnPage(side, event.shiftKey || turned ? -1 : 1);
}

let down = null;
canvas.addEventListener("pointerdown", (event) => {
  down = { x: event.clientX, y: event.clientY };
  controls._moved = false;
});
canvas.addEventListener("pointermove", (event) => {
  if (!down) return;
  if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) controls._moved = true;
});
canvas.addEventListener("pointerup", onPointerUp);
canvas.addEventListener("pointercancel", () => {
  down = null;
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

document.getElementById("contents-list").innerHTML = CONTENTS.map((item) => `
  <button class="row" type="button" data-sheet="${item.sheet}">
    <span class="num">${item.num}</span>
    <span><b>${item.name}</b><span>${item.sub}</span></span>
  </button>`).join("");
document.getElementById("contents-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-sheet]");
  if (!button) return;
  closeContents();
  goTo(Number(button.dataset.sheet));
});
document.getElementById("btn-contents").addEventListener("click", () => {
  if (contentsEl.classList.contains("is-on")) closeContents();
  else openContents();
});
document.getElementById("btn-close").addEventListener("click", closeBook);
document.getElementById("btn-back").addEventListener("click", showBack);
document.getElementById("btn-front").addEventListener("click", () => applyHome(true));
document.getElementById("btn-rotate").addEventListener("click", () => {
  const dist = frameDistance();
  gsap.to(camera.position, {
    x: dist * 0.72,
    y: dist * 0.38,
    z: dist * 0.72,
    duration: 0.85,
    ease: "power2.inOut"
  });
});
document.getElementById("btn-read").addEventListener("click", () => {
  const reading = document.body.classList.toggle("is-reading");
  document.getElementById("btn-read").textContent = reading ? "Whole book" : "Read";
  const dist = frameDistance() * (reading ? 0.62 : 1);
  gsap.to(camera.position, {
    x: 0,
    y: reading ? dist * 0.04 : dist * 0.18,
    z: dist,
    duration: 0.7,
    ease: "power2.inOut"
  });
});
scrim.addEventListener("click", closeContents);

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (contentsEl.classList.contains("is-on")) closeContents();
    else applyHome(true);
    return;
  }
  if (event.key === "ArrowRight" || event.key === "ArrowLeft" || event.key === " ") {
    if (event.key === " ") event.preventDefault();
    const dir = event.shiftKey ? -1 : 1;
    if (event.key === " ") turnSpread(dir);
    else turnPage(event.key === "ArrowLeft" ? "left" : "right", dir);
  }
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  const moved = camera.position.distanceTo(home) > 0.12;
  document.getElementById("btn-front").hidden = !moved;
  renderer.render(scene, camera);
}

const files = ["cover01", "cover02", "back01", "back02"];
SHEETS.forEach((sheet) => {
  files.push(sheet.front);
  if (sheet.back) files.push(sheet.back);
});

Promise.all(files.map(async (file) => [file, await loadTexture(file)])).then((pairs) => {
  const textures = Object.fromEntries(pairs);
  buildSide("left", textures);
  buildSide("right", textures);
  roots.left.position.x = closedX("left");
  roots.right.position.x = closedX("right");
  const backMap = textures.back01.clone();
  backMap.colorSpace = THREE.SRGBColorSpace;
  backMap.anisotropy = renderer.capabilities.getMaxAnisotropy();
  backMap.needsUpdate = true;
  const backMat = new THREE.MeshStandardMaterial({ map: backMap, roughness: 0.92, metalness: 0 });
  backMat.polygonOffset = true;
  backMat.polygonOffsetFactor = -2;
  backMat.polygonOffsetUnits = -2;
  backBoard = new THREE.Mesh(new THREE.PlaneGeometry(PAGE * 2.02, PAGE + 0.004), backMat);
  backBoard.rotation.y = Math.PI;
  backBoard.position.z = -THICK / 2 - 0.003;
  backBoard.renderOrder = 2;
  backBoard.castShadow = true;
  backBoard.receiveShadow = true;
  book.add(backBoard);
  const insideMap = textures.back02.clone();
  insideMap.colorSpace = THREE.SRGBColorSpace;
  insideMap.anisotropy = renderer.capabilities.getMaxAnisotropy();
  insideMap.needsUpdate = true;
  const insideMat = new THREE.MeshStandardMaterial({ map: insideMap, roughness: 0.92, metalness: 0 });
  insideMat.polygonOffset = true;
  insideMat.polygonOffsetFactor = -2;
  insideMat.polygonOffsetUnits = -2;
  insideBack = new THREE.Mesh(new THREE.PlaneGeometry(PAGE * 2.012, PAGE), insideMat);
  insideBack.position.z = THICK / 2 + 0.004;
  insideBack.visible = false;
  insideBack.castShadow = true;
  insideBack.receiveShadow = true;
  book.add(insideBack);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  applyHome(false);
  updateUI();
  window.__turn = (dir) => turnSpread(dir || 1);
  window.__page = (side, dir) => turnPage(side, dir || 1);
  window.__state = state;
window.__view = (px, py, pz, tx, ty, tz) => {
  gsap.killTweensOf(camera.position);
  gsap.killTweensOf(controls.target);
  camera.position.set(px, py, pz);
  controls.target.set(tx, ty, tz);
  controls.update();
};
document.body.classList.add("is-ready");
  document.body.classList.remove("is-loading");
  animate();
}).catch((error) => {
  console.error(error);
});
