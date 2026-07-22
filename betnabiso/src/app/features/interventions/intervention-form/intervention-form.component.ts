import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { InterventionService } from '../../../core/services/intervention.service';
import { AgentService } from '../../../core/services/agent.service';
import { AuthService } from '../../../core/services/auth.service';
import { TypeLabelService } from '../../../core/services/type-label.service';
import { Agent } from '../../../core/models/agent.model';

@Component({
  selector: 'app-intervention-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink, MatCardModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule, MatIconModule,
    MatAutocompleteModule, MatSnackBarModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div class="header-with-back">
          <a mat-icon-button routerLink="/interventions"><mat-icon>arrow_back</mat-icon></a>
          <h1>Nouvelle intervention</h1>
        </div>
      </div>

      <mat-card style="max-width:750px">
        <mat-card-header>
          <mat-card-title>Enregistrer une intervention</mat-card-title>
          <mat-card-subtitle>Remplissez les informations de l'intervention réalisée</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <!-- Agent selection -->
            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>Agent concerné *</mat-label>
              <mat-icon matPrefix>person</mat-icon>
              <input matInput formControlName="agentSearch" [matAutocomplete]="agentAuto"
                     placeholder="Rechercher un agent par nom ou ID AnyDesk">
              <mat-autocomplete #agentAuto="matAutocomplete" (optionSelected)="onAgentSelect($event)">
                @for (a of filteredAgents(); track a.id) {
                  <mat-option [value]="a.nomAgent">
                    <div style="display:flex;flex-direction:column">
                      <span style="font-weight:600">{{ a.nomAgent }}</span>
                      <span style="font-size:11px;color:#666">{{ a.anydesk }} · {{ a.zone }}</span>
                    </div>
                  </mat-option>
                }
              </mat-autocomplete>
              @if (form.get('agentId')?.hasError('required') && form.get('agentId')?.touched) {
                <mat-error>Sélectionnez un agent</mat-error>
              }
            </mat-form-field>

            <!-- Selected agent info -->
            @if (selectedAgent()) {
              <div class="agent-info-box">
                <div class="agent-info-row">
                  <span class="info-label">AnyDesk ID</span>
                  <code>{{ selectedAgent()?.anydesk }}</code>
                </div>
                <div class="agent-info-row">
                  <span class="info-label">Responsable</span>
                  <span>{{ selectedAgent()?.nomResponsable }}</span>
                </div>
                <div class="agent-info-row">
                  <span class="info-label">Zone</span>
                  <span>{{ selectedAgent()?.zone }}</span>
                </div>
                <div class="agent-info-row">
                  <span class="info-label">Statut</span>
                  <span class="status-chip {{ statutClass(selectedAgent()!.statut) }}">{{ selectedAgent()?.statut }}</span>
                </div>
              </div>
            }

            <div class="form-grid" style="margin-top:16px">
              <mat-form-field appearance="outline">
                <mat-label>Type d'intervention *</mat-label>
                <mat-select formControlName="type">
                  @for (t of types(); track t.id) {
                    <mat-option [value]="t.label">{{ t.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Statut *</mat-label>
                <mat-select formControlName="statut">
                  <mat-option value="En cours">En cours</mat-option>
                  <mat-option value="Terminée">Terminée</mat-option>
                  <mat-option value="Échec">Échec</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" floatLabel="always">
                <mat-label>Date début *</mat-label>
                <input matInput type="datetime-local" formControlName="dateDebut">
              </mat-form-field>

              <mat-form-field appearance="outline" floatLabel="always">
                <mat-label>Date fin</mat-label>
                <input matInput type="datetime-local" formControlName="dateFin">
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>Description *</mat-label>
              <textarea matInput formControlName="description" rows="3"
                        placeholder="Décrivez l'intervention réalisée..."></textarea>
              @if (form.get('description')?.hasError('required') && form.get('description')?.touched) {
                <mat-error>La description est requise</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" style="width:100%">
              <mat-label>Observations</mat-label>
              <textarea matInput formControlName="observations" rows="2"
                        placeholder="Remarques complémentaires..."></textarea>
            </mat-form-field>

            <div class="form-actions">
              <a mat-stroked-button routerLink="/interventions">Annuler</a>
              <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || saving()">
                <mat-icon>save</mat-icon>
                {{ saving() ? "Enregistrement..." : "Enregistrer l'intervention" }}
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .header-with-back { display: flex; align-items: center; gap: 8px; }
    mat-card-content { padding: 16px 24px 24px !important; }
    .agent-info-box { background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
    .agent-info-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
    .info-label { color: var(--text-secondary); font-weight: 500; }
    code { background: #e8f0fe; color: #1a3a5c; padding: 2px 6px; border-radius: 4px; font-weight: 700; }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border); }
    mat-form-field { width: 100%; }
  `]
})
export class InterventionFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private interventionSvc = inject(InterventionService);
  private agentSvc = inject(AgentService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snack = inject(MatSnackBar);
  private typeSvc = inject(TypeLabelService);

  types = computed(() => this.typeSvc.getByCategorie('intervention'));
  saving = signal(false);
  selectedAgent = signal<Agent | undefined>(undefined);
  private searchQuery = signal('');
  filteredAgents = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const agents = this.agentSvc.getAll();
    if (!q) return agents;
    return agents.filter(a =>
      (a.nomAgent ?? '').toLowerCase().includes(q) ||
      (a.anydesk ?? '').includes(q) ||
      (a.nomResponsable ?? '').toLowerCase().includes(q) ||
      (a.identifiant ?? '').toLowerCase().includes(q)
    );
  });

  form = this.fb.group({
    agentSearch: [''],
    agentId: ['', Validators.required],
    agentNom: [''],
    agentZone: [''],
    type: [this.types()[0]?.label ?? '', Validators.required],
    statut: ['Terminée', Validators.required],
    dateDebut: [this.toLocalDateTime(new Date()), Validators.required],
    dateFin: [''],
    description: ['', Validators.required],
    observations: [''],
  });

  ngOnInit(): void {
    const agentId = this.route.snapshot.queryParamMap.get('agentId');
    if (agentId) {
      const agent = this.agentSvc.getById(agentId);
      if (agent) {
        this.selectAgent(agent);
        this.form.patchValue({ agentSearch: agent.nomAgent });
      }
    }

    this.form.get('agentSearch')?.valueChanges.subscribe(q => {
      this.searchQuery.set(q ?? '');
    });
  }

  onAgentSelect(event: any): void {
    const name = event.option.value;
    const agent = this.agentSvc.getAll().find((a: Agent) => a.nomAgent === name);
    if (agent) this.selectAgent(agent);
  }

  private selectAgent(agent: Agent): void {
    this.selectedAgent.set(agent);
    this.form.patchValue({ agentId: agent.id, agentNom: agent.nomAgent, agentZone: agent.zone });
  }

  statutClass(s: string): string {
    const map: Record<string, string> = { 'Actif': 'actif', 'Inactif': 'inactif', 'En attente': 'en-attente', 'Redéployé': 'redeploye' };
    return map[s] ?? '';
  }

  private toLocalDateTime(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    const v = this.form.value;
    const user = this.auth.currentUser();

    const dateDebut = new Date(v.dateDebut!).toISOString();
    let dateFin: string | undefined;
    let duree: number | undefined;
    if (v.dateFin) {
      dateFin = new Date(v.dateFin).toISOString();
      duree = Math.round((new Date(dateFin).getTime() - new Date(dateDebut).getTime()) / 60000);
    }

    try {
      await this.interventionSvc.create({
        agentId: v.agentId!, agentNom: v.agentNom!, agentZone: v.agentZone!,
        technicienId: user?.id ?? '', technicienNom: user ? `${user.prenom} ${user.nom}` : '',
        type: v.type! as any, statut: v.statut! as any,
        dateDebut, dateFin, duree,
        description: v.description!, observations: v.observations ?? '',
      });
      this.snack.open('Intervention enregistrée', 'OK', { duration: 2000, panelClass: 'success-snack' });
      this.router.navigate(['/interventions']);
    } catch {
      this.snack.open('Erreur lors de l\'enregistrement', 'Fermer', { duration: 3000 });
    } finally {
      this.saving.set(false);
    }
  }
}
