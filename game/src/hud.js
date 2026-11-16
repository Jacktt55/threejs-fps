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

export function showBanner(text, sub = '', sticky = false) {
  const banner = el('round-banner');
  if (!banner) return;
  banner.querySelector('.banner-title').textContent = text;
  banner.querySelector('.banner-sub').textContent = sub;
  banner.classList.add('show');
  clearTimeout(showBanner._t);
  // Sticky banners (the deterministic end-of-round capture pose) stay up
  // until hideBanner() runs; normal banners fade after 2.6 s.
  if (!sticky) showBanner._t = setTimeout(() => banner.classList.remove('show'), 2600);
}

// Hide the round banner immediately (used when the round goes live and in
// the play/end capture poses, where the game clock is frozen).
export function hideBanner() {
  const banner = el('round-banner');
  if (!banner) return;
  clearTimeout(showBanner._t);
  banner.classList.remove('show');
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

// AWP scope overlay: a dark vignette with a circular sight picture. The
// HUD gains a `scoped` class so the crosshair hides while zoomed.
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

// Flashbang whiteout: slam to full white, then fade out over a duration
// that grows with the strength of the flash.
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
