import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Intervention, ReassignmentLog, TechMonthlyStats } from '../models/intervention.model';
import { AuthService } from './auth.service';
import { SseService } from './sse.service';
import { environment } from '../../../environments/environment';

const INTERVENTIONS_KEY = 'betnabiso_interventions';
const REASSIGNMENTS_KEY = 'betnabiso_reassignments';
const API               = `${environment.apiUrl}/interventions`;

@Injectable({ providedIn: 'root' })
export class InterventionService {
  private http   = inject(HttpClient);
  private auth   = inject(AuthService);
  private sseSvc = inject(SseService);

  private _data          = signal<Intervention[]>([]);
  private _reassignments = signal<ReassignmentLog[]>([]);
  private _techStats     = signal<TechMonthlyStats[]>([]);

  constructor() {
    this._data.set(this.readStorage());
    this._reassignments.set(JSON.parse(localStorage.getItem(REASSIGNMENTS_KEY) ?? '[]'));
    this.loadFromApi();
    this.loadTechMonthlyStats();
    this.sseSvc.dataUpdate$.subscribe(type => {
      if (type === 'interventions') { this.loadFromApi(); this.loadTechMonthlyStats(); }
    });
  }

  private readStorage(): Intervention[] {
    return JSON.parse(localStorage.getItem(INTERVENTIONS_KEY) ?? '[]');
  }

  private saveLocal(all: Intervention[]): void {
    localStorage.setItem(INTERVENTIONS_KEY, JSON.stringify(all));
    this._data.set([...all]);
  }

  async loadFromApi(): Promise<void> {
    try {
      const data = await firstValueFrom(this.http.get<Intervention[]>(API));
      if (JSON.stringify(data) !== JSON.stringify(this._data())) this.saveLocal(data);
    } catch { /* utiliser localStorage si indisponible */ }
  }

  async loadTechMonthlyStats(): Promise<void> {
    try {
      const stats = await firstValueFrom(
        this.http.get<TechMonthlyStats[]>(`${API}?action=tech-monthly-stats`)
      );
      this._techStats.set(stats);
    } catch {}
  }

  getAll(): Intervention[] {
    const user = this.auth.currentUser();
    const all  = this._data();
    if (!user) return all;
    if (user.role === 'technicien') {
      return all.filter(i => i.technicienId?.trim() === user.id.trim());
    }
    if (user.role === 'chauffeur') {
      return all.filter(i => i.deplacementRequis && i.deplacementValide && i.chauffeurId?.trim() === user.id.trim());
    }
    return all;
  }

  getAllRaw(): Intervention[] { return this._data(); }

  getById(id: string): Intervention | undefined {
    return this._data().find(i => i.id === id);
  }

  getByAgent(agentId: string): Intervention[] {
    return this._data().filter(i => i.agentId === agentId);
  }

  getAgentTodayInterventions(agentId: string, excludeId?: string): Intervention[] {
    const today = new Date().toISOString().split('T')[0];
    return this._data().filter(i =>
      i.agentId === agentId &&
      i.dateDebut.startsWith(today) &&
      i.id !== excludeId
    );
  }

  getByTechnicien(technicienId: string): Intervention[] {
    return this._data().filter(i => i.technicienId === technicienId);
  }

  getAssignedCount(technicienId: string | null): number {
    if (!technicienId) return 0;
    return this._data().filter(
      i => i.technicienId === technicienId && ['Assignée', 'En cours'].includes(i.statut)
    ).length;
  }

  getDeplacementPending(): Intervention[] {
    return this._data().filter(i => i.deplacementRequis && !i.deplacementValide);
  }

  getDeplacementAll(): Intervention[] {
    return this._data().filter(i => i.deplacementRequis);
  }

  getReassignments(): ReassignmentLog[] { return this._reassignments(); }
  getTechStats(): TechMonthlyStats[]    { return this._techStats(); }
  getTechMonthlyStats(): TechMonthlyStats[] { return this._techStats(); }

  getStats(): { total: number; enCours: number; terminees: number; echecs: number; enAttente: number } {
    const all = this._data();
    return {
      total:     all.length,
      enCours:   all.filter(i => i.statut === 'En cours').length,
      terminees: all.filter(i => i.statut === 'Terminée').length,
      echecs:    all.filter(i => i.statut === 'Échec').length,
      enAttente: all.filter(i => i.statut === 'Assignée').length,
    };
  }

  getMonthlyStats(technicienId: string, year: number, month: number): {
    total: number; terminees: number; enCours: number; assignees: number; echecs: number;
  } {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const items  = this._data().filter(i => i.technicienId === technicienId && i.dateDebut.startsWith(prefix));
    return {
      total:     items.length,
      terminees: items.filter(i => i.statut === 'Terminée').length,
      enCours:   items.filter(i => i.statut === 'En cours').length,
      assignees: items.filter(i => i.statut === 'Assignée').length,
      echecs:    items.filter(i => i.statut === 'Échec').length,
    };
  }

  getLast6MonthsStats(technicienId: string): { label: string; total: number; terminees: number }[] {
    const result: { label: string; total: number; terminees: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d      = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label  = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      const items  = this._data().filter(x => x.technicienId === technicienId && x.dateDebut.startsWith(prefix));
      result.push({ label, total: items.length, terminees: items.filter(x => x.statut === 'Terminée').length });
    }
    return result;
  }

  async loadReassignments(): Promise<void> {
    try {
      const logs = await firstValueFrom(
        this.http.get<ReassignmentLog[]>(`${API}?action=reassignments`)
      );
      this._reassignments.set(logs);
      localStorage.setItem(REASSIGNMENTS_KEY, JSON.stringify(logs));
    } catch {
      this._reassignments.set(JSON.parse(localStorage.getItem(REASSIGNMENTS_KEY) ?? '[]'));
    }
  }

  filter(opts: {
    dateDebut?: string; dateFin?: string; technicienId?: string;
    zone?: string; type?: string; statut?: string;
  }): Intervention[] {
    return this._data().filter(i => {
      if (opts.dateDebut  && i.dateDebut < opts.dateDebut)               return false;
      if (opts.dateFin    && i.dateDebut > opts.dateFin + 'T23:59:59')   return false;
      if (opts.technicienId && i.technicienId !== opts.technicienId)     return false;
      if (opts.zone       && i.agentZone !== opts.zone)                  return false;
      if (opts.type       && i.type !== opts.type)                       return false;
      if (opts.statut     && i.statut !== opts.statut)                   return false;
      return true;
    });
  }

  async create(data: Omit<Intervention, 'id'>): Promise<Intervention> {
    try {
      const interv = await firstValueFrom(this.http.post<Intervention>(API, data));
      this.saveLocal([...this._data(), interv]);
      return interv;
    } catch {
      const interv: Intervention = { ...data, id: crypto.randomUUID() } as Intervention;
      this.saveLocal([...this._data(), interv]);
      return interv;
    }
  }

  async assign(data: {
    id?: string; technicienId: string; technicienNom: string;
    assignedById?: string; assignedByNom?: string;
    agentId?: string; agentNom?: string; agentZone?: string;
    type?: string; description?: string; priorite?: string; datePlanifiee?: string | null;
  }): Promise<Intervention | null> {
    try {
      const interv = await firstValueFrom(
        this.http.post<Intervention>(`${API}/${data.id}?action=assign`, data)
      );
      this.saveLocal(this._data().map(i => i.id === data.id ? interv : i));
      return interv;
    } catch { return null; }
  }

  async reassign(id: string, technicienId: string, technicienNom: string): Promise<Intervention | null> {
    try {
      const interv = await firstValueFrom(
        this.http.post<Intervention>(`${API}/${id}?action=reassign`, { technicienId, technicienNom })
      );
      this.saveLocal(this._data().map(i => i.id === id ? interv : i));
      return interv;
    } catch { return null; }
  }

  async update(id: string, data: Partial<Intervention>): Promise<Intervention | null> {
    try {
      const updated = await firstValueFrom(this.http.put<Intervention>(`${API}/${id}`, data));
      this.saveLocal(this._data().map(i => i.id === id ? updated : i));
      return updated;
    } catch {
      const items = this._data().map(i => i.id === id ? { ...i, ...data } : i);
      this.saveLocal(items);
      return items.find(i => i.id === id) ?? null;
    }
  }

  async requestDeployment(id: string, note: string, requestedBy: string): Promise<Intervention> {
    try {
      const interv = await firstValueFrom(
        this.http.post<Intervention>(`${API}/${id}?action=deplacement`, { note, requestedBy })
      );
      this.saveLocal(this._data().map(i => i.id === id ? interv : i));
      return interv;
    } catch {
      const items = this._data().map(i =>
        i.id === id ? { ...i, deplacementRequis: true, deplacementNote: note } : i
      );
      this.saveLocal(items);
      return items.find(i => i.id === id)!;
    }
  }

  async validateDeployment(id: string, chauffeurId: string, chauffeurNom: string): Promise<Intervention> {
    try {
      const interv = await firstValueFrom(
        this.http.post<Intervention>(`${API}/${id}?action=valider-deplacement`, { chauffeurId, chauffeurNom })
      );
      this.saveLocal(this._data().map(i => i.id === id ? interv : i));
      return interv;
    } catch {
      const items = this._data().map(i =>
        i.id === id ? { ...i, deplacementValide: true, chauffeurId, chauffeurNom } : i
      );
      this.saveLocal(items);
      return items.find(i => i.id === id)!;
    }
  }

  async cancelDeployment(id: string): Promise<Intervention> {
    try {
      const interv = await firstValueFrom(
        this.http.post<Intervention>(`${API}/${id}?action=refuser-deplacement`, {})
      );
      this.saveLocal(this._data().map(i => i.id === id ? interv : i));
      return interv;
    } catch {
      const items = this._data().map(i =>
        i.id === id ? { ...i, deplacementRequis: false, deplacementRefuse: true } : i
      );
      this.saveLocal(items);
      return items.find(i => i.id === id)!;
    }
  }

  async resolveDeployment(id: string): Promise<Intervention> {
    try {
      const interv = await firstValueFrom(
        this.http.post<Intervention>(`${API}/${id}?action=resolve-deplacement`, {})
      );
      this.saveLocal(this._data().map(i => i.id === id ? interv : i));
      return interv;
    } catch {
      const items = this._data().map(i =>
        i.id === id ? { ...i, deplacementValide: false, deplacementRequis: false } : i
      );
      this.saveLocal(items);
      return items.find(i => i.id === id)!;
    }
  }

  async demarrerTransport(id: string): Promise<Intervention> {
    try {
      const interv = await firstValueFrom(
        this.http.post<Intervention>(`${API}/${id}?action=chauffeur-statut`, { statut: 'en_route' })
      );
      this.saveLocal(this._data().map(i => i.id === id ? interv : i));
      return interv;
    } catch {
      const items = this._data().map(i => i.id === id ? { ...i, statut: 'En cours' as const } : i);
      this.saveLocal(items);
      return items.find(i => i.id === id)!;
    }
  }

  async terminerTransport(id: string): Promise<Intervention> {
    try {
      const interv = await firstValueFrom(
        this.http.post<Intervention>(`${API}/${id}?action=terminer-transport`, {})
      );
      this.saveLocal(this._data().map(i => i.id === id ? interv : i));
      return interv;
    } catch {
      const items = this._data().map(i => i.id === id ? { ...i, deplacementTermine: true, statut: 'En cours' as const } : i);
      this.saveLocal(items);
      return items.find(i => i.id === id)!;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.delete(`${API}/${id}`));
      this.saveLocal(this._data().filter(i => i.id !== id));
      return true;
    } catch {
      try { this.saveLocal(this._data().filter(i => i.id !== id)); } catch {}
      return false;
    }
  }

  computeMonthlyActivity(): { month: string; count: number }[] {
    const map = new Map<string, number>();
    this._data().forEach(i => {
      const m = i.dateDebut.slice(0, 7);
      map.set(m, (map.get(m) ?? 0) + 1);
    });
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([month, count]) => ({ month, count }));
  }
}
