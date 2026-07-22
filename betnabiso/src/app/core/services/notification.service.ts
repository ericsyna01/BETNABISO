import { Injectable, computed, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AgentNotif, NotifStatut } from '../models/notification.model';
import { SseService } from './sse.service';
import { environment } from '../../../environments/environment';

const NOTIFS_KEY = 'betnabiso_notifications';
const API        = `${environment.apiUrl}/notifications`;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private _data  = signal<AgentNotif[]>([]);
  private http   = inject(HttpClient);
  private sseSvc = inject(SseService);

  constructor() {
    this._data.set(this.readStorage());
    this.loadFromApi();
    this.sseSvc.dataUpdate$.subscribe(type => {
      if (type === 'notifications') this.loadFromApi();
    });
  }

  private readStorage(): AgentNotif[] {
    return JSON.parse(localStorage.getItem(NOTIFS_KEY) ?? '[]');
  }

  private saveLocal(all: AgentNotif[]): void {
    localStorage.setItem(NOTIFS_KEY, JSON.stringify(all));
    this._data.set([...all]);
  }

  async loadFromApi(): Promise<void> {
    try {
      const data = await firstValueFrom(this.http.get<AgentNotif[]>(API));
      this.saveLocal(data);
    } catch {}
  }

  getAll(): AgentNotif[] {
    return [...this._data()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  unreadCount = computed(() => this._data().filter(n => n.statut === 'non_lue').length);

  async send(data: Omit<AgentNotif, 'id' | 'statut' | 'createdAt'>): Promise<void> {
    try {
      const notif = await firstValueFrom(this.http.post<AgentNotif>(API, data));
      this.saveLocal([...this._data(), notif]);
    } catch {
      const notif: AgentNotif = {
        ...data, id: crypto.randomUUID(),
        statut: 'non_lue', createdAt: new Date().toISOString()
      } as AgentNotif;
      this.saveLocal([...this._data(), notif]);
    }
  }

  async markTraitee(id: string): Promise<void> {
    try {
      await firstValueFrom(this.http.patch(`${API}/${id}?action=traitee`, { statut: 'traitée' }));
    } catch {}
    this.saveLocal(this._data().map(n =>
      n.id === id ? { ...n, statut: 'traitée' as NotifStatut } : n
    ));
  }

  async markAllLue(): Promise<void> {
    try {
      await firstValueFrom(this.http.patch(`${API}?action=mark-all-lue`, {}));
    } catch {}
    this.saveLocal(this._data().map(n =>
      n.statut === 'non_lue' ? { ...n, statut: 'lue' as NotifStatut } : n
    ));
  }

  async delete(id: string): Promise<void> {
    try { await firstValueFrom(this.http.delete(`${API}/${id}`)); } catch {}
    this.saveLocal(this._data().filter(n => n.id !== id));
  }
}
