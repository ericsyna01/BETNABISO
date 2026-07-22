import { Component, computed, inject } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { InactivityService } from '../../services/inactivity.service';

@Component({
  selector: 'app-session-expiry-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="expiry-dialog">
      <div class="icon-row">
        <mat-icon class="warning-icon">schedule</mat-icon>
      </div>
      <h2 mat-dialog-title>Session sur le point d'expirer</h2>
      <mat-dialog-content>
        <p>Votre session sera déconnectée dans :</p>
        <div class="countdown" [class.critical]="inactivity.remainingSeconds() <= 10">
          {{ countdown() }}
        </div>
        <p class="sub">Cliquez sur <strong>Continuer</strong> pour rester connecté.</p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button (click)="logout()">Se déconnecter</button>
        <button mat-raised-button color="primary" (click)="extend()">
          <mat-icon>refresh</mat-icon> Continuer la session
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .expiry-dialog { padding: 8px; text-align: center; }

    .icon-row { margin-bottom: 4px; }
    .warning-icon {
      font-size: 48px; width: 48px; height: 48px;
      color: #e65100;
    }

    h2[mat-dialog-title] { font-size: 18px; font-weight: 700; margin: 0 0 4px; }

    mat-dialog-content {
      p { margin: 4px 0; font-size: 14px; color: #555; }
      .sub { font-size: 13px; margin-top: 12px; }
    }

    .countdown {
      font-size: 52px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      color: #e65100;
      margin: 12px 0;
      letter-spacing: 2px;
      transition: color 0.3s;

      &.critical { color: #c62828; animation: pulse 0.8s ease-in-out infinite; }
    }

    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

    mat-dialog-actions { padding-top: 8px; gap: 8px; }
  `]
})
export class SessionExpiryDialogComponent {
  inactivity = inject(InactivityService);
  private dialogRef = inject(MatDialogRef<SessionExpiryDialogComponent>);

  countdown = computed(() => {
    const s = this.inactivity.remainingSeconds();
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  });

  extend(): void {
    this.inactivity.extend();
    this.dialogRef.close('extended');
  }

  logout(): void {
    this.dialogRef.close('logout');
  }
}
