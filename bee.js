import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const loader = new GLTFLoader();

export function buildBee() {
  const root = new THREE.Group();
  root.name = "Garden_Bee";

  const body = new THREE.Group();
  body.name = "Bee_Body";
  root.add(body);

  root.userData.body = body;
  root.userData.wings = [];
  root.userData.mixer = null;
  root.raycast = () => {};

  loader.load("models/Chubby_Bee.glb", (gltf) => {
    const model = gltf.scene;
    model.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = false;
      child.raycast = () => {};
    });

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const longest = Math.max(size.x, size.y, size.z) || 1;
    model.scale.setScalar(0.3 / longest);
    const fitted = new THREE.Box3().setFromObject(model);
    model.position.sub(fitted.getCenter(new THREE.Vector3()));
    body.add(model);

    if (gltf.animations.length) {
      const mixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach((clip) => {
        mixer.clipAction(clip).play();
      });
      root.userData.mixer = mixer;
    }
  });

  return root;
}

const UP = new THREE.Vector3(0, 1, 0);
const _want = new THREE.Vector3();
const _to = new THREE.Vector3();
const _prev = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _look = new THREE.Vector3();
const _away = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qPitch = new THREE.Quaternion();
const _xAxis = new THREE.Vector3(1, 0, 0);

function keepOutOfTree(pos, tree) {
  if (!tree) return;
  const dx = pos.x - tree.x;
  const dz = pos.z - tree.z;
  const d = Math.hypot(dx, dz);
  if (d < tree.r) {
    const k = d < 0.08 ? tree.r : tree.r / d;
    pos.x = tree.x + dx * k;
    pos.z = tree.z + dz * k;
  }
}

function pickTarget(f) {
  const tree = f.tree;
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 2.35 + Math.random() * 1.15;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (tree && Math.hypot(x - tree.x, z - tree.z) < tree.r + 0.35) continue;
    f.target.set(x, 2.05 + Math.random() * 1.15, z);
    f.state = Math.random() < 0.28 ? "hover" : "cruise";
    f.timer = f.state === "hover" ? 1.2 + Math.random() * 1.4 : 2.4 + Math.random() * 2.2;
    return;
  }
  f.target.set(2.6, 2.4, 1.1);
  f.state = "cruise";
  f.timer = 2;
}

function initFlight(bee) {
  const tree = bee.userData.tree;
  const f = {
    pos: new THREE.Vector3(2.6, 2.35, 1.2),
    vel: new THREE.Vector3(0.4, 0.05, 0.55),
    target: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    last: 0,
    seed: Math.random() * 100,
    roll: 0,
    pitch: 0,
    hoverAngle: 0,
    state: "cruise",
    timer: 2,
    tree
  };
  keepOutOfTree(f.pos, tree);
  pickTarget(f);
  bee.userData.flight = f;
}

export function flyBee(bee, time) {
  if (!bee.userData.flight) initFlight(bee);
  const f = bee.userData.flight;
  f.tree = bee.userData.tree || f.tree;
  const dt = f.last ? Math.min(0.04, Math.max(0.001, time - f.last)) : 0.016;
  f.last = time;

  if (bee.userData.mixer) bee.userData.mixer.update(dt);

  _to.copy(f.target).sub(f.pos);
  const dist = _to.length();
  f.timer -= dt;

  if (f.state === "hover") {
    f.hoverAngle += dt * 1.4;
    f.target.x += Math.cos(f.hoverAngle) * dt * 0.22;
    f.target.z += Math.sin(f.hoverAngle) * dt * 0.22;
    f.target.y += Math.sin(f.hoverAngle * 2.1) * dt * 0.12;
    keepOutOfTree(f.target, f.tree);
    if (f.timer <= 0) pickTarget(f);
  } else if (dist < 0.45 || f.timer <= 0) {
    pickTarget(f);
  }

  const maxSpeed = f.state === "hover" ? 0.55 : 1.55;
  _want.copy(_to);
  if (_want.lengthSq() > 1e-6) _want.normalize();
  _want.multiplyScalar(Math.min(maxSpeed, dist * 1.8 + 0.25));

  const s = f.seed;
  _want.x += Math.sin(time * 0.7 + s) * 0.1;
  _want.y += Math.sin(time * 0.55 + s * 1.7) * 0.05;
  _want.z += Math.cos(time * 0.78 + s * 0.6) * 0.1;

  if (f.tree) {
    const dx = f.pos.x - f.tree.x;
    const dz = f.pos.z - f.tree.z;
    const d = Math.hypot(dx, dz) || 0.001;
    if (d < f.tree.r + 0.55) {
      const push = (f.tree.r + 0.55 - d) * 3.2;
      _want.x += (dx / d) * push;
      _want.z += (dz / d) * push;
    }
  }

  const ring = Math.hypot(f.pos.x, f.pos.z);
  if (ring > 3.7) {
    _away.set(-f.pos.x, 0, -f.pos.z).normalize().multiplyScalar(1.4);
    _want.add(_away);
  } else if (ring < 2.05) {
    _away.set(f.pos.x, 0, f.pos.z).normalize().multiplyScalar(0.8);
    _want.add(_away);
  }

  _prev.copy(f.vel);
  f.vel.lerp(_want, 1 - Math.exp(-(f.state === "hover" ? 4.2 : 3.1) * dt));
  f.pos.addScaledVector(f.vel, dt);
  keepOutOfTree(f.pos, f.tree);
  f.pos.y = THREE.MathUtils.clamp(f.pos.y, 1.85, 3.35);

  const speed = f.vel.length();
  if (speed > 0.08) _forward.copy(f.vel).normalize();
  _right.crossVectors(_forward, UP);
  if (_right.lengthSq() > 1e-6) _right.normalize();
  const lateral = f.vel.clone().sub(_prev).dot(_right) / Math.max(dt, 1e-3);
  const targetRoll = THREE.MathUtils.clamp(lateral * 0.08, -0.28, 0.28);
  f.roll += (targetRoll - f.roll) * Math.min(1, dt * 2.2);
  const targetPitch = THREE.MathUtils.clamp((maxSpeed - speed) / maxSpeed * 0.12 - 0.04, -0.12, 0.14);
  f.pitch += (targetPitch - f.pitch) * Math.min(1, dt * 2);

  _up.copy(UP).applyAxisAngle(_forward, f.roll);
  _look.copy(f.pos).sub(_forward);
  _m.lookAt(f.pos, _look, _up);
  _q.setFromRotationMatrix(_m);
  _q.multiply(_qPitch.setFromAxisAngle(_xAxis, f.pitch));
  f.quat.slerp(_q, Math.min(1, dt * 5));

  bee.position.copy(f.pos);
  bee.quaternion.copy(f.quat);
}
