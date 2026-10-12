import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { PlanningService, getISOWeek, getWeekDates } from '../../core/services/planning.service';
import { UserService } from '../../core/services/user.service';
import { CreneauService } from '../../core/services/creneau.service';
import { ThemeService } from '../../core/services/theme.service';
import { PlanningEntry } from '../../core/models/planning.model';

const JOURS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const MOIS_FR  = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc'];
const FALLBACK_COLOR = { texte: '#546e7a', fond: '#eceff1' };
const FALLBACK_COLOR_DARK = { texte: '#94a3b8', fond: 'rgba(148,163,184,0.15)' };

interface EntryRow extends PlanningEntry {
  dayName: string;
  dayLabel: string;
  userRoleActual: string;
}

interface WeekGroup {
  year: number;
  week: number;
  label: string;
  range: string;
  rows: EntryRow[];
}

@Component({
  selector: 'app-planning-history',
  standalone: true,
  imports: [
    FormsModule, RouterLink,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1><mat-icon style="vertical-align:middle;margin-right:8px">history</mat-icon>Historique du planning</h1>
          <span class="sub-title">Récapitulatif des semaines passées, toutes affectations confondues</span>
        </div>
        <a mat-stroked-button routerLink="/planning">
          <mat-icon>calendar_month</mat-icon> Retour au planning
        </a>
      </div>

      <div class="filters-bar">
        <mat-form-field appearance="outline">
          <mat-label>Rechercher un technicien</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [ngModel]="search()" (ngModelChange)="search.set($event)" placeholder="Nom...">
        </mat-form-field>

        <mat-form-field appearance="outline" style="width:200px">
          <mat-label>Technicien</mat-label>
          <mat-select [ngModel]="filterUserId()" (ngModelChange)="filterUserId.set($event)">
            <mat-option value="">Tous</mat-option>
            @for (u of users(); track u.id) {
              <mat-option [value]="u.id">{{ u.prenom }} {{ u.nom }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" style="width:170px">
          <mat-label>Créneau</mat-label>
          <mat-select [ngModel]="filterType()" (ngModelChange)="filterType.set($event)">
            <mat-option value="">Tous</mat-option>
            @for (c of creneaux(); track c.id) {
              <mat-option [value]="c.label">{{ c.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" style="width:170px">
          <mat-label>Période</mat-label>
          <mat-select [ngModel]="periodWeeks()" (ngModelChange)="periodWeeks.set($event)">
            <mat-option [value]="4">4 dernières semaines</mat-option>
            <mat-option [value]="8">8 dernières semaines</mat-option>
            <mat-option [value]="12">12 dernières semaines</mat-option>
            <mat-option [value]="26">6 derniers mois</mat-option>
            <mat-option [value]="0">Tout l'historique</mat-option>
          </mat-select>
        </mat-form-field>

        <span class="result-count">{{ totalEntries() }} affectation(s) · {{ weekGroups().length }} semaine(s)</span>
      </div>

      @if (weekGroups().length === 0) {
        <div class="empty-state">
          <mat-icon>event_busy</mat-icon>
          <p>Aucune affectation trouvée pour cette période.</p>
        </div>
      } @else {
        @for (grp of weekGroups(); track grp.year + '-' + grp.week) {
          <mat-card class="week-card">
            <mat-card-header>
              <mat-card-title>
                <mat-icon>date_range</mat-icon>
                Semaine {{ grp.week }} · {{ grp.year }}
                <span class="week-range">{{ grp.range }}</span>
                <span class="count-badge">{{ grp.rows.length }}</span>
              </mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Jour</th>
                      <th>Technicien</th>
                      <th>Rôle</th>
                      <th>Créneau</th>
                      <th>Horaires</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of grp.rows; track row.id) {
                      <tr>
                        <td class="day-cell">
                          <strong>{{ row.dayName }}</strong>
                          <span>{{ row.dayLabel }}</span>
                        </td>
                        <td>{{ row.userNom }}</td>
                        <td><span class="role-badge {{ row.userRoleActual }}">{{ row.userRoleActual }}</span></td>
                        <td>
                          <span class="creneau-chip" [style.background]="creneauColor(row.type).fond" [style.color]="creneauColor(row.type).texte">
                            {{ row.type }}
                          </span>
                        </td>
                        <td class="hours-cell">{{ row.heureDebut }} – {{ row.heureFin }}</td>
                        <td class="note-cell">{{ row.note || '—' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </mat-card-content>
          </mat-card>
        }
      }
    </div>
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; }
    .page-header h1 { font-size: 22px; color: #1a3a5c; margin: 0; display: flex; align-items: center; }
    .sub-title { font-size: 13px; color: var(--text-secondary); display: block; margin-top: 4px; }

    .filters-bar {
      display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
      margin-bottom: 20px;
      mat-form-field { flex: 1; min-width: 180px; }
    }
    .result-count { color: var(--text-secondary); font-size: 13px; white-space: nowrap; margin-left: auto; }

    .empty-state {
      text-align: center; padding: 60px 20px; color: var(--text-secondary);
      mat-icon { font-size: 44px; width: 44px; height: 44px; display: block; margin: 0 auto 12px; opacity: .5; }
    }

    .week-card { margin-bottom: 16px; border-radius: 12px !important; overflow: hidden; }
    mat-card-title {
      display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700;
      mat-icon { color: var(--primary-light); font-size: 18px; width: 18px; height: 18px; }
    }
    .week-range { font-weight: 400; color: var(--text-secondary); font-size: 12.5px; margin-left: 2px; }
    .count-badge {
      margin-left: auto; background: var(--primary); color: white; font-size: 11px;
      padding: 2px 9px; border-radius: 10px; font-weight: 700;
    }

    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead tr { background: #f5f7fa; }
    th { padding: 8px 12px; text-align: left; font-weight: 700; color: #546e7a; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; white-space: nowrap; }
    td { padding: 8px 12px; border-top: 1px solid #f0f4f8; vertical-align: middle; white-space: nowrap; }
    .day-cell { display: flex; flex-direction: column; gap: 1px; strong { font-size: 12.5px; } span { font-size: 11px; color: var(--text-secondary); } }
    .hours-cell { font-variant-numeric: tabular-nums; color: var(--text-secondary); }
    .note-cell { color: var(--text-secondary); font-style: italic; white-space: normal; max-width: 260px; }
    .creneau-chip { padding: 3px 10px; border-radius: 10px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }

    @media (max-width: 640px) {
      .filters-bar mat-form-field { min-width: 100%; flex: 1 1 100%; }
      .result-count { margin-left: 0; }
    }
  `]
})
export class PlanningHistoryComponent {
  private planningSvc = inject(PlanningService);
  private userSvc     = inject(UserService);
  private creneauSvc  = inject(CreneauService);
  private themeSvc    = inject(ThemeService);

  search       = signal('');
  filterUserId = signal('');
  filterType   = signal('');
  periodWeeks  = signal(8);

  users     = computed(() => this.userSvc.getAll().filter(u => u.actif && u.role !== 'superadmin'));
  creneaux  = computed(() => this.creneauSvc.getAll());

  creneauColor(type: string) {
    const c = this.creneaux().find(x => x.label === type);
    if (c) return { texte: c.couleurTexte, fond: c.couleurFond };
    return this.themeSvc.dark() ? FALLBACK_COLOR_DARK : FALLBACK_COLOR;
  }

  private filteredEntries = computed(() => {
    const q      = this.search().trim().toLowerCase();
    const userId = this.filterUserId();
    const type   = this.filterType();
    const weeks  = this.periodWeeks();

    let entries = [...this.planningSvc.getAll()];

    if (weeks > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - weeks * 7);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      entries = entries.filter(e => e.date >= cutoffStr);
    }
    if (userId) entries = entries.filter(e => e.userId === userId);
    if (type)   entries = entries.filter(e => e.type === type);
    if (q)      entries = entries.filter(e => e.userNom.toLowerCase().includes(q));

    return entries;
  });

  totalEntries = computed(() => this.filteredEntries().length);

  weekGroups = computed((): WeekGroup[] => {
    const byWeek = new Map<string, EntryRow[]>();

    for (const e of this.filteredEntries()) {
      const d = new Date(e.date + 'T00:00:00');
      const year = d.getFullYear();
      const week = getISOWeek(d);
      const key  = `${year}-${week}`;
      const dow  = (d.getDay() + 6) % 7; // 0 = lundi

      const row: EntryRow = {
        ...e,
        dayName: JOURS_FR[dow],
        dayLabel: `${d.getDate()} ${MOIS_FR[d.getMonth()]}`,
        userRoleActual: this.userSvc.getAll().find(u => u.id === e.userId)?.role ?? '',
      };

      if (!byWeek.has(key)) byWeek.set(key, []);
      byWeek.get(key)!.push(row);
    }

    const groups: WeekGroup[] = [...byWeek.entries()].map(([key, rows]) => {
      const [year, week] = key.split('-').map(Number);
      const dates = getWeekDates(year, week);
      const f = dates[0], l = dates[6];
      rows.sort((a, b) => a.date === b.date ? a.userNom.localeCompare(b.userNom) : a.date.localeCompare(b.date));
      return {
        year, week,
        label: `Semaine ${week}`,
        range: `${f.getDate()} ${MOIS_FR[f.getMonth()]} – ${l.getDate()} ${MOIS_FR[l.getMonth()]} ${year}`,
        rows,
      };
    });

    groups.sort((a, b) => b.year !== a.year ? b.year - a.year : b.week - a.week);
    return groups;
  });
}
