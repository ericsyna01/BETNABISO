import { Component, computed, inject, signal, HostListener, ElementRef, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';
import { LayoutService } from '../../core/services/layout.service';
import { AgentService } from '../../core/services/agent.service';
import { InterventionService } from '../../core/services/intervention.service';
import { MissionService } from '../../core/services/mission.service';
import { ThemeService } from '../../core/services/theme.service';
import { ChatUiService } from '../../core/services/chat-ui.service';
import { ChatService } from '../../core/services/chat.service';
import { GroupChatService } from '../../core/services/group-chat.service';
import { NotificationsBellComponent } from '../notifications-bell/notifications-bell.component';

interface SearchResult {
  type: 'agent' | 'intervention' | 'mission';
  id: string;
  label: string;
  sub: string;
  route: string[];
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, FormsModule, MatIconModule, MatButtonModule, MatMenuModule, MatDividerModule, MatTooltipModule, NotificationsBellComponent],
  template: `
    <header class="header">
      <div class="header-left">
        <button class="hamburger-btn" mat-icon-button (click)="layoutSvc.toggle()" aria-label="Menu">
          <mat-icon>menu</mat-icon>
        </button>

        <!-- Global search -->
        <div class="search-wrap" (click)="$event.stopPropagation()">
          <mat-icon class="search-icon">search</mat-icon>
          <input
            class="search-input"
            type="text"
            placeholder="Rechercher agents, interventions…"
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
            (focus)="searchOpen.set(true)"
            (input)="searchOpen.set(true)"
            autocomplete="off">
          @if (searchQuery()) {
            <button class="search-clear" mat-icon-button (click)="clearSearch()">
              <mat-icon>close</mat-icon>
            </button>
          }

          @if (searchOpen() && searchQuery().trim().length >= 2) {
            <div class="search-dropdown">
              @if (results().length === 0) {
                <div class="search-empty">
                  <mat-icon>search_off</mat-icon> Aucun résultat
                </div>
              } @else {
                @for (r of results(); track r.id) {
                  <div class="search-result" (click)="navigate(r)">
                    <mat-icon class="result-icon {{ r.type }}">
                      {{ r.type === 'agent' ? 'person' : r.type === 'mission' ? 'task_alt' : 'assignment' }}
                    </mat-icon>
                    <div class="result-text">
                      <div class="result-label">{{ r.label }}</div>
                      <div class="result-sub">{{ r.sub }}</div>
                    </div>
                    <span class="result-badge {{ r.type }}">
                      {{ r.type === 'agent' ? 'Agent' : r.type === 'mission' ? 'Mission' : 'Intervention' }}
                    </span>
                  </div>
                }
              }
            </div>
          }
        </div>

        <div class="clock-widget" matTooltip="Heure locale">
          <mat-icon>schedule</mat-icon>
          <span class="clock-time">{{ clockTime() }}</span>
          <span class="clock-date">{{ clockDate() }}</span>
        </div>
      </div>

      <div class="header-right">
        <button mat-icon-button (click)="themeSvc.toggle()" [matTooltip]="themeSvc.dark() ? 'Mode clair' : 'Mode sombre'" class="theme-btn">
          <mat-icon>{{ themeSvc.dark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
        </button>

        <div class="chat-btn-wrap">
          <button mat-icon-button (click)="chatUi.toggle()" matTooltip="Messages">
            <mat-icon>chat</mat-icon>
          </button>
          @if (chatUnread() > 0) {
            <span class="chat-badge">{{ chatUnread() > 99 ? '99+' : chatUnread() }}</span>
          }
        </div>

        <app-notifications-bell></app-notifications-bell>

        <button mat-button [matMenuTriggerFor]="userMenu" class="user-btn">
          <div class="avatar">{{ initials() }}</div>
          <div class="user-info-header">
            <span class="user-name-header">{{ fullName() }}</span>
            <span class="user-role-header">{{ roleLabel() }}</span>
          </div>
          <mat-icon class="chevron-icon">keyboard_arrow_down</mat-icon>
        </button>

        <mat-menu #userMenu="matMenu" class="user-menu" xPosition="before">
          <div class="menu-header">
            <div class="menu-avatar">{{ initials() }}</div>
            <div class="menu-user-info">
              <div class="menu-name">{{ fullName() }}</div>
              <div class="menu-email">{{ user()?.email }}</div>
              @for (r of userRoles(); track r) {
                <span class="menu-role-badge {{ r }}">{{ roleLabels[r] ?? r }}</span>
              }
            </div>
          </div>
          <mat-divider></mat-divider>
          <button mat-menu-item routerLink="/profile">
            <mat-icon>manage_accounts</mat-icon> Mon profil
          </button>
          <button mat-menu-item routerLink="/dashboard">
            <mat-icon>dashboard</mat-icon> Tableau de bord
          </button>
          <mat-divider></mat-divider>
          <button mat-menu-item (click)="logout()" class="logout-btn">
            <mat-icon>power_settings_new</mat-icon> Déconnexion
          </button>
        </mat-menu>
      </div>
    </header>
  `,
  styles: [`
    .header {
      height: var(--header-height);
      background: white;
      border-bottom: 1px solid #edf0f7;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px 0 0;
      box-shadow: 0 1px 8px rgba(0,0,0,0.06);
      position: sticky;
      top: 0;
      z-index: 110;
    }

    /* ── Gauche ── */
    .header-left {
      display: flex;
      align-items: center;
      gap: 0;
      height: 100%;
      flex: 1;
    }

    .hamburger-btn {
      display: none;
      color: #4a5568;
      margin: 0 4px 0 8px;
    }
    @media (max-width: 1024px) {
      .hamburger-btn { display: flex; }
      .header-brand { padding-left: 0; }
    }

    /* ── Horloge ── */
    .clock-widget {
      display: flex; align-items: baseline; gap: 6px;
      margin-left: 16px; padding: 0 4px; flex-shrink: 0; white-space: nowrap;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: var(--text-secondary); align-self: center; }
    }
    .clock-time { font-size: 13px; font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; }
    .clock-date { font-size: 11px; color: var(--text-secondary); text-transform: capitalize; }
    @media (max-width: 700px) {
      .clock-date { display: none; }
    }
    @media (max-width: 560px) {
      .clock-widget { display: none; }
    }

    /* ── Search ── */
    .search-wrap {
      position: relative;
      display: flex;
      align-items: center;
      flex: 1;
      max-width: 460px;
      margin-left: 12px;
    }

    .search-icon {
      position: absolute;
      left: 10px;
      color: #94a3b8;
      font-size: 20px;
      width: 20px;
      height: 20px;
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      height: 38px;
      border: 1.5px solid #e2e8f0;
      border-radius: 20px;
      padding: 0 36px 0 36px;
      font-size: 13px;
      color: #1a2742;
      background: #f8fafc;
      outline: none;
      transition: border-color 0.2s, background 0.2s;
      &:focus {
        border-color: #d4af37;
        background: white;
        box-shadow: 0 0 0 3px rgba(212,175,55,0.15);
      }
      &::placeholder { color: #b0bec5; }
    }

    .search-clear {
      position: absolute;
      right: 2px;
      width: 30px;
      height: 30px;
      mat-icon { font-size: 16px; color: #94a3b8; }
    }

    .search-dropdown {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      right: 0;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.14);
      border: 1px solid #e2e8f0;
      overflow: hidden;
      z-index: 200;
      max-height: 360px;
      overflow-y: auto;
    }

    .search-empty {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 18px 16px;
      color: #94a3b8;
      font-size: 13px;
      mat-icon { font-size: 18px; color: #b0bec5; }
    }

    .search-result {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      cursor: pointer;
      transition: background 0.15s;
      &:hover { background: #f0f4f8; }
      & + & { border-top: 1px solid #f0f4f8; }
    }

    .result-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      &.agent { color: #2a5fa0; }
      &.intervention { color: #e65100; }
      &.mission { color: #6d28d9; }
    }

    .result-text { flex: 1; min-width: 0; }
    .result-label { font-weight: 600; font-size: 13px; color: #1a2742; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .result-sub { font-size: 11px; color: #8492a6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }

    .result-badge {
      font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 8px;
      text-transform: uppercase; letter-spacing: 0.3px; flex-shrink: 0;
      &.agent { background: #e3f2fd; color: #0d47a1; }
      &.intervention { background: #fff3e0; color: #e65100; }
      &.mission { background: #ede9fe; color: #6d28d9; }
    }

    @media (max-width: 640px) {
      .search-wrap { max-width: 160px; }
      .search-input { font-size: 12px; }
    }

    /* ── Droite ── */
    .header-right {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    /* ── Chat trigger ── */
    .chat-btn-wrap { position: relative; display: inline-flex; }
    .chat-badge {
      position: absolute; top: 4px; right: 4px;
      min-width: 16px; height: 16px;
      background: #e53935; color: white;
      border-radius: 8px;
      font-size: 10px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      padding: 0 3px;
      pointer-events: none;
      border: 2px solid white;
    }

    /* ── User button ── */
    .user-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 44px;
      padding: 0 10px;
      border-radius: 10px;
      transition: background 0.2s;
      &:hover { background: #f0f4f8 !important; }
    }

    .avatar {
      width: 34px;
      height: 34px;
      background: linear-gradient(135deg, #3a2f1f, #000000);
      border: 1.5px solid rgba(212,175,55,0.5);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      color: #d4af37;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }

    .user-info-header {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      line-height: 1;
    }

    .user-name-header {
      font-size: 13px;
      font-weight: 600;
      color: #1a2742;
    }

    .user-role-header {
      font-size: 10px;
      color: #94a3b8;
      margin-top: 2px;
      text-transform: capitalize;
    }

    .chevron-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #94a3b8;
    }

    @media (max-width: 600px) {
      .user-info-header { display: none; }
      .chevron-icon { display: none; }
    }

    /* ── Dropdown menu ── */
    .menu-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      min-width: 240px;
    }

    .menu-avatar {
      width: 42px;
      height: 42px;
      background: linear-gradient(135deg, #3a2f1f, #000000);
      border: 1.5px solid rgba(212,175,55,0.5);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      font-weight: 700;
      color: #d4af37;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    }

    .menu-user-info { display: flex; flex-direction: column; gap: 2px; }
    .menu-name  { font-weight: 700; font-size: 14px; color: #1a2742; }
    .menu-email { font-size: 11.5px; color: #8492a6; }

    .menu-role-badge {
      display: inline-block; font-size: 10px; font-weight: 700;
      padding: 2px 8px; border-radius: 10px; margin-top: 2px;
      text-transform: uppercase; letter-spacing: 0.5px;
      &.superadmin { background: #ede7f6; color: #4527a0; }
      &.admin      { background: #e3f2fd; color: #0d47a1; }
      &.support    { background: #fff8e1; color: #e65100; }
      &.technicien { background: #e0f2f1; color: #00695c; }
      &.chauffeur  { background: #fff9c4; color: #f57f17; }
    }

    .logout-btn { color: #dc2626 !important; mat-icon { color: #dc2626 !important; } }

    @media (max-width: 640px) {
      /* Le panneau CDK est positionné en JS relatif au bouton avatar ; sur un
         écran étroit "xPosition=before" le pousse hors champ à gauche.
         On le repositionne en fixe pour qu'il reste toujours dans l'écran. */
      ::ng-deep .user-menu {
        position: fixed !important;
        top: 58px !important;
        left: 8px !important;
        right: 8px !important;
        transform: none !important;
      }
      ::ng-deep .user-menu .mat-mdc-menu-panel {
        width: auto !important;
        max-width: none !important;
        max-height: calc(100vh - 90px) !important;
      }
      ::ng-deep .user-menu .menu-header { min-width: 0; }
    }
  `]
})
export class HeaderComponent implements OnInit, OnDestroy {
  private auth            = inject(AuthService);
  private agentSvc        = inject(AgentService);
  private interventionSvc = inject(InterventionService);
  private missionSvc      = inject(MissionService);
  private router          = inject(Router);
  private el              = inject(ElementRef);

  layoutSvc = inject(LayoutService);
  themeSvc  = inject(ThemeService);
  chatUi    = inject(ChatUiService);
  private chatSvc  = inject(ChatService);
  private groupSvc = inject(GroupChatService);

  chatUnread = computed(() => this.chatSvc.unreadCount() + this.groupSvc.totalUnread());
  user      = this.auth.currentUser;
  userRoles  = computed(() => this.auth.roles());
  roleLabels: Record<string, string> = {
    superadmin: 'Super Admin', admin: 'Admin',
    support: 'Support', technicien: 'Technicien', chauffeur: 'Chauffeur'
  };

  searchQuery = signal('');
  searchOpen  = signal(false);

  clockTime = signal('');
  clockDate = signal('');
  private clockTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.updateClock();
    this.clockTimer = setInterval(() => this.updateClock(), 1000);
  }

  ngOnDestroy(): void {
    if (this.clockTimer) clearInterval(this.clockTimer);
  }

  private updateClock(): void {
    const now = new Date();
    this.clockTime.set(now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    this.clockDate.set(now.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' }));
  }

  @HostListener('document:click')
  onDocClick() { this.searchOpen.set(false); }

  results = computed((): SearchResult[] => {
    const q = this.searchQuery().toLowerCase().trim();
    if (q.length < 2) return [];

    const agents = this.agentSvc.getAll()
      .filter(a =>
        a.nomAgent.toLowerCase().includes(q) ||
        (a.identifiant ?? '').toLowerCase().includes(q) ||
        (a.zone ?? '').toLowerCase().includes(q)
      )
      .slice(0, 5)
      .map((a): SearchResult => ({
        type: 'agent', id: a.id,
        label: a.nomAgent,
        sub: `${a.identifiant ?? ''} · ${a.zone ?? ''}`.trim().replace(/^·\s*|·\s*$/, '').trim(),
        route: ['/agents', a.id]
      }));

    const interventions = this.interventionSvc.getAll()
      .filter(i =>
        i.agentNom.toLowerCase().includes(q) ||
        i.type.toLowerCase().includes(q) ||
        i.technicienNom.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q)
      )
      .slice(0, 5)
      .map((i): SearchResult => ({
        type: 'intervention', id: i.id,
        label: i.agentNom,
        sub: `${i.type} · ${i.statut} · ${i.technicienNom}`,
        route: ['/interventions']
      }));

    const missions = this.missionSvc.getAll()
      .filter(m =>
        m.titre.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.type.toLowerCase().includes(q)
      )
      .slice(0, 4)
      .map((m): SearchResult => ({
        type: 'mission', id: m.id,
        label: m.titre,
        sub: `${m.type} · ${m.statut}`,
        route: ['/missions']
      }));

    return [...agents, ...interventions, ...missions];
  });

  navigate(r: SearchResult): void {
    this.router.navigate(r.route);
    this.clearSearch();
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchOpen.set(false);
  }

  fullName = computed(() => {
    const u = this.user();
    return u ? `${u.prenom} ${u.nom}` : '';
  });

  initials = computed(() => {
    const u = this.user();
    return u ? `${u.prenom[0]}${u.nom[0]}`.toUpperCase() : '';
  });

  roleLabel = computed(() => {
    const map: Record<string, string> = {
      superadmin: 'Super Admin', admin: 'Admin',
      support: 'Support', technicien: 'Technicien', chauffeur: 'Chauffeur'
    };
    return map[this.user()?.role ?? ''] ?? '';
  });

  logout() { this.auth.logout(); }
}
