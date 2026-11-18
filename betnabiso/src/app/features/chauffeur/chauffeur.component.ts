import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet, SlicePipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { InterventionService } from '../../core/services/intervention.service';
import { AuthService } from '../../core/services/auth.service';
import { ExportService } from '../../core/services/export.service';
import { Intervention } from '../../core/models/intervention.model';
import { ConfirmService } from '../../core/services/confirm.service';

@Component({
  selector: 'app-chauffeur',
  standalone: true,
  imports: [
    DatePipe, NgTemplateOutlet, SlicePipe, TitleCasePipe, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatTooltipModule, MatChipsModule,
    MatDividerModule, MatSnackBarModule
  ],
  template: `
<div class="page-container">

  <!-- ─── En-tête ──────────────────────────────────────────── -->
  <div class="page-header">
    <div>
      <h1><mat-icon style="vertical-align:middle;margin-right:8px">local_shipping</mat-icon>Mes missions</h1>
      <p class="page-subtitle">Bonjour {{ currentUser()?.prenom }} — {{ todayLabel }}</p>
    </div>
    <div class="header-actions">
      <button mat-stroked-button (click)="exportPdf()" matTooltip="Exporter les missions du jour en PDF">
        <mat-icon>picture_as_pdf</mat-icon> Missions du jour
      </button>
    </div>
  </div>

  <!-- ─── Stats ────────────────────────────────────────────── -->
  <div class="stats-row">
    <div class="stat-card total">
      <div class="stat-icon"><mat-icon>receipt_long</mat-icon></div>
      <div class="stat-info">
        <div class="stat-value">{{ missions().length }}</div>
        <div class="stat-label">Total missions</div>
      </div>
    </div>
    <div class="stat-card today-card">
      <div class="stat-icon"><mat-icon>today</mat-icon></div>
      <div class="stat-info">
        <div class="stat-value">{{ todayMissions().length }}</div>
        <div class="stat-label">Aujourd'hui</div>
      </div>
    </div>
    <div class="stat-card orange">
      <div class="stat-icon"><mat-icon>pending_actions</mat-icon></div>
      <div class="stat-info">
        <div class="stat-value">{{ countByStatut('Assignée') }}</div>
        <div class="stat-label">À prendre en charge</div>
      </div>
    </div>
    <div class="stat-card blue">
      <div class="stat-icon"><mat-icon>directions_car</mat-icon></div>
      <div class="stat-info">
        <div class="stat-value">{{ countByStatut('En cours') }}</div>
        <div class="stat-label">En cours</div>
      </div>
    </div>
    <div class="stat-card green">
      <div class="stat-icon"><mat-icon>task_alt</mat-icon></div>
      <div class="stat-info">
        <div class="stat-value">{{ countByStatut('Terminée') }}</div>
        <div class="stat-label">Terminées</div>
      </div>
    </div>
  </div>

  <!-- ─── Filtres ──────────────────────────────────────────── -->
  <div class="filters-bar">
    <div class="pill-field" style="flex:2 1 220px">
      <label class="pill-label">Rechercher</label>
      <mat-form-field appearance="outline" class="pill-select">
        <mat-icon matPrefix>search</mat-icon>
        <input matInput [ngModel]="search()" (ngModelChange)="search.set($event)" placeholder="Agent, zone, technicien...">
      </mat-form-field>
    </div>
    <div class="pill-field" style="width:160px">
      <label class="pill-label">Statut</label>
      <mat-form-field appearance="outline" class="pill-select">
        <mat-icon matPrefix>flag</mat-icon>
        <mat-select [ngModel]="filterStatut()" (ngModelChange)="filterStatut.set($event)">
          <mat-option value="">Tous</mat-option>
          <mat-option value="Assignée">Assignée</mat-option>
          <mat-option value="En cours">En cours</mat-option>
          <mat-option value="Terminée">Terminée</mat-option>
          <mat-option value="Échec">Échec</mat-option>
        </mat-select>
      </mat-form-field>
    </div>
    <span class="result-count">{{ filtered().length }} mission(s)</span>
  </div>

  <!-- ─── Missions ─────────────────────────────────────────── -->
  @if (filtered().length === 0) {
    <div class="empty-state">
      <mat-icon>directions_car</mat-icon>
      <h3>Aucune mission de transport</h3>
      <p>Aucune intervention avec déplacement validé pour le moment.</p>
    </div>
  } @else {

    <!-- Aujourd'hui -->
    @if (filteredToday().length > 0) {
      <div class="section-label today-label">
        <mat-icon>today</mat-icon> Aujourd'hui — {{ todayShort }}
      </div>
      <div class="missions-list">
        @for (m of filteredToday(); track m.id) {
          <ng-container *ngTemplateOutlet="missionCard; context: { $implicit: m }"></ng-container>
        }
      </div>
    }

    <!-- À venir -->
    @if (filteredFuture().length > 0) {
      <div class="section-label">
        <mat-icon>schedule</mat-icon> À venir
      </div>
      <div class="missions-list">
        @for (m of filteredFuture(); track m.id) {
          <ng-container *ngTemplateOutlet="missionCard; context: { $implicit: m }"></ng-container>
        }
      </div>
    }

    <!-- Passées -->
    @if (filteredPast().length > 0) {
      <div class="section-label past-label">
        <mat-icon>history</mat-icon> Passées
      </div>
      <div class="missions-list">
        @for (m of filteredPast(); track m.id) {
          <ng-container *ngTemplateOutlet="missionCard; context: { $implicit: m }"></ng-container>
        }
      </div>
    }

  }

</div>

<!-- ─── Template carte mission ───────────────────────────────── -->
<ng-template #missionCard let-m>
  <div class="mission-card" [class.urgent]="m.priorite === 'Haute'" [class.is-today]="isToday(m)">

    <!-- Bande statut -->
    <div class="mission-status-bar statut-{{ statutSlug(m.statut) }}"></div>

    <div class="mission-body">

      <!-- Colonne date -->
      <div class="mission-date">
        <div class="date-day">{{ (m.datePlanifiee ?? m.dateDebut) | date:'EEE':'':'fr' | titlecase }}</div>
        <div class="date-num">{{ (m.datePlanifiee ?? m.dateDebut) | date:'dd' }}</div>
        <div class="date-mon">{{ (m.datePlanifiee ?? m.dateDebut) | date:'MMM':'':'fr' }}</div>
        <div class="date-hr">{{ (m.datePlanifiee ?? m.dateDebut) | date:'HH:mm' }}</div>
      </div>

      <mat-divider vertical style="height:auto;margin:0 14px"></mat-divider>

      <!-- Infos principales -->
      <div class="mission-main">
        <div class="mission-top">
          <span class="mission-type">{{ m.type }}</span>
          @if (m.priorite === 'Haute') {
            <span class="prio-badge haute">
              <mat-icon>priority_high</mat-icon> Urgent
            </span>
          }
          <span class="statut-chip statut-{{ statutSlug(m.statut) }}">{{ m.statut }}</span>
        </div>

        <div class="mission-agents">
          <div class="agent-row">
            <mat-icon>person_pin</mat-icon>
            <strong>{{ m.agentNom }}</strong>
            <span class="zone-tag">{{ m.agentZone }}</span>
          </div>
          <div class="agent-row">
            <mat-icon>engineering</mat-icon>
            <span>Technicien : <strong>{{ m.technicienNom }}</strong></span>
          </div>
        </div>

        @if (m.description) {
          <div class="mission-desc">
            <mat-icon style="font-size:13px;width:13px;height:13px;color:#888">notes</mat-icon>
            {{ m.description | slice:0:120 }}{{ m.description.length > 120 ? '…' : '' }}
          </div>
        }

        @if (m.deplacementNote) {
          <div class="mission-note">
            <mat-icon>info_outline</mat-icon>
            {{ m.deplacementNote }}
          </div>
        }
      </div>

      <!-- Colonne actions -->
      <div class="mission-actions-col">

        <!-- Navigation -->
        <a class="nav-btn" [href]="mapsUrl(m)" target="_blank" matTooltip="Ouvrir dans Google Maps">
          <mat-icon>navigation</mat-icon>
          <span>Naviguer</span>
        </a>

        <!-- Démarrer transport -->
        @if (m.statut === 'Assignée') {
          <button class="action-btn start-btn" (click)="demarrer(m)" [disabled]="actionLoading()" matTooltip="Je pars en route">
            <mat-icon>play_arrow</mat-icon>
            <span>Démarrer</span>
          </button>
        }

        <!-- Livraison terminée -->
        @if (m.statut === 'En cours' && !m.deplacementTermine) {
          <button class="action-btn done-btn" (click)="terminerTransport(m)" [disabled]="actionLoading()" matTooltip="Technicien livré — l'intervention reste en cours pour le technicien">
            <mat-icon>where_to_vote</mat-icon>
            <span>Livraison faite</span>
          </button>
        }

        <!-- Validé par -->
        @if (m.deplacementValideBy) {
          <div class="depl-validee">
            <mat-icon>verified</mat-icon>
            {{ m.deplacementValideBy }}
          </div>
        }
      </div>

    </div>
  </div>
</ng-template>
  `,
  styles: [`
    .page-header { display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px; }
    .page-subtitle { color:var(--text-secondary);font-size:13px;margin-top:4px; }
    .header-actions { display:flex;gap:8px;align-items:center; }

    /* ─── Stats ───────────────────────────────────────────── */
    .stats-row { display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap; }
    .stat-card { display:flex;align-items:center;gap:14px;background:white;border-radius:10px;padding:14px 20px;flex:1;min-width:120px;box-shadow:0 1px 6px rgba(0,0,0,.07); }
    .stat-icon { width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center; }
    .stat-icon mat-icon { font-size:24px;width:24px;height:24px;color:white; }
    .stat-value { font-size:22px;font-weight:700;color:var(--primary); }
    .stat-label { font-size:11px;color:var(--text-secondary); }
    .stat-card.total      .stat-icon { background:linear-gradient(135deg,#1a3a5c,#2a5fa0); }
    .stat-card.today-card .stat-icon { background:linear-gradient(135deg,#6a1b9a,#ab47bc); }
    .stat-card.orange     .stat-icon { background:linear-gradient(135deg,#e65100,#ff6d00); }
    .stat-card.blue       .stat-icon { background:linear-gradient(135deg,#1565c0,#42a5f5); }
    .stat-card.green      .stat-icon { background:linear-gradient(135deg,#2e7d32,#66bb6a); }

    /* ─── Filtres ─────────────────────────────────────────── */
    .filters-bar { display:flex;align-items:center;gap:12px;margin-bottom:8px;flex-wrap:wrap; }
    .filters-bar mat-form-field { flex:1;min-width:200px; }
    .result-count { color:var(--text-secondary);font-size:13px;margin-left:auto;white-space:nowrap; }

    /* ─── Sections ────────────────────────────────────────── */
    .section-label { display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.5px;margin:20px 0 10px;padding-left:4px; }
    .section-label mat-icon { font-size:18px;width:18px;height:18px; }
    .section-label.today-label { color:#6a1b9a; }
    .section-label.today-label mat-icon { color:#6a1b9a; }
    .section-label.past-label { color:#999; }
    .section-label.past-label mat-icon { color:#bbb; }

    /* ─── Empty state ─────────────────────────────────────── */
    .empty-state { text-align:center;padding:60px 20px;background:white;border-radius:12px;box-shadow:0 1px 6px rgba(0,0,0,.06); }
    .empty-state mat-icon { font-size:56px;width:56px;height:56px;color:#ccc;margin-bottom:16px; }
    .empty-state h3 { font-size:16px;color:#555;margin:0 0 8px; }
    .empty-state p { font-size:13px;color:#aaa;margin:0; }

    /* ─── Carte mission ───────────────────────────────────── */
    .missions-list { display:flex;flex-direction:column;gap:12px; }
    .mission-card { background:white;border-radius:12px;box-shadow:0 1px 8px rgba(0,0,0,.08);overflow:hidden;display:flex;transition:box-shadow 0.2s; }
    .mission-card:hover { box-shadow:0 4px 16px rgba(0,0,0,.13); }
    .mission-card.urgent { border:1.5px solid #ff6d00; }
    .mission-card.is-today { box-shadow:0 2px 12px rgba(106,27,154,.18); }

    .mission-status-bar { width:5px;flex-shrink:0; }
    .mission-status-bar.statut-assignee { background:#ff8f00; }
    .mission-status-bar.statut-en-cours { background:#1565c0; }
    .mission-status-bar.statut-terminee { background:#2e7d32; }
    .mission-status-bar.statut-echec    { background:#c62828; }

    .mission-body { display:flex;align-items:stretch;padding:14px 18px;gap:0;flex:1; }

    /* Date */
    .mission-date { display:flex;flex-direction:column;align-items:center;min-width:52px;text-align:center; }
    .date-day { font-size:10px;text-transform:uppercase;color:var(--text-secondary);letter-spacing:.5px; }
    .date-num { font-size:26px;font-weight:800;color:var(--primary);line-height:1; }
    .date-mon { font-size:11px;font-weight:600;color:var(--primary-light);text-transform:uppercase; }
    .date-hr  { font-size:11px;color:var(--text-secondary);margin-top:4px;background:#f0f4f8;padding:2px 6px;border-radius:4px; }

    /* Infos */
    .mission-main { flex:1;min-width:0; }
    .mission-top { display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap; }
    .mission-type { font-size:13px;font-weight:700;color:var(--primary); }
    .prio-badge { display:flex;align-items:center;gap:2px;font-size:10px;font-weight:700;background:#fff3e0;color:#e65100;padding:2px 8px;border-radius:8px; }
    .prio-badge mat-icon { font-size:12px;width:12px;height:12px; }

    .statut-chip { font-size:11px;padding:2px 9px;border-radius:8px;font-weight:600; }
    .statut-chip.statut-assignee { background:#fff3e0;color:#e65100; }
    .statut-chip.statut-en-cours { background:#e3f2fd;color:#1565c0; }
    .statut-chip.statut-terminee { background:#e8f5e9;color:#2e7d32; }
    .statut-chip.statut-echec    { background:#fce4ec;color:#c62828; }

    .mission-agents { display:flex;flex-direction:column;gap:4px;margin-bottom:6px; }
    .agent-row { display:flex;align-items:center;gap:6px;font-size:12px;color:#333; }
    .agent-row mat-icon { font-size:15px;width:15px;height:15px;color:var(--primary-light); }
    .zone-tag { font-size:11px;background:#e3f2fd;color:#1565c0;padding:1px 7px;border-radius:4px;margin-left:4px; }
    .mission-desc { display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text-secondary);font-style:italic;margin-top:4px; }
    .mission-note { display:flex;align-items:center;gap:4px;font-size:12px;color:#e65100;margin-top:6px;background:#fff3e0;padding:4px 8px;border-radius:6px; }
    .mission-note mat-icon { font-size:14px;width:14px;height:14px; }

    /* Actions */
    .mission-actions-col { min-width:150px;border-left:1px solid #eee;padding-left:16px;margin-left:16px;display:flex;flex-direction:column;gap:8px;justify-content:center;align-items:stretch; }

    .nav-btn { display:flex;align-items:center;justify-content:center;gap:6px;font-size:12px;font-weight:600;color:#1565c0;background:#e3f2fd;padding:6px 12px;border-radius:8px;text-decoration:none;transition:background 0.2s; }
    .nav-btn:hover { background:#bbdefb; }
    .nav-btn mat-icon { font-size:16px;width:16px;height:16px; }

    .action-btn { display:flex;align-items:center;justify-content:center;gap:6px;font-size:12px;font-weight:600;padding:6px 12px;border-radius:8px;border:none;cursor:pointer;transition:opacity 0.2s;width:100%; }
    .action-btn:disabled { opacity:.5;cursor:not-allowed; }
    .action-btn mat-icon { font-size:16px;width:16px;height:16px; }
    .start-btn { background:#e3f2fd;color:#1565c0; }
    .start-btn:hover:not(:disabled) { background:#bbdefb; }
    .done-btn { background:#e8f5e9;color:#2e7d32; }
    .done-btn:hover:not(:disabled) { background:#c8e6c9; }

    .depl-validee { display:flex;align-items:center;gap:4px;font-size:11px;color:#1565c0; }
    .depl-validee mat-icon { font-size:13px;width:13px;height:13px; }

    @media (max-width:768px) {
      .mission-body { flex-direction:column; }
      .mission-actions-col { border-left:none;padding-left:0;border-top:1px solid #eee;padding-top:10px;margin:10px 0 0;flex-direction:row;justify-content:flex-start;min-width:0; }
    }
  `]
})
export class ChauffeurComponent {
  private interventionSvc = inject(InterventionService);
  private auth            = inject(AuthService);
  private exportSvc       = inject(ExportService);
  private snack           = inject(MatSnackBar);
  private confirmSvc      = inject(ConfirmService);

  currentUser = this.auth.currentUser;

  search        = signal('');
  filterStatut  = signal('');
  actionLoading = signal(false);

  readonly today     = new Date();
  readonly todayLabel = this.today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  readonly todayShort = this.today.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

  missions = computed(() => this.interventionSvc.getAll());

  todayMissions = computed(() =>
    this.missions().filter(m => this.isToday(m))
      .sort((a, b) => (a.datePlanifiee ?? a.dateDebut).localeCompare(b.datePlanifiee ?? b.dateDebut))
  );

  filtered = computed(() => {
    let items = this.missions();
    const q = this.search().toLowerCase().trim();
    if (q) {
      items = items.filter(m =>
        m.agentNom.toLowerCase().includes(q) ||
        m.agentZone.toLowerCase().includes(q) ||
        m.technicienNom.toLowerCase().includes(q) ||
        m.type.toLowerCase().includes(q)
      );
    }
    const fs = this.filterStatut();
    if (fs) items = items.filter(m => m.statut === fs);
    return items;
  });

  filteredToday  = computed(() => this.filtered().filter(m => this.isToday(m)).sort(this.byDate));
  filteredFuture = computed(() => this.filtered().filter(m => this.isFuture(m)).sort(this.byDate));
  filteredPast   = computed(() => this.filtered().filter(m => this.isPast(m)).sort((a, b) => this.byDate(b, a)));

  countByStatut(s: string): number {
    return this.missions().filter(m => m.statut === s).length;
  }

  isToday(m: Intervention): boolean {
    const d = new Date(m.datePlanifiee ?? m.dateDebut);
    return d.toDateString() === this.today.toDateString();
  }

  isFuture(m: Intervention): boolean {
    const d = new Date(m.datePlanifiee ?? m.dateDebut);
    return d > this.today && !this.isToday(m);
  }

  isPast(m: Intervention): boolean {
    const d = new Date(m.datePlanifiee ?? m.dateDebut);
    return d < this.today && !this.isToday(m);
  }

  private byDate(a: Intervention, b: Intervention): number {
    return (a.datePlanifiee ?? a.dateDebut).localeCompare(b.datePlanifiee ?? b.dateDebut);
  }

  statutSlug(s: string): string {
    return { 'Assignée': 'assignee', 'En cours': 'en-cours', 'Terminée': 'terminee', 'Échec': 'echec' }[s] ?? '';
  }

  mapsUrl(m: Intervention): string {
    const query = encodeURIComponent(`${m.agentZone}, ${m.agentNom}`);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }

  async demarrer(m: Intervention): Promise<void> {
    this.actionLoading.set(true);
    try {
      await this.interventionSvc.demarrerTransport(m.id);
      this.snack.open('Transport démarré ✓', 'OK', { duration: 2500, panelClass: 'success-snack' });
    } catch {
      this.snack.open('Erreur lors de la mise à jour', 'OK', { duration: 3000, panelClass: 'error-snack' });
    }
    this.actionLoading.set(false);
  }

  async terminerTransport(m: Intervention): Promise<void> {
    if (!await this.confirmSvc.ask(`Confirmer la livraison pour ${m.agentNom} ?\nL'intervention restera en cours pour le technicien.`, 'Confirmer la livraison', 'Confirmer')) return;
    this.actionLoading.set(true);
    try {
      await this.interventionSvc.terminerTransport(m.id);
      this.snack.open('Livraison enregistrée — technicien sur place ✓', 'OK', { duration: 3000, panelClass: 'success-snack' });
    } catch {
      this.snack.open('Erreur lors de la mise à jour', 'OK', { duration: 3000, panelClass: 'error-snack' });
    }
    this.actionLoading.set(false);
  }

  exportPdf(): void {
    const cols = [
      { key: 'agentNom',     label: 'Agent' },
      { key: 'agentZone',    label: 'Zone' },
      { key: 'technicienNom', label: 'Technicien' },
      { key: 'type',          label: 'Type' },
      { key: 'statut',        label: 'Statut' },
      { key: 'datePlanifiee', label: 'Date prévue' },
      { key: 'deplacementNote', label: 'Note transport' },
    ];
    const rows = this.todayMissions().length > 0
      ? this.todayMissions()
      : this.filtered();
    this.exportSvc.exportPdf(
      `Missions du ${this.todayShort}`,
      cols as { key: string; label: string }[],
      rows as unknown as Record<string, unknown>[]
    );
  }
}
