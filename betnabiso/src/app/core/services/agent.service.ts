import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Agent, AgentStatut } from '../models/agent.model';
import { AuthService } from './auth.service';
import { SseService } from './sse.service';
import { environment } from '../../../environments/environment';

const AGENTS_KEY = 'betnabiso_agents';
const API        = `${environment.apiUrl}/agents`;

@Injectable({ providedIn: 'root' })
export class AgentService {
  private _data   = signal<Agent[]>([]);
  private http    = inject(HttpClient);
  private auth    = inject(AuthService);
  private sseSvc  = inject(SseService);

  constructor() {
    this._data.set(this.readStorage());
    this.loadFromApi();
    this.sseSvc.dataUpdate$.subscribe(type => {
      if (type === 'agents') this.loadFromApi();
    });
  }

  private readStorage(): Agent[] {
    return JSON.parse(localStorage.getItem(AGENTS_KEY) ?? '[]');
  }

  private saveLocal(all: Agent[]): void {
    localStorage.setItem(AGENTS_KEY, JSON.stringify(all));
    this._data.set([...all]);
  }

  async loadFromApi(): Promise<void> {
    try {
      const data = await firstValueFrom(this.http.get<Agent[]>(API));
      if (JSON.stringify(data) !== JSON.stringify(this._data())) this.saveLocal(data);
    } catch { /* utiliser localStorage */ }
  }

  getAll(): Agent[] {
    const user   = this.auth.currentUser();
    const agents = this._data();
    if (user?.role === 'admin' && user.zone) {
      return agents.filter(a => a.zone === user.zone);
    }
    return agents;
  }

  getAllRaw(): Agent[] { return this._data(); }

  getById(id: string): Agent | undefined {
    return this._data().find(a => a.id === id);
  }

  search(q: string): Agent[] {
    const lq = q.toLowerCase();
    return this._data().filter(a =>
      a.nomAgent.toLowerCase().includes(lq) ||
      a.zone.toLowerCase().includes(lq) ||
      (a.identifiant ?? '').toLowerCase().includes(lq) ||
      (a.anydesk      ?? '').includes(lq) ||
      (a.anydesk_serveur ?? '').includes(lq)
    );
  }

  getStats() {
    const all = this._data();
    return {
      total:       all.length,
      actifs:      all.filter(a => a.statut === 'Actif').length,
      inactifs:    all.filter(a => a.statut === 'Inactif').length,
      aRedeployer: all.filter(a => a.statut === 'À redéployer').length,
      redeployes:  all.filter(a => a.statut === 'Redéployé').length,
      parZone:     this.groupByZone(all)
    };
  }

  private groupByZone(agents: Agent[]): Record<string, number> {
    return agents.reduce((acc, a) => {
      acc[a.zone] = (acc[a.zone] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  async create(data: Omit<Agent, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<Agent> {
    const agent = await firstValueFrom(this.http.post<Agent>(API, data));
    this.saveLocal([...this._data(), agent]);
    return agent;
  }

  async update(id: string, data: Partial<Agent>): Promise<Agent | null> {
    try {
      const updated = await firstValueFrom(this.http.put<Agent>(`${API}/${id}`, data));
      this.saveLocal(this._data().map(a => a.id === id ? updated : a));
      return updated;
    } catch {
      const agents = this._data().map(a => a.id === id ? { ...a, ...data } : a);
      this.saveLocal(agents);
      return agents.find(a => a.id === id) ?? null;
    }
  }

  async updateStatut(id: string, statut: AgentStatut): Promise<void> {
    await this.update(id, { statut });
  }

  async delete(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.delete(`${API}/${id}`));
      this.saveLocal(this._data().filter(a => a.id !== id));
      return true;
    } catch { return false; }
  }
}
