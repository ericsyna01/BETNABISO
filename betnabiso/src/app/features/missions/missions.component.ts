import { Component, computed, effect, inject, OnInit, signal, untracked, viewChild } from '@angular/core';
import { DatePipe, SlicePipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule, MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MissionService } from '../../core/services/mission.service';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { PresenceService } from '../../core/services/presence.service';
import { InterventionService } from '../../core/services/intervention.service';
import { Mission, MissionStatut } from '../../core/models/mission.model';
import { TypeLabelService } from '../../core/services/type-label.service';
import { User } from '../../core/models/user.model';
import { ConfirmService } from '../../core/services/confirm.service';
import { NotificationService } from '../../core/services/notification.service';

/* ── Dialog Notes (refus + terminer) ─────────────────────────────────────── */
@Component({
  selector: 'app-notes-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title style="display:flex;align-items:center;gap:8px">
      <mat-icon [style.color]="data.color">{{ data.icon }}</mat-icon>
      {{ data.title }}
    </h2>
    <mat-dialog-content style="padding-top:4px;min-width:360px">
      <p style="margin:0 0 12px;font-size:13px;color:#546e7a;font-style:italic">« {{ data.mission }} »</p>
      <mat-form-field appearance="outline" style="width:100%">
        <mat-label>{{ data.label }}</mat-label>
        <textarea matInput [(ngModel)]="notes" rows="3" [placeholder]="data.placeholder"></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>Annuler</button>
      <button mat-raised-button [color]="data.btnColor" [mat-dialog-close]="notes">
        <mat-icon>{{ data.icon }}</mat-icon> {{ data.btnLabel }}
      </button>
    </mat-dialog-actions>
  `
})
export class NotesDialogComponent {
  data = inject<{
    title: string; mission: string; label: string; placeholder: string;
    btnLabel: string; btnColor: string; icon: string; color: string;
  }>(MAT_DIALOG_DATA);
  notes = '';
}

/* ── Dialog Nouvelle Mission ──────────────────────────────────────────────── */
@Component({
  selector: 'app-mission-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
            MatSelectModule, MatButtonModule, MatIconModule,
            MatDatepickerModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon style="vertical-align:middle;margin-right:8px;color:#1a3a5c">{{ data.mission ? 'edit' : 'assignment_add' }}</mat-icon>
      {{ data.mission ? 'Modifier la mission' : 'Confier une mission' }}
    </h2>
    <mat-dialog-content style="padding-top:12px;min-width:340px">
      <form [formGroup]="form" id="missionForm" (ngSubmit)="submit()">
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>Titre de la mission *</mat-label>
          <mat-icon matPrefix>title</mat-icon>
          <input matInput formControlName="titre" placeholder="Ex: Installation routeur salle B">
        </mat-form-field>

        <mat-form-field appearance="outline" style="width:100%;margin-top:4px">
          <mat-label>Description</mat-label>
          <textarea matInput formControlName="description" rows="3" placeholder="Détails de la mission..."></textarea>
        </mat-form-field>

        <div style="display:flex;gap:12px;margin-top:4px">
          <mat-form-field appearance="outline" style="flex:1">
            <mat-label>Type</mat-label>
            <mat-select formControlName="type">
              @for (t of types(); track t.id) { <mat-option [value]="t.label">{{ t.label }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" style="flex:1">
            <mat-label>Priorité</mat-label>
            <mat-select formControlName="priorite">
              <mat-option value="Haute">🔴 Haute</mat-option>
              <mat-option value="Normale">🟡 Normale</mat-option>
              <mat-option value="Basse">🟢 Basse</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" style="width:100%;margin-top:4px">
          <mat-label>Agent assigné *</mat-label>
          <mat-icon matPrefix>engineering</mat-icon>
          <mat-select formControlName="assignedToId" (selectionChange)="onTechChange($event.value)">
            @for (t of data.techniciens; track t.id) {
              <mat-option [value]="t.id">
                <div style="display:flex;align-items:center;gap:8px">
                  <span class="pres-dot-sm" [style.background]="data.presenceSvc.isOnline(t.id) ? '#4caf50' : '#ccc'"
                        style="width:8px;height:8px;border-radius:50%;flex-shrink:0;display:inline-block"></span>
                  {{ t.prenom }} {{ t.nom }}
                  @if (data.activeMissions(t.id) > 0) {
                    <span style="font-size:11px;color:#e65100"> · {{ data.activeMissions(t.id) }} mission(s)</span>
                  }
                  @if (data.activeInterventions(t.id) > 0) {
                    <span style="font-size:11px;color:#1565c0"> · {{ data.activeInterventions(t.id) }} interv.</span>
                  }
                </div>
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (selectedTech()) {
          <div class="tech-avail" [class.busy]="isBusy()">
            <mat-icon>{{ isBusy() ? 'warning' : 'check_circle' }}</mat-icon>
            {{ selectedTech()!.prenom }} {{ selectedTech()!.nom }} —
            @if (isBusy()) { occupé ({{ data.activeMissions(selectedTech()!.id) + data.activeInterventions(selectedTech()!.id) }} tâche(s) actives) }
            @else { disponible }
            · {{ data.presenceSvc.isOnline(selectedTech()!.id) ? 'En ligne 🟢' : 'Hors ligne ⚫' }}
          </div>
        }

        <mat-form-field appearance="outline" style="width:100%;margin-top:4px">
          <mat-label>Coéquipier (optionnel)</mat-label>
          <mat-icon matPrefix>group_add</mat-icon>
          <mat-select formControlName="assignedToId2" (selectionChange)="onCoequipierChange($event.value)">
            <mat-option value="">Aucun</mat-option>
            @for (t of coequipierOptions(); track t.id) {
              <mat-option [value]="t.id">
                <span class="pres-dot-sm" [style.background]="data.presenceSvc.isOnline(t.id) ? '#4caf50' : '#ccc'"
                      style="width:8px;height:8px;border-radius:50%;flex-shrink:0;display:inline-block;margin-right:6px"></span>
                {{ t.prenom }} {{ t.nom }}
              </mat-option>
            }
          </mat-select>
          <mat-hint>Un coéquipier chauffeur bascule le type en Déplacement</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" style="width:100%;margin-top:8px">
          <mat-label>Date de la mission *</mat-label>
          <mat-icon matPrefix>event</mat-icon>
          <input matInput [matDatepicker]="picker" formControlName="dateMission"
                 [min]="data.mission ? null : today" placeholder="jj/mm/aaaa" readonly>
          <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
          <mat-datepicker #picker></mat-datepicker>
          @if (form.get('dateMission')?.hasError('minDate')) {
            <mat-error>La date ne peut pas être dans le passé</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>Annuler</button>
      <button mat-raised-button color="primary" form="missionForm" type="submit" [disabled]="form.invalid">
        <mat-icon>{{ data.mission ? 'save' : 'send' }}</mat-icon> {{ data.mission ? 'Enregistrer' : 'Confier' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host { display: block; }
    .tech-avail {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 12px; border-radius: 6px; font-size: 12px; margin-bottom: 8px;
      background: #e8f5e9; color: #2e7d32;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &.busy { background: #fff3e0; color: #e65100; }
    }
  `]
})
export class MissionDialogComponent {
  data = inject<{
    techniciens: User[];
    presenceSvc: PresenceService;
    activeMissions: (id: string) => number;
    activeInterventions: (id: string) => number;
    preselect?: User;
    mission?: Mission;
  }>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<MissionDialogComponent>);
  private fb  = inject(FormBuilder);
  private typeSvc = inject(TypeLabelService);

  types = computed(() => this.typeSvc.getByCategorie('mission'));
  selectedTech = signal<User | null>(
    this.data.preselect ?? (this.data.mission ? this.data.techniciens.find(t => t.id === this.data.mission!.assignedToId) ?? null : null)
  );
  readonly today = new Date(new Date().setHours(0, 0, 0, 0));

  form = this.fb.group({
    titre:         [this.data.mission?.titre ?? '', Validators.required],
    description:   [this.data.mission?.description ?? ''],
    type:          [this.data.mission?.type ?? this.types()[0]?.label ?? '', Validators.required],
    priorite:      [this.data.mission?.priorite ?? 'Normale', Validators.required],
    assignedToId:  [this.data.mission?.assignedToId ?? this.data.preselect?.id ?? '', Validators.required],
    assignedToId2: [this.data.mission?.assignedToId2 ?? ''],
    dateMission:   [
      this.data.mission ? new Date(this.data.mission.dateMission) : new Date(),
      this.data.mission ? [Validators.required] : [Validators.required, this.minDateValidator()],
    ],
  });

  coequipierOptions(): User[] {
    return this.data.techniciens.filter(t => t.id !== this.form.get('assignedToId')?.value);
  }

  private minDateValidator() {
    return (control: import('@angular/forms').AbstractControl) => {
      if (!control.value) return null;
      const d = control.value instanceof Date ? control.value : new Date(control.value);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      return d < today ? { minDate: true } : null;
    };
  }

  onTechChange(id: string): void {
    this.selectedTech.set(this.data.techniciens.find(t => t.id === id) ?? null);
  }

  onCoequipierChange(id: string): void {
    const coequipier = this.data.techniciens.find(t => t.id === id);
    if (!coequipier) return;
    const isChauffeur = (coequipier.roles ?? [coequipier.role]).includes('chauffeur');
    if (!isChauffeur) return;
    const deplacement = this.types().find(t => t.label.toLowerCase() === 'déplacement');
    if (deplacement) this.form.get('type')?.setValue(deplacement.label);
  }

  isBusy(): boolean {
    const t = this.selectedTech();
    if (!t) return false;
    return (this.data.activeMissions(t.id) + this.data.activeInterventions(t.id)) > 0;
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.value;
    const tech = this.data.techniciens.find(t => t.id === v.assignedToId)!;
    const tech2 = v.assignedToId2 ? this.data.techniciens.find(t => t.id === v.assignedToId2) : undefined;
    const d = v.dateMission instanceof Date ? v.dateMission : new Date(v.dateMission as any);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    this.ref.close({
      ...v,
      dateMission: dateStr,
      assignedToNom: `${tech.prenom} ${tech.nom}`,
      assignedToId2: tech2?.id || null,
      assignedToNom2: tech2 ? `${tech2.prenom} ${tech2.nom}` : null,
      editId: this.data.mission?.id,
    });
  }
}

/* ── Dialog Détails mission (lecture seule) ───────────────────────────────── */
@Component({
  selector: 'app-mission-detail-dialog',
  standalone: true,
  imports: [DatePipe, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title style="display:flex;align-items:center;gap:8px">
      <mat-icon style="color:#1a3a5c">assignment</mat-icon>
      {{ data.mission.titre }}
    </h2>
    <mat-dialog-content style="padding-top:4px;min-width:360px;max-width:480px">
      <div class="dd-badges">
        <span class="dd-badge">{{ data.mission.type }}</span>
        <span class="dd-badge" [class]="'prio-' + data.mission.priorite.toLowerCase()">{{ data.mission.priorite }}</span>
        <span class="statut-chip {{ data.mission.statut }}">{{ data.statutLabel }}</span>
      </div>

      @if (data.mission.description) {
        <div class="dd-section">
          <div class="dd-label"><mat-icon>notes</mat-icon> Description</div>
          <p class="dd-desc">{{ data.mission.description }}</p>
        </div>
      }

      <div class="dd-section">
        <div class="dd-label"><mat-icon>engineering</mat-icon> Assigné à</div>
        <p>{{ data.mission.assignedToNom }}{{ data.mission.assignedToNom2 ? ' + ' + data.mission.assignedToNom2 : '' }}</p>
      </div>

      <div class="dd-section">
        <div class="dd-label"><mat-icon>person</mat-icon> Confié par</div>
        <p>{{ data.mission.assignedByNom }}</p>
      </div>

      <div class="dd-grid">
        <div class="dd-section">
          <div class="dd-label"><mat-icon>event</mat-icon> Date mission</div>
          <p>{{ data.mission.dateMission | date:'dd/MM/yyyy' }}</p>
        </div>
        <div class="dd-section">
          <div class="dd-label"><mat-icon>schedule</mat-icon> Créée le</div>
          <p>{{ data.mission.createdAt | date:'dd/MM/yyyy HH:mm' }}</p>
        </div>
        @if (data.mission.completedAt) {
          <div class="dd-section">
            <div class="dd-label"><mat-icon>check_circle</mat-icon> Clôturée le</div>
            <p>{{ data.mission.completedAt | date:'dd/MM/yyyy HH:mm' }}</p>
          </div>
        }
      </div>

      @if (data.mission.notes) {
        <div class="dd-section">
          <div class="dd-label"><mat-icon>chat_bubble_outline</mat-icon> Notes</div>
          <p class="dd-desc">{{ data.mission.notes }}</p>
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-raised-button color="primary" mat-dialog-close>Fermer</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dd-badges { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
    .dd-badge {
      display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px;
      font-weight: 600; background: #eceff1; color: #37474f;
      &.prio-haute   { background: #fce4ec; color: #c62828; }
      &.prio-normale { background: #fff8e1; color: #f9a825; }
      &.prio-basse   { background: #e8f5e9; color: #2e7d32; }
    }
    .dd-section { margin-bottom: 14px; }
    .dd-label {
      display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700;
      color: #78909c; text-transform: uppercase; letter-spacing: .3px; margin-bottom: 4px;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }
    .dd-desc { white-space: pre-wrap; font-size: 14px; color: #263238; margin: 0; }
    .dd-grid { display: flex; gap: 20px; flex-wrap: wrap; }
    p { margin: 0; font-size: 14px; color: #263238; }
  `]
})
export class MissionDetailDialogComponent {
  data = inject<{ mission: Mission; statutLabel: string }>(MAT_DIALOG_DATA);
}

/* ── Composant principal Missions ─────────────────────────────────────────── */
@Component({
  selector: 'app-missions',
  standalone: true,
  imports: [
    DatePipe, SlicePipe, ReactiveFormsModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatTableModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDialogModule, MatSnackBarModule, MatTooltipModule, MatChipsModule,
    MatDividerModule, MatMenuModule, MatPaginatorModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1><mat-icon class="title-icon">assignment_ind</mat-icon> Missions internes</h1>
          <span class="sub-title">{{ auth.isAdmin() ? 'Confier des missions aux agents' : 'Mes missions assignées' }}</span>
        </div>
        @if (auth.isSuperadmin() || auth.isAdmin()) {
          <button mat-raised-button color="primary" (click)="openDialog()">
            <mat-icon>add_task</mat-icon> Nouvelle mission
          </button>
        }
      </div>

      <!-- KPI superadmin -->
      @if (auth.isAdmin()) {
        <div class="kpi-row">
          <div class="kpi-card">
            <mat-icon>assignment</mat-icon>
            <div class="kv">{{ allMissions().length }}</div>
            <div class="kl">Total</div>
          </div>
          <div class="kpi-card warn">
            <mat-icon>pending_actions</mat-icon>
            <div class="kv">{{ countStatut('assignée') }}</div>
            <div class="kl">En attente</div>
          </div>
          <div class="kpi-card info">
            <mat-icon>sync</mat-icon>
            <div class="kv">{{ countStatut('en_cours') + countStatut('acceptée') }}</div>
            <div class="kl">En cours</div>
          </div>
          <div class="kpi-card success">
            <mat-icon>task_alt</mat-icon>
            <div class="kv">{{ countStatut('terminée') }}</div>
            <div class="kl">Terminées</div>
          </div>
          @if (overdueCount() > 0) {
            <div class="kpi-card overdue">
              <mat-icon>schedule</mat-icon>
              <div class="kv">{{ overdueCount() }}</div>
              <div class="kl">En retard</div>
            </div>
          }
        </div>

        <!-- Panel disponibilité techniciens -->
        <mat-card class="avail-card">
          <mat-card-header>
            <mat-icon mat-card-avatar style="background:#e3f2fd;color:#1565c0;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:22px;width:40px;height:40px">engineering</mat-icon>
            <mat-card-title>Disponibilité des agents</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="tech-grid">
              @for (t of techniciens(); track t.id) {
                <div class="tech-avail-card" [class.online]="presenceSvc.isOnline(t.id)" [class.busy]="techIsBusy(t.id)">
                  <div class="tech-av-wrap">
                    <div class="tech-av">{{ initials(t) }}</div>
                    <span class="pres-dot" [class.online]="presenceSvc.isOnline(t.id)"></span>
                  </div>
                  <div class="tech-info">
                    <div class="tech-name-row">
                      <span class="tech-name">{{ t.prenom }} {{ t.nom }}</span>
                      <span class="role-tag {{ t.role }}">{{ t.role }}</span>
                    </div>
                    <div class="tech-status">
                      @if (presenceSvc.isOnline(t.id)) { <span class="online-text">En ligne</span> }
                      @else { <span class="offline-text">Hors ligne</span> }
                    </div>
                    <div class="tech-load">
                      @if (activeMissions(t.id) > 0) {
                        <span class="load-chip mission">{{ activeMissions(t.id) }} mission(s)</span>
                      }
                      @if (activeIntervCount(t.id) > 0) {
                        <span class="load-chip interv">{{ activeIntervCount(t.id) }} interv.</span>
                      }
                      @if (activeMissions(t.id) === 0 && activeIntervCount(t.id) === 0) {
                        <span class="load-chip free">Libre</span>
                      }
                    </div>
                  </div>
                  <button mat-icon-button color="primary" (click)="openDialogFor(t)" matTooltip="Confier une mission">
                    <mat-icon>add_task</mat-icon>
                  </button>
                </div>
              }
            </div>
          </mat-card-content>
        </mat-card>
      }

      <!-- Barre de filtres -->
      <div class="filters-bar">
        <mat-form-field appearance="outline" class="filter-search">
          <mat-label>Rechercher</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [ngModel]="search()" (ngModelChange)="search.set($event)" placeholder="Titre, description...">
          @if (search()) {
            <button matSuffix mat-icon-button (click)="search.set('')"><mat-icon>close</mat-icon></button>
          }
        </mat-form-field>

        @if (auth.isAdmin()) {
          <mat-form-field appearance="outline" style="width:155px">
            <mat-label>Agent</mat-label>
            <mat-select [value]="filterTech()" (selectionChange)="filterTech.set($event.value)">
              <mat-option value="">Tous</mat-option>
              @for (t of techniciens(); track t.id) {
                <mat-option [value]="t.id">{{ t.prenom }} {{ t.nom }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }

        <mat-form-field appearance="outline" style="width:145px">
          <mat-label>Statut</mat-label>
          <mat-select [value]="filterStatut()" (selectionChange)="filterStatut.set($event.value)">
            <mat-option value="">Tous</mat-option>
            <mat-option value="assignée">Assignée</mat-option>
            <mat-option value="acceptée">Acceptée</mat-option>
            <mat-option value="en_cours">En cours</mat-option>
            <mat-option value="terminée">Terminée</mat-option>
            <mat-option value="refusée">Refusée</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" style="width:125px">
          <mat-label>Priorité</mat-label>
          <mat-select [value]="filterPrio()" (selectionChange)="filterPrio.set($event.value)">
            <mat-option value="">Toutes</mat-option>
            <mat-option value="Haute">🔴 Haute</mat-option>
            <mat-option value="Normale">🟡 Normale</mat-option>
            <mat-option value="Basse">🟢 Basse</mat-option>
          </mat-select>
        </mat-form-field>

        <span class="result-count">{{ sortedFiltered().length }} résultat(s)</span>

        @if (hasActiveFilters()) {
          <button mat-stroked-button (click)="clearFilters()" class="clear-btn">
            <mat-icon>filter_alt_off</mat-icon> Effacer
          </button>
        }
      </div>

      <!-- Table missions -->
      <div class="table-container">
        <table mat-table [dataSource]="paginated()">

          <ng-container matColumnDef="priorite">
            <th mat-header-cell *matHeaderCellDef class="sortable-th" (click)="sort('priorite')">
              <div class="th-inner">Prio. <mat-icon class="sort-icon" [class.sort-active]="sortField()==='priorite'">{{ sortIcon('priorite') }}</mat-icon></div>
            </th>
            <td mat-cell *matCellDef="let m">
              <mat-icon [class]="'prio-' + m.priorite.toLowerCase()" [matTooltip]="m.priorite">
                {{ m.priorite === 'Haute' ? 'arrow_upward' : m.priorite === 'Basse' ? 'arrow_downward' : 'remove' }}
              </mat-icon>
            </td>
          </ng-container>

          <ng-container matColumnDef="titre">
            <th mat-header-cell *matHeaderCellDef class="sortable-th" (click)="sort('titre')">
              <div class="th-inner">Mission <mat-icon class="sort-icon" [class.sort-active]="sortField()==='titre'">{{ sortIcon('titre') }}</mat-icon></div>
            </th>
            <td mat-cell *matCellDef="let m">
              <div class="mission-titre">{{ m.titre }}</div>
              <div class="mission-type">{{ m.type }}</div>
            </td>
          </ng-container>

          <ng-container matColumnDef="description">
            <th mat-header-cell *matHeaderCellDef class="sortable-th" (click)="sort('description')">
              <div class="th-inner">Description <mat-icon class="sort-icon" [class.sort-active]="sortField()==='description'">{{ sortIcon('description') }}</mat-icon></div>
            </th>
            <td mat-cell *matCellDef="let m">
              @if (m.description) {
                <div class="desc-cell" [matTooltip]="m.description.length > 80 ? m.description : ''" matTooltipClass="desc-tooltip">
                  {{ m.description | slice:0:80 }}{{ m.description.length > 80 ? '…' : '' }}
                </div>
              } @else {
                <span class="no-value">—</span>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="technicien">
            <th mat-header-cell *matHeaderCellDef class="sortable-th" (click)="sort('technicien')">
              <div class="th-inner">Technicien <mat-icon class="sort-icon" [class.sort-active]="sortField()==='technicien'">{{ sortIcon('technicien') }}</mat-icon></div>
            </th>
            <td mat-cell *matCellDef="let m">
              <div class="user-cell">
                <div class="av-sm">{{ m.assignedToNom[0] }}</div>
                <div class="cell-name">
                  {{ m.assignedToNom }}
                  @if (m.assignedToNom2) {
                    <span class="cell-sub">+ {{ m.assignedToNom2 }}</span>
                  }
                </div>
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="confiepar">
            <th mat-header-cell *matHeaderCellDef class="sortable-th" (click)="sort('confiepar')">
              <div class="th-inner">Confié par <mat-icon class="sort-icon" [class.sort-active]="sortField()==='confiepar'">{{ sortIcon('confiepar') }}</mat-icon></div>
            </th>
            <td mat-cell *matCellDef="let m">
              <div class="user-cell">
                <div class="av-sm av-admin">{{ m.assignedByNom[0] }}</div>
                <div class="cell-name">{{ m.assignedByNom }}</div>
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="date">
            <th mat-header-cell *matHeaderCellDef class="sortable-th" (click)="sort('date')">
              <div class="th-inner">Date mission <mat-icon class="sort-icon" [class.sort-active]="sortField()==='date'">{{ sortIcon('date') }}</mat-icon></div>
            </th>
            <td mat-cell *matCellDef="let m">
              <div class="date-cell">{{ m.dateMission | date:'dd/MM/yyyy' }}</div>
              <div class="cell-sub">Créée le {{ m.createdAt | date:'dd/MM HH:mm' }}</div>
              @if (isOverdue(m)) {
                <span class="overdue-badge"><mat-icon style="font-size:10px;width:10px;height:10px">schedule</mat-icon> RETARD</span>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="closedAt">
            <th mat-header-cell *matHeaderCellDef class="sortable-th" (click)="sort('closedAt')">
              <div class="th-inner">Clôturée le <mat-icon class="sort-icon" [class.sort-active]="sortField()==='closedAt'">{{ sortIcon('closedAt') }}</mat-icon></div>
            </th>
            <td mat-cell *matCellDef="let m">
              @if (m.completedAt) {
                <div class="date-cell">{{ m.completedAt | date:'dd/MM/yyyy' }}</div>
                <div class="cell-sub">{{ m.completedAt | date:'HH:mm' }}</div>
              } @else {
                <span class="no-value">—</span>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="statut">
            <th mat-header-cell *matHeaderCellDef class="sortable-th" (click)="sort('statut')">
              <div class="th-inner">Statut <mat-icon class="sort-icon" [class.sort-active]="sortField()==='statut'">{{ sortIcon('statut') }}</mat-icon></div>
            </th>
            <td mat-cell *matCellDef="let m">
              <div class="statut-cell">
                <span class="statut-chip {{ m.statut }}">{{ statutLabel(m.statut) }}</span>
                @if (m.notes) {
                  <mat-icon class="notes-icon" [matTooltip]="m.notes">chat_bubble_outline</mat-icon>
                }
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let m">
              <button mat-icon-button (click)="openDetail(m)" matTooltip="Voir les détails">
                <mat-icon>visibility</mat-icon>
              </button>
              @if (auth.isTechnicien() || auth.isChauffeur()) {
                <div class="tech-actions">
                  @if (m.statut === 'assignée') {
                    <button mat-stroked-button color="primary" (click)="updateStatut(m, 'acceptée')" style="margin-right:4px">
                      <mat-icon>thumb_up</mat-icon> Accepter
                    </button>
                    <button mat-stroked-button color="warn" (click)="refuser(m)">
                      <mat-icon>thumb_down</mat-icon> Refuser
                    </button>
                  }
                  @if (m.statut === 'acceptée') {
                    <button mat-flat-button color="primary" (click)="updateStatut(m, 'en_cours')">
                      <mat-icon>play_arrow</mat-icon> Démarrer
                    </button>
                  }
                  @if (m.statut === 'en_cours') {
                    <button mat-flat-button style="background:#43a047;color:white" (click)="terminer(m)">
                      <mat-icon>check_circle</mat-icon> Terminer
                    </button>
                  }
                </div>
              }
              @if (auth.isAdmin()) {
                <button mat-icon-button [matMenuTriggerFor]="mMenu" matTooltip="Actions">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #mMenu="matMenu">
                  @if (m.statut !== 'terminée') {
                    <button mat-menu-item (click)="editMission(m)">
                      <mat-icon>edit</mat-icon> Modifier
                    </button>
                  }
                  @if (m.statut === 'assignée') {
                    <button mat-menu-item (click)="updateStatut(m, 'en_cours')" style="color:#1565c0">
                      <mat-icon>play_circle</mat-icon> Forcer démarrage
                    </button>
                  }
                  @if (m.statut === 'en_cours') {
                    <button mat-menu-item (click)="terminer(m)" style="color:#2e7d32">
                      <mat-icon>check_circle</mat-icon> Clôturer
                    </button>
                  }
                  @if (m.notes) {
                    <button mat-menu-item (click)="snackNotes(m)">
                      <mat-icon>chat_bubble_outline</mat-icon> Voir les notes
                    </button>
                  }
                  <button mat-menu-item (click)="deleteMission(m)" style="color:#c62828">
                    <mat-icon>delete</mat-icon> Supprimer
                  </button>
                </mat-menu>
              }
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="cols()"></tr>
          <tr mat-row *matRowDef="let row; columns: cols();"
              [class.row-overdue]="isOverdue(row)"
              [class.row-urgent]="row.priorite === 'Haute' && row.statut === 'assignée' && !isOverdue(row)"
              [class.row-done]="row.statut === 'terminée' || row.statut === 'refusée'"></tr>
          <tr class="mat-row no-data-row" *matNoDataRow>
            <td class="mat-cell" [attr.colspan]="cols().length" style="text-align:center;padding:40px;color:#999">
              <mat-icon style="font-size:40px;width:40px;height:40px;display:block;margin:0 auto 8px;opacity:.3">assignment</mat-icon>
              Aucune mission trouvée
            </td>
          </tr>
        </table>

        <!-- Cartes (mobile) -->
        <div class="mission-cards">
          @if (paginated().length === 0) {
            <div class="mc-empty">
              <mat-icon>assignment</mat-icon>
              Aucune mission trouvée
            </div>
          }
          @for (m of paginated(); track m.id) {
            <div class="m-card"
                 [class.row-overdue]="isOverdue(m)"
                 [class.row-urgent]="m.priorite === 'Haute' && m.statut === 'assignée' && !isOverdue(m)"
                 [class.row-done]="m.statut === 'terminée' || m.statut === 'refusée'">
              <div class="mc-top">
                <mat-icon [class]="'prio-' + m.priorite.toLowerCase()" [matTooltip]="m.priorite">
                  {{ m.priorite === 'Haute' ? 'arrow_upward' : m.priorite === 'Basse' ? 'arrow_downward' : 'remove' }}
                </mat-icon>
                <div class="mc-titre-wrap">
                  <div class="mission-titre">{{ m.titre }}</div>
                  <div class="mission-type">{{ m.type }}</div>
                </div>
                <span class="statut-chip {{ m.statut }}">{{ statutLabel(m.statut) }}</span>
              </div>

              @if (m.description) {
                <div class="mc-desc">{{ m.description }}</div>
              }

              <div class="mc-line">
                <div class="user-cell">
                  <div class="av-sm">{{ m.assignedToNom[0] }}</div>
                  <div class="cell-name">
                    {{ m.assignedToNom }}
                    @if (m.assignedToNom2) {
                      <span class="cell-sub">+ {{ m.assignedToNom2 }}</span>
                    }
                  </div>
                </div>
                @if (auth.isAdmin()) {
                  <div class="user-cell">
                    <div class="av-sm av-admin">{{ m.assignedByNom[0] }}</div>
                    <div class="cell-name">{{ m.assignedByNom }}</div>
                  </div>
                }
              </div>

              <div class="mc-line">
                <div class="date-cell">{{ m.dateMission | date:'dd/MM/yyyy' }}
                  @if (isOverdue(m)) {
                    <span class="overdue-badge"><mat-icon style="font-size:10px;width:10px;height:10px">schedule</mat-icon> RETARD</span>
                  }
                </div>
                @if (m.completedAt) {
                  <div class="cell-sub">Clôturée le {{ m.completedAt | date:'dd/MM HH:mm' }}</div>
                }
                @if (m.notes) {
                  <mat-icon class="notes-icon" [matTooltip]="m.notes">chat_bubble_outline</mat-icon>
                }
              </div>

              <div class="mc-actions">
                <button mat-icon-button (click)="openDetail(m)" matTooltip="Voir les détails">
                  <mat-icon>visibility</mat-icon>
                </button>
                @if (auth.isTechnicien() || auth.isChauffeur()) {
                  <div class="tech-actions">
                    @if (m.statut === 'assignée') {
                      <button mat-stroked-button color="primary" (click)="updateStatut(m, 'acceptée')">
                        <mat-icon>thumb_up</mat-icon> Accepter
                      </button>
                      <button mat-stroked-button color="warn" (click)="refuser(m)">
                        <mat-icon>thumb_down</mat-icon> Refuser
                      </button>
                    }
                    @if (m.statut === 'acceptée') {
                      <button mat-flat-button color="primary" (click)="updateStatut(m, 'en_cours')">
                        <mat-icon>play_arrow</mat-icon> Démarrer
                      </button>
                    }
                    @if (m.statut === 'en_cours') {
                      <button mat-flat-button style="background:#43a047;color:white" (click)="terminer(m)">
                        <mat-icon>check_circle</mat-icon> Terminer
                      </button>
                    }
                  </div>
                }
                @if (auth.isAdmin()) {
                  <button mat-icon-button [matMenuTriggerFor]="mMenuCard" matTooltip="Actions">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #mMenuCard="matMenu">
                    @if (m.statut !== 'terminée') {
                      <button mat-menu-item (click)="editMission(m)">
                        <mat-icon>edit</mat-icon> Modifier
                      </button>
                    }
                    @if (m.statut === 'assignée') {
                      <button mat-menu-item (click)="updateStatut(m, 'en_cours')" style="color:#1565c0">
                        <mat-icon>play_circle</mat-icon> Forcer démarrage
                      </button>
                    }
                    @if (m.statut === 'en_cours') {
                      <button mat-menu-item (click)="terminer(m)" style="color:#2e7d32">
                        <mat-icon>check_circle</mat-icon> Clôturer
                      </button>
                    }
                    @if (m.notes) {
                      <button mat-menu-item (click)="snackNotes(m)">
                        <mat-icon>chat_bubble_outline</mat-icon> Voir les notes
                      </button>
                    }
                    <button mat-menu-item (click)="deleteMission(m)" style="color:#c62828">
                      <mat-icon>delete</mat-icon> Supprimer
                    </button>
                  </mat-menu>
                }
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Pagination -->
      <div class="table-footer">
        <mat-paginator
          [length]="sortedFiltered().length"
          [pageSize]="10"
          [pageSizeOptions]="[5, 10, 25, 50]"
          [showFirstLastButtons]="true"
          (page)="pageIndex.set($event.pageIndex); pageSize.set($event.pageSize)"
          aria-label="Sélectionner la page">
        </mat-paginator>
      </div>
    </div>
  `,
  styles: [`
    .page-container { padding: 24px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 24px;
      h1 { font-size: 22px; color: #1a3a5c; margin: 0; display: flex; align-items: center; gap: 8px; }
    }
    .title-icon { font-size: 26px; width: 26px; height: 26px; color: #1a3a5c; }
    .sub-title { font-size: 13px; color: #78909c; display: block; margin-top: 4px; }

    /* KPI */
    .kpi-row { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .kpi-card {
      flex: 1; min-width: 110px; background: white; border-radius: 10px; padding: 14px 18px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.07); border-left: 4px solid #1a3a5c;
      display: flex; flex-direction: column; gap: 2px;
      mat-icon { font-size: 20px; width: 20px; height: 20px; color: #1a3a5c; opacity: .7; }
      .kv { font-size: 26px; font-weight: 700; color: #1a3a5c; line-height: 1; }
      .kl { font-size: 11px; color: #78909c; }
      &.warn    { border-left-color: #fb8c00; mat-icon,.kv { color: #fb8c00; } }
      &.info    { border-left-color: #1e88e5; mat-icon,.kv { color: #1e88e5; } }
      &.success { border-left-color: #43a047; mat-icon,.kv { color: #43a047; } }
      &.overdue { border-left-color: #e65100; mat-icon,.kv { color: #e65100; } }
    }

    /* Panel disponibilité */
    .avail-card { margin-bottom: 20px; border-radius: 10px !important; }
    .tech-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px,1fr)); gap: 12px; padding-top: 8px; }
    .tech-avail-card {
      display: flex; align-items: center; gap: 10px; padding: 12px;
      border: 1px solid #e0e6ed; border-radius: 8px; background: #fafafa;
      transition: border-color .2s;
      &.online { border-color: #a5d6a7; background: #f1f8e9; }
      &.busy   { border-color: #ffcc80; background: #fff8e1; }
    }
    .tech-av-wrap { position: relative; flex-shrink: 0; }
    .tech-av { width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg,#1a3a5c,#2a5fa0); color: white; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; }
    .pres-dot { position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; border-radius: 50%; background: #ccc; border: 2px solid white; &.online { background: #4caf50; } }
    .tech-info { flex: 1; min-width: 0; }
    .tech-name-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .tech-name { font-size: 13px; font-weight: 600; color: #1a3a5c; }
    .role-tag {
      font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 8px;
      text-transform: uppercase; letter-spacing: 0.5px;
      &.technicien { background: #e0f2f1; color: #00695c; }
      &.chauffeur  { background: #fff9c4; color: #f57f17; }
      &.admin      { background: #e3f2fd; color: #0d47a1; }
      &.support    { background: #fff3e0; color: #e65100; }
      &.superadmin { background: #f3e5f5; color: #7b1fa2; }
    }
    .tech-status { font-size: 11px; }
    .online-text  { color: #2e7d32; font-weight: 600; }
    .offline-text { color: #9e9e9e; }
    .tech-load { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px; }
    .load-chip { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 10px;
      &.mission { background: #fff3e0; color: #e65100; }
      &.interv  { background: #e3f2fd; color: #1565c0; }
      &.free    { background: #e8f5e9; color: #2e7d32; }
    }

    /* Filtres */
    .filters-bar {
      display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
      background: white; padding: 12px 16px; border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06); margin-bottom: 16px;
    }
    .filter-search { width: 220px; }
    .result-count  { font-size: 13px; color: #78909c; margin-left: auto; white-space: nowrap; }
    .clear-btn     { height: 36px; font-size: 12px; }

    /* Table */
    .table-container { background: white; border-radius: 10px 10px 0 0; box-shadow: 0 2px 8px rgba(0,0,0,0.06); overflow-x: auto; overflow-y: hidden; }
    .table-footer    { background: white; border-top: 1px solid #f0f4f8; border-radius: 0 0 10px 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }

    /* Sortable headers */
    .sortable-th { cursor: pointer; user-select: none; &:hover { background: #f5f7fa; } }
    .th-inner    { display: flex; align-items: center; gap: 4px; }
    .sort-icon   { font-size: 16px; width: 16px; height: 16px; color: #ccc; transition: color .2s; &.sort-active { color: #1a3a5c; } }

    .mission-titre { font-weight: 600; font-size: 13px; color: #1a3a5c; }
    .mission-type  { font-size: 11px; color: #78909c; }
    .desc-cell  { font-size: 12px; color: #546e7a; max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: default; }
    .no-value   { color: #ccc; font-size: 16px; }
    .user-cell { display: flex; align-items: center; gap: 8px; }
    .av-sm { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg,#1a3a5c,#2a5fa0); color: white; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
    .av-admin { background: linear-gradient(135deg,#546e7a,#78909c); }
    .cell-name { font-weight: 600; font-size: 13px; }
    .cell-sub  { font-size: 11px; color: #78909c; }
    .date-cell { font-size: 13px; color: #37474f; }

    /* Retard */
    .overdue-badge {
      display: inline-flex; align-items: center; gap: 2px; margin-top: 2px;
      font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 4px;
      background: #fce4ec; color: #c62828; letter-spacing: 0.5px;
    }

    /* Priorité */
    .prio-haute   { color: #c62828; }
    .prio-normale { color: #fb8c00; }
    .prio-basse   { color: #43a047; }

    /* Statut */
    .statut-cell { display: flex; align-items: center; gap: 6px; }
    .statut-chip {
      display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;
      &.assignée   { background: #fff3e0; color: #e65100; }
      &.acceptée   { background: #e3f2fd; color: #1565c0; }
      &.en_cours   { background: #e8eaf6; color: #3949ab; }
      &.terminée   { background: #e8f5e9; color: #2e7d32; }
      &.refusée    { background: #fce4ec; color: #c62828; }
    }
    .notes-icon { font-size: 14px; width: 14px; height: 14px; color: #90a4ae; cursor: help; }

    /* Row highlights */
    .row-overdue td { border-left: 3px solid #e65100 !important; background: #fff8f0; }
    .row-urgent  td { border-left: 3px solid #c62828 !important; background: #fff8f8; }
    .row-done    td { opacity: .65; }

    /* Tech actions */
    .tech-actions { display: flex; flex-wrap: wrap; gap: 6px; }

    /* ── Cartes missions (mobile) ── */
    .mission-cards { display: none; }
    @media (max-width: 640px) {
      .table-container table { display: none; }
      .mission-cards { display: flex; flex-direction: column; gap: 10px; padding: 8px; }
      .page-container { padding: 12px; }
      .filters-bar { padding: 10px 12px; }
      .filter-search { width: 100%; }
      .tech-grid { grid-template-columns: 1fr; }
    }
    .mc-empty {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 40px 20px; color: #999; text-align: center;
      mat-icon { font-size: 40px; width: 40px; height: 40px; opacity: .3; }
    }
    .m-card {
      background: white; border: 1px solid #e8edf2; border-radius: 12px; padding: 12px 14px;
      &.row-overdue { border-left: 3px solid #e65100; background: #fff8f0; }
      &.row-urgent  { border-left: 3px solid #c62828; background: #fff8f8; }
      &.row-done    { opacity: .7; }
    }
    .mc-top { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px;
      mat-icon:first-child { flex-shrink: 0; margin-top: 2px; }
    }
    .mc-titre-wrap { flex: 1; min-width: 0; }
    .mc-desc { font-size: 12px; color: #546e7a; margin-bottom: 8px; }
    .mc-line { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
    .mc-actions { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding-top: 8px; border-top: 1px solid #f0f0f0; }
  `]
})
export class MissionsComponent implements OnInit {
  private missionSvc      = inject(MissionService);
  private userSvc         = inject(UserService);
  private interventionSvc = inject(InterventionService);
  private dialog          = inject(MatDialog);
  private snack           = inject(MatSnackBar);
  private confirmSvc      = inject(ConfirmService);
  private notifSvc        = inject(NotificationService);
  auth        = inject(AuthService);
  presenceSvc = inject(PresenceService);

  paginator = viewChild<MatPaginator>(MatPaginator);

  search       = signal('');
  filterTech   = signal('');
  filterStatut = signal('');
  filterPrio   = signal('');
  sortField    = signal('priorite');
  sortDir      = signal<'asc' | 'desc'>('asc');
  pageIndex    = signal(0);
  pageSize     = signal(10);

  constructor() {
    // Reset to first page whenever any filter or sort axis changes
    effect(() => {
      this.search(); this.filterTech(); this.filterStatut(); this.filterPrio(); this.sortField();
      untracked(() => { this.pageIndex.set(0); this.paginator()?.firstPage(); });
    });
  }

  ngOnInit(): void { this.missionSvc.loadFromApi(); }

  /* ── Data ─────────────────────────────────────────────────────────────── */
  techniciens = computed(() => {
    return this.userSvc.getAll()
      .filter(u => u.actif)
      .sort((a, b) => (this.presenceSvc.isOnline(a.id) ? 0 : 1) - (this.presenceSvc.isOnline(b.id) ? 0 : 1));
  });

  allMissions = computed(() => this.missionSvc.getAll());

  sortedFiltered = computed(() => {
    const isFieldAgent = this.auth.isTechnicien() || this.auth.isChauffeur();
    let list = isFieldAgent
      ? this.missionSvc.getByUser(this.auth.currentUser()!.id)
      : this.allMissions();

    const sq = this.search().toLowerCase().trim();
    if (sq) list = list.filter(m =>
      m.titre.toLowerCase().includes(sq) ||
      (m.description ?? '').toLowerCase().includes(sq) ||
      m.assignedToNom.toLowerCase().includes(sq)
    );
    const ft = this.filterTech();   if (ft) list = list.filter(m => m.assignedToId === ft);
    const fs = this.filterStatut(); if (fs) list = list.filter(m => m.statut === fs);
    const fp = this.filterPrio();   if (fp) list = list.filter(m => m.priorite === fp);

    const field = this.sortField();
    const dir   = this.sortDir();
    const pMap: Record<string, number> = { Haute: 0, Normale: 1, Basse: 2 };
    const sMap: Record<string, number> = { assignée: 0, acceptée: 1, en_cours: 2, terminée: 3, refusée: 4 };

    return [...list].sort((a, b) => {
      let cmp = 0;
      if      (field === 'priorite')   cmp = (pMap[a.priorite] ?? 1) - (pMap[b.priorite] ?? 1);
      else if (field === 'date')       cmp = a.dateMission.localeCompare(b.dateMission);
      else if (field === 'statut')     cmp = (sMap[a.statut] ?? 0) - (sMap[b.statut] ?? 0);
      else if (field === 'titre')       cmp = a.titre.localeCompare(b.titre);
      else if (field === 'description') cmp = (a.description ?? '').localeCompare(b.description ?? '');
      else if (field === 'technicien') cmp = a.assignedToNom.localeCompare(b.assignedToNom);
      else if (field === 'confiepar')  cmp = a.assignedByNom.localeCompare(b.assignedByNom);
      else if (field === 'closedAt')   cmp = (a.completedAt ?? '').localeCompare(b.completedAt ?? '');
      else                             cmp = b.createdAt.localeCompare(a.createdAt);
      return dir === 'asc' ? cmp : -cmp;
    });
  });

  paginated = computed(() => {
    const list  = this.sortedFiltered();
    const start = this.pageIndex() * this.pageSize();
    return list.slice(start, start + this.pageSize());
  });

  overdueCount = computed(() => this.allMissions().filter(m => this.isOverdue(m)).length);

  hasActiveFilters = computed(() => !!(this.search() || this.filterTech() || this.filterStatut() || this.filterPrio()));

  cols = computed(() =>
    this.auth.isAdmin()
      ? ['priorite', 'titre', 'description', 'technicien', 'confiepar', 'date', 'closedAt', 'statut', 'actions']
      : ['priorite', 'titre', 'description', 'date', 'closedAt', 'statut', 'actions']
  );

  /* ── Helpers ──────────────────────────────────────────────────────────── */
  countStatut(s: MissionStatut): number { return this.allMissions().filter(m => m.statut === s).length; }

  activeMissions(techId: string): number {
    return this.allMissions().filter(m =>
      (m.assignedToId === techId || m.assignedToId2 === techId) && !['terminée','refusée'].includes(m.statut)
    ).length;
  }

  activeIntervCount(techId: string): number {
    return this.interventionSvc.getAllRaw().filter(i => i.technicienId === techId && i.statut === 'En cours').length;
  }

  techIsBusy(techId: string): boolean { return this.activeMissions(techId) + this.activeIntervCount(techId) > 0; }

  isOverdue(m: Mission): boolean {
    if (['terminée', 'refusée'].includes(m.statut)) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return new Date(m.dateMission) < today;
  }

  initials(u: { prenom: string; nom: string }): string { return `${u.prenom[0]}${u.nom[0]}`.toUpperCase(); }

  statutLabel(s: MissionStatut): string {
    return { assignée: 'Assignée', acceptée: 'Acceptée', en_cours: 'En cours', terminée: 'Terminée', refusée: 'Refusée' }[s] ?? s;
  }

  sort(field: string): void {
    if (this.sortField() === field) this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    else { this.sortField.set(field); this.sortDir.set('asc'); }
  }

  sortIcon(field: string): string {
    if (this.sortField() !== field) return 'unfold_more';
    return this.sortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  clearFilters(): void { this.search.set(''); this.filterTech.set(''); this.filterStatut.set(''); this.filterPrio.set(''); }

  snackNotes(m: Mission): void {
    this.snack.open(`Notes : ${m.notes}`, 'Fermer', { duration: 6000 });
  }

  /* ── Dialogs ──────────────────────────────────────────────────────────── */
  openDialog(preselect?: User, mission?: Mission): void {
    const ref = this.dialog.open(MissionDialogComponent, {
      width: '500px',
      data: {
        techniciens: this.techniciens(),
        presenceSvc: this.presenceSvc,
        activeMissions: (id: string) => this.activeMissions(id),
        activeInterventions: (id: string) => this.activeIntervCount(id),
        preselect,
        mission,
      }
    });
    ref.afterClosed().subscribe(async (val) => {
      if (!val) return;
      const { editId, ...data } = val;
      const result = editId ? await this.missionSvc.update(editId, data) : await this.missionSvc.create(data);
      if (result) {
        const noms = result.assignedToNom2 ? `${result.assignedToNom} et ${result.assignedToNom2}` : result.assignedToNom;
        this.snack.open(
          editId ? `Mission "${result.titre}" modifiée ✓` : `Mission confiée à ${noms} ✓`,
          'OK', { duration: 3000, panelClass: 'success-snack' }
        );
        if (result.type?.toLowerCase() === 'déplacement') {
          const user = this.auth.currentUser();
          this.notifSvc.send({
            type: 'mission_assignee',
            agentNom: result.assignedToNom2 || result.assignedToNom,
            requestedById: user?.id,
            requestedByNom: user ? `${user.prenom} ${user.nom}` : undefined,
            requestedByRole: user?.role,
            message: `Déplacement à effectuer — ${result.titre} (${noms})`,
          });
        }
      } else {
        this.snack.open(editId ? 'Erreur lors de la modification' : 'Erreur lors de la création',
          'OK', { duration: 3000, panelClass: 'error-snack' });
      }
    });
  }

  openDialogFor(t: User): void { this.openDialog(t); }

  editMission(m: Mission): void { this.openDialog(undefined, m); }

  openDetail(m: Mission): void {
    this.dialog.open(MissionDetailDialogComponent, {
      width: '480px',
      data: { mission: m, statutLabel: this.statutLabel(m.statut) }
    });
  }

  /* ── Actions ──────────────────────────────────────────────────────────── */
  async updateStatut(m: Mission, statut: MissionStatut): Promise<void> {
    const result = await this.missionSvc.updateStatut(m.id, statut);
    if (result) this.snack.open(`Mission : ${this.statutLabel(statut)}`, 'OK', { duration: 2000, panelClass: 'success-snack' });
  }

  async refuser(m: Mission): Promise<void> {
    const ref = this.dialog.open(NotesDialogComponent, {
      width: '420px',
      data: { title: 'Refuser la mission', mission: m.titre, label: 'Motif du refus (facultatif)',
              placeholder: 'Expliquez pourquoi vous refusez cette mission...', btnLabel: 'Refuser',
              btnColor: 'warn', icon: 'thumb_down', color: '#c62828' }
    });
    const motif: string | undefined = await firstValueFrom(ref.afterClosed());
    if (motif === undefined) return;
    await this.missionSvc.updateStatut(m.id, 'refusée', motif || undefined);
    this.snack.open('Mission refusée', 'OK', { duration: 2000, panelClass: 'warn-snack' });
  }

  async terminer(m: Mission): Promise<void> {
    const ref = this.dialog.open(NotesDialogComponent, {
      width: '420px',
      data: { title: 'Clôturer la mission', mission: m.titre, label: 'Notes de clôture (facultatif)',
              placeholder: 'Résumez ce qui a été accompli...', btnLabel: 'Terminer',
              btnColor: 'primary', icon: 'check_circle', color: '#43a047' }
    });
    const notes: string | undefined = await firstValueFrom(ref.afterClosed());
    if (notes === undefined) return;
    const result = await this.missionSvc.updateStatut(m.id, 'terminée', notes || undefined);
    if (result) this.snack.open('Mission terminée ✓', 'OK', { duration: 2000, panelClass: 'success-snack' });
  }

  async deleteMission(m: Mission): Promise<void> {
    if (!await this.confirmSvc.danger(`Supprimer la mission "${m.titre}" ?`)) return;
    await this.missionSvc.delete(m.id);
    this.snack.open('Mission supprimée', 'OK', { duration: 2000 });
  }
}
