import { Injectable, signal, effect } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly sidebarOpen = signal(false);

  constructor() {
    // Empêche le défilement de la page derrière le menu sur mobile.
    // (Évite volontairement position:fixed sur le body : ça casse le défilement
    // interne du menu sur iOS Safari. overflow:hidden seul suffit ici puisque le
    // fond (backdrop) bloque déjà le défilement tactile via touch-action.)
    effect(() => {
      document.body.style.overflow = this.sidebarOpen() ? 'hidden' : '';
    });
  }

  toggle() { this.sidebarOpen.update(v => !v); }
  close()  { this.sidebarOpen.set(false); }
  open()   { this.sidebarOpen.set(true); }
}
