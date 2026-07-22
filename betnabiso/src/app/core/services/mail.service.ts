import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MailSettings, MailPreview, MailMessage } from '../models/mail.model';
import { environment } from '../../../environments/environment';

const SETTINGS_KEY = 'betnabiso_mail_settings';
const API          = `${environment.apiUrl}/mail`;

@Injectable({ providedIn: 'root' })
export class MailService {
  private http = inject(HttpClient);

  getSettings(): MailSettings | null {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  saveSettings(s: MailSettings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  }

  clearSettings(): void {
    localStorage.removeItem(SETTINGS_KEY);
  }

  async testConnection(s: MailSettings): Promise<{ ok: boolean; total: number; unread: number }> {
    return firstValueFrom(
      this.http.post<{ ok: boolean; total: number; unread: number }>(`${API}?action=test`, { settings: s })
    );
  }

  async getInbox(s: MailSettings, page = 1): Promise<{ emails: MailPreview[]; total: number; pages: number }> {
    return firstValueFrom(
      this.http.post<{ emails: MailPreview[]; total: number; pages: number }>(`${API}?action=inbox`, { settings: s, page })
    );
  }

  async readEmail(s: MailSettings, uid: number): Promise<MailMessage> {
    return firstValueFrom(
      this.http.post<MailMessage>(`${API}?action=read`, { settings: s, uid })
    );
  }
}
