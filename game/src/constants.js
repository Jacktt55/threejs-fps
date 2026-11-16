// Dustyard — full game balance constants: weapons, teams, economy, timers and
// the waypoint graph. The map in map.js is built to these exact coordinates,
// so a waypoint here always sits on walkable ground in the arena.

// The simulation runs at a fixed 60 Hz, apart from rendering.
export const FIXED_STEP = 1 / 60;

// ---------------------------------------------------------------------------
// Teams: Counter-Terrorists (navy / steel) vs Terrorists (desert / crimson).
// Each side carries both a three.js hex and a CSS string for the HUD.
// ---------------------------------------------------------------------------
export const TEAMS = {
  ct: {
    name: 'Counter-Terrorists',
    short: 'CT',
    color: 0x2e5a88, // navy
    colorCss: '#2e5a88',
    accent: 0x8fa3b8, // steel
    accentCss: '#8fa3b8',
  },
  t: {
    name: 'Terrorists',
    short: 'T',
    color: 0xc8a165, // desert sand
    colorCss: '#c8a165',
    accent: 0xb03a2e, // crimson
    accentCss: '#b03a2e',
  },
};

export const PALETTE = {
  canvas: 0x14161a,
  surface: 0x1e2228,
  hairline: 0x2c323a,
  ink: 0xe9e6df,
  muted: 0x98a0a8,
  accent: 0xf2a33c,
  accentCss: '#f2a33c',
  siteA: 0xf2a33c,
  siteB: 0x53c785,
};

// ---------------------------------------------------------------------------
// Weapons. Firearms carry damage (body hit, close range), headshot multiplier,
// fire rate (seconds between shots), magazine and reserve ammo, reload time,
// spread (radians, standing still), recoil (pitch kick per shot) and a
// movement penalty (fraction of speed lost while the weapon is held).
// Grenades carry a blast radius and a fuse instead of a magazine; armour
// carries a damage-reduction fraction instead of damage.
// ---------------------------------------------------------------------------
export const WEAPONS = {
  ak47: {
    kind: 'rifle',
    name: 'AK-47',
    damage: 36,
    headshot: 4,
    fireRate: 0.1,
    magSize: 30,
    reserve: 90,
    reloadTime: 2.5,
    spread: 0.011,
    moveSpread: 0.032,
    recoil: 0.012,
    movePenalty: 0.08,
    price: 2700,
    automatic: true,
  },
  m4a1: {
    kind: 'rifle',
    name: 'M4A1',
    damage: 33,
    headshot: 4,
    fireRate: 0.09,
    magSize: 30,
    reserve: 90,
    reloadTime: 2.4,
    spread: 0.009,
    moveSpread: 0.028,
    recoil: 0.009,
    movePenalty: 0.06,
    price: 3100,
    automatic: true,
  },
  awp: {
    kind: 'sniper',
    name: 'AWP',
    damage: 115,
    headshot: 2,
    fireRate: 1.45,
    magSize: 5,
    reserve: 15,
    reloadTime: 3.7,
    spread: 0.001,
    moveSpread: 0.09,
    recoil: 0.05,
    movePenalty: 0.18,
    price: 4750,
    automatic: false,
  },
  mp5: {
    kind: 'smg',
    name: 'MP5',
    damage: 26,
    headshot: 4,
    fireRate: 0.075,
    magSize: 32,
    reserve: 96,
    reloadTime: 2.1,
    spread: 0.018,
    moveSpread: 0.04,
    recoil: 0.007,
    movePenalty: 0.02,
    price: 1500,
    automatic: true,
  },
  deagle: {
    kind: 'pistol',
    name: 'Desert Eagle',
    damage: 53,
    headshot: 4,
    fireRate: 0.27,
    magSize: 7,
    reserve: 21,
    reloadTime: 2.2,
    spread: 0.012,
    moveSpread: 0.03,
    recoil: 0.02,
    movePenalty: 0.0,
    price: 700,
    automatic: false,
  },
  he: {
    kind: 'grenade',
    name: 'HE Grenade',
    damage: 90,
    radius: 5.5,
    fuse: 1.6,
    count: 1,
    price: 300,
  },
  flash: {
    kind: 'grenade',
    name: 'Flashbang',
    damage: 0,
    radius: 9,
    fuse: 1.4,
    count: 1,
    price: 200,
  },
  smoke: {
    kind: 'grenade',
    name: 'Smoke Grenade',
    damage: 0,
    radius: 6,
    fuse: 1.8,
    count: 1,
    price: 300,
  },
  kevlar: {
    kind: 'armor',
    name: 'Kevlar + Helmet',
    damageReduction: 0.5,
    headshotReduction: 0.5,
    price: 1000,
  },
};

// Buy-menu order: what the shop shows, in the order it shows it.
export const BUY_MENU = ['ak47', 'm4a1', 'awp', 'mp5', 'deagle', 'he', 'flash', 'smoke', 'kevlar'];

// ---------------------------------------------------------------------------
// Player movement and body. The player is a circle of `radius` in the XZ
// plane; the eye sits at eyeHeight (crouchEyeHeight while crouching).
// ---------------------------------------------------------------------------
export const PLAYER = {
  walkSpeed: 4.4,
  runSpeed: 6.4,
  crouchSpeed: 2.2,
  eyeHeight: 1.62,
  crouchEyeHeight: 1.05,
  radius: 0.38,
  gravity: 18,
  jumpSpeed: 6.2,
  accel: 42,
  friction: 11,
};

// ---------------------------------------------------------------------------
// Economy. Money is awarded at the end of each round and for kills, plants
// and defuses; the buy menu spends it during the freeze time.
// ---------------------------------------------------------------------------
export const ECONOMY = {
  startMoney: 800,
  maxMoney: 16000,
  winReward: 3250,
  lossReward: 1900,
  killReward: 300,
  plantReward: 300,
  defuseReward: 300,
};

// ---------------------------------------------------------------------------
// Round timers (seconds).
// ---------------------------------------------------------------------------
export const ROUND = {
  freezeSeconds: 5,
  roundSeconds: 105,
  endSeconds: 5,
  c4Seconds: 40,
};

// ---------------------------------------------------------------------------
// Map bounds in world units (x east-west, z north-south, y up).
// ---------------------------------------------------------------------------
export const MAP = {
  halfWidth: 32,
  halfDepth: 24,
  wallHeight: 4,
};

// ---------------------------------------------------------------------------
// Waypoints. Every coordinate matches a walkable spot in map.js:
//   T Spawn (west) and CT Spawn (east); Bombsite A (north-east yard, with a
//   catwalk); Bombsite B (south-east container yard); Mid courtyard with
//   double doors; Long A corridor along the north edge; B Tunnels along the
//   south edge. Routes are ordered waypoint keys a bot follows in order.
// ---------------------------------------------------------------------------
export const WAYPOINTS = {
  tSpawn: { x: -28, z: 0 },
  ctSpawn: { x: 28, z: 0 },
  siteA: { x: 20, z: -16 },
  siteB: { x: 20, z: 14 },
  mid: { x: 0, z: 0 },
  midDoors: { x: -6, z: 0 },
  longAStart: { x: -26, z: -21 },
  longACorner: { x: 14, z: -21 },
  longAEntry: { x: 16, z: -16 },
  tunnelsEntry: { x: -26, z: 20.5 },
  tunnelsMid: { x: -8, z: 20.5 },
  tunnelsExit: { x: 10, z: 20.5 },
  tunnelsIntoB: { x: 10, z: 16 },
  aMain: { x: 14, z: -6 },
  bMain: { x: 14, z: 6 },
  catwalk: { x: 22, z: -20 },
  aYard: { x: 26, z: -13 },
  bYard: { x: 26, z: 18 },
};

export const ROUTES = {
  tLongA: ['tSpawn', 'longAStart', 'longACorner', 'longAEntry', 'siteA'],
  tMidA: ['tSpawn', 'midDoors', 'mid', 'aMain', 'siteA'],
  tTunnelsB: ['tSpawn', 'tunnelsEntry', 'tunnelsMid', 'tunnelsExit', 'tunnelsIntoB', 'siteB'],
  tMidB: ['tSpawn', 'midDoors', 'mid', 'bMain', 'siteB'],
  ctA: ['ctSpawn', 'aMain', 'siteA'],
  ctB: ['ctSpawn', 'bMain', 'siteB'],
  ctMid: ['ctSpawn', 'mid', 'midDoors'],
};

// Five spawn slots per team, fanned around the spawn waypoint.
export const SPAWN_POINTS = {
  attackers: [
    { x: -28, z: -2 },
    { x: -28, z: 2 },
    { x: -30, z: -1 },
    { x: -30, z: 1 },
    { x: -26, z: 0 },
  ],
  defenders: [
    { x: 28, z: -2 },
    { x: 28, z: 2 },
    { x: 30, z: -1 },
    { x: 30, z: 1 },
    { x: 26, z: 0 },
  ],
};
