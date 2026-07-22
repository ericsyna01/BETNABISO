import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SoundService {
  private ctx: AudioContext | null = null;

  /** À appeler lors de la première interaction (ngOnInit du layout) pour débloquer l'AudioContext */
  init(): void {
    try {
      this.ctx = new AudioContext();
      // Certains navigateurs démarrent en mode "suspended" — on le résout dès la première interaction
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch { /* AudioContext non supporté */ }
  }

  private getCtx(): AudioContext | null {
    if (!this.ctx) return null;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  private beep(
    freq: number,
    duration: number,
    delay = 0,
    type: OscillatorType = 'sine',
    vol = 0.25
  ): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    const t = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  /** Chime doux (deux notes) — message reçu */
  playMessage(): void {
    this.beep(880,  0.15, 0,    'sine', 0.45);
    this.beep(1100, 0.20, 0.16, 'sine', 0.40);
  }

  /** Triple bip carré urgent — nouvelle intervention assignée */
  playIntervention(): void {
    this.beep(740, 0.09, 0,    'square', 0.55);
    this.beep(740, 0.09, 0.18, 'square', 0.55);
    this.beep(988, 0.18, 0.36, 'square', 0.55);
  }

  /** Mélodie ascendante (do-mi-sol) — mission interne reçue */
  playMission(): void {
    this.beep(523, 0.12, 0,    'sine', 0.45);
    this.beep(659, 0.12, 0.15, 'sine', 0.45);
    this.beep(784, 0.25, 0.30, 'sine', 0.45);
  }
}
