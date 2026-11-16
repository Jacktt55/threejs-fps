// Weapon state machine: fire / reload / switch, ammo in mag + reserve,
// spread and recoil model. Grenades are items, not guns: firing one throws
// it (the projectile itself lands in a later step). A simple box-built
// viewmodel gun rides on the camera; no external assets.
import * as THREE from 'three';
import { WEAPONS } from './constants.js';

export class Weapon {
  constructor(camera) {
    this.camera = camera;
    this.key = 'ak47';
    this.mag = WEAPONS.ak47.magSize;
    this.reserve = WEAPONS.ak47.reserve;
    this.grenades = { he: 0, flash: 0, smoke: 0 };
    this.reloading = false;
    this.reloadEnd = 0;
    this.lastShot = 0;
    this.recoilPitch = 0;
    this.bloom = 0;
    this.viewmodel = this.buildViewmodel();
    camera.add(this.viewmodel);
  }

  get def() {
    return WEAPONS[this.key];
  }

  buildViewmodel() {
    const group = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.5, metalness: 0.7 });
    const grip = new THREE.MeshStandardMaterial({ color: 0x3a2e1e, roughness: 0.9, metalness: 0 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.55), dark);
    body.position.set(0, -0.02, 0);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), dark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, -0.4);
    const gripMesh = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.09), grip);
    gripMesh.position.set(0, -0.12, 0.12);
    gripMesh.rotation.x = 0.3;
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.1), dark);
    mag.position.set(0, -0.12, -0.05);
    mag.rotation.x = 0.15;
    group.add(body, barrel, gripMesh, mag);
    group.position.set(0.22, -0.2, -0.45);
    return group;
  }

  // Try to fire at time `now` (seconds). Returns null when nothing happens,
  // otherwise { damage, spread, headshot, thrown } for the caller to resolve.
  fire(now, moving) {
    const def = this.def;
    if (this.reloading || now - this.lastShot < def.fireRate) return null;
    if (def.kind === 'grenade') {
      if ((this.grenades[this.key] ?? 0) <= 0) return null;
      this.grenades[this.key] -= 1;
      this.lastShot = now;
      return { thrown: true, damage: def.damage, radius: def.radius };
    }
    if (this.mag <= 0) return null;
    this.lastShot = now;
    this.mag -= 1;
    this.bloom = Math.min(1, this.bloom + 0.25);
    this.recoilPitch += def.recoil;
    const spread = def.spread + this.bloom * def.moveSpread + (moving ? def.moveSpread : 0);
    return { damage: def.damage, headshot: def.headshot, spread };
  }

  startReload(now) {
    const def = this.def;
    if (this.reloading || def.kind === 'grenade') return false;
    if (this.mag >= def.magSize || this.reserve <= 0) return false;
    this.reloading = true;
    this.reloadEnd = now + def.reloadTime;
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
    return true;
  }

  switchTo(key, now) {
    if (!WEAPONS[key] || key === this.key) return false;
    const def = WEAPONS[key];
    this.key = key;
    this.reloading = false;
    if (def.kind === 'grenade') {
      this.mag = 0;
      this.reserve = 0;
    } else {
      this.mag = def.magSize;
      this.reserve = def.reserve;
    }
    this.bloom = 0;
    this.recoilPitch = 0;
    this.lastShot = now;
    return true;
  }

  // Buy one of something: a firearm refills its reserve, a grenade adds one.
  buy(key) {
    const def = WEAPONS[key];
    if (!def) return false;
    if (def.kind === 'grenade') {
      this.grenades[key] = (this.grenades[key] ?? 0) + 1;
      return true;
    }
    if (def.kind === 'armor') return true;
    return true;
  }

  update(dt) {
    // Recoil recovers and bloom settles when not firing.
    this.recoilPitch *= Math.max(0, 1 - dt * 6);
    this.bloom = Math.max(0, this.bloom - dt * 1.4);
    // Gentle viewmodel bob from the recoil value.
    this.viewmodel.position.y = -0.2 + this.recoilPitch * 0.6;
    this.viewmodel.rotation.x = this.recoilPitch * 1.5;
  }
}
