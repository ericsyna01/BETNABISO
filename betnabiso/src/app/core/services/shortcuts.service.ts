import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

type ShortcutDef = { keys: string[]; label: string; action: () => void };

@Injectable({ providedIn: 'root' })
export class ShortcutsService {
  private router = inject(Router);
  private pending = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  readonly shortcuts: ShortcutDef[] = [
    { keys: ['g', 'd'], label: 'G puis D — Tableau de bord',       action: () => this.router.navigate(['/dashboard']) },
    { keys: ['g', 'a'], label: 'G puis A — Agents',                 action: () => this.router.navigate(['/agents']) },
    { keys: ['g', 'i'], label: 'G puis I — Interventions',          action: () => this.router.navigate(['/interventions']) },
    { keys: ['g', 'p'], label: 'G puis P — Planning',               action: () => this.router.navigate(['/planning']) },
    { keys: ['g', 'm'], label: 'G puis M — Messagerie',             action: () => this.router.navigate(['/mail']) },
    { keys: ['g', 's'], label: 'G puis S — Support / Affectations', action: () => this.router.navigate(['/support']) },
    { keys: ['g', 'r'], label: 'G puis R — Historique & Rapports',  action: () => this.router.navigate(['/history']) },
  ];

  handle(event: KeyboardEvent): void {
    // Ignore when typing in an input
    const tag = (event.target as HTMLElement).tagName.toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const key = event.key.toLowerCase();

    if (this.pending === 'g') {
      this.clearTimer();
      this.pending = '';
      const sc = this.shortcuts.find(s => s.keys[0] === 'g' && s.keys[1] === key);
      if (sc) { event.preventDefault(); sc.action(); }
      return;
    }

    if (key === 'g') {
      this.pending = 'g';
      this.timer = setTimeout(() => { this.pending = ''; }, 1500);
    }
  }

  private clearTimer(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }
}
