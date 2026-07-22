import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { AuthUser, UserRole } from '../models/user.model';
import { environment } from '../../../environments/environment';
import { ACTIVITY_KEY } from './inactivity.service';

const STORAGE_KEY = 'betnabiso_auth';
const API         = `${environment.apiUrl}/auth`;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http   = inject(HttpClient);
  private router = inject(Router);

  private _currentUser = signal<AuthUser | null>(null);

  currentUser        = this._currentUser.asReadonly();
  isAuthenticated    = computed(() => !!this._currentUser());
  role               = computed(() => this._currentUser()?.role ?? null);
  roles              = computed((): UserRole[] => {
    const user = this._currentUser();
    if (!user) return [];
    const r = user.roles as any;
    if (Array.isArray(r) && r.length > 0) return r;
    if (typeof r === 'string') {
      try { const p = JSON.parse(r); if (Array.isArray(p) && p.length > 0) return p; } catch {}
    }
    return user.role ? [user.role] : [];
  });
  isSuperadmin       = computed(() => this.roles().includes('superadmin'));
  isAdmin            = computed(() => this.roles().some(r => ['superadmin', 'admin'].includes(r)));
  isSupport          = computed(() => this.roles().includes('support'));
  isTechnicien       = computed(() => this.roles().includes('technicien'));
  isChauffeur        = computed(() => this.roles().includes('chauffeur'));
  canManageAgents    = computed(() => this.roles().some(r => ['superadmin', 'admin'].includes(r)));
  canViewHistory     = computed(() => this.roles().some(r => ['superadmin', 'admin', 'support'].includes(r)));
  mustChangePassword = computed(() => !!this._currentUser()?.mustChangePassword);

  constructor() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      this._currentUser.set(JSON.parse(stored));
    }
  }

  async login(username: string, password: string): Promise<{ success: true } | { success: false; message: string }> {
    try {
      const data = await firstValueFrom(
        this.http.post<AuthUser & { token: string }>(API, { username, password })
      );
      this._currentUser.set(data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return { success: true };
    } catch (err: any) {
      const msg = err?.error?.error ?? 'Erreur réseau — vérifiez la connexion au serveur.';
      return { success: false, message: msg };
    }
  }

  async changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${API}?action=change-password`, { currentPassword, newPassword })
    );
    const user = this._currentUser();
    if (user) {
      const updated = { ...user, mustChangePassword: false };
      this._currentUser.set(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  }

  logout(): void {
    // Nettoyage local immédiat : sur mobile la requête réseau peut traîner
    // (onglet en arrière-plan, changement Wi-Fi/4G) et ne doit jamais bloquer
    // la déconnexion perçue par l'utilisateur.
    this._currentUser.set(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ACTIVITY_KEY);
    this.router.navigate(['/login']);
    this.http.post(`${API}?action=logout`, {}).subscribe({ error: () => {} });
  }

  getToken(): string | null {
    return this._currentUser()?.token ?? null;
  }

  hasRole(...roles: UserRole[]): boolean {
    return this.roles().some(r => roles.includes(r));
  }
}
