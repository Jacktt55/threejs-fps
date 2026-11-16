import * as THREE from 'three';
import { WEAPONS } from './constants.js';
import { collidesAt, segmentBlocked } from './map.js';

const LOCAL_DEFS = {
  knife: {
    kind: 'melee', name: 'Knife', damage: 40, fireRate: 0.5, range: 2.2,
    spread: 0, moveSpread: 0, recoil: 0, movePenalty: 0,
  },
  c4: {
    kind: 'bomb', name: 'C4 Explosive', damage: 0, fireRate: 1, range: 0,
    spread: 0, moveSpread: 0, recoil: 0, movePenalty: 0,
  },
};

const GRENADE_COLORS = { he: 0x3d4a2a, flash: 0xb8bcc0, smoke: 0x6a6f66 };
const TRACER_COUNT = 12;
const SHELL_COUNT = 16;
const DECAL_COUNT = 24;
const SPARK_BURSTS = 6;
const SPARK_PARTICLES = 12;
const SMOKE_CLOUDS = 2;
const SMOKE_PARTICLES = 48;
const GRENADE_SLOTS = 3;

const MAT = {
  gunmetal: new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.45, metalness: 0.75 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x55595e, roughness: 0.3, metalness: 0.9 }),
  polymer: new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.8, metalness: 0.1 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6b4a26, roughness: 0.85, metalness: 0 }),
  tan: new THREE.MeshStandardMaterial({ color: 0x9a7b4f, roughness: 0.8, metalness: 0.05 }),
  glove: new THREE.MeshStandardMaterial({ color: 0x3a3f2e, roughness: 0.95, metalness: 0 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc8a24a, roughness: 0.35, metalness: 0.9 }),
  blade: new THREE.MeshStandardMaterial({ color: 0xb9c0c6, roughness: 0.2, metalness: 0.95 }),
  c4body: new THREE.MeshStandardMaterial({ color: 0x3d4a2a, roughness: 0.9, metalness: 0 }),
  heGreen: new THREE.MeshStandardMaterial({ color: 0x3d4a2a, roughness: 0.7, metalness: 0.2 }),
  silver: new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.3, metalness: 0.9 }),
  smokeGrey: new THREE.MeshStandardMaterial({ color: 0x6a6f66, roughness: 0.8, metalness: 0.1 }),
};

function makeSmokeTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const SMOKE_TEXTURE = makeSmokeTexture();

function makeSpray(recoil, shots = 10) {
  const pattern = new Float32Array(shots * 2);
  let s = 1234567;
  const next = () => {
    s = (Math.imul(s, 1103515245) + 12345) | 0;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
  for (let i = 0; i < shots; i++) {
    pattern[i * 2] = recoil * (0.7 + 0.45 * Math.abs(next())) * (1 + i * 0.08);
    pattern[i * 2 + 1] = recoil * 0.55 * next() * (i === 0 ? 0.2 : 1);
  }
  return pattern;
}

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function cyl(rTop, rBottom, len, mat, x = 0, y = 0, z = 0, seg = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, len, seg), mat);
  m.position.set(x, y, z);
  return m;
}

function makeHand(rx = 0) {
  const hand = new THREE.Group();
  hand.add(box(0.075, 0.085, 0.1, MAT.glove, 0, 0, 0));
  hand.add(box(0.07, 0.06, 0.06, MAT.glove, 0, -0.01, -0.06));
  hand.add(box(0.02, 0.07, 0.05, MAT.glove, -0.045, 0, 0.02));
  hand.rotation.x = rx;
  return hand;
}

export class Weapon {
  constructor(camera, scene = null, hooks = {}) {
    this.camera = camera;
    this.scene = scene;
    this.hooks = hooks;
    this.colliders = hooks.colliders ?? null;
    this.key = 'ak47';
    this.mag = WEAPONS.ak47.magSize;
    this.reserve = WEAPONS.ak47.reserve;
    this.grenades = { he: 0, flash: 0, smoke: 0 };
    this.armor = false;
    this.reloading = false;
    this.reloadStart = 0;
    this.reloadEnd = 0;
    this.reloadElapsed = 0;
    this.lastShot = 0;
    this.burstCount = 0;
    this._burstStart = -10;
    this.zoomChanged = false;
    this.bloom = 0;
    this.kick = 0;
    this.zoom = 0; // AWP: 0 hip, 1 = 2.5x, 2 = 5x
    this.time = 0;
    this.bobPhase = 0;
    this._tmpA = new THREE.Vector3();
    this._tmpB = new THREE.Vector3();
    this._tmpC = new THREE.Vector3();

    this.sprays = {};
    for (const k of Object.keys(WEAPONS)) {
      if (WEAPONS[k].recoil) this.sprays[k] = makeSpray(WEAPONS[k].recoil);
    }
    this.sprays.knife = makeSpray(0);

    this.groups = {};
    this.parts = {};
    this.muzzles = {};
    this.vmBase = {};
    this.buildAllViewmodels();
    this.activeGroup = this.groups.ak47;
    this.activeGroup.visible = true;
    camera.add(this.activeGroup);

    this.flashLight = new THREE.PointLight(0xffc36b, 0, 9, 2);
    this.flashLife = 0;
    const starMat = new THREE.MeshBasicMaterial({
      color: 0xffd27a, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    this.flashStar = new THREE.Group();
    const starA = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), starMat);
    const starB = starA.clone();
    starB.rotation.z = Math.PI / 2;
    const starCore = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.07), starMat);
    this.flashStar.add(starA, starB, starCore);
    this.flashStarMat = starMat;
    this.flashStar.visible = false;
    this.activeGroup.add(this.flashLight, this.flashStar);
    this.placeFlashAtMuzzle();

    if (scene) {
      this.buildPools(scene);
    } else {
      this.tracers = [];
      this.shells = [];
      this.decals = [];
      this.sparks = [];
      this.grenadeSlots = [];
      this.smokeClouds = [];
      this.explosion = null;
    }
  }

  get def() {
    return WEAPONS[this.key] ?? LOCAL_DEFS[this.key];
  }

  buildAllViewmodels() {
    this.buildRifle('ak47', {
      woodFurniture: true, magCurve: 0.35, barrelLen: 0.34, suppressor: false,
      scope: false, stockLen: 0.16, base: [0.22, -0.2, -0.45],
    });
    this.buildRifle('m4a1', {
      woodFurniture: false, magCurve: 0.08, barrelLen: 0.3, suppressor: true,
      scope: false, stockLen: 0.14, base: [0.22, -0.2, -0.45],
    });
    this.buildRifle('awp', {
      woodFurniture: false, magCurve: 0.1, barrelLen: 0.52, suppressor: false,
      scope: true, stockLen: 0.2, base: [0.22, -0.2, -0.5],
    });
    this.buildRifle('mp5', {
      woodFurniture: false, magCurve: 0.05, barrelLen: 0.2, suppressor: true,
      scope: false, stockLen: 0.1, base: [0.21, -0.19, -0.42],
    });
    this.buildPistol();
    this.buildKnife();
    this.buildC4();
    this.buildGrenadeViewmodel('he');
    this.buildGrenadeViewmodel('flash');
    this.buildGrenadeViewmodel('smoke');
  }

  buildRifle(key, o) {
    const g = new THREE.Group();
    const furniture = o.woodFurniture ? MAT.wood : MAT.polymer;
    const receiver = box(0.085, 0.1, 0.42, MAT.gunmetal, 0, 0, 0);
    const handguard = box(0.08, 0.085, 0.24, furniture, 0, -0.005, -0.3);
    const barrel = cyl(0.018, 0.018, o.barrelLen, MAT.steel, 0, 0.01, -0.42 - o.barrelLen / 2 + 0.1);
    barrel.rotation.x = Math.PI / 2;
    const stock = box(0.07, 0.09, o.stockLen, furniture, 0, 0.01, 0.26 + o.stockLen / 2);
    const grip = box(0.06, 0.14, 0.08, MAT.polymer, 0, -0.11, 0.14);
    grip.rotation.x = 0.35;
    const mag = box(0.055, 0.17, 0.09, o.woodFurniture ? MAT.wood : MAT.steel, 0, -0.12, -0.04);
    mag.rotation.x = o.magCurve;
    const frontSight = box(0.012, 0.05, 0.012, MAT.steel, 0, 0.07, -0.4);
    const rearSight = box(0.05, 0.03, 0.02, MAT.steel, 0, 0.06, 0.1);
    g.add(receiver, handguard, barrel, stock, grip, mag, frontSight, rearSight);
    if (o.suppressor) {
      const sup = cyl(0.026, 0.026, 0.16, MAT.gunmetal, 0, 0.01, -0.42 - o.barrelLen + 0.02);
      sup.rotation.x = Math.PI / 2;
      g.add(sup);
    }
    if (o.scope) {
      const rail = box(0.04, 0.02, 0.4, MAT.steel, 0, 0.06, -0.02);
      const tube = cyl(0.03, 0.03, 0.3, MAT.gunmetal, 0, 0.1, -0.05);
      tube.rotation.x = Math.PI / 2;
      const lens = new THREE.Mesh(
        new THREE.CircleGeometry(0.026, 12),
        new THREE.MeshBasicMaterial({ color: 0x9fd4ff }),
      );
      lens.position.set(0, 0.1, -0.2);
      lens.rotation.y = Math.PI;
      g.add(rail, tube, lens);
    }
    const triggerHand = makeHand(0.35);
    triggerHand.position.set(0, -0.1, 0.14);
    const foreHand = makeHand(-0.5);
    foreHand.position.set(0, -0.075, -0.3);
    g.add(triggerHand, foreHand);
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.01, -0.42 - o.barrelLen + (o.suppressor ? -0.08 : 0));
    g.add(muzzle);
    g.position.set(...o.base);
    g.visible = false;
    this.camera.add(g);
    this.groups[key] = g;
    this.parts[key] = { mag, magBaseY: -0.12, magBaseRot: o.magCurve };
    this.muzzles[key] = muzzle;
    this.vmBase[key] = o.base;
  }

  buildPistol() {
    const g = new THREE.Group();
    const slide = box(0.07, 0.06, 0.26, MAT.steel, 0, 0.01, -0.02);
    const frame = box(0.06, 0.06, 0.24, MAT.gunmetal, 0, -0.04, 0);
    const barrel = cyl(0.016, 0.016, 0.08, MAT.steel, 0, 0.01, -0.18);
    barrel.rotation.x = Math.PI / 2;
    const grip = box(0.055, 0.13, 0.07, MAT.polymer, 0, -0.1, 0.09);
    grip.rotation.x = 0.25;
    const hammer = box(0.02, 0.03, 0.02, MAT.steel, 0, 0.05, 0.12);
    for (let i = 0; i < 3; i++) {
      g.add(box(0.072, 0.012, 0.015, MAT.gunmetal, 0, 0.02, 0.06 + i * 0.02));
    }
    const triggerHand = makeHand(0.25);
    triggerHand.position.set(0, -0.09, 0.09);
    const foreHand = makeHand(-0.4);
    foreHand.position.set(0.02, -0.06, -0.08);
    g.add(slide, frame, barrel, grip, hammer, triggerHand, foreHand);
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.01, -0.22);
    g.add(muzzle);
    g.position.set(0.21, -0.19, -0.4);
    g.visible = false;
    this.camera.add(g);
    this.groups.deagle = g;
    this.parts.deagle = { mag: grip, magBaseY: -0.1, magBaseRot: 0.25 };
    this.muzzles.deagle = muzzle;
    this.vmBase.deagle = [0.21, -0.19, -0.4];
  }

  buildKnife() {
    const g = new THREE.Group();
    const handle = box(0.045, 0.05, 0.16, MAT.polymer, 0, 0, 0.08);
    const guard = box(0.06, 0.015, 0.02, MAT.steel, 0, 0, -0.01);
    const blade = box(0.008, 0.045, 0.24, MAT.blade, 0, 0.005, -0.14);
    const tip = box(0.008, 0.04, 0.06, MAT.blade, 0, 0.002, -0.28);
    tip.rotation.y = 0.35;
    const hand = makeHand(0.15);
    hand.position.set(0, -0.02, 0.08);
    g.add(handle, guard, blade, tip, hand);
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0, -0.3);
    g.add(muzzle);
    g.position.set(0.2, -0.22, -0.35);
    g.visible = false;
    this.camera.add(g);
    this.groups.knife = g;
    this.parts.knife = {};
    this.muzzles.knife = muzzle;
    this.vmBase.knife = [0.2, -0.22, -0.35];
  }

  buildC4() {
    const g = new THREE.Group();
    const brick = box(0.16, 0.1, 0.06, MAT.c4body, 0, 0, 0);
    const tape = box(0.165, 0.03, 0.065, MAT.tan, 0, 0, 0);
    const wire = cyl(0.006, 0.006, 0.14, new THREE.MeshStandardMaterial({ color: 0xb03a2e, roughness: 0.6 }), 0.05, 0.05, 0);
    wire.rotation.z = Math.PI / 2;
    const ledMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2211, emissiveIntensity: 2.5 });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), ledMat);
    led.position.set(-0.05, 0.055, 0);
    const hand = makeHand(0.1);
    hand.position.set(0, -0.09, 0.02);
    g.add(brick, tape, wire, led, hand);
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0, -0.1);
    g.add(muzzle);
    g.position.set(0.18, -0.2, -0.4);
    g.visible = false;
    this.camera.add(g);
    this.groups.c4 = g;
    this.parts.c4 = { led, ledMat };
    this.muzzles.c4 = muzzle;
    this.vmBase.c4 = [0.18, -0.2, -0.4];
  }

  buildGrenadeViewmodel(key) {
    const g = new THREE.Group();
    if (key === 'he') {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), MAT.heGreen);
      const lever = box(0.015, 0.02, 0.09, MAT.steel, 0.05, 0.02, 0);
      lever.rotation.z = -0.2;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 6, 12), MAT.steel);
      ring.position.set(0, 0.06, 0.03);
      g.add(body, lever, ring);
    } else if (key === 'flash') {
      const body = cyl(0.04, 0.04, 0.11, MAT.silver, 0, 0, 0);
      const cap = cyl(0.042, 0.042, 0.02, MAT.gunmetal, 0, 0.06, 0);
      const lever = box(0.012, 0.02, 0.08, MAT.steel, 0.04, 0.03, 0);
      g.add(body, cap, lever);
    } else {
      const body = cyl(0.045, 0.045, 0.12, MAT.smokeGrey, 0, 0, 0);
      const band = cyl(0.047, 0.047, 0.03, new THREE.MeshStandardMaterial({ color: 0xc8a165, roughness: 0.7 }), 0, 0.02, 0);
      const cap = cyl(0.047, 0.047, 0.02, MAT.gunmetal, 0, 0.065, 0);
      g.add(body, band, cap);
    }
    const hand = makeHand(0.3);
    hand.position.set(0, -0.08, 0);
    g.add(hand);
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0, -0.1);
    g.add(muzzle);
    g.position.set(0.2, -0.22, -0.4);
    g.visible = false;
    this.camera.add(g);
    this.groups[key] = g;
    this.parts[key] = {};
    this.muzzles[key] = muzzle;
    this.vmBase[key] = [0.2, -0.22, -0.4];
  }

  placeFlashAtMuzzle() {
    const muzzle = this.muzzles[this.key];
    if (!muzzle) return;
    const p = muzzle.position;
    this.flashLight.position.copy(p);
    this.flashStar.position.copy(p);
    if (this.flashLight.parent !== this.activeGroup) {
      this.activeGroup.add(this.flashLight, this.flashStar);
    }
  }

  buildPools(scene) {
    this.tracers = [];
    for (let i = 0; i < TRACER_COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffe9a8, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 1), mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.tracers.push({ mesh, mat, life: 0, maxLife: 0.09 });
    }
    this._tracerIdx = 0;

    this.shells = [];
    for (let i = 0; i < SHELL_COUNT; i++) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.045), MAT.brass);
      mesh.visible = false;
      scene.add(mesh);
      this.shells.push({ mesh, vel: new THREE.Vector3(), ang: new THREE.Vector3(), life: 0 });
    }
    this._shellIdx = 0;

    this.decals = [];
    for (let i = 0; i < DECAL_COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x0a0a0a, transparent: true, opacity: 0, depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.09, 10), mat);
      mesh.visible = false;
      scene.add(mesh);
      this.decals.push({ mesh, mat, life: 0 });
    }
    this._decalIdx = 0;

    this.sparks = [];
    for (let i = 0; i < SPARK_BURSTS; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARK_PARTICLES * 3), 3));
      const mat = new THREE.PointsMaterial({
        color: 0xffc36b, size: 0.07, transparent: true, opacity: 0, depthWrite: false,
      });
      const points = new THREE.Points(geo, mat);
      points.visible = false;
      points.frustumCulled = false;
      scene.add(points);
      this.sparks.push({ points, mat, vel: new Float32Array(SPARK_PARTICLES * 3), life: 0 });
    }
    this._sparkIdx = 0;

    this.explosion = {
      mesh: new THREE.Mesh(
        new THREE.SphereGeometry(1, 16, 12),
        new THREE.MeshBasicMaterial({
          color: 0xffa040, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      ),
      light: new THREE.PointLight(0xff8030, 0, 20, 2),
      life: 0,
    };
    this.explosion.mesh.visible = false;
    scene.add(this.explosion.mesh, this.explosion.light);

    this.smokeClouds = [];
    for (let i = 0; i < SMOKE_CLOUDS; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SMOKE_PARTICLES * 3), 3));
      const mat = new THREE.PointsMaterial({
        color: 0xcfc8bd, size: 2.4, map: SMOKE_TEXTURE, transparent: true,
        opacity: 0, depthWrite: false, sizeAttenuation: true,
      });
      const points = new THREE.Points(geo, mat);
      points.visible = false;
      points.frustumCulled = false;
      scene.add(points);
      this.smokeClouds.push({
        points, mat,
        vel: new Float32Array(SMOKE_PARTICLES * 3),
        life: 0, maxLife: 15,
      });
    }
    this._smokeIdx = 0;

    this.grenadeSlots = [];
    for (let i = 0; i < GRENADE_SLOTS; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x3d4a2a, roughness: 0.7 }),
      );
      mesh.visible = false;
      mesh.castShadow = true;
      scene.add(mesh);
      this.grenadeSlots.push({
        mesh, active: false, type: 'he', vel: new THREE.Vector3(),
        fuse: 0, bounces: 0,
      });
    }
  }

  fire(now, moving = false, airborne = false, crouching = false) {
    const def = this.def;
    if (this.reloading || now - this.lastShot < def.fireRate) return null;
    if (def.kind === 'grenade') {
      if ((this.grenades[this.key] ?? 0) <= 0) return { dry: true };
      this.grenades[this.key] -= 1;
      this.lastShot = now;
      this.throwGrenade(this.key);
      return { thrown: true, type: this.key, damage: def.damage, radius: def.radius };
    }
    if (def.kind === 'bomb') {
      this.lastShot = now;
      return { plant: true };
    }
    if (def.kind === 'melee') {
      this.lastShot = now;
      this.kick = 1;
      return { melee: true, damage: def.damage, range: def.range, spread: 0 };
    }
    if (this.mag <= 0) return { dry: true };
    this.lastShot = now;
    this.mag -= 1;
    this.bloom = Math.min(1, this.bloom + 0.25);
    this.kick = 1;
    this.triggerMuzzleFlash();
    this.ejectShell();
    if (this.key === 'awp' && this.zoom > 0) {
      this.zoom = 0;
      this.zoomChanged = true;
    }
    if (now - this._burstStart > 0.45) this.burstCount = 0;
    if (this.burstCount === 0) this._burstStart = now;
    const spray = this.sprays[this.key] ?? this.sprays.ak47;
    const idx = (this.burstCount % 10) * 2;
    this.burstCount += 1;
    let spread = def.spread + this.bloom * def.moveSpread + (moving ? def.moveSpread : 0);
    if (airborne) spread += 0.05;
    if (crouching) spread *= 0.8;
    if (this.zoom > 0) spread *= 0.15; // scoped AWP is laser-steady
    return {
      damage: def.damage,
      headshot: def.headshot,
      spread,
      recoilKick: { pitch: spray[idx], yaw: spray[idx + 1] },
    };
  }

  startReload(now) {
    const def = this.def;
    if (this.reloading || def.kind === 'grenade' || def.kind === 'melee' || def.kind === 'bomb') return false;
    if (this.mag >= def.magSize || this.reserve <= 0) return false;
    this.reloading = true;
    this.reloadStart = now;
    this.reloadEnd = now + def.reloadTime;
    this.reloadElapsed = 0;
    this.zoom = 0;
    return true;
  }

  finishReload(now) {
    if (!this.reloading || now < this.reloadEnd) return false;
    const def = this.def;
    const need = def.magSize - this.mag;
    const take = Math.min(need, this.reserve);
    this.mag += take;
    this.reserve -= take;
    this.reloading = false;
    this.resetMagTransform();
    return true;
  }

  switchTo(key, now) {
    if ((!WEAPONS[key] && !LOCAL_DEFS[key]) || key === this.key) return false;
    if (this.activeGroup) this.activeGroup.visible = false;
    this.key = key;
    this.reloading = false;
    this.resetMagTransform();
    const def = this.def;
    if (def.kind === 'grenade') {
      this.mag = 0;
      this.reserve = 0;
    } else if (def.kind === 'melee' || def.kind === 'bomb') {
      this.mag = 0;
      this.reserve = 0;
    } else {
      this.mag = def.magSize;
      this.reserve = def.reserve;
    }
    this.bloom = 0;
    this.kick = 0;
    this.burstCount = 0;
    this.zoom = 0;
    this.zoomChanged = true;
    this.lastShot = now;
    this.activeGroup = this.groups[key];
    this.activeGroup.visible = true;
    this.placeFlashAtMuzzle();
    return true;
  }

  buy(key) {
    const def = WEAPONS[key];
    if (!def) return false;
    if (def.kind === 'grenade') {
      if ((this.grenades[key] ?? 0) >= 2) return false;
      this.grenades[key] = (this.grenades[key] ?? 0) + 1;
      return true;
    }
    if (def.kind === 'armor') {
      this.armor = true;
      return true;
    }
    this.reserve = def.reserve;
    return true;
  }

  ammoForHud() {
    if (this.def.kind === 'grenade') return { mag: this.grenades[this.key] ?? 0, reserve: 0 };
    return { mag: this.mag, reserve: this.reserve };
  }

  cycleZoom() {
    if (this.key !== 'awp' || this.reloading) return this.zoom;
    this.zoom = (this.zoom + 1) % 3;
    this.zoomChanged = true;
    return this.zoom;
  }

  currentFov() {
    return this.zoom === 1 ? 30 : this.zoom === 2 ? 15 : 74;
  }

  triggerMuzzleFlash() {
    this.flashLife = 0.06;
    this.flashLight.intensity = 30;
    this.flashStar.visible = true;
    this.flashStar.rotation.z = Math.random() * Math.PI;
    const s = 0.8 + Math.random() * 0.5;
    this.flashStar.scale.set(s, s, s);
    this.flashStarMat.opacity = 1;
  }

  getMuzzleWorldPosition(out) {
    const muzzle = this.muzzles[this.key];
    if (!muzzle) return out.copy(this.camera.position);
    return muzzle.getWorldPosition(out);
  }

  spawnTracer(from, to) {
    if (!this.tracers.length) return;
    const t = this.tracers[this._tracerIdx];
    this._tracerIdx = (this._tracerIdx + 1) % this.tracers.length;
    this._tmpA.addVectors(from, to).multiplyScalar(0.5);
    t.mesh.position.copy(this._tmpA);
    t.mesh.lookAt(to);
    this._tmpB.subVectors(to, from);
    const len = this._tmpB.length();
    t.mesh.scale.set(1, 1, Math.max(0.1, len));
    t.mesh.visible = true;
    t.life = t.maxLife;
    t.mat.opacity = 0.9;
  }

  ejectShell() {
    if (!this.shells.length) return;
    const s = this.shells[this._shellIdx];
    this._shellIdx = (this._shellIdx + 1) % this.shells.length;
    this.camera.getWorldDirection(this._tmpA);
    const right = this._tmpB.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    s.mesh.position.copy(this.camera.position)
      .addScaledVector(right, 0.18)
      .addScaledVector(this._tmpA, 0.25);
    s.mesh.position.y -= 0.08;
    s.vel.copy(right).multiplyScalar(1.4 + Math.random() * 0.8);
    s.vel.y = 1.8 + Math.random() * 0.8;
    s.vel.addScaledVector(this._tmpA, -0.4);
    s.ang.set(Math.random() * 12, Math.random() * 12, Math.random() * 12);
    s.mesh.visible = true;
    s.life = 1.4;
  }

  spawnDecal(point, normal) {
    if (!this.decals.length) return;
    const d = this.decals[this._decalIdx];
    this._decalIdx = (this._decalIdx + 1) % this.decals.length;
    this._tmpA.copy(point).addScaledVector(normal, 0.012);
    d.mesh.position.copy(this._tmpA);
    this._tmpB.copy(point).add(normal);
    d.mesh.lookAt(this._tmpB);
    d.mesh.rotateZ(Math.random() * Math.PI * 2);
    d.mesh.visible = true;
    d.life = 25;
    d.mat.opacity = 0.85;
  }

  spawnSparks(point) {
    if (!this.sparks.length) return;
    const b = this.sparks[this._sparkIdx];
    this._sparkIdx = (this._sparkIdx + 1) % this.sparks.length;
    const pos = b.points.geometry.attributes.position;
    for (let i = 0; i < SPARK_PARTICLES; i++) {
      pos.setXYZ(i, point.x, point.y, point.z);
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 3 + 1;
      const sp = 1.5 + Math.random() * 3;
      b.vel[i * 3] = Math.cos(a) * sp;
      b.vel[i * 3 + 1] = up;
      b.vel[i * 3 + 2] = Math.sin(a) * sp;
    }
    pos.needsUpdate = true;
    b.points.visible = true;
    b.life = 0.35;
    b.mat.opacity = 1;
  }

  showExplosion(pos) {
    if (!this.explosion) return;
    this.explosion.mesh.position.copy(pos);
    this.explosion.mesh.scale.setScalar(0.4);
    this.explosion.mesh.visible = true;
    this.explosion.mesh.material.opacity = 0.9;
    this.explosion.light.position.copy(pos);
    this.explosion.light.position.y += 0.6;
    this.explosion.light.intensity = 140;
    this.explosion.life = 0.5;
  }

  spawnSmoke(pos) {
    if (!this.smokeClouds.length) return;
    const c = this.smokeClouds[this._smokeIdx];
    this._smokeIdx = (this._smokeIdx + 1) % this.smokeClouds.length;
    const attr = c.points.geometry.attributes.position;
    for (let i = 0; i < SMOKE_PARTICLES; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.7;
      attr.setXYZ(i, pos.x + Math.cos(a) * r, pos.y + 0.2 + Math.random() * 0.8, pos.z + Math.sin(a) * r);
      c.vel[i * 3] = Math.cos(a) * (0.25 + Math.random() * 0.5);
      c.vel[i * 3 + 1] = 0.12 + Math.random() * 0.25;
      c.vel[i * 3 + 2] = Math.sin(a) * (0.25 + Math.random() * 0.5);
    }
    attr.needsUpdate = true;
    c.points.visible = true;
    c.life = c.maxLife;
    c.mat.opacity = 0;
  }

  throwGrenade(type) {
    if (!this.grenadeSlots.length) return;
    let slot = this.grenadeSlots.find((s) => !s.active);
    if (!slot) slot = this.grenadeSlots[0];
    this.camera.getWorldDirection(this._tmpA);
    slot.mesh.position.copy(this.camera.position).addScaledVector(this._tmpA, 0.5);
    slot.mesh.position.y -= 0.08;
    slot.mesh.material.color.setHex(GRENADE_COLORS[type] ?? 0x3d4a2a);
    slot.vel.copy(this._tmpA).multiplyScalar(15);
    slot.vel.y += 4.5;
    slot.type = type;
    slot.fuse = WEAPONS[type].fuse;
    slot.bounces = 0;
    slot.active = true;
    slot.mesh.visible = true;
  }

  detonate(slot) {
    slot.active = false;
    slot.mesh.visible = false;
    const pos = slot.mesh.position;
    const def = WEAPONS[slot.type];
    if (slot.type === 'he') {
      this.showExplosion(pos);
      this.hooks.onExplosion?.(pos.clone(), def.radius, def.damage, 'he');
    } else if (slot.type === 'flash') {
      const eye = this.camera.position;
      this._tmpA.subVectors(pos, eye);
      const dist = this._tmpA.length();
      let strength = Math.max(0, Math.min(1, 1.25 - dist / 12));
      this.camera.getWorldDirection(this._tmpB);
      const dot = this._tmpB.dot(this._tmpA.normalize());
      if (dot < 0) strength *= 0.2;
      else if (dot < 0.5) strength *= 0.55;
      if (this.colliders && segmentBlocked(pos, eye, this.colliders)) strength *= 0.15;
      this.hooks.onFlash?.(strength);
    } else {
      this.spawnSmoke(pos);
      this.hooks.onSmoke?.(pos.clone());
    }
  }

  resetMagTransform() {
    const parts = this.parts[this.key];
    if (!parts || !parts.mag) return;
    parts.mag.position.y = parts.magBaseY;
    parts.mag.rotation.x = parts.magBaseRot;
    parts.mag.visible = true;
  }

  update(dt, state = {}) {
    this.time += dt;
    const speed = state.speed ?? 0;
    const sprinting = state.sprinting ?? false;
    const onGround = state.onGround ?? true;

    this.kick *= Math.max(0, 1 - dt * 7);
    this.bloom = Math.max(0, this.bloom - dt * 1.4);

    const g = this.activeGroup;
    const base = this.vmBase[this.key] ?? [0.22, -0.2, -0.45];
    if (onGround && speed > 0.05) this.bobPhase += dt * (5 + speed * 9);
    const bobX = Math.sin(this.bobPhase) * 0.007 * speed;
    const bobY = Math.abs(Math.cos(this.bobPhase)) * 0.009 * speed;
    let dip = 0;
    let dipY = 0;
    if (this.reloading) {
      this.reloadElapsed += dt;
      const def = this.def;
      const t = Math.min(1, this.reloadElapsed / def.reloadTime);
      dip = Math.sin(t * Math.PI) * 0.28;
      dipY = Math.sin(t * Math.PI) * 0.05;
      const parts = this.parts[this.key];
      if (parts && parts.mag) {
        if (t < 0.35) {
          const k = t / 0.35;
          parts.mag.position.y = parts.magBaseY - k * 0.22;
          parts.mag.rotation.x = parts.magBaseRot + k * 0.55;
          parts.mag.visible = true;
        } else if (t < 0.65) {
          parts.mag.visible = false;
        } else {
          const k = (t - 0.65) / 0.35;
          parts.mag.visible = true;
          parts.mag.position.y = parts.magBaseY - 0.22 + k * 0.22;
          parts.mag.rotation.x = parts.magBaseRot + (1 - k) * 0.55;
        }
      }
    }
    g.position.set(
      base[0] + bobX,
      base[1] + bobY - dipY + this.kick * 0.012,
      base[2] + this.kick * 0.05,
    );
    g.rotation.x = this.kick * 0.13 + dip;
    const targetTilt = sprinting ? -0.14 : 0;
    g.rotation.z += (targetTilt - g.rotation.z) * Math.min(1, dt * 10);

    if (this.key === 'c4' && this.parts.c4) {
      this.parts.c4.ledMat.emissiveIntensity = Math.sin(this.time * 6) > 0 ? 2.5 : 0.15;
    }

    if (this.flashLife > 0) {
      this.flashLife -= dt;
      const k = Math.max(0, this.flashLife / 0.06);
      this.flashLight.intensity = 30 * k;
      this.flashStarMat.opacity = k;
      if (this.flashLife <= 0) {
        this.flashLight.intensity = 0;
        this.flashStar.visible = false;
      }
    }

    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.mat.opacity = Math.max(0, 0.9 * (t.life / t.maxLife));
      if (t.life <= 0) t.mesh.visible = false;
    }
    for (const s of this.shells) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.vel.y -= 9.8 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.rotation.x += s.ang.x * dt;
      s.mesh.rotation.y += s.ang.y * dt;
      s.mesh.rotation.z += s.ang.z * dt;
      if (s.mesh.position.y < 0.02) {
        s.mesh.position.y = 0.02;
        s.vel.y *= -0.35;
        s.vel.x *= 0.6;
        s.vel.z *= 0.6;
      }
      if (s.life <= 0) s.mesh.visible = false;
    }
    for (const d of this.decals) {
      if (d.life <= 0) continue;
      d.life -= dt;
      d.mat.opacity = d.life < 5 ? 0.85 * Math.max(0, d.life / 5) : 0.85;
      if (d.life <= 0) d.mesh.visible = false;
    }
    for (const b of this.sparks) {
      if (b.life <= 0) continue;
      b.life -= dt;
      const pos = b.points.geometry.attributes.position;
      for (let i = 0; i < SPARK_PARTICLES; i++) {
        b.vel[i * 3 + 1] -= 12 * dt;
        pos.setXYZ(
          i,
          pos.getX(i) + b.vel[i * 3] * dt,
          Math.max(0.01, pos.getY(i) + b.vel[i * 3 + 1] * dt),
          pos.getZ(i) + b.vel[i * 3 + 2] * dt,
        );
      }
      pos.needsUpdate = true;
      b.mat.opacity = Math.max(0, b.life / 0.35);
      if (b.life <= 0) b.points.visible = false;
    }

    if (this.explosion && this.explosion.life > 0) {
      this.explosion.life -= dt;
      const t = Math.max(0, this.explosion.life / 0.5);
      this.explosion.mesh.scale.setScalar(0.4 + (1 - t) * 7);
      this.explosion.mesh.material.opacity = 0.9 * t;
      this.explosion.light.intensity = 140 * t;
      if (this.explosion.life <= 0) {
        this.explosion.mesh.visible = false;
        this.explosion.light.intensity = 0;
      }
    }

    for (const c of this.smokeClouds) {
      if (c.life <= 0) continue;
      c.life -= dt;
      const age = c.maxLife - c.life;
      const attr = c.points.geometry.attributes.position;
      for (let i = 0; i < SMOKE_PARTICLES; i++) {
        attr.setXYZ(
          i,
          attr.getX(i) + c.vel[i * 3] * dt,
          Math.min(4, attr.getY(i) + c.vel[i * 3 + 1] * dt),
          attr.getZ(i) + c.vel[i * 3 + 2] * dt,
        );
        c.vel[i * 3] *= 1 - dt * 0.12;
        c.vel[i * 3 + 2] *= 1 - dt * 0.12;
      }
      attr.needsUpdate = true;
      const fadeIn = Math.min(1, age / 1);
      const fadeOut = Math.min(1, c.life / 3);
      c.mat.opacity = 0.55 * fadeIn * fadeOut;
      if (c.life <= 0) c.points.visible = false;
    }

    for (const slot of this.grenadeSlots) {
      if (!slot.active) continue;
      slot.vel.y -= 18 * dt;
      const p = slot.mesh.position;
      let nx = p.x + slot.vel.x * dt;
      let nz = p.z + slot.vel.z * dt;
      if (this.colliders) {
        if (collidesAt(this.colliders, nx, p.z, 0.12, p.y)) {
          slot.vel.x *= -0.4;
          nx = p.x;
        }
        if (collidesAt(this.colliders, p.x, nz, 0.12, p.y)) {
          slot.vel.z *= -0.4;
          nz = p.z;
        }
      }
      let ny = p.y + slot.vel.y * dt;
      if (ny < 0.12) {
        ny = 0.12;
        if (Math.abs(slot.vel.y) > 1.4 && slot.bounces < 3) {
          slot.bounces += 1;
          this.hooks.onBounce?.();
        }
        slot.vel.y *= -0.45;
        slot.vel.x *= 0.7;
        slot.vel.z *= 0.7;
      }
      p.set(nx, ny, nz);
      slot.mesh.rotation.x += dt * 6;
      slot.mesh.rotation.z += dt * 4;
      slot.fuse -= dt;
      if (slot.fuse <= 0) this.detonate(slot);
    }
  }
}
