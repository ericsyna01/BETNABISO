import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { PlanningService, getISOWeek, getWeekDates, formatDate } from '../../core/services/planning.service';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { CreneauService } from '../../core/services/creneau.service';
import { PlanningEntry, TypeCreneau } from '../../core/models/planning.model';
import { Creneau } from '../../core/models/creneau.model';
import { User } from '../../core/models/user.model';
import { ConfirmService } from '../../core/services/confirm.service';

const JOURS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const MOIS_FR  = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc'];
const FALLBACK_COLOR = { texte: '#546e7a', fond: '#eceff1' };

interface DayCell {
  date: string; dayName: string; dayLabel: string;
  isToday: boolean; isWeekend: boolean; isPast: boolean; entries: PlanningEntry[];
}

@Component({
  selector: 'app-planning',
  standalone: true,
  imports: [
    FormsModule, DragDropModule,
    MatCardModule, MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatTooltipModule, MatSnackBarModule,
    MatChipsModule, MatDividerModule, MatMenuModule
  ],
  template: `
<div class="page-container" cdkDropListGroup>

  <!-- ══════════ VUE SUPERADMIN ══════════ -->
  @if (isSuperadmin()) {

    <div class="page-header">
      <h1><mat-icon style="vertical-align:middle;margin-right:8px">calendar_month</mat-icon>Planning & Rotation</h1>
      <div class="page-header-actions">
        <button mat-stroked-button (click)="clearWeek()">
          <mat-icon>delete_sweep</mat-icon> Vider la semaine
        </button>
        <button mat-raised-button color="accent" (click)="generateRotation()">
          <mat-icon>autorenew</mat-icon> Générer rotation
        </button>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-mini blue"><mat-icon>event</mat-icon>
        <div><strong>{{ weekEntries().length }}</strong><span>Affectations</span></div>
      </div>
      <div class="stat-mini green"><mat-icon>engineering</mat-icon>
        <div><strong>{{ uniqueUsers().length }}</strong><span>Planifiés</span></div>
      </div>
      <div class="stat-mini orange"><mat-icon>people</mat-icon>
        <div><strong>{{ availableUsers().length }}</strong><span>Disponibles</span></div>
      </div>
      <div class="stat-mini purple"><mat-icon>schedule</mat-icon>
        <div><strong>Sem. {{ currentWeek() }}</strong><span>{{ currentYear() }}</span></div>
      </div>
    </div>

    <div class="week-nav">
      <button mat-icon-button (click)="prevWeek()"><mat-icon>chevron_left</mat-icon></button>
      <div class="week-label">
        <mat-icon>date_range</mat-icon>
        <strong>Semaine {{ currentWeek() }}</strong>
        <span>{{ weekRange() }}</span>
      </div>
      <button mat-icon-button (click)="nextWeek()"><mat-icon>chevron_right</mat-icon></button>
      <button mat-stroked-button (click)="goToToday()" style="margin-left:12px">
        <mat-icon>today</mat-icon> Aujourd'hui
      </button>
    </div>

    <p class="drag-hint"><mat-icon>drag_indicator</mat-icon> Astuce : glissez une carte technicien depuis le récapitulatif ci-dessous directement sur un jour pour l'affecter ({{ creneaux()[0]?.label ?? 'premier créneau' }} par défaut).</p>

    <div class="calendar-grid">
      @for (day of dayCells(); track day.date) {
        <div class="day-col" [class.today]="day.isToday" [class.weekend]="day.isWeekend"
             [class.drag-over]="dragOverDate() === day.date"
             cdkDropList
             [id]="'day-' + day.date"
             [cdkDropListDisabled]="day.isPast"
             [cdkDropListData]="day.entries"
             (cdkDropListEntered)="dragOverDate.set(day.date)"
             (cdkDropListExited)="dragOverDate.set(null)"
             (cdkDropListDropped)="onDayDrop($event, day)">
          <div class="day-header">
            <div class="day-name">{{ day.dayName }}</div>
            <div class="day-date">{{ day.dayLabel }}</div>
            @if (day.isToday) { <div class="today-badge">Aujourd'hui</div> }
          </div>
          <div class="day-body">
            @for (entry of day.entries; track entry.id) {
              <div class="entry-card role-{{ entry.userRole }}">
                <div class="entry-top">
                  <span class="entry-name">{{ entry.userNom }}</span>
                  <button class="entry-del" (click)="deleteEntry(entry)">
                    <mat-icon style="font-size:14px;width:14px;height:14px">close</mat-icon>
                  </button>
                </div>
                <div class="entry-meta">
                  <span class="creneau-badge clickable"
                        [style.background]="creneauColor(entry.type).fond" [style.color]="creneauColor(entry.type).texte"
                        [matMenuTriggerFor]="creneauMenu" matTooltip="Changer le créneau">
                    {{ entry.type }} <mat-icon>expand_more</mat-icon>
                  </span>
                  <mat-menu #creneauMenu="matMenu">
                    @for (c of creneaux(); track c.id) {
                      <button mat-menu-item [disabled]="c.label === entry.type" (click)="changeCreneau(entry, c.label)">
                        {{ c.label }} ({{ c.heureDebut }} – {{ c.heureFin }})
                      </button>
                    }
                  </mat-menu>
                  <span class="entry-hours">{{ entry.heureDebut }}–{{ entry.heureFin }}</span>
                </div>
                <span class="role-tag">{{ entry.userRole }}</span>
                @if (entry.note) { <div class="entry-note">{{ entry.note }}</div> }
              </div>
            }
            @if (day.entries.length === 0) {
              <div class="empty-day"><mat-icon>person_off</mat-icon><span>Aucun</span></div>
            }
          </div>
          @if (!day.isPast) {
            <button class="add-day-btn" (click)="openForm(day.date)">
              <mat-icon>add</mat-icon>
            </button>
          }
        </div>
      }
    </div>

    @if (showForm()) {
      <mat-card class="form-card">
        <mat-card-header>
          <mat-card-title><mat-icon>person_add</mat-icon> Ajouter une affectation</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="form-row">
            <mat-form-field appearance="outline">
              <mat-label>Utilisateur *</mat-label>
              <mat-select [(ngModel)]="formUserId">
                @for (u of availableUsers(); track u.id) {
                  <mat-option [value]="u.id">
                    <span class="opt-user">
                      <span class="opt-name">{{ u.prenom }} {{ u.nom }}</span>
                      <span class="opt-role role-{{ u.role }}">{{ u.role }}</span>
                    </span>
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Créneau *</mat-label>
              <mat-select [(ngModel)]="formType">
                @for (c of creneaux(); track c.id) {
                  <mat-option [value]="c.label">{{ c.label }} ({{ c.heureDebut }} – {{ c.heureFin }})</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Note (optionnel)</mat-label>
              <input matInput [(ngModel)]="formNote" placeholder="Remarque...">
            </mat-form-field>
          </div>
          <div class="form-actions">
            <button mat-stroked-button (click)="closeForm()">Annuler</button>
            <button mat-raised-button color="primary" (click)="saveEntry()" [disabled]="!formUserId || !formType || saving()">
              <mat-icon>save</mat-icon> {{ saving() ? 'Enregistrement...' : 'Confirmer' }}
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    }

    <mat-card style="margin-top:20px">
      <mat-card-header>
        <mat-card-title>Récapitulatif — Semaine {{ currentWeek() }}</mat-card-title>
      </mat-card-header>
      <mat-card-content style="padding:0 16px 16px">
        <div class="recap-grid"
             cdkDropList
             id="staff-pool"
             cdkDropListSortingDisabled
             [cdkDropListData]="recapUsers()">
          @for (u of recapUsers(); track u.id) {
            <div class="recap-card" cdkDrag [cdkDragData]="u" cdkDragPreviewContainer="global">
              <div class="recap-avatar role-{{ u.role }}">{{ initials(u) }}</div>
              <div class="recap-info">
                <div class="recap-name">{{ u.prenom }} {{ u.nom }}</div>
                <span class="role-badge {{ u.role }}">{{ u.role }}</span>
                <div class="recap-days">
                  @for (day of recapForUser(u.id); track day.date) {
                    <span class="recap-day-chip"
                          [style.background]="creneauColor(day.type).fond" [style.color]="creneauColor(day.type).texte"
                          [matTooltip]="day.date + ' — ' + day.type">{{ day.dayShort }}</span>
                  }
                  @if (recapForUser(u.id).length === 0) {
                    <span class="recap-none">Non planifié</span>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      </mat-card-content>
    </mat-card>

  } @else {

    <!-- ══════════ VUE PERSONNELLE (autres rôles) ══════════ -->

    <div class="page-header">
      <div>
        <h1><mat-icon style="vertical-align:middle;margin-right:8px">event_note</mat-icon>Mon emploi du temps</h1>
        <p class="page-subtitle">Bonjour {{ currentUser()?.prenom }} — voici vos affectations planifiées</p>
      </div>
    </div>

    <!-- Stats personnelles -->
    <div class="stats-row">
      <div class="stat-mini blue"><mat-icon>today</mat-icon>
        <div><strong>{{ myWeekEntries().length }}</strong><span>Cette semaine</span></div>
      </div>
      <div class="stat-mini green"><mat-icon>upcoming</mat-icon>
        <div><strong>{{ myUpcoming().length }}</strong><span>À venir</span></div>
      </div>
      <div class="stat-mini orange"><mat-icon>schedule</mat-icon>
        <div><strong>{{ myNextEntry()?.type ?? '—' }}</strong><span>Prochain créneau</span></div>
      </div>
      <div class="stat-mini purple"><mat-icon>date_range</mat-icon>
        <div><strong>Sem. {{ currentWeek() }}</strong><span>{{ currentYear() }}</span></div>
      </div>
    </div>

    <!-- Navigation -->
    <div class="week-nav">
      <button mat-icon-button (click)="prevWeek()"><mat-icon>chevron_left</mat-icon></button>
      <div class="week-label">
        <mat-icon>date_range</mat-icon>
        <strong>Semaine {{ currentWeek() }}</strong>
        <span>{{ weekRange() }}</span>
      </div>
      <button mat-icon-button (click)="nextWeek()"><mat-icon>chevron_right</mat-icon></button>
      <button mat-stroked-button (click)="goToToday()" style="margin-left:12px">
        <mat-icon>today</mat-icon> Aujourd'hui
      </button>
    </div>

    <!-- Grille personnelle -->
    <div class="calendar-grid">
      @for (day of myDayCells(); track day.date) {
        <div class="day-col" [class.today]="day.isToday" [class.weekend]="day.isWeekend"
             [class.has-entry]="day.entries.length > 0">
          <div class="day-header">
            <div class="day-name">{{ day.dayName }}</div>
            <div class="day-date">{{ day.dayLabel }}</div>
            @if (day.isToday) { <div class="today-badge">Aujourd'hui</div> }
          </div>
          <div class="day-body">
            @for (entry of day.entries; track entry.id) {
              <div class="my-entry-card">
                <div class="my-entry-icon">
                  <mat-icon>{{ creneauIcon(entry.type) }}</mat-icon>
                </div>
                <div class="my-entry-info">
                  <div class="my-entry-type">{{ entry.type }}</div>
                  <div class="my-entry-hours">{{ entry.heureDebut }} – {{ entry.heureFin }}</div>
                  @if (entry.note) { <div class="entry-note">{{ entry.note }}</div> }
                </div>
              </div>
            }
            @if (day.entries.length === 0) {
              <div class="empty-day"><mat-icon>free_cancellation</mat-icon><span>Repos</span></div>
            }
          </div>
        </div>
      }
    </div>

    <!-- Prochaines affectations -->
    <mat-card>
      <mat-card-header>
        <mat-card-title><mat-icon style="color:var(--primary-light)">upcoming</mat-icon> Prochaines affectations</mat-card-title>
      </mat-card-header>
      <mat-card-content style="padding:8px 16px 16px">
        @if (myUpcoming().length === 0) {
          <div class="empty-upcoming">
            <mat-icon>event_available</mat-icon>
            <p>Aucune affectation à venir pour le moment.</p>
          </div>
        } @else {
          <div class="upcoming-list">
            @for (entry of myUpcoming(); track entry.id) {
              <div class="upcoming-item">
                <div class="upcoming-date-block" [style.background]="creneauColor(entry.type).fond" [style.color]="creneauColor(entry.type).texte">
                  <span class="upcoming-day">{{ dayLabel(entry.date) }}</span>
                  <span class="upcoming-num">{{ dateNum(entry.date) }}</span>
                  <span class="upcoming-month">{{ monthLabel(entry.date) }}</span>
                </div>
                <div class="upcoming-info">
                  <div class="upcoming-type">{{ entry.type }}</div>
                  <div class="upcoming-hours">
                    <mat-icon style="font-size:14px;width:14px;height:14px">schedule</mat-icon>
                    {{ entry.heureDebut }} – {{ entry.heureFin }}
                  </div>
                  @if (entry.note) { <div class="entry-note">{{ entry.note }}</div> }
                </div>
                <span class="creneau-badge" [style.background]="creneauColor(entry.type).fond" [style.color]="creneauColor(entry.type).texte">{{ entry.type }}</span>
              </div>
            }
          </div>
        }
      </mat-card-content>
    </mat-card>

  }

</div>
  `,
  styles: [`
    .page-subtitle { color:var(--text-secondary);font-size:13px;margin-top:4px; }

    /* ─── Stats ──────────────────────────────────── */
    .stats-row { display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap; }
    .stat-mini { display:flex;align-items:center;gap:12px;background:white;border-radius:10px;padding:12px 18px;flex:1;min-width:140px;box-shadow:0 1px 6px rgba(0,0,0,.07); }
    .stat-mini mat-icon { font-size:28px;width:28px;height:28px; }
    .stat-mini div { display:flex;flex-direction:column; }
    .stat-mini strong { font-size:20px;font-weight:700; }
    .stat-mini span { font-size:11px;color:var(--text-secondary); }
    .stat-mini.blue mat-icon { color:#1565c0; }
    .stat-mini.green mat-icon { color:#2e7d32; }
    .stat-mini.orange mat-icon { color:#e65100; }
    .stat-mini.purple mat-icon { color:#6a1b9a; }

    /* ─── Navigation semaine ─────────────────────── */
    .week-nav { display:flex;align-items:center;gap:8px;background:white;border-radius:10px;padding:10px 16px;margin-bottom:16px;box-shadow:0 1px 6px rgba(0,0,0,.07);flex-wrap:wrap; }
    .week-label { display:flex;align-items:center;gap:8px;flex:1;justify-content:center;font-size:15px;min-width:0; }
    .week-label mat-icon { color:var(--primary-light); }
    .week-label strong { color:var(--primary);font-size:16px; }
    .week-label span { color:var(--text-secondary);font-size:13px; }

    /* ─── Calendrier ──────────────────────────────── */
    .calendar-grid { display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-bottom:20px; }

    /* ─── Conflict warning ─────────────────────────── */
    .conflict-badge { display:inline-flex;align-items:center;gap:3px;background:#fff3e0;color:#e65100;font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;margin-top:3px; }
    .conflict-badge mat-icon { font-size:12px;width:12px;height:12px; }

    /* ─── Responsive ──────────────────────────────── */
    @media (max-width:1100px) {
      .calendar-grid { grid-template-columns:repeat(4,1fr); }
    }
    @media (max-width:768px) {
      .calendar-grid { grid-template-columns:repeat(2,1fr); gap:6px; }
      .form-row { grid-template-columns:1fr; }
      .stats-row { gap:8px; }
      .stat-mini { min-width:120px; padding:10px 12px; }
      .recap-grid { grid-template-columns:1fr; }
      .page-header { flex-direction:column; align-items:flex-start; gap:8px; }
      .page-header-actions { flex-wrap:wrap; }
    }
    @media (max-width:480px) {
      .calendar-grid { grid-template-columns:1fr; }
      .week-label span { display:none; }
    }
    .day-col { background:white;border-radius:10px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,.06);display:flex;flex-direction:column;min-height:180px;transition:box-shadow 0.2s,background 0.15s; }
    .day-col:hover { box-shadow:0 3px 12px rgba(0,0,0,.12); }
    .day-col.today { border:2px solid var(--primary); }
    .day-col.weekend { background:#fafafa; }
    .day-col.has-entry { box-shadow:0 2px 12px rgba(21,101,192,.18); }
    .day-col.drag-over { background:#f0f7ff;box-shadow:0 0 0 2px var(--primary) inset; }
    .day-col.cdk-drop-list-disabled { opacity:.55; }

    /* ─── Glisser-déposer ──────────────────────────── */
    .drag-hint { display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-secondary);margin:-8px 0 14px; }
    .drag-hint mat-icon { font-size:16px;width:16px;height:16px; }
    .recap-card { cursor:grab; }
    .recap-card:active { cursor:grabbing; }
    .recap-card.cdk-drag-preview { box-shadow:0 8px 24px rgba(0,0,0,.25);border-radius:10px;opacity:.95; }
    .recap-card.cdk-drag-placeholder { opacity:.3; }
    .recap-grid.cdk-drop-list-dragging .recap-card:not(.cdk-drag-placeholder) { transition:transform 200ms ease; }
    .day-header { padding:10px 10px 6px;border-bottom:1px solid var(--border);text-align:center;background:linear-gradient(135deg,#f8fafc,#fff); }
    .day-name { font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-secondary);letter-spacing:.5px; }
    .day-date { font-size:16px;font-weight:700;color:var(--primary);margin-top:2px; }
    .today-badge { font-size:9px;background:var(--primary);color:white;padding:1px 6px;border-radius:10px;display:inline-block;margin-top:3px;font-weight:600; }
    .day-col.weekend .day-name,.day-col.weekend .day-date { color:#bbb; }
    .day-body { flex:1;padding:8px;display:flex;flex-direction:column;gap:6px; }
    .empty-day { display:flex;flex-direction:column;align-items:center;gap:4px;padding:16px 0;color:#ccc; }
    .empty-day mat-icon { font-size:20px;width:20px;height:20px; }
    .empty-day span { font-size:11px; }

    /* ─── Entrées superadmin ──────────────────────── */
    .entry-card { border-radius:8px;padding:7px 9px;border-left:3px solid transparent;background:#f8fafc; }
    .entry-top { display:flex;align-items:center;justify-content:space-between;margin-bottom:4px; }
    .entry-name { font-size:12px;font-weight:600;color:#1a3a5c; }
    .entry-del { background:none;border:none;cursor:pointer;color:#bbb;padding:0;display:flex;align-items:center;line-height:1; }
    .entry-del:hover { color:#c62828; }
    .entry-meta { display:flex;align-items:center;gap:6px;margin-bottom:3px; }
    .entry-hours { font-size:10px;color:var(--text-secondary); }
    .role-tag { font-size:9px;text-transform:uppercase;color:var(--text-secondary);letter-spacing:.5px; }
    .entry-note { font-size:10px;color:var(--text-secondary);font-style:italic;margin-top:3px; }
    .entry-card.role-technicien { border-color:#00897b;background:#e0f2f1; }
    .entry-card.role-support    { border-color:#f57c00;background:#fff3e0; }
    .entry-card.role-admin      { border-color:#1565c0;background:#e3f2fd; }

    /* ─── Entrées vue personnelle ─────────────────── */
    .my-entry-card { display:flex;align-items:flex-start;gap:8px;background:linear-gradient(135deg,#e3f2fd,#f0f7ff);border-radius:8px;padding:8px;border:1px solid #90caf9; }
    .my-entry-icon { width:28px;height:28px;background:var(--primary);border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
    .my-entry-icon mat-icon { color:white;font-size:16px;width:16px;height:16px; }
    .my-entry-type { font-size:12px;font-weight:700;color:var(--primary); }
    .my-entry-hours { font-size:11px;color:var(--text-secondary);margin-top:2px; }

    /* ─── Créneau badges ─────────────────────────── */
    .creneau-badge { font-size:9px;padding:1px 6px;border-radius:8px;font-weight:600; }
    .creneau-badge.clickable { cursor:pointer;display:inline-flex;align-items:center;gap:1px;transition:filter .15s; }
    .creneau-badge.clickable:hover { filter:brightness(0.93); }
    .creneau-badge.clickable mat-icon { font-size:12px;width:12px;height:12px; }

    .add-day-btn { width:100%;border:1.5px dashed #ddd;background:none;cursor:pointer;padding:8px;color:#aaa;display:flex;align-items:center;justify-content:center;transition:all 0.2s;border-top:1px solid var(--border); }
    .add-day-btn:hover { background:#f0f7ff;color:var(--primary);border-color:var(--primary); }

    /* ─── Formulaire ─────────────────────────────── */
    .form-card { margin-bottom:20px; }
    .form-row { display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;padding-top:12px; }
    .form-actions { display:flex;justify-content:flex-end;gap:10px;padding-top:8px; }
    .opt-user { display:flex;align-items:center;gap:8px; }
    .opt-name { font-weight:500; }
    .opt-role { font-size:10px;padding:1px 6px;border-radius:3px;font-weight:600;text-transform:uppercase; }
    .opt-role.role-technicien { background:rgba(0,137,123,.15);color:#00897b; }
    .opt-role.role-support    { background:rgba(245,124,0,.15);color:#f57c00; }
    .opt-role.role-admin      { background:rgba(21,101,192,.15);color:#1565c0; }

    /* ─── Récap ──────────────────────────────────── */
    .recap-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-top:12px; }
    .recap-card { display:flex;align-items:flex-start;gap:12px;background:#f8fafc;border-radius:10px;padding:12px 14px;border:1px solid var(--border); }
    .recap-avatar { width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;flex-shrink:0; }
    .recap-avatar.role-technicien { background:linear-gradient(135deg,#00897b,#26a69a); }
    .recap-avatar.role-support    { background:linear-gradient(135deg,#f57c00,#ffa726); }
    .recap-avatar.role-admin      { background:linear-gradient(135deg,#1565c0,#42a5f5); }
    .recap-info { flex:1;min-width:0; }
    .recap-name { font-weight:600;font-size:13px;margin-bottom:3px; }
    .recap-days { display:flex;flex-wrap:wrap;gap:4px;margin-top:6px; }
    .recap-day-chip { font-size:10px;padding:2px 7px;border-radius:8px;font-weight:600; }
    .recap-none { font-size:11px;color:#bbb; }
    .role-badge { display:inline-block;font-size:10px;padding:1px 6px;border-radius:3px;font-weight:600;text-transform:uppercase;margin-bottom:4px; }
    .role-badge.technicien { background:rgba(0,137,123,.2);color:#00897b; }
    .role-badge.support    { background:rgba(245,124,0,.2);color:#f57c00; }
    .role-badge.admin      { background:rgba(21,101,192,.2);color:#1565c0; }

    /* ─── Prochaines affectations ────────────────── */
    .empty-upcoming { display:flex;flex-direction:column;align-items:center;gap:8px;padding:32px;color:#ccc; }
    .empty-upcoming mat-icon { font-size:40px;width:40px;height:40px; }
    .empty-upcoming p { font-size:13px;margin:0; }
    .upcoming-list { display:flex;flex-direction:column;gap:10px;margin-top:4px; }
    .upcoming-item { display:flex;align-items:center;gap:14px;background:#f8fafc;border-radius:10px;padding:12px 16px;border:1px solid var(--border);transition:box-shadow 0.2s; }
    .upcoming-item:hover { box-shadow:0 2px 8px rgba(0,0,0,.08); }
    .upcoming-date-block { display:flex;flex-direction:column;align-items:center;min-width:48px;padding:6px 10px;border-radius:8px;font-weight:700; }
    .upcoming-day   { font-size:10px;text-transform:uppercase;letter-spacing:.5px; }
    .upcoming-num   { font-size:22px;line-height:1; }
    .upcoming-month { font-size:10px; }
    .upcoming-info  { flex:1; }
    .upcoming-type  { font-weight:600;font-size:14px; }
    .upcoming-hours { display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text-secondary);margin-top:2px; }
  `]
})
export class PlanningComponent {
  private planningSvc = inject(PlanningService);
  private userSvc     = inject(UserService);
  private auth        = inject(AuthService);
  private creneauSvc  = inject(CreneauService);
  private snack       = inject(MatSnackBar);
  private confirmSvc  = inject(ConfirmService);

  creneaux    = computed(() => this.creneauSvc.getAll());
  currentUser = this.auth.currentUser;
  isSuperadmin = computed(() => this.auth.role() === 'superadmin');

  private today = new Date();
  currentWeek = signal(getISOWeek(this.today));
  currentYear = signal(this.today.getFullYear());

  showForm   = signal(false);
  formDate   = signal('');
  formUserId = '';
  formType: TypeCreneau = '';
  formNote   = '';
  saving     = signal(false);
  dragOverDate = signal<string | null>(null);

  // ─── Superadmin ───────────────────────────────────
  weekEntries = computed(() =>
    this.planningSvc.getByWeek(this.currentYear(), this.currentWeek())
  );

  availableUsers = computed(() =>
    this.userSvc.getAll().filter(u => u.actif && u.role !== 'superadmin')
  );

  uniqueUsers = computed(() => {
    const ids = new Set(this.weekEntries().map(e => e.userId));
    return [...ids];
  });

  dayCells = computed((): DayCell[] => {
    const dates   = getWeekDates(this.currentYear(), this.currentWeek());
    const todayStr = formatDate(this.today);
    return dates.map((d, i) => ({
      date:      formatDate(d),
      dayName:   JOURS_FR[i],
      dayLabel:  `${d.getDate()} ${MOIS_FR[d.getMonth()]}`,
      isToday:   formatDate(d) === todayStr,
      isPast:    formatDate(d) < todayStr,
      isWeekend: i >= 5,
      entries:   this.planningSvc.getByDate(formatDate(d)),
    }));
  });

  weekRange = computed(() => {
    const dates = getWeekDates(this.currentYear(), this.currentWeek());
    const f = dates[0], l = dates[6];
    return `${f.getDate()} ${MOIS_FR[f.getMonth()]} – ${l.getDate()} ${MOIS_FR[l.getMonth()]} ${this.currentYear()}`;
  });

  recapUsers = computed(() =>
    this.userSvc.getAll().filter(u => u.actif && u.role !== 'superadmin')
  );

  recapForUser(userId: string) {
    const dates = getWeekDates(this.currentYear(), this.currentWeek());
    return this.weekEntries()
      .filter(e => e.userId === userId)
      .map(e => ({
        date: e.date, type: e.type,
        dayShort: JOURS_FR[dates.findIndex(d => formatDate(d) === e.date)]?.slice(0, 2) ?? e.date,
      }));
  }

  initials(u: { prenom: string; nom: string }) {
    return `${u.prenom[0]}${u.nom[0]}`.toUpperCase();
  }

  // ─── Vue personnelle ──────────────────────────────
  myWeekEntries = computed(() => {
    const uid = this.currentUser()?.id;
    return uid ? this.weekEntries().filter(e => e.userId === uid) : [];
  });

  myDayCells = computed((): DayCell[] => {
    const uid      = this.currentUser()?.id;
    const todayStr = formatDate(this.today);
    const dates    = getWeekDates(this.currentYear(), this.currentWeek());
    return dates.map((d, i) => ({
      date:      formatDate(d),
      dayName:   JOURS_FR[i],
      dayLabel:  `${d.getDate()} ${MOIS_FR[d.getMonth()]}`,
      isToday:   formatDate(d) === todayStr,
      isPast:    formatDate(d) < todayStr,
      isWeekend: i >= 5,
      entries:   uid ? this.planningSvc.getByDate(formatDate(d)).filter(e => e.userId === uid) : [],
    }));
  });

  myUpcoming = computed((): PlanningEntry[] => {
    const uid     = this.currentUser()?.id;
    const todayStr = formatDate(this.today);
    if (!uid) return [];
    return this.planningSvc.getAll()
      .filter(e => e.userId === uid && e.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 10);
  });

  myNextEntry = computed(() => this.myUpcoming()[0] ?? null);

  dayLabel(dateStr: string)   { return JOURS_FR[new Date(dateStr + 'T12:00:00').getDay() - 1 < 0 ? 6 : new Date(dateStr + 'T12:00:00').getDay() - 1]?.slice(0, 3) ?? ''; }
  dateNum(dateStr: string)    { return new Date(dateStr + 'T12:00:00').getDate(); }
  monthLabel(dateStr: string) { return MOIS_FR[new Date(dateStr + 'T12:00:00').getMonth()]; }

  creneauIcon(type: string): string {
    const map: Record<string, string> = {
      'Matin': 'wb_sunny', 'Après-midi': 'wb_cloudy',
      'Journée': 'brightness_5', 'Astreinte': 'nights_stay',
    };
    return map[type] ?? 'schedule';
  }

  creneauColor(type: string): { texte: string; fond: string } {
    const c = this.creneauSvc.getByLabel(type);
    return c ? { texte: c.couleurTexte, fond: c.couleurFond } : FALLBACK_COLOR;
  }

  // ─── Navigation ───────────────────────────────────
  prevWeek() {
    let w = this.currentWeek() - 1, y = this.currentYear();
    if (w < 1) { y--; w = weeksInYear(y); }
    this.currentWeek.set(w); this.currentYear.set(y); this.closeForm();
  }

  nextWeek() {
    let w = this.currentWeek() + 1, y = this.currentYear();
    if (w > weeksInYear(y)) { w = 1; y++; }
    this.currentWeek.set(w); this.currentYear.set(y); this.closeForm();
  }

  goToToday() {
    this.currentWeek.set(getISOWeek(this.today));
    this.currentYear.set(this.today.getFullYear());
    this.closeForm();
  }

  // ─── Actions superadmin ───────────────────────────
  openForm(date: string) {
    this.formDate.set(date); this.formUserId = '';
    this.formType = this.creneaux()[0]?.label ?? ''; this.formNote = '';
    this.showForm.set(true);
  }

  closeForm() { this.showForm.set(false); }

  async saveEntry() {
    if (!this.formUserId || !this.formType) return;
    this.saving.set(true);
    await this.assignUser(this.formUserId, this.formDate(), this.formType, this.formNote || undefined);
    this.saving.set(false); this.closeForm();
  }

  /** Affecte un utilisateur à un jour donné, avec confirmation en cas de conflit. Partagé par le formulaire et le glisser-déposer. */
  private async assignUser(userId: string, date: string, type: TypeCreneau, note?: string): Promise<void> {
    const user    = this.userSvc.getById(userId);
    const creneau = this.creneauSvc.getByLabel(type);
    if (!user || !creneau) return;

    const conflicts = this.weekEntries().filter(e => e.userId === userId && e.date === date);
    if (conflicts.length > 0) {
      const types = conflicts.map(e => e.type).join(', ');
      const ok = await this.confirmSvc.ask(
        `${user.prenom} ${user.nom} est déjà affecté ce jour (${types}). Ajouter quand même ?`,
        'Conflit de planning',
        'Ajouter quand même'
      );
      if (!ok) return;
    }

    await this.planningSvc.create({
      userId: user.id, userNom: `${user.prenom} ${user.nom}`, userRole: user.role,
      date, type, heureDebut: creneau.heureDebut, heureFin: creneau.heureFin, note,
    });
    this.snack.open(`${user.prenom} ${user.nom} affecté(e) le ${date}`, 'OK', { duration: 2000, panelClass: 'success-snack' });
  }

  async onDayDrop(event: CdkDragDrop<PlanningEntry[], PlanningEntry[], User>, day: DayCell): Promise<void> {
    this.dragOverDate.set(null);
    if (day.isPast || event.previousContainer === event.container) return;
    const user = event.item.data;
    const defaultCreneau = this.creneaux()[0];
    if (!user || !defaultCreneau) return;
    await this.assignUser(user.id, day.date, defaultCreneau.label);
  }

  async changeCreneau(entry: PlanningEntry, type: TypeCreneau): Promise<void> {
    if (type === entry.type) return;
    const creneau = this.creneauSvc.getByLabel(type);
    if (!creneau) return;
    await this.planningSvc.update(entry.id, { type, heureDebut: creneau.heureDebut, heureFin: creneau.heureFin });
    this.snack.open(`Créneau changé : ${creneau.label}`, 'OK', { duration: 2000, panelClass: 'success-snack' });
  }

  async deleteEntry(entry: PlanningEntry) {
    await this.planningSvc.delete(entry.id);
    this.snack.open('Affectation supprimée', 'OK', { duration: 1500 });
  }

  async clearWeek() {
    if (!await this.confirmSvc.danger(`Supprimer toutes les affectations de la semaine ${this.currentWeek()} ?`, 'Vider la semaine')) return;
    await this.planningSvc.deleteByWeek(this.currentYear(), this.currentWeek());
    this.snack.open('Semaine vidée', 'OK', { duration: 2000 });
  }

  async generateRotation() {
    const users   = this.userSvc.getAll().filter(u => u.actif && ['technicien', 'support'].includes(u.role));
    const creneau = this.creneaux()[0];
    if (!users.length) { this.snack.open('Aucun technicien ou support actif', 'OK', { duration: 2500 }); return; }
    if (!creneau) { this.snack.open('Aucun créneau paramétré — créez-en un dans Administration > Créneaux', 'OK', { duration: 3500 }); return; }
    await this.planningSvc.deleteByWeek(this.currentYear(), this.currentWeek());
    const workDays = getWeekDates(this.currentYear(), this.currentWeek()).slice(0, 5);
    const offset   = (this.currentWeek() - 1) % users.length;
    const rotated  = [...users.slice(offset), ...users.slice(0, offset)];
    let idx = 0;
    for (const day of workDays) {
      const user = rotated[idx % rotated.length];
      await this.planningSvc.create({
        userId: user.id, userNom: `${user.prenom} ${user.nom}`, userRole: user.role,
        date: formatDate(day), type: creneau.label,
        heureDebut: creneau.heureDebut, heureFin: creneau.heureFin,
      });
      idx++;
    }
    this.snack.open(`Rotation générée : ${Math.min(users.length, 5)} affectations`, 'OK',
      { duration: 3000, panelClass: 'success-snack' });
  }
}

function weeksInYear(year: number): number {
  const d    = new Date(year, 11, 31);
  const week = getISOWeek(d);
  return week === 1 ? getISOWeek(new Date(year, 11, 24)) : week;
}
