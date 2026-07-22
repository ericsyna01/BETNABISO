import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ZONES } from '../models/agent.model';
import { environment } from '../../../environments/environment';

const ZONES_KEY = 'betnabiso_zones';
const API       = `${environment.apiUrl}/zones`;

@Injectable({ providedIn: 'root' })
export class ZoneService {
  private _data = signal<string[]>([]);
  private http  = inject(HttpClient);

  constructor() {
    const stored = localStorage.getItem(ZONES_KEY);
    this._data.set(stored ? JSON.parse(stored) : [...ZONES]);
    this.loadFromApi();
  }

  private saveLocal(all: string[]): void {
    localStorage.setItem(ZONES_KEY, JSON.stringify(all));
    this._data.set([...all]);
  }

  async loadFromApi(): Promise<void> {
    try {
      const zones = await firstValueFrom(this.http.get<string[]>(API));
      this.saveLocal(zones);
    } catch { /* utiliser localStorage si API indisponible */ }
  }

  getAll(): string[] { return this._data(); }

  async create(name: string): Promise<boolean> {
    const trimmed = name.trim();
    if (!trimmed || this._data().map(z => z.toLowerCase()).includes(trimmed.toLowerCase())) return false;
    try {
      const zones = await firstValueFrom(this.http.post<string[]>(API, { nom: trimmed }));
      this.saveLocal(zones);
      return true;
    } catch { return false; }
  }

  async delete(name: string): Promise<void> {
    const zones = await firstValueFrom(
      this.http.delete<string[]>(`${API}/${encodeURIComponent(name)}`)
    );
    this.saveLocal(zones);
  }
}
