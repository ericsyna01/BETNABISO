import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

const API = `${environment.apiUrl}/presence`;

@Injectable({ providedIn: 'root' })
export class PresenceService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private _onlineIds = signal<string[]>([]);
  readonly onlineIds = this._onlineIds.asReadonly();

  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private pollTimer?: ReturnType<typeof setInterval>;

  start(): void {
    if (this.heartbeatTimer) return;
    this.beat();
    this.load();
    this.heartbeatTimer = setInterval(() => this.beat(), 25_000);
    this.pollTimer      = setInterval(() => this.load(), 20_000);
  }

  stop(): void {
    clearInterval(this.heartbeatTimer);
    clearInterval(this.pollTimer);
    this.heartbeatTimer = undefined;
    this.pollTimer      = undefined;
    this._onlineIds.set([]);
    if (this.auth.getToken()) {
      this.http.delete(API).subscribe({ error: () => {} });
    }
  }

  isOnline(userId: string): boolean {
    return this._onlineIds().includes(userId);
  }

  onlineCount(): number {
    return this._onlineIds().length;
  }

  private beat(): void {
    if (!this.auth.getToken()) return;
    this.http.post(API, {}).subscribe({ error: () => {} });
  }

  private async load(): Promise<void> {
    if (!this.auth.getToken()) return;
    try {
      const ids = await firstValueFrom(this.http.get<string[]>(API));
      this._onlineIds.set(ids);
    } catch {}
  }
}
