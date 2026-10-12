import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { AgentNotif } from '../../core/models/notification.model';

@Component({
  selector: 'app-notifications-bell',
  standalone: true,
  imports: [DatePipe, MatIconModule, MatButtonModule, MatMenuModule, MatTooltipModule, MatDividerModule],
  template: `
    <div class="bell-wrap">
      <button mat-icon-button [matMenuTriggerFor]="notifMenu"
              matTooltip="Notifications" (menuOpened)="onOpen()">
        <mat-icon>{{ unreadCount() > 0 ? 'notifications_active' : 'notifications_none' }}</mat-icon>
      </button>
      @if (unreadCount() > 0) {
        <span class="badge">{{ unreadCount() > 9 ? '9+' : unreadCount() }}</span>
      }
    </div>

    <mat-menu #notifMenu="matMenu" class="notif-menu-panel" xPosition="before">
      <!-- Header -->
      <div class="notif-header" (click)="$event.stopPropagation()">
        <span class="notif-title">Notifications</span>
        <div class="notif-header-actions">
          @if (unreadCount() > 0) {
            <button mat-button class="mark-all-btn" (click)="markAll()">Tout marquer lu</button>
          }
          @if ((auth.isAdmin() || auth.isSupport()) && treatedCount() > 0) {
            <button mat-button class="clear-btn" (click)="clearTreated()">
              <mat-icon>delete_sweep</mat-icon>
            </button>
          }
        </div>
      </div>

      <!-- Filtre -->
      <div class="notif-filter" (click)="$event.stopPropagation()">
        <button class="filter-btn" [class.active]="filterMode() === 'all'" (click)="filterMode.set('all')">
          Toutes <span class="filter-count">{{ allNotifications().length }}</span>
        </button>
        <button class="filter-btn" [class.active]="filterMode() === 'unread'" (click)="filterMode.set('unread')">
          Non lues <span class="filter-count unread">{{ unreadCount() }}</span>
        </button>
        @if (auth.isAdmin() || auth.isSupport()) {
          <button class="filter-btn" [class.active]="filterMode() === 'treated'" (click)="filterMode.set('treated')">
            Traitées <span class="filter-count">{{ treatedCount() }}</span>
          </button>
        }
      </div>
      <mat-divider></mat-divider>

      @if (notifications().length === 0) {
        <div class="notif-empty" (click)="$event.stopPropagation()">
          <mat-icon>notifications_off</mat-icon>
          <p>Aucune notification</p>
        </div>
      }

      @for (n of notifications(); track n.id) {
        <div class="notif-item {{ n.statut }}" (click)="$event.stopPropagation()">
          <div class="notif-dot-wrap">
            @if (n.statut === 'non_lue') {
              <span class="notif-dot"></span>
            }
          </div>
          <div class="notif-body">
            <div class="notif-top">
              <span class="notif-agent">{{ n.agentNom || n.requestedByNom }}</span>
              <span class="notif-time">{{ n.createdAt | date:'dd/MM HH:mm' }}</span>
            </div>
            <div class="notif-from">
              @if (n.type === 'deplacement_requis') {
                <span class="type-tag dep"><mat-icon>directions_car</mat-icon> Déplacement</span>
              } @else if (n.type === 'prise_en_charge') {
                <span class="type-tag pec"><mat-icon>engineering</mat-icon> Prise en charge</span>
              } @else if (n.type === 'intervention_assignee') {
                <span class="type-tag interv"><mat-icon>assignment</mat-icon> Intervention</span>
              } @else if (n.type === 'mission_assignee') {
                <span class="type-tag mission"><mat-icon>task_alt</mat-icon> Mission</span>
              } @else if (n.type === 'machine_offline') {
                <span class="type-tag offline"><mat-icon>wifi_off</mat-icon> Machine hors ligne</span>
              } @else if (n.type === 'signalement_panne') {
                <span class="type-tag signal"><mat-icon>campaign</mat-icon> Signalement agent</span>
              } @else if (n.type === 'planning_assigne') {
                <span class="type-tag planning"><mat-icon>calendar_month</mat-icon> Planning</span>
              } @else {
                <span class="type-tag modif"><mat-icon>edit</mat-icon> Modification</span>
              }
              @if (n.requestedByRole) {
                <span class="role-tag {{ n.requestedByRole }}">{{ n.requestedByRole }}</span>
                {{ n.requestedByNom }}
              }
            </div>
            <div class="notif-msg">{{ n.message }}</div>
            @if (n.photoUrl) {
              <img [src]="n.photoUrl" class="notif-photo" (click)="openPhoto(n.photoUrl!, $event)" alt="Photo de la panne">
            }
            @if (n.audioUrl) {
              <audio [src]="n.audioUrl" controls class="notif-audio" (click)="$event.stopPropagation()"></audio>
            }
            @if (auth.isAdmin() || auth.isSupport()) {
              @if (n.statut !== 'traitée') {
                <div class="notif-actions">
                  @if (n.type === 'signalement_panne') {
                    <button mat-button class="btn-assigner" (click)="assigner(n)">
                      <mat-icon>engineering</mat-icon> Assigner
                    </button>
                  }
                  <button mat-button class="btn-traiter" (click)="traiter(n)">
                    <mat-icon>check</mat-icon> Traité
                  </button>
                  <button mat-button class="btn-suppr" (click)="suppr(n)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              } @else {
                <div class="notif-done"><mat-icon>check_circle</mat-icon> Traité</div>
              }
            }
          </div>
        </div>
        <mat-divider></mat-divider>
      }
    </mat-menu>
  `,
  styles: [`
    .bell-wrap { position: relative; display: inline-flex; }
    .badge {
      position: absolute;
      top: 4px; right: 4px;
      min-width: 16px; height: 16px;
      background: #e53935; color: white;
      border-radius: 8px;
      font-size: 10px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      padding: 0 3px;
      pointer-events: none;
      border: 2px solid white;
    }

    ::ng-deep .notif-menu-panel .mat-mdc-menu-panel {
      max-width: 380px !important;
      width: 380px !important;
      max-height: 520px;
      overflow-y: auto;
    }

    @media (max-width: 640px) {
      /* Le panneau CDK est positionné en JS relatif au bouton cloche ; sur un
         écran étroit "xPosition=before" le pousse hors champ à gauche.
         On le repositionne en fixe pour qu'il reste toujours dans l'écran. */
      ::ng-deep .notif-menu-panel {
        position: fixed !important;
        top: 58px !important;
        left: 8px !important;
        right: 8px !important;
        transform: none !important;
      }
      ::ng-deep .notif-menu-panel .mat-mdc-menu-panel {
        width: auto !important;
        max-width: none !important;
        max-height: calc(100vh - 90px) !important;
      }
    }

    .notif-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px 8px;
    }
    .notif-title { font-size: 15px; font-weight: 700; color: #1a3a5c; }
    .notif-header-actions { display: flex; align-items: center; gap: 2px; }
    .mark-all-btn { font-size: 11px; color: #1a3a5c; min-width: 0; padding: 0 4px; height: 28px; }
    .clear-btn { color: #c62828; min-width: 0; width: 30px; height: 30px; padding: 0;
      mat-icon { font-size: 18px; }
    }

    /* Filtre tabs */
    .notif-filter {
      display: flex;
      gap: 4px;
      padding: 4px 12px 8px;
    }
    .filter-btn {
      background: none;
      border: 1.5px solid #e2e8f0;
      border-radius: 20px;
      padding: 3px 10px;
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s;
      &:hover { border-color: #2a5fa0; color: #2a5fa0; }
      &.active { background: #1a3a5c; color: white; border-color: #1a3a5c; }
    }
    .filter-count {
      background: #e2e8f0; color: #475569;
      border-radius: 8px; font-size: 10px; font-weight: 700;
      padding: 0 5px; line-height: 14px;
      .filter-btn.active & { background: rgba(255,255,255,0.25); color: white; }
      &.unread { background: #fce4ec; color: #c62828; }
    }

    .notif-empty {
      display: flex; flex-direction: column; align-items: center;
      padding: 28px 16px; color: #bbb; gap: 8px;
      mat-icon { font-size: 32px; width: 32px; height: 32px; }
      p { font-size: 13px; margin: 0; }
    }

    .notif-item {
      display: flex; gap: 8px; padding: 10px 12px;
      transition: background 0.15s;
      &:hover { background: #f8f9fa; }
      &.non_lue { background: #f0f5ff; }
    }

    .notif-dot-wrap { width: 10px; padding-top: 4px; flex-shrink: 0; }
    .notif-dot { width: 8px; height: 8px; border-radius: 50%; background: #1565c0; display: block; }

    .notif-body { flex: 1; min-width: 0; }

    .notif-top {
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: 8px; margin-bottom: 2px;
    }
    .notif-agent { font-weight: 700; font-size: 13px; color: #1a3a5c; }
    .notif-time { font-size: 11px; color: #999; white-space: nowrap; flex-shrink: 0; }

    .notif-from {
      font-size: 11px; color: #666; margin-bottom: 4px;
      display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
    }
    .type-tag {
      display: inline-flex; align-items: center; gap: 2px;
      font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 3px;
      mat-icon { font-size: 10px; width: 10px; height: 10px; }
      &.dep    { background: #f3e5f5; color: #6a1b9a; }
      &.pec    { background: #e8f5e9; color: #2e7d32; }
      &.modif  { background: #e3f2fd; color: #1565c0; }
      &.interv { background: #e8eaf6; color: #3949ab; }
      &.mission{ background: #fff3e0; color: #e65100; }
      &.offline{ background: #fdecea; color: #c62828; }
      &.signal { background: #fff8e1; color: #f57f17; }
      &.planning { background: #ede7f6; color: #5e35b1; }
    }
    .role-tag {
      font-size: 10px; font-weight: 600; padding: 1px 5px; border-radius: 3px;
      text-transform: uppercase;
      &.support { background: rgba(255,183,77,0.2); color: #e65100; }
      &.technicien { background: rgba(77,182,172,0.2); color: #00695c; }
    }

    .notif-msg {
      font-size: 12px; color: #444; line-height: 1.4;
      word-break: break-word;
    }
    .notif-photo {
      display: block; max-width: 160px; max-height: 120px; margin-top: 6px;
      border-radius: 8px; cursor: pointer; object-fit: cover;
      border: 1px solid #e2e8f0;
    }
    .notif-audio { display: block; width: 100%; max-width: 260px; height: 32px; margin-top: 6px; }

    .notif-actions { display: flex; align-items: center; gap: 4px; margin-top: 6px; }
    .btn-traiter { font-size: 11px; color: #2e7d32; min-width: 0; height: 28px; padding: 0 8px;
      mat-icon { font-size: 14px; width: 14px; height: 14px; margin-right: 2px; }
    }
    .btn-assigner { font-size: 11px; color: #f57f17; min-width: 0; height: 28px; padding: 0 8px;
      mat-icon { font-size: 14px; width: 14px; height: 14px; margin-right: 2px; }
    }
    .btn-suppr { color: #c62828; min-width: 0; width: 28px; height: 28px; padding: 0;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .notif-done { font-size: 11px; color: #4caf50; margin-top: 4px; display: flex; align-items: center; gap: 3px;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }
  `]
})
export class NotificationsBellComponent {
  notifSvc = inject(NotificationService);
  auth     = inject(AuthService);
  private router = inject(Router);

  filterMode = signal<'all' | 'unread' | 'treated'>('all');

  allNotifications = computed(() => {
    const all = this.notifSvc.getAll();
    if (this.auth.isSupport()) {
      return all.filter(n => ['prise_en_charge', 'signalement_panne', 'planning_assigne'].includes(n.type));
    }
    if (this.auth.isTechnicien() || this.auth.isChauffeur()) {
      return all.filter(n => ['intervention_assignee', 'mission_assignee', 'planning_assigne'].includes(n.type));
    }
    return all;
  });

  unreadCount  = computed(() => this.allNotifications().filter(n => n.statut === 'non_lue').length);
  treatedCount = computed(() => this.allNotifications().filter(n => n.statut === 'traitée').length);

  notifications = computed(() => {
    const all  = this.allNotifications();
    const mode = this.filterMode();
    if (mode === 'unread')  return all.filter(n => n.statut === 'non_lue');
    if (mode === 'treated') return all.filter(n => n.statut === 'traitée');
    return all;
  });

  onOpen(): void {
    this.notifSvc.markAllLue();
  }

  markAll(): void {
    this.notifSvc.markAllLue();
  }

  clearTreated(): void {
    const treated = this.allNotifications().filter(n => n.statut === 'traitée');
    for (const n of treated) this.notifSvc.delete(n.id);
    if (this.filterMode() === 'treated') this.filterMode.set('all');
  }

  traiter(n: AgentNotif): void {
    this.notifSvc.markTraitee(n.id);
  }

  assigner(n: AgentNotif): void {
    this.router.navigate(['/support/assign'], { queryParams: { agentId: n.agentId, description: n.message, photoUrl: n.photoUrl, notifId: n.id } });
  }

  openPhoto(url: string, event: Event): void {
    event.stopPropagation();
    window.open(url, '_blank');
  }

  suppr(n: AgentNotif): void {
    this.notifSvc.delete(n.id);
  }
}
