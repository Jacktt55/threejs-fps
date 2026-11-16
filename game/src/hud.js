// HUD updaters, bound to the element ids in index.html. Every function is a
// no-op when its element is missing, so the HUD never breaks the game.
function el(id) {
  return document.getElementById(id);
}

export function setHealth(hp) {
  const num = el('health-num');
  if (num) num.textContent = String(Math.max(0, Math.ceil(hp)));
  const fill = el('health-fill');
  if (fill) fill.style.width = `${Math.max(0, Math.min(100, hp))}%`;
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
}

export function setRound(n) {
  const round = el('round-label');
  if (round) round.textContent = `Round ${n}`;
}

export function showBanner(text, sub = '') {
  const banner = el('round-banner');
  if (!banner) return;
  banner.querySelector('.banner-title').textContent = text;
  banner.querySelector('.banner-sub').textContent = sub;
  banner.classList.add('show');
  clearTimeout(showBanner._t);
  showBanner._t = setTimeout(() => banner.classList.remove('show'), 2600);
}

export function addKillfeed(text) {
  const feed = el('killfeed');
  if (!feed) return;
  const line = document.createElement('div');
  line.className = 'killfeed-line';
  line.textContent = text;
  feed.prepend(line);
  while (feed.children.length > 5) feed.removeChild(feed.lastChild);
  setTimeout(() => line.remove(), 6000);
}

export function flashHitmarker(kill = false) {
  const marker = el('hitmarker');
  if (!marker) return;
  marker.classList.add('show');
  marker.classList.toggle('kill', kill);
  clearTimeout(flashHitmarker._t);
  flashHitmarker._t = setTimeout(() => marker.classList.remove('show', 'kill'), 140);
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
  const list = el('buy-menu-items');
  if (!list) return;
  list.innerHTML = '';
  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'buy-row';
    row.innerHTML = `<span class="buy-key">${item.key}</span><span class="buy-name">${item.name}</span><span class="buy-price">$${item.price}</span>`;
    list.appendChild(row);
  }
}

export function hideStartOverlay() {
  const overlay = el('start-overlay');
  if (overlay) overlay.classList.add('hidden');
}

export function showStartOverlay() {
  const overlay = el('start-overlay');
  if (overlay) overlay.classList.remove('hidden');
}
