import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  ATTENTE_MOTIFS, AttenteJournalEntry, AttenteMotif,
} from '../../core/models/intervention.model';
import { InterventionService } from '../../core/services/intervention.service';
import { ExportService } from '../../core/services/export.service';
import { DateRangeFilterComponent, DateRangeValue } from '../../shared/components/date-range-filter/date-range-filter.component';
import { attenteARelancer } from '../../shared/components/attente/attente';

// Couleurs distinctes aussi en luminosité (pas seulement en teinte).
const MOTIF_COLORS: Record<AttenteMotif, string> = {
  agent: '#e65100', materiel: '#1565c0', reseau: '#7b1fa2', tiers: '#00897b', autre: '#546e7a',
};

interface Episode {
  interventionId: string;
  start: number;
  end: number | null;          // null = toujours en attente
  motifInitial: AttenteMotif;
}

interface Segment { motif: AttenteMotif; start: number; end: number }

const H = 3_600_000;

function dureeLisible(h: number | null): string {
  if (h === null || !isFinite(h)) return '—';
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(h < 10 ? 1 : 0)} h`;
  return `${(h / 24).toFixed(1)} j`;
}

@Component({
  selector: 'app-attentes-report',
  standalone: true,
  imports: [
    DatePipe, FormsModule, MatButtonModule, MatIconModule, MatSelectModule, MatFormFieldModule,
    MatPaginatorModule, MatTooltipModule, DateRangeFilterComponent,
  ],
  template: `
    <div class="ar">
      <!-- Filtres -->
      <div class="ar-card ar-filters">
        <div class="pill-field" style="flex:1.3 1 230px">
          <label class="pill-label">Période</label>
          <app-date-range-filter [value]="range()" (valueChange)="range.set($event)" [showTime]="false"></app-date-range-filter>
        </div>
        <div class="pill-field" style="flex:1 1 200px">
          <label class="pill-label">Motif</label>
          <mat-form-field appearance="outline" class="pill-select">
            <mat-icon matPrefix>pause_circle</mat-icon>
            <mat-select [ngModel]="filterMotif()" (ngModelChange)="filterMotif.set($event)">
              <mat-option value="">Tous</mat-option>
              @for (m of motifs; track m.value) { <mat-option [value]="m.value">{{ m.label }}</mat-option> }
            </mat-select>
          </mat-form-field>
        </div>
        <div class="pill-field" style="flex:1 1 200px">
          <label class="pill-label">Technicien</label>
          <mat-form-field appearance="outline" class="pill-select">
            <mat-icon matPrefix>engineering</mat-icon>
            <mat-select [ngModel]="filterTech()" (ngModelChange)="filterTech.set($event)">
              <mat-option value="">Tous</mat-option>
              @for (t of techniciens(); track t.id) { <mat-option [value]="t.id">{{ t.nom }}</mat-option> }
            </mat-select>
          </mat-form-field>
        </div>
        <button mat-stroked-button class="ar-csv" (click)="exportCsv()" [disabled]="journal().length === 0">
          <mat-icon>table_view</mat-icon> CSV
        </button>
      </div>

      @if (loading()) {
        <div class="ar-card ar-empty">Chargement…</div>
      } @else if (error()) {
        <div class="ar-card ar-empty">Impossible de charger l'historique des attentes.</div>
      } @else {
        <!-- Indicateurs -->
        <div class="ar-kpis">
          <div class="ar-kpi"><span class="ar-kpi-v">{{ episodesPeriode().length }}</span><span class="ar-kpi-l">Mises en attente</span></div>
          <div class="ar-kpi"><span class="ar-kpi-v">{{ nbRapports() }}</span><span class="ar-kpi-l">Mini-rapports</span></div>
          <div class="ar-kpi"><span class="ar-kpi-v">{{ dureeMoyenne() }}</span><span class="ar-kpi-l">Durée moyenne d'une attente</span></div>
          <div class="ar-kpi"><span class="ar-kpi-v">{{ enCoursAujourdhui() }}</span><span class="ar-kpi-l">En attente actuellement</span></div>
          <div class="ar-kpi" [class.alert]="aRelancer() > 0"><span class="ar-kpi-v">{{ aRelancer() }}</span><span class="ar-kpi-l">À relancer (+24h)</span></div>
        </div>

        <div class="ar-grid">
          <!-- Répartition par motif -->
          <div class="ar-card">
            <h3 class="ar-h">Répartition par motif</h3>
            <p class="ar-sub">Nombre de mises en attente et temps total passé dans chaque motif sur la période.</p>
            @if (parMotif().length === 0) {
              <p class="ar-none">Aucune attente sur la période.</p>
            }
            @for (m of parMotif(); track m.motif) {
              <div class="ar-motif-row">
                <span class="ar-dot" [style.background]="m.color"></span>
                <span class="ar-motif-label">{{ m.label }}</span>
                <div class="ar-bar"><div class="ar-bar-fill" [style.width.%]="m.pct" [style.background]="m.color"></div></div>
                <span class="ar-motif-n">{{ m.count }}</span>
                <span class="ar-motif-d" matTooltip="Temps total passé dans ce motif · durée moyenne par passage">{{ m.total }} · moy. {{ m.moyenne }}</span>
              </div>
            }
          </div>

          <!-- Évolution -->
          <div class="ar-card">
            <h3 class="ar-h">Évolution</h3>
            <p class="ar-sub">Nouvelles mises en attente par {{ evolution().unite }}, selon le motif de départ.</p>
            @if (evolution().rows.length === 0) {
              <p class="ar-none">Aucune attente sur la période.</p>
            } @else {
              <div class="ar-legend">
                @for (m of motifs; track m.value) {
                  <span><span class="ar-dot" [style.background]="color(m.value)"></span>{{ m.short }}</span>
                }
              </div>
              @for (r of evolution().rows; track r.key) {
                <div class="ar-evo-row">
                  <span class="ar-evo-label">{{ r.label }}</span>
                  <div class="ar-stack">
                    @for (p of r.parts; track p.motif) {
                      <div class="ar-stack-part" [style.width.%]="p.pct" [style.background]="p.color"
                           [matTooltip]="p.label + ' : ' + p.count"></div>
                    }
                  </div>
                  <span class="ar-evo-n">{{ r.total }}</span>
                </div>
              }
            }
          </div>
        </div>

        <!-- Journal -->
        <div class="ar-card">
          <h3 class="ar-h">Journal des mini-rapports ({{ journal().length }})</h3>
          @if (journal().length === 0) {
            <p class="ar-none">Aucun mini-rapport sur la période.</p>
          } @else {
            <div class="ar-table-wrap">
              <table class="ar-table">
                <thead><tr><th>Date</th><th>Agent</th><th>Technicien</th><th>Motif</th><th>Mini-rapport</th><th>Par</th></tr></thead>
                <tbody>
                  @for (e of journalPage(); track e.id) {
                    <tr>
                      <td class="nowrap">{{ e.createdAt | date:'dd/MM/yy HH:mm' }}</td>
                      <td><strong>{{ e.agentNom }}</strong><div class="ar-muted">{{ e.agentZone }}</div></td>
                      <td>{{ e.technicienNom }}</td>
                      <td>
                        @if (e.type === 'reprise') {
                          <span class="ar-chip reprise">Reprise</span>
                        } @else {
                          <span class="ar-chip" [style.border-color]="color(e.motif)" [style.color]="color(e.motif)">{{ short(e.motif) }}</span>
                        }
                      </td>
                      <td class="ar-note">{{ e.note || '—' }}</td>
                      <td class="ar-muted">{{ e.auteurNom }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <mat-paginator [length]="journal().length" [pageSize]="pageSize()" [pageIndex]="pageIndex()"
                           [pageSizeOptions]="[25, 50, 100]" (page)="onPage($event)"></mat-paginator>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .ar { display: flex; flex-direction: column; gap: 16px; padding-top: 16px; }
    .ar-card { background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 18px; }
    .ar-empty, .ar-none { color: #78909c; font-size: 13px; }
    .ar-filters { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
    .ar-csv { height: 44px; }
    .ar-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
    .ar-kpi { background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 16px; display: flex; flex-direction: column; gap: 2px;
      &.alert { border-color: #ef9a9a; background: #ffebee; .ar-kpi-v { color: #b71c1c; } } }
    .ar-kpi-v { font-size: 24px; font-weight: 800; color: #1a2742; }
    .ar-kpi-l { font-size: 12px; color: #607d8b; }
    .ar-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 16px; }
    @media (max-width: 640px) { .ar-grid { grid-template-columns: 1fr; } }
    .ar-h { margin: 0; font-size: 15px; font-weight: 700; color: #1a2742; }
    .ar-sub { margin: 4px 0 14px; font-size: 12px; color: #78909c; }
    .ar-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; flex-shrink: 0; }
    .ar-motif-row { display: grid; grid-template-columns: auto minmax(120px, 1fr) 2fr auto auto; align-items: center; gap: 10px; margin-bottom: 10px; font-size: 13px; }
    .ar-motif-label { color: #1a2742; }
    .ar-bar { height: 8px; background: #eef2f7; border-radius: 4px; overflow: hidden; }
    .ar-bar-fill { height: 100%; border-radius: 4px; }
    .ar-motif-n { font-weight: 700; min-width: 24px; text-align: right; }
    .ar-motif-d { font-size: 11.5px; color: #607d8b; white-space: nowrap; }
    .ar-legend { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: #455a64; margin-bottom: 10px; span { display: inline-flex; align-items: center; } }
    .ar-evo-row { display: grid; grid-template-columns: 90px 1fr 32px; align-items: center; gap: 10px; margin-bottom: 6px; font-size: 12.5px; }
    .ar-evo-label { color: #455a64; white-space: nowrap; }
    .ar-stack { display: flex; height: 14px; background: #f4f6f9; border-radius: 4px; overflow: hidden; }
    .ar-stack-part { height: 100%; }
    .ar-evo-n { text-align: right; font-weight: 700; }
    .ar-table-wrap { overflow-x: auto; margin-top: 12px; }
    .ar-table { width: 100%; border-collapse: collapse; font-size: 13px;
      th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; color: #607d8b; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
      td { padding: 10px; border-bottom: 1px solid #f0f3f7; vertical-align: top; } }
    .nowrap { white-space: nowrap; }
    @media (max-width: 640px) {
      .ar-table thead { display: none; }
      .ar-table, .ar-table tbody, .ar-table tr, .ar-table td { display: block; }
      .ar-table tr { padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
      .ar-table td { padding: 2px 0; border: none; }
      .ar-note { max-width: none; }
    }
    .ar-muted { color: #78909c; font-size: 12px; }
    .ar-note { max-width: 420px; white-space: pre-line; }
    .ar-chip { display: inline-block; padding: 2px 8px; border: 1px solid; border-radius: 10px; font-size: 11.5px; font-weight: 600; white-space: nowrap;
      &.reprise { border-color: #66bb6a; color: #2e7d32; } }
  `]
})
export class AttentesReportComponent implements OnInit {
  private svc = inject(InterventionService);
  private exportSvc = inject(ExportService);

  motifs = ATTENTE_MOTIFS;
  entries = signal<AttenteJournalEntry[]>([]);
  loading = signal(true);
  error = signal(false);

  range = signal<DateRangeValue>({ start: null, end: null });
  filterMotif = signal<'' | AttenteMotif>('');
  filterTech = signal('');
  pageSize = signal(25);
  pageIndex = signal(0);

  // Revenir à la page 1 quand les filtres changent.
  private resetPage = effect(() => {
    this.range(); this.filterMotif(); this.filterTech();
    this.pageIndex.set(0);
  }, { allowSignalWrites: true });

  ngOnInit(): void {
    this.svc.getAttentesJournal()
      .then(e => this.entries.set(e))
      .catch(() => this.error.set(true))
      .finally(() => this.loading.set(false));
  }

  color = (m: AttenteMotif | null) => (m ? MOTIF_COLORS[m] : '#546e7a');
  short = (m: AttenteMotif | null) => ATTENTE_MOTIFS.find(x => x.value === m)?.short ?? 'En attente';

  techniciens = computed(() => {
    const map = new Map<string, string>();
    for (const e of this.entries()) if (e.technicienId) map.set(e.technicienId, e.technicienNom ?? '—');
    return [...map].map(([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom));
  });

  private inRange(t: number): boolean {
    const { start, end } = this.range();
    return (!start || t >= start.getTime()) && (!end || t <= end.getTime());
  }

  /** Entrées filtrées par technicien (le motif et la période s'appliquent selon la vue). */
  private parTech = computed(() => {
    const ft = this.filterTech();
    return ft ? this.entries().filter(e => e.technicienId === ft) : this.entries();
  });

  /**
   * Reconstitue, intervention par intervention, les épisodes d'attente (de la
   * première mise en attente à la reprise ou à la clôture) et les segments de
   * temps passés dans chaque motif (un motif dure jusqu'au mini-rapport suivant).
   */
  private analyse = computed(() => {
    const byInterv = new Map<string, AttenteJournalEntry[]>();
    for (const e of this.parTech()) {
      const list = byInterv.get(e.interventionId) ?? [];
      list.push(e);
      byInterv.set(e.interventionId, list);
    }
    const now = Date.now();
    const episodes: Episode[] = [];
    const segments: Segment[] = [];
    for (const list of byInterv.values()) {
      list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const closedAt = list[0].dateFin && list[0].statut !== 'En cours' ? new Date(list[0].dateFin).getTime() : null;
      let ep: Episode | null = null;
      let seg: { motif: AttenteMotif; start: number } | null = null;
      for (const e of list) {
        const t = new Date(e.createdAt).getTime();
        if (seg) { segments.push({ ...seg, end: t }); seg = null; }
        if (e.type === 'attente' && e.motif) {
          if (!ep) ep = { interventionId: e.interventionId, start: t, end: null, motifInitial: e.motif };
          seg = { motif: e.motif, start: t };
        } else if (e.type === 'reprise' && ep) {
          ep.end = t; episodes.push(ep); ep = null;
        }
      }
      const fin = closedAt ?? now;
      if (seg) segments.push({ ...seg, end: fin });
      if (ep) { ep.end = closedAt; episodes.push(ep); }
    }
    return { episodes, segments };
  });

  episodesPeriode = computed(() => {
    const fm = this.filterMotif();
    return this.analyse().episodes.filter(e => this.inRange(e.start) && (!fm || e.motifInitial === fm));
  });

  journal = computed(() => {
    const fm = this.filterMotif();
    return this.parTech().filter(e =>
      this.inRange(new Date(e.createdAt).getTime()) && (!fm || e.motif === fm)
    );
  });

  journalPage = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.journal().slice(start, start + this.pageSize());
  });

  nbRapports = computed(() => this.journal().filter(e => e.type === 'attente').length);

  dureeMoyenne = computed(() => {
    const closed = this.episodesPeriode().filter(e => e.end !== null);
    if (!closed.length) return '—';
    const moy = closed.reduce((s, e) => s + (e.end! - e.start), 0) / closed.length / H;
    return dureeLisible(moy);
  });

  /** État actuel (indépendant de la période) : interventions en cours en attente. */
  private actuelles = computed(() =>
    this.svc.getAllRaw().filter(i => i.statut === 'En cours' && !!i.attenteMotif &&
      (!this.filterTech() || i.technicienId?.trim() === this.filterTech()) &&
      (!this.filterMotif() || i.attenteMotif === this.filterMotif()))
  );
  enCoursAujourdhui = computed(() => this.actuelles().length);
  aRelancer = computed(() => this.actuelles().filter(attenteARelancer).length);

  parMotif = computed(() => {
    const fm = this.filterMotif();
    const segs = this.analyse().segments.filter(s => this.inRange(s.start) && (!fm || s.motif === fm));
    const rows = ATTENTE_MOTIFS.map(m => {
      const ms = segs.filter(s => s.motif === m.value);
      const totalH = ms.reduce((acc, s) => acc + (s.end - s.start), 0) / H;
      return {
        motif: m.value, label: m.label, color: MOTIF_COLORS[m.value], count: ms.length,
        total: dureeLisible(totalH), moyenne: dureeLisible(ms.length ? totalH / ms.length : null),
      };
    }).filter(r => r.count > 0).sort((a, b) => b.count - a.count);
    const max = Math.max(1, ...rows.map(r => r.count));
    return rows.map(r => ({ ...r, pct: (r.count / max) * 100 }));
  });

  evolution = computed(() => {
    const eps = this.episodesPeriode();
    if (!eps.length) return { unite: 'semaine', rows: [] as { key: string; label: string; total: number; parts: { motif: AttenteMotif; label: string; color: string; count: number; pct: number }[] }[] };
    const first = Math.min(...eps.map(e => e.start));
    const last = Math.max(...eps.map(e => e.start));
    const parSemaine = last - first <= 92 * 24 * H;
    const keyOf = (t: number): { key: string; label: string } => {
      const d = new Date(t);
      if (!parSemaine) {
        return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                 label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) };
      }
      const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
      return { key: monday.toISOString().slice(0, 10),
               label: 'Sem. ' + monday.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) };
    };
    const buckets = new Map<string, { label: string; counts: Map<AttenteMotif, number> }>();
    for (const e of eps) {
      const k = keyOf(e.start);
      const b = buckets.get(k.key) ?? { label: k.label, counts: new Map() };
      b.counts.set(e.motifInitial, (b.counts.get(e.motifInitial) ?? 0) + 1);
      buckets.set(k.key, b);
    }
    const rowsRaw = [...buckets].sort(([a], [b]) => a.localeCompare(b)).map(([key, b]) => ({
      key, label: b.label, total: [...b.counts.values()].reduce((s, n) => s + n, 0), counts: b.counts,
    }));
    const max = Math.max(1, ...rowsRaw.map(r => r.total));
    const rows = rowsRaw.map(r => ({
      key: r.key, label: r.label, total: r.total,
      parts: ATTENTE_MOTIFS.filter(m => r.counts.get(m.value)).map(m => ({
        motif: m.value, label: m.label, color: MOTIF_COLORS[m.value],
        count: r.counts.get(m.value)!, pct: (r.counts.get(m.value)! / max) * 100,
      })),
    }));
    return { unite: parSemaine ? 'semaine' : 'mois', rows };
  });

  onPage(e: PageEvent): void {
    this.pageSize.set(e.pageSize);
    this.pageIndex.set(e.pageIndex);
  }

  exportCsv(): void {
    const rows = this.journal().map(e => ({
      date: new Date(e.createdAt).toLocaleString('fr-FR'),
      agent: e.agentNom, zone: e.agentZone, technicien: e.technicienNom,
      motif: e.type === 'reprise' ? 'Reprise' : (ATTENTE_MOTIFS.find(m => m.value === e.motif)?.label ?? ''),
      note: e.note ?? '', auteur: e.auteurNom,
    }));
    this.exportSvc.exportCsv(rows as never, `attentes_${new Date().toISOString().split('T')[0]}`, [
      { key: 'date', label: 'Date' }, { key: 'agent', label: 'Agent' }, { key: 'zone', label: 'Zone' },
      { key: 'technicien', label: 'Technicien' }, { key: 'motif', label: 'Motif' },
      { key: 'note', label: 'Mini-rapport' }, { key: 'auteur', label: 'Par' },
    ]);
  }
}
