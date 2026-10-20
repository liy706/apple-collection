import * as THREE from "three";

const gsap = window.gsap;

/* ---------- geometry: clip a triangle soup against a plane through the origin ---------- */

function localGeometry(mesh, toPivot) {
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toPivot, mesh.matrixWorld));
  return geometry;
}

// Keeps the side of the plane (normal n, through the origin) where sign * (n . p) >= 0.
// Appends the outline of the cut to `segments` when asked.
function clipGeometry(source, n, sign, segments) {
  const names = Object.keys(source.attributes).filter((name) => source.attributes[name].array instanceof Float32Array);
  const out = {};
  names.forEach((name) => (out[name] = []));
  const position = source.attributes.position;
  const count = position.count;
  const distance = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    distance[i] = sign * (n.x * position.getX(i) + n.y * position.getY(i) + n.z * position.getZ(i));
  }

  const emit = (vertex) => {
    names.forEach((name) => {
      const attribute = source.attributes[name];
      const size = attribute.itemSize;
      const values = [];
      for (let c = 0; c < size; c += 1) {
        const a = attribute.getComponent(vertex.a, c);
        const b = attribute.getComponent(vertex.b, c);
        values.push(a + (b - a) * vertex.t);
      }
      if (name === "normal") {
        const length = Math.hypot(values[0], values[1], values[2]) || 1;
        values[0] /= length;
        values[1] /= length;
        values[2] /= length;
      }
      out[name].push(...values);
    });
  };

  const polygon = [];
  const cutPoints = [];
  for (let t = 0; t < count; t += 3) {
    polygon.length = 0;
    cutPoints.length = 0;
    for (let e = 0; e < 3; e += 1) {
      const a = t + e;
      const b = t + ((e + 1) % 3);
      const da = distance[a];
      const db = distance[b];
      if (da >= 0) polygon.push({ a, b: a, t: 0 });
      if (da >= 0 !== db >= 0) {
        const k = da / (da - db);
        const vertex = { a, b, t: k };
        polygon.push(vertex);
        if (segments) {
          cutPoints.push(
            new THREE.Vector3(
              position.getX(a) + (position.getX(b) - position.getX(a)) * k,
              position.getY(a) + (position.getY(b) - position.getY(a)) * k,
              position.getZ(a) + (position.getZ(b) - position.getZ(a)) * k
            )
          );
        }
      }
    }
    for (let k = 1; k < polygon.length - 1; k += 1) {
      emit(polygon[0]);
      emit(polygon[k]);
      emit(polygon[k + 1]);
    }
    if (segments && cutPoints.length === 2) segments.push({ a: cutPoints[0], b: cutPoints[1], used: false });
  }

  const geometry = new THREE.BufferGeometry();
  names.forEach((name) => {
    geometry.setAttribute(name, new THREE.Float32BufferAttribute(out[name], source.attributes[name].itemSize));
  });
  if (!geometry.attributes.normal && geometry.attributes.position.count) geometry.computeVertexNormals();
  return geometry;
}

// Joins the cut segments head to tail into closed loops of points.
function chainLoops(segments) {
  const tolerance = 2e-4;
  const loops = [];
  segments.forEach((start) => {
    if (start.used) return;
    start.used = true;
    const loop = [start.a.clone(), start.b.clone()];
    for (let guard = 0; guard < segments.length + 4; guard += 1) {
      const end = loop[loop.length - 1];
      let best = null;
      let bestDistance = tolerance;
      let flip = false;
      for (const candidate of segments) {
        if (candidate.used) continue;
        const da = candidate.a.distanceTo(end);
        const db = candidate.b.distanceTo(end);
        if (da < bestDistance) {
          best = candidate;
          bestDistance = da;
          flip = false;
        }
        if (db < bestDistance) {
          best = candidate;
          bestDistance = db;
          flip = true;
        }
      }
      if (!best) break;
      best.used = true;
      loop.push((flip ? best.a : best.b).clone());
    }
    if (loop.length > 8) loops.push(loop);
  });
  return loops;
}

/* ---------- the cut face: outline -> mesh, and a painted cross-section ---------- */

function capFace(loops, n, outward) {
  // Plane axes: u runs along the cut, v is straight up.
  const tangent = new THREE.Vector3(-n.z, 0, n.x).normalize();
  const positions = [];
  const normals = [];
  const uvs = [];
  const flat = [];
  let uMin = Infinity;
  let uMax = -Infinity;
  let vMin = Infinity;
  let vMax = -Infinity;
  const contours = loops.map((loop) => {
    const points = [];
    loop.forEach((p) => {
      const last = points[points.length - 1];
      if (last && last.p.distanceTo(p) < 1e-5) return;
      const u = p.dot(tangent);
      const v = p.y;
      points.push({ p, u, v });
      uMin = Math.min(uMin, u);
      uMax = Math.max(uMax, u);
      vMin = Math.min(vMin, v);
      vMax = Math.max(vMax, v);
    });
    return points;
  });
  const uSpan = uMax - uMin;
  const vSpan = vMax - vMin;

  contours.forEach((points) => {
    if (points.length < 4) return;
    const contour = points.map((q) => new THREE.Vector2(q.u, q.v));
    let faces;
    try {
      faces = THREE.ShapeUtils.triangulateShape(contour, []);
    } catch (error) {
      return;
    }
    const base = positions.length / 3;
    points.forEach((q) => {
      positions.push(q.p.x, q.p.y, q.p.z);
      normals.push(outward.x, outward.y, outward.z);
      uvs.push((q.u - uMin) / uSpan, (q.v - vMin) / vSpan);
    });
    faces.forEach(([a, b, c]) => {
      const pa = points[a].p;
      const pb = points[b].p;
      const pc = points[c].p;
      const normal = new THREE.Vector3().subVectors(pb, pa).cross(new THREE.Vector3().subVectors(pc, pa));
      if (normal.dot(outward) >= 0) flat.push(base + a, base + b, base + c);
      else flat.push(base + a, base + c, base + b);
    });
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(flat);
  return { geometry, tangent, uMin, uSpan, vMin, vSpan, contours };
}

function paintCap(face, mode, renderer) {
  const { uMin, uSpan, vMin, vSpan, contours } = face;
  const W = 1024;
  const H = Math.max(256, Math.round((W * vSpan) / uSpan));
  const px = (u) => ((u - uMin) / uSpan) * W;
  const py = (v) => (1 - (v - vMin) / vSpan) * H;

  const make = () => {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    return [canvas, canvas.getContext("2d")];
  };
  const [colour, ctx] = make();
  const [relief, rctx] = make();

  const outline = (c) => {
    c.beginPath();
    contours.forEach((points) => {
      points.forEach((q, i) => (i === 0 ? c.moveTo(px(q.u), py(q.v)) : c.lineTo(px(q.u), py(q.v))));
      c.closePath();
    });
  };

  const cx = px(0);
  const cy = py(0);
  const coreW = W * 0.075;
  const coreH = H * 0.26;

  // Flesh: cream with a green-white heart, warmer and a little denser toward the skin.
  const flesh = ctx.createRadialGradient(cx, cy, W * 0.03, cx, cy, W * 0.5);
  flesh.addColorStop(0, "#f0eec3");
  flesh.addColorStop(0.3, "#f6f1d4");
  flesh.addColorStop(0.8, "#f1e3b4");
  flesh.addColorStop(1, "#e8d49b");
  ctx.fillStyle = flesh;
  ctx.fillRect(0, 0, W, H);
  rctx.fillStyle = "rgb(150,150,150)";
  rctx.fillRect(0, 0, W, H);

  ctx.save();
  rctx.save();
  outline(ctx);
  ctx.clip();
  outline(rctx);
  rctx.clip();

  // Cell grain: a fine speckle of slightly darker and lighter flesh.
  for (let i = 0; i < 9000; i += 1) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 0.8 + Math.random() * 2.2;
    ctx.fillStyle = Math.random() < 0.5 ? "rgba(255,252,232,0.18)" : "rgba(196,170,104,0.10)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    rctx.fillStyle = Math.random() < 0.5 ? "rgba(190,190,190,0.25)" : "rgba(110,110,110,0.25)";
    rctx.beginPath();
    rctx.arc(x, y, r, 0, Math.PI * 2);
    rctx.fill();
  }

  // Vascular bundles fan out from the core: fine bright lines toward the skin.
  for (let i = 0; i < 340; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const inner = W * (0.06 + Math.random() * 0.1);
    const outer = inner + W * (0.1 + Math.random() * 0.28);
    const x0 = cx + Math.cos(angle) * inner;
    const y0 = cy + Math.sin(angle) * inner * 1.3;
    const x1 = cx + Math.cos(angle + (Math.random() - 0.5) * 0.12) * outer;
    const y1 = cy + Math.sin(angle) * outer * 1.3;
    ctx.strokeStyle = Math.random() < 0.55 ? "rgba(255,255,242,0.26)" : "rgba(206,184,118,0.18)";
    ctx.lineWidth = 0.7 + Math.random() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    rctx.strokeStyle = "rgba(200,200,200,0.18)";
    rctx.lineWidth = ctx.lineWidth;
    rctx.beginPath();
    rctx.moveTo(x0, y0);
    rctx.lineTo(x1, y1);
    rctx.stroke();
  }

  // The core: a tough, pale lens from the stem cavity to the calyx, slightly sunken.
  const lens = (c, w, h) => {
    c.beginPath();
    c.moveTo(cx, cy - h * 0.55);
    c.bezierCurveTo(cx + w * 1.15, cy - h * 0.32, cx + w * 1.1, cy + h * 0.32, cx, cy + h * 0.55);
    c.bezierCurveTo(cx - w * 1.1, cy + h * 0.32, cx - w * 1.15, cy - h * 0.32, cx, cy - h * 0.55);
    c.closePath();
  };
  lens(ctx, coreW, coreH);
  const coreFill = ctx.createLinearGradient(0, cy - coreH, 0, cy + coreH);
  coreFill.addColorStop(0, "#dcdca8");
  coreFill.addColorStop(0.5, "#e8e7b8");
  coreFill.addColorStop(1, "#d8d29c");
  ctx.fillStyle = coreFill;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#bfb67c";
  ctx.stroke();
  lens(rctx, coreW, coreH);
  rctx.fillStyle = "rgb(110,110,110)";
  rctx.fill();
  rctx.lineWidth = 7;
  rctx.strokeStyle = "rgb(70,70,70)";
  rctx.stroke();

  // Two seed chambers.
  [-1, 1].forEach((side) => {
    const sx = cx + side * coreW * 0.46;
    const sy = cy + coreH * 0.04;
    const rx = coreW * 0.4;
    const ry = coreH * 0.28;
    ctx.fillStyle = "#cfc88a";
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx, ry, side * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(150,138,80,0.9)";
    ctx.lineWidth = 3;
    ctx.stroke();
    rctx.fillStyle = "rgb(40,40,40)";
    rctx.beginPath();
    rctx.ellipse(sx, sy, rx, ry, side * 0.1, 0, Math.PI * 2);
    rctx.fill();
    if (mode === "mould") {
      // Where the seed lay: a darker, tear-shaped dent.
      ctx.fillStyle = "rgba(95,60,30,0.55)";
      ctx.beginPath();
      ctx.ellipse(sx, sy + ry * 0.05, rx * 0.62, ry * 0.7, side * 0.1, 0, Math.PI * 2);
      ctx.fill();
      rctx.fillStyle = "rgb(10,10,10)";
      rctx.beginPath();
      rctx.ellipse(sx, sy + ry * 0.05, rx * 0.62, ry * 0.7, side * 0.1, 0, Math.PI * 2);
      rctx.fill();
    }
  });

  // Browning around the stem cavity and the calyx.
  [py(vMin + vSpan), py(vMin)].forEach((y, i) => {
    const g = ctx.createRadialGradient(cx, y, 2, cx, y, W * 0.07);
    g.addColorStop(0, "rgba(140,98,52,0.7)");
    g.addColorStop(1, "rgba(140,98,52,0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - W * 0.08, y - W * 0.08, W * 0.16, W * 0.16);
    void i;
  });
  ctx.restore();
  rctx.restore();

  // Skin: a pale band of flesh just inside a thin line of red.
  ctx.lineJoin = "round";
  outline(ctx);
  ctx.lineWidth = 22;
  ctx.strokeStyle = "rgba(255,240,200,0.5)";
  ctx.stroke();
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#a81d1b";
  ctx.stroke();
  outline(rctx);
  rctx.lineWidth = 8;
  rctx.strokeStyle = "rgb(205,205,205)";
  rctx.stroke();

  const map = new THREE.CanvasTexture(colour);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const bump = new THREE.CanvasTexture(relief);
  bump.anisotropy = map.anisotropy;
  return { map, bump };
}

function seedGeometry() {
  // A teardrop: round at the base, drawn out to a point.
  const profile = [];
  for (let i = 0; i <= 24; i += 1) {
    const t = i / 24;
    const y = -1 + 2 * t;
    const r = Math.sin(Math.PI * Math.pow(t, 0.8)) * (1 - 0.35 * t) * 0.55;
    profile.push(new THREE.Vector2(Math.max(r, 0.0001), y));
  }
  return new THREE.LatheGeometry(profile, 24);
}

/* ---------- the cut itself ---------- */

// Cuts the apple (its pivot sits at the middle of the fruit) along a vertical plane whose
// horizontal normal is `normal`. Returns the two halves, ready to be placed.
export function sliceApple({ apple, body, normal, scene, renderer }) {
  apple.pivot.updateMatrixWorld(true);
  apple.group.updateMatrixWorld(true);
  const pivotMatrix = apple.pivot.matrixWorld.clone();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  pivotMatrix.decompose(position, quaternion, scale);
  const toPivot = pivotMatrix.clone().invert();

  const n = normal.clone().setY(0).normalize();
  // The plane in the pivot's own frame (it is only ever turned about the vertical axis).
  const nLocal = n.clone().applyQuaternion(quaternion.clone().invert()).setY(0).normalize();

  const meshes = [];
  apple.group.traverse((child) => child.isMesh && meshes.push(child));
  const sources = meshes.map((mesh) => ({ mesh, geometry: localGeometry(mesh, toPivot) }));

  const segments = [];
  const bodySource = sources.find((s) => s.mesh === body);
  // Cut the body once on its own to read off the outline of the cut.
  clipGeometry(bodySource.geometry, nLocal, 1, segments).dispose();
  const loops = chainLoops(segments);

  const halves = [1, -1].map((side, index) => {
    const root = new THREE.Group();
    root.position.copy(position);
    root.quaternion.copy(quaternion);
    root.scale.copy(scale);

    const owned = [];
    let depth = 0;
    sources.forEach(({ mesh, geometry }) => {
      const half = clipGeometry(geometry, nLocal, side, null);
      if (!half.attributes.position.count) {
        half.dispose();
        return;
      }
      if (mesh === body) {
        const p = half.attributes.position;
        for (let i = 0; i < p.count; i += 1) {
          depth = Math.max(depth, side * (nLocal.x * p.getX(i) + nLocal.z * p.getZ(i)));
        }
      }
      half.computeBoundingSphere();
      const piece = new THREE.Mesh(half, mesh.material);
      piece.castShadow = true;
      piece.receiveShadow = true;
      root.add(piece);
      owned.push(half);
    });

    // The face of the cut points away from the half's body.
    const outwardLocal = nLocal.clone().multiplyScalar(-side);
    const face = capFace(loops, nLocal, outwardLocal);
    const maps = paintCap(face, index === 0 ? "seeds" : "mould", renderer);
    const material = new THREE.MeshPhysicalMaterial({
      map: maps.map,
      bumpMap: maps.bump,
      bumpScale: 2.4,
      roughness: 0.46,
      metalness: 0,
      clearcoat: 0.22,
      clearcoatRoughness: 0.4,
      sheen: 0.35,
      sheenColor: new THREE.Color(0xfff4d2),
      sheenRoughness: 0.6
    });
    const cap = new THREE.Mesh(face.geometry, material);
    cap.castShadow = true;
    cap.receiveShadow = true;
    root.add(cap);
    owned.push(face.geometry, material, maps.map, maps.bump);

    // The half that kept the seeds: two real teardrops lying in their chambers.
    if (index === 0) {
      const seedMaterial = new THREE.MeshPhysicalMaterial({ color: 0x4a230f, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12 });
      const geometry = seedGeometry();
      owned.push(seedMaterial, geometry);
      const span = face.uSpan;
      [-1, 1].forEach((s) => {
        const seed = new THREE.Mesh(geometry, seedMaterial);
        const along = s * span * 0.075 * 0.46;
        seed.scale.set(span * 0.02, span * 0.052, span * 0.015);
        seed.position
          .copy(face.tangent)
          .multiplyScalar(along)
          .addScaledVector(outwardLocal, span * 0.003);
        seed.position.y = -face.vSpan * 0.0104;
        // Flat in the cut, thin side toward the viewer.
        seed.rotation.y = Math.atan2(outwardLocal.x, outwardLocal.z);
        seed.castShadow = true;
        root.add(seed);
      });
    }

    scene.add(root);
    const faceWorld = outwardLocal.clone().applyQuaternion(quaternion);
    return { root, owned, depth, side, face: faceWorld, base: quaternion.clone(), scale: scale.x };
  });

  sources.forEach((s) => s.geometry.dispose());

  // The halves ease apart and roll outward a little, showing the cut faces.
  const axis = new THREE.Vector3(0, 1, 0).cross(n).normalize();
  const gap = Math.max(scale.x, 0.01) * 0.3;
  halves.forEach((half, index) => {
    const target = position.clone().addScaledVector(n, half.side * gap);
    const tilted = new THREE.Quaternion().setFromAxisAngle(axis, half.side * (0.34 + 0.04 * index)).multiply(quaternion);
    const state = { t: 0 };
    half.tween = gsap.to(state, {
      t: 1,
      duration: 1.0,
      ease: "power2.out",
      onUpdate: () => {
        half.root.position.lerpVectors(position, target, state.t);
        half.root.quaternion.slerpQuaternions(quaternion, tilted, state.t);
      }
    });
  });

  let gone = false;
  const dispose = () => {
    if (gone) return;
    gone = true;
    halves.forEach((half) => {
      scene.remove(half.root);
      half.owned.forEach((item) => item.dispose());
    });
  };

  // Shrinks the halves away (used when leaving the table).
  const remove = (delay = 0, duration = 0.5) => {
    gsap.delayedCall(delay, () => {
      halves.forEach((half) => gsap.to(half.root.scale, { x: 0.001, y: 0.001, z: 0.001, duration, ease: "power2.in" }));
      gsap.delayedCall(duration + 0.05, dispose);
    });
  };

  return { halves, remove, dispose };
}
