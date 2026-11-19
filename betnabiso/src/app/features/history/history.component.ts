import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { InterventionService } from '../../core/services/intervention.service';
import { Intervention } from '../../core/models/intervention.model';
import { MissionService } from '../../core/services/mission.service';
import { MissionStatut } from '../../core/models/mission.model';
import { UserService } from '../../core/services/user.service';
import { ZoneService } from '../../core/services/zone.service';
import { ExportService } from '../../core/services/export.service';
import { TypeLabelService } from '../../core/services/type-label.service';
import { DateRangeFilterComponent, DateRangeValue } from '../../shared/components/date-range-filter/date-range-filter.component';
import { AttentesReportComponent } from './attentes-report.component';

type Period = 'all' | 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'all',       label: 'Toutes les dates' },
  { value: 'today',     label: "Aujourd'hui" },
  { value: 'yesterday', label: 'Hier' },
  { value: 'thisWeek',  label: 'Cette semaine' },
  { value: 'lastWeek',  label: 'Semaine dernière' },
  { value: 'thisMonth', label: 'Ce mois-ci' },
  { value: 'lastMonth', label: 'Mois dernier' },
  { value: 'thisYear',  label: 'Cette année' },
  { value: 'lastYear',  label: 'Année dernière' },
];

function periodRange(p: Period): { start: Date; end: Date } | null {
  const now = new Date();
  const day = (y: number, m: number, d: number) => new Date(y, m, d);
  const endOf = (d: Date) => { const r = new Date(d); r.setHours(23, 59, 59, 999); return r; };
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const mondayOffset = (now.getDay() + 6) % 7;
  switch (p) {
    case 'today':     return { start: day(y, m, d),     end: endOf(day(y, m, d)) };
    case 'yesterday': return { start: day(y, m, d - 1), end: endOf(day(y, m, d - 1)) };
    case 'thisWeek':  return { start: day(y, m, d - mondayOffset),     end: endOf(day(y, m, d - mondayOffset + 6)) };
    case 'lastWeek':  return { start: day(y, m, d - mondayOffset - 7), end: endOf(day(y, m, d - mondayOffset - 1)) };
    case 'thisMonth': return { start: day(y, m, 1),     end: endOf(day(y, m + 1, 0)) };
    case 'lastMonth': return { start: day(y, m - 1, 1), end: endOf(day(y, m, 0)) };
    case 'thisYear':  return { start: day(y, 0, 1),     end: endOf(day(y, 11, 31)) };
    case 'lastYear':  return { start: day(y - 1, 0, 1), end: endOf(day(y - 1, 11, 31)) };
    default:          return null;
  }
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [
    FormsModule, DatePipe, RouterLink,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatTableModule, MatDividerModule, MatTooltipModule,
    MatChipsModule, MatTabsModule, MatPaginatorModule, DateRangeFilterComponent, AttentesReportComponent
  ],
  template: `
    <div class="page-container">

      <!-- ═══════════════ HEADER ═══════════════ -->
      <div class="page-header">
        <div>
          <h1><mat-icon class="title-icon">history_edu</mat-icon> Historique & Rapports</h1>
          <span class="sub-title">Journal des interventions · Analyse de productivité</span>
        </div>
        <div class="header-actions">
          <div class="pill-field" style="width:200px">
            <label class="pill-label">Période (synthèse)</label>
            <mat-form-field appearance="outline" class="pill-select">
              <mat-icon matPrefix>date_range</mat-icon>
              <mat-select [ngModel]="period()" (ngModelChange)="period.set($event)">
                @for (o of periodOptions; track o.value) {
                  <mat-option [value]="o.value">{{ o.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>
          <button mat-stroked-button (click)="exportCsv()">
            <mat-icon>table_view</mat-icon> CSV
          </button>
          <button mat-raised-button color="primary" (click)="exportPdf()">
            <mat-icon>picture_as_pdf</mat-icon> PDF
          </button>
        </div>
      </div>

      <!-- ═══════════════ KPI ═══════════════ -->
      <div class="kpi-row">
        <div class="kpi-card">
          <mat-icon class="kpi-icon">assignment</mat-icon>
          <div class="kpi-val">{{ totalInterventions() }}</div>
          <div class="kpi-label">Interventions</div>
        </div>
        <div class="kpi-card success">
          <mat-icon class="kpi-icon">check_circle</mat-icon>
          <div class="kpi-val">{{ tauxSucces() }}%</div>
          <div class="kpi-label">Taux de réussite</div>
        </div>
        <div class="kpi-card error">
          <mat-icon class="kpi-icon">cancel</mat-icon>
          <div class="kpi-val">{{ totalEchecs() }}</div>
          <div class="kpi-label">Échecs</div>
        </div>
        <div class="kpi-card warn">
          <mat-icon class="kpi-icon">swap_horiz</mat-icon>
          <div class="kpi-val">{{ totalReassignments() }}</div>
          <div class="kpi-label">Réaffectations</div>
        </div>
        <div class="kpi-card info">
          <mat-icon class="kpi-icon">local_shipping</mat-icon>
          <div class="kpi-val">{{ totalTransports() }}</div>
          <div class="kpi-label">Transports</div>
        </div>
        <div class="kpi-card neutral">
          <mat-icon class="kpi-icon">people</mat-icon>
          <div class="kpi-val">{{ avgInterventionsPerTech() }}</div>
          <div class="kpi-label">Moy. / technicien</div>
        </div>
      </div>

      <!-- ═══════════════ TABS ═══════════════ -->
      <mat-tab-group animationDuration="200ms" class="main-tabs">

        <!-- ─────── TAB 1 : SYNTHÈSE ─────── -->
        <mat-tab label="Synthèse de productivité">
          <div class="tab-content">

            <!-- Techniciens -->
            <mat-card class="section-card">
              <mat-card-header>
                <mat-icon mat-card-avatar class="section-avatar tech">engineering</mat-icon>
                <mat-card-title>Productivité des techniciens</mat-card-title>
                <mat-card-subtitle>{{ techStats().length }} technicien(s) · {{ periodLabel() }}</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <div class="table-wrap">
                  <table mat-table [dataSource]="techStats()">
                    <ng-container matColumnDef="rang">
                      <th mat-header-cell *matHeaderCellDef>#</th>
                      <td mat-cell *matCellDef="let r">
                        @if (r.rang === 1) { <span class="medal">🥇</span> }
                        @else if (r.rang === 2) { <span class="medal">🥈</span> }
                        @else if (r.rang === 3) { <span class="medal">🥉</span> }
                        @else { <span class="cell-sub">#{{ r.rang }}</span> }
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="nom">
                      <th mat-header-cell *matHeaderCellDef>Technicien</th>
                      <td mat-cell *matCellDef="let r">
                        <div class="user-cell">
                          <div class="avatar-sm tech">{{ r.nom[0] }}</div>
                          <div>
                            <div class="cell-name">{{ r.nom }}</div>
                            <div class="cell-sub">{{ r.zone }}</div>
                          </div>
                        </div>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="total">
                      <th mat-header-cell *matHeaderCellDef>Total</th>
                      <td mat-cell *matCellDef="let r"><strong class="total-num">{{ r.total }}</strong></td>
                    </ng-container>
                    <ng-container matColumnDef="terminees">
                      <th mat-header-cell *matHeaderCellDef>Terminées</th>
                      <td mat-cell *matCellDef="let r"><span class="chip green">{{ r.terminees }}</span></td>
                    </ng-container>
                    <ng-container matColumnDef="echecs">
                      <th mat-header-cell *matHeaderCellDef>Échecs</th>
                      <td mat-cell *matCellDef="let r"><span class="chip red">{{ r.echecs }}</span></td>
                    </ng-container>
                    <ng-container matColumnDef="enCours">
                      <th mat-header-cell *matHeaderCellDef>En cours</th>
                      <td mat-cell *matCellDef="let r"><span class="chip orange">{{ r.enCours }}</span></td>
                    </ng-container>
                    <ng-container matColumnDef="taux">
                      <th mat-header-cell *matHeaderCellDef>Taux réussite</th>
                      <td mat-cell *matCellDef="let r">
                        @if (r.total > 0) {
                          <div class="progress-container">
                            <div class="progress-bar"
                                 [class.low]="r.tauxRaw < 50"
                                 [class.mid]="r.tauxRaw >= 50 && r.tauxRaw < 80"
                                 [class.high]="r.tauxRaw >= 80"
                                 [style.width.%]="r.tauxRaw"></div>
                          </div>
                          <span class="taux-label">{{ r.tauxSucces }}</span>
                        } @else { <span class="cell-sub">—</span> }
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="dureeMoy">
                      <th mat-header-cell *matHeaderCellDef>Durée moy.</th>
                      <td mat-cell *matCellDef="let r">{{ r.dureeMoy }}</td>
                    </ng-container>
                    <ng-container matColumnDef="typePrincipal">
                      <th mat-header-cell *matHeaderCellDef>Type principal</th>
                      <td mat-cell *matCellDef="let r"><span class="chip blue">{{ r.typePrincipal }}</span></td>
                    </ng-container>
                    <ng-container matColumnDef="reassignes">
                      <th mat-header-cell *matHeaderCellDef>Réaffect. subies</th>
                      <td mat-cell *matCellDef="let r">
                        @if (r.reassignes > 0) { <span class="chip red">{{ r.reassignes }}</span> }
                        @else { <span class="chip green">0</span> }
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="missions">
                      <th mat-header-cell *matHeaderCellDef>Missions</th>
                      <td mat-cell *matCellDef="let r">
                        @if (r.missionsTotal > 0) {
                          <span class="chip blue">{{ r.missionsTerminees }}/{{ r.missionsTotal }}</span>
                        } @else { <span class="cell-sub">—</span> }
                      </td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="techCols"></tr>
                    <tr mat-row *matRowDef="let row; columns: techCols;"></tr>
                    <tr class="mat-row no-data-row" *matNoDataRow>
                      <td class="mat-cell no-data" [attr.colspan]="techCols.length">Aucune donnée</td>
                    </tr>
                  </table>

                  <!-- Cartes (mobile) -->
                  <div class="hx-cards">
                    @if (techStats().length === 0) {
                      <div class="hx-empty">Aucune donnée</div>
                    }
                    @for (r of techStats(); track r.nom) {
                      <div class="hx-card">
                        <div class="hx-top">
                          <div class="user-cell">
                            <div class="avatar-sm tech">{{ r.nom[0] }}</div>
                            <div>
                              <div class="cell-name">
                                @if (r.rang === 1) { <span class="medal">🥇</span> }
                                @else if (r.rang === 2) { <span class="medal">🥈</span> }
                                @else if (r.rang === 3) { <span class="medal">🥉</span> }
                                {{ r.nom }}
                              </div>
                              <div class="cell-sub">{{ r.zone }}</div>
                            </div>
                          </div>
                          <strong class="total-num">{{ r.total }}</strong>
                        </div>
                        <div class="hx-chips">
                          <span class="chip green">{{ r.terminees }} terminées</span>
                          <span class="chip red">{{ r.echecs }} échecs</span>
                          <span class="chip orange">{{ r.enCours }} en cours</span>
                          @if (r.reassignes > 0) { <span class="chip red">{{ r.reassignes }} réaffect. subies</span> }
                          @if (r.missionsTotal > 0) { <span class="chip blue">{{ r.missionsTerminees }}/{{ r.missionsTotal }} missions</span> }
                        </div>
                        @if (r.total > 0) {
                          <div class="progress-container">
                            <div class="progress-bar"
                                 [class.low]="r.tauxRaw < 50" [class.mid]="r.tauxRaw >= 50 && r.tauxRaw < 80" [class.high]="r.tauxRaw >= 80"
                                 [style.width.%]="r.tauxRaw"></div>
                          </div>
                          <div class="hx-line"><span>Taux réussite : {{ r.tauxSucces }}</span><span>Durée moy. : {{ r.dureeMoy }}</span></div>
                        }
                        <div class="hx-line"><span>Type principal</span><span class="chip blue">{{ r.typePrincipal }}</span></div>
                      </div>
                    }
                  </div>
                </div>
              </mat-card-content>
            </mat-card>

            <!-- Support / Admin -->
            <mat-card class="section-card">
              <mat-card-header>
                <mat-icon mat-card-avatar class="section-avatar support">support_agent</mat-icon>
                <mat-card-title>Activité Support &amp; Administration</mat-card-title>
                <mat-card-subtitle>Affectations et réaffectations réalisées</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <div class="table-wrap">
                  <table mat-table [dataSource]="supportStats()">
                    <ng-container matColumnDef="nom">
                      <th mat-header-cell *matHeaderCellDef>Utilisateur</th>
                      <td mat-cell *matCellDef="let r">
                        <div class="user-cell">
                          <div class="avatar-sm" [class]="r.role">{{ r.nom[0] }}</div>
                          <div>
                            <div class="cell-name">{{ r.nom }}</div>
                            <div class="cell-sub role-tag" [class]="r.role">{{ r.role }}</div>
                          </div>
                        </div>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="affectations">
                      <th mat-header-cell *matHeaderCellDef>Affectations</th>
                      <td mat-cell *matCellDef="let r"><span class="chip blue">{{ r.affectations }}</span></td>
                    </ng-container>
                    <ng-container matColumnDef="reassignations">
                      <th mat-header-cell *matHeaderCellDef>Réaffectations faites</th>
                      <td mat-cell *matCellDef="let r">
                        @if (r.reassignations > 0) { <span class="chip orange">{{ r.reassignations }}</span> }
                        @else { <span class="cell-sub">0</span> }
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="total">
                      <th mat-header-cell *matHeaderCellDef>Total activité</th>
                      <td mat-cell *matCellDef="let r"><strong class="total-num">{{ r.total }}</strong></td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="supportCols"></tr>
                    <tr mat-row *matRowDef="let row; columns: supportCols;"></tr>
                    <tr class="mat-row no-data-row" *matNoDataRow>
                      <td class="mat-cell no-data" [attr.colspan]="supportCols.length">Aucune donnée</td>
                    </tr>
                  </table>

                  <!-- Cartes (mobile) -->
                  <div class="hx-cards">
                    @if (supportStats().length === 0) {
                      <div class="hx-empty">Aucune donnée</div>
                    }
                    @for (r of supportStats(); track r.nom) {
                      <div class="hx-card">
                        <div class="hx-top">
                          <div class="user-cell">
                            <div class="avatar-sm" [class]="r.role">{{ r.nom[0] }}</div>
                            <div>
                              <div class="cell-name">{{ r.nom }}</div>
                              <div class="cell-sub role-tag" [class]="r.role">{{ r.role }}</div>
                            </div>
                          </div>
                          <strong class="total-num">{{ r.total }}</strong>
                        </div>
                        <div class="hx-chips">
                          <span class="chip blue">{{ r.affectations }} affectations</span>
                          @if (r.reassignations > 0) { <span class="chip orange">{{ r.reassignations }} réaffect.</span> }
                        </div>
                      </div>
                    }
                  </div>
                </div>
              </mat-card-content>
            </mat-card>

            <!-- Chauffeurs -->
            <mat-card class="section-card">
              <mat-card-header>
                <mat-icon mat-card-avatar class="section-avatar chauffeur">local_shipping</mat-icon>
                <mat-card-title>Activité des chauffeurs</mat-card-title>
                <mat-card-subtitle>Transports effectués</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <div class="table-wrap">
                  <table mat-table [dataSource]="chauffeurStats()">
                    <ng-container matColumnDef="nom">
                      <th mat-header-cell *matHeaderCellDef>Chauffeur</th>
                      <td mat-cell *matCellDef="let r">
                        <div class="user-cell">
                          <div class="avatar-sm chauffeur">{{ r.nom[0] }}</div>
                          <div class="cell-name">{{ r.nom }}</div>
                        </div>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="transports">
                      <th mat-header-cell *matHeaderCellDef>Transports effectués</th>
                      <td mat-cell *matCellDef="let r"><strong class="total-num">{{ r.transports }}</strong></td>
                    </ng-container>
                    <ng-container matColumnDef="zones">
                      <th mat-header-cell *matHeaderCellDef>Zones couvertes</th>
                      <td mat-cell *matCellDef="let r">{{ r.zones }}</td>
                    </ng-container>
                    <ng-container matColumnDef="techs">
                      <th mat-header-cell *matHeaderCellDef>Techniciens transportés</th>
                      <td mat-cell *matCellDef="let r">{{ r.techs }}</td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="chauffeurCols"></tr>
                    <tr mat-row *matRowDef="let row; columns: chauffeurCols;"></tr>
                    <tr class="mat-row no-data-row" *matNoDataRow>
                      <td class="mat-cell no-data" [attr.colspan]="chauffeurCols.length">Aucun chauffeur enregistré</td>
                    </tr>
                  </table>

                  <!-- Cartes (mobile) -->
                  <div class="hx-cards">
                    @if (chauffeurStats().length === 0) {
                      <div class="hx-empty">Aucun chauffeur enregistré</div>
                    }
                    @for (r of chauffeurStats(); track r.nom) {
                      <div class="hx-card">
                        <div class="hx-top">
                          <div class="user-cell">
                            <div class="avatar-sm chauffeur">{{ r.nom[0] }}</div>
                            <div class="cell-name">{{ r.nom }}</div>
                          </div>
                          <strong class="total-num">{{ r.transports }}</strong>
                        </div>
                        <div class="hx-line"><span>Zones couvertes</span><span>{{ r.zones }}</span></div>
                        <div class="hx-line"><span>Techniciens transportés</span><span>{{ r.techs }}</span></div>
                      </div>
                    }
                  </div>
                </div>
              </mat-card-content>
            </mat-card>

          </div>
        </mat-tab>

        <!-- ─────── TAB 2 : JOURNAL ─────── -->
        <mat-tab label="Journal détaillé">
          <div class="tab-content">

            <!-- Stats résumé (basés sur filtres avancés) -->
            <div class="stats-grid">
              <div class="stat-card blue">
                <div class="stat-icon"><mat-icon>assignment</mat-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ filtered().length }}</div>
                  <div class="stat-label">Interventions filtrées</div>
                </div>
              </div>
              <div class="stat-card green">
                <div class="stat-icon"><mat-icon>check_circle</mat-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ countByStatut('Terminée') }}</div>
                  <div class="stat-label">Terminées</div>
                </div>
              </div>
              <div class="stat-card orange">
                <div class="stat-icon"><mat-icon>pending</mat-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ countByStatut('En cours') }}</div>
                  <div class="stat-label">En cours</div>
                </div>
              </div>
              <div class="stat-card purple">
                <div class="stat-icon"><mat-icon>timer</mat-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ avgDuration() }} min</div>
                  <div class="stat-label">Durée moyenne</div>
                </div>
              </div>
              <div class="stat-card signalement">
                <div class="stat-icon"><mat-icon>qr_code_2</mat-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ countViaSignalement() }}</div>
                  <div class="stat-label">Issues d'un signalement QR</div>
                </div>
              </div>
            </div>

            <!-- Filtres avancés -->
            <mat-card class="filter-card">
              <mat-card-header><mat-card-title><mat-icon>filter_list</mat-icon> Filtres avancés</mat-card-title></mat-card-header>
              <mat-card-content>
                <div class="filter-row">
                <div class="filter-grid">
                  <div class="pill-field">
                    <label class="pill-label">Période</label>
                    <app-date-range-filter
                      [value]="journalDateRange()"
                      (valueChange)="onJournalDateRangeChange($event)"
                      placeholder="Toutes les dates">
                    </app-date-range-filter>
                  </div>
                  <div class="pill-field">
                    <label class="pill-label">Technicien</label>
                    <mat-form-field appearance="outline" class="pill-select">
                      <mat-icon matPrefix>engineering</mat-icon>
                      <mat-select [(ngModel)]="f.technicienId">
                        <mat-option value="">Tous</mat-option>
                        @for (t of techniciens(); track t.id) {
                          <mat-option [value]="t.id">{{ t.prenom }} {{ t.nom }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  </div>
                  <div class="pill-field">
                    <label class="pill-label">Zone</label>
                    <mat-form-field appearance="outline" class="pill-select">
                      <mat-icon matPrefix>place</mat-icon>
                      <mat-select [(ngModel)]="f.zone">
                        <mat-option value="">Toutes</mat-option>
                        @for (z of zones(); track z) { <mat-option [value]="z">{{ z }}</mat-option> }
                      </mat-select>
                    </mat-form-field>
                  </div>
                  <div class="pill-field">
                    <label class="pill-label">Type</label>
                    <mat-form-field appearance="outline" class="pill-select">
                      <mat-icon matPrefix>category</mat-icon>
                      <mat-select [(ngModel)]="f.type">
                        <mat-option value="">Tous</mat-option>
                        @for (t of types(); track t.id) { <mat-option [value]="t.label">{{ t.label }}</mat-option> }
                      </mat-select>
                    </mat-form-field>
                  </div>
                  <div class="pill-field">
                    <label class="pill-label">Statut</label>
                    <mat-form-field appearance="outline" class="pill-select">
                      <mat-icon matPrefix>flag</mat-icon>
                      <mat-select [(ngModel)]="f.statut">
                        <mat-option value="">Tous</mat-option>
                        <mat-option value="Terminée">Terminée</mat-option>
                        <mat-option value="En cours">En cours</mat-option>
                        <mat-option value="Échec">Échec</mat-option>
                      </mat-select>
                    </mat-form-field>
                  </div>
                  <div class="pill-field">
                    <label class="pill-label">Origine</label>
                    <mat-form-field appearance="outline" class="pill-select">
                      <mat-icon matPrefix>qr_code_2</mat-icon>
                      <mat-select [(ngModel)]="f.origine">
                        <mat-option value="">Toutes</mat-option>
                        <mat-option value="signalement">Signalement QR uniquement</mat-option>
                      </mat-select>
                    </mat-form-field>
                  </div>
                </div>
                <div class="filter-actions">
                  <button mat-stroked-button (click)="resetFilters()"><mat-icon>clear</mat-icon> Réinitialiser</button>
                  <button mat-raised-button color="primary" (click)="applyFilters()"><mat-icon>search</mat-icon> Appliquer</button>
                </div>
                </div>
              </mat-card-content>
            </mat-card>

            <!-- Barres par technicien / par zone -->
            <div class="history-grid">
              <mat-card>
                <mat-card-header><mat-card-title>Par technicien</mat-card-title></mat-card-header>
                <mat-card-content>
                  @for (entry of byTechnicien(); track entry.nom) {
                    <div class="stat-entry">
                      <span class="stat-entry-name">{{ entry.nom }}</span>
                      <div class="stat-bar"><div class="stat-bar-fill" [style.width]="barWidth(entry.count)"></div></div>
                      <span class="stat-entry-count">{{ entry.count }}</span>
                    </div>
                  }
                </mat-card-content>
              </mat-card>
              <mat-card>
                <mat-card-header><mat-card-title>Par zone</mat-card-title></mat-card-header>
                <mat-card-content>
                  @for (entry of byZone(); track entry.nom) {
                    <div class="stat-entry">
                      <span class="stat-entry-name">{{ entry.nom }}</span>
                      <div class="stat-bar"><div class="stat-bar-fill zone" [style.width]="barWidth(entry.count, 'zone')"></div></div>
                      <span class="stat-entry-count">{{ entry.count }}</span>
                    </div>
                  }
                </mat-card-content>
              </mat-card>
            </div>

            <!-- Liste détaillée -->
            <mat-card>
              <mat-card-header><mat-card-title>Liste détaillée ({{ filtered().length }})</mat-card-title></mat-card-header>
              <mat-card-content style="padding:0">
                <div class="table-container" style="border-radius:0;box-shadow:none">
                  <table mat-table [dataSource]="pagedFiltered()">
                    <ng-container matColumnDef="date">
                      <th mat-header-cell *matHeaderCellDef class="sortable-th" (click)="sort('date')">
                        <div class="th-inner">Date <mat-icon class="sort-icon" [class.sort-active]="sortField()==='date'">{{ sortIcon('date') }}</mat-icon></div>
                      </th>
                      <td mat-cell *matCellDef="let i">{{ i.dateDebut | date:'dd/MM/yy HH:mm' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="agent">
                      <th mat-header-cell *matHeaderCellDef class="sortable-th" (click)="sort('agent')">
                        <div class="th-inner">Agent <mat-icon class="sort-icon" [class.sort-active]="sortField()==='agent'">{{ sortIcon('agent') }}</mat-icon></div>
                      </th>
                      <td mat-cell *matCellDef="let i"><a [routerLink]="['/agents', i.agentId]" class="link">{{ i.agentNom }}</a></td>
                    </ng-container>
                    <ng-container matColumnDef="zone">
                      <th mat-header-cell *matHeaderCellDef class="sortable-th" (click)="sort('zone')">
                        <div class="th-inner">Zone <mat-icon class="sort-icon" [class.sort-active]="sortField()==='zone'">{{ sortIcon('zone') }}</mat-icon></div>
                      </th>
                      <td mat-cell *matCellDef="let i">{{ i.agentZone }}</td>
                    </ng-container>
                    <ng-container matColumnDef="type">
                      <th mat-header-cell *matHeaderCellDef class="sortable-th" (click)="sort('type')">
                        <div class="th-inner">Type <mat-icon class="sort-icon" [class.sort-active]="sortField()==='type'">{{ sortIcon('type') }}</mat-icon></div>
                      </th>
                      <td mat-cell *matCellDef="let i">{{ i.type }}</td>
                    </ng-container>
                    <ng-container matColumnDef="technicien">
                      <th mat-header-cell *matHeaderCellDef class="sortable-th" (click)="sort('technicien')">
                        <div class="th-inner">Technicien <mat-icon class="sort-icon" [class.sort-active]="sortField()==='technicien'">{{ sortIcon('technicien') }}</mat-icon></div>
                      </th>
                      <td mat-cell *matCellDef="let i">{{ i.technicienNom }}</td>
                    </ng-container>
                    <ng-container matColumnDef="duree">
                      <th mat-header-cell *matHeaderCellDef class="sortable-th" (click)="sort('duree')">
                        <div class="th-inner">Durée <mat-icon class="sort-icon" [class.sort-active]="sortField()==='duree'">{{ sortIcon('duree') }}</mat-icon></div>
                      </th>
                      <td mat-cell *matCellDef="let i">{{ i.duree ? i.duree + ' min' : '—' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="statut">
                      <th mat-header-cell *matHeaderCellDef class="sortable-th" (click)="sort('statut')">
                        <div class="th-inner">Statut <mat-icon class="sort-icon" [class.sort-active]="sortField()==='statut'">{{ sortIcon('statut') }}</mat-icon></div>
                      </th>
                      <td mat-cell *matCellDef="let i"><span class="status-chip {{ sClass(i.statut) }}">{{ i.statut }}</span></td>
                    </ng-container>
                    <ng-container matColumnDef="origine">
                      <th mat-header-cell *matHeaderCellDef>Origine</th>
                      <td mat-cell *matCellDef="let i">
                        @if (i.viaSignalement) {
                          <span class="origine-chip signalement" matTooltip="Créée depuis un signalement agent (QR code)">
                            <mat-icon>qr_code_2</mat-icon> Signalement
                          </span>
                        } @else {
                          <span class="cell-sub">—</span>
                        }
                      </td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="cols"></tr>
                    <tr mat-row *matRowDef="let row; columns: cols;"></tr>
                  </table>

                  <!-- Cartes (mobile) -->
                  <div class="hx-cards">
                    @for (i of pagedFiltered(); track i.id) {
                      <div class="hx-card">
                        <div class="hx-top">
                          <a [routerLink]="['/agents', i.agentId]" class="link cell-name">{{ i.agentNom }}</a>
                          <span class="status-chip {{ sClass(i.statut) }}">{{ i.statut }}</span>
                        </div>
                        <div class="cell-sub">{{ i.agentZone }} · {{ i.type }}</div>
                        <div class="hx-line"><span>{{ i.dateDebut | date:'dd/MM/yy HH:mm' }}</span><span>{{ i.duree ? i.duree + ' min' : '—' }}</span></div>
                        <div class="hx-line"><span>Technicien</span><span>{{ i.technicienNom }}</span></div>
                        @if (i.viaSignalement) {
                          <div class="hx-line">
                            <span class="origine-chip signalement"><mat-icon>qr_code_2</mat-icon> Signalement QR</span>
                          </div>
                        }
                      </div>
                    }
                  </div>
                  @if (filtered().length === 0) {
                    <div class="empty-state"><mat-icon>search_off</mat-icon><h3>Aucun résultat</h3><p>Modifiez les filtres</p></div>
                  }
                  @if (filtered().length > 0) {
                    <mat-paginator
                      [length]="filtered().length"
                      [pageSize]="pageSize()"
                      [pageIndex]="pageIndex()"
                      [pageSizeOptions]="[10, 25, 50, 100]"
                      (page)="onPage($event)"
                      showFirstLastButtons>
                    </mat-paginator>
                  }
                </div>
              </mat-card-content>
            </mat-card>

          </div>
        </mat-tab>

        <!-- ─────── TAB 3 : RÉAFFECTATIONS ─────── -->
        <mat-tab label="Réaffectations">
          <div class="tab-content">

            <!-- Efficacité par technicien -->
            <div class="efficiency-grid">
              <mat-card class="efficiency-card">
                <mat-card-header>
                  <mat-card-title><mat-icon>leaderboard</mat-icon> Réaffectations subies par technicien</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  @if (efficiencyStats().length === 0) {
                    <div class="empty-state-sm"><mat-icon>check_circle</mat-icon><p>Aucune réaffectation enregistrée</p></div>
                  }
                  @for (s of efficiencyStats(); track s.nom) {
                    <div class="eff-row">
                      <div class="eff-avatar">{{ s.initials }}</div>
                      <div class="eff-info">
                        <div class="eff-name">{{ s.nom }}</div>
                        <div class="eff-bar-wrap">
                          <div class="eff-bar">
                            <div class="eff-bar-fill" [style.width]="s.barWidth" [class]="s.level"></div>
                          </div>
                          <span class="eff-count" [class]="s.level">{{ s.reassigned }}</span>
                        </div>
                      </div>
                      <div class="eff-badge-col">
                        <span class="eff-badge" [class]="s.level">
                          {{ s.level === 'low' ? 'Bon' : s.level === 'medium' ? 'Moyen' : 'À surveiller' }}
                        </span>
                        <div class="eff-sub">{{ s.done }} terminée(s)</div>
                      </div>
                    </div>
                  }
                </mat-card-content>
              </mat-card>

              <mat-card>
                <mat-card-header>
                  <mat-card-title><mat-icon>info</mat-icon> Comment lire ce rapport</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="legend-list">
                    <div class="legend-row">
                      <span class="legend-dot low"></span>
                      <div><strong>Bon</strong> — 0 à 1 réaffectation(s)</div>
                    </div>
                    <div class="legend-row">
                      <span class="legend-dot medium"></span>
                      <div><strong>Moyen</strong> — 2 à 3 réaffectation(s)</div>
                    </div>
                    <div class="legend-row">
                      <span class="legend-dot high"></span>
                      <div><strong>À surveiller</strong> — 4 réaffectations ou plus</div>
                    </div>
                    <mat-divider style="margin:12px 0"></mat-divider>
                    <p class="legend-note">
                      Une réaffectation correspond à une intervention retirée d'un technicien et confiée à un autre.
                      Un nombre élevé peut indiquer une difficulté technique, une surcharge ou une indisponibilité.
                    </p>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>

            <!-- Journal des réaffectations -->
            <mat-card>
              <mat-card-header>
                <mat-card-title><mat-icon>history</mat-icon> Journal des réaffectations</mat-card-title>
                <div class="reass-filter">
                  <input type="text" [ngModel]="reassignSearch()" (ngModelChange)="reassignSearch.set($event)" placeholder="Filtrer par technicien ou agent…" class="reass-search-input">
                </div>
              </mat-card-header>
              <mat-card-content style="padding:0">
                <div class="table-container" style="border-radius:0;box-shadow:none">
                  <table mat-table [dataSource]="filteredReassignments()">
                    <ng-container matColumnDef="date">
                      <th mat-header-cell *matHeaderCellDef>Date</th>
                      <td mat-cell *matCellDef="let r">{{ r.reassignedAt | date:'dd/MM/yy HH:mm' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="agent">
                      <th mat-header-cell *matHeaderCellDef>Agent</th>
                      <td mat-cell *matCellDef="let r">
                        <div class="reass-agent">{{ r.agentNom }}</div>
                        <div class="reass-zone">{{ r.agentZone }}</div>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="from">
                      <th mat-header-cell *matHeaderCellDef>Technicien retiré</th>
                      <td mat-cell *matCellDef="let r">
                        <div class="tech-cell-reass">
                          <div class="tech-av-reass from">{{ initials(r.fromTechNom) }}</div>
                          <span class="from-tech">{{ r.fromTechNom || '—' }}</span>
                        </div>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="duree">
                      <th mat-header-cell *matHeaderCellDef>Temps avant réaff.</th>
                      <td mat-cell *matCellDef="let r">
                        @if (r.minutesBefore !== null && r.minutesBefore !== undefined) {
                          <span class="duration-chip" [class]="durationLevel(r.minutesBefore)"
                                [matTooltip]="'Affecté le ' + (r.assignedAt | date:'dd/MM/yy HH:mm') + ' · Réaffecté le ' + (r.reassignedAt | date:'dd/MM/yy HH:mm')">
                            <mat-icon>timer</mat-icon>
                            {{ formatDuration(r.minutesBefore) }}
                          </span>
                        } @else { <span class="no-duration">—</span> }
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="to">
                      <th mat-header-cell *matHeaderCellDef>Nouveau technicien</th>
                      <td mat-cell *matCellDef="let r">
                        <div class="tech-cell-reass">
                          <div class="tech-av-reass to">{{ initials(r.toTechNom) }}</div>
                          <span class="to-tech">{{ r.toTechNom || '—' }}</span>
                        </div>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="by">
                      <th mat-header-cell *matHeaderCellDef>Réaffecté par</th>
                      <td mat-cell *matCellDef="let r">
                        <span class="reassigned-by">{{ r.reassignedByNom || '—' }}</span>
                      </td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="reassCols"></tr>
                    <tr mat-row *matRowDef="let row; columns: reassCols;"></tr>
                  </table>

                  <!-- Cartes (mobile) -->
                  <div class="hx-cards">
                    @for (r of filteredReassignments(); track r.id) {
                      <div class="hx-card">
                        <div class="hx-top">
                          <div class="cell-name">{{ r.agentNom }}</div>
                          <span class="cell-sub">{{ r.reassignedAt | date:'dd/MM/yy HH:mm' }}</span>
                        </div>
                        <div class="cell-sub">{{ r.agentZone }}</div>
                        <div class="hx-line"><span>{{ r.fromTechNom || '—' }}</span><mat-icon style="font-size:14px;width:14px;height:14px">arrow_forward</mat-icon><span>{{ r.toTechNom || '—' }}</span></div>
                        <div class="hx-line">
                          <span>Réaffecté par {{ r.reassignedByNom || '—' }}</span>
                          @if (r.minutesBefore !== null && r.minutesBefore !== undefined) {
                            <span class="duration-chip" [class]="durationLevel(r.minutesBefore)">
                              <mat-icon>timer</mat-icon>{{ formatDuration(r.minutesBefore) }}
                            </span>
                          }
                        </div>
                      </div>
                    }
                  </div>
                  @if (filteredReassignments().length === 0) {
                    <div class="empty-state"><mat-icon>swap_horiz</mat-icon><h3>Aucune réaffectation</h3><p>Toutes les interventions ont été réalisées par le technicien initial</p></div>
                  }
                </div>
              </mat-card-content>
            </mat-card>

          </div>
        </mat-tab>

        <!-- ─────── TAB 4 : MISSIONS INTERNES ─────── -->
        <mat-tab label="Missions internes">
          <div class="tab-content">

            <!-- Stats résumé -->
            <div class="stats-grid">
              <div class="stat-card blue">
                <div class="stat-icon"><mat-icon>assignment_ind</mat-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ filteredMissions().length }}</div>
                  <div class="stat-label">Missions filtrées</div>
                </div>
              </div>
              <div class="stat-card green">
                <div class="stat-icon"><mat-icon>check_circle</mat-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ countMissionsByStatut('terminée') }}</div>
                  <div class="stat-label">Terminées</div>
                </div>
              </div>
              <div class="stat-card orange">
                <div class="stat-icon"><mat-icon>pending</mat-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ countMissionsByStatut('en_cours') + countMissionsByStatut('acceptée') + countMissionsByStatut('assignée') }}</div>
                  <div class="stat-label">En attente / en cours</div>
                </div>
              </div>
              <div class="stat-card error">
                <div class="stat-icon"><mat-icon>cancel</mat-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ countMissionsByStatut('refusée') }}</div>
                  <div class="stat-label">Refusées</div>
                </div>
              </div>
            </div>

            <!-- Filtres -->
            <mat-card class="filter-card">
              <mat-card-header><mat-card-title><mat-icon>filter_list</mat-icon> Filtres</mat-card-title></mat-card-header>
              <mat-card-content>
                <div class="filter-row">
                <div class="filter-grid">
                  <div class="pill-field">
                    <label class="pill-label">Période</label>
                    <app-date-range-filter
                      [value]="missionsDateRange()"
                      (valueChange)="onMissionsDateRangeChange($event)"
                      [showTime]="false"
                      placeholder="Toutes les dates">
                    </app-date-range-filter>
                  </div>
                  <div class="pill-field">
                    <label class="pill-label">Technicien</label>
                    <mat-form-field appearance="outline" class="pill-select">
                      <mat-icon matPrefix>engineering</mat-icon>
                      <mat-select [(ngModel)]="mf.technicienId">
                        <mat-option value="">Tous</mat-option>
                        @for (t of techniciens(); track t.id) {
                          <mat-option [value]="t.id">{{ t.prenom }} {{ t.nom }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  </div>
                  <div class="pill-field">
                    <label class="pill-label">Type</label>
                    <mat-form-field appearance="outline" class="pill-select">
                      <mat-icon matPrefix>category</mat-icon>
                      <mat-select [(ngModel)]="mf.type">
                        <mat-option value="">Tous</mat-option>
                        @for (t of missionTypes(); track t.id) { <mat-option [value]="t.label">{{ t.label }}</mat-option> }
                      </mat-select>
                    </mat-form-field>
                  </div>
                  <div class="pill-field">
                    <label class="pill-label">Statut</label>
                    <mat-form-field appearance="outline" class="pill-select">
                    <mat-icon matPrefix>flag</mat-icon>
                    <mat-select [(ngModel)]="mf.statut">
                      <mat-option value="">Tous</mat-option>
                      <mat-option value="assignée">Assignée</mat-option>
                      <mat-option value="acceptée">Acceptée</mat-option>
                      <mat-option value="en_cours">En cours</mat-option>
                      <mat-option value="terminée">Terminée</mat-option>
                      <mat-option value="refusée">Refusée</mat-option>
                    </mat-select>
                    </mat-form-field>
                  </div>
                </div>
                <div class="filter-actions">
                  <button mat-stroked-button (click)="resetMissionFilters()"><mat-icon>clear</mat-icon> Réinitialiser</button>
                  <button mat-raised-button color="primary" (click)="applyMissionFilters()"><mat-icon>search</mat-icon> Appliquer</button>
                  <button mat-stroked-button (click)="exportMissionsCsv()"><mat-icon>table_view</mat-icon> CSV</button>
                </div>
                </div>
              </mat-card-content>
            </mat-card>

            <!-- Liste détaillée -->
            <mat-card>
              <mat-card-header><mat-card-title>Liste détaillée ({{ filteredMissions().length }})</mat-card-title></mat-card-header>
              <mat-card-content style="padding:0">
                <div class="table-container" style="border-radius:0;box-shadow:none">
                  <table mat-table [dataSource]="filteredMissions()">
                    <ng-container matColumnDef="date">
                      <th mat-header-cell *matHeaderCellDef class="sortable-th" (click)="sortMissions('date')">
                        <div class="th-inner">Date <mat-icon class="sort-icon" [class.sort-active]="missionSortField()==='date'">{{ missionSortIcon('date') }}</mat-icon></div>
                      </th>
                      <td mat-cell *matCellDef="let m">{{ m.dateMission | date:'dd/MM/yy' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="titre">
                      <th mat-header-cell *matHeaderCellDef class="sortable-th" (click)="sortMissions('titre')">
                        <div class="th-inner">Titre <mat-icon class="sort-icon" [class.sort-active]="missionSortField()==='titre'">{{ missionSortIcon('titre') }}</mat-icon></div>
                      </th>
                      <td mat-cell *matCellDef="let m">{{ m.titre }}</td>
                    </ng-container>
                    <ng-container matColumnDef="type">
                      <th mat-header-cell *matHeaderCellDef class="sortable-th" (click)="sortMissions('type')">
                        <div class="th-inner">Type <mat-icon class="sort-icon" [class.sort-active]="missionSortField()==='type'">{{ missionSortIcon('type') }}</mat-icon></div>
                      </th>
                      <td mat-cell *matCellDef="let m">{{ m.type }}</td>
                    </ng-container>
                    <ng-container matColumnDef="technicien">
                      <th mat-header-cell *matHeaderCellDef class="sortable-th" (click)="sortMissions('technicien')">
                        <div class="th-inner">Technicien(s) <mat-icon class="sort-icon" [class.sort-active]="missionSortField()==='technicien'">{{ missionSortIcon('technicien') }}</mat-icon></div>
                      </th>
                      <td mat-cell *matCellDef="let m">{{ m.assignedToNom }}{{ m.assignedToNom2 ? ' + ' + m.assignedToNom2 : '' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="confiepar">
                      <th mat-header-cell *matHeaderCellDef>Confié par</th>
                      <td mat-cell *matCellDef="let m">{{ m.assignedByNom }}</td>
                    </ng-container>
                    <ng-container matColumnDef="statut">
                      <th mat-header-cell *matHeaderCellDef class="sortable-th" (click)="sortMissions('statut')">
                        <div class="th-inner">Statut <mat-icon class="sort-icon" [class.sort-active]="missionSortField()==='statut'">{{ missionSortIcon('statut') }}</mat-icon></div>
                      </th>
                      <td mat-cell *matCellDef="let m"><span class="status-chip {{ mClass(m.statut) }}">{{ mLabel(m.statut) }}</span></td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="missionCols"></tr>
                    <tr mat-row *matRowDef="let row; columns: missionCols;"></tr>
                  </table>

                  <!-- Cartes (mobile) -->
                  <div class="hx-cards">
                    @for (m of filteredMissions(); track m.id) {
                      <div class="hx-card">
                        <div class="hx-top">
                          <div class="cell-name">{{ m.titre }}</div>
                          <span class="status-chip {{ mClass(m.statut) }}">{{ mLabel(m.statut) }}</span>
                        </div>
                        <div class="cell-sub">{{ m.type }} · Confié par {{ m.assignedByNom }}</div>
                        <div class="hx-line"><span>{{ m.dateMission | date:'dd/MM/yy' }}</span><span>{{ m.assignedToNom }}{{ m.assignedToNom2 ? ' + ' + m.assignedToNom2 : '' }}</span></div>
                      </div>
                    }
                  </div>
                  @if (filteredMissions().length === 0) {
                    <div class="empty-state"><mat-icon>search_off</mat-icon><h3>Aucun résultat</h3><p>Modifiez les filtres</p></div>
                  }
                </div>
              </mat-card-content>
            </mat-card>

          </div>
        </mat-tab>

        <mat-tab label="Attentes">
          <ng-template matTabContent>
            <app-attentes-report></app-attentes-report>
          </ng-template>
        </mat-tab>

      </mat-tab-group>
    </div>
  `,
  styles: [`
    /* ── Header ── */
    .page-header { display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-bottom:20px; }
    .page-header h1 { font-size:22px;color:#1a3a5c;margin:0;display:flex;align-items:center;gap:8px; }
    .title-icon { font-size:26px;width:26px;height:26px;color:#1a3a5c; }
    .sub-title { font-size:13px;color:#78909c;display:block;margin-top:4px; }
    .header-actions { display:flex;align-items:center;gap:12px; }

    /* ── KPI ── */
    .kpi-row { display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap; }
    .kpi-card {
      flex:1;min-width:120px;background:white;border-radius:10px;padding:14px 16px;
      box-shadow:0 2px 8px rgba(0,0,0,0.07);border-left:4px solid #1a3a5c;
      display:flex;flex-direction:column;gap:4px;
      &.success { border-left-color:#43a047; .kpi-val { color:#43a047; } }
      &.error   { border-left-color:#e53935; .kpi-val { color:#e53935; } }
      &.warn    { border-left-color:#fb8c00; .kpi-val { color:#fb8c00; } }
      &.info    { border-left-color:#1e88e5; .kpi-val { color:#1e88e5; } }
      &.neutral { border-left-color:#8e24aa; .kpi-val { color:#8e24aa; } }
    }
    .kpi-icon { font-size:18px;width:18px;height:18px;opacity:.6; }
    .kpi-val  { font-size:26px;font-weight:700;color:#1a3a5c;line-height:1; }
    .kpi-label { font-size:11px;color:#78909c; }

    /* ── Tabs ── */
    .main-tabs { background:transparent; }
    .tab-content { padding:20px 0; display:flex;flex-direction:column;gap:20px; }

    /* ── Section cards ── */
    .section-card { border-radius:10px !important;overflow:hidden; }
    .section-avatar {
      border-radius:8px !important;display:flex;align-items:center;justify-content:center;
      font-size:22px !important;width:40px !important;height:40px !important;
      &.tech      { background:#e8f5e9;color:#388e3c; }
      &.support   { background:#e3f2fd;color:#1565c0; }
      &.chauffeur { background:#fff8e1;color:#f57f17; }
    }

    /* ── Tables ── */
    .table-wrap {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      position: relative;
    }
    .hx-cards { display: none; }
    @media (max-width: 640px) {
      .table-wrap table, .table-container table { display: none; }
      .hx-cards { display: flex; flex-direction: column; gap: 10px; padding: 2px; }
      .tab-content { padding: 12px 0; }
    }
    .hx-empty { text-align: center; padding: 24px; color: #90a4ae; font-style: italic; font-size: 13px; }
    .hx-card { background: white; border: 1px solid #e8edf2; border-radius: 12px; padding: 12px 14px; }
    .hx-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .hx-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .hx-line { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; color: #607d8b; margin-top: 6px; }
    table { width:100%; }
    th { color:#37474f !important;font-weight:600 !important;font-size:12px !important; }
    td { color:#212121;font-size:13px; }
    .no-data { text-align:center;padding:24px;color:#90a4ae;font-style:italic; }
    .sortable-th { cursor:pointer;user-select:none;&:hover{background:#f5f7fa;} }
    .th-inner { display:flex;align-items:center;gap:4px; }
    .sort-icon { font-size:16px;width:16px;height:16px;color:#ccc;transition:color .2s;&.sort-active{color:#1a3a5c;} }

    /* ── User cell ── */
    .user-cell { display:flex;align-items:center;gap:10px; }
    .avatar-sm {
      width:30px;height:30px;border-radius:50%;display:flex;align-items:center;
      justify-content:center;font-size:12px;font-weight:700;color:white;flex-shrink:0;
      background:linear-gradient(135deg,#1a3a5c,#2a5fa0);
      &.tech      { background:linear-gradient(135deg,#1b5e20,#43a047); }
      &.support   { background:linear-gradient(135deg,#1565c0,#1e88e5); }
      &.admin     { background:linear-gradient(135deg,#7b1fa2,#ab47bc); }
      &.superadmin{ background:linear-gradient(135deg,#4a148c,#7b1fa2); }
      &.chauffeur { background:linear-gradient(135deg,#e65100,#ff8f00); }
    }
    .cell-name  { font-weight:600;font-size:13px;color:#212121; }
    .cell-sub   { font-size:11px;color:#78909c; }
    .total-num  { font-size:15px;font-weight:700;color:#1a3a5c; }
    .role-tag   { display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600;text-transform:uppercase;
      &.support   { background:#e3f2fd;color:#1565c0; }
      &.admin     { background:#ede7f6;color:#7b1fa2; }
      &.superadmin{ background:#f3e5f5;color:#6a1b9a; }
    }

    /* ── Chips ── */
    .chip { display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;
      &.green  { background:#e8f5e9;color:#2e7d32; }
      &.red    { background:#ffebee;color:#c62828; }
      &.orange { background:#fff3e0;color:#e65100; }
      &.blue   { background:#e3f2fd;color:#1565c0; }
    }
    .medal { font-size:18px;line-height:1; }
    .origine-chip {
      display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:12px;
      font-size:11px;font-weight:600;
      &.signalement { background:#fff3e0;color:#e65100; }
      mat-icon { font-size:13px;width:13px;height:13px; }
    }

    /* ── Progress bar ── */
    .progress-container { height:6px;background:#eceff1;border-radius:3px;width:80px;display:inline-block;vertical-align:middle;margin-right:6px;overflow:hidden; }
    .progress-bar { height:100%;border-radius:3px;transition:width .3s;
      &.low  { background:#e53935; }
      &.mid  { background:#fb8c00; }
      &.high { background:#43a047; }
    }
    .taux-label { font-size:12px;font-weight:600;vertical-align:middle; }

    /* ── Stats résumé ── */
    .stats-grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:16px; @media(max-width:768px){grid-template-columns:repeat(2,1fr);} }
    .stat-card { display:flex;align-items:center;gap:14px;background:white;border-radius:10px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.07);min-width:0;
      &.blue   { border-left:4px solid #1565c0; .stat-icon mat-icon{color:#1565c0;} }
      &.green  { border-left:4px solid #43a047; .stat-icon mat-icon{color:#43a047;} }
      &.orange { border-left:4px solid #fb8c00; .stat-icon mat-icon{color:#fb8c00;} }
      &.purple { border-left:4px solid #8e24aa; .stat-icon mat-icon{color:#8e24aa;} }
      &.error  { border-left:4px solid #e53935; .stat-icon mat-icon{color:#e53935;} }
      &.signalement { border-left:4px solid #e65100; .stat-icon mat-icon{color:#e65100;} }
    }
    .stat-icon mat-icon { font-size:28px;width:28px;height:28px; }
    .stat-info { min-width:0; }
    .stat-value { font-size:24px;font-weight:700;color:#1a3a5c;line-height:1; }
    .stat-label { font-size:11px;color:#78909c;margin-top:2px; overflow-wrap:break-word; }
    @media (max-width: 420px) {
      .stats-grid { grid-template-columns: 1fr; }
    }

    /* ── Filtres ── */
    .filter-card { mat-card-header { padding:12px 16px 0; mat-card-title{display:flex;align-items:center;gap:8px;font-size:14px;} } mat-card-content{padding:12px 16px 16px !important;} }
    /* Tout sur une seule ligne, y compris les boutons : pas de wrap, défilement
       horizontal si l'écran est trop étroit pour tout contenir. */
    .filter-row { display:flex; align-items:flex-end; gap:16px; flex-wrap:nowrap; overflow-x:auto; padding-bottom:4px; }
    .filter-grid { display:flex; gap:10px; flex-wrap:nowrap; flex:0 0 auto;
      .pill-field { flex:0 0 140px; min-width:140px; }
      mat-form-field{width:100%;}
    }
    .filter-actions { display:flex;gap:8px;flex:0 0 auto; white-space:nowrap; button{height:44px;} }

    /* ── Barres ── */
    .history-grid { display:grid;grid-template-columns:1fr 1fr;gap:16px; @media(max-width:768px){grid-template-columns:1fr;} }
    mat-card-header { padding:12px 16px 0 !important; mat-card-title{font-size:14px;font-weight:600;} }
    mat-card-content { padding:12px 16px 16px !important; }
    .stat-entry { display:flex;align-items:center;gap:10px;margin-bottom:10px; }
    .stat-entry-name { font-size:12px;font-weight:500;min-width:110px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
    .stat-bar { flex:1;height:8px;background:#f0f0f0;border-radius:4px;overflow:hidden; }
    .stat-bar-fill { height:100%;background:linear-gradient(90deg,#1565c0,#42a5f5);border-radius:4px;transition:width 0.4s;
      &.zone { background:linear-gradient(90deg,#2e7d32,#66bb6a); }
    }
    .stat-entry-count { font-size:13px;font-weight:700;min-width:24px;text-align:right;color:var(--primary); }
    .link { text-decoration:none;color:var(--primary);font-weight:600;font-size:12px; }

    /* ── Réaffectations - efficacité ── */
    .efficiency-grid { display:grid;grid-template-columns:1fr 1fr;gap:16px; @media(max-width:768px){grid-template-columns:1fr;} }
    .eff-row { display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f5f5f5;&:last-child{border-bottom:none;} }
    .eff-avatar { width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#1a3a5c,#2a5fa0);color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0; }
    .eff-info   { flex:1;min-width:0; }
    .eff-name   { font-size:13px;font-weight:600;margin-bottom:4px; }
    .eff-bar-wrap { display:flex;align-items:center;gap:8px; }
    .eff-bar    { flex:1;height:7px;background:#f0f0f0;border-radius:4px;overflow:hidden; }
    .eff-bar-fill { height:100%;border-radius:4px;transition:width 0.4s;
      &.low    { background:linear-gradient(90deg,#2e7d32,#66bb6a); }
      &.medium { background:linear-gradient(90deg,#e65100,#ffa726); }
      &.high   { background:linear-gradient(90deg,#b71c1c,#ef5350); }
    }
    .eff-count { font-size:13px;font-weight:700;min-width:20px;
      &.low{color:#2e7d32;} &.medium{color:#e65100;} &.high{color:#b71c1c;}
    }
    .eff-badge-col { text-align:center;min-width:90px; }
    .eff-badge { font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;display:inline-block;
      &.low    { background:#e8f5e9;color:#2e7d32; }
      &.medium { background:#fff3e0;color:#e65100; }
      &.high   { background:#fce4ec;color:#b71c1c; }
    }
    .eff-sub { font-size:10px;color:var(--text-secondary);margin-top:3px; }
    .empty-state-sm { text-align:center;padding:24px;color:#aaa; mat-icon{font-size:32px;width:32px;height:32px;display:block;margin:0 auto 6px;} p{font-size:12px;margin:0;} }
    .legend-list { display:flex;flex-direction:column;gap:10px; }
    .legend-row { display:flex;align-items:center;gap:10px;font-size:13px; }
    .legend-dot { width:12px;height:12px;border-radius:50%;flex-shrink:0;
      &.low{background:#4caf50;} &.medium{background:#ff9800;} &.high{background:#e53935;}
    }
    .legend-note { font-size:12px;color:var(--text-secondary);line-height:1.5;margin:0; }

    /* ── Journal réaffectations ── */
    .reass-filter { margin-left:auto; }
    .reass-search-input { border:1px solid #e0e0e0;border-radius:20px;padding:5px 14px;font-size:12px;outline:none;width:240px;background:#fafafa;&:focus{border-color:#2a5fa0;background:white;} }
    .reass-agent { font-size:13px;font-weight:600; }
    .reass-zone  { font-size:11px;color:var(--text-secondary); }
    .tech-cell-reass { display:flex;align-items:center;gap:8px; }
    .tech-av-reass { width:28px;height:28px;border-radius:50%;color:white;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;
      &.from { background:linear-gradient(135deg,#b71c1c,#ef5350); }
      &.to   { background:linear-gradient(135deg,#1b5e20,#43a047); }
    }
    .from-tech { font-size:12px;color:#b71c1c;font-weight:500; }
    .to-tech   { font-size:12px;color:#2e7d32;font-weight:500; }
    .reassigned-by { font-size:12px;color:var(--text-secondary); }
    .duration-chip { display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;cursor:default;
      mat-icon { font-size:13px;width:13px;height:13px; }
      &.very-fast { background:#fce4ec;color:#b71c1c; }
      &.fast      { background:#fff3e0;color:#e65100; }
      &.medium    { background:#e8f5e9;color:#2e7d32; }
      &.long      { background:#e3f2fd;color:#1565c0; }
    }
    .no-duration { color:#ccc;font-size:12px; }

    /* ── Responsive ── */
    @media (max-width:768px) {
      .kpi-row { gap:8px; }
      .kpi-card { min-width:100px;padding:10px 12px; }
      .kpi-val  { font-size:20px; }
      .page-header { flex-direction:column;align-items:flex-start; }
      .header-actions { flex-wrap:wrap; }
    }
    @media (max-width:480px) {
      .kpi-row { display:grid;grid-template-columns:1fr 1fr; }
      .kpi-card { min-width:0; }
    }
  `]
})
export class HistoryComponent implements OnInit {
  private interventionSvc = inject(InterventionService);
  private missionSvc      = inject(MissionService);
  private userSvc         = inject(UserService);
  private zoneSvc         = inject(ZoneService);
  private exportSvc       = inject(ExportService);
  private typeSvc         = inject(TypeLabelService);

  types = computed(() => this.typeSvc.getByCategorie('intervention'));
  missionTypes = computed(() => this.typeSvc.getByCategorie('mission'));
  zones = computed(() => this.zoneSvc.getAll());

  cols       = ['date', 'agent', 'zone', 'type', 'technicien', 'duree', 'statut', 'origine'];
  reassCols  = ['date', 'agent', 'from', 'duree', 'to', 'by'];
  techCols      = ['rang', 'nom', 'total', 'terminees', 'echecs', 'enCours', 'taux', 'dureeMoy', 'typePrincipal', 'reassignes', 'missions'];
  supportCols   = ['nom', 'affectations', 'reassignations', 'total'];
  chauffeurCols = ['nom', 'transports', 'zones', 'techs'];

  // ── Période (pour KPI + synthèse) ──
  periodOptions = PERIOD_OPTIONS;
  period = signal<Period>('thisMonth');

  periodLabel = computed(() =>
    PERIOD_OPTIONS.find(o => o.value === this.period())?.label ?? 'Toutes les dates'
  );

  private synthRange = computed(() => periodRange(this.period()));

  private inRange(dateStr: string, r: { start: Date; end: Date } | null): boolean {
    if (!r) return true;
    const t = new Date(dateStr).getTime();
    return t >= r.start.getTime() && t <= r.end.getTime();
  }

  private periodFiltered = computed(() => {
    const r = this.synthRange();
    return this.interventionSvc.getAllRaw().filter(i => this.inRange(i.dateDebut, r));
  });

  private periodFilteredMissions = computed(() => {
    const r = this.synthRange();
    return this.missionSvc.getAll().filter(m => this.inRange(m.dateMission, r));
  });

  // ── KPI ──
  totalInterventions = computed(() => this.periodFiltered().length);
  totalTerminees     = computed(() => this.periodFiltered().filter(i => i.statut === 'Terminée').length);
  totalEchecs        = computed(() => this.periodFiltered().filter(i => i.statut === 'Échec').length);
  totalReassignments = computed(() => this.interventionSvc.getReassignments().length);
  totalTransports    = computed(() => {
    const chauffeurIds = new Set(
      this.userSvc.getAll().filter(u => (u.roles ?? [u.role]).includes('chauffeur')).map(u => u.id)
    );
    const missionTransports = this.periodFilteredMissions().filter(m =>
      m.type?.toLowerCase() === 'déplacement' &&
      (chauffeurIds.has(m.assignedToId) || (m.assignedToId2 && chauffeurIds.has(m.assignedToId2)))
    ).length;
    return this.periodFiltered().filter(i => !!i.chauffeurId).length + missionTransports;
  });
  tauxSucces = computed(() => {
    const t = this.totalInterventions();
    return t ? Math.round(this.totalTerminees() / t * 100) : 0;
  });
  avgInterventionsPerTech = computed(() => {
    const techs = this.userSvc.getAll().filter(u => u.actif && (u.roles ?? [u.role]).includes('technicien'));
    const total = this.totalInterventions();
    if (!techs.length) return 0;
    return (total / techs.length).toFixed(1);
  });

  // ── Synthèse ──
  techStats = computed(() => {
    const interventions = this.periodFiltered();
    const reassigns = this.interventionSvc.getReassignments();
    const missions = this.periodFilteredMissions();
    const users = this.userSvc.getAll().filter(u => (u.roles ?? [u.role]).includes('technicien'));
    const sorted = users.map(u => {
      const mine      = interventions.filter(i => i.technicienId === u.id);
      const terminees = mine.filter(i => i.statut === 'Terminée').length;
      const echecs    = mine.filter(i => i.statut === 'Échec').length;
      const enCours   = mine.filter(i => i.statut === 'En cours').length;
      const avecDuree = mine.filter(i => i.duree);
      const dureeMoy  = avecDuree.length ? Math.round(avecDuree.reduce((s, i) => s + (i.duree ?? 0), 0) / avecDuree.length) : null;
      const tauxRaw   = mine.length ? Math.round(terminees / mine.length * 100) : 0;
      const typeCount: Record<string, number> = {};
      for (const i of mine) typeCount[i.type] = (typeCount[i.type] ?? 0) + 1;
      const typePrincipal = Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
      const mesMissions = missions.filter(m => m.assignedToId === u.id || m.assignedToId2 === u.id);
      return {
        nom: `${u.prenom} ${u.nom}`, zone: u.zone || '—',
        total: mine.length, terminees, echecs, enCours, tauxRaw,
        tauxSucces: mine.length ? tauxRaw + '%' : '—',
        dureeMoy: dureeMoy != null ? dureeMoy + ' min' : '—',
        reassignes: reassigns.filter(r => r.fromTechId === u.id).length,
        typePrincipal, rang: 0,
        missionsTotal: mesMissions.length,
        missionsTerminees: mesMissions.filter(m => m.statut === 'terminée').length,
      };
    }).sort((a, b) => b.total - a.total || b.terminees - a.terminees);
    sorted.forEach((r, idx) => r.rang = idx + 1);
    return sorted;
  });

  supportStats = computed(() => {
    const interventions = this.periodFiltered();
    const reassigns = this.interventionSvc.getReassignments();
    const users = this.userSvc.getAll().filter(u => ['support', 'admin', 'superadmin'].includes(u.role));
    return users.map(u => {
      const affectations   = interventions.filter(i => i.assignedById === u.id).length;
      const reassignations = reassigns.filter(r => r.reassignedById === u.id).length;
      return { nom: `${u.prenom} ${u.nom}`, role: u.role, affectations, reassignations, total: affectations + reassignations };
    }).sort((a, b) => b.total - a.total);
  });

  chauffeurStats = computed(() => {
    const interventions = this.interventionSvc.getAllRaw();
    const missions = this.missionSvc.getAll().filter(m => m.type?.toLowerCase() === 'déplacement');
    const allUsers = this.userSvc.getAll();
    const users = allUsers.filter(u => (u.roles ?? [u.role]).includes('chauffeur'));
    return users.map(u => {
      const transports = interventions.filter(i => i.chauffeurId === u.id);
      const deplacements = missions.filter(m => m.assignedToId === u.id || m.assignedToId2 === u.id);

      const zones = new Set(transports.map(t => t.agentZone).filter(Boolean));
      const techs = new Set(transports.map(t => t.technicienNom).filter(Boolean));
      for (const m of deplacements) {
        const coequipierNom = m.assignedToId === u.id ? m.assignedToNom2 : m.assignedToNom;
        const coequipierId  = m.assignedToId === u.id ? m.assignedToId2  : m.assignedToId;
        if (coequipierNom) techs.add(coequipierNom);
        const zone = allUsers.find(x => x.id === coequipierId)?.zone;
        if (zone) zones.add(zone);
      }

      return {
        nom: `${u.prenom} ${u.nom}`,
        transports: transports.length + deplacements.length,
        zones: zones.size ? [...zones].join(', ') : '—',
        techs: techs.size ? [...techs].join(', ') : '—',
      };
    }).sort((a, b) => b.transports - a.transports);
  });

  // ── Filtres avancés (journal détaillé) ──
  journalDateRange = signal<DateRangeValue>({ start: null, end: null });
  onJournalDateRangeChange(v: DateRangeValue): void { this.journalDateRange.set(v); this.pageIndex.set(0); }
  f = { technicienId: '', zone: '', type: '', statut: '', origine: '' };
  private activeFilters = signal({ ...this.f });

  // ── Tri journal ──
  sortField = signal('date');
  sortDir   = signal<'asc' | 'desc'>('desc');

  sort(field: string): void {
    if (this.sortField() === field) this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    else { this.sortField.set(field); this.sortDir.set('asc'); }
  }

  sortIcon(field: string): string {
    if (this.sortField() !== field) return 'unfold_more';
    return this.sortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  techniciens = computed(() => this.userSvc.getByRole('technicien'));

  filtered = computed(() => {
    const fil = this.activeFilters();
    const { start, end } = this.journalDateRange();
    let list = this.interventionSvc.filter({
      dateDebut: start?.toISOString(),
      dateFin: end?.toISOString(),
      technicienId: fil.technicienId || undefined,
      zone: fil.zone || undefined,
      type: fil.type || undefined,
      statut: fil.statut || undefined,
      viaSignalement: fil.origine === 'signalement' ? true : undefined,
    });

    const field = this.sortField();
    const dir   = this.sortDir();
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if      (field === 'date')       cmp = a.dateDebut.localeCompare(b.dateDebut);
      else if (field === 'agent')      cmp = (a.agentNom ?? '').localeCompare(b.agentNom ?? '');
      else if (field === 'zone')       cmp = (a.agentZone ?? '').localeCompare(b.agentZone ?? '');
      else if (field === 'type')       cmp = (a.type ?? '').localeCompare(b.type ?? '');
      else if (field === 'technicien') cmp = (a.technicienNom ?? '').localeCompare(b.technicienNom ?? '');
      else if (field === 'duree')      cmp = (a.duree ?? 0) - (b.duree ?? 0);
      else if (field === 'statut')     cmp = (a.statut ?? '').localeCompare(b.statut ?? '');
      return dir === 'asc' ? cmp : -cmp;
    });
    return list;
  });

  countByStatut(s: string) { return this.filtered().filter(i => i.statut === s).length; }
  countViaSignalement() { return this.filtered().filter(i => i.viaSignalement).length; }

  pageSize  = signal(25);
  pageIndex = signal(0);

  pagedFiltered = computed(() => {
    const all   = this.filtered();
    const size  = this.pageSize();
    const start = this.pageIndex() * size;
    return start >= all.length ? all.slice(0, size) : all.slice(start, start + size);
  });

  onPage(e: PageEvent): void {
    this.pageSize.set(e.pageSize);
    this.pageIndex.set(e.pageIndex);
  }
  avgDuration() {
    const with_d = this.filtered().filter(i => i.duree);
    if (!with_d.length) return 0;
    return Math.round(with_d.reduce((a, i) => a + (i.duree ?? 0), 0) / with_d.length);
  }

  // ── Missions internes (journal) ──
  missionCols = ['date', 'titre', 'type', 'technicien', 'confiepar', 'statut'];
  missionsDateRange = signal<DateRangeValue>({ start: null, end: null });
  onMissionsDateRangeChange(v: DateRangeValue): void { this.missionsDateRange.set(v); }
  mf = { technicienId: '', type: '', statut: '' };
  private activeMissionFilters = signal({ ...this.mf });
  missionSortField = signal('date');
  missionSortDir   = signal<'asc' | 'desc'>('desc');

  sortMissions(field: string): void {
    if (this.missionSortField() === field) this.missionSortDir.set(this.missionSortDir() === 'asc' ? 'desc' : 'asc');
    else { this.missionSortField.set(field); this.missionSortDir.set('asc'); }
  }

  missionSortIcon(field: string): string {
    if (this.missionSortField() !== field) return 'unfold_more';
    return this.missionSortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  filteredMissions = computed(() => {
    const fil = this.activeMissionFilters();
    const { start, end } = this.missionsDateRange();
    const dateDebut = start ? this.toIso(start) : '';
    const dateFin   = end ? this.toIso(end) : '';
    let list = this.missionSvc.getAll().filter(m => {
      if (dateDebut && m.dateMission < dateDebut) return false;
      if (dateFin && m.dateMission > dateFin) return false;
      if (fil.technicienId && m.assignedToId !== fil.technicienId && m.assignedToId2 !== fil.technicienId) return false;
      if (fil.type && m.type !== fil.type) return false;
      if (fil.statut && m.statut !== fil.statut) return false;
      return true;
    });

    const field = this.missionSortField();
    const dir   = this.missionSortDir();
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if      (field === 'date')       cmp = a.dateMission.localeCompare(b.dateMission);
      else if (field === 'titre')      cmp = a.titre.localeCompare(b.titre);
      else if (field === 'type')       cmp = (a.type ?? '').localeCompare(b.type ?? '');
      else if (field === 'technicien') cmp = a.assignedToNom.localeCompare(b.assignedToNom);
      else if (field === 'statut')     cmp = a.statut.localeCompare(b.statut);
      return dir === 'asc' ? cmp : -cmp;
    });
    return list;
  });

  countMissionsByStatut(s: MissionStatut) { return this.filteredMissions().filter(m => m.statut === s).length; }

  applyMissionFilters() {
    this.activeMissionFilters.set({ ...this.mf });
  }

  resetMissionFilters() {
    this.missionsDateRange.set({ start: null, end: null });
    this.mf = { technicienId: '', type: '', statut: '' };
    this.activeMissionFilters.set({ ...this.mf });
  }

  mClass(s: MissionStatut): string {
    const map: Record<MissionStatut, string> = {
      'assignée': 'assignee', 'acceptée': 'acceptee', 'en_cours': 'en-cours',
      'terminée': 'terminee', 'refusée': 'echec',
    };
    return map[s] ?? '';
  }

  mLabel(s: MissionStatut): string {
    const map: Record<MissionStatut, string> = {
      'assignée': 'Assignée', 'acceptée': 'Acceptée', 'en_cours': 'En cours',
      'terminée': 'Terminée', 'refusée': 'Refusée',
    };
    return map[s] ?? s;
  }

  exportMissionsCsv(): void {
    const cols = [
      { key: 'dateMission',    label: 'Date' },
      { key: 'titre',          label: 'Titre' },
      { key: 'type',           label: 'Type' },
      { key: 'assignedToNom',  label: 'Technicien' },
      { key: 'assignedToNom2', label: 'Coéquipier' },
      { key: 'assignedByNom',  label: 'Confié par' },
      { key: 'statut',         label: 'Statut' },
      { key: 'description',    label: 'Description' },
    ];
    const rows = this.filteredMissions().map(m => ({ ...m, dateMission: new Date(m.dateMission).toLocaleDateString('fr-FR') }));
    this.exportSvc.exportCsv(rows as never, `missions_${new Date().toISOString().split('T')[0]}`, cols);
  }

  byTechnicien = computed(() => {
    const map: Record<string, number> = {};
    this.filtered().forEach(i => { map[i.technicienNom] = (map[i.technicienNom] ?? 0) + 1; });
    return Object.entries(map).map(([nom, count]) => ({ nom, count })).sort((a, b) => b.count - a.count);
  });

  byZone = computed(() => {
    const map: Record<string, number> = {};
    this.filtered().forEach(i => { map[i.agentZone] = (map[i.agentZone] ?? 0) + 1; });
    return Object.entries(map).map(([nom, count]) => ({ nom, count })).sort((a, b) => b.count - a.count);
  });

  barWidth(val: number, type = 'tech'): string {
    const max = type === 'zone'
      ? Math.max(...this.byZone().map(e => e.count), 1)
      : Math.max(...this.byTechnicien().map(e => e.count), 1);
    return `${Math.round((val / max) * 100)}%`;
  }

  // ── Réaffectations ──
  // Signal (pas une simple propriété) : un computed() ne suit que les lectures
  // de signaux comme dépendances, sinon il ne se réévalue jamais à la frappe.
  reassignSearch = signal('');

  reassignments = computed(() => this.interventionSvc.getReassignments());

  filteredReassignments = computed(() => {
    const q = this.reassignSearch().toLowerCase().trim();
    if (!q) return this.reassignments();
    return this.reassignments().filter(r =>
      (r.fromTechNom ?? '').toLowerCase().includes(q) ||
      (r.toTechNom   ?? '').toLowerCase().includes(q) ||
      (r.agentNom    ?? '').toLowerCase().includes(q)
    );
  });

  efficiencyStats = computed(() => {
    const logs = this.reassignments();
    const all  = this.interventionSvc.getAllRaw();
    const techs = this.userSvc.getByRole('technicien');
    const maxReass = Math.max(...techs.map(t => logs.filter(r => r.fromTechId?.trim() === t.id.trim()).length), 1);
    return techs.map(t => {
      const reassigned = logs.filter(r => r.fromTechId?.trim() === t.id.trim()).length;
      const done       = all.filter(i => i.technicienId?.trim() === t.id.trim() && i.statut === 'Terminée').length;
      const level      = reassigned <= 1 ? 'low' : reassigned <= 3 ? 'medium' : 'high';
      const barWidth   = `${Math.round((reassigned / maxReass) * 100)}%`;
      const ini        = `${t.prenom[0]}${t.nom[0]}`.toUpperCase();
      return { nom: `${t.prenom} ${t.nom}`, reassigned, done, level, barWidth, initials: ini };
    }).sort((a, b) => b.reassigned - a.reassigned);
  });

  ngOnInit(): void {
    this.interventionSvc.loadReassignments();
  }

  // ── Helpers ──
  private toIso(d: Date | null): string {
    if (!d) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  applyFilters() {
    this.activeFilters.set({ ...this.f });
    this.pageIndex.set(0);
  }

  resetFilters() {
    this.journalDateRange.set({ start: null, end: null });
    this.f = { technicienId: '', zone: '', type: '', statut: '', origine: '' };
    this.activeFilters.set({ ...this.f });
    this.pageIndex.set(0);
  }

  sClass(s: string) { return s === 'Terminée' ? 'terminee' : s === 'En cours' ? 'en-cours' : 'echec'; }

  initials(nom?: string): string {
    if (!nom) return '?';
    const parts = nom.trim().split(' ');
    return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : nom.slice(0, 2).toUpperCase();
  }

  formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }

  durationLevel(minutes: number): string {
    if (minutes < 30)  return 'very-fast';
    if (minutes < 120) return 'fast';
    if (minutes < 480) return 'medium';
    return 'long';
  }

  // ── Export ──
  private readonly EXPORT_COLS = [
    { key: 'dateDebut',     label: 'Date' },
    { key: 'agentNom',      label: 'Agent' },
    { key: 'agentZone',     label: 'Zone' },
    { key: 'type',          label: 'Type' },
    { key: 'technicienNom', label: 'Technicien' },
    { key: 'duree',         label: 'Durée (min)' },
    { key: 'statut',        label: 'Statut' },
    { key: 'origineLabel',  label: 'Origine' },
    { key: 'description',   label: 'Description' },
    { key: 'observations',  label: 'Observations' },
  ];

  private withOrigineLabel(i: Intervention): Intervention & { origineLabel: string } {
    return { ...i, origineLabel: i.viaSignalement ? 'Signalement QR' : 'Manuelle' };
  }

  exportCsv(): void {
    const rows = this.filtered().map(i => this.withOrigineLabel({ ...i, dateDebut: new Date(i.dateDebut).toLocaleString('fr-FR') }));
    this.exportSvc.exportCsv(rows as never, `interventions_${new Date().toISOString().split('T')[0]}`, this.EXPORT_COLS);
  }

  exportPdf(): void {
    const kpis = [
      { label: 'Interventions',    value: this.totalInterventions() },
      { label: 'Terminées',        value: this.totalTerminees() },
      { label: 'Taux de réussite', value: this.tauxSucces() + '%' },
      { label: 'Échecs',           value: this.totalEchecs() },
      { label: 'Réaffectations',   value: this.totalReassignments() },
      { label: 'Transports',       value: this.totalTransports() },
      { label: 'Moy./technicien',  value: this.avgInterventionsPerTech() },
      { label: 'Via signalement QR', value: this.countViaSignalement() },
    ];
    this.exportSvc.exportMultiSectionPdf(
      `Rapport — ${this.periodLabel()}`,
      kpis,
      [
        {
          title: 'Productivité des techniciens',
          columns: [
            { key: 'nom', label: 'Technicien' }, { key: 'zone', label: 'Zone' },
            { key: 'total', label: 'Total' }, { key: 'terminees', label: 'Terminées' },
            { key: 'echecs', label: 'Échecs' }, { key: 'tauxSucces', label: 'Taux réussite' },
            { key: 'dureeMoy', label: 'Durée moy.' }, { key: 'reassignes', label: 'Réaffect. subies' },
          ],
          rows: this.techStats() as unknown as Record<string, unknown>[],
        },
        {
          title: 'Activité Support & Administration',
          columns: [
            { key: 'nom', label: 'Utilisateur' }, { key: 'role', label: 'Rôle' },
            { key: 'affectations', label: 'Affectations' },
            { key: 'reassignations', label: 'Réaffectations' },
            { key: 'total', label: 'Total' },
          ],
          rows: this.supportStats() as unknown as Record<string, unknown>[],
        },
        {
          title: 'Activité des chauffeurs',
          columns: [
            { key: 'nom', label: 'Chauffeur' }, { key: 'transports', label: 'Transports' },
            { key: 'zones', label: 'Zones couvertes' }, { key: 'techs', label: 'Techniciens' },
          ],
          rows: this.chauffeurStats() as unknown as Record<string, unknown>[],
        },
        {
          title: 'Journal des interventions',
          columns: this.EXPORT_COLS,
          rows: this.filtered().map(i => ({
            ...this.withOrigineLabel(i),
            dateDebut: new Date(i.dateDebut).toLocaleString('fr-FR'),
            duree: i.duree ? `${i.duree} min` : '—',
          })) as unknown as Record<string, unknown>[],
        },
      ]
    );
  }
}
