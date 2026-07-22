import { Injectable, inject, NgZone, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { AuthService } from './auth.service';

const AUTH_TIMEOUT_MS = 5_000;
const MAX_BACKOFF_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class LiveEventsService implements OnDestroy {
  private auth = inject(AuthService);
  private zone = inject(NgZone);

  private ws?: WebSocket;
  private backoffMs = 2_000;
  private authTimer?: ReturnType<typeof setTimeout>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private stopped = false;

  /** Emet un type ('interventions' | 'missions' | 'agents' | 'notifications' | 'machine_status') */
  readonly event$ = new Subject<string>();
  /** Emet à chaque message/message de groupe reçu */
  readonly message$ = new Subject<void>();

  connect(): void {
    if (this.ws || this.stopped) return;
    this.stopped = false;
    this.open();
  }

  disconnect(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.authTimer) clearTimeout(this.authTimer);
    this.ws?.close();
    this.ws = undefined;
  }

  private open(): void {
    const token = this.auth.getToken();
    if (!token) return;

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/ws-live`);
    this.ws = ws;

    this.authTimer = setTimeout(() => ws.close(), AUTH_TIMEOUT_MS);

    ws.onopen = () => ws.send(JSON.stringify({ token }));

    ws.onmessage = (ev) => {
      clearTimeout(this.authTimer);
      this.backoffMs = 2_000;
      let msg: { status?: string; type?: string };
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === 'message') {
        this.zone.run(() => this.message$.next());
      } else if (msg.type) {
        this.zone.run(() => this.event$.next(msg.type!));
      }
    };

    ws.onclose = () => {
      clearTimeout(this.authTimer);
      this.ws = undefined;
      if (this.stopped || !this.auth.getToken()) return;
      this.reconnectTimer = setTimeout(() => this.open(), this.backoffMs);
      this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
    };

    ws.onerror = () => ws.close();
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
