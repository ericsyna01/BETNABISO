import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PlanningEntry } from '../models/planning.model';
import { environment } from '../../../environments/environment';

const KEY = 'betnabiso_planning';
const API = `${environment.apiUrl}/planning`;

@Injectable({ providedIn: 'root' })
export class PlanningService {
  private _data = signal<PlanningEntry[]>([]);
  private http  = inject(HttpClient);

  constructor() {
    this._data.set(this.readStorage());
    this.loadFromApi();
  }

  private readStorage(): PlanningEntry[] {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  }

  private saveLocal(all: PlanningEntry[]): void {
    localStorage.setItem(KEY, JSON.stringify(all));
    this._data.set([...all]);
  }

  async loadFromApi(): Promise<void> {
    try {
      const data = await firstValueFrom(this.http.get<PlanningEntry[]>(API));
      this.saveLocal(data);
    } catch {}
  }

  getAll(): PlanningEntry[] { return this._data(); }

  getByWeek(year: number, week: number): PlanningEntry[] {
    return this._data().filter(e => {
      const d = new Date(e.date);
      return getISOWeek(d) === week && d.getFullYear() === year;
    });
  }

  getByDate(date: string): PlanningEntry[] {
    return this._data().filter(e => e.date === date);
  }

  async create(data: Omit<PlanningEntry, 'id' | 'createdAt'>): Promise<PlanningEntry> {
    const entry = await firstValueFrom(this.http.post<PlanningEntry>(API, data));
    this.saveLocal([...this._data(), entry]);
    return entry;
  }

  async update(id: string, data: Partial<PlanningEntry>): Promise<PlanningEntry | null> {
    try {
      const updated = await firstValueFrom(this.http.put<PlanningEntry>(`${API}/${id}`, data));
      this.saveLocal(this._data().map(e => e.id === id ? updated : e));
      return updated;
    } catch { return null; }
  }

  async delete(id: string): Promise<void> {
    try { await firstValueFrom(this.http.delete(`${API}/${id}`)); } catch {}
    this.saveLocal(this._data().filter(e => e.id !== id));
  }

  async deleteByWeek(year: number, week: number): Promise<void> {
    const toDelete = this.getByWeek(year, week);
    for (const e of toDelete) {
      try { await firstValueFrom(this.http.delete(`${API}/${e.id}`)); } catch {}
    }
    this.saveLocal(this._data().filter(e => {
      const d = new Date(e.date);
      return !(getISOWeek(d) === week && d.getFullYear() === year);
    }));
  }

}

export function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function getWeekDates(year: number, week: number): Date[] {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow    = simple.getDay();
  const monday = new Date(simple);
  monday.setDate(simple.getDate() - (dow <= 4 ? dow - 1 : dow - 8));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export function formatDate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
