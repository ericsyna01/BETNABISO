import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NotificationService } from '../../core/services/notification.service';
import { MissionService } from '../../core/services/mission.service';
import { InterventionService } from '../../core/services/intervention.service';
import { AuthService } from '../../core/services/auth.service';

interface TickerItem {
  id: string;
  icon: string;
  label: string;
  route: string[];
  queryParams?: Record<string, string>;
  notifId?: string;
}

@Component({
  selector: 'app-requests-ticker',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule],
  template: `
    @if (visible()) {
      <div class="ticker-bar">
        <div class="ticker-label">
          <mat-icon>campaign</mat-icon>
          <span class="ticker-count">{{ items().length }}</span>
          <span class="ticker-label-text">demande(s) en attente</span>
        </div>
        <div class="ticker-track">
          <div class="ticker-content">
            @for (n of items(); track n.id) {
              <span class="ticker-item" (click)="goTo(n)">
                <mat-icon>{{ n.icon }}</mat-icon>
                {{ n.label }}
                @if (n.notifId) {
                  <mat-icon class="ticker-dismiss" matTooltip="Marquer comme traitée" (click)="dismiss($event, n)">close</mat-icon>
                }
              </span>
            }
            <!-- copie dupliquée pour une boucle continue sans coupure -->
            @for (n of items(); track 'dup-' + n.id) {
              <span class="ticker-item" (click)="goTo(n)" aria-hidden="true">
                <mat-icon>{{ n.icon }}</mat-icon>
                {{ n.label }}
                @if (n.notifId) {
                  <mat-icon class="ticker-dismiss" matTooltip="Marquer comme traitée" (click)="dismiss($event, n)">close</mat-icon>
                }
              </span>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .ticker-bar {
      display: flex; align-items: stretch; height: 34px; background: #fff3e0;
      border-bottom: 1px solid #ffcc80; overflow: hidden; flex-shrink: 0;
    }
    .ticker-label {
      display: flex; align-items: center; gap: 6px; padding: 0 14px;
      font-size: 12px; font-weight: 700; color: #e65100; background: #ffe0b2;
      flex-shrink: 0; white-space: nowrap;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .ticker-track { flex: 1; overflow: hidden; position: relative; }
    .ticker-content {
      display: flex; align-items: center; gap: 40px; height: 34px;
      width: max-content; animation: ticker-scroll 30s linear infinite;
      will-change: transform;
    }
    .ticker-track:hover .ticker-content { animation-play-state: paused; }
    .ticker-item {
      display: flex; align-items: center; gap: 6px; font-size: 12.5px;
      color: #7b4a00; cursor: pointer; white-space: nowrap; flex-shrink: 0;
      &:hover { text-decoration: underline; }
      mat-icon { font-size: 15px; width: 15px; height: 15px; color: #e65100; }
    }
    .ticker-dismiss {
      color: #a1887f !important; margin-left: 2px; border-radius: 50%;
      &:hover { background: rgba(0,0,0,.08); color: #5d4037 !important; }
    }
    @keyframes ticker-scroll {
      from { transform: translateX(0); }
      to   { transform: translateX(-50%); }
    }
    @media (prefers-reduced-motion: reduce) {
      .ticker-content { animation: none; }
      .ticker-track { overflow-x: auto; }
    }

    /* ── Mobile ── */
    @media (max-width: 640px) {
      .ticker-bar { height: 30px; }
      .ticker-label {
        gap: 4px; padding: 0 8px; font-size: 11px;
        mat-icon { font-size: 15px; width: 15px; height: 15px; }
      }
      .ticker-label-text { display: none; }
      .ticker-content { gap: 24px; height: 30px; animation-duration: 22s; }
      .ticker-item {
        font-size: 11.5px; gap: 4px;
        mat-icon { font-size: 13px; width: 13px; height: 13px; }
      }
    }
  `]
})
export class RequestsTickerComponent {
  private notifSvc        = inject(NotificationService);
  private missionSvc      = inject(MissionService);
  private interventionSvc = inject(InterventionService);
  private router          = inject(Router);
  auth = inject(AuthService);

  items = computed<TickerItem[]>(() => {
    const isAdmin = this.auth.isAdmin() || this.auth.isSuperadmin();
    const userId  = this.auth.currentUser()?.id;

    const demandes: TickerItem[] = isAdmin
      ? this.notifSvc.getAll()
          .filter(n => (n.type === 'agent_modification' || n.type === 'deplacement_requis') && n.statut !== 'traitée')
          .map(n => ({
            id: 'notif-' + n.id,
            icon: n.type === 'deplacement_requis' ? 'directions_car' : 'edit_note',
            label: `${n.requestedByNom ? n.requestedByNom + ' — ' : ''}${n.message}`,
            route: n.type === 'agent_modification' && n.agentId ? ['/agents', n.agentId] : ['/support'],
          }))
      : [];

    const missions: TickerItem[] = this.missionSvc.getAll()
      .filter(m => m.statut === 'assignée' && m.assignedById !== userId && (isAdmin || m.assignedToId === userId || m.assignedToId2 === userId))
      .map(m => ({
        id: 'mission-' + m.id,
        icon: 'assignment_ind',
        label: isAdmin
          ? `Nouvelle mission : ${m.titre} — ${m.assignedToNom}${m.assignedToNom2 ? ' + ' + m.assignedToNom2 : ''}`
          : `Nouvelle mission qui vous est assignée : ${m.titre}`,
        route: ['/missions'],
      }));

    const interventions: TickerItem[] = this.interventionSvc.getAll()
      .filter(i => i.statut === 'Assignée' && i.assignedById !== userId && (isAdmin || i.technicienId === userId))
      .map(i => ({
        id: 'interv-' + i.id,
        icon: 'assignment',
        label: isAdmin
          ? `Nouvelle intervention : ${i.type} — ${i.agentNom} — ${i.technicienNom}`
          : `Nouvelle intervention qui vous est assignée : ${i.type} — ${i.agentNom}`,
        route: ['/interventions'],
        queryParams: { id: i.id },
      }));

    return [...demandes, ...missions, ...interventions];
  });

  visible = computed(() => this.items().length > 0);

  goTo(item: TickerItem): void {
    this.router.navigate(item.route, { queryParams: item.queryParams ?? {} });
  }

  dismiss(event: Event, item: TickerItem): void {
    event.stopPropagation();
    if (item.notifId) this.notifSvc.markTraitee(item.notifId);
  }
}
