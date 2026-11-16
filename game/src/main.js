// Dustyard 5v5: composer rendering, fixed 60 Hz sim, AutoPilot attract
// mode, C4 objective, bot combat. Round 1 starts LIVE (AutoPilot drives
// until the human clicks or presses a key); rounds 2+ keep the 5 s freeze.
// The ?shot capture contract is untouched: AutoPilot is off and the freeze
// poses apply whenever a ?shot param is present.
import * as THREE from 'three';
import { PALETTE, FIXED_STEP, PLAYER, WEAPONS, ROUND, ECONOMY, BUY_MENU, SPAWN_POINTS, WAYPOINTS, ROUTES, BOT, BOT_ROSTER, BOMB, BLOOM, TONE_EXPOSURE, BUY_WINDOW_SECONDS, RADAR, HIT_ZONES, AUTOPILOT } from './constants.js';
import { createMap, collidesAt, segmentBlocked } from './map.js';
import { SoundBank } from './audio.js';
import { Weapon } from './weapons.js';
import { Bot } from './botAI.js';
import * as hud from './hud.js';
import { EffectComposer } from '../vendor/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/three/addons/postprocessing/OutputPass.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;
// ?nocomposer=1 skips the post chain (low-end fallback; also a capture
// debug route). Default is the full cinematic composer.
const useComposer = params.get('nocomposer') !== '1';

function mulberry32(a) {
  return function random() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(seed);

// Renderer + cinematic composer (bloom for emissive only, ACES output).
// If the composer cannot be built, fall back to plain rendering.
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = TONE_EXPOSURE;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.canvas);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 200);
scene.add(camera);

let composer = null;
if (useComposer) {
  try {
    // UnsignedByte render targets: the HalfFloat default can produce
    // NaN/inf pixels under SwiftShader for this scene's brightest
    // emissives, which the bloom blur then spreads across the frame
    // (observed: black cover shot from the T-spawn pose). Clamping the
    // composer buffers to [0, 1] keeps the chain robust; the bloom
    // threshold (0.85) still isolates the glowing elements.
    const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: THREE.UnsignedByteType });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), BLOOM.strength, BLOOM.radius, BLOOM.threshold));
    composer.addPass(new OutputPass());
  } catch { composer = null; }
}

const map = createMap(scene);
const sounds = new SoundBank();
const weapon = new Weapon(camera, scene, {
  colliders: map.colliders,
  onExplosion: (pos, radius, damage) => handleExplosion(pos, radius, damage),
  onFlash: (strength) => { hud.flashbang(strength); if (strength > 0.25) sounds.play('flashbang'); },
  onBounce: () => sounds.play('bounce'),
  onSmoke: () => sounds.play('smokePop'),
});
const raycaster = new THREE.Raycaster();
raycaster.far = 90;

// Reused temporaries: no per-frame allocation in sim or shooting.
const _muzzle = new THREE.Vector3();
const _traceEnd = new THREE.Vector3();
const _hitNormal = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _tgt = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _playerEye = new THREE.Vector3();

// 5v5: player + 4 Terrorist teammates vs 5 CT defenders.
const bots = [];
for (const r of BOT_ROSTER.attackers) bots.push(new Bot(scene, { team: 't', name: r.name, route: r.route, weapon: r.weapon }));
for (const r of BOT_ROSTER.defenders) bots.push(new Bot(scene, { team: 'ct', name: r.name, route: r.route, weapon: r.weapon }));
const tBots = bots.filter((b) => b.team === 't');
const ctBots = bots.filter((b) => b.team === 'ct');

const player = {
  pos: new THREE.Vector3(-28, 0, 0), vel: new THREE.Vector3(),
  yaw: -Math.PI / 2, pitch: 0, health: 100, armor: 0,
  money: ECONOMY.startMoney, crouching: false, onGround: true,
  dead: false, kills: 0, deaths: 0,
};

const game = {
  round: 1, phase: 'freeze', phaseTime: ROUND.freezeSeconds, roundStartTime: 0,
  score: { att: 0, def: 0 }, locked: false, frozen: false, time: 0,
};

// C4: carried by the player, then by a living Terrorist bot if the player
// falls. `site` is this round's target site, chosen at round start.
const bomb = {
  state: 'carried', site: 'A', pos: null, timer: ROUND.c4Seconds,
  carrier: 'player', beepTimer: 0, beepInterval: BOMB.beepStart,
  mesh: null, plantProgress: 0, defuseProgress: 0,
};

const autopilot = {
  armed: !shot, active: false, loadAt: performance.now(),
  pathIdx: 0, target: null, burstLeft: 0, burstPause: 0, fireCooldown: 0,
};

const keys = new Set();
let firing = false;
let stepAcc = 0;
let bought = new Set(['ak47', 'knife', 'c4']);
let scoreboardOpen = false;

const WEAPON_SLOTS = [
  { key: 'ak47', hotkey: '1' }, { key: 'm4a1', hotkey: '2' }, { key: 'mp5', hotkey: '3' },
  { key: 'awp', hotkey: '4' }, { key: 'deagle', hotkey: '5' }, { key: 'he', hotkey: '6' },
  { key: 'flash', hotkey: '7' }, { key: 'smoke', hotkey: '8' }, { key: 'knife', hotkey: '9' },
  { key: 'c4', hotkey: '0' },
];

function syncAmmoHud() {
  const a = weapon.ammoForHud();
  hud.setAmmo(a.mag, a.reserve, weapon.reloading);
  hud.setWeaponName(weapon.def.name);
  hud.setArmor(player.armor, weapon.armor);
}

function syncSelector() {
  hud.setWeaponSelector(WEAPON_SLOTS.map((s) => ({
    ...s,
    owned: bought.has(s.key) || (WEAPONS[s.key]?.kind === 'grenade' && (weapon.grenades[s.key] ?? 0) > 0),
  })), weapon.key);
}

function applyZoom() {
  if (!weapon.zoomChanged) return;
  weapon.zoomChanged = false;
  camera.fov = weapon.currentFov();
  camera.updateProjectionMatrix();
  if (weapon.zoom > 0) hud.showScope(weapon.zoom);
  else hud.hideScope();
}

function lookAtYawPitch(yaw, pitch) {
  player.yaw = yaw;
  player.pitch = pitch;
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
}

function faceToward(fromX, fromZ, toX, toZ) {
  return Math.atan2(-(toX - fromX), -(toZ - fromZ));
}

function losClear(ax, ay, az, bx, by, bz) {
  _eye.set(ax, ay, az);
  _tgt.set(bx, by, bz);
  return !segmentBlocked(_eye, _tgt, map.colliders);
}

function sitePos(site) {
  return WAYPOINTS[site === 'A' ? 'siteA' : 'siteB'];
}

function respawnAll() {
  player.pos.set(SPAWN_POINTS.attackers[0].x, 0, SPAWN_POINTS.attackers[0].z);
  player.vel.set(0, 0, 0);
  player.health = 100;
  player.armor = 0;
  player.dead = false;
  weapon.armor = false;
  lookAtYawPitch(faceToward(player.pos.x, player.pos.z, 0, 0), 0);
  tBots.forEach((b, i) => b.spawnAt(SPAWN_POINTS.attackers[i + 1].x, SPAWN_POINTS.attackers[i + 1].z));
  ctBots.forEach((b, i) => b.spawnAt(SPAWN_POINTS.defenders[i].x, SPAWN_POINTS.defenders[i].z));
  weapon.switchTo('ak47', game.time);
  applyZoom();
  hud.setHealth(player.health);
  syncAmmoHud();
  syncSelector();
  hud.setMoney(player.money);
  hud.setScore(game.score.att, game.score.def);
  hud.setRound(game.round);
  hud.hidePlantPrompt();
}

function resetBomb() {
  if (bomb.mesh) { scene.remove(bomb.mesh); bomb.mesh = null; }
  bomb.state = 'carried';
  bomb.site = random() < 0.5 ? 'A' : 'B';
  bomb.pos = null;
  bomb.timer = ROUND.c4Seconds;
  bomb.carrier = 'player';
  bomb.beepTimer = 0;
  bomb.beepInterval = BOMB.beepStart;
  bomb.plantProgress = 0;
  bomb.defuseProgress = 0;
  for (const b of tBots) b.carrier = false;
}

function startRound() {
  game.phase = 'freeze';
  game.phaseTime = ROUND.freezeSeconds;
  game.roundStartTime = game.time;
  respawnAll();
  resetBomb();
  hud.showBanner(`Round ${game.round}`, 'Buy phase — press B to open the shop');
  hud.setTimer(ROUND.freezeSeconds);
  sounds.play('roundStart');
}

// Round 1 starts LIVE: no freeze, bots already fighting, AutoPilot driving
// until the human takes over.
function startFirstRound() {
  game.phase = 'live';
  game.phaseTime = ROUND.roundSeconds;
  game.roundStartTime = game.time;
  respawnAll();
  resetBomb();
  hud.showBanner(`Round ${game.round}`, 'Go! Eliminate the defenders or plant the bomb');
  hud.setTimer(ROUND.roundSeconds);
  sounds.play('roundStart');
  autopilot.active = false;
  hud.setEngagePill(true);
}

function endRound(winner) {
  if (game.phase === 'end') return;
  game.phase = 'end';
  game.phaseTime = ROUND.endSeconds;
  if (bomb.mesh) { scene.remove(bomb.mesh); bomb.mesh = null; }
  bomb.state = null;
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
  hud.hidePlantPrompt();
  autopilot.active = false;
  hud.setEngagePill(false);
}

function checkRoundEnd() {
  if (game.phase !== 'live') return;
  if (ctBots.every((b) => !b.alive)) endRound('att');
  else if (player.dead && tBots.every((b) => !b.alive)) endRound('def');
}

// --- Bomb objective ------------------------------------------------------------
function spawnPlantedBombMesh(pos) {
  const g = new THREE.Group();
  const brick = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.12), new THREE.MeshStandardMaterial({ color: 0x3d4a2a, roughness: 0.9 }));
  brick.position.y = 0.1;
  brick.castShadow = true;
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2211, emissiveIntensity: 2.5 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), ledMat);
  led.position.set(-0.1, 0.22, 0);
  const light = new THREE.PointLight(0xff2211, 6, 6, 2);
  light.position.y = 0.4;
  g.add(brick, led, light);
  g.position.set(pos.x, 0, pos.z);
  g.userData.ledMat = ledMat;
  g.userData.light = light;
  scene.add(g);
  return g;
}

function plantBomb(site) {
  const wp = sitePos(site);
  bomb.state = 'planted';
  bomb.pos = new THREE.Vector3(wp.x, 0, wp.z);
  bomb.timer = ROUND.c4Seconds;
  bomb.beepTimer = 0;
  bomb.beepInterval = BOMB.beepStart;
  bomb.mesh = spawnPlantedBombMesh(bomb.pos);
  player.money = Math.min(ECONOMY.maxMoney, player.money + ECONOMY.plantReward);
  hud.setMoney(player.money);
  hud.addKillfeed({ killer: 'You', victim: `planted the bomb at ${site}`, weapon: 'c4', killerTeam: 't', victimTeam: 't' });
  hud.showBanner('Bomb planted', `${Math.round(ROUND.c4Seconds)} seconds to detonation`);
  sounds.play('plant');
}

function defuseBomb(byPlayer) {
  bomb.state = null;
  if (bomb.mesh) { scene.remove(bomb.mesh); bomb.mesh = null; }
  if (byPlayer) {
    player.money = Math.min(ECONOMY.maxMoney, player.money + ECONOMY.defuseReward);
    hud.setMoney(player.money);
    hud.addKillfeed({ killer: 'You', victim: 'defused the bomb', weapon: 'c4', killerTeam: 't', victimTeam: 't' });
  }
  endRound('def');
}

function explodeBomb() {
  const pos = bomb.pos.clone();
  bomb.state = null;
  if (bomb.mesh) { scene.remove(bomb.mesh); bomb.mesh = null; }
  weapon.showExplosion(pos);
  handleExplosion(pos, BOMB.radius, BOMB.damage);
  endRound('att');
}

// The carrier falls: hand the bomb to another living Terrorist bot (and
// retarget its route at the site) or leave it for the player to pick up.
function transferCarrier(deadCarrier) {
  if (bomb.state !== 'carried') return;
  const next = tBots.find((b) => b.alive && b !== deadCarrier);
  if (next) {
    next.carrier = true;
    bomb.carrier = next;
    next.route = ROUTES[bomb.site === 'A' ? 'tMidA' : 'tTunnelsB'];
    next.routeIndex = 0;
  } else if (!player.dead) {
    bomb.carrier = 'player';
  } else {
    bomb.carrier = null;
  }
}

// Player down: shared by bot fire and explosions. The round continues
// while Terrorist teammates live; otherwise the defenders take it.
function killPlayer(killerBot) {
  if (player.dead) return;
  player.dead = true;
  player.deaths += 1;
  autopilot.active = false;
  hud.setHealth(0);
  hud.showBanner('You are down', 'Your team fights on');
  if (killerBot) killerBot.kills += 1;
  if (bomb.carrier === 'player') transferCarrier(null);
  checkRoundEnd();
}

// --- Input ----------------------------------------------------------------------
function userTakeover(fromClick) {
  if (!autopilot.armed && !autopilot.active) return;
  autopilot.armed = false;
  autopilot.active = false;
  hud.setEngagePill(false);
  sounds.ensure();
  if (fromClick) renderer.domElement.requestPointerLock();
}

function buyOpen() {
  return game.phase === 'freeze' || game.time - game.roundStartTime < ROUND.freezeSeconds + BUY_WINDOW_SECONDS;
}

function buyItem(key) {
  const def = WEAPONS[key];
  if (!def || player.money < def.price || !weapon.buy(key)) return false;
  player.money -= def.price;
  if (key === 'kevlar') player.armor = 100;
  bought.add(key);
  hud.setMoney(player.money);
  syncAmmoHud();
  syncSelector();
  sounds.play('click');
  return true;
}

const SWITCH_KEYS = {
  Digit1: 'ak47', Digit2: 'm4a1', Digit3: 'mp5', Digit4: 'awp', Digit5: 'deagle',
  Digit6: 'he', Digit7: 'flash', Digit8: 'smoke', Digit9: 'knife', Digit0: 'c4',
};

document.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (autopilot.active || autopilot.armed) userTakeover(false);
  if (e.code === 'Tab') {
    e.preventDefault();
    if (!scoreboardOpen) { scoreboardOpen = true; hud.showScoreboard(buildScoreRows()); }
    return;
  }
  if (e.code === 'KeyR' && weapon.startReload(game.time)) sounds.play('reload', { reloadTime: weapon.def.reloadTime });
  if (e.code === 'KeyB' && buyOpen()) {
    const menu = document.getElementById('buy-menu');
    if (menu.classList.contains('open')) { hud.closeBuyMenu(); renderer.domElement.requestPointerLock(); }
    else { hud.openBuyMenu(); document.exitPointerLock(); }
  }
  const digit = /^Digit(\d)$/.exec(e.code);
  if (digit) {
    const n = Number(digit[1]);
    const menu = document.getElementById('buy-menu');
    if (menu.classList.contains('open') && buyOpen() && n >= 1 && n <= BUY_MENU.length) {
      buyItem(BUY_MENU[n - 1]);
      return;
    }
    const sw = SWITCH_KEYS[e.code];
    if (sw && !player.dead) {
      if (WEAPONS[sw]?.kind === 'grenade' && (weapon.grenades[sw] ?? 0) <= 0) return;
      if (weapon.switchTo(sw, game.time)) { applyZoom(); syncAmmoHud(); syncSelector(); sounds.play('click'); }
    }
  }
});
document.addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (e.code === 'Tab' && scoreboardOpen) { scoreboardOpen = false; hud.hideScoreboard(); }
});

document.addEventListener('mousemove', (e) => {
  if (!game.locked) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch -= e.movementY * 0.0022;
  player.pitch = Math.max(-1.5, Math.min(1.5, player.pitch));
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
});

renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

renderer.domElement.addEventListener('mousedown', (e) => {
  userTakeover(true);
  if (!game.locked) return;
  if (e.button === 2) {
    if (weapon.key === 'awp') { weapon.cycleZoom(); applyZoom(); }
    return;
  }
  if (e.button !== 0) return;
  firing = true;
  tryShoot();
});
document.addEventListener('mouseup', (e) => { if (e.button === 0) firing = false; });

document.addEventListener('pointerlockchange', () => {
  game.locked = document.pointerLockElement === renderer.domElement;
  if (game.locked) hud.setEngagePill(false);
  else if (!shot && !player.dead) hud.setEngagePill(true);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer?.setSize(window.innerWidth, window.innerHeight);
});

hud.setOnBuyItem((key) => buyItem(key));

// --- Player shooting ---------------------------------------------------------------
function damageBot(bot, amount, isHead, wallbang) {
  const died = bot.takeDamage(amount);
  if (isHead) sounds.play('headshot');
  sounds.play(died ? 'kill' : 'hit');
  hud.flashHitmarker(died, isHead);
  if (died) {
    player.kills += 1;
    player.money = Math.min(ECONOMY.maxMoney, player.money + ECONOMY.killReward);
    hud.setMoney(player.money);
    hud.addKillfeed({ killer: 'You', victim: bot.name, weapon: weapon.key, headshot: isHead, wallbang, killerTeam: 't', victimTeam: bot.team });
    if (bot.carrier) transferCarrier(bot);
    checkRoundEnd();
  }
  return died;
}

function tryShoot() {
  if (player.dead) return;
  const moving = player.vel.lengthSq() > 1;
  const result = weapon.fire(game.time, moving, !player.onGround, player.crouching);
  if (!result) return;
  if (result.dry) { sounds.play('dryFire'); return; }
  if (result.thrown) { sounds.play('pin'); syncAmmoHud(); return; }
  if (result.plant) { sounds.play('plant'); return; }
  sounds.playShot(weapon.key);
  applyZoom();

  if (result.melee) {
    camera.updateMatrixWorld(true);
    camera.getWorldDirection(_dir);
    raycaster.set(camera.position, _dir);
    raycaster.far = result.range;
    const targets = [];
    for (const bot of bots) if (bot.alive) targets.push(...bot.hitMeshes);
    const hits = raycaster.intersectObjects(targets, false);
    raycaster.far = 90;
    if (hits.length > 0) {
      const owner = hits[0].object.userData?.bot;
      if (owner) damageBot(owner, result.damage, false, false);
    }
    return;
  }

  // Recoil moves the aim before the shot resolves, so a spray climbs.
  player.pitch = Math.max(-1.5, Math.min(1.5, player.pitch + result.recoilKick.pitch));
  player.yaw += result.recoilKick.yaw;
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  camera.updateMatrixWorld(true);
  camera.getWorldDirection(_dir);
  _dir.x += (random() - 0.5) * 2 * result.spread;
  _dir.y += (random() - 0.5) * 2 * result.spread;
  _dir.z += (random() - 0.5) * 2 * result.spread;
  _dir.normalize();
  raycaster.set(camera.position, _dir);
  const targets = [];
  for (const bot of bots) if (bot.alive) targets.push(...bot.hitMeshes);
  const hits = raycaster.intersectObjects([...targets, ...map.meshes], false);
  weapon.getMuzzleWorldPosition(_muzzle);
  syncAmmoHud();
  if (hits.length === 0) {
    _traceEnd.copy(camera.position).addScaledVector(_dir, 90);
    weapon.spawnTracer(_muzzle, _traceEnd);
    return;
  }
  const hit = hits[0];
  weapon.spawnTracer(_muzzle, hit.point);
  const owner = hit.object.userData?.bot;
  if (!owner) {
    // Wall hit — unless a bot stands just behind it: a wallbang.
    const behind = hits.find((h) => h.object.userData?.bot && h.distance - hit.distance < 1.2);
    if (behind) {
      const victim = behind.object.userData.bot;
      const isHead = behind.object.userData.part === 'head';
      damageBot(victim, result.damage * 0.5 * (isHead ? result.headshot : 1), isHead, true);
      return;
    }
    if (hit.face?.normal) {
      _hitNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
      weapon.spawnDecal(hit.point, _hitNormal);
    }
    weapon.spawnSparks(hit.point);
    sounds.play('impact');
    return;
  }
  const part = hit.object.userData.part;
  const isHead = part === 'head';
  const zone = isHead ? result.headshot : part === 'limb' ? HIT_ZONES.limb : HIT_ZONES.torso;
  damageBot(owner, result.damage * zone, isHead, false);
}

// --- Bot shots ------------------------------------------------------------------------
// A bot fires: tracer from its muzzle, then a hit roll by range and target
// speed. A hit on the player halves through armour; a hit on a bot uses
// the same zone rules as player fire. Misses striking a wall leave a decal.
function resolveBotShot(bot, muzzlePos, aimPoint) {
  sounds.playShot(bot.weaponKey);
  const target = bot.target;
  if (!target) { weapon.spawnTracer(muzzlePos, aimPoint); return; }
  const isPlayer = target === 'player';
  const tPos = isPlayer ? player.pos : target.position;
  const dist = Math.hypot(tPos.x - bot.position.x, tPos.z - bot.position.z);
  const moving = isPlayer ? player.vel.lengthSq() > 4 : true;
  let chance = BOT.hitBase - Math.max(0, dist - 10) * BOT.hitFalloff;
  if (moving) chance *= BOT.hitMovingTarget;
  _dir.subVectors(aimPoint, muzzlePos).normalize();
  raycaster.set(muzzlePos, _dir);
  const wallHits = raycaster.intersectObjects(map.meshes, false);
  const blocked = wallHits.length > 0 && wallHits[0].distance < dist;
  if (blocked) {
    const w = wallHits[0];
    weapon.spawnTracer(muzzlePos, w.point);
    if (w.face?.normal) {
      _hitNormal.copy(w.face.normal).transformDirection(w.object.matrixWorld);
      weapon.spawnDecal(w.point, _hitNormal);
    }
    weapon.spawnSparks(w.point);
    return;
  }
  _traceEnd.set(tPos.x, tPos.y + 1.2, tPos.z);
  weapon.spawnTracer(muzzlePos, _traceEnd);
  if (random() > chance) return;
  const headshot = random() < BOT.headshotChance;
  const dmg = bot.weapon.damage * (headshot ? bot.weapon.headshot : 1);
  if (isPlayer) {
    if (player.dead) return;
    let taken = dmg;
    if (weapon.armor) { taken *= 0.5; player.armor = Math.max(0, player.armor - dmg * 0.5); }
    player.health -= taken;
    hud.setHealth(player.health);
    hud.setArmor(player.armor, weapon.armor);
    hud.flashHurt();
    if (headshot) sounds.play('headshot');
    if (player.health <= 0) {
      player.health = 0;
      hud.setHealth(0);
      hud.addKillfeed({ killer: bot.name, victim: 'You', weapon: bot.weaponKey, headshot, killerTeam: 'ct', victimTeam: 't' });
      killPlayer(bot);
    }
  } else {
    const died = target.takeDamage(dmg);
    if (died) {
      bot.kills += 1;
      hud.addKillfeed({ killer: bot.name, victim: target.name, weapon: bot.weaponKey, headshot, killerTeam: bot.team, victimTeam: target.team });
      if (target.carrier) transferCarrier(target);
      checkRoundEnd();
    }
  }
}

// HE detonation: radial falloff damage to bots and the player (armour halves).
function handleExplosion(pos, radius, damage) {
  sounds.play('explosion');
  const falloff = (d) => Math.max(0.15, 1 - d / radius);
  for (const bot of bots) {
    if (!bot.alive) continue;
    const d = Math.hypot(bot.position.x - pos.x, bot.position.z - pos.z);
    if (d > radius) continue;
    const died = bot.takeDamage(damage * falloff(d));
    if (died) {
      player.money = Math.min(ECONOMY.maxMoney, player.money + ECONOMY.killReward);
      hud.setMoney(player.money);
      hud.addKillfeed({ killer: 'Explosion', victim: bot.name, weapon: 'he', killerTeam: 't', victimTeam: bot.team });
      if (bot.carrier) transferCarrier(bot);
    }
  }
  const pd = Math.hypot(player.pos.x - pos.x, player.pos.z - pos.z);
  if (pd <= radius && !player.dead) {
    let dmg = damage * falloff(pd);
    if (weapon.armor) dmg *= 0.5;
    player.health -= dmg;
    hud.setHealth(player.health);
    hud.setArmor(player.armor, weapon.armor);
    hud.flashHurt();
    if (player.health <= 0) {
      player.health = 0;
      hud.setHealth(0);
      killPlayer(null);
    }
  }
  checkRoundEnd();
}

function buildScoreRows() {
  const rows = [{ name: 'You', team: 't', kills: player.kills, deaths: player.deaths, money: player.money, isPlayer: true }];
  for (const b of bots) rows.push({ name: b.name, team: b.team, kills: b.kills, deaths: b.deaths, money: ECONOMY.startMoney + b.kills * ECONOMY.killReward, isPlayer: false });
  return rows;
}

// --- AutoPilot --------------------------------------------------------------------------
// Walks the curated sightline, tracks the nearest visible defender, fires
// bursts with the player's own weapon. Any click or key hands over control.
function updateAutopilot(dt) {
  if (!autopilot.active || player.dead) { autopilot.active = false; return; }
  const path = AUTOPILOT.path;
  const wp = path[autopilot.pathIdx % path.length];
  const dx = wp.x - player.pos.x;
  const dz = wp.z - player.pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 1) autopilot.pathIdx = (autopilot.pathIdx + 1) % path.length;
  else {
    const step = AUTOPILOT.walkSpeed * dt;
    const nx = player.pos.x + (dx / dist) * step;
    const nz = player.pos.z + (dz / dist) * step;
    if (!collidesAt(map.colliders, nx, player.pos.z, PLAYER.radius)) player.pos.x = nx;
    if (!collidesAt(map.colliders, player.pos.x, nz, PLAYER.radius)) player.pos.z = nz;
  }
  let best = null;
  let bestD = Infinity;
  _eye.set(player.pos.x, player.pos.y + PLAYER.eyeHeight, player.pos.z);
  for (const b of ctBots) {
    if (!b.alive) continue;
    const d = Math.hypot(b.position.x - player.pos.x, b.position.z - player.pos.z);
    if (d >= bestD) continue;
    _tgt.set(b.position.x, 1.2, b.position.z);
    if (segmentBlocked(_eye, _tgt, map.colliders)) continue;
    best = b;
    bestD = d;
  }
  autopilot.target = best;
  let targetYaw;
  let targetPitch = 0;
  if (best) {
    targetYaw = Math.atan2(-(best.position.x - player.pos.x), -(best.position.z - player.pos.z));
    targetPitch = Math.atan2(1.2 - PLAYER.eyeHeight, bestD);
  } else {
    targetYaw = Math.atan2(-(wp.x - player.pos.x), -(wp.z - player.pos.z));
  }
  const k = Math.min(1, AUTOPILOT.aimLerp * dt);
  let dy = targetYaw - player.yaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  player.yaw += dy * k;
  player.pitch += (targetPitch - player.pitch) * k;
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  if (weapon.mag <= 0 && weapon.startReload(game.time)) sounds.play('reload', { reloadTime: weapon.def.reloadTime });
  autopilot.fireCooldown -= dt;
  if (best && autopilot.fireCooldown <= 0) {
    if (autopilot.burstLeft <= 0) {
      autopilot.burstLeft = AUTOPILOT.burstShots;
      autopilot.fireCooldown = AUTOPILOT.burstPause;
    } else {
      autopilot.burstLeft -= 1;
      autopilot.fireCooldown = weapon.def.fireRate;
      tryShoot();
    }
  }
}

// --- Simulation (fixed step) ----------------------------------------------------------------
function step(dt) {
  game.time += dt;
  if (autopilot.armed && !autopilot.active && performance.now() - autopilot.loadAt > AUTOPILOT.engageDelay * 1000) autopilot.active = true;

  // Round timer. A planted bomb replaces the round clock with the C4 timer.
  if (game.phase !== 'end') {
    game.phaseTime -= dt;
    if (bomb.state === 'planted') {
      bomb.timer -= dt;
      bomb.beepTimer -= dt;
      if (bomb.beepTimer <= 0) {
        bomb.beepTimer = bomb.beepInterval;
        bomb.beepInterval = Math.max(BOMB.beepMin, bomb.beepInterval * BOMB.beepShrink);
        sounds.play('c4Beep');
        if (bomb.mesh) { bomb.mesh.userData.ledMat.emissiveIntensity = 3; bomb.mesh.userData.light.intensity = 10; }
      }
      if (bomb.mesh) {
        bomb.mesh.userData.ledMat.emissiveIntensity = Math.max(1.2, bomb.mesh.userData.ledMat.emissiveIntensity - dt * 6);
        bomb.mesh.userData.light.intensity = Math.max(2, bomb.mesh.userData.light.intensity - dt * 20);
      }
      hud.setTimer(Math.max(0, bomb.timer));
      if (bomb.timer <= 0) { explodeBomb(); return; }
    } else {
      hud.setTimer(game.phaseTime);
    }
    if (game.phaseTime <= 0 && bomb.state !== 'planted') {
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
    if (game.phaseTime <= 0) { game.round += 1; startRound(); }
  }

  // Plant / defuse channel: hold E near a site (carrying C4) or a bomb.
  const siteWp = sitePos(bomb.site);
  const nearSite = bomb.state === 'carried' && bomb.carrier === 'player' &&
    Math.hypot(player.pos.x - siteWp.x, player.pos.z - siteWp.z) < 6;
  const nearBomb = bomb.state === 'planted' && bomb.pos &&
    Math.hypot(player.pos.x - bomb.pos.x, player.pos.z - bomb.pos.z) < 2.2;
  if (game.phase === 'live' && !player.dead && (nearSite || nearBomb)) {
    if (keys.has('KeyE')) {
      if (nearSite) {
        bomb.plantProgress += dt;
        hud.showPlantPrompt(`PLANTING BOMB — ${bomb.site} SITE`);
        hud.setPlantProgress(bomb.plantProgress / BOMB.plantSeconds);
        if (bomb.plantProgress >= BOMB.plantSeconds) {
          bomb.plantProgress = 0;
          hud.hidePlantPrompt();
          plantBomb(bomb.site);
        }
      } else {
        bomb.defuseProgress += dt;
        hud.showPlantPrompt('DEFUSING BOMB');
        hud.setPlantProgress(bomb.defuseProgress / BOMB.defuseSeconds);
        if (bomb.defuseProgress >= BOMB.defuseSeconds) {
          bomb.defuseProgress = 0;
          hud.hidePlantPrompt();
          defuseBomb(true);
        }
      }
    } else {
      bomb.plantProgress = 0;
      bomb.defuseProgress = 0;
      hud.showPlantPrompt(nearSite ? `HOLD E TO PLANT — ${bomb.site} SITE` : 'HOLD E TO DEFUSE');
      hud.setPlantProgress(0);
    }
  } else {
    bomb.plantProgress = 0;
    bomb.defuseProgress = 0;
    hud.hidePlantPrompt();
  }

  // Dropped bomb: walk over it to pick it up.
  if (bomb.state === 'carried' && bomb.carrier === null && !player.dead && bomb.pos) {
    if (Math.hypot(player.pos.x - bomb.pos.x, player.pos.z - bomb.pos.z) < 1.5) {
      bomb.carrier = 'player';
      bomb.pos = null;
      hud.addKillfeed({ killer: 'You', victim: 'picked up the bomb', weapon: 'c4', killerTeam: 't', victimTeam: 't' });
    }
  }

  // Movement: WASD + shift run, C/Ctrl crouch, Space jump. AutoPilot
  // drives the same body while it is active.
  if (!player.dead) {
    if (autopilot.active) {
      updateAutopilot(dt);
    } else {
      const speed = player.crouching ? PLAYER.crouchSpeed
        : keys.has('ShiftLeft') || keys.has('ShiftRight') ? PLAYER.runSpeed : PLAYER.walkSpeed;
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
    }
    player.vel.y -= PLAYER.gravity * dt;
    if (keys.has('Space') && player.onGround && !autopilot.active) {
      player.vel.y = PLAYER.jumpSpeed;
      player.onGround = false;
    }
    const nextX = player.pos.x + player.vel.x * dt;
    const nextZ = player.pos.z + player.vel.z * dt;
    if (!collidesAt(map.colliders, nextX, player.pos.z, PLAYER.radius)) player.pos.x = nextX;
    if (!collidesAt(map.colliders, player.pos.x, nextZ, PLAYER.radius)) player.pos.z = nextZ;
    player.pos.y += player.vel.y * dt;
    if (player.pos.y <= 0) { player.pos.y = 0; player.vel.y = 0; player.onGround = true; }
    const eyeHeight = player.crouching ? PLAYER.crouchEyeHeight : PLAYER.eyeHeight;
    camera.position.set(player.pos.x, player.pos.y + eyeHeight, player.pos.z);
  }

  // Weapon: reloads, recoil, hold-to-fire; footsteps per stride.
  if (weapon.finishReload(game.time)) { sounds.play('click'); syncAmmoHud(); }
  const hSpeed = Math.hypot(player.vel.x, player.vel.z);
  const sprinting = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && hSpeed > 1;
  weapon.update(dt, { speed: Math.min(1, hSpeed / PLAYER.runSpeed), sprinting, onGround: player.onGround });
  hud.setCrosshairSpread(4 + weapon.bloom * 12 + Math.min(1, hSpeed / PLAYER.runSpeed) * 5);
  if (player.onGround && hSpeed > 1.5) {
    stepAcc += hSpeed * dt;
    const stride = player.crouching ? 1.6 : 2.3;
    if (stepAcc > stride) { stepAcc = 0; sounds.play('footstep'); }
  }
  if (firing && weapon.def.automatic && game.locked) tryShoot();

  // Bots: each sees its enemies (opposite team + the player for defenders)
  // and reports shots through hooks.
  _playerEye.set(player.pos.x, player.pos.y + PLAYER.eyeHeight, player.pos.z);
  const playerEntry = { ref: 'player', pos: _playerEye, alive: !player.dead };
  const tEntries = tBots.map((b) => ({ ref: b, pos: b.position, alive: b.alive }));
  const ctEntries = ctBots.map((b) => ({ ref: b, pos: b.position, alive: b.alive }));
  const bombCtx = { state: bomb.state, site: bomb.site, pos: bomb.pos };
  for (const bot of bots) {
    const enemies = bot.team === 't' ? ctEntries : [...tEntries, playerEntry];
    bot.update(dt, {
      enemies,
      allies: bot.team === 't' ? tEntries : ctEntries,
      colliders: map.colliders,
      bomb: bombCtx,
      hooks: {
        onShot: (b, muzzlePos, aimPoint) => resolveBotShot(b, muzzlePos, aimPoint),
        onPlant: (b, site) => { if (bomb.state === 'carried') plantBomb(site); },
        onDefuse: (b) => {
          if (bomb.state === 'planted') {
            hud.addKillfeed({ killer: b.name, victim: 'defused the bomb', weapon: 'c4', killerTeam: 'ct', victimTeam: 'ct' });
            defuseBomb(false);
          }
        },
      },
    });
  }

  // Radar: enemies shown only when spotted by the player or a teammate.
  hud.updateRadar({
    yaw: player.yaw,
    player: { x: player.pos.x, z: player.pos.z },
    range: RADAR.range,
    sites: { A: { x: WAYPOINTS.siteA.x, z: WAYPOINTS.siteA.z }, B: { x: WAYPOINTS.siteB.x, z: WAYPOINTS.siteB.z } },
    teammates: tBots.map((b) => ({ x: b.position.x, z: b.position.z, alive: b.alive })),
    enemies: ctBots.map((b) => ({
      x: b.position.x, z: b.position.z, alive: b.alive,
      visible: b.alive && (losClear(player.pos.x, player.pos.y + PLAYER.eyeHeight, player.pos.z, b.position.x, 1.2, b.position.z) ||
        tBots.some((t) => t.alive && losClear(t.position.x, 1.6, t.position.z, b.position.x, 1.2, b.position.z))),
    })),
    bomb: bomb.state === 'planted' && bomb.pos ? { x: bomb.pos.x, z: bomb.pos.z } : null,
  });

  map.update(dt);
}

// --- Render loop ----------------------------------------------------------------------
let last = performance.now();
let accumulator = 0;
let shotFrames = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const frameDt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!game.frozen) {
    accumulator += frameDt;
    while (accumulator >= FIXED_STEP) { step(FIXED_STEP); accumulator -= FIXED_STEP; }
  }
  if (composer) composer.render();
  else renderer.render(scene, camera);
  if (shot && shotFrames < 2) {
    shotFrames += 1;
    if (shotFrames === 2) { game.frozen = true; window.__shotReady = true; }
  }
}

// --- Deterministic capture poses -------------------------------------------------------
// start = freeze (banner up, timer 0:05), play = live round (no banner,
// timer 1:45), end = round-end caption (sticky banner, timer 0:00).
// AutoPilot is disabled in capture mode; the start pose keeps the freeze.
function setupShot() {
  if (shot === 'start') {
    player.pos.set(-28, 0, 0);
    lookAtYawPitch(faceToward(-28, 0, 0, 0), 0);
    // Flank the T teammates to the edges of the frame so the cover shows
    // the yard, the trucks and the Mid wall instead of a teammate's back.
    tBots[0].spawnAt(-24, -5);
    tBots[1].spawnAt(-24, 5);
    tBots[2].spawnAt(-22, -3);
    tBots[3].spawnAt(-22, 3);
    ctBots[2].spawnAt(2, 1);
    ctBots[3].spawnAt(-2, -3);
    hud.setEngagePill(true);
    // Re-assert the freeze banner as sticky: startRound()'s non-sticky call
    // fades after 2.6 s of real time, which elapses before the capture
    // freezes — the cover shot must keep the buy-phase banner up.
    hud.showBanner(`Round ${game.round}`, 'Buy phase — press B to open the shop', true);
  } else if (shot === 'play') {
    // Mid courtyard, looking north-east down the A approach: the A-main
    // crates, the catwalk and the site A beacon in frame, with the yard's
    // ground texture filling the lower half.
    game.phase = 'live';
    game.phaseTime = ROUND.roundSeconds;
    player.pos.set(-6, 0, 2);
    lookAtYawPitch(faceToward(-6, 2, 20, -16), -0.06);
    ctBots[0].spawnAt(14, -8);
    ctBots[1].spawnAt(20, -12);
    ctBots[2].spawnAt(2, -6);
    hud.setEngagePill(false);
    hud.hideBanner();
  } else {
    // end: on site A, looking across the yard at the catwalk and the
    // beacon, defenders holding the site in the frame.
    game.phase = 'end';
    game.phaseTime = ROUND.endSeconds;
    game.score.att = 1; // the end pose depicts an attackers' round win, so the score must read 1:0, not 0:0
    player.pos.set(17, 0, -9);
    lookAtYawPitch(faceToward(17, -9, 22, -20), -0.03);
    ctBots[0].spawnAt(24, -14);
    ctBots[1].spawnAt(19, -18);
    hud.setEngagePill(false);
    hud.showBanner('Attackers win the round', 'Site A secured — +$3250', true);
  }
  hud.setHealth(player.health);
  hud.setAmmo(weapon.mag, weapon.reserve);
  hud.setWeaponName(weapon.def.name);
  hud.setMoney(player.money);
  hud.setScore(game.score.att, game.score.def);
  hud.setRound(game.round);
  hud.setTimer(game.phase === 'end' ? 0 : game.phaseTime);
}

// --- Boot -------------------------------------------------------------------------------
if (shot) {
  respawnAll();
  startRound();
  setupShot();
  game.locked = true; // capture mode runs without pointer lock
} else {
  startFirstRound();
}
hud.setBuyMenuItems(
  BUY_MENU.map((key, i) => ({ key: String(i + 1), weaponKey: key, name: WEAPONS[key].name, price: WEAPONS[key].price })),
);
requestAnimationFrame(animate);
