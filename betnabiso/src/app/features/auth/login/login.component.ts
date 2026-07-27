import { AfterViewInit, Component, ElementRef, inject, OnDestroy, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="login-stage">
      <canvas #net class="net-canvas"></canvas>

      <div class="ledger-card">
        <img src="logo.png" alt="BETNABISO" class="crest-mark" onerror="this.style.display='none'">
        <h1 class="wordmark">BETNABISO</h1>
        <p class="tagline">Solutions technologiques &amp; assistance</p>

        <div class="hairline"></div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="login-form">
          @if (error()) {
            <div class="error-alert" role="alert">
              <mat-icon>error_outline</mat-icon>
              <span>{{ error() }}</span>
            </div>
          }

          <div class="field" [class.focused]="userFocus()">
            <label>Identifiant</label>
            <div class="field-row" [class.invalid]="form.get('username')?.invalid && form.get('username')?.touched">
              <mat-icon>person_outline</mat-icon>
              <input
                formControlName="username"
                placeholder="Votre identifiant"
                autocomplete="username"
                (focus)="userFocus.set(true)"
                (blur)="userFocus.set(false)">
            </div>
            @if (form.get('username')?.hasError('required') && form.get('username')?.touched) {
              <span class="field-error">L'identifiant est requis</span>
            }
          </div>

          <div class="field" [class.focused]="passFocus()">
            <label>Mot de passe</label>
            <div class="field-row" [class.invalid]="form.get('password')?.invalid && form.get('password')?.touched">
              <mat-icon>lock_outline</mat-icon>
              <input
                [type]="showPassword() ? 'text' : 'password'"
                formControlName="password"
                placeholder="Votre mot de passe"
                autocomplete="current-password"
                (focus)="passFocus.set(true)"
                (blur)="passFocus.set(false)">
              <button type="button" class="eye-btn" (click)="showPassword.set(!showPassword())" tabindex="-1">
                <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
            </div>
            @if (form.get('password')?.hasError('required') && form.get('password')?.touched) {
              <span class="field-error">Le mot de passe est requis</span>
            }
          </div>

          <button type="submit" class="submit-btn" [disabled]="form.invalid || loading()">
            @if (loading()) {
              <mat-spinner diameter="18" class="btn-spinner"></mat-spinner>
              <span>Connexion...</span>
            } @else {
              <span>Se connecter</span>
            }
          </button>
        </form>

        <p class="card-footer">© 2026 BetNaBiso — Tous droits réservés</p>
      </div>
    </div>
  `,
  styles: [`
    /* ── Scène ────────────────────────────────────────────────── */
    .login-stage {
      min-height: 100vh;
      background: #0a0906;
      display: flex; align-items: center; justify-content: center;
      position: relative;
      overflow: hidden;
      font-family: 'Inter', sans-serif;
      padding: 24px;
    }
    .net-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }

    /* ── Carte registre ───────────────────────────────────────── */
    .ledger-card {
      position: relative; z-index: 1;
      width: min(380px, 100%);
      padding: 44px 38px 32px;
      text-align: center;
      animation: fadeUp 0.5s ease both;
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .crest-mark {
      width: 56px; height: 56px; object-fit: contain; border-radius: 10px;
      margin: 0 auto 16px; display: block;
      filter: drop-shadow(0 6px 18px rgba(212,175,55,0.25));
    }

    .wordmark {
      font-family: Georgia, "Iowan Old Style", ui-serif, serif;
      font-size: 22px; font-weight: 600; letter-spacing: 3.5px; color: #f2e9d0; margin: 0;
    }
    .tagline {
      font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #8a7f63; margin: 7px 0 0;
    }

    .hairline {
      height: 1px; margin: 26px auto 26px;
      background: linear-gradient(90deg, transparent, rgba(212,175,55,0.45), transparent);
    }

    /* ── Formulaire ───────────────────────────────────────────── */
    .login-form { display: flex; flex-direction: column; }

    .field { text-align: left; margin-bottom: 20px; }
    .field label {
      display: block; font-size: 10.5px; letter-spacing: 1.2px; text-transform: uppercase;
      color: #8a7f63; margin-bottom: 9px;
    }
    .field-row {
      display: flex; align-items: center; gap: 10px;
      border-bottom: 1px solid #2a2417; padding-bottom: 8px;
      transition: border-color 0.2s;
      mat-icon { font-size: 17px; width: 17px; height: 17px; color: #6f6650; flex-shrink: 0; }
      input {
        flex: 1; background: none; border: none; outline: none;
        color: #f2e9d0; font-size: 14px; font-family: inherit;
        &::placeholder { color: #8a7f63; }
      }
    }
    .field.focused .field-row { border-color: #d4af37; }
    .field.focused .field-row mat-icon { color: #d4af37; }
    .field-row.invalid { border-color: #d97a6c; }

    .eye-btn {
      background: none; border: none; cursor: pointer; padding: 2px;
      color: #6f6650; display: flex; align-items: center;
      mat-icon { font-size: 17px; width: 17px; height: 17px; }
      &:hover mat-icon { color: #d4af37; }
    }

    .field-error { display: block; font-size: 11px; color: #d97a6c; margin-top: 7px; }

    /* Error alert */
    .error-alert {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px; margin-bottom: 20px;
      background: rgba(217,122,108,0.1); color: #e08b7a;
      border: 1px solid rgba(217,122,108,0.3);
      border-radius: 8px; font-size: 12.5px; text-align: left;
      mat-icon { font-size: 17px; width: 17px; height: 17px; flex-shrink: 0; }
    }

    /* Submit */
    .submit-btn {
      height: 46px; border: none; border-radius: 8px; cursor: pointer;
      background: linear-gradient(135deg, #d4af37 0%, #f4d777 50%, #d4af37 100%);
      color: #171310; font-size: 13.5px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      margin-top: 6px;
      transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
      box-shadow: 0 4px 18px rgba(212,175,55,0.28);

      &:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 8px 24px rgba(212,175,55,0.4);
      }
      &:active:not(:disabled) { transform: translateY(0); }
      &:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    }

    .btn-spinner { --mdc-circular-progress-active-indicator-color: #171310; }

    .card-footer {
      text-align: center; font-size: 10.5px; color: #55503f;
      margin: 26px 0 0; letter-spacing: 0.3px;
    }

    /* ── Responsive ───────────────────────────────────────────── */
    @media (max-width: 480px) {
      .ledger-card { padding: 36px 26px 26px; }
    }
  `]
})
export class LoginComponent implements AfterViewInit, OnDestroy {
  private fb   = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('net');

  private rafId = 0;
  private resizeHandler = () => this.setupNetwork();
  private points: { x: number; y: number; vx: number; vy: number }[] = [];
  private reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required]
  });

  error       = signal('');
  loading     = signal(false);
  showPassword = signal(false);
  userFocus   = signal(false);
  passFocus   = signal(false);

  ngAfterViewInit(): void {
    this.setupNetwork();
    window.addEventListener('resize', this.resizeHandler);
    this.drawNetwork();
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.resizeHandler);
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  private setupNetwork(): void {
    const canvas = this.canvas().nativeElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.parentElement!.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.round((rect.width * rect.height) / 26000);
    this.points = Array.from({ length: count }, () => ({
      x: Math.random() * rect.width,
      y: Math.random() * rect.height,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
    }));
  }

  private drawNetwork(): void {
    const canvas = this.canvas().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.parentElement!.getBoundingClientRect();
    const w = rect.width, h = rect.height;

    ctx.clearRect(0, 0, w, h);
    if (!this.reduceMotion) {
      for (const p of this.points) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }
    }
    for (let i = 0; i < this.points.length; i++) {
      for (let j = i + 1; j < this.points.length; j++) {
        const a = this.points[i], b = this.points[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 130) {
          ctx.strokeStyle = `rgba(212,175,55,${0.09 * (1 - d / 130)})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
    for (const p of this.points) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(212,175,55,0.35)';
      ctx.fill();
    }

    if (!this.reduceMotion) this.rafId = requestAnimationFrame(() => this.drawNetwork());
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');

    const { username, password } = this.form.value;
    const result = await this.auth.login(username!, password!);
    if (result.success) {
      // Best-effort : certains navigateurs refusent le plein écran si le délai
      // depuis le clic (interaction utilisateur requise) est dépassé — on
      // n'interrompt jamais la connexion si la demande est rejetée.
      document.documentElement.requestFullscreen?.().catch(() => {});
      this.router.navigate(['/dashboard']);
    } else {
      this.error.set(result.message);
    }
    this.loading.set(false);
  }
}
