import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private auth        = inject(AuthService);
  private permitted   = false;

  async requestPermission(): Promise<void> {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') { this.permitted = true; return; }
    if (Notification.permission === 'denied')  return;
    const result = await Notification.requestPermission();
    this.permitted = result === 'granted';
  }

  notify(title: string, body: string, icon = '/logo.png'): void {
    if (!this.permitted || !('Notification' in window)) return;
    if (document.visibilityState === 'visible') return; // app au premier plan — inutile
    const n = new Notification(title, { body, icon });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), 6000);
  }

  notifyIntervention(agentNom: string, type: string): void {
    const user = this.auth.currentUser();
    if (!user) return;
    this.notify(
      'Nouvelle intervention assignée',
      `${type} — ${agentNom}`
    );
  }

  notifyMessage(fromNom: string, content: string): void {
    this.notify(
      `Message de ${fromNom}`,
      content.length > 80 ? content.slice(0, 80) + '…' : content
    );
  }

  notifyEscalade(agentNom: string, dureeH: number): void {
    this.notify(
      '⚠️ Intervention en attente',
      `${agentNom} — sans prise en charge depuis ${dureeH}h`
    );
  }
}
