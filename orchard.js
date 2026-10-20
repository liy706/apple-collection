import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
gsap.registerPlugin(ScrollTrigger);

const canvas = document.getElementById("orchard-view");
const root = document.getElementById("orchard");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1;
renderer.setClearColor(0x0b0203, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0b0203, 11, 30);
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xfff0e6, 0x3a1210, 0.22));
const sun = new THREE.DirectionalLight(0xfff3ea, 1.15);
sun.position.set(-1.1, 3.1, 1.8);
scene.add(sun);
const gleam = new THREE.DirectionalLight(0xfff8f2, 0.24);
gleam.position.set(1.2, 2.4, 2.4);
scene.add(gleam);
const fill = new THREE.DirectionalLight(0xf3e6dc, 0.3);
fill.position.set(2.2, 1.2, 1.4);
scene.add(fill);
// A red-orange light from behind lifts each apple's edge off the dark.
const rim = new THREE.DirectionalLight(0xff5a3c, 1.1);
rim.position.set(1.6, 1.4, -3);
scene.add(rim);

/* ---------- background: black-red field that flickers and streams with the scroll ---------- */

const bgUniforms = {
  uTime: { value: 0 },
  uTravel: { value: 0 },
  uAspect: { value: 1 },
  uMouse: { value: new THREE.Vector2(0, 0) },
  uStir: { value: new THREE.Vector2(0, 0) },
  uFall: { value: 0 },
  uCenter: { value: new THREE.Vector2(0, 0) }
};
const bgGeometry = new THREE.BufferGeometry();
bgGeometry.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
const bg = new THREE.Mesh(
  bgGeometry,
  new THREE.ShaderMaterial({
    uniforms: bgUniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = position.xy * 0.5 + 0.5;
        gl_Position = vec4(position.xy, 1.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uTravel;
      uniform float uAspect;
      uniform vec2 uMouse;
      uniform vec2 uStir;
      uniform float uFall;
      uniform vec2 uCenter;
      float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
      float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(float t) {
        float i = floor(t);
        float f = fract(t);
        f = f * f * (3.0 - 2.0 * f);
        return mix(hash(i), hash(i + 1.0), f);
      }
      float vhash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float snoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
        return mix(mix(vhash(i), vhash(i + vec2(1.0, 0.0)), f.x),
                   mix(vhash(i + vec2(0.0, 1.0)), vhash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float a = 0.5;
        float v = 0.0;
        mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
        for (int i = 0; i < 4; i++) {
          v += a * snoise(p);
          p = m * p;
          a *= 0.5;
        }
        return v;
      }
      void main() {
        vec2 screen = (vUv - 0.5) * vec2(uAspect, 1.0);
        // The pit sits low in the frame and rises to the middle as you scroll, like a
        // far-off layer sliding slower than the page.
        vec2 p = screen - uCenter;
        float r = length(p);

        // The cursor drags the surface; it settles back afterwards.
        vec2 m = screen - (uMouse - 0.5) * vec2(uAspect, 1.0);
        vec2 q = p - uStir * exp(-dot(m, m) * 9.0) * vec2(uAspect, 1.0) * 0.9;

        // A funnel into the dark. Twisting by log(r) bends every streak into a logarithmic
        // spiral, and turning that spiral over time makes the red drain inward without
        // ever repeating or popping. Scrolling speeds the fall.
        float rq = length(q) + 1e-4;
        // uFall is 0 at the top of the field and 1 at the mouth of the orchard; the red
        // keeps turning and the pit keeps widening as you scroll, ending on the old view.
        float turn = 2.3 * log(rq + 0.04) + uTime * 0.12 + (uFall - 1.0) * 9.0;
        mat2 spin = mat2(cos(turn), sin(turn), -sin(turn), cos(turn));
        // Perspective: texture compresses toward the centre, as if it were far below.
        vec2 s = spin * q * (0.85 + 0.075 / (rq + 0.06)) * exp(-(uFall - 1.0) * 0.7);

        // Domain-warped liquid on top of the funnel.
        float flow = uTime * 0.03;
        vec2 w = vec2(fbm(s * 1.5 + vec2(0.0, flow)), fbm(s * 1.5 + vec2(5.2, 1.3) - flow));
        vec2 w2 = vec2(fbm(s * 1.7 + 3.2 * w + vec2(1.7, 9.2) + flow * 1.3),
                       fbm(s * 1.7 + 3.2 * w + vec2(8.3, 2.8) - flow * 1.1));
        float h = fbm(s * 1.3 + 2.8 * w2);

        float body = smoothstep(0.3, 0.84, h);
        vec3 liquid = mix(vec3(0.02, 0.003, 0.006), vec3(0.36, 0.03, 0.04), body);
        liquid += vec3(0.30, 0.05, 0.02) * pow(body, 3.0) * 0.5;
        vec3 n = normalize(vec3(-dFdx(h) * 30.0, -dFdy(h) * 30.0, 1.0));
        float sheen = pow(max(dot(n, normalize(vec3(-0.45, 0.6, 0.65))), 0.0), 26.0);
        liquid += vec3(0.55, 0.09, 0.07) * sheen * 0.5;

        // Depth: the red is brightest at the lip, then falls away to nothing at the centre.
        // Past the mouth of the orchard the pit keeps opening, as if you were still falling.
        float deeper = max(uFall - 1.0, 0.0) * 0.2;
        float lip = 0.55 + 0.75 * exp(-pow((r - 0.36 - deeper) / 0.2, 2.0));
        float pit = smoothstep(0.02, 0.38 + deeper, r);
        pit = pit * pit * (3.0 - 2.0 * pit);
        float outer = 0.3 + 0.7 * (1.0 - smoothstep(0.35, 1.0, r));
        vec3 col = vec3(0.012, 0.002, 0.003) + liquid * lip * pit * outer;

        // A slow breath of light rising out of the depth, soft enough to read as haze.
        float breath = 0.5 + 0.5 * sin(uTime * 0.7);
        col += vec3(0.1, 0.008, 0.012) * exp(-pow((r - 0.2) / 0.12, 2.0)) * (0.35 + 0.35 * breath) * pit;
        float shimmer = 0.95 + 0.05 * vnoise(uTime * 9.0);
        col *= shimmer;

        // Grain.
        float g = hash2(vUv * vec2(1920.0, 1080.0) + floor(uTime * 30.0)) - 0.5;
        col += g * 0.035;
        gl_FragColor = vec4(max(col, 0.0), 1.0);
      }
    `
  })
);
bg.frustumCulled = false;
bg.renderOrder = -100;
scene.add(bg);

/* ---------- procedural surface painting (book illustration language) ---------- */

function hash(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

// Value noise that wraps in x so the texture has no seam around the apple.
function noise(x, y, period) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const sx = xf * xf * (3 - 2 * xf);
  const sy = yf * yf * (3 - 2 * yf);
  const wrap = (value) => ((value % period) + period) % period;
  const a = hash(wrap(xi), yi);
  const b = hash(wrap(xi + 1), yi);
  const c = hash(wrap(xi), yi + 1);
  const d = hash(wrap(xi + 1), yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function paintTexture(kind) {
  const width = 1024;
  const height = 512;
  const color = document.createElement("canvas");
  const bump = document.createElement("canvas");
  color.width = bump.width = width;
  color.height = bump.height = height;
  const cctx = color.getContext("2d");
  const bctx = bump.getContext("2d");
  const cimg = cctx.createImageData(width, height);
  const bimg = bctx.createImageData(width, height);
  const mix = (a, b, t) => a + (b - a) * t;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const v = y / height;
      const streak = noise(x / 5.5, y / 70, width / 5.5);
      const wide = noise(x / 36, y / 30, width / 36);
      const fine = hash(x, y);
      let r;
      let g;
      let b;
      if (kind === "skin") {
        // #d13622 ground, deeper red streaks, a warmer pole, grainy specks.
        const t = Math.min(1, Math.max(0, streak * 0.75 + wide * 0.35));
        r = mix(150, 214, t);
        g = mix(18, 46, t);
        b = mix(18, 30, t);
        const pole = Math.max(0, v - 0.86) / 0.14 + Math.max(0, 0.1 - v) / 0.1;
        r = mix(r, 232, pole * 0.5);
        g = mix(g, 118, pole * 0.5);
        b = mix(b, 58, pole * 0.5);
        const grain = (fine - 0.5) * 26;
        r += grain;
        g += grain * 0.4;
        b += grain * 0.3;
        if (hash(Math.floor(x / 2), Math.floor(y / 2) + 91) > 0.9965) {
          r = 238;
          g = 176;
          b = 128;
        }
      } else {
        // Apple flesh: pale yellow-cream with a faint green cast, fine fibres running
        // out from the core, soft mottling, the odd brown fleck.
        const fibre = noise(x / 2.6, y / 110, width / 2.6);
        const cloud = noise(x / 70, y / 38, width / 70);
        const tint = noise(x / 110 + 7, y / 60, width / 110);
        r = 232 + 14 * fibre - 12 * cloud;
        g = 216 + 16 * fibre - 12 * cloud + 6 * tint;
        b = 152 + 26 * fibre - 22 * cloud - 10 * tint;
        const grain = (fine - 0.5) * 9;
        r += grain;
        g += grain;
        b += grain * 1.3;
        if (hash(Math.floor(x / 2) + 31, Math.floor(y / 2) + 57) > 0.9972) {
          r -= 46;
          g -= 62;
          b -= 70;
        }
      }
      cimg.data[i] = r;
      cimg.data[i + 1] = g;
      cimg.data[i + 2] = b;
      cimg.data[i + 3] = 255;
      // Skin: vertical streaks. Flesh: faint knife facets running around the apple,
      // the way a blade leaves a surface that is never perfectly round.
      const height01 =
        kind === "skin"
          ? Math.min(1, Math.max(0, 0.45 + (streak - 0.5) * 0.5 + (fine - 0.5) * 0.35))
          : Math.min(1, Math.max(0, 0.5 + (noise(x / 160, y / 5, width / 160) - 0.5) * 0.7 + (noise(x / 2.6, y / 110, width / 2.6) - 0.5) * 0.3 + (fine - 0.5) * 0.12));
      const bv = Math.round(height01 * 255);
      bimg.data[i] = bimg.data[i + 1] = bimg.data[i + 2] = bv;
      bimg.data[i + 3] = 255;
    }
  }
  cctx.putImageData(cimg, 0, 0);
  bctx.putImageData(bimg, 0, 0);
  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = renderer.capabilities.getMaxAnisotropy();
  map.wrapS = THREE.RepeatWrapping;
  const bumpMap = new THREE.CanvasTexture(bump);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.anisotropy = map.anisotropy;
  return { map, bumpMap };
}

const skinTex = paintTexture("skin");
const fleshTex = paintTexture("flesh");

const skinBase = new THREE.MeshPhysicalMaterial({
  map: skinTex.map,
  bumpMap: skinTex.bumpMap,
  bumpScale: 1.1,
  roughness: 0.52,
  metalness: 0,
  clearcoat: 0.18,
  clearcoatRoughness: 0.5,
  envMapIntensity: 0.14,
  specularIntensity: 0.4
});
const fleshMaterial = new THREE.MeshPhysicalMaterial({
  map: fleshTex.map,
  bumpMap: fleshTex.bumpMap,
  bumpScale: 1.6,
  roughness: 0.62,
  metalness: 0,
  clearcoat: 0.25,
  clearcoatRoughness: 0.4,
  sheen: 0.3,
  sheenColor: new THREE.Color(0xffd890),
  sheenRoughness: 0.55,
  envMapIntensity: 0.16
});
const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x1b1815, roughness: 0.9, metalness: 0 });

/* ---------- apple geometry: lathe profile, dimples, five-lobed base ---------- */

// A rounder apple than a plain ellipse: fuller shoulders, a tapering base,
// a deep stem well on top and a shallow dimple underneath.
const samples = (() => {
  const points = [];
  const steps = 180;
  for (let i = 0; i <= steps; i += 1) {
    const theta = (i / steps) * Math.PI;
    const s = Math.sin(theta);
    const c = Math.cos(theta);
    const shoulder = 1 + 0.075 * c - 0.04 * c * c;
    let r = 0.54 * s * shoulder;
    let y = 0.02 + 0.49 * c;
    if (c > 0) y -= 0.12 * Math.exp(-((r / 0.17) ** 2));
    else y += 0.07 * Math.exp(-((r / 0.13) ** 2));
    points.push(new THREE.Vector2(Math.max(0, r), y));
  }
  return points;
})();

// The same wobble is applied to the skin and to the ribbon laid on it,
// so the strip lifts off exactly the surface it came from.
function lobeScale(phi, y) {
  const lower = Math.min(1, Math.max(0, (0.1 - y) / 0.55));
  const lobe = 1 + 0.028 * lower * Math.cos(phi * 5 + 0.4);
  const lean = 1 + 0.022 * Math.cos(phi - 0.9) * (0.4 + 0.6 * Math.abs(y * 2));
  const sag = 1 + 0.01 * Math.sin(phi * 2 + y * 3);
  return lobe * lean * sag;
}

function applyLobes(geometry) {
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const radial = lobeScale(Math.atan2(z, x), y);
    pos.setX(i, x * radial);
    pos.setZ(i, z * radial);
  }
  geometry.computeVertexNormals();
}

const bodyGeometry = new THREE.LatheGeometry(samples.slice().reverse(), 220);
applyLobes(bodyGeometry);
const fleshGeometry = bodyGeometry.clone();

const stemCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0.34, 0),
  new THREE.Vector3(0.004, 0.44, 0),
  new THREE.Vector3(0.02, 0.54, 0.004),
  new THREE.Vector3(0.056, 0.62, 0.008)
]);
const stemGeometry = new THREE.TubeGeometry(stemCurve, 24, 0.02, 12, false);
const stemCap = new THREE.SphereGeometry(0.026, 14, 10);
stemCap.translate(0.056, 0.62, 0.008);

// Radius and texture row of the apple's outer wall at a height.
const wallStart = (() => {
  let apex = 0;
  for (let i = 0; i < samples.length; i += 1) if (samples[i].y > samples[apex].y && samples[i].x > 0.3) apex = i;
  return apex;
})();
function surfaceAt(y) {
  const last = samples.length - 1;
  const v = (index) => 1 - index / last;
  const top = samples[wallStart];
  if (y >= top.y) return { r: top.x, v: v(wallStart) };
  for (let i = wallStart + 1; i <= last; i += 1) {
    if (y >= samples[i].y) {
      const a = samples[i - 1];
      const b = samples[i];
      const t = (a.y - y) / (a.y - b.y || 1);
      return { r: a.x + (b.x - a.x) * t, v: v(i - 1 + t) };
    }
  }
  return { r: samples[last].x, v: v(last) };
}

const TURNS = 5;

// One continuous spiral ribbon laid on the skin. Its coordinate A runs along
// the spiral, so the same number that discards the skin also releases the ribbon.
// The strip has real thickness: red outer face, cream inner face, cream cut edges.
function ribbonGeometry() {
  const perTurn = 90;
  const steps = (TURNS + 1) * perTurn;
  const positions = [];
  const normals = [];
  const uvs = [];
  const spiral = [];
  const acrossAttr = [];
  const thickAttr = [];
  const kindAttr = [];
  const indices = [];
  // [across, thickness, kind, normal sign]
  const corners = [
    [-0.5, 0.5, 0, 1],
    [0.5, 0.5, 0, 1],
    [-0.5, -0.5, 1, -1],
    [0.5, -0.5, 1, -1],
    [-0.5, 0.5, 2, 1],
    [-0.5, -0.5, 2, 1],
    [0.5, 0.5, 2, 1],
    [0.5, -0.5, 2, 1]
  ];
  for (let s = 0; s <= steps; s += 1) {
    const a = s / perTurn;
    const th = a - Math.floor(a);
    const phi = (th - 0.5) * Math.PI * 2;
    for (const [off, thick, kind, sign] of corners) {
      const yN = Math.min(1, Math.max(0, 1 - (a + off) / TURNS));
      const y = yN - 0.5;
      const wall = surfaceAt(y);
      const radius = wall.r * lobeScale(phi, y);
      positions.push(Math.cos(phi) * radius, y, Math.sin(phi) * radius);
      normals.push(Math.cos(phi) * sign, 0.1 * sign, Math.sin(phi) * sign);
      // Same texture coordinates the lathe skin has at this spot, unwrapped along the strip.
      uvs.push(0.75 - a, wall.v);
      spiral.push(a);
      acrossAttr.push(off);
      thickAttr.push(thick);
      kindAttr.push(kind);
    }
  }
  const stride = corners.length;
  for (let s = 0; s < steps; s += 1) {
    for (let strip = 0; strip < 4; strip += 1) {
      const i = s * stride + strip * 2;
      const j = i + stride;
      indices.push(i, j, i + 1, i + 1, j, j + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("aSpiral", new THREE.Float32BufferAttribute(spiral, 1));
  geometry.setAttribute("aAcross", new THREE.Float32BufferAttribute(acrossAttr, 1));
  geometry.setAttribute("aThick", new THREE.Float32BufferAttribute(thickAttr, 1));
  geometry.setAttribute("aKind", new THREE.Float32BufferAttribute(kindAttr, 1));
  geometry.setIndex(indices);
  return geometry;
}
const ribbonGeo = ribbonGeometry();

const timeUniform = { value: 0 };

const spiralFunc = /* glsl */ `
  uniform float uFront;
  uniform float uTurns;
  float spiralU(vec3 p) {
    return (1.0 - clamp(p.y + 0.5, 0.0, 1.0)) * uTurns;
  }
  float spiralTh(vec3 p) {
    return atan(p.z, p.x) / 6.2831853 + 0.5;
  }
  float spiralA(vec3 p) {
    float u = spiralU(p);
    float th = spiralTh(p);
    return floor(u - th + 0.5) + th;
  }
`;

// Each peeling apple owns its uniforms, so each needs its own program key.
let peelSerial = 0;

function skinMaterial(uniforms) {
  const material = skinBase.clone();
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFront = uniforms.uFront;
    shader.uniforms.uTurns = uniforms.uTurns;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObj;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vObj;\n${spiralFunc}`)
      .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif (spiralA(vObj) < uFront) discard;")
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        {
          // The cut skin shows a pale edge: its own thickness, along the strip
          // that is still on the apple and at the end where the strip leaves.
          float u = spiralU(vObj);
          float th = spiralTh(vObj);
          float k = floor(u - th + 0.5);
          float off = u - th - k;
          float below = ceil(uFront - th);
          float edge = (k == below) ? smoothstep(-0.5 + 0.05, -0.5, off) : 0.0;
          float cutEnd = smoothstep(0.016, 0.0, spiralA(vObj) - uFront);
          float rim = max(edge, cutEnd) * step(0.0, uFront);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.76, 0.52), rim);
        }`
      );
  };
  const key = `skin-peel-${++peelSerial}`;
  material.customProgramCacheKey = () => key;
  return material;
}

// Freshly cut flesh is wet and glossy, then dries toward matte.
function fleshPeelMaterial(uniforms) {
  const material = fleshMaterial.clone();
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFront = uniforms.uFront;
    shader.uniforms.uTurns = uniforms.uTurns;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObj;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vObj;\n${spiralFunc}`)
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        float wet = smoothstep(1.6, 0.0, uFront - spiralA(vObj)) * step(0.0, uFront - spiralA(vObj));
        roughnessFactor = mix(roughnessFactor, 0.28, wet);`
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        float wetTone = smoothstep(1.6, 0.0, uFront - spiralA(vObj));
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.99, 0.96, 0.9), wetTone);
        {
          // Flesh tucks in beneath the cut skin: a soft contact shadow along the strip edge.
          float u2 = spiralU(vObj);
          float th2 = spiralTh(vObj);
          float k2 = floor(u2 - th2 + 0.5);
          float off2 = u2 - th2 - k2;
          float lastPeeled = ceil(uFront - th2) - 1.0;
          float tuck = (k2 == lastPeeled) ? smoothstep(0.3, 0.5, off2) : 0.0;
          diffuseColor.rgb *= 1.0 - 0.42 * tuck * step(0.0, uFront);
        }`
      );
  };
  const key = `flesh-peel-${++peelSerial}`;
  material.customProgramCacheKey = () => key;
  return material;
}

function ribbonMaterial(uniforms) {
  const material = skinBase.clone();
  material.side = THREE.DoubleSide;
  // It fades as it falls, so the strip dissolves into the dark instead of just ending.
  material.transparent = true;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFront = uniforms.uFront;
    shader.uniforms.uTurns = uniforms.uTurns;
    shader.uniforms.uTime = timeUniform;
    shader.uniforms.uRelease = uniforms.uRelease;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float aSpiral;\nattribute float aAcross;\nattribute float aThick;\nattribute float aKind;\nuniform float uFront;\nuniform float uTurns;\nuniform float uTime;\nuniform float uRelease;\nvarying float vFall;\nvarying float vOpen;\nvarying float vKind;\nvarying float vAcross;\nvarying float vSp;"
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float d = max(uFront - aSpiral, 0.0);
        float k = 1.0 - exp(-d * 2.6);
        // Once the last of the skin is off, the strip lets go and drifts down. Its far end
        // (the oldest cut) leaves first, the end nearest the apple follows a beat later.
        float g = clamp(uRelease * 1.25 - 0.25 * (1.0 - clamp(d / 5.0, 0.0, 1.0)), 0.0, 1.0);
        g = g * g * (3.0 - 2.0 * g);
        vFall = g;
        vOpen = uFront - aSpiral;
        vKind = aKind;
        float phi = (fract(aSpiral) - 0.5) * 6.2831853;
        float phiCut = (fract(uFront) - 0.5) * 6.2831853;
        float yCut = (1.0 - uFront / uTurns) - 0.5;
        float rSurf = length(position.xz);
        // Once cut, the strip leaves the apple and hangs from the cut as a loose curl.
        // A real peel is a loose, uneven spring: the coil tightens and loosens, leans,
        // and its width wanders.
        float rc = (0.075 + 0.12 * exp(-d * 0.2) + 0.014 * sin(d * 3.1 + 0.6)) * (1.0 + 0.6 * g);
        vec2 cutDir = vec2(cos(phiCut), sin(phiCut));
        vec2 side = vec2(-cutDir.y, cutDir.x);
        vec2 centre = cutDir * (0.76 + 0.035 * sin(d * 0.9)) + side * 0.04 * sin(d * 0.65 + 1.0);
        centre += side * 0.3 * sin(uTime * 0.9 + d * 1.2) * g + cutDir * 0.22 * sin(uTime * 0.7 + d) * g;
        float sway = sin(uTime * 1.1 + d * 2.3) * 0.22 * k;
        float al = phiCut + 3.14159265 + d * 6.2831853 * 1.15 + sway + 0.25 * sin(d * 1.7) + g * 2.2;
        vec2 hang = centre + rc * vec2(cos(al), sin(al));
        vec2 onApple = vec2(cos(phi), sin(phi)) * rSurf;
        float wander = 0.5 * sin(aSpiral * 2.3 + 1.0) + 0.3 * sin(aSpiral * 5.1) + 0.2 * sin(aSpiral * 9.7 + 2.0);
        float width = 0.088 * (1.0 - 0.2 * smoothstep(0.0, 5.0, aSpiral)) * (1.0 + 0.28 * wander);
        float yHang = yCut - 0.05 - d * 0.13 - 0.02 * sin(d * 2.1) + aAcross * width;
        // The thin strip is also twisted and ruffled along its edges.
        float cone = aAcross * width * 0.55 * sin(d * 1.3 + 0.5) * k;
        float ruffle = sin(d * 7.0 + aSpiral * 11.0) * 0.011 * abs(aAcross) * 2.0 * k;
        yHang += aAcross * 0.014 * sin(d * 4.3 + aSpiral * 3.0) * k;
        yHang -= g * 3.2 - 0.09 * g * sin(uTime * 1.3 + d * 2.0);
        float thick = aThick * mix(0.012, 0.009, k);
        vec2 thickDir = mix(vec2(cos(phi), sin(phi)), vec2(cos(al), sin(al)), k);
        vec2 xz = mix(onApple, hang, k) + thickDir * (thick + cone + ruffle);
        transformed = vec3(xz.x, mix(position.y, yHang, k), xz.y);
        vAcross = aAcross;
        vSp = aSpiral;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vFall;\nvarying float vOpen;\nvarying float vKind;\nvarying float vAcross;\nvarying float vSp;")
      .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif (vOpen < 0.0) discard;")
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        // The inside of a peel is a thin skin of flesh with fibres running along the strip,
        // deeper yellow where it is thicker, paler and almost translucent at the edges.
        float fibre = 0.5 + 0.5 * sin(vAcross * 150.0 + sin(vSp * 4.0) * 2.5 + sin(vSp * 13.0) * 0.8);
        float edgeness = smoothstep(0.3, 0.5, abs(vAcross));
        vec3 inner = mix(vec3(0.93, 0.8, 0.52), vec3(0.97, 0.89, 0.66), fibre * 0.7 + edgeness * 0.4);
        if (vKind > 1.5) diffuseColor.rgb = vec3(0.96, 0.87, 0.62);
        else if (vKind > 0.5) diffuseColor.rgb = inner;
        else diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 0.78, 0.7), edgeness * 0.55 * smoothstep(0.0, 0.7, vOpen));
        diffuseColor.a *= 1.0 - smoothstep(0.55, 0.98, vFall);`
      );
  };
  const key = `skin-ribbon-${++peelSerial}`;
  material.customProgramCacheKey = () => key;
  return material;
}

/* ---------- authored placement table (their pattern: position, rotation, scale per object) ---------- */

// x, y, scale, peel. Whole apples sit wide to the sides, peeled ones nearer the
// line of travel so you pass right by them. Left-side apples stay high, away
// from the caption.
const layout = [
  [2.2, 0.3, 0.95, false],
  [-2.3, 1.0, 0.7, false],
  [0.3, 0.1, 1.15, true],
  [3.0, -0.6, 0.85, false],
  [-1.9, 1.2, 0.6, false],
  [1.5, 0.9, 0.75, false],
  [-0.9, 0.6, 1.1, true],
  [2.9, -0.2, 0.9, false],
  [-2.8, 0.9, 0.8, false],
  [1.0, -0.4, 1.15, true],
  [-1.6, 1.3, 0.65, false],
  [3.2, 0.7, 0.8, false],
  [-2.2, 0.6, 0.95, false],
  [0.0, 0.5, 1.2, true],
  [2.4, -0.7, 0.8, false],
  [-3.0, 1.1, 0.7, false],
  [1.1, 0.3, 1.15, true],
  [-1.4, 0.8, 0.9, false]
];
const placed = layout.map(([x, y, scale, peel], i) => ({
  position: [x, y, -3.4 - i * 1.55],
  rotation: [Math.sin(i * 1.7) * 0.3, i * 0.9, Math.cos(i * 2.3) * 0.25],
  scale,
  peel
}));

const cameraStart = new THREE.Vector3(0, 0.12, 2.4);
const cameraMid = new THREE.Vector3(0, 0.04, 0.6);

const stemParts = [stemGeometry, stemCap];
const fleet = placed.map((item, index) => {
  const group = new THREE.Group();
  const apple = {
    group,
    base: item.position.slice(),
    baseRot: item.rotation.slice(),
    seed: (index + 1) * 0.37,
    drift: 0.35 + (index % 5) * 0.12,
    uniforms: null,
    front: 0,
    release: 0
  };
  if (item.peel) {
    const uniforms = { uFront: { value: -1 }, uTurns: { value: TURNS }, uRelease: { value: 0 } };
    apple.uniforms = uniforms;
    const flesh = new THREE.Mesh(fleshGeometry, fleshPeelMaterial(uniforms));
    flesh.scale.setScalar(0.985);
    group.add(flesh);
    group.add(new THREE.Mesh(bodyGeometry, skinMaterial(uniforms)));
    group.add(new THREE.Mesh(ribbonGeo, ribbonMaterial(uniforms)));
  } else {
    group.add(new THREE.Mesh(bodyGeometry, skinBase));
  }
  stemParts.forEach((geometry) => group.add(new THREE.Mesh(geometry, stemMaterial)));
  group.position.set(...item.position);
  group.rotation.set(...item.rotation);
  group.scale.setScalar(item.scale);
  scene.add(group);
  return apple;
});

function span(value, start, end) {
  return Math.min(1, Math.max(0, (value - start) / (end - start)));
}

let progress = 0;
let clock = 0;

const [captionBeat, enterBeat] = root.querySelectorAll(".beat");
const enterButton = document.getElementById("enter-garden");

// The caption hands over to the invitation once the last apple has gone by.
function setCaptions(p) {
  const caption = 1 - span(p, 0.86, 0.9);
  const invite = span(p, 0.92, 0.97);
  captionBeat.style.opacity = caption;
  captionBeat.style.visibility = caption > 0.01 ? "visible" : "hidden";
  enterBeat.style.opacity = invite;
  enterBeat.style.visibility = invite > 0.01 ? "visible" : "hidden";
  enterButton.style.opacity = invite;
  enterButton.style.visibility = invite > 0.01 ? "visible" : "hidden";
  enterButton.style.pointerEvents = invite > 0.6 ? "auto" : "none";
}

// The first part of the scroll is the apples' flight; the rest is a tail where they
// are gone, the invitation stays, and only the pit keeps falling.
const FLIGHT_SHARE = 0.76;

function applyFlight(amount, time) {
  timeUniform.value = time;
  bgUniforms.uTime.value = time;
  const scrolled = Math.min(1, Math.max(0, amount));
  const flight = span(scrolled, 0, FLIGHT_SHARE);
  const tail = span(scrolled, FLIGHT_SHARE, 1);
  setCaptions(flight);
  const head = span(flight, 0, 0.35);
  const eased = head * head * (3 - 2 * head);
  const travel = span(flight, 0.35, 1);
  if (flight <= 0.35) camera.position.lerpVectors(cameraStart, cameraMid, eased);
  else {
    camera.position.copy(cameraMid);
    camera.position.z = cameraMid.z - travel * 30;
  }
  camera.lookAt(0, 0, camera.position.z - 6);
  bgUniforms.uTravel.value = -camera.position.z;
  // The background trails the scroll a little, so it feels like it sits far behind.
  const fall = bgUniforms.uFall;
  fall.value += (flight + tail * 0.5 - fall.value) * 0.05;
  const rise = Math.max(0, 1 - fall.value);
  bgUniforms.uCenter.value.set(Math.sin(fall.value * 5) * 0.07 * rise, -rise * 0.4);

  fleet.forEach((apple) => {
    apple.group.position.z = apple.base[2] - travel * apple.drift * 2;
    apple.group.rotation.x = apple.baseRot[0] + Math.sin(time * 0.4 + apple.seed * 6.28) * 0.06;
    apple.group.rotation.y = apple.baseRot[1] + travel * 0.9 + Math.sin(time * 0.3 + apple.seed * 4.1) * 0.08;
    apple.group.rotation.z = apple.baseRot[2] + Math.sin(time * 0.25 + apple.seed * 3.7) * 0.04;
    if (!apple.uniforms) return;
    const distance = camera.position.z - apple.group.position.z;
    // Peel as the camera closes in, but never before it has moved. The nearest
    // apples already sit inside the 19 → 5 window at rest, so measuring from a
    // fixed distance skinned them before any scrolling. Cap the start at just
    // inside each apple's own resting distance; farther apples keep the full window.
    const resting = cameraStart.z - apple.base[2];
    const peelStart = Math.min(resting - 0.5, 19);
    const peelEnd = Math.min(5, peelStart - 1);
    const opened = span(distance, peelStart, peelEnd);
    const target = opened * opened * opened * (opened * (opened * 6 - 15) + 10);
    // Ease toward the target so quick scrolling never makes the knife jump.
    apple.front += (target - apple.front) * 0.028;
    apple.uniforms.uFront.value = apple.front < 0.0005 ? -1 : apple.front * (TURNS + 1.1);
    // When the peel is complete it drifts away slowly; scrolling back snaps it home.
    apple.release = apple.front > 0.97 ? Math.min(1, apple.release + 0.0035) : Math.max(0, apple.release - 0.04);
    apple.uniforms.uRelease.value = apple.release;
  });
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  bgUniforms.uAspect.value = camera.aspect;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

function render() {
  renderer.render(scene, camera);
}

let onScreen = false;
if (root && "IntersectionObserver" in window) {
  const watch = new IntersectionObserver((entries) => {
    onScreen = entries.some((entry) => entry.isIntersecting);
  }, { rootMargin: "80px 0px" });
  watch.observe(root);
} else {
  onScreen = true;
}

resize();
applyFlight(0, 0);
render();
window.addEventListener("resize", () => {
  resize();
  if (onScreen) render();
});

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
ScrollTrigger.create({
  trigger: "#orchard",
  start: "top 40",
  end: "bottom 40",
  onToggle: (self) => document.body.classList.toggle("on-dark-orchard", self.isActive)
});
if (!reduced) {
  ScrollTrigger.create({
    trigger: "#orchard",
    start: "top top",
    end: "bottom bottom",
    scrub: 1.2,
    onUpdate: (self) => {
      progress = self.progress;
    }
  });
}

// The cursor stirs the liquid: its recent movement drags the surface, then settles.
const pointer = { x: 0.5, y: 0.5, lastX: 0.5, lastY: 0.5 };
window.addEventListener("pointermove", (event) => {
  pointer.x = event.clientX / window.innerWidth;
  pointer.y = 1 - event.clientY / window.innerHeight;
}, { passive: true });

gsap.ticker.add(() => {
  if (!onScreen || document.hidden) return;
  clock += 0.016;
  const stir = bgUniforms.uStir.value;
  const mouse = bgUniforms.uMouse.value;
  mouse.x += (pointer.x - mouse.x) * 0.12;
  mouse.y += (pointer.y - mouse.y) * 0.12;
  const dx = Math.max(-0.06, Math.min(0.06, mouse.x - pointer.lastX));
  const dy = Math.max(-0.06, Math.min(0.06, mouse.y - pointer.lastY));
  pointer.lastX = mouse.x;
  pointer.lastY = mouse.y;
  stir.x = stir.x * 0.96 + dx * 4;
  stir.y = stir.y * 0.96 + dy * 4;
  applyFlight(progress, clock);
  render();
});
