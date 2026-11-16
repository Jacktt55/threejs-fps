import * as THREE from 'three';
import { MAP, PALETTE, WAYPOINTS, ROUTES, SPAWN_POINTS } from './constants.js';
import { createTextures, createStencilTexture } from './textures.js';

function makeMaterial(set, repeatX = 1, repeatY = 1) {
  const map = set.map.clone();
  map.repeat.set(repeatX, repeatY);
  map.needsUpdate = true;
  const bump = set.bumpMap.clone();
  bump.repeat.set(repeatX, repeatY);
  bump.needsUpdate = true;
  const rough = set.roughnessMap.clone();
  rough.repeat.set(repeatX, repeatY);
  rough.needsUpdate = true;
  return new THREE.MeshStandardMaterial({
    map,
    bumpMap: bump,
    bumpScale: 0.6,
    roughnessMap: rough,
    roughness: 1,
    metalness: 0,
  });
}

function makeMetalMaterial(set, repeatX = 1, repeatY = 1) {
  const material = makeMaterial(set, repeatX, repeatY);
  material.metalness = 0.55;
  return material;
}

export function collidesAt(colliders, x, z, radius, y = 0.8) {
  for (const box of colliders) {
    if (box.min.y > y || box.max.y < y) continue;
    const cx = Math.max(box.min.x, Math.min(x, box.max.x));
    const cz = Math.max(box.min.z, Math.min(z, box.max.z));
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < radius * radius) return true;
  }
  return false;
}

function segmentHitsBox(a, b, box) {
  let tmin = 0;
  let tmax = 1;
  const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  for (const axis of ['x', 'y', 'z']) {
    const origin = a[axis];
    const dir = d[axis];
    const mn = box.min[axis];
    const mx = box.max[axis];
    if (Math.abs(dir) < 1e-9) {
      if (origin < mn || origin > mx) return false;
    } else {
      let t1 = (mn - origin) / dir;
      let t2 = (mx - origin) / dir;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }
  }
  return true;
}

export function segmentBlocked(a, b, colliders) {
  for (const box of colliders) {
    if (segmentHitsBox(a, b, box)) return true;
  }
  return false;
}

export function createMap(scene) {
  const tex = createTextures();
  const colliders = [];
  const meshes = [];
  const H = MAP.wallHeight;

  const sandstone = makeMaterial(tex.sandstone, 4, 1);
  const concrete = makeMaterial(tex.concrete, 4, 1);
  const concreteFloor = makeMaterial(tex.concrete, 3, 2);
  const asphalt = makeMaterial(tex.asphalt, 8, 6);
  const crateMat = makeMaterial(tex.crate, 1, 1);
  const hazardMat = makeMaterial(tex.hazard, 6, 1);
  const blueMetal = makeMetalMaterial(tex.containerBlue, 2, 1);
  const rustMetal = makeMetalMaterial(tex.containerRust, 2, 1);
  const oliveMetal = makeMetalMaterial(tex.containerOlive, 2, 1);

  function addBox(x, z, w, d, h, material, { y = 0, ry = 0, rz = 0, solid = true, shadow = true } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y + h / 2, z);
    mesh.rotation.y = ry;
    mesh.rotation.z = rz;
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    scene.add(mesh);
    meshes.push(mesh);
    if (solid) {
      mesh.updateMatrixWorld(true);
      colliders.push(new THREE.Box3().setFromObject(mesh));
    }
    return mesh;
  }

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(64, 48), asphalt);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const midFloor = new THREE.Mesh(new THREE.PlaneGeometry(18, 12), concreteFloor);
  midFloor.rotation.x = -Math.PI / 2;
  midFloor.position.set(0, 0.01, 0);
  midFloor.receiveShadow = true;
  scene.add(midFloor);

  const bFloor = new THREE.Mesh(new THREE.PlaneGeometry(20, 16), concreteFloor);
  bFloor.rotation.x = -Math.PI / 2;
  bFloor.position.set(21.5, 0.01, 15.5);
  bFloor.receiveShadow = true;
  scene.add(bFloor);

  addBox(0, -24.5, 65, 1, H, sandstone);
  addBox(0, 24.5, 65, 1, H, sandstone);
  addBox(-32.5, 0, 1, 49, H, sandstone);
  addBox(32.5, 0, 1, 49, H, sandstone);

  addBox(-6, -6, 1, 8, H, concrete);
  addBox(-6, 6, 1, 8, H, concrete);
  addBox(-10, -18, 44, 1, H, concrete);
  addBox(28, -18, 8, 1, H, concrete);
  addBox(26, -10, 12, 1, H, concrete);
  addBox(25, 8, 14, 1, H, concrete);
  addBox(-10, 18, 36, 1, H, concrete);
  addBox(4, 5, 4, 1, 1.2, concrete);
  addBox(2, -7, 4, 1, 1.2, concrete);

  const crates = [
    [24, -12], [27, -18], [15, -20], // site A yard
    [3, 3], [-3, -4], // mid
    [16, 11], [26, 11], // site B yard
    [-18, 21.8], // B tunnels
  ];
  for (const [x, z] of crates) addBox(x, z, 1.2, 1.2, 1.2, crateMat);

  addBox(24, 12, 6, 2.6, 2.6, blueMetal);
  addBox(17, 20, 2.6, 6, 2.6, rustMetal);
  addBox(24, 12, 6, 2.6, 2.6, oliveMetal, { y: 2.6 });
  addBox(-14, -14, 6, 2.6, 2.6, rustMetal);

  addBox(22, -20, 12, 4, 0.3, concrete, { y: 2.7, shadow: true });
  for (const [px, pz] of [[16.5, -21.5], [27.5, -21.5], [16.5, -18.5], [27.5, -18.5]]) {
    addBox(px, pz, 0.4, 0.4, 2.7, concrete);
  }
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.25, 2), concrete);
  ramp.position.set(13.8, 1.5, -20);
  ramp.rotation.z = 0.59;
  ramp.castShadow = true;
  ramp.receiveShadow = true;
  scene.add(ramp);
  meshes.push(ramp);
  ramp.updateMatrixWorld(true);
  colliders.push(new THREE.Box3().setFromObject(ramp));

  addBox(-6, 0, 1, 4, 1, concrete, { y: 3 }); // mid double doors
  addBox(16, -10, 8, 1, 1, concrete, { y: 3 }); // A Main gap
  addBox(12.25, -10, 0.5, 1, 3, concrete);
  addBox(19.75, -10, 0.5, 1, 3, concrete);
  addBox(15, 8, 6, 1, 1, concrete, { y: 3 }); // B Main gap
  addBox(12.25, 8, 0.5, 1, 3, concrete);
  addBox(17.75, 8, 0.5, 1, 3, concrete);

  const steel = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.4, metalness: 0.8 });
  for (const z of [-21.9, -18.1]) {
    addBox(22, z, 12, 0.08, 0.08, steel, { y: 3.85 });
    addBox(22, z, 12, 0.06, 0.06, steel, { y: 3.4 });
  }

  function pipe(x, y, z, len, r, axis) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), steel);
    m.position.set(x, y, z);
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    m.castShadow = true;
    scene.add(m);
  }
  pipe(0, 2.2, -23.9, 60, 0.12, 'x');
  pipe(0, 2.55, -23.9, 60, 0.09, 'x');
  pipe(-31.9, 2, -20, 4, 0.12, 'y');
  pipe(31.9, 2, 20, 4, 0.12, 'y');

  function truck(x, z, ry, mat) {
    addBox(x, z, 4.6, 2.2, 1.5, mat, { y: 0.9, ry });
    const cabX = x + Math.cos(ry) * 3;
    const cabZ = z - Math.sin(ry) * 3;
    addBox(cabX, cabZ, 1.8, 2.2, 1.9, mat, { y: 0.95, ry });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.95 });
    for (const [lx, lz] of [[-1.5, -1.1], [1.5, -1.1], [-1.5, 1.1], [1.5, 1.1]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12), wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(
        x + lx * Math.cos(ry) + lz * Math.sin(ry),
        0.45,
        z - lx * Math.sin(ry) + lz * Math.cos(ry),
      );
      wheel.castShadow = true;
      scene.add(wheel);
    }
  }
  truck(-20, -8, 0, oliveMetal);
  truck(-16, 14, Math.PI / 2, rustMetal);

  addBox(8, 2, 3, 0.3, 1.1, crateMat, { ry: 0.5 });
  addBox(-10, 8, 3, 0.3, 1.1, crateMat, { ry: -0.4 });

  function stencil(text, x, y, z, ry, w = 5) {
    const tex = createStencilTexture(text);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w / 4),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
    );
    plane.position.set(x, y, z);
    plane.rotation.y = ry;
    scene.add(plane);
  }
  stencil('A SITE ➔', 16, 1.8, -9.44, 0); // A Main gap, south face
  stencil('B SITE ➔', 15, 1.8, 7.44, Math.PI); // B Main gap, north face
  stencil('MID ➔', -6.56, 1.8, 6, -Math.PI / 2); // mid divider, west face

  function hazardBorder(cx, cz, w, d) {
    const y = 0.02;
    addBox(cx, cz - d / 2, w, 1, 0.04, hazardMat, { y, solid: false, shadow: false });
    addBox(cx, cz + d / 2, w, 1, 0.04, hazardMat, { y, solid: false, shadow: false });
    addBox(cx - w / 2, cz, 1, d, 0.04, hazardMat, { y, solid: false, shadow: false });
    addBox(cx + w / 2, cz, 1, d, 0.04, hazardMat, { y, solid: false, shadow: false });
  }
  hazardBorder(21, -16, 15, 11); // site A
  hazardBorder(20.5, 14.5, 14, 12); // site B

  const sun = new THREE.DirectionalLight(0xffe8c0, 3.4);
  sun.position.set(30, 42, -20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  sun.shadow.camera.near = 5;
  sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a6f4d, 1.15);
  scene.add(hemi);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(140, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x6fa8dc) },
        bottom: { value: new THREE.Color(0xf0c98a) },
      },
      vertexShader: 'varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vPos; uniform vec3 top; uniform vec3 bottom; void main() { float h = normalize(vPos).y * 0.5 + 0.5; gl_FragColor = vec4(mix(bottom, top, smoothstep(0.0, 0.6, h)), 1.0); }',
    }),
  );
  scene.add(sky);
  scene.fog = new THREE.FogExp2(0xd8c49a, 0.0035);
  scene.background = new THREE.Color(0x9fc3e0);

  function beacon(x, z, colorHex) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 4.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.6, metalness: 0.6 }),
    );
    pole.position.set(x, 2.2, z);
    pole.castShadow = true;
    scene.add(pole);
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.25, 0.5),
      new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 2.5,
      }),
    );
    lamp.position.set(x, 4.5, z);
    scene.add(lamp);
    const light = new THREE.PointLight(colorHex, 40, 20, 2);
    light.position.set(x, 4.2, z);
    scene.add(light);
  }
  beacon(21, -16, PALETTE.siteA);
  beacon(20.5, 14.5, PALETTE.siteB);

  const dustCount = 350;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustSpeeds = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = -30 + Math.random() * 60;
    dustPositions[i * 3 + 1] = 0.2 + Math.random() * 5.8;
    dustPositions[i * 3 + 2] = -22 + Math.random() * 44;
    dustSpeeds[i] = 0.08 + Math.random() * 0.22;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({
      color: 0xd8c9a8,
      size: 0.06,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
  );
  scene.add(dust);

  function update(dt) {
    const positions = dust.geometry.attributes.position;
    for (let i = 0; i < dustCount; i++) {
      let y = positions.getY(i) - dustSpeeds[i] * dt;
      if (y < 0.2) y = 6;
      positions.setY(i, y);
    }
    positions.needsUpdate = true;
  }

  return {
    colliders,
    meshes,
    spawnPoints: SPAWN_POINTS,
    waypoints: WAYPOINTS,
    routes: ROUTES,
    bombsites: {
      A: { pos: new THREE.Vector3(21, 0, -16), radius: 6 },
      B: { pos: new THREE.Vector3(20.5, 0, 14.5), radius: 6 },
    },
    dust,
    update,
  };
}
