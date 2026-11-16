
export const FIXED_STEP = 1 / 60;

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

export const BUY_MENU = ['ak47', 'm4a1', 'awp', 'mp5', 'deagle', 'he', 'flash', 'smoke', 'kevlar'];

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

export const ECONOMY = {
  startMoney: 800,
  maxMoney: 16000,
  winReward: 3250,
  lossReward: 1900,
  killReward: 300,
  plantReward: 300,
  defuseReward: 300,
};

export const ROUND = {
  freezeSeconds: 5,
  roundSeconds: 105,
  endSeconds: 5,
  c4Seconds: 40,
};

export const MAP = {
  halfWidth: 32,
  halfDepth: 24,
  wallHeight: 4,
};

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

export const HIT_ZONES = { head: 4, torso: 1, limb: 0.75 };

export const BOT = {
  walkSpeed: 2.6,
  runSpeed: 3.6,
  sightRange: 32,
  engageRange: 26,
  holdRange: 9,
  loseSightSeconds: 2.5,
  reactionMin: 0.35,
  reactionMax: 0.6,
  burstMin: 3,
  burstMax: 5,
  burstPauseMin: 0.6,
  burstPauseMax: 1.2,
  hitBase: 0.55, // hit chance inside 10 m, before falloff/movement
  hitFalloff: 0.018, // chance lost per metre past 10 m
  hitMovingTarget: 0.7, // multiplier when the target is moving fast
  headshotChance: 0.08,
  strafeSeconds: 1.4,
  holdSeconds: 2.0,
  rotateSeconds: 6,
};

export const BOT_ROSTER = {
  attackers: [
    { name: 'Dune', weapon: 'ak47', route: 'tLongA' },
    { name: 'Ember', weapon: 'm4a1', route: 'tMidA' },
    { name: 'Falk', weapon: 'mp5', route: 'tTunnelsB' },
    { name: 'Havoc', weapon: 'ak47', route: 'tMidB' },
  ],
  defenders: [
    { name: 'Sable', weapon: 'm4a1', route: 'ctA' },
    { name: 'Vex', weapon: 'mp5', route: 'ctB' },
    { name: 'Iris', weapon: 'awp', route: 'ctMid' },
    { name: 'Rook', weapon: 'ak47', route: 'ctA' },
    { name: 'Onyx', weapon: 'm4a1', route: 'ctB' },
  ],
};

export const BOMB = {
  plantSeconds: 3,
  defuseSeconds: 5,
  radius: 9,
  damage: 220,
  beepStart: 1.0, // first beep interval; shrinks as the timer runs down
  beepMin: 0.22,
  beepShrink: 0.82,
};

export const AUTOPILOT = {
  engageDelay: 0.3,
  walkSpeed: 3.2,
  aimLerp: 6, // yaw/pitch smoothing rate towards the target
  burstShots: 3, // shots per burst, then a short pause
  burstPause: 0.7,
  path: [
    { x: -28, z: 0 },
    { x: -14, z: 0 },
    { x: -6, z: 0 },
    { x: 2, z: -4 },
    { x: 10, z: -8 },
    { x: 14, z: -12 },
    { x: 18, z: -14 },
  ],
};

export const BLOOM = { strength: 0.35, radius: 0.4, threshold: 0.85 };
export const TONE_EXPOSURE = 1.05;

export const BUY_WINDOW_SECONDS = 15;

export const RADAR = { range: 40, playerDot: 4, botDot: 3, siteDot: 5 };
