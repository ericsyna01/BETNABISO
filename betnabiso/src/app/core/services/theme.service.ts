import { Injectable, signal, effect } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  dark = signal<boolean>(localStorage.getItem('dark-mode') === '1');

  constructor() {
    effect(() => {
      const isDark = this.dark();
      document.documentElement.classList.toggle('dark-mode', isDark);
      localStorage.setItem('dark-mode', isDark ? '1' : '0');
    });
    // Apply immediately on load
    if (this.dark()) document.documentElement.classList.add('dark-mode');
  }

  toggle(): void { this.dark.update(v => !v); }
}
