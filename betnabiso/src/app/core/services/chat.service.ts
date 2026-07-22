import { Injectable, signal, inject, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ChatMessage, ChatAttachment } from '../models/chat-message.model';
import { AuthService } from './auth.service';
import { SseService } from './sse.service';
import { environment } from '../../../environments/environment';

const MESSAGES_KEY = 'betnabiso_messages';
const API          = `${environment.apiUrl}/messages`;

@Injectable({ providedIn: 'root' })
export class ChatService {
  private _messages = signal<ChatMessage[]>([]);
  private http      = inject(HttpClient);
  private auth      = inject(AuthService);
  private sseSvc    = inject(SseService);

  constructor() {
    this._messages.set(this.readStorage());
    this.loadFromApi();
    this.sseSvc.messageEvents$.subscribe(() => this.loadFromApi());
  }

  private readStorage(): ChatMessage[] {
    return JSON.parse(localStorage.getItem(MESSAGES_KEY) ?? '[]');
  }

  private saveLocal(all: ChatMessage[]): void {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(all));
    this._messages.set([...all]);
  }

  async loadFromApi(): Promise<void> {
    try {
      const msgs = await firstValueFrom(this.http.get<ChatMessage[]>(API));
      this.saveLocal(msgs);
    } catch {
      this._messages.set(this.readStorage());
    }
  }

  getMessages(): ChatMessage[] { return this._messages(); }

  getConversation(withUserId: string): ChatMessage[] {
    const myId = this.auth.currentUser()?.id;
    return this._messages()
      .filter(m =>
        (m.fromId === myId && m.toId === withUserId) ||
        (m.fromId === withUserId && m.toId === myId)
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  getLastMessage(withUserId: string): ChatMessage | undefined {
    return this.getConversation(withUserId).at(-1);
  }

  unreadCount = computed(() => {
    const myId = this.auth.currentUser()?.id;
    return this._messages().filter(m => m.toId === myId && !m.readAt).length;
  });

  unreadFrom(fromId: string): number {
    const myId = this.auth.currentUser()?.id;
    return this._messages().filter(m => m.fromId === fromId && m.toId === myId && !m.readAt).length;
  }

  async send(toId: string, toNom: string, content: string, attachment?: ChatAttachment | null): Promise<void> {
    const user = this.auth.currentUser();
    if (!user) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId, fromId: user.id,
      fromNom: `${user.prenom} ${user.nom}`, fromRole: user.role,
      toId, toNom, content,
      createdAt: new Date().toISOString(), readAt: null,
      attachment: attachment ?? null,
    };
    this.saveLocal([...this._messages(), optimistic]);
    try {
      const saved = await firstValueFrom(
        this.http.post<ChatMessage>(API, { toId, toNom, content, attachment: attachment ?? null })
      );
      this.saveLocal(this._messages().map(m => m.id === tempId ? saved : m));
    } catch { /* garder l'optimiste */ }
  }

  markAsRead(fromId: string): void {
    const myId = this.auth.currentUser()?.id;
    const updated = this._messages().map(m =>
      m.fromId === fromId && m.toId === myId && !m.readAt
        ? { ...m, readAt: new Date().toISOString() }
        : m
    );
    this.saveLocal(updated);
    this.http.patch(`${API}/${fromId}`, {}).subscribe({ error: () => {} });
  }
}
