import { Injectable, signal } from '@angular/core';

// État d'ouverture du panneau de chat, partagé entre le déclencheur (header)
// et le panneau lui-même — ils sont frères dans l'arbre de composants.
@Injectable({ providedIn: 'root' })
export class ChatUiService {
  isOpen = signal(false);

  toggle(): void { this.isOpen.update(v => !v); }
  open(): void { this.isOpen.set(true); }
  close(): void { this.isOpen.set(false); }
}
