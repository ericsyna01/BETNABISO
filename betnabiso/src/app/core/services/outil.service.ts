import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Outil } from '../models/outil.model';
import { environment } from '../../../environments/environment';

const KEY = 'betnabiso_outils';
const API = `${environment.apiUrl}/outils`;

@Injectable({ providedIn: 'root' })
export class OutilService {
  private _data = signal<Outil[]>([]);
  private http  = inject(HttpClient);

  constructor() {
    this._data.set(this.readStorage());
    this.loadFromApi();
  }

  private readStorage(): Outil[] {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  }

  private saveLocal(all: Outil[]): void {
    localStorage.setItem(KEY, JSON.stringify(all));
    this._data.set([...all]);
  }

  async loadFromApi(): Promise<void> {
    try {
      const data = await firstValueFrom(this.http.get<Outil[]>(API));
      this.saveLocal(data);
    } catch { /* utiliser le cache local si l'API est indisponible */ }
  }

  getAll(): Outil[] { return this._data(); }

  async createLien(data: { label: string; description?: string; categorie?: string; url: string; icone?: string }): Promise<Outil | null> {
    try {
      const created = await firstValueFrom(this.http.post<Outil>(API, { ...data, type: 'lien' }));
      this.saveLocal([...this._data(), created]);
      return created;
    } catch { return null; }
  }

  async createFichier(data: { label: string; description?: string; categorie?: string; icone?: string; file: File }): Promise<Outil | null> {
    try {
      const fd = new FormData();
      fd.append('type', 'fichier');
      fd.append('label', data.label);
      fd.append('description', data.description ?? '');
      fd.append('categorie', data.categorie ?? '');
      fd.append('icone', data.icone ?? '');
      fd.append('file', data.file);
      const created = await firstValueFrom(this.http.post<Outil>(API, fd));
      this.saveLocal([...this._data(), created]);
      return created;
    } catch { return null; }
  }

  async update(id: string, data: Partial<Pick<Outil, 'label' | 'description' | 'categorie' | 'url' | 'icone' | 'ordre'>>): Promise<Outil | null> {
    try {
      const updated = await firstValueFrom(this.http.put<Outil>(`${API}/${id}`, data));
      this.saveLocal(this._data().map(o => o.id === id ? updated : o));
      return updated;
    } catch { return null; }
  }

  async delete(id: string): Promise<void> {
    try {
      const remaining = await firstValueFrom(this.http.delete<Outil[]>(`${API}/${id}`));
      this.saveLocal(remaining);
    } catch {
      this.saveLocal(this._data().filter(o => o.id !== id));
    }
  }
}
