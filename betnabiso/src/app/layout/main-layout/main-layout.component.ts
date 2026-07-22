import { Component, OnInit, OnDestroy, inject, computed, signal, HostListener } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';
import { ChatPanelComponent } from '../chat-panel/chat-panel.component';
import { RequestsTickerComponent } from '../requests-ticker/requests-ticker.component';
import { ChatService } from '../../core/services/chat.service';
import { LayoutService } from '../../core/services/layout.service';
import { SseService } from '../../core/services/sse.service';
import { PresenceService } from '../../core/services/presence.service';
import { PushNotificationService } from '../../core/services/push-notification.service';
import { InterventionService } from '../../core/services/intervention.service';
import { AuthService } from '../../core/services/auth.service';
import { InactivityService } from '../../core/services/inactivity.service';
import { SoundService } from '../../core/services/sound.service';
import { MissionService } from '../../core/services/mission.service';
import { LoadingService } from '../../core/services/loading.service';
import { ShortcutsService } from '../../core/services/shortcuts.service';
import { filter } from 'rxjs/operators';
import { Subscription, fromEvent } from 'rxjs';
import { LocationService } from '../../core/services/location.service';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent, ChatPanelComponent, RequestsTickerComponent, MatIconModule, MatButtonModule, MatProgressBarModule],
  template: `
    <div class="layout" (keydown)="shortcutsSvc.handle($event)" tabindex="-1">
      <!-- Keyboard shortcuts help overlay -->
      @if (showShortcuts()) {
        <div class="shortcuts-overlay" (click)="showShortcuts.set(false)">
          <div class="shortcuts-panel" (click)="$event.stopPropagation()">
            <div class="shortcuts-header">
              <mat-icon>keyboard</mat-icon>
              <span>Raccourcis clavier</span>
              <button mat-icon-button (click)="showShortcuts.set(false)"><mat-icon>close</mat-icon></button>
            </div>
            <div class="shortcuts-list">
              @for (sc of shortcutsSvc.shortcuts; track sc.label) {
                <div class="shortcut-row">
                  <span class="shortcut-label">{{ sc.label.split('—')[1]?.trim() }}</span>
                  <div class="key-combo">
                    @for (k of sc.keys; track k; let last = $last) {
                      <kbd>{{ k.toUpperCase() }}</kbd>
                      @if (!last) { <span>puis</span> }
                    }
                  </div>
                </div>
              }
            </div>
            <p class="shortcuts-tip">Appuie sur <kbd>?</kbd> pour ouvrir/fermer cette aide</p>
          </div>
        </div>
      }
      <app-sidebar></app-sidebar>
      @if (layoutSvc.sidebarOpen()) {
        <div class="sidebar-backdrop" (click)="layoutSvc.close()"></div>
      }
      <div class="layout-body">
        <app-header></app-header>
        <app-requests-ticker></app-requests-ticker>

        @if (loadingSvc.loading()) {
          <mat-progress-bar mode="indeterminate" class="global-loader"></mat-progress-bar>
        }

        @if (inactivitySvc.remainingSeconds() <= 120) {
          <div class="session-banner" [class.critical]="inactivitySvc.remainingSeconds() <= 30">
            <mat-icon>timer</mat-icon>
            <span>Session expire dans <strong>{{ countdown() }}</strong></span>
            <button mat-stroked-button class="extend-btn" (click)="inactivitySvc.extend()">
              <mat-icon>refresh</mat-icon> Continuer la session
            </button>
          </div>
        }

        <main class="layout-content">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
    <app-chat-panel></app-chat-panel>
  `,
  styles: [`
    .layout {
      display: flex;
      min-height: 100vh;
    }

    .layout-body {
      margin-left: var(--sidebar-width);
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      transition: margin-left 0.3s ease;
    }

    .layout-content {
      flex: 1;
      overflow-y: auto;
      background: var(--bg);
      /* Réserve un espace vide en bas de CHAQUE page pour que le bouton de
         messagerie (fixe, bas-droite) ne recouvre jamais du contenu réel,
         quelle que soit la longueur de la page. */
      padding-bottom: 100px;
    }
    @media (max-width: 640px) {
      .layout-content { padding-bottom: 76px; }
    }

    .sidebar-backdrop {
      display: none;
      position: fixed;
      top: var(--header-height);
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.45);
      z-index: 99;
      touch-action: none;
      overscroll-behavior: contain;
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    @media (max-width: 1024px) {
      .layout-body { margin-left: 0; }
      .sidebar-backdrop { display: block; }
    }

    .global-loader {
      position: sticky;
      top: var(--header-height);
      z-index: 60;
      height: 3px;
    }

    .session-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 20px;
      background: #fff8e1;
      color: #e65100;
      border-bottom: 2px solid #ffcc02;
      font-size: 13px;
      font-weight: 500;
      position: sticky;
      top: var(--header-height);
      z-index: 50;

      mat-icon { font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }

      strong {
        font-weight: 800;
        font-size: 15px;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.5px;
      }

      .extend-btn { margin-left: auto; }

      &.critical {
        background: #ffebee;
        color: #c62828;
        border-color: #ef9a9a;
        animation: criticalPulse 0.9s ease-in-out infinite;
      }
    }

    @keyframes criticalPulse {
      0%, 100% { background: #ffebee; }
      50%       { background: #fce4ec; }
    }

    /* ── Keyboard shortcuts overlay ─────────── */
    .shortcuts-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.5);
      z-index: 9999; display: flex; align-items: center; justify-content: center;
      animation: fadeIn .15s ease;
    }
    .shortcuts-panel {
      background: #fff; border-radius: 14px; padding: 0; width: 460px; max-width: 95vw;
      box-shadow: 0 20px 60px rgba(0,0,0,.3); overflow: hidden;
    }
    .shortcuts-header {
      display: flex; align-items: center; gap: 10px; padding: 16px 20px;
      background: var(--primary, #1a3a5c); color: #fff;
      mat-icon { font-size: 20px; }
      span { flex: 1; font-weight: 700; font-size: 15px; }
      button { color: rgba(255,255,255,.7); &:hover { color: #fff; } }
    }
    .shortcuts-list { padding: 12px 20px; display: flex; flex-direction: column; gap: 4px; }
    .shortcut-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 7px 10px; border-radius: 6px;
      &:hover { background: #f5f7fa; }
    }
    .shortcut-label { font-size: 13px; color: #1a2035; }
    .key-combo { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #78909c; }
    kbd {
      background: #f0f4f8; border: 1px solid #c9d0da; border-radius: 4px;
      padding: 2px 7px; font-family: monospace; font-size: 12px; font-weight: 700; color: #1a3a5c;
    }
    .shortcuts-tip {
      text-align: center; font-size: 11px; color: #90a4ae; padding: 10px 20px 16px;
      border-top: 1px solid #f0f4f8; margin: 0;
      kbd { font-size: 11px; }
    }
  `]
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  layoutSvc      = inject(LayoutService);
  inactivitySvc  = inject(InactivityService);
  loadingSvc     = inject(LoadingService);
  shortcutsSvc   = inject(ShortcutsService);
  showShortcuts  = signal(false);

  private router          = inject(Router);
  private sseSvc          = inject(SseService);
  private presenceSvc     = inject(PresenceService);
  private pushSvc         = inject(PushNotificationService);
  private chatSvc         = inject(ChatService);
  private interventionSvc = inject(InterventionService);
  private missionSvc      = inject(MissionService);
  private soundSvc        = inject(SoundService);
  private auth            = inject(AuthService);
  private locationSvc     = inject(LocationService);
  private subs            = new Subscription();

  // IDs déjà notifiés — évite de rejouer le son au prochain polling
  private soundedMsgIds     = new Set<string>();
  private soundedMissionIds = new Set<string>();

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag)) return;
    if (e.key === '?' || e.key === '/') { e.preventDefault(); this.showShortcuts.update(v => !v); return; }
    if (e.key === 'Escape') { this.showShortcuts.set(false); return; }
    this.shortcutsSvc.handle(e);
  }

  countdown = computed(() => {
    const s = this.inactivitySvc.remainingSeconds();
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  });

  ngOnInit(): void {
    this.subs.add(
      fromEvent(window, 'resize').subscribe(() => {
        if (window.innerWidth > 1024) this.layoutSvc.close();
      })
    );

    // Close sidebar on any route change (mobile overlay stays closed between pages)
    this.subs.add(
      this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
        if (window.innerWidth <= 1024) this.layoutSvc.close();
      })
    );

    this.inactivitySvc.start();
    this.soundSvc.init();
    this.sseSvc.connect();
    this.presenceSvc.start();
    this.pushSvc.requestPermission();

    // Géolocalisation — techniciens seulement
    const role = this.auth.role();
    if (role === 'technicien' || role === 'admin' || role === 'superadmin') {
      this.locationSvc.startTracking();
    }

    // Notif + son sur nouveau message chat (dédupliqué par ID)
    this.subs.add(
      this.sseSvc.messageEvents$.subscribe(() => {
        const myId = this.auth.currentUser()?.id;
        const newMsgs = this.chatSvc.getMessages().filter(
          m => m.toId === myId && !m.readAt && !this.soundedMsgIds.has(m.id)
        );
        for (const m of newMsgs) this.soundedMsgIds.add(m.id);
        if (newMsgs.length > 0) {
          this.soundSvc.playMessage();
          this.pushSvc.notifyMessage(newMsgs[0].fromNom, newMsgs[0].content);
        }
      })
    );

    // Notif + son sur nouvelle intervention assignée
    this.subs.add(
      this.sseSvc.dataUpdate$.pipe(filter(t => t === 'interventions')).subscribe(() => {
        const user = this.auth.currentUser();
        if (user?.role !== 'technicien') return;
        const latest = this.interventionSvc.getAll()
          .filter(i => i.statut === 'Assignée')
          .sort((a, b) => (b.assignedAt ?? '').localeCompare(a.assignedAt ?? ''))
          .at(0);
        if (latest?.assignedAt) {
          const age = Date.now() - new Date(latest.assignedAt).getTime();
          if (age < 30_000) {
            this.soundSvc.playIntervention();
            this.pushSvc.notifyIntervention(latest.agentNom, latest.type);
          }
        }
      })
    );

    // Son sur nouvelle mission interne assignée (dédupliqué par ID)
    this.subs.add(
      this.sseSvc.dataUpdate$.pipe(filter(t => t === 'interventions')).subscribe(() => {
        const user = this.auth.currentUser();
        if (!user) return;
        const newMissions = this.missionSvc.getByUser(user.id).filter(m => {
          if (this.soundedMissionIds.has(m.id)) return false;
          const age = Date.now() - new Date(m.createdAt).getTime();
          return age < 30_000;
        });
        for (const m of newMissions) this.soundedMissionIds.add(m.id);
        if (newMissions.length > 0) this.soundSvc.playMission();
      })
    );
  }

  ngOnDestroy(): void {
    this.inactivitySvc.stop();
    this.sseSvc.disconnect();
    this.presenceSvc.stop();
    this.locationSvc.stopTracking();
    this.subs.unsubscribe();
  }
}
