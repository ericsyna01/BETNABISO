import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Evaluation {
  id: string;
  interventionId: string;
  agentId: string;
  agentNom: string;
  note: number;
  commentaire?: string;
  evaluatedBy: string;
  evaluatedByNom: string;
  createdAt: string;
}

const API = `${environment.apiUrl}/evaluations`;

@Injectable({ providedIn: 'root' })
export class EvaluationService {
  private _evals = signal<Evaluation[]>([]);
  private http   = inject(HttpClient);

  async loadAll(): Promise<void> {
    try {
      const evals = await firstValueFrom(this.http.get<Evaluation[]>(API));
      this._evals.set(evals);
    } catch { /* ignore */ }
  }

  async loadForIntervention(interventionId: string): Promise<Evaluation[]> {
    try {
      return await firstValueFrom(this.http.get<Evaluation[]>(`${API}?interventionId=${interventionId}`));
    } catch { return []; }
  }

  getAll(): Evaluation[] { return this._evals(); }

  avgNote(technicienId: string): number | null {
    const evals = this._evals().filter(e => e.agentId === technicienId);
    if (!evals.length) return null;
    return Math.round((evals.reduce((s, e) => s + e.note, 0) / evals.length) * 10) / 10;
  }

  async submit(interventionId: string, agentId: string, agentNom: string, note: number, commentaire?: string): Promise<void> {
    await firstValueFrom(this.http.post(API, { interventionId, agentId, agentNom, note, commentaire }));
  }
}
