import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatSnackBarModule, MatDividerModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header"><h1>Mon profil</h1></div>

      <div class="profile-grid">
        <!-- Infos profil -->
        <mat-card>
          <mat-card-header>
            <div class="big-avatar">{{ initials() }}</div>
            <div>
              <mat-card-title>{{ user()?.prenom }} {{ user()?.nom }}</mat-card-title>
              <mat-card-subtitle>
                @for (r of (user()?.roles ?? [user()?.role]); track r) {
                  <span class="role-badge {{ r }}" style="margin-right:4px">{{ r }}</span>
                }
              </mat-card-subtitle>
            </div>
          </mat-card-header>
          <mat-card-content>
            <mat-divider></mat-divider>
            <div class="info-list">
              <div class="info-item"><mat-icon>person</mat-icon><span>{{ user()?.username }}</span></div>
              <div class="info-item"><mat-icon>email</mat-icon><span>{{ user()?.email }}</span></div>
              @if (user()?.zone) {
                <div class="info-item"><mat-icon>location_on</mat-icon><span>{{ user()?.zone }}</span></div>
              }
              <div class="info-item"><mat-icon>schedule</mat-icon><span>Connexion : {{ user()?.lastLogin ? (user()!.lastLogin! | date:'dd/MM/yyyy HH:mm') : 'N/A' }}</span></div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Changer mot de passe -->
        <mat-card>
          <mat-card-header><mat-card-title>Changer le mot de passe</mat-card-title></mat-card-header>
          <mat-card-content>
            <form [formGroup]="form" (ngSubmit)="changePassword()">
              <mat-form-field appearance="outline" style="width:100%;margin-top:12px">
                <mat-label>Mot de passe actuel</mat-label>
                <input matInput [type]="showCurrent() ? 'text' : 'password'" formControlName="current">
                <button matSuffix mat-icon-button type="button" (click)="showCurrent.set(!showCurrent())">
                  <mat-icon>{{ showCurrent() ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
              </mat-form-field>
              <mat-form-field appearance="outline" style="width:100%">
                <mat-label>Nouveau mot de passe</mat-label>
                <input matInput [type]="showNew() ? 'text' : 'password'" formControlName="newPass">
                <button matSuffix mat-icon-button type="button" (click)="showNew.set(!showNew())">
                  <mat-icon>{{ showNew() ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                <mat-hint>Minimum 6 caractères</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline" style="width:100%">
                <mat-label>Confirmer</mat-label>
                <input matInput [type]="showConfirm() ? 'text' : 'password'" formControlName="confirm">
                <button matSuffix mat-icon-button type="button" (click)="showConfirm.set(!showConfirm())">
                  <mat-icon>{{ showConfirm() ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                @if (form.get('confirm')?.errors?.['mismatch']) {
                  <mat-error>Les mots de passe ne correspondent pas</mat-error>
                }
              </mat-form-field>
              <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid" style="width:100%;margin-top:8px">
                <mat-icon>lock</mat-icon> Changer le mot de passe
              </button>
            </form>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; max-width: 800px; }
    @media (max-width: 720px) {
      .profile-grid { grid-template-columns: 1fr; }
    }
    .big-avatar { width: 56px; height: 56px; background: linear-gradient(135deg,#1a3a5c,#2a5fa0); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; color: white; margin-right: 12px; flex-shrink: 0; }
    mat-card-header { display: flex !important; align-items: center; padding: 16px 16px 0 !important; }
    mat-card-content { padding: 12px 16px 16px !important; }
    .info-list { display: flex; flex-direction: column; gap: 12px; padding-top: 12px; }
    .info-item { display: flex; align-items: center; gap: 10px; font-size: 13px; mat-icon { color: var(--primary-light); font-size: 18px; } }
  `]
})
export class ProfileComponent {
  private auth = inject(AuthService);
  private snack = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  user = this.auth.currentUser;
  showCurrent = signal(false);
  showNew     = signal(false);
  showConfirm = signal(false);
  initials = () => { const u = this.user(); return u ? `${u.prenom[0]}${u.nom[0]}`.toUpperCase() : ''; };

  form = this.fb.group({
    current: ['', Validators.required],
    newPass: ['', [Validators.required, Validators.minLength(6)]],
    confirm: ['', Validators.required],
  });

  async changePassword(): Promise<void> {
    const { current, newPass, confirm } = this.form.value;
    if (newPass !== confirm) {
      this.form.get('confirm')?.setErrors({ mismatch: true }); return;
    }
    try {
      await this.auth.changeOwnPassword(current!, newPass!);
      this.snack.open('Mot de passe mis à jour', 'OK', { duration: 2000, panelClass: 'success-snack' });
      this.form.reset();
    } catch {
      this.snack.open('Mot de passe actuel incorrect', 'OK', { duration: 2500, panelClass: 'error-snack' });
    }
  }
}
