import { Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DatePipe } from '@angular/common';
import { InterventionService } from '../../../core/services/intervention.service';
import { AuthService } from '../../../core/services/auth.service';
import { Intervention } from '../../../core/models/intervention.model';

type KanbanCol = { id: string; label: string; icon: string; color: string; statuts: string[] };

const COLS: KanbanCol[] = [
  { id: 'assignee',  label: 'Assignée',  icon: 'schedule',      color: '#e65100', statuts: ['Assignée'] },
  { id: 'en-cours',  label: 'En cours',  icon: 'play_circle',   color: '#1565c0', statuts: ['En cours'] },
  { id: 'terminee',  label: 'Terminée',  icon: 'check_circle',  color: '#2e7d32', statuts: ['Terminée'] },
  { id: 'echec',     label: 'Échec',     icon: 'cancel',        color: '#c62828', statuts: ['Échec'] },
];

@Component({
  selector: 'app-kanban',
  standalone: true,
  imports: [RouterLink, MatIconModule, MatButtonModule, MatTooltipModule, DatePipe],
  template: `
    <div class="kanban-board">
      @for (col of cols; track col.id) {
        <div class="kanban-col">
          <div class="col-header" [style.border-top-color]="col.color">
            <mat-icon [style.color]="col.color">{{ col.icon }}</mat-icon>
            <span class="col-title">{{ col.label }}</span>
            <span class="col-count" [style.background]="col.color">{{ cards(col).length }}</span>
          </div>
          <div class="col-body">
            @for (i of cards(col); track i.id) {
              <div class="kanban-card" [class.prio-haute]="i.priorite === 'Haute'">
                <div class="card-top">
                  <span class="prio-dot {{ (i.priorite ?? 'normale').toLowerCase() }}"
                        [matTooltip]="i.priorite ?? 'Normale'"></span>
                  <span class="card-type">{{ i.type }}</span>
                  @if (i.deplacementRequis) {
                    <mat-icon class="dep-icon" matTooltip="Déplacement">directions_car</mat-icon>
                  }
                  @if (i.audioMessage) {
                    <mat-icon class="audio-icon" matTooltip="Message vocal de l'agent — cliquer pour écouter"
                              (click)="openAudio(i.audioMessage)">mic</mat-icon>
                  }
                </div>
                <div class="card-agent">
                  <mat-icon>person</mat-icon>
                  <a [routerLink]="['/agents', i.agentId]" class="agent-lnk">{{ i.agentNom }}</a>
                </div>
                <div class="card-zone">{{ i.agentZone }}</div>
                @if (i.technicienNom) {
                  <div class="card-tech">
                    <mat-icon>engineering</mat-icon> {{ i.technicienNom }}
                  </div>
                }
                <div class="card-footer">
                  <span class="card-date">{{ i.dateDebut | date:'dd/MM HH:mm' }}</span>
                  @if (col.id === 'assignee' && canAct()) {
                    <button mat-icon-button (click)="prendreEnCharge(i)" matTooltip="Prendre en charge" class="act-btn">
                      <mat-icon>play_arrow</mat-icon>
                    </button>
                  }
                </div>
              </div>
            } @empty {
              <div class="col-empty">
                <mat-icon>inbox</mat-icon>
                <span>Aucune</span>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .kanban-board {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      padding: 4px 0 16px;
      align-items: start;
    }
    .kanban-col {
      background: var(--surface, #f8fafc);
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 1px 6px rgba(0,0,0,.07);
      display: flex;
      flex-direction: column;
    }
    .col-header {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 14px; border-top: 3px solid;
      background: var(--surface, #fff);
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .col-title { font-weight: 700; font-size: 13px; flex: 1; }
    .col-count {
      color: #fff; font-size: 11px; font-weight: 800;
      padding: 1px 7px; border-radius: 10px; min-width: 20px; text-align: center;
    }
    .col-body { padding: 8px; display: flex; flex-direction: column; gap: 8px; min-height: 120px; }

    .kanban-card {
      background: #fff;
      border-radius: 8px;
      padding: 10px 12px;
      box-shadow: 0 1px 4px rgba(0,0,0,.08);
      border-left: 3px solid #e0e6ed;
      transition: box-shadow .15s, transform .15s;
      &:hover { box-shadow: 0 4px 12px rgba(0,0,0,.12); transform: translateY(-1px); }
      &.prio-haute { border-left-color: #c62828; }
    }
    .card-top { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
    .prio-dot {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
      &.haute   { background: #c62828; }
      &.normale { background: #1565c0; }
      &.basse   { background: #78909c; }
    }
    .card-type { font-size: 11px; font-weight: 700; color: var(--primary, #1a3a5c); flex: 1; }
    .dep-icon  { font-size: 14px; width: 14px; height: 14px; color: #6a1b9a; }
    .audio-icon { font-size: 14px; width: 14px; height: 14px; color: #1565c0; cursor: pointer; &:hover { color: #0d47a1; } }

    .card-agent { display: flex; align-items: center; gap: 4px; margin-bottom: 2px;
      mat-icon { font-size: 14px; width: 14px; height: 14px; color: var(--text-secondary, #6b7a99); }
    }
    .agent-lnk { font-size: 13px; font-weight: 600; color: var(--primary, #1a3a5c); text-decoration: none;
      &:hover { text-decoration: underline; }
    }
    .card-zone { font-size: 11px; color: var(--text-secondary, #6b7a99); margin-bottom: 4px; padding-left: 18px; }
    .card-tech { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #546e7a; margin-bottom: 4px;
      mat-icon { font-size: 13px; width: 13px; height: 13px; }
    }
    .card-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 6px;
      border-top: 1px solid #f0f4f8; padding-top: 6px;
    }
    .card-date { font-size: 11px; color: var(--text-secondary, #6b7a99); }
    .act-btn { width: 28px !important; height: 28px !important;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #1565c0; }
    }

    .col-empty { display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: 24px 0; color: #b0bec5;
      mat-icon { font-size: 28px; width: 28px; height: 28px; opacity: 0.4; }
      span { font-size: 12px; }
    }

    @media (max-width: 900px) { .kanban-board { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 500px)  { .kanban-board { grid-template-columns: 1fr; } }
  `]
})
export class KanbanComponent {
  private interventionSvc = inject(InterventionService);
  private auth            = inject(AuthService);
  private snack           = inject(MatSnackBar);

  cols = COLS;

  private all = computed(() => {
    const user = this.auth.currentUser();
    const items = this.interventionSvc.getAllRaw();
    if (this.auth.isTechnicien() && user) {
      return items.filter(i => i.technicienId === user.id);
    }
    return items;
  });

  cards(col: KanbanCol): Intervention[] {
    return this.all().filter(i => col.statuts.includes(i.statut))
      .sort((a, b) => b.dateDebut.localeCompare(a.dateDebut));
  }

  canAct(): boolean { return this.auth.isTechnicien(); }

  openAudio(url: string): void {
    window.open(url, '_blank');
  }

  async prendreEnCharge(i: Intervention): Promise<void> {
    const ok = await this.interventionSvc.update(i.id, { statut: 'En cours', dateDebut: new Date().toISOString() });
    if (ok) this.snack.open('Intervention prise en charge', 'OK', { duration: 2000, panelClass: 'success-snack' });
  }
}
