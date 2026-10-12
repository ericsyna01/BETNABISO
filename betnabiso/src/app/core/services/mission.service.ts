import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Mission } from '../models/mission.model';
import { SseService } from './sse.service';
import { environment } from '../../../environments/environment';

const KEY = 'betnabiso_missions';
const API = `${environment.apiUrl}/missions`;

@Injectable({ providedIn: 'root' })
export class MissionService {
  private _data  = signal<Mission[]>([]);
  private http   = inject(HttpClient);
  private sseSvc = inject(SseService);

  constructor() {
    this._data.set(this.readStorage());
    this.loadFromApi();
    this.sseSvc.dataUpdate$.subscribe(type => {
      if (type === 'missions') this.loadFromApi();
    });
  }

  private readStorage(): Mission[] {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  }

  private save(all: Mission[]): void {
    localStorage.setItem(KEY, JSON.stringify(all));
    this._data.set([...all]);
  }

  async loadFromApi(): Promise<void> {
    try {
      const data = await firstValueFrom(this.http.get<Mission[]>(API));
      this.save(data);
    } catch {}
  }

  getAll(): Mission[]                  { return this._data(); }
  getByUser(userId: string): Mission[] {
    return this._data().filter(m => m.assignedToId === userId || m.assignedToId2 === userId);
  }
  getActive(userId: string): Mission[] {
    return this._data().filter(m =>
      (m.assignedToId === userId || m.assignedToId2 === userId) && !['terminée','refusée'].includes(m.statut)
    );
  }

  async create(data: Omit<Mission, 'id' | 'statut' | 'createdAt'>): Promise<Mission | null> {
    try {
      const m = await firstValueFrom(this.http.post<Mission>(API, data));
      this.save([...this._data(), m]);
      return m;
    } catch { return null; }
  }

  async update(id: string, data: Partial<Pick<Mission,
    'titre' | 'description' | 'type' | 'priorite' | 'assignedToId' | 'assignedToNom' |
    'assignedToId2' | 'assignedToNom2' | 'dateMission'
  >>): Promise<Mission | null> {
    try {
      const m = await firstValueFrom(this.http.put<Mission>(`${API}/${id}`, data));
      this.save(this._data().map(x => x.id === id ? m : x));
      return m;
    } catch { return null; }
  }

  async updateStatut(id: string, statut: Mission['statut'], notes?: string): Promise<Mission | null> {
    try {
      const m = await firstValueFrom(
        this.http.patch<Mission>(`${API}/${id}`, { statut, notes })
      );
      this.save(this._data().map(x => x.id === id ? m : x));
      return m;
    } catch { return null; }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.delete(`${API}/${id}`));
      this.save(this._data().filter(m => m.id !== id));
      return true;
    } catch { return false; }
  }
}
