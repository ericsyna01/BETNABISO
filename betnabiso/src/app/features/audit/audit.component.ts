import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ExportService } from '../../core/services/export.service';

interface AuditEntry {
  id: string;
  userId: string;
  userNom: string;
  userRole: string;
  action: string;
  resource: string;
  resourceId: string;
  details: string;
  createdAt: string;
}

const RESOURCE_LABELS: Record<string, string> = {
  intervention: 'Intervention',
  evaluation: 'Évaluation',
  user: 'Utilisateur',
  group: 'Groupe',
  agent_modification: 'Demande de modification',
  agent: 'Agent',
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: '#1b5e20',
  UPDATE: '#0d47a1',
  DELETE: '#b71c1c',
  SUBMIT: '#4a148c',
  LOGIN:  '#e65100',
};

const ACTION_BG: Record<string, string> = {
  CREATE: '#43a047',
  UPDATE: '#1e88e5',
  DELETE: '#e53935',
  SUBMIT: '#8e24aa',
  LOGIN:  '#fb8c00',
};

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DatePipe,
    MatCardModule, MatTableModule, MatSelectModule, MatInputModule,
    MatFormFieldModule, MatIconModule, MatButtonModule, MatTooltipModule, MatChipsModule,
    MatPaginatorModule
  ],
  template: `
    <div class="audit-page">
      <div class="audit-header">
        <h2><mat-icon>security</mat-icon> Journal d'audit</h2>
        <div class="header-actions">
          <div class="pill-field filter-field">
            <label class="pill-label">Filtrer par ressource</label>
            <mat-form-field appearance="outline" class="pill-select">
              <mat-icon matPrefix>filter_alt</mat-icon>
              <mat-select [(ngModel)]="resourceFilter" (ngModelChange)="load()">
                <mat-option value="">Toutes</mat-option>
                <mat-option value="intervention">Interventions</mat-option>
                <mat-option value="evaluation">Évaluations</mat-option>
                <mat-option value="user">Utilisateurs</mat-option>
                <mat-option value="group">Groupes</mat-option>
                <mat-option value="agent_modification">Demandes de modification</mat-option>
                <mat-option value="agent">Agents</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
          <div class="pill-field filter-field">
            <label class="pill-label">Rechercher</label>
            <mat-form-field appearance="outline" class="pill-select">
              <mat-icon matPrefix>search</mat-icon>
              <input matInput [(ngModel)]="searchText" placeholder="Nom, action…" />
            </mat-form-field>
          </div>
          <button mat-stroked-button (click)="exportCsv()" matTooltip="Exporter CSV">
            <mat-icon>download</mat-icon> CSV
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="loading">Chargement…</div>
      } @else if (filtered().length === 0) {
        <div class="empty">
          <mat-icon>history</mat-icon>
          <p>Aucune entrée d'audit trouvée.</p>
        </div>
      } @else {
        <mat-card class="table-card">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Utilisateur</th>
                  <th>Rôle</th>
                  <th>Action</th>
                  <th>Ressource</th>
                  <th>ID</th>
                  <th>Détails</th>
                </tr>
              </thead>
              <tbody>
                @for (entry of paged(); track entry.id) {
                  <tr>
                    <td class="date-cell">{{ entry.createdAt | date:'dd/MM/yy HH:mm' }}</td>
                    <td>{{ entry.userNom }}</td>
                    <td><span class="role-chip role-{{ entry.userRole }}">{{ entry.userRole }}</span></td>
                    <td>
                      <span class="action-chip" [style.background]="actionBg(entry.action)" [style.color]="'#fff'">
                        {{ entry.action }}
                      </span>
                    </td>
                    <td>{{ resourceLabel(entry.resource) }}</td>
                    <td class="id-cell" [matTooltip]="entry.resourceId">{{ entry.resourceId | slice:0:8 }}…</td>
                    <td class="details-cell">{{ entry.details }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <mat-paginator
            [length]="filtered().length"
            [pageSize]="pageSize()"
            [pageIndex]="pageIndex()"
            [pageSizeOptions]="[10, 25, 50, 100]"
            (page)="onPage($event)"
            showFirstLastButtons>
          </mat-paginator>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .audit-page { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .audit-header { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
    .audit-header h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 1.4rem; flex: 1; color: #1a3a5c; }
    .header-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .filter-field { width: 180px; }
    .table-card { overflow: hidden; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    thead tr { background: #f0f4f8; }
    th { padding: 10px 12px; text-align: left; font-weight: 700; color: #37474f; white-space: nowrap; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.4px; }
    tbody tr { color: #212121; }
    tbody tr:hover { background: #f5f7fa; }
    td { padding: 9px 12px; border-bottom: 1px solid #e8ecef; vertical-align: middle; }
    .date-cell { white-space: nowrap; color: #546e7a; font-size: 0.8rem; }
    .id-cell { font-family: monospace; color: #78909c; font-size: 0.8rem; cursor: default; }
    .details-cell { max-width: 320px; white-space: normal; word-break: break-word; color: #455a64; }
    .role-chip { padding: 3px 10px; border-radius: 12px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.3px; }
    .role-superadmin { background: #7b1fa2; color: #fff; }
    .role-admin      { background: #1565c0; color: #fff; }
    .role-technicien { background: #2e7d32; color: #fff; }
    .role-support    { background: #e65100; color: #fff; }
    .role-chauffeur  { background: #00695c; color: #fff; }
    .action-chip { padding: 3px 10px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; }
    .loading, .empty { text-align: center; padding: 60px 20px; color: #90a4ae; }
    .empty mat-icon { font-size: 48px; width: 48px; height: 48px; display: block; margin: 0 auto 12px; }
    .count { margin: 8px 16px; font-size: 0.8rem; color: #90a4ae; }
  `]
})
export class AuditComponent implements OnInit {
  private http      = inject(HttpClient);
  private exportSvc = inject(ExportService);

  entries = signal<AuditEntry[]>([]);
  loading = signal(false);
  resourceFilter = '';
  searchTextSig = signal('');

  get searchText(): string { return this.searchTextSig(); }
  set searchText(v: string) { this.searchTextSig.set(v); this.pageIndex.set(0); }

  pageIndex = signal(0);
  pageSize  = signal(25);

  filtered = computed(() => {
    const q = this.searchTextSig().toLowerCase();
    return this.entries().filter(e =>
      (!q || e.userNom.toLowerCase().includes(q) || e.action.toLowerCase().includes(q) || e.details?.toLowerCase().includes(q))
    );
  });

  paged = computed(() => {
    const all = this.filtered();
    const size = this.pageSize();
    const start = this.pageIndex() * size;
    return all.slice(start, start + size);
  });

  onPage(e: PageEvent): void {
    this.pageSize.set(e.pageSize);
    this.pageIndex.set(e.pageIndex);
  }

  ngOnInit(): void { this.load(); }

  async load(): Promise<void> {
    this.pageIndex.set(0);
    this.loading.set(true);
    try {
      const url = this.resourceFilter
        ? `${environment.apiUrl}/audit?resource=${this.resourceFilter}`
        : `${environment.apiUrl}/audit`;
      const data = await firstValueFrom(this.http.get<AuditEntry[]>(url));
      this.entries.set(data);
    } catch { this.entries.set([]); }
    this.loading.set(false);
  }

  actionColor(action: string): string {
    return ACTION_COLORS[action] ?? '#546e7a';
  }

  actionBg(action: string): string {
    return ACTION_BG[action] ?? '#78909c';
  }

  resourceLabel(r: string): string {
    return RESOURCE_LABELS[r] ?? r;
  }

  exportCsv(): void {
    const cols = [
      { key: 'createdAt', label: 'Date' },
      { key: 'userNom', label: 'Utilisateur' },
      { key: 'userRole', label: 'Rôle' },
      { key: 'action', label: 'Action' },
      { key: 'resource', label: 'Ressource' },
      { key: 'resourceId', label: 'ID Ressource' },
      { key: 'details', label: 'Détails' },
    ];
    this.exportSvc.exportCsv(this.filtered() as unknown as Record<string, unknown>[], 'audit_log.csv', cols);
  }
}
