// Synthesised sound effects via WebAudio. No audio files, no network.
// Every call is guarded so the game keeps working when AudioContext is
// unavailable (headless browser, autoplay policy, or no audio device).
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
  }

  // Create the context on a user gesture (pointer lock / start button).
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
      this.master.gain.value = 0.25;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.25;
  }

  // A short oscillator blip with an exponential decay envelope.
  tone(freq, dur, type = 'square', vol = 0.5, slideTo = null) {
    if (this.muted || !this.ctx || !this.master) return;
    try {
      const t0 = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch {
      // Sound is cosmetic; never let it break the game.
    }
  }

  play(name) {
    if (this.muted) return;
    switch (name) {
      case 'shot':
        this.tone(180, 0.09, 'square', 0.6, 60);
        break;
      case 'reload':
        this.tone(700, 0.05, 'sine', 0.3);
        setTimeout(() => this.tone(500, 0.05, 'sine', 0.3), 120);
        break;
      case 'hit':
        this.tone(1200, 0.06, 'sine', 0.4, 900);
        break;
      case 'kill':
        this.tone(900, 0.08, 'sine', 0.4, 500);
        setTimeout(() => this.tone(1300, 0.1, 'sine', 0.4), 90);
        break;
      case 'roundStart':
        this.tone(440, 0.12, 'sine', 0.35);
        setTimeout(() => this.tone(660, 0.16, 'sine', 0.35), 140);
        break;
      case 'plant':
        this.tone(1000, 0.07, 'square', 0.3);
        break;
      case 'click':
        this.tone(800, 0.04, 'sine', 0.25);
        break;
      default:
        break;
    }
  }
}
