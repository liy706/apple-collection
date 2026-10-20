import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
gsap.registerPlugin(ScrollTrigger);

const PAPER = 0xf6f1e8;

const canvas = document.getElementById("view");
const progressEl = document.getElementById("progress");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(PAPER, 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PAPER);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pmrem.dispose();

const camera = new THREE.PerspectiveCamera(34, 1, 0.02, 30);
const baseCam = new THREE.Vector3();
const look = new THREE.Vector3();
const pointer = { x: 0, y: 0, sx: 0, sy: 0 };

scene.add(new THREE.HemisphereLight(0xfff6ee, 0xe7ddd2, 0.28));

const sun = new THREE.DirectionalLight(0xfff3ea, 1.55);
sun.position.set(-1.1, 3.1, 1.8);
const gleam = new THREE.DirectionalLight(0xfff8f2, 0.22);
gleam.position.set(1.2, 2.4, 2.4);
scene.add(gleam);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.2;
sun.shadow.camera.far = 8;
sun.shadow.camera.left = -2;
sun.shadow.camera.right = 2;
sun.shadow.camera.top = 2;
sun.shadow.camera.bottom = -2;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.015;
scene.add(sun);
scene.add(sun.target);

const fill = new THREE.DirectionalLight(0xf3e6dc, 0.28);
fill.position.set(2.2, 1.2, 1.4);
scene.add(fill);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(8, 48),
  new THREE.ShadowMaterial({ opacity: 0.22 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0.001;
ground.receiveShadow = true;
scene.add(ground);

const frames = [
  { x: 0.85, y: 1.05, z: 3.85, lx: -0.55, ly: 0.4, lz: 0, ry: 0.35, rx: 0.04 },
  { x: 1.65, y: 0.92, z: 3.35, lx: -0.48, ly: 0.38, lz: 0, ry: Math.PI * 0.75, rx: 0.08 },
  { x: 0.55, y: 0.86, z: 3.15, lx: -0.42, ly: 0.36, lz: 0, ry: Math.PI * 1.4, rx: -0.03 },
  { x: -0.55, y: 0.96, z: 3.35, lx: -0.5, ly: 0.38, lz: 0, ry: Math.PI * 2.2, rx: 0.1 },
  { x: 0.6, y: 1.02, z: 3.7, lx: -0.52, ly: 0.4, lz: 0, ry: Math.PI * 3.1, rx: 0.02 }
];

let pivot = null;

function mix(a, b, t) {
  return a + (b - a) * t;
}

function applyProgress(amount) {
  const t = Math.min(Math.max(amount, 0), 1);
  const span = frames.length - 1;
  const scaled = t * span;
  const index = Math.min(Math.floor(scaled), span - 1);
  const local = scaled - index;
  const from = frames[index];
  const to = frames[index + 1];
  baseCam.set(
    mix(from.x, to.x, local),
    mix(from.y, to.y, local),
    mix(from.z, to.z, local)
  );
  look.set(
    mix(from.lx, to.lx, local),
    mix(from.ly, to.ly, local),
    mix(from.lz, to.lz, local)
  );
  if (pivot) {
    pivot.rotation.y = mix(from.ry, to.ry, local);
    pivot.rotation.x = mix(from.rx, to.rx, local);
  }
  setReading(t);
  dirty = true;
}

function hold(t, fadeIn, settle, fadeOut) {
  if (t <= fadeIn[0] || t >= fadeOut[1]) return 0;
  if (t < fadeIn[1]) return (t - fadeIn[0]) / (fadeIn[1] - fadeIn[0]);
  if (t < settle) return 1;
  if (t < fadeOut[0]) return 1;
  return 1 - (t - fadeOut[0]) / (fadeOut[1] - fadeOut[0]);
}

const beats = [...document.querySelectorAll("[data-beat]")];

function setReading(t) {
  const amounts = {
    open: hold(t, [-0.02, 0], 0.18, [0.18, 0.26]),
    cut: hold(t, [0.28, 0.36], 0.52, [0.52, 0.6]),
    compare: hold(t, [0.62, 0.7], 0.82, [0.82, 0.88]),
    book: hold(t, [0.9, 0.96], 1.01, [1.2, 1.21])
  };
  beats.forEach((beat) => {
    const amount = amounts[beat.dataset.beat] || 0;
    beat.style.opacity = String(amount);
    beat.style.visibility = amount > 0.02 ? "visible" : "hidden";
    beat.style.transform = "none";
    beat.style.pointerEvents = amount > 0.65 ? "auto" : "none";
  });
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

function placeSculpture(object) {
  object.scale.setScalar(1);
  object.updateMatrixWorld(true);
  const measured = new THREE.Box3().setFromObject(object);
  const height = measured.getSize(new THREE.Vector3()).y || 1;
  object.scale.setScalar(0.95 / height);
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.sub(center);
  pivot = new THREE.Group();
  pivot.add(object);
  pivot.position.set(0.16, box.getSize(new THREE.Vector3()).y / 2, 0);
  scene.add(pivot);
}

window.addEventListener("pointermove", (event) => {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
});

let live = true;
let dirty = true;
const stage = document.getElementById("sequence") || canvas;
if ("IntersectionObserver" in window) {
  const watch = new IntersectionObserver((entries) => {
    live = entries.some((entry) => entry.isIntersecting);
    if (live) dirty = true;
  }, { rootMargin: "80px 0px" });
  watch.observe(stage);
}

let resizeTimer = 0;
window.addEventListener("resize", () => {
  resize();
  dirty = true;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => ScrollTrigger.refresh(), 160);
});

function animate() {
  requestAnimationFrame(animate);
  if (window.__introHold || !live || document.hidden) return;
  const dx = pointer.x - pointer.sx;
  const dy = pointer.y - pointer.sy;
  pointer.sx += dx * 0.06;
  pointer.sy += dy * 0.06;
  if (!dirty && Math.abs(dx) < 0.0008 && Math.abs(dy) < 0.0008) return;
  dirty = false;
  camera.position.copy(baseCam);
  camera.position.x += pointer.sx * 0.06;
  camera.position.y += -pointer.sy * 0.04;
  camera.lookAt(look.x + pointer.sx * 0.05, look.y, look.z);
  renderer.render(scene, camera);
}

function stemInset(text, style) {
  const size = parseFloat(style.fontSize);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const pad = Math.ceil(size);
  canvas.width = Math.ceil(size * (text.length * 1.2 + 2));
  canvas.height = Math.ceil(size * 1.8);
  ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  ctx.letterSpacing = style.letterSpacing;
  ctx.fillStyle = "#000";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, pad, size * 1.15);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const counts = new Array(width).fill(0);
  let top = height;
  let bottom = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 40) {
        counts[x] += 1;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  const threshold = Math.max(3, (bottom - top) * 0.45);
  for (let x = 0; x < width; x += 1) {
    if (counts[x] >= threshold) return x - pad;
  }
  return 0;
}

function alignType() {
  document.querySelectorAll(".beat").forEach((beat) => {
    const lines = [...beat.querySelectorAll("h1 span")];
    if (!lines.length) return;
    const insets = lines.map((line) => stemInset(line.textContent, getComputedStyle(line)));
    const edge = Math.max(...insets);
    lines.forEach((line, index) => {
      line.style.marginLeft = `${edge - insets[index]}px`;
    });
    beat.querySelectorAll(".kicker, .line, .scroll, .next").forEach((node) => {
      const inset = stemInset(node.textContent.trim(), getComputedStyle(node));
      node.style.marginLeft = `${Math.max(0, edge - inset)}px`;
    });
  });
}

resize();
applyProgress(0);
document.fonts.ready.then(alignType);
let alignTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(alignTimer);
  alignTimer = setTimeout(alignType, 160);
});
animate();

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function speckle(x, y, scale) {
  const sx = Math.floor(x / scale);
  const sy = Math.floor(y / scale);
  const n = Math.sin(sx * 127.1 + sy * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function fruitMaps(image) {
  const width = image.width;
  const height = image.height;
  const source = document.createElement("canvas");
  source.width = width;
  source.height = height;
  const sourceCtx = source.getContext("2d", { willReadFrequently: true });
  sourceCtx.drawImage(image, 0, 0);
  const pixels = sourceCtx.getImageData(0, 0, width, height).data;
  const roughCanvas = document.createElement("canvas");
  const coatCanvas = document.createElement("canvas");
  const colorCanvas = document.createElement("canvas");
  const specCanvas = document.createElement("canvas");
  roughCanvas.width = coatCanvas.width = colorCanvas.width = specCanvas.width = width;
  roughCanvas.height = coatCanvas.height = colorCanvas.height = specCanvas.height = height;
  const roughCtx = roughCanvas.getContext("2d");
  const coatCtx = coatCanvas.getContext("2d");
  const colorCtx = colorCanvas.getContext("2d");
  const specCtx = specCanvas.getContext("2d");
  const roughData = roughCtx.createImageData(width, height);
  const coatData = coatCtx.createImageData(width, height);
  const colorData = colorCtx.createImageData(width, height);
  const specData = specCtx.createImageData(width, height);
  const clamp = (value) => Math.min(1, Math.max(0, value));
  const byte = (value) => Math.round(clamp(value) * 255);

  // The grain only changes per cell, so work it out once per cell, not once per pixel.
  const cellsX6 = Math.ceil(width / 6) + 1;
  const cellsY6 = Math.ceil(height / 6) + 1;
  const grainCells = new Float32Array(cellsX6 * cellsY6);
  for (let cy = 0; cy < cellsY6; cy += 1) {
    for (let cx = 0; cx < cellsX6; cx += 1) grainCells[cy * cellsX6 + cx] = speckle(cx * 6, cy * 6, 6);
  }
  const cellsX3 = Math.ceil((width + 13) / 3) + 1;
  const cellsY3 = Math.ceil((height + 5) / 3) + 1;
  const fiberCells = new Float32Array(cellsX3 * cellsY3);
  for (let cy = 0; cy < cellsY3; cy += 1) {
    for (let cx = 0; cx < cellsX3; cx += 1) fiberCells[cy * cellsX3 + cx] = speckle(cx * 3, cy * 3, 3);
  }

  for (let i = 0, p = 0; i < pixels.length; i += 4, p += 1) {
    const r = pixels[i] / 255;
    const g = pixels[i + 1] / 255;
    const b = pixels[i + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const chroma = r - Math.max(g, b);
    const x = p % width;
    const y = (p / width) | 0;
    const grain = grainCells[((y / 6) | 0) * cellsX6 + ((x / 6) | 0)] - 0.5;
    const fiber = fiberCells[(((y + 5) / 3) | 0) * cellsX3 + (((x + 13) / 3) | 0)];
    const stem = max < 0.22;
    const peel = !stem && r > 0.5 && g < 0.42 && b < 0.38 && chroma > 0.2;
    const flesh = !stem && !peel;

    let nr = r;
    let ng = g;
    let nb = b;
    let roughness = 0.72;
    let coat = 0;
    let sr = 0.95;
    let sg = 0.9;
    let sb = 0.84;

    if (peel) {
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const shade = Math.min(1.04, Math.max(0.9, luma / 0.28));
      const fleck = grain * 0.055 + (fiber > 0.84 ? -0.06 : 0);
      nr = 0.9 * shade + fleck * 0.35;
      ng = 0.045 * shade;
      nb = 0.025 * shade;
      roughness = 0.52 + grain * 0.08;
      coat = 0.7;
      sr = 0.55;
      sg = 0.1;
      sb = 0.06;
    } else if (flesh) {
      const fleck = grain * 0.015;
      nr = 0.96 + fleck;
      ng = 0.9 + fleck;
      nb = 0.76 + fleck * 0.3;
      roughness = 0.92;
      coat = 0;
      sr = 0.98;
      sg = 0.94;
      sb = 0.88;
    } else if (stem) {
      roughness = 0.96;
      coat = 0;
      sr = 0.25;
      sg = 0.22;
      sb = 0.2;
    }

    colorData.data[i] = nr * 255;
    colorData.data[i + 1] = ng * 255;
    colorData.data[i + 2] = nb * 255;
    colorData.data[i + 3] = 255;
    const roughByte = roughness * 255;
    roughData.data[i] = roughData.data[i + 1] = roughData.data[i + 2] = roughByte;
    roughData.data[i + 3] = 255;
    const coatByte = coat * 255;
    coatData.data[i] = coatData.data[i + 1] = coatData.data[i + 2] = coatByte;
    coatData.data[i + 3] = 255;
    specData.data[i] = sr * 255;
    specData.data[i + 1] = sg * 255;
    specData.data[i + 2] = sb * 255;
    specData.data[i + 3] = 255;
  }

  roughCtx.putImageData(roughData, 0, 0);
  coatCtx.putImageData(coatData, 0, 0);
  colorCtx.putImageData(colorData, 0, 0);
  specCtx.putImageData(specData, 0, 0);

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  const clearcoatMap = new THREE.CanvasTexture(coatCanvas);
  const specularColorMap = new THREE.CanvasTexture(specCanvas);
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  for (const texture of [colorMap, roughnessMap, clearcoatMap, specularColorMap]) {
    texture.flipY = false;
    texture.anisotropy = anisotropy;
  }
  colorMap.colorSpace = THREE.SRGBColorSpace;
  specularColorMap.colorSpace = THREE.SRGBColorSpace;
  roughnessMap.colorSpace = THREE.LinearSRGBColorSpace;
  clearcoatMap.colorSpace = THREE.LinearSRGBColorSpace;
  return { colorMap, roughnessMap, clearcoatMap, specularColorMap };
}

const setupModel = (gltf) => {
    const model = gltf.scene;
    const anisotropy = renderer.capabilities.getMaxAnisotropy();
    model.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const source = child.material;
      if (!source) return;
      if (source.map) {
        source.map.colorSpace = THREE.SRGBColorSpace;
        source.map.anisotropy = anisotropy;
      }
      if (source.normalMap) source.normalMap.colorSpace = THREE.LinearSRGBColorSpace;
      const maps = source.map?.image ? fruitMaps(source.map.image) : {};
      const material = new THREE.MeshPhysicalMaterial({
        map: maps.colorMap || source.map || null,
        normalMap: source.normalMap || null,
        normalScale: new THREE.Vector2(0.72, 0.72),
        roughnessMap: maps.roughnessMap || null,
        roughness: 1,
        metalness: 0,
        specularIntensity: 0.42,
        specularColorMap: maps.specularColorMap || null,
        clearcoat: 0.16,
        clearcoatMap: maps.clearcoatMap || null,
        clearcoatRoughness: 0.58,
        sheen: 0.04,
        sheenColor: new THREE.Color(0xfff3e6),
        sheenRoughness: 0.85,
        envMapIntensity: 0.16,
        ior: 1.38
      });
      child.material = material;
      source.dispose();
    });
    placeSculpture(model);
    applyProgress(0);
    // Compile and upload now, so the first visible frame is cheap.
    renderer.compile(scene, camera);
    renderer.render(scene, camera);
    // The opening (intro.js) lifts the loader itself once the heap has landed.
    document.body.classList.add("is-ready");
    document.body.classList.remove("is-loading");

    if (!reduced) {
      ScrollTrigger.create({
        trigger: "#sequence",
        start: "top top",
        end: "bottom bottom",
        scrub: 1,
        onUpdate: (self) => applyProgress(self.progress)
      });
      ScrollTrigger.refresh();
    }
};

const loader = new GLTFLoader();
loader.load(
  "models/home.glb",
  (gltf) => {
    // One tick, so the number can paint before the heavy part.
    setTimeout(() => setupModel(gltf), 30);
  },
  (event) => {
    if (!event.total) return;
    window.dispatchEvent(new CustomEvent("site-progress", { detail: event.loaded / event.total }));
  },
  () => {
    window.dispatchEvent(new Event("site-failed"));
    if (progressEl) progressEl.textContent = "The model could not be loaded.";
  }
);
