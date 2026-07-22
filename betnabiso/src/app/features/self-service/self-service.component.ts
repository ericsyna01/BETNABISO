import { Component, computed, effect, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../environments/environment';
import { TypeLabelService } from '../../core/services/type-label.service';

@Component({
  selector: 'app-self-service',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule
  ],
  template: `
    <div class="ss-page">
      <div class="ss-card">
        <div class="ss-logo-wrap">
          <img src="logo.png" alt="A" class="ss-logo" onerror="this.style.display='none'">
        </div>

        @if (state() === 'loading') {
          <div class="ss-status">
            <mat-spinner diameter="32"></mat-spinner>
            <p>Chargement...</p>
          </div>
        }

        @if (state() === 'invalid') {
          <div class="ss-status">
            <mat-icon class="ss-icon-error">link_off</mat-icon>
            <h2>Lien invalide</h2>
            <p>Ce lien de signalement n'est plus valide. Contactez votre support BETNABISO.</p>
          </div>
        }

        @if (state() === 'sent') {
          <div class="ss-status">
            <mat-icon class="ss-icon-ok">check_circle</mat-icon>
            <h2>Signalement envoyé</h2>
            <p>Votre panne a été transmise à notre équipe. Un technicien va être assigné et vous serez recontacté sous peu.</p>
          </div>
        }

        @if (state() === 'form') {
          <h2 class="ss-title">Signaler une panne</h2>
          <p class="ss-sub">{{ agentNom() }} — {{ agentZone() }}</p>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="ss-form">
            @if (error()) {
              <div class="ss-error"><mat-icon>error_outline</mat-icon><span>{{ error() }}</span></div>
            }

            <mat-form-field appearance="outline">
              <mat-label>Type de panne</mat-label>
              <mat-select formControlName="type">
                @for (t of panneTypes(); track t.id) {
                  <mat-option [value]="t.label">{{ t.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Décrivez le problème</mat-label>
              <textarea matInput rows="4" maxlength="500" formControlName="description"
                        placeholder="Ex : la caisse ne s'allume plus depuis ce matin"></textarea>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Votre nom (optionnel)</mat-label>
              <input matInput formControlName="contactNom">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Numéro pour vous rappeler (optionnel)</mat-label>
              <input matInput type="tel" formControlName="contactNumero">
            </mat-form-field>

            <input type="file" #photoInput accept="image/*"
                   style="display:none" (change)="onPhotoSelected($event)">

            @if (photoPreview()) {
              <div class="ss-photo-preview">
                <img [src]="photoPreview()" alt="Aperçu">
                <button type="button" mat-icon-button class="ss-photo-remove" (click)="clearPhoto(photoInput)">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            } @else {
              <button type="button" mat-stroked-button class="ss-photo-btn" (click)="photoInput.click()">
                <mat-icon>photo_camera</mat-icon>
                <span>Ajouter une photo (optionnel)</span>
              </button>
            }

            <button mat-raised-button color="primary" type="submit" class="ss-submit"
                    [disabled]="form.invalid || sending()">
              @if (sending()) {
                <ng-container>
                  <mat-spinner diameter="18" class="ss-btn-spinner"></mat-spinner>
                  <span>Envoi...</span>
                </ng-container>
              } @else {
                <ng-container>
                  <mat-icon>send</mat-icon>
                  <span>Envoyer le signalement</span>
                </ng-container>
              }
            </button>
          </form>
        }

        <p class="ss-footer">BETNABISO — Assistance technique</p>
      </div>
    </div>
  `,
  styles: [`
    .ss-page {
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(145deg, #0d2340, #1a3a5c);
      padding: 20px;
    }
    .ss-card {
      width: 100%; max-width: 420px;
      background: white; border-radius: 18px;
      padding: 32px 24px 20px;
      box-shadow: 0 12px 48px rgba(0,0,0,0.25);
    }
    .ss-logo-wrap { display: flex; justify-content: center; margin-bottom: 16px; }
    .ss-logo { width: 56px; height: 56px; object-fit: contain; border-radius: 12px; }

    .ss-status {
      display: flex; flex-direction: column; align-items: center; text-align: center;
      gap: 8px; padding: 20px 0 10px;
      mat-icon { font-size: 42px; width: 42px; height: 42px; margin-bottom: 4px; }
      h2 { margin: 0; font-size: 18px; color: #1a2742; }
      p { margin: 0; font-size: 13.5px; color: #64748b; line-height: 1.5; }
    }
    .ss-icon-ok    { color: #2e7d32; }
    .ss-icon-error { color: #c62828; }

    .ss-title { text-align: center; margin: 0 0 4px; font-size: 19px; color: #1a2742; }
    .ss-sub   { text-align: center; margin: 0 0 20px; font-size: 13px; color: #8492a6; }

    .ss-form { display: flex; flex-direction: column; gap: 4px; }
    mat-form-field { width: 100%; }

    .ss-error {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px; margin-bottom: 8px;
      background: #fef2f2; color: #dc2626; border: 1px solid #fecaca;
      border-radius: 10px; font-size: 13px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    }

    .ss-photo-btn {
      height: 44px; margin-top: 4px; color: #64748b; border-color: #dde3ec;
      display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    .ss-photo-preview {
      position: relative; margin-top: 4px;
      img { width: 100%; max-height: 180px; object-fit: cover; border-radius: 10px; display: block; }
    }
    .ss-photo-remove {
      position: absolute; top: 6px; right: 6px;
      background: rgba(0,0,0,0.55) !important; color: white !important;
      width: 30px; height: 30px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .ss-submit {
      height: 46px; margin-top: 8px;
      display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    .ss-btn-spinner { --mdc-circular-progress-active-indicator-color: white; }

    .ss-footer { text-align: center; font-size: 11px; color: #b0bac9; margin: 20px 0 0; }
  `]
})
export class SelfServiceComponent implements OnInit {
  private http    = inject(HttpClient);
  private route   = inject(ActivatedRoute);
  private fb      = inject(FormBuilder);
  private typeSvc = inject(TypeLabelService);

  private token = '';
  state      = signal<'loading' | 'invalid' | 'form' | 'sent'>('loading');
  agentNom   = signal('');
  agentZone  = signal('');
  error      = signal('');
  sending    = signal(false);
  photoPreview = signal<string | null>(null);
  private pendingPhoto: File | null = null;

  panneTypes = computed(() => this.typeSvc.getByCategorie('panne'));

  form = this.fb.group({
    type: ['', Validators.required],
    description: ['', [Validators.required, Validators.maxLength(500)]],
    contactNom: [''],
    contactNumero: [''],
  });

  constructor() {
    effect(() => {
      const list = this.panneTypes();
      if (list.length && !this.form.value.type) {
        this.form.patchValue({ type: list[0].label });
      }
    });
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    if (!this.token) { this.state.set('invalid'); return; }

    this.http.get<{ nomAgent: string; zone: string }>(`${environment.apiUrl}/self-service/${this.token}`)
      .subscribe({
        next: (agent) => {
          this.agentNom.set(agent.nomAgent);
          this.agentZone.set(agent.zone);
          this.state.set('form');
        },
        error: () => this.state.set('invalid'),
      });
  }

  onPhotoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.pendingPhoto = file;
    const reader = new FileReader();
    reader.onload = e => this.photoPreview.set(e.target!.result as string);
    reader.readAsDataURL(file);
  }

  clearPhoto(input: HTMLInputElement): void {
    this.pendingPhoto = null;
    this.photoPreview.set(null);
    input.value = '';
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.sending.set(true);
    this.error.set('');

    const fd = new FormData();
    const v = this.form.value;
    fd.append('type', v.type ?? '');
    fd.append('description', v.description ?? '');
    fd.append('contactNom', v.contactNom ?? '');
    fd.append('contactNumero', v.contactNumero ?? '');
    if (this.pendingPhoto) fd.append('photo', this.pendingPhoto);

    this.http.post(`${environment.apiUrl}/self-service/${this.token}`, fd).subscribe({
      next: () => { this.state.set('sent'); this.sending.set(false); },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Une erreur est survenue, réessayez.');
        this.sending.set(false);
      },
    });
  }
}
