import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AgentService } from '../../../core/services/agent.service';
import { ZoneService } from '../../../core/services/zone.service';

@Component({
  selector: 'app-agent-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink, DatePipe, MatCardModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule, MatIconModule, MatSnackBarModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div class="header-with-back">
          <a mat-icon-button routerLink="/agents"><mat-icon>arrow_back</mat-icon></a>
          <h1>{{ isEdit() ? "Modifier l'agent" : "Nouvel agent" }}</h1>
        </div>
      </div>

      <mat-card>
        <mat-card-header>
          <mat-card-title>{{ isEdit() ? "Informations de l'agent" : "Enregistrer un nouvel agent" }}</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (!isEdit() && lastAgent(); as last) {
            <div class="last-agent-hint">
              <mat-icon>history</mat-icon>
              <span>Dernier agent créé : <strong>{{ last.nomAgent }}</strong> ({{ last.zone }}) — {{ last.createdAt | date:'dd/MM/yyyy à HH:mm' }}</span>
            </div>
          }
          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <h3 class="section-title">Identification</h3>
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Nom Agent *</mat-label>
                <input matInput formControlName="nomAgent" placeholder="ex: PKN-001-2024">
                @if (form.get('nomAgent')?.hasError('required') && form.get('nomAgent')?.touched) {
                  <mat-error>Requis</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Nom Responsable *</mat-label>
                <input matInput formControlName="nomResponsable">
                @if (form.get('nomResponsable')?.hasError('required') && form.get('nomResponsable')?.touched) {
                  <mat-error>Requis</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Identifiant (login) *</mat-label>
                <input matInput formControlName="identifiant">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Numéro de téléphone</mat-label>
                <mat-icon matPrefix>phone</mat-icon>
                <input matInput formControlName="numero" placeholder="+221 77 000 0000">
              </mat-form-field>
            </div>

            <h3 class="section-title">Localisation</h3>
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Zone *</mat-label>
                <mat-select formControlName="zone">
                  @for (z of zones(); track z) {
                    <mat-option [value]="z">{{ z }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

            </div>

            <h3 class="section-title">Accès à distance</h3>
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>AnyDesk Caisse</mat-label>
                <mat-icon matPrefix>computer</mat-icon>
                <input matInput formControlName="anydesk" placeholder="123456789">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>AnyDesk Serveur</mat-label>
                <mat-icon matPrefix>dns</mat-icon>
                <input matInput formControlName="anydesk_serveur" placeholder="987654321">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>TeamViewer Caisse</mat-label>
                <mat-icon matPrefix>screen_share</mat-icon>
                <input matInput formControlName="teamCaisse" placeholder="TC-PKN">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>TeamViewer Serveur</mat-label>
                <mat-icon matPrefix>screen_share</mat-icon>
                <input matInput formControlName="teamServeur" placeholder="TS-A">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Statut *</mat-label>
                <mat-select formControlName="statut">
                  <mat-option value="Actif">Actif</mat-option>
                  <mat-option value="Inactif">Inactif</mat-option>
                  <mat-option value="À redéployer">À redéployer</mat-option>
                  <mat-option value="Redéployé">Redéployé</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline" class="form-full">
              <mat-label>Informations de redéploiement</mat-label>
              <textarea matInput formControlName="redeploiement" rows="2"></textarea>
            </mat-form-field>

            <div class="form-actions">
              <a mat-stroked-button routerLink="/agents">Annuler</a>
              <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || saving()">
                <mat-icon>{{ isEdit() ? 'save' : 'add' }}</mat-icon>
                {{ saving() ? "Enregistrement..." : (isEdit() ? "Enregistrer" : "Créer l'agent") }}
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .header-with-back { display: flex; align-items: center; gap: 8px; }
    .last-agent-hint {
      display: flex; align-items: center; gap: 8px; margin-bottom: 16px;
      padding: 10px 14px; background: var(--surface-alt, #f0f4f8); border-radius: 8px;
      font-size: 13px; color: var(--text-secondary);
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--primary-light); }
      strong { color: var(--text-primary); font-family: ui-monospace, monospace; }
    }
    .section-title { font-size: 13px; font-weight: 600; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px; margin: 20px 0 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
    mat-card { max-width: 900px; }
    mat-card-content { padding: 16px 24px 24px !important; }
    .form-full { width: 100%; }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border); }
    mat-form-field { width: 100%; }
  `]
})
export class AgentFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private agentSvc = inject(AgentService);
  private zoneSvc = inject(ZoneService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snack = inject(MatSnackBar);
  zones = computed(() => this.zoneSvc.getAll());
  isEdit = signal(false);
  saving = signal(false);
  private agentId = signal<string | null>(null);

  lastAgent = computed(() => {
    const all = this.agentSvc.getAll();
    if (!all.length) return null;
    return [...all].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))[0];
  });

  form = this.fb.group({
    nomAgent: ['', Validators.required],
    nomResponsable: ['', Validators.required],
    identifiant: ['', Validators.required],
    numero: [''],
    zone: ['', Validators.required],
    anydesk: [''],
    anydesk_serveur: [''],
    teamCaisse: [''],
    teamServeur: [''],
    statut: ['Actif', Validators.required],
    redeploiement: [''],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isEdit.set(true);
      this.agentId.set(id);
      const agent = this.agentSvc.getById(id);
      if (agent) {
        this.form.patchValue(agent);
      }
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    const data = {
      ...this.form.value,
      date: new Date().toISOString().split('T')[0],
    };

    try {
      if (this.isEdit() && this.agentId()) {
        await this.agentSvc.update(this.agentId()!, data as any);
        this.snack.open('Agent mis à jour', 'OK', { duration: 2000, panelClass: 'success-snack' });
        this.router.navigate(['/agents', this.agentId()]);
      } else {
        const created = await this.agentSvc.create(data as any);
        this.snack.open('Agent créé avec succès', 'OK', { duration: 2000, panelClass: 'success-snack' });
        this.router.navigate(['/agents', created.id]);
      }
    } catch {
      this.snack.open('Erreur lors de la sauvegarde', 'OK', { duration: 3000, panelClass: 'error-snack' });
    } finally {
      this.saving.set(false);
    }
  }
}
