import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { GroupChat, GroupMessage, ChatAttachment } from '../models/chat-message.model';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

const API           = `${environment.apiUrl}/groups`;
const LASTREAD_KEY  = 'betnabiso_group_lastread';

@Injectable({ providedIn: 'root' })
export class GroupChatService {
  private _groups   = signal<GroupChat[]>([]);
  private _messages = signal<Record<string, GroupMessage[]>>({});
  private _lastRead = signal<Record<string, string>>(this.readLastRead());

  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private readLastRead(): Record<string, string> {
    return JSON.parse(localStorage.getItem(LASTREAD_KEY) ?? '{}');
  }

  async loadGroups(): Promise<void> {
    try {
      const groups = await firstValueFrom(this.http.get<GroupChat[]>(API));
      this._groups.set(groups);
    } catch { /* ignore */ }
  }

  getGroups(): GroupChat[] { return this._groups(); }

  async loadMessages(groupId: string): Promise<void> {
    try {
      const msgs = await firstValueFrom(
        this.http.get<GroupMessage[]>(`${API}/${groupId}?action=messages`)
      );
      this._messages.update(m => ({ ...m, [groupId]: msgs }));
    } catch { /* ignore */ }
  }

  getMessages(groupId: string): GroupMessage[] {
    return this._messages()[groupId] ?? [];
  }

  getLastMessage(groupId: string): GroupMessage | undefined {
    return this.getMessages(groupId).at(-1);
  }

  async createGroup(name: string, memberIds: string[]): Promise<GroupChat> {
    const group = await firstValueFrom(
      this.http.post<GroupChat>(API, { name, memberIds })
    );
    this._groups.update(gs => [group, ...gs]);
    return group;
  }

  async send(groupId: string, content: string, attachment?: ChatAttachment | null): Promise<void> {
    const user = this.auth.currentUser();
    if (!user) return;
    const tempMsg: GroupMessage = {
      id: `temp-${Date.now()}`,
      groupId,
      fromId: user.id,
      fromNom: `${user.prenom} ${user.nom}`,
      fromRole: user.role,
      content,
      attachment: attachment ?? null,
      createdAt: new Date().toISOString(),
    };
    this._messages.update(m => ({ ...m, [groupId]: [...(m[groupId] ?? []), tempMsg] }));
    try {
      const saved = await firstValueFrom(
        this.http.post<GroupMessage>(`${API}/${groupId}`, { content, attachment: attachment ?? null })
      );
      this._messages.update(m => ({
        ...m,
        [groupId]: (m[groupId] ?? []).map(msg => msg.id === tempMsg.id ? saved : msg),
      }));
    } catch { /* keep optimistic */ }
  }

  async delete(groupId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${API}/${groupId}`));
    this._groups.update(gs => gs.filter(g => g.id !== groupId));
    this._messages.update(m => {
      const { [groupId]: _removed, ...rest } = m;
      return rest;
    });
  }

  markRead(groupId: string): void {
    const updated = { ...this.readLastRead(), [groupId]: new Date().toISOString() };
    localStorage.setItem(LASTREAD_KEY, JSON.stringify(updated));
    this._lastRead.set(updated);
  }

  unreadCount(groupId: string): number {
    const lastRead = this._lastRead()[groupId] ?? '';
    const myId = this.auth.currentUser()?.id;
    return (this._messages()[groupId] ?? []).filter(
      m => m.fromId !== myId && m.createdAt > lastRead
    ).length;
  }

  totalUnread(): number {
    return this._groups().reduce((sum, g) => sum + this.unreadCount(g.id), 0);
  }

  groupInitials(name: string): string {
    return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);
  }
}
