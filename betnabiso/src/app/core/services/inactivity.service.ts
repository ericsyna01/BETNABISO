import { Injectable, signal, inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { AuthService } from './auth.service';

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes d'inactivité
const WARN_AT_S  = 120;             // bannière visible à 2 min
const DIALOG_AT_S = 60;             // dialog d'avertissement à 1 min
// Persisté pour détecter l'inactivité même quand l'app mobile a été
// complètement fermée (le minuteur en mémoire seul repart sinon de zéro
// à chaque relance, même après plusieurs heures d'absence).
export const ACTIVITY_KEY = 'betnabiso_last_activity';
const WRITE_THROTTLE_MS = 5_000;

@Injectable({ providedIn: 'root' })
export class InactivityService {
  readonly remainingSeconds = signal<number>(TIMEOUT_MS / 1000);

  private auth     = inject(AuthService);
  private dialog   = inject(MatDialog);
  private deadline = 0;
  private lastWrite = 0;
  private tickId: ReturnType<typeof setInterval> | null = null;
  private dialogRef: MatDialogRef<unknown> | null = null;

  private readonly evts = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
  private readonly onActivity = () => this.reset();

  start(): void {
    const last = Number(localStorage.getItem(ACTIVITY_KEY) ?? 0);
    if (last && Date.now() - last > TIMEOUT_MS) {
      // L'app a été fermée/inactive plus longtemps que le délai autorisé
      // pendant qu'elle n'était pas ouverte : on ne redonne pas 30 min gratuites.
      localStorage.removeItem(ACTIVITY_KEY);
      this.auth.logout();
      return;
    }
    this.touchActivity(true);
    this.reset();
    for (const e of this.evts) {
      document.addEventListener(e, this.onActivity, { passive: true });
    }
    this.tickId = setInterval(() => this.tick(), 1000);
  }

  private touchActivity(force = false): void {
    const now = Date.now();
    if (force || now - this.lastWrite > WRITE_THROTTLE_MS) {
      localStorage.setItem(ACTIVITY_KEY, String(now));
      this.lastWrite = now;
    }
  }

  stop(): void {
    for (const e of this.evts) {
      document.removeEventListener(e, this.onActivity);
    }
    if (this.tickId !== null) {
      clearInterval(this.tickId);
      this.tickId = null;
    }
    this.closeDialog();
    this.remainingSeconds.set(TIMEOUT_MS / 1000);
  }

  extend(): void {
    this.reset();
    this.closeDialog();
  }

  private closeDialog(): void {
    if (this.dialogRef) {
      this.dialogRef.close('extended');
      this.dialogRef = null;
    }
  }

  private reset(): void {
    this.deadline = Date.now() + TIMEOUT_MS;
    this.touchActivity();
    if (this.remainingSeconds() < WARN_AT_S) {
      this.remainingSeconds.set(TIMEOUT_MS / 1000);
    }
  }

  private tick(): void {
    const s = Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000));
    if (s !== this.remainingSeconds()) {
      this.remainingSeconds.set(s);
    }

    // Ouvrir le dialog de confirmation à DIALOG_AT_S secondes
    if (s <= DIALOG_AT_S && s > 0 && !this.dialogRef) {
      this.openExpiryDialog();
    }

    if (s === 0) {
      this.stop();
      localStorage.removeItem(ACTIVITY_KEY);
      this.auth.logout();
    }
  }

  private openExpiryDialog(): void {
    // Importé dynamiquement pour éviter une dépendance circulaire
    import('../components/session-expiry-dialog/session-expiry-dialog.component').then(m => {
      if (this.dialogRef) return; // déjà ouvert entre temps
      this.dialogRef = this.dialog.open(m.SessionExpiryDialogComponent, {
        width: '380px',
        disableClose: true,
        autoFocus: false,
      });
      this.dialogRef.afterClosed().subscribe(result => {
        this.dialogRef = null;
        if (result === 'logout') {
          this.stop();
          localStorage.removeItem(ACTIVITY_KEY);
          this.auth.logout();
        }
      });
    });
  }
}
