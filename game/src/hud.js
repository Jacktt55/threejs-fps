function el(id) {
  return document.getElementById(id);
}

const SVG = {
  ak47: '<svg viewBox="0 0 64 20"><path d="M2 7h28l3-3h13l3 3h13v4H46l-2 6h-6l2-6H24l-3 5h-6l2-5H2z"/></svg>',
  m4a1: '<svg viewBox="0 0 64 20"><path d="M2 7h30l2-3h10l2 3h16v4H44l-1 5h-6l1-5H20l-1 5h-5l1-5H2z"/></svg>',
  awp: '<svg viewBox="0 0 64 20"><path d="M2 8h22l2-4h12l2 4h22v3H40l-1 4h-5l1-4H20l-1 4h-5l1-4H2z"/></svg>',
  mp5: '<svg viewBox="0 0 64 20"><path d="M2 7h26l2-2h8l2 2h10l2-2h12v4H50l-1 5h-5l1-5H20l-1 4h-5l1-4H2z"/></svg>',
  deagle: '<svg viewBox="0 0 64 20"><path d="M6 4h30l3 3v3H20l-2 7H12l2-7H6z"/></svg>',
  knife: '<svg viewBox="0 0 64 20"><path d="M4 12L52 5l8 2-46 6-4 3H4z"/></svg>',
  c4: '<svg viewBox="0 0 64 20"><path d="M8 5h34v10H8zM44 8h8l4 2-4 2h-8z"/></svg>',
  he: '<svg viewBox="0 0 64 20"><circle cx="32" cy="10" r="7"/><path d="M38 4h6M36 8l6-3"/></svg>',
  flash: '<svg viewBox="0 0 64 20"><rect x="24" y="3" width="14" height="14" rx="3"/><path d="M31 3V1M31 19v-2"/></svg>',
  smoke: '<svg viewBox="0 0 64 20"><rect x="24" y="3" width="14" height="14" rx="3"/><path d="M26 8h10M26 12h10"/></svg>',
  kevlar: '<svg viewBox="0 0 64 20"><path d="M20 3h24l4 6-6 8H22l-6-8z"/></svg>',
  headshot: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 2v3M8 11v3M2 8h3M11 8h3" stroke="currentColor" stroke-width="1.6"/></svg>',
  wallbang: '<svg viewBox="0 0 16 16"><path d="M3 2v12M13 2v12" stroke="currentColor" stroke-width="2"/><path d="M1 8h14" stroke="currentColor" stroke-width="1.4"/></svg>',
};

export function weaponSvg(key) {
  return SVG[key] ?? SVG.ak47;
}

export function setHealth(hp) {
  const num = el('health-num');
  if (num) num.textContent = String(Math.max(0, Math.ceil(hp)));
  const fill = el('health-fill');
  if (fill) fill.style.width = `${Math.max(0, Math.min(100, hp))}%`;
}

export function setArmor(value, visible) {
  const wrap = el('armor-wrap');
  if (!wrap) return;
  wrap.classList.toggle('hidden', !visible);
  const fill = el('armor-fill');
  if (fill) fill.style.width = `${Math.max(0, Math.min(100, value))}%`;
}

export function setAmmo(mag, reserve, reloading = false) {
  const magEl = el('ammo-mag');
  if (magEl) magEl.textContent = String(mag);
  const resEl = el('ammo-reserve');
  if (resEl) resEl.textContent = String(reserve);
  const wrap = el('ammo');
  if (wrap) wrap.classList.toggle('reloading', reloading);
}

export function setWeaponName(name) {
  const nameEl = el('weapon-name');
  if (nameEl) nameEl.textContent = name;
}

export function setTimer(seconds) {
  const timer = el('timer');
  if (!timer) return;
  const s = Math.max(0, Math.ceil(seconds));
  timer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function setScore(attackers, defenders) {
  const att = el('score-att');
  if (att) att.textContent = String(attackers);
  const def = el('score-def');
  if (def) def.textContent = String(defenders);
}

export function setMoney(amount) {
  const money = el('money');
  if (money) money.textContent = `$${amount}`;
  const wheelMoney = el('buy-money');
  if (wheelMoney) wheelMoney.textContent = `$${amount}`;
}

export function setRound(n) {
  const round = el('round-label');
  if (round) round.textContent = `Round ${n}`;
}

export function setCrosshairSpread(px) {
  const ch = el('crosshair');
  if (ch) ch.style.setProperty('--gap', `${Math.max(3, Math.min(18, px))}px`);
}

export function flashHitmarker(kill = false, headshot = false) {
  const marker = el('hitmarker');
  if (!marker) return;
  marker.classList.add('show');
  marker.classList.toggle('kill', kill);
  marker.classList.toggle('head', headshot);
  clearTimeout(flashHitmarker._t);
  flashHitmarker._t = setTimeout(() => marker.classList.remove('show', 'kill', 'head'), 140);
}

export function flashHurt() {
  const hudEl = el('hud');
  if (!hudEl) return;
  hudEl.classList.add('hurt');
  clearTimeout(flashHurt._t);
  flashHurt._t = setTimeout(() => hudEl.classList.remove('hurt'), 220);
}

export function showBanner(text, sub = '', sticky = false) {
  const banner = el('round-banner');
  if (!banner) return;
  banner.querySelector('.banner-title').textContent = text;
  banner.querySelector('.banner-sub').textContent = sub;
  banner.classList.add('show');
  clearTimeout(showBanner._t);
  if (!sticky) showBanner._t = setTimeout(() => banner.classList.remove('show'), 2600);
}

export function hideBanner() {
  const banner = el('round-banner');
  if (!banner) return;
  clearTimeout(showBanner._t);
  banner.classList.remove('show');
}

export function addKillfeed({ killer, victim, weapon, headshot = false, wallbang = false, killerTeam = 't', victimTeam = 'ct' } = {}) {
  const feed = el('killfeed');
  if (!feed) return;
  const line = document.createElement('div');
  line.className = 'killfeed-line';
  line.innerHTML =
    `<span class="kf-name kf-${killerTeam}">${killer}</span>` +
    `<span class="kf-weapon">${weaponSvg(weapon)}</span>` +
    (headshot ? `<span class="kf-icon kf-head">${SVG.headshot}</span>` : '') +
    (wallbang ? `<span class="kf-icon">${SVG.wallbang}</span>` : '') +
    `<span class="kf-name kf-${victimTeam}">${victim}</span>`;
  feed.prepend(line);
  while (feed.children.length > 5) feed.removeChild(feed.lastChild);
  setTimeout(() => line.remove(), 6000);
}

const RADAR_WALLS = [
  [-32, -24, 32, -24], [-32, 24, 32, 24], [-32, -24, -32, 24], [32, -24, 32, 24],
  [-6, -10, -6, -2], [-6, 2, -6, 10], [-32, -18, 12, -18], [24, -18, 32, -18],
  [20, -10, 32, -10], [18, 8, 32, 8], [-28, 18, 8, 18],
];

export function updateRadar(data) {
  const canvas = el('radar');
  if (!canvas || !data) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const s = canvas.width;
  const range = data.range;
  const k = (s / 2 - 6) / range;
  ctx.clearRect(0, 0, s, s);
  ctx.save();
  ctx.translate(s / 2, s / 2);
  ctx.rotate(data.yaw);
  const px = data.player.x;
  const pz = data.player.z;
  ctx.strokeStyle = 'rgba(233,230,223,0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const [x1, z1, x2, z2] of RADAR_WALLS) {
    ctx.moveTo((x1 - px) * k, (z1 - pz) * k);
    ctx.lineTo((x2 - px) * k, (z2 - pz) * k);
  }
  ctx.stroke();
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f2a33c';
  ctx.fillText('A', (data.sites.A.x - px) * k, (data.sites.A.z - pz) * k);
  ctx.fillStyle = '#53c785';
  ctx.fillText('B', (data.sites.B.x - px) * k, (data.sites.B.z - pz) * k);
  if (data.bomb) {
    ctx.fillStyle = '#ff4d3d';
    ctx.beginPath();
    ctx.arc((data.bomb.x - px) * k, (data.bomb.z - pz) * k, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const t of data.teammates) {
    if (!t.alive) continue;
    ctx.fillStyle = '#7fa8d8';
    ctx.beginPath();
    ctx.arc((t.x - px) * k, (t.z - pz) * k, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const e of data.enemies) {
    if (!e.alive || !e.visible) continue;
    ctx.fillStyle = '#ff4d3d';
    ctx.beginPath();
    ctx.arc((e.x - px) * k, (e.z - pz) * k, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = '#e9e6df';
  ctx.beginPath();
  ctx.moveTo(s / 2, s / 2 - 6);
  ctx.lineTo(s / 2 + 4, s / 2 + 5);
  ctx.lineTo(s / 2 - 4, s / 2 + 5);
  ctx.closePath();
  ctx.fill();
}

export function setEngagePill(show) {
  const pill = el('engage-pill');
  if (pill) pill.classList.toggle('hidden', !show);
}

export function showPlantPrompt(text) {
  const p = el('plant-prompt');
  if (!p) return;
  p.textContent = text;
  p.classList.add('show');
}

export function setPlantProgress(frac) {
  const fill = el('plant-fill');
  if (fill) fill.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
}

export function hidePlantPrompt() {
  const p = el('plant-prompt');
  if (p) p.classList.remove('show');
  setPlantProgress(0);
}

let onBuyItem = null;
export function setOnBuyItem(fn) {
  onBuyItem = fn;
}

export function openBuyMenu() {
  const menu = el('buy-menu');
  if (menu) menu.classList.add('open');
}

export function closeBuyMenu() {
  const menu = el('buy-menu');
  if (menu) menu.classList.remove('open');
}

export function setBuyMenuItems(items) {
  const wheel = el('buy-wheel');
  if (!wheel) return;
  wheel.innerHTML = '';
  const n = items.length;
  items.forEach((item, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'buy-slot';
    slot.style.setProperty('--ang', `${angle}rad`);
    slot.innerHTML =
      `<span class="buy-key">${item.key}</span>` +
      `<span class="buy-svg">${weaponSvg(item.weaponKey ?? 'ak47')}</span>` +
      `<span class="buy-name">${item.name}</span>` +
      `<span class="buy-price">$${item.price}</span>`;
    slot.addEventListener('click', () => onBuyItem?.(item.weaponKey ?? item.key));
    wheel.appendChild(slot);
  });
}

export function showScoreboard(rows) {
  const board = el('scoreboard');
  if (!board) return;
  const fill = (team, tbodyId) => {
    const tbody = el(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '';
    for (const r of rows.filter((x) => x.team === team)) {
      const tr = document.createElement('tr');
      if (r.isPlayer) tr.className = 'me';
      tr.innerHTML = `<td>${r.name}</td><td>${r.kills}</td><td>${r.deaths}</td><td>$${r.money}</td>`;
      tbody.appendChild(tr);
    }
  };
  fill('t', 'score-t');
  fill('ct', 'score-ct');
  board.classList.add('show');
}

export function hideScoreboard() {
  const board = el('scoreboard');
  if (board) board.classList.remove('show');
}

export function showScope(level) {
  const overlay = el('scope-overlay');
  if (overlay) {
    overlay.classList.add('show');
    const label = el('scope-label');
    if (label) label.textContent = level === 2 ? '5.0x' : '2.5x';
  }
  const hudEl = el('hud');
  if (hudEl) hudEl.classList.add('scoped');
}

export function hideScope() {
  const overlay = el('scope-overlay');
  if (overlay) overlay.classList.remove('show');
  const hudEl = el('hud');
  if (hudEl) hudEl.classList.remove('scoped');
}

export function flashbang(strength) {
  const overlay = el('flash-overlay');
  if (!overlay) return;
  const s = Math.max(0, Math.min(1, strength));
  if (s <= 0.03) return;
  overlay.style.transition = 'none';
  overlay.style.opacity = String(s);
  void overlay.offsetWidth; // force the style to apply before fading
  const fadeMs = 600 + s * 1800;
  overlay.style.transition = `opacity ${fadeMs}ms ease-out`;
  overlay.style.opacity = '0';
}

export function setWeaponSelector(slots, activeKey) {
  const wrap = el('weapon-selector');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (const slot of slots) {
    const d = document.createElement('div');
    d.className = 'ws-slot' + (slot.key === activeKey ? ' active' : '') + (slot.owned ? '' : ' dim');
    d.innerHTML = `<span class="ws-svg">${weaponSvg(slot.key)}</span><span class="ws-key">${slot.hotkey}</span>`;
    wrap.appendChild(d);
  }
}
