import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { User, UserRole } from '../models/user.model';
import { environment } from '../../../environments/environment';

const USERS_KEY = 'betnabiso_users';
const API       = `${environment.apiUrl}/users`;

@Injectable({ providedIn: 'root' })
export class UserService {
  private _data = signal<User[]>([]);
  private http  = inject(HttpClient);

  constructor() {
    this._data.set(this.readStorage());
    this.loadFromApi();
  }

  private readStorage(): User[] {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]');
  }

  private saveLocal(all: User[]): void {
    localStorage.setItem(USERS_KEY, JSON.stringify(all));
    this._data.set([...all]);
  }

  async loadFromApi(): Promise<void> {
    try {
      const data = await firstValueFrom(this.http.get<User[]>(API));
      this.saveLocal(data);
    } catch { /* utiliser localStorage */ }
  }

  refresh(): void { this._data.set(this.readStorage()); }

  getAll(): User[]                      { return this._data(); }
  getById(id: string): User | undefined { return this._data().find(u => u.id === id); }
  getByRole(role: UserRole): User[]     { return this._data().filter(u => u.actif && ((u.roles ?? [u.role]).includes(role))); }

  async create(data: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const newUser = await firstValueFrom(this.http.post<User>(API, data));
    this.saveLocal([...this._data(), newUser]);
    return newUser;
  }

  async update(id: string, data: Partial<User>): Promise<User | null> {
    try {
      const updated = await firstValueFrom(this.http.put<User>(`${API}/${id}`, data));
      this.saveLocal(this._data().map(u => u.id === id ? updated : u));
      return updated;
    } catch {
      const users = this._data().map(u => u.id === id ? { ...u, ...data } : u);
      this.saveLocal(users);
      return users.find(u => u.id === id) ?? null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.delete(`${API}/${id}`));
      this.saveLocal(this._data().filter(u => u.id !== id));
      return true;
    } catch { return false; }
  }

  async toggleActive(id: string): Promise<void> {
    const user = this._data().find(u => u.id === id);
    if (!user) return;
    await this.update(id, { actif: !user.actif });
  }

  async adminSetPassword(id: string, newPassword: string): Promise<void> {
    await firstValueFrom(this.http.patch(`${API}/${id}?action=set-password`, { password: newPassword }));
  }
}
