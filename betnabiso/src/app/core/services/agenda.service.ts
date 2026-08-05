import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AgendaItem } from '../models/agenda.model';
import { environment } from '../../../environments/environment';

const KEY = 'betnabiso_agenda';
const API = `${environment.apiUrl}/agenda`;

@Injectable({ providedIn: 'root' })
export class AgendaService {
  private _data = signal<AgendaItem[]>([]);
  private http  = inject(HttpClient);

  constructor() {
    this._data.set(this.readStorage());
    this.loadFromApi();
  }

  private readStorage(): AgendaItem[] {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  }

  private saveLocal(all: AgendaItem[]): void {
    localStorage.setItem(KEY, JSON.stringify(all));
    this._data.set([...all]);
  }

  async loadFromApi(): Promise<void> {
    try {
      const data = await firstValueFrom(this.http.get<AgendaItem[]>(API));
      this.saveLocal(data);
    } catch { /* utiliser le cache local si l'API est indisponible */ }
  }

  getAll(): AgendaItem[] { return this._data(); }

  async create(data: { titre: string; note?: string; dateRappel: string; heure?: string }): Promise<AgendaItem | null> {
    try {
      const created = await firstValueFrom(this.http.post<AgendaItem>(API, data));
      this.saveLocal([...this._data(), created]);
      return created;
    } catch { return null; }
  }

  async update(id: string, data: Partial<Pick<AgendaItem, 'titre' | 'note' | 'dateRappel' | 'heure'>>): Promise<AgendaItem | null> {
    try {
      const updated = await firstValueFrom(this.http.put<AgendaItem>(`${API}/${id}`, data));
      this.saveLocal(this._data().map(a => a.id === id ? updated : a));
      return updated;
    } catch { return null; }
  }

  async toggleFait(id: string, fait: boolean): Promise<AgendaItem | null> {
    try {
      const updated = await firstValueFrom(this.http.put<AgendaItem>(`${API}/${id}`, { fait }));
      this.saveLocal(this._data().map(a => a.id === id ? updated : a));
      return updated;
    } catch { return null; }
  }

  async delete(id: string): Promise<void> {
    try {
      const remaining = await firstValueFrom(this.http.delete<AgendaItem[]>(`${API}/${id}`));
      this.saveLocal(remaining);
    } catch {
      this.saveLocal(this._data().filter(a => a.id !== id));
    }
  }
}
