import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Creneau } from '../models/creneau.model';
import { environment } from '../../../environments/environment';

const KEY = 'betnabiso_creneaux';
const API = `${environment.apiUrl}/creneaux`;

@Injectable({ providedIn: 'root' })
export class CreneauService {
  private _data = signal<Creneau[]>([]);
  private http  = inject(HttpClient);

  constructor() {
    this._data.set(this.readStorage());
    this.loadFromApi();
  }

  private readStorage(): Creneau[] {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  }

  private saveLocal(all: Creneau[]): void {
    localStorage.setItem(KEY, JSON.stringify(all));
    this._data.set([...all]);
  }

  async loadFromApi(): Promise<void> {
    try {
      const data = await firstValueFrom(this.http.get<Creneau[]>(API));
      this.saveLocal(data);
    } catch { /* utiliser le cache local si l'API est indisponible */ }
  }

  getAll(): Creneau[] { return this._data(); }

  getByLabel(label: string): Creneau | undefined {
    return this._data().find(c => c.label === label);
  }

  async create(data: Omit<Creneau, 'id' | 'ordre' | 'createdAt'>): Promise<Creneau | null> {
    try {
      const created = await firstValueFrom(this.http.post<Creneau>(API, data));
      this.saveLocal([...this._data(), created]);
      return created;
    } catch { return null; }
  }

  async update(id: string, data: Partial<Creneau>): Promise<Creneau | null> {
    try {
      const updated = await firstValueFrom(this.http.put<Creneau>(`${API}/${id}`, data));
      this.saveLocal(this._data().map(c => c.id === id ? updated : c));
      return updated;
    } catch { return null; }
  }

  async delete(id: string): Promise<void> {
    try {
      const remaining = await firstValueFrom(this.http.delete<Creneau[]>(`${API}/${id}`));
      this.saveLocal(remaining);
    } catch {
      this.saveLocal(this._data().filter(c => c.id !== id));
    }
  }
}
