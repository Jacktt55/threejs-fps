import * as THREE from 'three';
import { WAYPOINTS, ROUTES, BOT, HIT_ZONES, BOMB, TEAMS, WEAPONS } from './constants.js';
import { segmentBlocked } from './map.js';

const KIT = {};
for (const team of ['ct', 't']) {
  const c = TEAMS[team];
  KIT[team] = {
    suit: new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.85, metalness: 0.05 }),
    vest: new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.7, metalness: 0.2, emissive: c.accent, emissiveIntensity: 0.35 }),
    accent: new THREE.MeshStandardMaterial({ color: c.accent, roughness: 0.7 }),
  };
}
const SKIN = new THREE.MeshStandardMaterial({ color: 0xc9a586, roughness: 0.8 });
const HELMET = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.55, metalness: 0.3 });
const VISOR = new THREE.MeshStandardMaterial({ color: 0x0a0f14, roughness: 0.15, metalness: 0.9 });
const GUNMETAL = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.45, metalness: 0.75 });

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

const _eye = new THREE.Vector3();
const _tgt = new THREE.Vector3();
const _muzzle = new THREE.Vector3();

export const BOT_STATES = {
  PATROL: 'patrol',
  ENGAGE: 'engage',
  STRAFE_COVER: 'strafe',
  PLANT_BOMB: 'plant',
  DEFUSE_BOMB: 'defuse',
  ROTATE: 'rotate',
};

export class Bot {
  constructor(scene, { team = 'ct', name = 'Bot', route = 'ctA', weapon = 'ak47', speed = BOT.walkSpeed } = {}) {
    this.team = team;
    this.name = name;
    this.routeKey = route;
    this.route = ROUTES[route] ?? ['ctSpawn', 'mid', 'ctSpawn'];
    this.weaponKey = weapon;
    this.weapon = WEAPONS[weapon] ?? WEAPONS.ak47;
    this.speed = speed;
    this.health = 100;
    this.alive = true;
    this.kills = 0;
    this.deaths = 0;
    this.state = BOT_STATES.PATROL;
    this.routeIndex = 0;
    this.holdTimer = 0;
    this.loseSightTimer = 0;
    this.reactionTimer = 0;
    this.burstLeft = 0;
    this.burstPause = 0;
    this.lastShot = 0;
    this.strafeDir = 1;
    this.strafeTimer = 0;
    this.rotateTimer = 0;
    this.target = null;
    this.targetPos = new THREE.Vector3();
    this.plantProgress = 0;
    this.defuseProgress = 0;
    this.carrier = false;
    this.yaw = 0;
    this.walkPhase = Math.random() * Math.PI * 2;
    this.deathTimer = 0;

    this.group = new THREE.Group();
    const kit = KIT[team];
    this.legL = new THREE.Group();
    this.legL.position.set(-0.12, 0.95, 0);
    this.legL.add(box(0.15, 0.42, 0.16, kit.suit, 0, -0.2, 0));
    this.legL.add(box(0.13, 0.42, 0.14, HELMET, 0, -0.62, 0));
    this.legR = new THREE.Group();
    this.legR.position.set(0.12, 0.95, 0);
    this.legR.add(box(0.15, 0.42, 0.16, kit.suit, 0, -0.2, 0));
    this.legR.add(box(0.13, 0.42, 0.14, HELMET, 0, -0.62, 0));
    this.torso = box(0.52, 0.62, 0.3, kit.suit, 0, 1.26, 0);
    const vest = box(0.54, 0.42, 0.08, kit.vest, 0, 1.28, 0.15);
    const padL = box(0.16, 0.08, 0.3, kit.accent, -0.26, 1.56, 0);
    const padR = box(0.16, 0.08, 0.3, kit.accent, 0.26, 1.56, 0);
    this.head = new THREE.Group();
    this.head.position.set(0, 1.66, 0);
    this.headMesh = box(0.32, 0.3, 0.32, HELMET, 0, 0.06, 0);
    const visor = box(0.26, 0.1, 0.04, VISOR, 0, 0.05, 0.16);
    const jaw = box(0.24, 0.12, 0.26, SKIN, 0, -0.1, 0.01);
    this.head.add(this.headMesh, visor, jaw);
    this.armL = new THREE.Group();
    this.armL.position.set(-0.31, 1.52, 0);
    this.armL.add(box(0.12, 0.58, 0.13, kit.suit, 0, -0.28, 0));
    this.armR = new THREE.Group();
    this.armR.position.set(0.31, 1.52, 0);
    this.armR.add(box(0.12, 0.58, 0.13, kit.suit, 0, -0.28, 0));
    this.gun = new THREE.Group();
    this.gun.add(box(0.07, 0.09, 0.42, GUNMETAL, 0, 0, 0));
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 8), GUNMETAL);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.01, -0.32);
    this.gun.add(barrel);
    this.gun.add(box(0.05, 0.16, 0.08, GUNMETAL, 0, -0.11, -0.02));
    this.gun.position.set(0.16, 1.28, 0.32);
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0, 0.01, -0.5);
    this.gun.add(this.muzzle);

    this.group.add(this.legL, this.legR, this.torso, vest, padL, padR, this.head, this.armL, this.armR, this.gun);
    scene.add(this.group);

    const tag = (mesh, part) => { mesh.userData = { bot: this, part }; return mesh; };
    this.headMesh = tag(this.headMesh, 'head');
    this.torso = tag(this.torso, 'torso');
    tag(vest, 'torso');
    for (const limb of [...this.legL.children, ...this.legR.children, ...this.armL.children, ...this.armR.children]) tag(limb, 'limb');
    this.hitMeshes = [this.headMesh, this.torso, vest, ...this.legL.children, ...this.legR.children, ...this.armL.children, ...this.armR.children];
  }

  get position() {
    return this.group.position;
  }

  spawnAt(x, z, yaw = 0) {
    this.group.position.set(x, 0, z);
    this.group.rotation.set(0, yaw, 0);
    this.yaw = yaw;
    this.health = 100;
    this.alive = true;
    this.state = BOT_STATES.PATROL;
    this.routeIndex = 0;
    this.holdTimer = 0;
    this.loseSightTimer = 0;
    this.reactionTimer = 0;
    this.burstLeft = 0;
    this.plantProgress = 0;
    this.defuseProgress = 0;
    this.deathTimer = 0;
    this.walkPhase = 0;
    this.group.visible = true;
  }

  takeDamage(amount) {
    if (!this.alive) return false;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.deaths += 1;
      this.state = BOT_STATES.PATROL;
      this.deathTimer = 0;
      return true;
    }
    return false;
  }

  canSee(pos, colliders) {
    if (!this.alive) return false;
    const dx = pos.x - this.position.x;
    const dz = pos.z - this.position.z;
    if (dx * dx + dz * dz > BOT.sightRange * BOT.sightRange) return false;
    _eye.set(this.position.x, 1.6, this.position.z);
    _tgt.copy(pos);
    return !segmentBlocked(_eye, _tgt, colliders);
  }

  nearestVisibleEnemy(enemies, colliders) {
    let best = null;
    let bestD = Infinity;
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.pos.x - this.position.x;
      const dz = e.pos.z - this.position.z;
      const d = dx * dx + dz * dz;
      if (d >= bestD) continue;
      if (!this.canSee(e.pos, colliders)) continue;
      best = e;
      bestD = d;
    }
    return best;
  }

  muzzleWorld(out) {
    return this.muzzle.getWorldPosition(out ?? _muzzle);
  }

  update(dt, ctx) {
    if (!this.alive) {
      this.deathTimer += dt;
      const k = Math.min(1, this.deathTimer / 0.45);
      this.group.rotation.x = -Math.PI / 2 * k;
      if (this.deathTimer > 1.4) this.group.position.y = -Math.min(0.6, (this.deathTimer - 1.4) * 0.5);
      if (this.deathTimer > 2.6) this.group.visible = false;
      return;
    }

    const bomb = ctx.bomb;
    const planted = bomb && bomb.state === 'planted';
    if (planted && this.team === 'ct' && this.state !== BOT_STATES.DEFUSE_BOMB) {
      this.state = BOT_STATES.DEFUSE_BOMB;
      this.defuseProgress = 0;
    } else if (planted && this.team === 't' && this.state !== BOT_STATES.STRAFE_COVER) {
      this.state = BOT_STATES.STRAFE_COVER;
    }

    const enemy = this.nearestVisibleEnemy(ctx.enemies, ctx.colliders);
    if (enemy) {
      if (this.target !== enemy.ref) {
        this.target = enemy.ref;
        this.reactionTimer = BOT.reactionMin + Math.random() * (BOT.reactionMax - BOT.reactionMin);
        this.burstLeft = 0;
      }
      this.targetPos.copy(enemy.pos);
      this.loseSightTimer = 0;
    } else if (this.target) {
      this.loseSightTimer += dt;
      if (this.loseSightTimer > BOT.loseSightSeconds) this.target = null;
    }

    switch (this.state) {
      case BOT_STATES.ENGAGE:
        this.updateEngage(dt, ctx, enemy);
        break;
      case BOT_STATES.STRAFE_COVER:
        this.updateStrafe(dt, ctx, enemy);
        break;
      case BOT_STATES.PLANT_BOMB:
        this.updatePlant(dt, ctx, enemy);
        break;
      case BOT_STATES.DEFUSE_BOMB:
        this.updateDefuse(dt, ctx, enemy);
        break;
      case BOT_STATES.ROTATE:
        this.updateRotate(dt, ctx, enemy);
        break;
      default:
        this.updatePatrol(dt, ctx, enemy);
        break;
    }
    this.animateWalk(dt);
  }

  faceToward(x, z) {
    const dx = x - this.position.x;
    const dz = z - this.position.z;
    this.yaw = Math.atan2(dx, dz);
    this.group.rotation.y = this.yaw;
  }

  stepToward(x, z, dt, colliders, speed = this.speed) {
    const dx = x - this.position.x;
    const dz = z - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.01) return true;
    const step = (speed * dt) / dist;
    const nx = this.position.x + dx * step;
    const nz = this.position.z + dz * step;
    if (!this.hitsWall(nx, this.position.z, colliders)) this.position.x = nx;
    if (!this.hitsWall(this.position.x, nz, colliders)) this.position.z = nz;
    return dist < 0.6;
  }

  hitsWall(x, z, colliders) {
    const r = 0.38;
    for (const box of colliders) {
      if (box.min.y > 1.0 || box.max.y < 0.2) continue;
      const cx = Math.max(box.min.x, Math.min(x, box.max.x));
      const cz = Math.max(box.min.z, Math.min(z, box.max.z));
      const ddx = x - cx;
      const ddz = z - cz;
      if (ddx * ddx + ddz * ddz < r * r) return true;
    }
    return false;
  }

  tryFire(dt, ctx) {
    if (!this.target || this.reactionTimer > 0) return;
    this.burstPause -= dt;
    if (this.burstLeft <= 0) {
      if (this.burstPause > 0) return;
      this.burstLeft = BOT.burstMin + Math.floor(Math.random() * (BOT.burstMax - BOT.burstMin + 1));
      this.burstPause = BOT.burstPauseMin + Math.random() * (BOT.burstPauseMax - BOT.burstPauseMin);
    }
    if (this.lastShot > 0) {
      this.lastShot -= dt;
      return;
    }
    this.lastShot = this.weapon.fireRate;
    this.burstLeft -= 1;
    const aim = _tgt.copy(this.targetPos);
    const dist = Math.hypot(aim.x - this.position.x, aim.z - this.position.z);
    const err = 0.25 + dist * 0.035;
    aim.x += (Math.random() - 0.5) * 2 * err;
    aim.y = 1.2 + (Math.random() - 0.5) * err;
    aim.z += (Math.random() - 0.5) * 2 * err;
    this.muzzleWorld(_muzzle);
    ctx.hooks.onShot(this, _muzzle.clone(), aim.clone());
  }

  updatePatrol(dt, ctx, enemy) {
    if (enemy) {
      this.state = BOT_STATES.ENGAGE;
      return;
    }
    if (this.carrier && this.atSite(ctx)) {
      this.state = BOT_STATES.PLANT_BOMB;
      this.plantProgress = 0;
      return;
    }
    if (this.holdTimer > 0) {
      this.holdTimer -= dt;
      return;
    }
    const key = this.route[this.routeIndex % this.route.length];
    const wp = WAYPOINTS[key];
    if (!wp) return;
    this.faceToward(wp.x, wp.z);
    if (this.stepToward(wp.x, wp.z, dt, ctx.colliders)) {
      this.routeIndex = (this.routeIndex + 1) % this.route.length;
      this.holdTimer = 0.5 + Math.random() * BOT.holdSeconds;
    }
  }

  updateEngage(dt, ctx, enemy) {
    if (!enemy) {
      this.rotateTimer += dt;
      if (this.rotateTimer > 1.5) {
        this.state = BOT_STATES.ROTATE;
        this.rotateTimer = 0;
        this.pickObjectiveRoute(ctx);
      }
      return;
    }
    this.rotateTimer = 0;
    this.faceToward(this.targetPos.x, this.targetPos.z);
    const dist = Math.hypot(this.targetPos.x - this.position.x, this.targetPos.z - this.position.z);
    if (dist > BOT.holdRange) this.stepToward(this.targetPos.x, this.targetPos.z, dt, ctx.colliders);
    if (this.reactionTimer > 0) this.reactionTimer -= dt;
    else this.tryFire(dt, ctx);
    if (this.carrier && this.atSite(ctx) && dist > BOT.engageRange) {
      this.state = BOT_STATES.PLANT_BOMB;
      this.plantProgress = 0;
    }
  }

  updateStrafe(dt, ctx, enemy) {
    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) {
      this.strafeDir *= -1;
      this.strafeTimer = BOT.strafeSeconds;
    }
    const anchor = ctx.bomb?.pos ?? this.position;
    const ax = anchor.x - this.position.x;
    const az = anchor.z - this.position.z;
    const len = Math.hypot(ax, az) || 1;
    const px = -az / len * this.strafeDir;
    const pz = ax / len * this.strafeDir;
    this.stepToward(this.position.x + px * 2, this.position.z + pz * 2, dt, ctx.colliders, this.speed * 0.8);
    if (enemy) {
      this.faceToward(this.targetPos.x, this.targetPos.z);
      if (this.reactionTimer > 0) this.reactionTimer -= dt;
      else this.tryFire(dt, ctx);
    }
  }

  updatePlant(dt, ctx, enemy) {
    if (enemy) {
      this.state = BOT_STATES.ENGAGE;
      this.plantProgress = 0;
      return;
    }
    this.plantProgress += dt;
    if (this.plantProgress >= BOMB.plantSeconds) {
      this.plantProgress = 0;
      this.carrier = false;
      ctx.hooks.onPlant(this, ctx.bomb.site);
    }
  }

  updateDefuse(dt, ctx, enemy) {
    const bomb = ctx.bomb;
    if (!bomb || bomb.state !== 'planted') {
      this.state = BOT_STATES.PATROL;
      return;
    }
    const d = Math.hypot(bomb.pos.x - this.position.x, bomb.pos.z - this.position.z);
    if (d > 1.6) {
      this.faceToward(bomb.pos.x, bomb.pos.z);
      this.stepToward(bomb.pos.x, bomb.pos.z, dt, ctx.colliders, BOT.runSpeed);
      return;
    }
    if (enemy) {
      this.state = BOT_STATES.ENGAGE;
      this.defuseProgress = 0;
      return;
    }
    this.defuseProgress += dt;
    if (this.defuseProgress >= BOMB.defuseSeconds) {
      this.defuseProgress = 0;
      ctx.hooks.onDefuse(this);
    }
  }

  updateRotate(dt, ctx, enemy) {
    if (enemy) {
      this.state = BOT_STATES.ENGAGE;
      return;
    }
    if (this.carrier && this.atSite(ctx)) {
      this.state = BOT_STATES.PLANT_BOMB;
      this.plantProgress = 0;
      return;
    }
    const key = this.route[this.routeIndex % this.route.length];
    const wp = WAYPOINTS[key];
    if (!wp) {
      this.state = BOT_STATES.PATROL;
      return;
    }
    this.faceToward(wp.x, wp.z);
    if (this.stepToward(wp.x, wp.z, dt, ctx.colliders, BOT.runSpeed)) {
      this.routeIndex = (this.routeIndex + 1) % this.route.length;
      this.state = BOT_STATES.PATROL;
    }
  }

  atSite(ctx) {
    const site = ctx.bomb?.site;
    if (!site) return false;
    const wp = WAYPOINTS[site === 'A' ? 'siteA' : 'siteB'];
    if (!wp) return false;
    const dx = wp.x - this.position.x;
    const dz = wp.z - this.position.z;
    return dx * dx + dz * dz < 36;
  }

  pickObjectiveRoute(ctx) {
    const site = ctx.bomb?.site ?? (Math.random() < 0.5 ? 'A' : 'B');
    const key = this.team === 't'
      ? (site === 'A' ? 'tMidA' : 'tTunnelsB')
      : (site === 'A' ? 'ctA' : 'ctB');
    this.route = ROUTES[key] ?? this.route;
    this.routeIndex = 0;
  }

  animateWalk(dt) {
    const moving = this.state !== BOT_STATES.PLANT_BOMB && this.state !== BOT_STATES.DEFUSE_BOMB;
    const speed = moving ? this.speed : 0;
    this.walkPhase += dt * speed * 3.2;
    const swing = Math.sin(this.walkPhase) * 0.55;
    const fighting = this.state === BOT_STATES.ENGAGE || this.state === BOT_STATES.STRAFE_COVER;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    if (fighting) {
      this.armR.rotation.x = -1.25;
      this.armL.rotation.x = -0.9;
      this.armL.rotation.z = 0.5;
    } else {
      this.armR.rotation.x = -swing * 0.7;
      this.armL.rotation.x = swing * 0.7;
      this.armL.rotation.z = 0;
    }
  }
}
