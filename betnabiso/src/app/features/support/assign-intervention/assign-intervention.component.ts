import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatRadioModule } from '@angular/material/radio';
import { MatDividerModule } from '@angular/material/divider';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { InterventionService } from '../../../core/services/intervention.service';
import { AgentService } from '../../../core/services/agent.service';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { PresenceService } from '../../../core/services/presence.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PRIORITES } from '../../../core/models/intervention.model';
import { TypeLabelService } from '../../../core/services/type-label.service';
import { Agent } from '../../../core/models/agent.model';
import { User } from '../../../core/models/user.model';

@Component({
  selector: 'app-assign-intervention',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, FormsModule, ReactiveFormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatAutocompleteModule, MatSnackBarModule,
    MatRadioModule, MatDividerModule, MatDatepickerModule, MatNativeDateModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div class="header-with-back">
          <a mat-icon-button routerLink="/support"><mat-icon>arrow_back</mat-icon></a>
          <div>
            <h1>{{ editMode() ? "Réaffecter l'intervention" : "Affecter une intervention" }}</h1>
            <p class="subtitle">Assigner une tâche à un technicien</p>
          </div>
        </div>
      </div>

      <div class="assign-layout">
        <mat-card class="assign-card">
          <mat-card-content>
            <form [formGroup]="form" (ngSubmit)="onSubmit()">

              <!-- Section Agent -->
              <div class="section">
                <div class="section-header">
                  <div class="section-num">1</div>
                  <div>
                    <div class="section-title">Agent concerné</div>
                    <div class="section-sub">Sélectionnez l'agent qui a besoin d'une intervention</div>
                  </div>
                </div>

                <mat-form-field appearance="outline" style="width:100%">
                  <mat-label>Rechercher un agent *</mat-label>
                  <mat-icon matPrefix>search</mat-icon>
                  <input matInput formControlName="agentSearch" [matAutocomplete]="agentAuto"
                         placeholder="Nom, AnyDesk ID, identifiant...">
                  <mat-autocomplete #agentAuto="matAutocomplete" (optionSelected)="onAgentSelect($event)">
                    @for (a of filteredAgents(); track a.id) {
                      <mat-option [value]="a.nomAgent">
                        <div class="agent-option">
                          <div class="agent-option-main">{{ a.nomAgent }}</div>
                          <div class="agent-option-sub">AnyDesk: {{ a.anydesk }} · {{ a.zone }}</div>
                        </div>
                      </mat-option>
                    }
                  </mat-autocomplete>
                </mat-form-field>

                @if (selectedAgent()) {
                  <div class="selected-agent-card">
                    <div class="agent-card-header">
                      <mat-icon>person</mat-icon>
                      <strong>{{ selectedAgent()!.nomAgent }}</strong>
                      <span class="status-chip {{ agentStatutClass(selectedAgent()!.statut) }}">{{ selectedAgent()!.statut }}</span>
                    </div>
                    <div class="agent-card-grid">
                      <div class="agent-card-row"><span>Responsable</span><span>{{ selectedAgent()!.nomResponsable }}</span></div>
                      <div class="agent-card-row">
                        <span>AnyDesk ID</span>
                        <code class="anydesk-badge">{{ selectedAgent()!.anydesk }}</code>
                      </div>
                      <div class="agent-card-row"><span>Zone</span><span>{{ selectedAgent()!.zone }}</span></div>
                      <div class="agent-card-row"><span>Téléphone</span><span>{{ selectedAgent()!.numero }}</span></div>
                    </div>
                  </div>

                  @if (agentDayHistory().length > 0) {
                    <div class="day-history-alert">
                      <div class="day-history-title">
                        <mat-icon>warning</mat-icon>
                        Cet agent a déjà eu {{ agentDayHistory().length }} intervention(s) aujourd'hui
                      </div>
                      <div class="day-history-list">
                        @for (h of agentDayHistory(); track h.id) {
                          <div class="day-history-row">
                            <mat-icon class="dh-icon">schedule</mat-icon>
                            <span class="dh-time">{{ h.dateDebut | date:'HH:mm' }}</span>
                            <span class="dh-type">{{ h.type }}</span>
                            <mat-icon class="dh-sep">arrow_forward</mat-icon>
                            <mat-icon class="dh-tech-icon">engineering</mat-icon>
                            <span class="dh-tech">{{ h.technicienNom }}</span>
                            <span class="dh-statut statut-{{ sClass(h.statut) }}">{{ h.statut }}</span>
                          </div>
                        }
                      </div>
                    </div>
                  }
                }
              </div>

              <mat-divider></mat-divider>

              <!-- Section Technicien -->
              <div class="section">
                <div class="section-header">
                  <div class="section-num">2</div>
                  <div>
                    <div class="section-title">Technicien assigné</div>
                    <div class="section-sub">Choisissez le technicien qui réalisera l'intervention</div>
                  </div>
                </div>

                <div class="techniciens-grid">
                  @for (t of sortedTechniciens(); track t.id) {
                    <div class="technicien-card"
                         [class.selected]="form.get('technicienId')?.value === t.id"
                         [class.is-online]="presenceSvc.isOnline(t.id)"
                         (click)="selectTechnicien(t)">
                      <div class="tech-av-wrap">
                        <div class="tech-avatar">{{ techInitials(t) }}</div>
                        <span class="pres-dot-assign" [class.online]="presenceSvc.isOnline(t.id)"></span>
                      </div>
                      <div class="tech-info">
                        <div class="tech-name">
                          {{ t.prenom }} {{ t.nom }}
                          @if (presenceSvc.isOnline(t.id)) {
                            <span class="online-badge-assign">En ligne</span>
                          }
                        </div>
                        <div class="tech-load">
                          <mat-icon>assignment</mat-icon>
                          {{ getLoad(t.id) }} tâche(s) en cours
                        </div>
                      </div>
                      @if (form.get('technicienId')?.value === t.id) {
                        <mat-icon class="check-icon">check_circle</mat-icon>
                      }
                    </div>
                  }
                </div>
                @if (!techniciens().length) {
                  <div class="empty-state" style="padding:20px 0">
                    <mat-icon>person_off</mat-icon>
                    <p>Aucun technicien disponible</p>
                  </div>
                }
              </div>

              <mat-divider></mat-divider>

              <!-- Section Intervention -->
              <div class="section">
                <div class="section-header">
                  <div class="section-num">3</div>
                  <div>
                    <div class="section-title">Détails de l'intervention</div>
                    <div class="section-sub">Précisez le type, la priorité et la description</div>
                  </div>
                </div>

                <div class="form-grid">
                  <mat-form-field appearance="outline">
                    <mat-label>Type d'intervention *</mat-label>
                    <mat-icon matPrefix>build</mat-icon>
                    <mat-select formControlName="type">
                      @for (t of types(); track t.id) {
                        <mat-option [value]="t.label">{{ t.label }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>

                  <div class="datetime-group">
                    <mat-form-field appearance="outline" floatLabel="always" class="date-field">
                      <mat-label>Date planifiée</mat-label>
                      <mat-icon matPrefix>event</mat-icon>
                      <input matInput [matDatepicker]="planPicker" [(ngModel)]="pickerDate"
                             [ngModelOptions]="{standalone: true}" [min]="today" placeholder="jj/mm/aaaa" readonly>
                      <mat-datepicker-toggle matSuffix [for]="planPicker"></mat-datepicker-toggle>
                      <mat-datepicker #planPicker></mat-datepicker>
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="hour-field">
                      <mat-label>Heure</mat-label>
                      <mat-icon matPrefix>schedule</mat-icon>
                      <mat-select [(ngModel)]="pickerHour" [ngModelOptions]="{standalone: true}">
                        @for (h of hours; track h) {
                          <mat-option [value]="h">{{ h | number:'2.0-0' }}h</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="min-field">
                      <mat-label>Minutes</mat-label>
                      <mat-select [(ngModel)]="pickerMinute" [ngModelOptions]="{standalone: true}">
                        @for (m of minutes; track m) {
                          <mat-option [value]="m">{{ m | number:'2.0-0' }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  </div>
                </div>

                <!-- Priorité -->
                <div class="priorite-group">
                  <label class="priorite-label">Priorité *</label>
                  <div class="priorite-options">
                    @for (p of priorites; track p) {
                      <div class="priorite-chip" [class]="'prio-' + p.toLowerCase()"
                           [class.selected]="form.get('priorite')?.value === p"
                           (click)="form.get('priorite')?.setValue(p)">
                        <mat-icon>{{ prioriteIcon(p) }}</mat-icon>
                        {{ p }}
                      </div>
                    }
                  </div>
                </div>

                <mat-form-field appearance="outline" style="width:100%">
                  <mat-label>Description *</mat-label>
                  <textarea matInput formControlName="description" rows="4"
                            placeholder="Décrivez en détail ce que le technicien doit faire..."></textarea>
                  @if (form.get('description')?.hasError('required') && form.get('description')?.touched) {
                    <mat-error>La description est requise</mat-error>
                  }
                  <mat-hint align="end">{{ form.get('description')?.value?.length ?? 0 }}/500</mat-hint>
                </mat-form-field>
              </div>

              <!-- Actions -->
              <div class="form-actions">
                <a mat-stroked-button routerLink="/support">Annuler</a>
                <button mat-raised-button color="primary" type="submit"
                        [disabled]="form.invalid || !selectedAgent() || !form.get('technicienId')?.value || saving()">
                  <mat-icon>send</mat-icon>
                  {{ saving() ? 'Envoi...' : (editMode() ? 'Réaffecter' : 'Affecter au technicien') }}
                </button>
              </div>
            </form>
          </mat-card-content>
        </mat-card>

        <!-- Panneau résumé -->
        <div class="summary-panel">
          <mat-card class="summary-card">
            <mat-card-header>
              <mat-card-title><mat-icon>preview</mat-icon> Résumé</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="summary-rows">
                <div class="summary-row">
                  <mat-icon>person</mat-icon>
                  <div>
                    <div class="summary-label">Agent</div>
                    <div class="summary-val">{{ selectedAgent()?.nomAgent ?? '—' }}</div>
                  </div>
                </div>
                <div class="summary-row">
                  <mat-icon>engineering</mat-icon>
                  <div>
                    <div class="summary-label">Technicien</div>
                    <div class="summary-val">{{ selectedTechNom() }}</div>
                  </div>
                </div>
                <div class="summary-row">
                  <mat-icon>build</mat-icon>
                  <div>
                    <div class="summary-label">Type</div>
                    <div class="summary-val">{{ form.get('type')?.value ?? '—' }}</div>
                  </div>
                </div>
                <div class="summary-row">
                  <mat-icon>priority_high</mat-icon>
                  <div>
                    <div class="summary-label">Priorité</div>
                    <div class="summary-val" [class]="'prio-text-' + (form.get('priorite')?.value ?? '').toLowerCase()">
                      {{ form.get('priorite')?.value ?? '—' }}
                    </div>
                  </div>
                </div>
                @if (pickerDate) {
                  <div class="summary-row">
                    <mat-icon>event</mat-icon>
                    <div>
                      <div class="summary-label">Planifiée le</div>
                      <div class="summary-val">{{ datePlanifieeLabel }}</div>
                    </div>
                  </div>
                }
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Charge technicien sélectionné -->
          @if (form.get('technicienId')?.value) {
            <mat-card class="load-card">
              <mat-card-header><mat-card-title><mat-icon>bar_chart</mat-icon> Charge actuelle</mat-card-title></mat-card-header>
              <mat-card-content>
                @if (getLoad(form.get('technicienId')!.value) >= 3) {
                  <div class="load-warn">
                    <mat-icon>warning</mat-icon>
                    Technicien chargé ({{ getLoad(form.get('technicienId')!.value) }} en cours)
                  </div>
                }
                <div class="load-stats">
                  <div class="load-item">
                    <span class="load-num assignee">{{ getLoad(form.get('technicienId')!.value) }}</span>
                    <span class="load-label">En cours</span>
                  </div>
                  <div class="load-item">
                    <span class="load-num terminee">{{ getDoneCount(form.get('technicienId')!.value) }}</span>
                    <span class="load-label">Terminées (30j)</span>
                  </div>
                </div>
                <div class="load-bar-wrap">
                  <div class="load-bar"
                    [style.width.%]="Math.min(getLoad(form.get('technicienId')!.value) * 20, 100)"
                    [class.overload]="getLoad(form.get('technicienId')!.value) >= 3">
                  </div>
                </div>
                <div class="load-bar-labels">
                  <span>0</span><span>Charge max recommandée : 5</span>
                </div>
              </mat-card-content>
            </mat-card>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .subtitle { color: var(--text-secondary); font-size: 13px; margin-top: 2px; }
    .header-with-back { display: flex; align-items: center; gap: 8px; }

    .assign-layout { display: grid; grid-template-columns: 1fr 280px; gap: 20px; align-items: start; }

    .assign-card mat-card-content { padding: 0 !important; }

    .section { padding: 24px; }

    .section-header {
      display: flex; align-items: flex-start; gap: 16px; margin-bottom: 20px;
    }
    .section-num {
      width: 32px; height: 32px; border-radius: 50%; background: var(--primary);
      color: white; display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 14px; flex-shrink: 0;
    }
    .section-title { font-size: 15px; font-weight: 600; color: var(--text-primary); }
    .section-sub { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }

    .selected-agent-card {
      background: #f0f7ff; border: 1px solid #b3d4f5; border-radius: 10px; padding: 14px; margin-top: 8px;
    }
    .agent-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; mat-icon { color: var(--primary-light); } }
    .agent-card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .agent-card-row { display: flex; flex-direction: column; span:first-child { font-size: 11px; color: var(--text-secondary); } span:last-child { font-size: 13px; font-weight: 500; } }
    .anydesk-badge { background: #1a3a5c; color: white; padding: 2px 8px; border-radius: 4px; font-size: 13px; font-weight: 700; }
    .agent-option-main { font-weight: 600; font-size: 13px; }
    .agent-option-sub { font-size: 11px; color: var(--text-secondary); }

    .day-history-alert {
      margin-top: 10px; background: #fff8e1; border: 1px solid #ffe082; border-radius: 10px; padding: 12px 14px;
      border-left: 4px solid #f9a825;
    }
    .day-history-title {
      display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #e65100; margin-bottom: 10px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #f9a825; }
    }
    .day-history-list { display: flex; flex-direction: column; gap: 6px; }
    .day-history-row {
      display: flex; align-items: center; gap: 6px; font-size: 12px; padding: 6px 8px;
      background: rgba(255,255,255,0.7); border-radius: 6px;
    }
    .dh-icon  { font-size: 14px; width: 14px; height: 14px; color: #888; }
    .dh-time  { font-weight: 700; color: #555; min-width: 38px; }
    .dh-type  { font-weight: 600; color: #333; flex: 1; }
    .dh-sep   { font-size: 14px; width: 14px; height: 14px; color: #bbb; }
    .dh-tech-icon { font-size: 14px; width: 14px; height: 14px; color: #1565c0; }
    .dh-tech  { color: #1565c0; font-weight: 600; }
    .dh-statut { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 8px; margin-left: auto; }
    .dh-statut.statut-terminee  { background: #e8f5e9; color: #2e7d32; }
    .dh-statut.statut-en-cours  { background: #e3f2fd; color: #1565c0; }
    .dh-statut.statut-assignee  { background: #fff3e0; color: #e65100; }
    .dh-statut.statut-echec     { background: #fce4ec; color: #c62828; }

    .techniciens-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
    .technicien-card {
      border: 2px solid var(--border); border-radius: 10px; padding: 14px;
      cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 12px; position: relative;
      &:hover { border-color: var(--primary-light); background: #f0f7ff; }
      &.selected { border-color: var(--primary); background: #e8f0fe; }
      &.is-online { border-color: rgba(76,175,80,0.4); }
      &.is-online:hover { border-color: #4caf50; background: #f1f8f1; }
    }
    .tech-av-wrap { position: relative; flex-shrink: 0; }
    .tech-avatar {
      width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg,#1a3a5c,#2a5fa0);
      color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px;
    }
    .pres-dot-assign {
      position: absolute; bottom: 0; right: 0;
      width: 11px; height: 11px; border-radius: 50%;
      background: #bdbdbd; border: 2px solid white;
    }
    .pres-dot-assign.online { background: #4caf50; }
    .tech-name { font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
    .online-badge-assign {
      font-size: 10px; font-weight: 600; color: #2e7d32;
      background: rgba(76,175,80,0.12); border-radius: 6px; padding: 1px 6px;
    }
    .tech-load { font-size: 11px; color: var(--text-secondary); display: flex; align-items: center; gap: 4px; mat-icon { font-size: 13px; width: 13px; height: 13px; } }
    .check-icon { position: absolute; top: 8px; right: 8px; color: var(--primary); font-size: 20px; }

    .datetime-group { display: grid; grid-template-columns: 1fr 110px 100px; gap: 10px; margin-bottom: 4px; }
    .date-field { width: 100%; }
    .hour-field, .min-field { width: 100%; }

    .priorite-group { margin-bottom: 16px; }
    .priorite-label { font-size: 13px; color: var(--text-secondary); font-weight: 500; display: block; margin-bottom: 10px; }
    .priorite-options { display: flex; gap: 10px; }
    .priorite-chip {
      display: flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 20px;
      cursor: pointer; border: 2px solid var(--border); font-size: 13px; font-weight: 500; transition: all 0.2s;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &.prio-haute { &.selected, &:hover { border-color: #c62828; background: #fce4ec; color: #c62828; } }
      &.prio-normale { &.selected, &:hover { border-color: #1565c0; background: #e3f2fd; color: #1565c0; } }
      &.prio-basse { &.selected, &:hover { border-color: #2e7d32; background: #e8f5e9; color: #2e7d32; } }
    }

    .form-actions { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 24px; border-top: 1px solid var(--border); }
    mat-form-field { width: 100%; }

    /* Summary */
    .summary-card, .load-card { mat-card-header { padding: 12px 16px 0 !important; mat-card-title { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; mat-icon { font-size: 18px; color: var(--primary-light); } } } mat-card-content { padding: 12px 16px !important; } }
    .summary-rows { display: flex; flex-direction: column; gap: 14px; }
    .summary-row { display: flex; align-items: flex-start; gap: 10px; mat-icon { color: var(--primary-light); font-size: 18px; margin-top: 2px; } }
    .summary-label { font-size: 11px; color: var(--text-secondary); }
    .summary-val { font-size: 13px; font-weight: 600; }
    .prio-text-haute { color: #c62828; } .prio-text-normale { color: #1565c0; } .prio-text-basse { color: #2e7d32; }

    .load-warn { display: flex; align-items: center; gap: 6px; background: #fff3e0; color: #e65100; font-size: 12px; font-weight: 600; padding: 6px 10px; border-radius: 6px; margin-bottom: 8px; mat-icon { font-size: 16px; width: 16px; height: 16px; } }
    .load-stats { display: flex; justify-content: space-around; padding: 8px 0; }
    .load-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .load-num { font-size: 28px; font-weight: 700; }
    .load-num.assignee { color: #e65100; }
    .load-num.terminee { color: #2e7d32; }
    .load-label { font-size: 11px; color: var(--text-secondary); }
    .load-bar-wrap { height: 6px; background: #e0e6ed; border-radius: 3px; overflow: hidden; margin: 6px 0 2px; }
    .load-bar { height: 100%; background: #2a5fa0; border-radius: 3px; transition: width .4s; &.overload { background: #e65100; } }
    .load-bar-labels { display: flex; justify-content: space-between; font-size: 9px; color: var(--text-secondary); }

    @media (max-width: 900px) { .assign-layout { grid-template-columns: 1fr; } .summary-panel { display: none; } }

    @media (max-width: 480px) {
      .section { padding: 16px; }
      .agent-card-grid { grid-template-columns: 1fr; }
      .day-history-row { flex-wrap: wrap; row-gap: 4px; }
      .dh-statut { margin-left: 20px; }
      .datetime-group { grid-template-columns: 1fr; }
      .priorite-options { flex-wrap: wrap; }
      .form-actions { padding: 12px 16px; flex-wrap: wrap; }
    }
  `]
})
export class AssignInterventionComponent implements OnInit {
  protected readonly Math = Math;
  private fb              = inject(FormBuilder);
  private interventionSvc = inject(InterventionService);
  private agentSvc        = inject(AgentService);
  private userSvc         = inject(UserService);
  private auth            = inject(AuthService);
  private route           = inject(ActivatedRoute);
  private router          = inject(Router);
  private snack           = inject(MatSnackBar);
  presenceSvc             = inject(PresenceService);
  private notifSvc        = inject(NotificationService);
  private typeSvc         = inject(TypeLabelService);

  types    = computed(() => this.typeSvc.getByCategorie('intervention'));
  priorites = PRIORITES;
  hours   = Array.from({ length: 24 }, (_, i) => i);
  minutes = [0, 15, 30, 45];

  pickerDate: Date | null = null;
  readonly today = new Date(new Date().setHours(0, 0, 0, 0));
  pickerHour   = 8;
  pickerMinute = 0;

  saving = signal(false);
  editMode = signal(false);
  private editId = signal<string | null>(null);
  private prefillPhotoUrl: string | null = null;
  private prefillAudioUrl: string | null = null;
  private prefillNotifId: string | null = null;
  selectedAgent = signal<Agent | undefined>(undefined);

  agentDayHistory = computed(() => {
    const agent = this.selectedAgent();
    if (!agent) return [];
    return this.interventionSvc.getAgentSameDayInterventions(agent.id, this.editId() ?? undefined);
  });
  filteredAgents = signal<Agent[]>([]);
  private allAgents: Agent[] = [];

  techniciens = () => {
    const techs   = this.userSvc.getByRole('technicien').filter(t => t.actif);
    const admins  = this.userSvc.getByRole('admin').filter(t => t.actif);
    return [...admins, ...techs];
  };

  sortedTechniciens = () =>
    [...this.techniciens()].sort((a, b) => {
      const ao = this.presenceSvc.isOnline(a.id) ? 0 : 1;
      const bo = this.presenceSvc.isOnline(b.id) ? 0 : 1;
      return ao - bo;
    });

  selectedTechNom = () => {
    const id = this.form.get('technicienId')?.value;
    if (!id) return '—';
    const t = this.techniciens().find(x => x.id === id);
    return t ? `${t.prenom} ${t.nom}` : '—';
  };

  form = this.fb.group({
    agentSearch: [''],
    agentId: ['', Validators.required],
    agentNom: [''],
    agentZone: [''],
    technicienId: ['', Validators.required],
    technicienNom: [''],
    type: [this.types()[0]?.label ?? '', Validators.required],
    priorite: ['Normale', Validators.required],
    description: ['', [Validators.required, Validators.maxLength(500)]],
    datePlanifiee: [''],
  });

  ngOnInit(): void {
    this.allAgents = this.agentSvc.getAll();
    this.filteredAgents.set(this.allAgents);

    const qp = this.route.snapshot.queryParamMap;
    const agentId = qp.get('agentId');
    const interventionId = qp.get('id');
    const prefillDescription = qp.get('description');
    const prefillTechnicienId = qp.get('technicienId');
    this.prefillPhotoUrl = qp.get('photoUrl');
    this.prefillAudioUrl = qp.get('audioUrl');
    this.prefillNotifId  = qp.get('notifId');

    if (agentId) {
      const agent = this.agentSvc.getById(agentId);
      if (agent) { this.selectAgent(agent); this.form.patchValue({ agentSearch: agent.nomAgent }); }
    }
    if (prefillDescription) {
      this.form.patchValue({ description: prefillDescription.slice(0, 500) });
    }
    if (prefillTechnicienId && !interventionId) {
      const tech = this.techniciens().find(t => t.id === prefillTechnicienId);
      if (tech) this.selectTechnicien(tech);
    }

    if (interventionId) {
      const i = this.interventionSvc.getById(interventionId);
      if (i?.statut === 'Terminée' || i?.statut === 'Échec') {
        this.snack.open('Impossible de réaffecter une intervention terminée ou en échec.', 'OK', { duration: 4000, panelClass: 'warn-snack' });
        this.router.navigate(['/support']);
        return;
      }
      this.editMode.set(true);
      this.editId.set(interventionId);
      if (i) {
        const agent = this.agentSvc.getById(i.agentId);
        if (agent) { this.selectAgent(agent); this.form.patchValue({ agentSearch: agent.nomAgent }); }
        this.form.patchValue({ technicienId: i.technicienId, type: i.type, priorite: i.priorite ?? 'Normale', description: i.description });
      }
    }

    this.form.get('agentSearch')?.valueChanges.subscribe(q => {
      if (!q) { this.filteredAgents.set(this.allAgents); return; }
      const lower = q.toLowerCase();
      this.filteredAgents.set(this.allAgents.filter(a =>
        (a.nomAgent        ?? '').toLowerCase().includes(lower) ||
        (a.anydesk         ?? '').includes(lower) ||
        (a.anydesk_serveur ?? '').includes(lower) ||
        (a.identifiant     ?? '').toLowerCase().includes(lower) ||
        (a.nomResponsable  ?? '').toLowerCase().includes(lower) ||
        (a.zone            ?? '').toLowerCase().includes(lower)
      ));
    });
  }

  onAgentSelect(event: any): void {
    const a = this.allAgents.find(x => x.nomAgent === event.option.value);
    if (a) this.selectAgent(a);
  }

  private selectAgent(a: Agent): void {
    this.selectedAgent.set(a);
    this.form.patchValue({ agentId: a.id, agentNom: a.nomAgent, agentZone: a.zone });
  }

  selectTechnicien(t: User): void {
    this.form.patchValue({ technicienId: t.id, technicienNom: `${t.prenom} ${t.nom}` });
  }

  getLoad(techId: string | null): number { return techId ? this.interventionSvc.getAssignedCount(techId) : 0; }

  getDoneCount(techId: string | null): number {
    return techId ? this.interventionSvc.getByTechnicien(techId).filter(i => i.statut === 'Terminée').length : 0;
  }

  techInitials(t: User): string { return `${t.prenom[0]}${t.nom[0]}`.toUpperCase(); }

  agentStatutClass(s: string): string {
    return { 'Actif': 'actif', 'Inactif': 'inactif', 'En attente': 'en-attente', 'Redéployé': 'redeploye' }[s] ?? '';
  }

  sClass(s: string): string {
    return { 'Assignée': 'assignee', 'En cours': 'en-cours', 'Terminée': 'terminee', 'Échec': 'echec' }[s] ?? '';
  }

  prioriteIcon(p: string): string {
    return { 'Haute': 'arrow_upward', 'Normale': 'remove', 'Basse': 'arrow_downward' }[p] ?? 'remove';
  }

  private buildDatePlanifiee(): string | undefined {
    if (!this.pickerDate) return undefined;
    const d = new Date(this.pickerDate);
    d.setHours(this.pickerHour, this.pickerMinute, 0, 0);
    return d.toISOString();
  }

  formatDate(v: string | null | undefined): string {
    if (!v) return '—';
    return new Date(v).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  get datePlanifieeLabel(): string {
    if (!this.pickerDate) return '—';
    const d = new Date(this.pickerDate);
    d.setHours(this.pickerHour, this.pickerMinute, 0, 0);
    return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || !this.selectedAgent()) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    const v = this.form.value;
    const tech = this.techniciens().find(t => t.id === v.technicienId);
    const datePlanifiee = this.buildDatePlanifiee();

    try {
      if (this.editMode() && this.editId()) {
        await this.interventionSvc.reassign(
          this.editId()!, v.technicienId!, tech ? `${tech.prenom} ${tech.nom}` : v.technicienNom!
        );
        this.snack.open('Intervention réaffectée', 'OK', { duration: 2500, panelClass: 'success-snack' });
      } else {
        const currentUser = this.auth.currentUser();
        await this.interventionSvc.create({
          agentId: v.agentId!, agentNom: v.agentNom!, agentZone: v.agentZone ?? '',
          technicienId: v.technicienId!, technicienNom: tech ? `${tech.prenom} ${tech.nom}` : v.technicienNom!,
          type: v.type! as any, description: v.description!,
          priorite: v.priorite! as any,
          datePlanifiee,
          statut: 'Assignée',
          dateDebut: datePlanifiee ?? new Date().toISOString(),
          assignedById: currentUser?.id,
          assignedByNom: currentUser ? `${currentUser.prenom} ${currentUser.nom}` : undefined,
          assignedAt: new Date().toISOString(),
          pieceJointe: this.prefillPhotoUrl ?? undefined,
          audioMessage: this.prefillAudioUrl ?? undefined,
          viaSignalement: !!this.prefillNotifId,
          signalementNotifId: this.prefillNotifId ?? undefined,
        });
        // Le signalement agent à l'origine de cette affectation disparaît de
        // la liste "en attente" puisqu'il a maintenant une intervention créée.
        if (this.prefillNotifId) await this.notifSvc.markTraitee(this.prefillNotifId);
        this.snack.open('Intervention affectée avec succès', 'OK', { duration: 2500, panelClass: 'success-snack' });
      }
      this.router.navigate(['/support']);
    } catch (err: any) {
      if (err?.status === 409 && this.prefillNotifId) {
        // Un autre membre du support a déjà assigné ce signalement entre-temps :
        // on rafraîchit pour faire disparaître l'entrée obsolète plutôt que de
        // laisser l'utilisateur retenter et créer un doublon.
        this.snack.open(
          err?.error?.error ?? 'Ce signalement a déjà été pris en charge par un autre membre du support',
          'OK', { duration: 4500, panelClass: 'warn-snack' }
        );
        await this.notifSvc.loadFromApi();
        this.router.navigate(['/support']);
      } else {
        this.snack.open("Erreur lors de l'affectation", 'OK', { duration: 3000, panelClass: 'error-snack' });
      }
    } finally {
      this.saving.set(false);
    }
  }
}
