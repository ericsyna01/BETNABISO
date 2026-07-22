import { Injectable, inject, NgZone, OnDestroy, effect } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { AuthService } from './auth.service';
import { LiveEventsService } from './live-events.service';

// Le service d'événements temps réel (LiveEventsService) est désormais le seul
// chemin normal : tous les types de données (interventions, missions, agents,
// notifications, machine_status, messages) sont poussés instantanément dès
// qu'ils changent côté serveur. Ce polling ne sert plus qu'en tout dernier
// recours si la connexion WebSocket reste indisponible durablement.
const CYCLE_MS = 300_000;
const STAGGER  = 10_000;

@Injectable({ providedIn: 'root' })
export class SseService implements OnDestroy {
  private auth = inject(AuthService);
  private zone = inject(NgZone);
  private liveEvents = inject(LiveEventsService);

  private dataTimer?: ReturnType<typeof setInterval>;
  private msgTimer?:  ReturnType<typeof setInterval>;
  private staggerIds: ReturnType<typeof setTimeout>[] = [];
  private liveSubs: Subscription[] = [];

  readonly dataUpdate$    = new Subject<string>();
  readonly messageEvents$ = new Subject<void>();

  constructor() {
    // Coupe immédiatement la connexion temps réel dès que la session locale
    // est vidée (logout, expiration), sans attendre le prochain cycle de poll.
    effect(() => {
      if (!this.auth.isAuthenticated() && this.dataTimer) this.disconnect();
    });
  }

  connect(): void {
    if (this.dataTimer) return;

    this.liveEvents.connect();
    this.liveSubs.push(
      this.liveEvents.event$.subscribe(type => this.dataUpdate$.next(type)),
      this.liveEvents.message$.subscribe(() => this.messageEvents$.next()),
    );

    const emit = (type: string, delay: number) => {
      const id = setTimeout(() => {
        if (!this.auth.getToken()) return;
        this.zone.run(() => this.dataUpdate$.next(type));
      }, delay);
      this.staggerIds.push(id);
    };

    const cycle = () => {
      if (!this.auth.getToken()) { this.disconnect(); return; }
      emit('interventions',    0);
      emit('missions',         STAGGER);
      emit('agents',           STAGGER * 2);
      emit('notifications',    STAGGER * 3);
      emit('machine_status',   STAGGER * 4);
    };

    cycle(); // premier cycle immédiat au démarrage
    this.dataTimer = setInterval(cycle, CYCLE_MS);

    this.msgTimer = setInterval(() => {
      if (!this.auth.getToken()) return;
      this.zone.run(() => this.messageEvents$.next());
    }, CYCLE_MS);
  }

  disconnect(): void {
    for (const id of this.staggerIds) clearTimeout(id);
    this.staggerIds = [];
    clearInterval(this.dataTimer);
    clearInterval(this.msgTimer);
    this.dataTimer = undefined;
    this.msgTimer  = undefined;
    this.liveEvents.disconnect();
    for (const s of this.liveSubs) s.unsubscribe();
    this.liveSubs = [];
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
