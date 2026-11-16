// Bot entity: a box-built soldier (body + head hitboxes) with a small state
// machine — patrol / hold / engage / retreat — that follows a route of
// waypoints and reacts when it can see the player. Shooting back and bomb
// logic land in a later step; here a bot in engage state tracks the player
// and closes distance instead of firing.
import * as THREE from 'three';
import { WAYPOINTS } from './constants.js';
import { segmentBlocked } from './map.js';

const BOT_COLORS = { ct: 0x2e5a88, t: 0xc8a165 };

export class Bot {
  constructor(scene, { team = 'ct', name = 'Bot', route = ['ctSpawn', 'mid', 'ctSpawn'], speed = 2.6 } = {}) {
    this.team = team;
    this.name = name;
    this.route = route;
    this.speed = speed;
    this.health = 100;
    this.alive = true;
    this.state = 'patrol';
    this.routeIndex = 0;
    this.holdTimer = 0;
    this.loseSightTimer = 0;
    this.yaw = 0;

    const color = BOT_COLORS[team] ?? 0x888888;
    this.group = new THREE.Group();
    const suit = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc9a586, roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.7 });

    this.bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.95, 0.32), suit);
    this.bodyMesh.position.y = 0.95;
    this.headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skin);
    this.headMesh.position.y = 1.62;
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.38), dark);
    helmet.position.y = 1.8;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.3), dark);
    legs.position.y = 0.25;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.7), dark);
    gun.position.set(0.2, 1.15, 0.3);

    this.group.add(this.bodyMesh, this.headMesh, helmet, legs, gun);
    this.group.traverse((child) => {
      child.castShadow = true;
    });
    scene.add(this.group);

    // Hitboxes for the shooter's raycast. userData marks the part and owner.
    this.bodyMesh.userData = { bot: this, part: 'body' };
    this.headMesh.userData = { bot: this, part: 'head' };
    this.hitMeshes = [this.bodyMesh, this.headMesh];
  }

  get position() {
    return this.group.position;
  }

  spawnAt(x, z, yaw = 0) {
    this.group.position.set(x, 0, z);
    this.yaw = yaw;
    this.group.rotation.y = yaw;
    this.health = 100;
    this.alive = true;
    this.state = 'patrol';
    this.routeIndex = 0;
  }

  takeDamage(amount) {
    if (!this.alive) return false;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.group.visible = false;
      return true;
    }
    return false;
  }

  canSee(playerPos, colliders) {
    if (!this.alive) return false;
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 32) return false;
    const eye = new THREE.Vector3(this.position.x, 1.6, this.position.z);
    const target = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
    return !segmentBlocked(eye, target, colliders);
  }

  update(dt, playerPos, colliders) {
    if (!this.alive) return;
    const seesPlayer = playerPos ? this.canSee(playerPos, colliders) : false;

    if (seesPlayer) {
      this.state = 'engage';
      this.loseSightTimer = 0;
    } else if (this.state === 'engage') {
      this.loseSightTimer += dt;
      if (this.loseSightTimer > 2.5) this.state = 'patrol';
    }

    if (this.state === 'engage' && playerPos) {
      // Face the player and close to a fighting distance, then hold.
      const dx = playerPos.x - this.position.x;
      const dz = playerPos.z - this.position.z;
      const dist = Math.hypot(dx, dz);
      this.yaw = Math.atan2(dx, dz);
      this.group.rotation.y = this.yaw;
      if (dist > 9) this.stepToward(playerPos.x, playerPos.z, dt, colliders);
      return;
    }

    if (this.state === 'hold') {
      this.holdTimer -= dt;
      if (this.holdTimer <= 0) this.state = 'patrol';
      return;
    }

    // Patrol: walk the route, pausing briefly at each waypoint.
    const key = this.route[this.routeIndex % this.route.length];
    const wp = WAYPOINTS[key];
    if (!wp) return;
    const dx = wp.x - this.position.x;
    const dz = wp.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.6) {
      this.routeIndex = (this.routeIndex + 1) % this.route.length;
      this.state = 'hold';
      this.holdTimer = 1 + Math.random() * 2;
      return;
    }
    this.yaw = Math.atan2(dx, dz);
    this.group.rotation.y = this.yaw;
    this.stepToward(wp.x, wp.z, dt, colliders);
  }

  stepToward(x, z, dt, colliders) {
    const dx = x - this.position.x;
    const dz = z - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.01) return;
    const step = (this.speed * dt) / dist;
    const nx = this.position.x + dx * step;
    const nz = this.position.z + dz * step;
    // Axis-separated movement so the bot slides along walls instead of
    // sticking to them.
    if (!this.hitsWall(nx, this.position.z, colliders)) this.position.x = nx;
    if (!this.hitsWall(this.position.x, nz, colliders)) this.position.z = nz;
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
}
