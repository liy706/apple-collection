import * as THREE from "three";

export function buildKnife() {
  const root = new THREE.Group();
  root.name = "Table_Knife";

  const steel = new THREE.MeshStandardMaterial({ color: 0xd9dde0, metalness: 0.92, roughness: 0.2 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x9aa0a4, metalness: 0.9, roughness: 0.32 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x6a3d22, metalness: 0, roughness: 0.55 });

  const blade = new THREE.Shape();
  blade.moveTo(0, 0.03);
  blade.lineTo(0.27, 0.03);
  blade.quadraticCurveTo(0.33, 0.026, 0.355, -0.004);
  blade.quadraticCurveTo(0.22, -0.034, 0, -0.03);
  blade.lineTo(0, 0.03);
  const bladeGeometry = new THREE.ExtrudeGeometry(blade, {
    depth: 0.004,
    bevelEnabled: true,
    bevelThickness: 0.0016,
    bevelSize: 0.0016,
    bevelSegments: 2,
    curveSegments: 24
  });
  bladeGeometry.translate(0, 0, -0.002);
  bladeGeometry.rotateX(-Math.PI / 2);
  const bladeMesh = new THREE.Mesh(bladeGeometry, steel);
  bladeMesh.position.set(0, 0.0045, 0);
  root.add(bladeMesh);

  const bolster = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.058, 20), darkSteel);
  bolster.rotation.x = Math.PI / 2;
  bolster.scale.set(1, 1, 0.55);
  bolster.position.set(-0.004, 0.0105, 0);
  root.add(bolster);

  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.0185, 0.17, 8, 24), wood);
  handle.rotation.z = Math.PI / 2;
  handle.scale.set(1, 1, 1);
  handle.position.set(-0.105, 0.0185, 0);
  handle.scale.y = 1;
  root.add(handle);
  [-0.07, -0.135].forEach((x) => {
    const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 12, 8), steel);
    rivet.position.set(x, 0.0365, 0);
    rivet.scale.y = 0.55;
    root.add(rivet);
  });

  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });
  return root;
}
