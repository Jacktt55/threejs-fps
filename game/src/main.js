// Dustyard boot: renderer, fixed 60 Hz simulation apart from rendering,
// pointer-lock mouse look, WASD movement with AABB collision, raycast
// shooting against bot hitboxes, and a round state machine skeleton
// (freeze -> live -> end -> next round). Buy menu contents, bomb plant /
// defuse and gunplay tuning land in later steps.
import * as THREE from 'three';
import { PALETTE, FIXED_STEP, PLAYER, WEAPONS, ROUND, ECONOMY, BUY_MENU, SPAWN_POINTS } from './constants.js';
import { createMap, collidesAt } from './map.js';
import { SoundBank } from './audio.js';
import { Weapon } from './weapons.js';
import { Bot } from './botAI.js';
import * as hud from './hud.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot'); // start | play | end (deterministic capture)
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;

function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(seed);

// --- Renderer / scene ---------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.canvas);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 200);
scene.add(camera);

const map = createMap(scene);
const sounds = new SoundBank();
const weapon = new Weapon(camera);
const raycaster = new THREE.Raycaster();
raycaster.far = 90;

// --- Bots (defenders) ----------------------------------------------------------
const bots = [
  new Bot(scene, { team: 'ct', name: 'Sable', route: ['ctSpawn', 'aMain', 'siteA', 'aMain'] }),
  new Bot(scene, { team: 'ct', name: 'Vex', route: ['ctSpawn', 'bMain', 'siteB', 'bMain'] }),
  new Bot(scene, { team: 'ct', name: 'Iris', route: ['ctSpawn', 'mid', 'midDoors', 'mid'] }),
  new Bot(scene, { team: 'ct', name: 'Rook', route: ['ctSpawn', 'aMain', 'siteA', 'mid'] }),
];

// --- Player state ---------------------------------------------------------------
const player = {
  pos: new THREE.Vector3(-28, 0, 0),
  vel: new THREE.Vector3(),
  yaw: -Math.PI / 2,
  pitch: 0,
  health: 100,
  money: ECONOMY.startMoney,
  crouching: false,
  onGround: true,
};

const game = {
  round: 1,
  phase: 'freeze',
  phaseTime: ROUND.freezeSeconds,
  score: { att: 0, def: 0 },
  locked: false,
  frozen: false,
  time: 0,
};

const keys = new Set();
let firing = false;

function lookAtYawPitch(yaw, pitch) {
  player.yaw = yaw;
  player.pitch = pitch;
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
}

function faceToward(fromX, fromZ, toX, toZ) {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  return Math.atan2(-dx, -dz);
}

function respawnAll() {
  player.pos.set(SPAWN_POINTS.attackers[0].x, 0, SPAWN_POINTS.attackers[0].z);
  player.vel.set(0, 0, 0);
  player.health = 100;
  lookAtYawPitch(faceToward(player.pos.x, player.pos.z, 0, 0), 0);
  bots[0].spawnAt(SPAWN_POINTS.defenders[0].x, SPAWN_POINTS.defenders[0].z);
  bots[1].spawnAt(SPAWN_POINTS.defenders[1].x, SPAWN_POINTS.defenders[1].z);
  bots[2].spawnAt(SPAWN_POINTS.defenders[2].x, SPAWN_POINTS.defenders[2].z);
  bots[3].spawnAt(SPAWN_POINTS.defenders[3].x, SPAWN_POINTS.defenders[3].z);
  weapon.switchTo('ak47', game.time);
  hud.setHealth(player.health);
  hud.setAmmo(weapon.mag, weapon.reserve);
  hud.setWeaponName(weapon.def.name);
  hud.setMoney(player.money);
  hud.setScore(game.score.att, game.score.def);
  hud.setRound(game.round);
}

function startRound() {
  game.phase = 'freeze';
  game.phaseTime = ROUND.freezeSeconds;
  respawnAll();
  hud.showBanner(`Round ${game.round}`, 'Buy phase — press B to open the shop');
  hud.setTimer(ROUND.freezeSeconds);
  sounds.play('roundStart');
}

function endRound(winner) {
  if (game.phase === 'end') return;
  game.phase = 'end';
  game.phaseTime = ROUND.endSeconds;
  if (winner === 'att') {
    game.score.att += 1;
    player.money = Math.min(ECONOMY.maxMoney, player.money + ECONOMY.winReward);
    hud.showBanner('Attackers win the round', `+$${ECONOMY.winReward}`);
  } else {
    game.score.def += 1;
    player.money = Math.min(ECONOMY.maxMoney, player.money + ECONOMY.lossReward);
    hud.showBanner('Defenders win the round', `+$${ECONOMY.lossReward}`);
  }
  hud.setScore(game.score.att, game.score.def);
  hud.setMoney(player.money);
  hud.closeBuyMenu();
}

// --- Input -----------------------------------------------------------------------
document.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyR') {
    if (weapon.startReload(game.time)) sounds.play('reload');
  }
  if (e.code === 'KeyB' && game.phase === 'freeze') {
    const menu = document.getElementById('buy-menu');
    if (menu.classList.contains('open')) {
      hud.closeBuyMenu();
      renderer.domElement.requestPointerLock();
    } else {
      hud.openBuyMenu();
      document.exitPointerLock();
    }
  }
  if (e.code === 'Digit1') weapon.switchTo('ak47', game.time);
  if (e.code === 'Digit2') weapon.switchTo('mp5', game.time);
  if (e.code === 'Digit3') weapon.switchTo('deagle', game.time);
  if (e.code === 'Digit4') weapon.switchTo('awp', game.time);
});
document.addEventListener('keyup', (e) => keys.delete(e.code));

document.addEventListener('mousemove', (e) => {
  if (!game.locked) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch -= e.movementY * 0.0022;
  player.pitch = Math.max(-1.5, Math.min(1.5, player.pitch));
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
});

renderer.domElement.addEventListener('mousedown', (e) => {
  if (!game.locked || e.button !== 0) return;
  firing = true;
  tryShoot();
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) firing = false;
});

document.getElementById('start-button').addEventListener('click', () => {
  sounds.ensure();
  renderer.domElement.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  game.locked = document.pointerLockElement === renderer.domElement;
  if (game.locked) hud.hideStartOverlay();
  else if (!shot) hud.showStartOverlay();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Shooting ----------------------------------------------------------------------
function tryShoot() {
  const moving = player.vel.lengthSq() > 1;
  const result = weapon.fire(game.time, moving);
  if (!result) return;
  sounds.play('shot');
  if (result.thrown) {
    hud.addKillfeed(`You threw a ${weapon.def.name}`);
    return;
  }
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  // Apply spread.
  dir.x += (random() - 0.5) * 2 * result.spread;
  dir.y += (random() - 0.5) * 2 * result.spread;
  dir.z += (random() - 0.5) * 2 * result.spread;
  dir.normalize();
  raycaster.set(camera.position, dir);
  const targets = [];
  for (const bot of bots) if (bot.alive) targets.push(...bot.hitMeshes);
  const hits = raycaster.intersectObjects([...targets, ...map.meshes], false);
  if (hits.length === 0) return;
  const hit = hits[0];
  const owner = hit.object.userData?.bot;
  if (!owner) return; // hit the map, not a bot
  const isHead = hit.object.userData.part === 'head';
  const damage = result.damage * (isHead ? result.headshot : 1);
  const died = owner.takeDamage(damage);
  sounds.play(died ? 'kill' : 'hit');
  hud.flashHitmarker(died);
  if (died) {
    player.money = Math.min(ECONOMY.maxMoney, player.money + ECONOMY.killReward);
    hud.setMoney(player.money);
    hud.addKillfeed(`You eliminated ${owner.name} (+$${ECONOMY.killReward})`);
    if (bots.every((b) => !b.alive)) endRound('att');
  }
}

// --- Simulation (fixed step) ----------------------------------------------------------
function step(dt) {
  game.time += dt;

  // Round timer.
  if (game.phase !== 'end') {
    game.phaseTime -= dt;
    hud.setTimer(game.phaseTime);
    if (game.phaseTime <= 0) {
      if (game.phase === 'freeze') {
        game.phase = 'live';
        game.phaseTime = ROUND.roundSeconds;
        hud.closeBuyMenu();
        hud.showBanner('Go!', 'Eliminate the defenders or plant the bomb');
      } else if (game.phase === 'live') {
        endRound('def');
      }
    }
  } else {
    game.phaseTime -= dt;
    if (game.phaseTime <= 0) {
      game.round += 1;
      startRound();
    }
  }

  // Movement: WASD + shift to run, C / Control to crouch, Space to jump.
  const speed = player.crouching
    ? PLAYER.crouchSpeed
    : keys.has('ShiftLeft') || keys.has('ShiftRight')
      ? PLAYER.runSpeed
      : PLAYER.walkSpeed;
  const movePenalty = 1 - (weapon.def.movePenalty ?? 0);
  const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3(-forward.z, 0, forward.x);
  const wish = new THREE.Vector3();
  if (keys.has('KeyW')) wish.add(forward);
  if (keys.has('KeyS')) wish.sub(forward);
  if (keys.has('KeyD')) wish.add(right);
  if (keys.has('KeyA')) wish.sub(right);
  if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed * movePenalty);
  player.crouching = keys.has('KeyC') || keys.has('ControlLeft');
  const accel = wish.lengthSq() > 0 ? PLAYER.accel : PLAYER.friction;
  player.vel.x += (wish.x - player.vel.x) * Math.min(1, accel * dt);
  player.vel.z += (wish.z - player.vel.z) * Math.min(1, accel * dt);

  // Gravity and jump (flat ground at y = 0 for the skeleton).
  player.vel.y -= PLAYER.gravity * dt;
  if (keys.has('Space') && player.onGround) {
    player.vel.y = PLAYER.jumpSpeed;
    player.onGround = false;
  }
  const nextX = player.pos.x + player.vel.x * dt;
  const nextZ = player.pos.z + player.vel.z * dt;
  if (!collidesAt(map.colliders, nextX, player.pos.z, PLAYER.radius)) player.pos.x = nextX;
  if (!collidesAt(map.colliders, player.pos.x, nextZ, PLAYER.radius)) player.pos.z = nextZ;
  player.pos.y += player.vel.y * dt;
  if (player.pos.y <= 0) {
    player.pos.y = 0;
    player.vel.y = 0;
    player.onGround = true;
  }
  const eyeHeight = player.crouching ? PLAYER.crouchEyeHeight : PLAYER.eyeHeight;
  camera.position.set(player.pos.x, player.pos.y + eyeHeight, player.pos.z);

  // Weapon: finish reloads, recover recoil, hold-to-fire for automatics.
  if (weapon.finishReload(game.time)) sounds.play('click');
  weapon.update(dt);
  if (firing && weapon.def.automatic && game.locked) tryShoot();

  // Bots.
  const playerPos = new THREE.Vector3(player.pos.x, player.pos.y + eyeHeight, player.pos.z);
  for (const bot of bots) bot.update(dt, playerPos, map.colliders);

  // Atmosphere.
  map.update(dt);
}

// --- Render loop ---------------------------------------------------------------------
let last = performance.now();
let accumulator = 0;
let shotFrames = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const frameDt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!game.frozen && (game.locked || shot)) {
    accumulator += frameDt;
    while (accumulator >= FIXED_STEP) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
    }
  }
  renderer.render(scene, camera);
  if (shot && shotFrames < 2) {
    shotFrames += 1;
    if (shotFrames === 2) {
      game.frozen = true;
      window.__shotReady = true;
    }
  }
}

// --- Deterministic capture poses ------------------------------------------------------
function setupShot() {
  if (shot === 'start') {
    player.pos.set(-28, 0, 0);
    lookAtYawPitch(faceToward(-28, 0, 0, 0), 0);
    bots[2].spawnAt(2, 1);
    bots[3].spawnAt(-2, -3);
  } else if (shot === 'play') {
    player.pos.set(-2, 0, 4);
    lookAtYawPitch(faceToward(-2, 4, 20, -16), 0);
    bots[0].spawnAt(14, -8);
    bots[1].spawnAt(18, -12);
  } else {
    // end: on site A, looking at the catwalk and the beacon.
    player.pos.set(16, 0, -12);
    lookAtYawPitch(faceToward(16, -12, 22, -20), 0.02);
    bots[0].spawnAt(24, -13);
    bots[1].spawnAt(18, -18);
  }
  hud.setHealth(player.health);
  hud.setAmmo(weapon.mag, weapon.reserve);
  hud.setWeaponName(weapon.def.name);
  hud.setMoney(player.money);
  hud.setScore(game.score.att, game.score.def);
  hud.setRound(game.round);
  hud.setTimer(ROUND.roundSeconds);
}

// --- Boot ------------------------------------------------------------------------------
respawnAll();
startRound();
if (shot) {
  setupShot();
  game.locked = true; // capture mode runs without pointer lock
  hud.hideStartOverlay();
}
hud.setBuyMenuItems(
  BUY_MENU.map((key, i) => ({ key: String(i + 1), name: WEAPONS[key].name, price: WEAPONS[key].price })),
);
requestAnimationFrame(animate);
