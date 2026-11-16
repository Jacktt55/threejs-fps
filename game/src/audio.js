export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.volume = 0.25;
    this.master = null;
    this.noiseBuf = null;
    this._stepAlt = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate);
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : this.volume;
  }

  setVolume(level) {
    this.volume = Math.max(0, Math.min(1, level));
    if (this.master && !this.muted) this.master.gain.value = this.volume;
  }

  get ready() {
    return !!this.ctx && !this.muted;
  }

  tone(freq, dur, type = 'square', vol = 0.5, slideTo = null, delay = 0) {
    if (this.muted || !this.ctx || !this.master) return;
    try {
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(1, freq), t0);
      if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch {
    }
  }

  noise(dur, vol = 0.5, { type = 'lowpass', freq = 1200, q = 0.8, slideTo = null, delay = 0 } = {}) {
    if (this.muted || !this.ctx || !this.master || !this.noiseBuf) return;
    try {
      const t0 = this.ctx.currentTime + delay;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.setValueAtTime(Math.max(20, freq), t0);
      filter.Q.value = q;
      if (slideTo !== null) filter.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    } catch {
    }
  }

  click(freq = 2400, vol = 0.3, delay = 0) {
    this.tone(freq, 0.03, 'sine', vol, freq * 0.6, delay);
    this.noise(0.02, vol * 0.6, { type: 'highpass', freq: 4000, delay });
  }

  shotAk47() {
    this.noise(0.1, 0.85, { type: 'lowpass', freq: 2600, slideTo: 320 });
    this.noise(0.03, 0.5, { type: 'bandpass', freq: 3200, q: 1.5 });
    this.tone(170, 0.1, 'square', 0.5, 55);
  }

  shotM4a1() {
    this.noise(0.07, 0.4, { type: 'bandpass', freq: 1900, q: 1.2, slideTo: 900 });
    this.tone(230, 0.07, 'triangle', 0.28, 95);
  }

  shotAwp() {
    this.noise(0.2, 1.0, { type: 'lowpass', freq: 3600, slideTo: 180 });
    this.noise(0.05, 0.6, { type: 'bandpass', freq: 2800, q: 1.5 });
    this.tone(95, 0.24, 'square', 0.65, 32);
    this.tone(52, 0.3, 'sine', 0.5, 28);
    this.click(1800, 0.35, 0.38);
    this.click(1400, 0.35, 0.55);
  }

  shotMp5() {
    this.noise(0.05, 0.55, { type: 'bandpass', freq: 2300, q: 1.4, slideTo: 1100 });
    this.tone(210, 0.06, 'square', 0.35, 85);
  }

  shotDeagle() {
    this.noise(0.24, 1.0, { type: 'lowpass', freq: 1000, slideTo: 120 });
    this.tone(120, 0.26, 'square', 0.7, 30);
    this.tone(48, 0.34, 'sine', 0.6, 26);
  }

  shotKnife() {
    this.noise(0.13, 0.35, { type: 'bandpass', freq: 500, q: 2, slideTo: 2600 });
  }

  dryFire() {
    this.click(1100, 0.25);
  }

  playReload(reloadTime = 2.5) {
    const t = Math.max(0.6, reloadTime);
    this.click(2000, 0.35, 0.02);
    this.noise(0.05, 0.25, { type: 'bandpass', freq: 1500, q: 2, delay: t * 0.22 });
    this.click(1600, 0.35, t * 0.3);
    this.click(2300, 0.35, t * 0.62);
    this.noise(0.06, 0.3, { type: 'bandpass', freq: 1100, q: 2, delay: t * 0.66 });
    this.click(2600, 0.4, t * 0.9);
  }

  hit() {
    this.tone(1250, 0.06, 'sine', 0.4, 900);
  }

  headshot() {
    this.tone(2450, 0.13, 'sine', 0.5, 2100);
    this.tone(3680, 0.09, 'sine', 0.3, 3200);
  }

  kill() {
    this.tone(900, 0.08, 'sine', 0.4, 500);
    this.tone(1350, 0.11, 'sine', 0.4, 900, 0.09);
  }

  footstep() {
    this._stepAlt = 1 - this._stepAlt;
    const base = this._stepAlt === 0 ? 320 : 260;
    this.noise(0.06, 0.16, { type: 'lowpass', freq: base, slideTo: 140 });
  }

  pin() {
    this.click(3200, 0.4);
    this.tone(900, 0.04, 'square', 0.2, 500, 0.05);
  }

  bounce() {
    this.tone(150, 0.09, 'sine', 0.3, 65);
    this.noise(0.04, 0.15, { type: 'lowpass', freq: 500 });
  }

  explosion() {
    this.noise(0.9, 1.1, { type: 'lowpass', freq: 900, slideTo: 55 });
    this.noise(0.08, 0.7, { type: 'bandpass', freq: 2400, q: 1 });
    this.tone(70, 0.8, 'sine', 0.8, 28);
    this.tone(45, 1.0, 'sine', 0.55, 24, 0.08);
  }

  flashbang() {
    this.noise(0.06, 0.8, { type: 'highpass', freq: 2500 });
    this.tone(3150, 1.6, 'sine', 0.22, 2900);
    this.tone(4720, 1.1, 'sine', 0.1, 4400, 0.05);
  }

  smokePop() {
    this.noise(0.35, 0.4, { type: 'bandpass', freq: 700, q: 0.8, slideTo: 250 });
  }

  c4Beep() {
    this.tone(1250, 0.07, 'square', 0.32);
  }

  c4Countdown(beeps = 8, startInterval = 0.9) {
    let delay = 0;
    let interval = startInterval;
    for (let i = 0; i < beeps; i++) {
      this.c4BeepAt(delay);
      delay += interval;
      interval = Math.max(0.22, interval * 0.82);
    }
  }

  c4BeepAt(delay) {
    this.tone(1250, 0.07, 'square', 0.32, null, delay);
  }

  plant() {
    this.tone(1000, 0.07, 'square', 0.3);
    this.tone(1000, 0.07, 'square', 0.3, null, 0.16);
    this.tone(1400, 0.12, 'square', 0.3, null, 0.34);
  }

  defuse() {
    this.tone(1150, 0.06, 'square', 0.28);
    this.tone(1150, 0.06, 'square', 0.28, null, 0.14);
  }

  roundStart() {
    this.tone(440, 0.12, 'sine', 0.35);
    this.tone(660, 0.18, 'sine', 0.35, null, 0.14);
  }

  clickUi() {
    this.click(800, 0.25);
  }

  impact() {
    this.noise(0.05, 0.3, { type: 'bandpass', freq: 900, q: 1.2 });
  }

  play(name, opts) {
    if (this.muted || !this.ctx) return;
    switch (name) {
      case 'shot':
        this.playShot(opts?.key ?? 'ak47');
        break;
      case 'shotAk47':
        this.shotAk47();
        break;
      case 'shotM4a1':
        this.shotM4a1();
        break;
      case 'shotAwp':
        this.shotAwp();
        break;
      case 'shotMp5':
        this.shotMp5();
        break;
      case 'shotDeagle':
        this.shotDeagle();
        break;
      case 'shotKnife':
        this.shotKnife();
        break;
      case 'dryFire':
        this.dryFire();
        break;
      case 'reload':
        this.playReload(opts?.reloadTime ?? 2.5);
        break;
      case 'hit':
        this.hit();
        break;
      case 'headshot':
        this.headshot();
        break;
      case 'kill':
        this.kill();
        break;
      case 'footstep':
        this.footstep();
        break;
      case 'pin':
        this.pin();
        break;
      case 'bounce':
        this.bounce();
        break;
      case 'explosion':
        this.explosion();
        break;
      case 'flashbang':
        this.flashbang();
        break;
      case 'smokePop':
        this.smokePop();
        break;
      case 'c4Beep':
        this.c4Beep();
        break;
      case 'plant':
        this.plant();
        break;
      case 'defuse':
        this.defuse();
        break;
      case 'roundStart':
        this.roundStart();
        break;
      case 'impact':
        this.impact();
        break;
      case 'click':
        this.clickUi();
        break;
      default:
        break;
    }
  }

  playShot(key) {
    switch (key) {
      case 'ak47':
        this.shotAk47();
        break;
      case 'm4a1':
        this.shotM4a1();
        break;
      case 'awp':
        this.shotAwp();
        break;
      case 'mp5':
        this.shotMp5();
        break;
      case 'deagle':
        this.shotDeagle();
        break;
      case 'knife':
        this.shotKnife();
        break;
      default:
        this.shotAk47();
        break;
    }
  }
}
