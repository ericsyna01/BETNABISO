import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { AgentNotif } from '../../core/models/notification.model';

@Component({
  selector: 'app-requests-ticker',
  standalone: true,
  imports: [MatIconModule],
  template: `
    @if (visible()) {
      <div class="ticker-bar">
        <div class="ticker-label">
          <mat-icon>campaign</mat-icon> {{ items().length }} demande(s) en attente
        </div>
        <div class="ticker-track">
          <div class="ticker-content">
            @for (n of items(); track n.id) {
              <span class="ticker-item" (click)="goTo(n)">
                <mat-icon>{{ icon(n) }}</mat-icon>
                {{ label(n) }}
              </span>
            }
            <!-- copie dupliquée pour une boucle continue sans coupure -->
            @for (n of items(); track 'dup-' + n.id) {
              <span class="ticker-item" (click)="goTo(n)" aria-hidden="true">
                <mat-icon>{{ icon(n) }}</mat-icon>
                {{ label(n) }}
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
    @keyframes ticker-scroll {
      from { transform: translateX(0); }
      to   { transform: translateX(-50%); }
    }
    @media (prefers-reduced-motion: reduce) {
      .ticker-content { animation: none; }
      .ticker-track { overflow-x: auto; }
    }
  `]
})
export class RequestsTickerComponent {
  private notifSvc = inject(NotificationService);
  private router    = inject(Router);
  auth = inject(AuthService);

  items = computed(() => {
    if (!this.auth.isAdmin() && !this.auth.isSuperadmin()) return [];
    return this.notifSvc.getAll().filter(n =>
      (n.type === 'agent_modification' || n.type === 'deplacement_requis') && n.statut !== 'traitée'
    );
  });

  visible = computed(() => this.items().length > 0);

  icon(n: AgentNotif): string {
    return n.type === 'deplacement_requis' ? 'directions_car' : 'edit_note';
  }

  label(n: AgentNotif): string {
    const who = n.requestedByNom ? `${n.requestedByNom} — ` : '';
    return `${who}${n.message}`;
  }

  goTo(n: AgentNotif): void {
    if (n.type === 'agent_modification' && n.agentId) {
      this.router.navigate(['/agents', n.agentId]);
    } else if (n.type === 'deplacement_requis') {
      this.router.navigate(['/support']);
    }
  }
}
