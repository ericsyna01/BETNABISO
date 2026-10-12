import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';
import { PresenceService } from '../../core/services/presence.service';
import { LayoutService } from '../../core/services/layout.service';
import { MissionService } from '../../core/services/mission.service';
import { InterventionService } from '../../core/services/intervention.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles?: string[];
  group: string;
}

interface NavEntry extends NavItem {
  showGroup: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
    <aside class="sidebar" [class.open]="layoutSvc.sidebarOpen()">
      <div class="sidebar-logo" (click)="refresh()" style="cursor:pointer">
        <img src="logo.png" alt="BETNABISO" class="logo-img">
        <div class="logo-text">
          <span class="logo-name">BETNABISO</span>
          <span class="logo-sub">Gestion des Interventions</span>
        </div>
        <button class="close-btn" mat-icon-button (click)="layoutSvc.close()" aria-label="Fermer le menu">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <nav class="sidebar-nav">
        @for (item of visibleItems(); track item.route) {
          @if (item.showGroup) {
            <div class="nav-group-label">{{ item.group }}</div>
          }
          <a class="nav-item" [routerLink]="item.route" routerLinkActive="active"
             (click)="layoutSvc.close()">
            <mat-icon>{{ item.icon }}</mat-icon>
            <span>{{ item.label }}</span>
            @if (item.route === '/missions' && missionCount() > 0) {
              <span class="nav-badge">{{ missionCount() }}</span>
            }
            @if ((item.route === '/interventions' || item.route === '/support') && interventionCount() > 0) {
              <span class="nav-badge warn">{{ interventionCount() }}</span>
            }
            @if ((item.route === '/interventions' || item.route === '/support') && signalementCount() > 0) {
              <mat-icon class="nav-badge-icon" matTooltip="Intervention(s) issue(s) d'un signalement en attente">qr_code_2</mat-icon>
            }
          </a>
        }
      </nav>

      <!-- Indicateur utilisateurs en ligne -->
      @if (presenceSvc.onlineCount() > 0) {
        <div class="online-banner">
          <span class="online-pulse"></span>
          <span>{{ presenceSvc.onlineCount() }} utilisateur{{ presenceSvc.onlineCount() > 1 ? 's' : '' }} en ligne</span>
        </div>
      }

      <div class="sidebar-user">
        <div class="avatar-online-wrap">
          <div class="user-avatar">{{ initials() }}</div>
          <span class="me-online-dot"></span>
        </div>
        <div class="user-info">
          <span class="user-name">{{ fullName() }}</span>
          @for (r of auth.roles(); track r) {
            <span class="role-badge {{ r }}">{{ r }}</span>
          }
        </div>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: var(--sidebar-width);
      height: 100vh;
      height: 100dvh;
      background: linear-gradient(180deg, #000000 0%, #1a1409 100%);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      position: fixed;
      left: 0;
      top: 0;
      z-index: 100;
      box-shadow: 4px 0 20px rgba(0,0,0,0.15);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .close-btn {
      display: none;
      color: rgba(255,255,255,0.7);
      margin-left: auto;
      flex-shrink: 0;
      &:hover { color: white; }
    }

    @media (max-width: 1024px) {
      .sidebar {
        width: min(280px, 85vw);
        top: var(--header-height);
        height: calc(100vh - var(--header-height));
        height: calc(100dvh - var(--header-height));
        transform: translateX(-100%);
        z-index: 200;
        &.open { transform: translateX(0); }
      }
      .close-btn { display: flex; }
      .sidebar-logo { padding: 14px 16px; }
    }

    .sidebar-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 18px 16px;
      border-bottom: 1px solid rgba(212,175,55,0.14);
    }

    .logo-img {
      width: 28px;
      height: 28px;
      object-fit: contain;
      flex-shrink: 0;
      border-radius: 5px;
    }

    .logo-name {
      display: block;
      font-family: Georgia, "Iowan Old Style", ui-serif, serif;
      font-size: 13px;
      font-weight: 600;
      color: #f2e9d0;
      letter-spacing: 1.4px;
    }

    .logo-sub {
      display: block;
      font-size: 9px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: rgba(212,175,55,0.55);
      margin-top: 2px;
    }

    .sidebar-nav {
      flex: 1;
      min-height: 0;
      padding: 8px 8px 16px;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
      touch-action: pan-y;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    /* Group separator label */
    .nav-group-label {
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.4px;
      color: rgba(212,175,55,0.32);
      padding: 16px 14px 5px;
      margin-top: 2px;
      user-select: none;
      &:first-child { padding-top: 8px; }
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 9px 14px 9px 17px;
      position: relative;
      color: rgba(255,255,255,0.6);
      text-decoration: none;
      font-size: 13.5px;
      font-weight: 500;
      transition: color 0.2s;
      cursor: pointer;

      &::before {
        content: '';
        position: absolute;
        left: 0; top: 5px; bottom: 5px; width: 3px;
        border-radius: 0 2px 2px 0;
        background: transparent;
        transition: background 0.2s;
      }

      mat-icon {
        font-size: 19px;
        width: 19px;
        height: 19px;
        flex-shrink: 0;
        opacity: 0.75;
      }

      &:hover {
        color: white;
        mat-icon { opacity: 1; }
      }

      &.active {
        color: #f2e9d0;
        background: linear-gradient(90deg, rgba(212,175,55,0.08), transparent);
        &::before { background: #d4af37; }
        mat-icon { opacity: 1; color: #d4af37; }
      }
    }

    .nav-badge {
      margin-left: auto;
      font-family: ui-monospace, "SF Mono", "Cascadia Code", monospace;
      font-variant-numeric: tabular-nums;
      background: none;
      color: #d4af37;
      font-size: 11px;
      font-weight: 700;
      flex-shrink: 0;
      &.warn { color: #ff9e4a; }
    }
    @keyframes pulse-badge {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.15); }
    }

    .nav-badge-icon {
      margin-left: auto;
      flex-shrink: 0;
      font-size: 16px !important;
      width: 16px !important;
      height: 16px !important;
      color: #ffb74d;
      animation: pulse-badge 2s infinite;
    }

    /* ── Bandeau utilisateurs en ligne ──── */
    .online-banner {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 8px 16px;
      border-top: 1px solid rgba(212,175,55,0.1);
      font-size: 11px;
      color: rgba(255,255,255,0.5);
      font-weight: 500;
      flex-shrink: 0;
    }

    .online-pulse {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #4caf50;
      flex-shrink: 0;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%   { box-shadow: 0 0 0 0 rgba(76,175,80,0.6); }
      70%  { box-shadow: 0 0 0 5px rgba(76,175,80,0); }
      100% { box-shadow: 0 0 0 0 rgba(76,175,80,0); }
    }

    .sidebar-user {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      border-top: 1px solid rgba(212,175,55,0.14);
      flex-shrink: 0;
    }

    .avatar-online-wrap {
      position: relative;
      flex-shrink: 0;
    }

    .me-online-dot {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #5fae6b;
      border: 2px solid #1a1409;
    }

    .user-avatar {
      width: 30px;
      height: 30px;
      background: linear-gradient(135deg, #3a2f1f, #000000);
      border: 1.5px solid rgba(212,175,55,0.5);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11.5px;
      font-weight: 700;
      color: #d4af37;
    }

    .user-name {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #f2e9d0;
    }

    .role-badge {
      display: inline-block;
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 3px;
      font-weight: 600;
      text-transform: uppercase;
      margin-top: 2px;
      &.superadmin { background: rgba(149,117,205,0.3); color: #ce93d8; }
      &.admin { background: rgba(100,181,246,0.3); color: #90caf9; }
      &.support { background: rgba(255,183,77,0.3); color: #ffb74d; }
      &.technicien { background: rgba(77,182,172,0.3); color: #80cbc4; }
      &.chauffeur  { background: rgba(255,183,0,0.3); color: #ffd54f; }
    }
  `]
})
export class SidebarComponent {
  auth                    = inject(AuthService);
  private missionSvc      = inject(MissionService);
  private interventionSvc = inject(InterventionService);
  presenceSvc             = inject(PresenceService);
  layoutSvc               = inject(LayoutService);
  user = this.auth.currentUser;

  interventionCount = computed(() => {
    const user = this.auth.currentUser();
    if (!user) return 0;
    const all = this.interventionSvc.getAllRaw();
    if (this.auth.isTechnicien()) {
      return all.filter(i => i.technicienId === user.id && i.statut === 'Assignée').length;
    }
    return all.filter(i => i.statut === 'Assignée').length;
  });

  signalementCount = computed(() => this.interventionSvc.getSignalementPending().length);

  missionCount = computed(() => {
    const user = this.auth.currentUser();
    if (!user) return 0;
    if (this.auth.isAdmin()) {
      return this.missionSvc.getAll().filter(m => !['terminée','refusée'].includes(m.statut)).length;
    }
    return this.missionSvc.getByUser(user.id).filter(m => !['terminée','refusée'].includes(m.statut)).length;
  });

  refresh() { window.location.reload(); }

  fullName = computed(() => {
    const u = this.user();
    return u ? `${u.prenom} ${u.nom}` : '';
  });

  initials = computed(() => {
    const u = this.user();
    return u ? `${u.prenom[0]}${u.nom[0]}`.toUpperCase() : '';
  });

  private navItems: NavItem[] = [
    { label: 'Tableau de bord',          icon: 'dashboard',           route: '/dashboard',         group: 'GÉNÉRAL' },
    { label: 'Agents',                   icon: 'people',              route: '/agents',             group: 'GÉNÉRAL' },
    { label: 'Mon agenda',               icon: 'event_note',          route: '/agenda',             group: 'GÉNÉRAL' },
    /* Support */
    { label: 'Affectations',             icon: 'task_alt',            route: '/support',            roles: ['support', 'superadmin', 'admin'], group: 'INTERVENTIONS' },
    { label: 'Affecter',                 icon: 'add_task',            route: '/support/assign',     roles: ['support', 'superadmin', 'admin'], group: 'INTERVENTIONS' },
    /* Technicien */
    { label: 'Mes interventions',        icon: 'assignment',          route: '/interventions',      roles: ['technicien'],                    group: 'INTERVENTIONS' },
    { label: 'Nouvelle intervention',    icon: 'add_circle',          route: '/interventions/new',  roles: ['technicien'],                    group: 'INTERVENTIONS' },
    /* Admin / Superadmin */
    { label: 'Toutes les interventions', icon: 'assignment',          route: '/interventions',      roles: ['superadmin', 'admin'],           group: 'INTERVENTIONS' },
    { label: 'Rapport',                  icon: 'history',             route: '/history',            roles: ['superadmin', 'admin'],           group: 'INTERVENTIONS' },
    /* Chauffeur */
    { label: 'Mes missions',             icon: 'local_shipping',      route: '/chauffeur',          roles: ['chauffeur'],                     group: 'INTERVENTIONS' },
    /* Planning */
    { label: 'Planning & Rotation',      icon: 'calendar_month',      route: '/planning',           roles: ['superadmin', 'admin', 'support', 'technicien', 'chauffeur'], group: 'PLANNING' },
    /* Admin tools */
    { label: 'Administration',           icon: 'admin_panel_settings', route: '/admin',             roles: ['superadmin', 'admin'],           group: 'ADMINISTRATION' },
    { label: 'Journal d\'audit',         icon: 'security',            route: '/audit',              roles: ['superadmin', 'admin'],           group: 'ADMINISTRATION' },
    { label: 'Carte techniciens',        icon: 'map',                 route: '/geomap',             roles: ['superadmin', 'admin'],           group: 'ADMINISTRATION' },
{ label: 'Missions internes',        icon: 'assignment_ind',      route: '/missions',           roles: ['superadmin', 'admin', 'technicien', 'chauffeur'], group: 'ADMINISTRATION' },
    /* Aide */
    { label: 'Outils & Utilitaires',      icon: 'construction',        route: '/outils',             group: 'AIDE' },
    { label: 'Documentation',            icon: 'menu_book',           route: '/docs',               group: 'AIDE' },
  ];

  visibleItems = computed((): NavEntry[] => {
    const userRoles = this.auth.roles();
    const filtered = this.navItems.filter(item => {
      if (!item.roles) return true;
      return userRoles.some(r => item.roles!.includes(r));
    });
    let lastGroup = '';
    return filtered.map(item => {
      const showGroup = item.group !== lastGroup;
      lastGroup = item.group;
      return { ...item, showGroup };
    });
  });
}
