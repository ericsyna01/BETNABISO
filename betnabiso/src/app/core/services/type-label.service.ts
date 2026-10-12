import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TypeLabel, TypeCategorie } from '../models/type-label.model';
import { environment } from '../../../environments/environment';

const KEY = 'betnabiso_type_labels';
const API = `${environment.apiUrl}/type-labels`;

@Injectable({ providedIn: 'root' })
export class TypeLabelService {
  private _data = signal<TypeLabel[]>([]);
  private http  = inject(HttpClient);

  constructor() {
    this._data.set(this.readStorage());
    this.loadFromApi();
  }

  private readStorage(): TypeLabel[] {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  }

  private saveLocal(all: TypeLabel[]): void {
    localStorage.setItem(KEY, JSON.stringify(all));
    this._data.set([...all]);
  }

  async loadFromApi(): Promise<void> {
    try {
      const data = await firstValueFrom(this.http.get<TypeLabel[]>(API));
      this.saveLocal(data);
    } catch { /* utiliser le cache local si l'API est indisponible */ }
  }

  getAll(): TypeLabel[] { return this._data(); }

  getByCategorie(categorie: TypeCategorie): TypeLabel[] {
    return this._data().filter(t => t.categorie === categorie);
  }

  getByLabel(categorie: TypeCategorie, label: string): TypeLabel | undefined {
    return this._data().find(t => t.categorie === categorie && t.label === label);
  }

  getIcon(categorie: TypeCategorie, label: string, fallback = 'assignment'): string {
    return this.getByLabel(categorie, label)?.icone || fallback;
  }

  async create(data: Omit<TypeLabel, 'id' | 'ordre' | 'createdAt'>): Promise<TypeLabel | null> {
    try {
      const created = await firstValueFrom(this.http.post<TypeLabel>(API, data));
      this.saveLocal([...this._data(), created]);
      return created;
    } catch { return null; }
  }

  async update(id: string, data: Partial<TypeLabel>): Promise<TypeLabel | null> {
    try {
      const updated = await firstValueFrom(this.http.put<TypeLabel>(`${API}/${id}`, data));
      this.saveLocal(this._data().map(t => t.id === id ? updated : t));
      return updated;
    } catch { return null; }
  }

  async delete(id: string): Promise<void> {
    try {
      const remaining = await firstValueFrom(this.http.delete<TypeLabel[]>(`${API}/${id}`));
      this.saveLocal(remaining);
    } catch {
      this.saveLocal(this._data().filter(t => t.id !== id));
    }
  }
}
