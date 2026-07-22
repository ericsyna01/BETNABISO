import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth.service';

function passwordsMatch(ctrl: AbstractControl): ValidationErrors | null {
  const pwd = ctrl.get('newPassword')?.value;
  const confirm = ctrl.get('confirmPassword')?.value;
  return pwd && confirm && pwd !== confirm ? { mismatch: true } : null;
}

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatCardModule, MatFormFieldModule,
    MatInputModule, MatButtonModule, MatIconModule, MatSnackBarModule
  ],
  template: `
    <div class="cp-page">
      <mat-card class="cp-card">
        <div class="cp-logo">
          <mat-icon class="cp-lock-icon">lock_reset</mat-icon>
          <h2>Changement de mot de passe</h2>
          <p class="cp-subtitle">
            Votre mot de passe a été réinitialisé par un administrateur.<br>
            Veuillez définir un nouveau mot de passe pour continuer.
          </p>
        </div>

        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Nouveau mot de passe</mat-label>
              <mat-icon matPrefix>lock</mat-icon>
              <input matInput [type]="showPwd() ? 'text' : 'password'" formControlName="newPassword">
              <button matSuffix mat-icon-button type="button" (click)="showPwd.set(!showPwd())">
                <mat-icon>{{ showPwd() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              <mat-hint>Minimum 6 caractères</mat-hint>
              @if (form.get('newPassword')?.hasError('minlength')) {
                <mat-error>Minimum 6 caractères requis</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Confirmer le mot de passe</mat-label>
              <mat-icon matPrefix>lock_outline</mat-icon>
              <input matInput [type]="showConfirm() ? 'text' : 'password'" formControlName="confirmPassword">
              <button matSuffix mat-icon-button type="button" (click)="showConfirm.set(!showConfirm())">
                <mat-icon>{{ showConfirm() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              @if (form.hasError('mismatch') && form.get('confirmPassword')?.touched) {
                <mat-error>Les mots de passe ne correspondent pas</mat-error>
              }
            </mat-form-field>

            @if (errorMsg()) {
              <div class="cp-error">
                <mat-icon>error_outline</mat-icon> {{ errorMsg() }}
              </div>
            }

            <button mat-raised-button color="primary" type="submit"
                    [disabled]="form.invalid || saving()" class="submit-btn">
              @if (saving()) {
                <ng-container><mat-icon class="spin">refresh</mat-icon> Enregistrement...</ng-container>
              } @else {
                <ng-container><mat-icon>save</mat-icon> Enregistrer le nouveau mot de passe</ng-container>
              }
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .cp-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1a3a5c 0%, #2a5fa0 100%);
      padding: 24px;
    }
    .cp-card {
      width: 100%;
      max-width: 440px;
      border-radius: 16px !important;
      padding: 8px;
    }
    .cp-logo {
      text-align: center;
      padding: 24px 24px 8px;
    }
    .cp-lock-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #1a3a5c;
      margin-bottom: 8px;
    }
    .cp-logo h2 {
      margin: 8px 0 4px;
      font-size: 22px;
      font-weight: 700;
      color: #1a3a5c;
    }
    .cp-subtitle {
      font-size: 13px;
      color: #666;
      line-height: 1.5;
      margin: 8px 0 0;
    }
    .full-width { width: 100%; margin-bottom: 8px; }
    .submit-btn { width: 100%; height: 48px; margin-top: 8px; font-size: 15px; }
    mat-card-content { padding: 16px 24px 24px !important; }
    .cp-error {
      display: flex; align-items: center; gap: 8px;
      background: #fce4ec; color: #c62828; border-radius: 8px;
      padding: 10px 14px; font-size: 13px; margin-bottom: 12px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .spin { animation: spin .8s linear infinite; }
  `]
})
export class ChangePasswordComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);

  showPwd     = signal(false);
  showConfirm = signal(false);
  saving      = signal(false);
  errorMsg    = signal('');

  form = this.fb.group({
    newPassword:     ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required]
  }, { validators: passwordsMatch });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.errorMsg.set('');
    try {
      await this.auth.changeOwnPassword('', this.form.value.newPassword!);
      this.snack.open('Mot de passe mis à jour avec succès', 'OK', { duration: 3000, panelClass: 'success-snack' });
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.errorMsg.set(err?.error?.error ?? 'Erreur lors de la mise à jour. Réessayez.');
    } finally {
      this.saving.set(false);
    }
  }
}
