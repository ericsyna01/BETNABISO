import {
  Component, computed, effect, inject, signal, OnInit, OnDestroy, AfterViewChecked,
  ElementRef, ViewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, SlicePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ChatService } from '../../core/services/chat.service';
import { GroupChatService } from '../../core/services/group-chat.service';
import { ChatAttachment } from '../../core/models/chat-message.model';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { PresenceService } from '../../core/services/presence.service';
import { ChatUiService } from '../../core/services/chat-ui.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { User } from '../../core/models/user.model';
import { GroupChat } from '../../core/models/chat-message.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [FormsModule, DatePipe, SlicePipe, MatIconModule, MatButtonModule, MatTooltipModule, MatBadgeModule, MatSnackBarModule, MatMenuModule],
  template: `
    <!-- Panel : le déclencheur vit dans le header (à côté des notifications),
         pour ne jamais flotter au-dessus du contenu d'une page. -->
    @if (isOpen()) {
      <div class="chat-backdrop" (click)="chatUi.close()"></div>
      <div class="chat-panel" [class.with-conversation]="selectedUser() || selectedGroup()">

        <!-- Header panel -->
        <div class="panel-header">
          <div class="panel-title">
            <mat-icon>forum</mat-icon>
            <span>Messages</span>
            @if (presenceSvc.onlineCount() > 0) {
              <span class="online-count-badge">{{ presenceSvc.onlineCount() }} en ligne</span>
            }
          </div>
          <button mat-icon-button class="close-btn" (click)="close()">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div class="panel-body">

          <!-- ── Colonne gauche ───────────────────────── -->
          <div class="users-col">

            @if (view() === 'create-group') {
              <!-- Formulaire création de groupe -->
              <div class="create-group-form">
                <div class="create-group-header">
                  <button mat-icon-button (click)="cancelCreate()" class="back-btn-sm">
                    <mat-icon>arrow_back</mat-icon>
                  </button>
                  <span>Nouveau groupe</span>
                </div>
                <div class="create-group-body">
                  <div class="cg-field">
                    <mat-icon>group</mat-icon>
                    <input type="text" [(ngModel)]="newGroupName" placeholder="Nom du groupe" class="cg-input">
                  </div>
                  <div class="cg-section-label">Membres</div>
                  <div class="cg-members-list">
                    @for (u of allOtherUsers(); track u.id) {
                      <label class="cg-member-row" [class.selected]="isMemberSelected(u.id)">
                        <input type="checkbox"
                               [checked]="isMemberSelected(u.id)"
                               (change)="toggleMember(u.id)">
                        <div class="u-avatar xs" [class]="'role-' + u.role">{{ initials(u) }}</div>
                        <div class="cg-member-info">
                          <span class="cg-member-name">{{ u.prenom }} {{ u.nom }}</span>
                          <span class="cg-member-role">{{ roleLabel(u.role) }}</span>
                        </div>
                        @if (presenceSvc.isOnline(u.id)) {
                          <span class="dot-online-sm"></span>
                        }
                      </label>
                    }
                  </div>
                  <button class="cg-create-btn"
                          [disabled]="!newGroupName.trim() || selectedMemberIds().length === 0 || creatingGroup"
                          (click)="createGroup()">
                    <mat-icon>group_add</mat-icon>
                    {{ creatingGroup ? 'Création…' : 'Créer le groupe' }}
                  </button>
                </div>
              </div>
            } @else {
              <!-- Liste normale -->
              <div class="users-search">
                <mat-icon>search</mat-icon>
                <input
                  type="text"
                  [ngModel]="searchUser()"
                  (ngModelChange)="searchUser.set($event)"
                  placeholder="Rechercher...">
              </div>

              <div class="users-list">
                <!-- Section Groupes -->
                <div class="section-header">
                  <span>Groupes</span>
                  @if (authSvc.isAdmin()) {
                    <button mat-icon-button class="new-group-btn" (click)="startCreate()"
                            matTooltip="Nouveau groupe">
                      <mat-icon>group_add</mat-icon>
                    </button>
                  }
                </div>

                @for (g of filteredGroups(); track g.id) {
                  <div class="user-row group-row"
                       [class.active]="selectedGroup()?.id === g.id"
                       (click)="selectGroup(g)">
                    <div class="group-avatar">{{ groupSvc.groupInitials(g.name) }}</div>
                    <div class="u-info">
                      <div class="u-name">{{ g.name }}</div>
                      <div class="u-preview">
                        {{ groupSvc.getLastMessage(g.id)?.content | slice:0:28 }}
                        {{ (groupSvc.getLastMessage(g.id)?.content?.length ?? 0) > 28 ? '…' : '' }}
                        @if (!groupSvc.getLastMessage(g.id)) {
                          <span class="u-role-tag">{{ g.members.length }} membres</span>
                        }
                      </div>
                    </div>
                    @if (groupSvc.unreadCount(g.id) > 0) {
                      <span class="unread-dot">{{ groupSvc.unreadCount(g.id) }}</span>
                    }
                  </div>
                }

                @if (filteredGroups().length === 0 && !searchUser()) {
                  <div class="no-groups">
                    @if (authSvc.isAdmin()) {
                      <p>Aucun groupe — <span class="link" (click)="startCreate()">créer</span></p>
                    } @else {
                      <p>Aucun groupe</p>
                    }
                  </div>
                }

                <!-- Section Direct -->
                <div class="section-header">
                  <span>Direct</span>
                </div>

                @for (u of filteredUsers(); track u.id) {
                  <div class="user-row"
                       [class.active]="selectedUser()?.id === u.id"
                       (click)="selectUser(u)">
                    <div class="avatar-wrap">
                      <div class="u-avatar" [class]="'role-' + u.role">{{ initials(u) }}</div>
                      <span class="presence-dot" [class.online]="presenceSvc.isOnline(u.id)"></span>
                    </div>
                    <div class="u-info">
                      <div class="u-name">
                        {{ u.prenom }} {{ u.nom }}
                        @if (presenceSvc.isOnline(u.id)) {
                          <span class="online-label">en ligne</span>
                        }
                      </div>
                      <div class="u-preview">
                        {{ lastMessage(u.id)?.content | slice:0:28 }}{{ (lastMessage(u.id)?.content?.length ?? 0) > 28 ? '…' : '' }}
                        @if (!lastMessage(u.id)) {
                          <span class="u-role-tag">{{ roleLabel(u.role) }}</span>
                        }
                      </div>
                    </div>
                    @if (chatSvc.unreadFrom(u.id) > 0) {
                      <span class="unread-dot">{{ chatSvc.unreadFrom(u.id) }}</span>
                    }
                  </div>
                }

                @if (filteredUsers().length === 0 && filteredGroups().length === 0) {
                  <div class="no-users">
                    <mat-icon>person_off</mat-icon>
                    <p>Aucun résultat</p>
                  </div>
                }
              </div>
            }
          </div>

          <!-- ── Conversation ──────────────────────────── -->
          @if (selectedUser() || selectedGroup()) {
            <div class="conversation-col">

              <!-- En-tête -->
              <div class="conv-header">
                @if (selectedUser()) {
                  <div class="avatar-wrap">
                    <div class="u-avatar sm" [class]="'role-' + selectedUser()!.role">
                      {{ initials(selectedUser()!) }}
                    </div>
                    <span class="presence-dot sm" [class.online]="presenceSvc.isOnline(selectedUser()!.id)"></span>
                  </div>
                  <div>
                    <div class="conv-name">{{ selectedUser()!.prenom }} {{ selectedUser()!.nom }}</div>
                    <div class="conv-role">
                      {{ roleLabel(selectedUser()!.role) }}
                      @if (presenceSvc.isOnline(selectedUser()!.id)) {
                        <span class="conv-online">· en ligne</span>
                      } @else {
                        <span class="conv-offline">· hors ligne</span>
                      }
                    </div>
                  </div>
                } @else {
                  <div class="group-avatar sm">{{ groupSvc.groupInitials(selectedGroup()!.name) }}</div>
                  <div>
                    <div class="conv-name">{{ selectedGroup()!.name }}</div>
                    <div class="conv-role members-trigger" [matMenuTriggerFor]="membersMenu">
                      {{ selectedGroup()!.members.length }} membres <mat-icon class="members-caret">expand_more</mat-icon>
                    </div>
                  </div>
                  <mat-menu #membersMenu="matMenu">
                    <div class="members-menu-title">Membres du groupe</div>
                    @for (u of selectedGroupMembers(); track u.id) {
                      <div class="cg-member-row" (click)="$event.stopPropagation()">
                        <div class="u-avatar xs" [class]="'role-' + u.role">{{ initials(u) }}</div>
                        <div class="cg-member-info">
                          <span class="cg-member-name">{{ u.prenom }} {{ u.nom }}</span>
                          <span class="cg-member-role">{{ roleLabel(u.role) }}</span>
                        </div>
                      </div>
                    }
                  </mat-menu>
                }
                @if (selectedGroup() && authSvc.isAdmin()) {
                  <button mat-icon-button class="delete-group-btn" (click)="deleteGroup()" matTooltip="Supprimer le groupe">
                    <mat-icon>delete</mat-icon>
                  </button>
                }
                <button mat-icon-button class="back-btn" (click)="closeConversation()" matTooltip="Retour">
                  <mat-icon>arrow_back</mat-icon>
                </button>
              </div>

              <!-- Messages -->
              <div class="messages-area" #messagesArea>
                @if (selectedUser()) {
                  @if (conversation().length === 0) {
                    <div class="no-messages">
                      <mat-icon>chat_bubble_outline</mat-icon>
                      <p>Démarrez la conversation</p>
                    </div>
                  }
                  @for (msg of conversation(); track msg.id) {
                    <div class="msg-row" [class.mine]="msg.fromId === myId()">
                      <div class="bubble" [class.mine]="msg.fromId === myId()">
                        @if (msg.attachment) {
                          @if (msg.attachment.isImage) {
                            <img [src]="msg.attachment.url" class="bubble-img"
                                 (click)="openImg(msg.attachment!.url)">
                          } @else {
                            <a [href]="msg.attachment.url" target="_blank" class="bubble-file">
                              <mat-icon>attach_file</mat-icon>
                              <span>{{ msg.attachment.name }}</span>
                            </a>
                          }
                        }
                        @if (msg.content && msg.content !== '📎') {
                          <div class="bubble-text">{{ msg.content }}</div>
                        }
                        <div class="bubble-meta">
                          <span class="bubble-time">{{ msg.createdAt | date:'HH:mm' }}</span>
                          @if (msg.fromId === myId()) {
                            <span class="read-tick"
                                  [class.read]="!!msg.readAt"
                                  [matTooltip]="msg.readAt ? ('Lu à ' + (msg.readAt | date:'HH:mm')) : 'Envoyé'">
                              <mat-icon>{{ msg.readAt ? 'done_all' : 'done' }}</mat-icon>
                            </span>
                          }
                        </div>
                      </div>
                    </div>
                  }
                } @else {
                  @if (groupConversation().length === 0) {
                    <div class="no-messages">
                      <mat-icon>chat_bubble_outline</mat-icon>
                      <p>Aucun message dans ce groupe</p>
                    </div>
                  }
                  @for (msg of groupConversation(); track msg.id) {
                    <div class="msg-row" [class.mine]="msg.fromId === myId()">
                      @if (msg.fromId !== myId()) {
                        <div class="group-sender-avatar" [class]="'role-' + msg.fromRole">
                          {{ senderInitials(msg.fromNom) }}
                        </div>
                      }
                      <div class="bubble group-bubble" [class.mine]="msg.fromId === myId()">
                        @if (msg.fromId !== myId()) {
                          <div class="group-sender-name">{{ msg.fromNom }}</div>
                        }
                        @if (msg.attachment) {
                          @if (msg.attachment.isImage) {
                            <img [src]="msg.attachment.url" class="bubble-img"
                                 (click)="openImg(msg.attachment!.url)">
                          } @else {
                            <a [href]="msg.attachment.url" target="_blank" class="bubble-file">
                              <mat-icon>attach_file</mat-icon>
                              <span>{{ msg.attachment.name }}</span>
                            </a>
                          }
                        }
                        @if (msg.content && msg.content !== '📎') {
                          <div class="bubble-text">{{ msg.content }}</div>
                        }
                        <div class="bubble-meta">
                          <span class="bubble-time">{{ msg.createdAt | date:'HH:mm' }}</span>
                        </div>
                      </div>
                    </div>
                  }
                }
              </div>

              <!-- Saisie -->
              <div class="input-area">
                @if (attachmentPreview()) {
                  <div class="attach-preview">
                    @if (attachmentPreview()!.isImage) {
                      <img [src]="attachmentPreview()!.url" class="attach-thumb">
                    } @else {
                      <mat-icon>attach_file</mat-icon>
                    }
                    <span class="attach-name">{{ attachmentPreview()!.name }}</span>
                    <button mat-icon-button class="attach-remove" (click)="clearAttachment()">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                }
                <div class="input-row">
                  <input type="file" #fileInput accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                         style="display:none" (change)="onFileSelected($event)">
                  <button mat-icon-button class="attach-btn" (click)="fileInput.click()"
                          matTooltip="Joindre un fichier" [disabled]="sending">
                    <mat-icon>attach_file</mat-icon>
                  </button>
                  <input
                    type="text"
                    [(ngModel)]="newMessage"
                    (keydown.enter)="send()"
                    placeholder="Votre message..."
                    [disabled]="sending">
                  <button mat-icon-button class="send-btn"
                          (click)="send()"
                          [disabled]="(!newMessage.trim() && !attachmentPreview()) || sending">
                    <mat-icon>send</mat-icon>
                  </button>
                </div>
              </div>
            </div>

          } @else {
            <div class="conversation-placeholder">
              <mat-icon>forum</mat-icon>
              <p>Sélectionnez un utilisateur<br>ou un groupe pour démarrer</p>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    /* ── Panel ─────────────────────────────
       Ouvert depuis le header (déclencheur à côté des notifications), pour
       ne jamais flotter au-dessus du contenu d'une page comme le faisait
       l'ancien bouton flottant en bas à droite. */
    /* Fond invisible plein écran : cliquer n'importe où en dehors du panneau
       le ferme, sans avoir à viser la croix. */
    .chat-backdrop {
      position: fixed; inset: 0; z-index: 998; background: transparent;
    }
    .chat-panel {
      position: fixed; top: calc(var(--header-height) + 8px); right: 28px;
      width: 340px; height: 520px;
      background: white; border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.18);
      display: flex; flex-direction: column; overflow: hidden;
      z-index: 999; animation: slideUp 0.2s ease;
    }
    .chat-panel.with-conversation { width: 640px; }

    @media (max-width: 640px) {
      .chat-panel, .chat-panel.with-conversation {
        top: 0; left: 0; right: 0;
        width: 100%; border-radius: 0;
        /* 100vh ne se réduit pas quand le clavier mobile s'ouvre sur iOS
           Safari (position:fixed + bottom:0 reste ancré à l'ancienne
           hauteur) : le contenu de la page en dessous devient visible.
           100dvh suit la hauteur visible réelle et remplace bottom:0. */
        height: 100vh;
        height: 100dvh;
      }
      .users-col { width: 100%; }
      .chat-panel.with-conversation .users-col { display: none; }
      .chat-panel .conversation-col { display: none; width: 100%; }
      .chat-panel.with-conversation .conversation-col { display: flex; }
      /* Placeholder "sélectionnez une conversation" : n'a de sens qu'à
         côté de la colonne utilisateurs en desktop ; en mobile la liste
         seule occupe déjà tout l'écran quand rien n'est sélectionné. */
      .chat-panel .conversation-placeholder { display: none; }
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Header ─────────────────────────── */
    .panel-header {
      background: linear-gradient(135deg, #1a3a5c, #2a5fa0);
      color: white; padding: 12px 16px;
      display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
    }
    .panel-title { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; }
    .panel-title mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .close-btn { color: white !important; width: 28px; height: 28px; }

    /* ── Body ────────────────────────────── */
    .panel-body { display: flex; flex: 1; overflow: hidden; }

    /* ── Colonne utilisateurs ─────────────── */
    .users-col {
      width: 300px; flex-shrink: 0;
      display: flex; flex-direction: column;
      border-right: 1px solid #f0f0f0;
    }
    .users-search {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px; border-bottom: 1px solid #f0f0f0; background: #fafafa;
    }
    .users-search mat-icon { font-size: 16px; color: #aaa; }
    .users-search input { flex: 1; border: none; background: none; outline: none; font-size: 13px; color: #333; }

    .users-list { flex: 1; overflow-y: auto; }

    .section-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 6px 12px 4px;
      font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
      color: #999; text-transform: uppercase;
      border-bottom: 1px solid #f5f5f5; background: #fafafa;
    }
    .new-group-btn { width: 24px; height: 24px; color: #2a5fa0 !important; }
    .new-group-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .user-row {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 14px; cursor: pointer;
      transition: background 0.15s; border-bottom: 1px solid #fafafa;
    }
    .user-row:hover { background: #f5f7fa; }
    .user-row.active { background: #e8f0fe; }

    /* Avatars */
    .u-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; color: white; flex-shrink: 0;
    }
    .u-avatar.sm  { width: 30px; height: 30px; font-size: 10px; }
    .u-avatar.xs  { width: 28px; height: 28px; font-size: 10px; }
    .u-avatar.role-superadmin { background: linear-gradient(135deg,#1a3a5c,#2a5fa0); }
    .u-avatar.role-admin      { background: linear-gradient(135deg,#6a1b9a,#ab47bc); }
    .u-avatar.role-support    { background: linear-gradient(135deg,#1565c0,#42a5f5); }
    .u-avatar.role-technicien { background: linear-gradient(135deg,#2e7d32,#66bb6a); }
    .u-avatar.role-chauffeur  { background: linear-gradient(135deg,#e65100,#ffa726); }

    .group-avatar {
      width: 36px; height: 36px; border-radius: 10px;
      background: linear-gradient(135deg,#37474f,#546e7a);
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; color: white; flex-shrink: 0;
    }
    .group-avatar.sm { width: 30px; height: 30px; border-radius: 8px; font-size: 10px; }

    .u-info { flex: 1; min-width: 0; }
    .u-name { font-size: 13px; font-weight: 600; color: #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .u-preview { font-size: 11px; color: #999; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
    .u-role-tag { font-size: 10px; background: #f0f0f0; color: #777; padding: 1px 6px; border-radius: 4px; }

    .unread-dot {
      background: #1565c0; color: white; border-radius: 10px;
      font-size: 10px; font-weight: 700; padding: 2px 6px;
      min-width: 18px; text-align: center; flex-shrink: 0;
    }
    .no-users, .no-groups {
      text-align: center; padding: 16px 20px; color: #ccc;
    }
    .no-users mat-icon { font-size: 36px; width: 36px; height: 36px; display: block; margin: 0 auto 8px; }
    .no-users p, .no-groups p { font-size: 12px; margin: 0; }
    .link { color: #2a5fa0; cursor: pointer; text-decoration: underline; }

    /* ── Présence ─────────────────────────── */
    .online-count-badge {
      background: rgba(255,255,255,0.18); border-radius: 10px;
      font-size: 10px; font-weight: 600; padding: 2px 8px; margin-left: 6px;
      display: flex; align-items: center; gap: 4px;
    }
    .online-count-badge::before {
      content: ''; width: 6px; height: 6px; background: #4caf50; border-radius: 50%; display: inline-block;
    }
    .avatar-wrap { position: relative; flex-shrink: 0; }
    .presence-dot {
      position: absolute; bottom: 0; right: 0;
      width: 10px; height: 10px; border-radius: 50%;
      background: #bdbdbd; border: 2px solid white;
    }
    .presence-dot.online { background: #4caf50; }
    .presence-dot.sm { width: 8px; height: 8px; }
    .dot-online-sm {
      width: 7px; height: 7px; border-radius: 50%; background: #4caf50; flex-shrink: 0;
    }
    .online-label { font-size: 10px; color: #4caf50; font-weight: 600; margin-left: 4px; }
    .conv-online  { color: #4caf50; font-size: 10px; font-weight: 600; }
    .conv-offline { color: #9e9e9e; font-size: 10px; }

    /* ── Formulaire création groupe ──────── */
    .create-group-form { display: flex; flex-direction: column; height: 100%; }
    .create-group-header {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px; border-bottom: 1px solid #f0f0f0;
      font-size: 14px; font-weight: 600; color: #1a3a5c;
      background: #fafafa; flex-shrink: 0;
    }
    .back-btn-sm { width: 28px; height: 28px; color: #666 !important; }
    .back-btn-sm mat-icon { font-size: 18px; }
    .create-group-body { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
    .cg-field {
      display: flex; align-items: center; gap: 8px;
      border: 1px solid #e0e0e0; border-radius: 10px; padding: 8px 12px;
      background: #fafafa;
    }
    .cg-field mat-icon { font-size: 18px; color: #999; }
    .cg-input { flex: 1; border: none; background: none; outline: none; font-size: 13px; }
    .cg-section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #aaa; }
    .cg-members-list { display: flex; flex-direction: column; gap: 4px; flex: 1; }
    .cg-member-row {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 8px; border-radius: 8px; cursor: pointer;
      transition: background 0.15s;
    }
    .cg-member-row:hover { background: #f5f7fa; }
    .cg-member-row.selected { background: #e8f0fe; }
    .cg-member-row input[type=checkbox] { accent-color: #2a5fa0; }
    .cg-member-info { flex: 1; }
    .cg-member-name { font-size: 12px; font-weight: 600; display: block; }
    .cg-member-role { font-size: 10px; color: #999; }
    .cg-create-btn {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      padding: 10px; border-radius: 10px;
      background: linear-gradient(135deg,#1a3a5c,#2a5fa0); color: white;
      border: none; cursor: pointer; font-size: 13px; font-weight: 600;
      transition: opacity 0.2s;
    }
    .cg-create-btn[disabled] { opacity: 0.5; cursor: not-allowed; }
    .cg-create-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }

    /* ── Conversation ─────────────────────── */
    .conversation-col { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .conv-header {
      padding: 10px 14px; border-bottom: 1px solid #f0f0f0;
      display: flex; align-items: center; gap: 10px;
      background: #fafafa; flex-shrink: 0;
    }
    .conv-name { font-size: 13px; font-weight: 600; }
    .conv-role { font-size: 11px; color: #999; }
    .members-trigger { display: flex; align-items: center; gap: 2px; cursor: pointer; width: fit-content; }
    .members-trigger:hover { color: #2a5fa0; }
    .members-caret { font-size: 14px; width: 14px; height: 14px; }
    .members-menu-title { padding: 8px 12px 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #aaa; }
    .back-btn { margin-left: auto; color: #666 !important; width: 28px; height: 28px; }
    .delete-group-btn { margin-left: auto; color: #c62828 !important; width: 28px; height: 28px; }
    .delete-group-btn + .back-btn { margin-left: 0; }

    .messages-area {
      flex: 1; overflow-y: auto; padding: 12px;
      display: flex; flex-direction: column; gap: 6px; background: #f8f9fb;
    }
    .no-messages { text-align: center; padding: 40px 20px; color: #ccc; margin: auto; }
    .no-messages mat-icon { font-size: 40px; width: 40px; height: 40px; display: block; margin: 0 auto 8px; }
    .no-messages p { font-size: 12px; margin: 0; }

    .msg-row { display: flex; align-items: flex-end; gap: 6px; }
    .msg-row.mine { justify-content: flex-end; }

    .bubble {
      max-width: 74%; background: white;
      border-radius: 12px 12px 12px 2px; padding: 8px 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .bubble.mine {
      background: linear-gradient(135deg, #1a3a5c, #2a5fa0);
      color: white; border-radius: 12px 12px 2px 12px;
    }
    .bubble-text { font-size: 13px; line-height: 1.4; word-break: break-word; }
    .bubble-meta {
      display: flex; align-items: center; justify-content: flex-end;
      gap: 3px; margin-top: 3px;
    }
    .bubble-time { font-size: 10px; color: rgba(0,0,0,0.4); }
    .bubble.mine .bubble-time { color: rgba(255,255,255,0.6); }
    .read-tick mat-icon { font-size: 13px; width: 13px; height: 13px; color: rgba(255,255,255,0.5); display: block; }
    .read-tick.read mat-icon { color: #90caf9; }

    /* Groupes messages */
    .group-sender-avatar {
      width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 9px; font-weight: 700; color: white;
    }
    .group-sender-avatar.role-superadmin { background: linear-gradient(135deg,#1a3a5c,#2a5fa0); }
    .group-sender-avatar.role-admin      { background: linear-gradient(135deg,#6a1b9a,#ab47bc); }
    .group-sender-avatar.role-support    { background: linear-gradient(135deg,#1565c0,#42a5f5); }
    .group-sender-avatar.role-technicien { background: linear-gradient(135deg,#2e7d32,#66bb6a); }
    .group-sender-avatar.role-chauffeur  { background: linear-gradient(135deg,#e65100,#ffa726); }
    .group-bubble { border-radius: 2px 12px 12px 12px; }
    .group-bubble.mine { border-radius: 12px 12px 2px 12px; }
    .group-sender-name { font-size: 10px; font-weight: 700; color: #546e7a; margin-bottom: 3px; }

    .input-area {
      display: flex; flex-direction: column; gap: 4px;
      padding: 8px 12px; border-top: 1px solid #f0f0f0;
      background: white; flex-shrink: 0;
    }
    .input-row { display: flex; align-items: center; gap: 4px; }
    .input-row input {
      flex: 1; border: 1px solid #e0e0e0; border-radius: 20px;
      padding: 8px 14px; font-size: 13px; outline: none;
      background: #fafafa; transition: border-color 0.2s;
    }
    .input-row input:focus { border-color: #2a5fa0; background: white; }
    .send-btn  { color: #2a5fa0 !important; flex-shrink: 0; }
    .attach-btn { color: #888 !important; flex-shrink: 0; }
    .send-btn[disabled], .attach-btn[disabled] { color: #ccc !important; }

    .attach-preview {
      display: flex; align-items: center; gap: 6px;
      background: #f0f4ff; border-radius: 8px; padding: 4px 8px;
      font-size: 11px; color: #333;
    }
    .attach-thumb { width: 40px; height: 40px; object-fit: cover; border-radius: 6px; }
    .attach-name  { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .attach-remove { width: 24px; height: 24px; color: #999 !important; }
    .attach-remove mat-icon { font-size: 14px; }

    .bubble-img {
      max-width: 180px; max-height: 140px; border-radius: 8px;
      display: block; cursor: pointer; object-fit: cover; margin-bottom: 4px;
    }
    .bubble-file {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; color: #1565c0; text-decoration: none;
      background: rgba(255,255,255,0.15); border-radius: 6px;
      padding: 4px 8px; margin-bottom: 4px;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }
    .bubble.mine .bubble-file { color: #90caf9; }

    .conversation-placeholder {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      color: #ccc; gap: 12px; background: #fafafa;
      padding: 20px; text-align: center;
    }
    .conversation-placeholder mat-icon { font-size: 48px; width: 48px; height: 48px; }
    .conversation-placeholder p { font-size: 13px; margin: 0; line-height: 1.5; }
  `]
})
export class ChatPanelComponent implements OnDestroy, AfterViewChecked {
  chatSvc     = inject(ChatService);
  groupSvc    = inject(GroupChatService);
  userSvc     = inject(UserService);
  authSvc     = inject(AuthService);
  presenceSvc = inject(PresenceService);
  private snack = inject(MatSnackBar);
  private confirmSvc = inject(ConfirmService);
  chatUi      = inject(ChatUiService);

  @ViewChild('messagesArea') messagesArea?: ElementRef<HTMLDivElement>;

  isOpen        = this.chatUi.isOpen;
  selectedUser  = signal<User | null>(null);
  selectedGroup = signal<GroupChat | null>(null);
  selectedGroupMembers = computed(() => {
    const g = this.selectedGroup();
    if (!g) return [];
    return g.members
      .map(id => this.userSvc.getById(id))
      .filter((u): u is User => !!u);
  });
  searchUser    = signal('');
  view          = signal<'list' | 'create-group'>('list');
  newMessage       = '';
  newGroupName     = '';
  selectedMemberIds = signal<string[]>([]);
  sending          = false;
  creatingGroup    = false;
  attachmentPreview = signal<ChatAttachment | null>(null);
  private pendingFile: File | null = null;
  private shouldScroll = false;
  private pollInterval?: ReturnType<typeof setInterval>;

  private autoScrollEffect = effect(() => {
    const d = this.conversation();
    const g = this.groupConversation();
    const msgs = this.selectedUser() ? d : g;
    if (msgs.length > 0 && this.isOpen()) {
      this.shouldScroll = true;
    }
  });

  myId = computed(() => this.authSvc.currentUser()?.id);

  totalUnread = computed(() =>
    this.chatSvc.unreadCount() + this.groupSvc.totalUnread()
  );

  allOtherUsers = computed(() => {
    const me = this.myId();
    return this.userSvc.getAll().filter(u => u.id !== me && u.actif);
  });

  filteredUsers = computed(() => {
    const me = this.myId();
    const q  = this.searchUser().toLowerCase().trim();
    return this.userSvc.getAll()
      .filter(u => u.id !== me && u.actif)
      .filter(u => !q ||
        u.prenom.toLowerCase().includes(q) ||
        u.nom.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const ua = this.chatSvc.unreadFrom(a.id);
        const ub = this.chatSvc.unreadFrom(b.id);
        if (ub !== ua) return ub - ua;
        const la = this.chatSvc.getLastMessage(a.id)?.createdAt ?? '';
        const lb = this.chatSvc.getLastMessage(b.id)?.createdAt ?? '';
        return lb.localeCompare(la);
      });
  });

  filteredGroups = computed(() => {
    const q = this.searchUser().toLowerCase().trim();
    return this.groupSvc.getGroups()
      .filter(g => !q || g.name.toLowerCase().includes(q));
  });

  conversation = computed(() => {
    const u = this.selectedUser();
    return u ? this.chatSvc.getConversation(u.id) : [];
  });

  groupConversation = computed(() => {
    const g = this.selectedGroup();
    return g ? this.groupSvc.getMessages(g.id) : [];
  });

  // Le déclencheur vit dans le header (ChatUiService partagé) ; cet effet
  // réagit à l'ouverture/fermeture quelle que soit son origine.
  private chatOpenEffect = effect(() => {
    if (this.isOpen()) {
      this.chatSvc.loadFromApi();
      this.groupSvc.loadGroups();
      if (!this.pollInterval) this.startPolling();
    } else {
      this.stopPolling();
    }
  });

  close(): void {
    this.chatUi.close();
    this.selectedUser.set(null);
    this.selectedGroup.set(null);
    this.view.set('list');
  }

  closeConversation(): void {
    this.selectedUser.set(null);
    this.selectedGroup.set(null);
  }

  selectUser(u: User): void {
    this.selectedUser.set(u);
    this.selectedGroup.set(null);
    this.chatSvc.markAsRead(u.id);
    this.shouldScroll = true;
  }

  async selectGroup(g: GroupChat): Promise<void> {
    this.selectedGroup.set(g);
    this.selectedUser.set(null);
    await this.groupSvc.loadMessages(g.id);
    this.groupSvc.markRead(g.id);
    this.shouldScroll = true;
  }

  startCreate(): void {
    this.view.set('create-group');
    this.newGroupName = '';
    this.selectedMemberIds.set([]);
  }

  cancelCreate(): void {
    this.view.set('list');
  }

  toggleMember(id: string): void {
    const cur = this.selectedMemberIds();
    if (cur.includes(id)) {
      this.selectedMemberIds.set(cur.filter(x => x !== id));
    } else {
      this.selectedMemberIds.set([...cur, id]);
    }
  }

  isMemberSelected(id: string): boolean {
    return this.selectedMemberIds().includes(id);
  }

  async deleteGroup(): Promise<void> {
    const group = this.selectedGroup();
    if (!group) return;
    const ok = await this.confirmSvc.danger(
      `Supprimer le groupe "${group.name}" ? Tous ses messages seront perdus définitivement.`,
      'Supprimer le groupe'
    );
    if (!ok) return;
    try {
      await this.groupSvc.delete(group.id);
      this.selectedGroup.set(null);
      this.snack.open('Groupe supprimé', 'OK', { duration: 2000, panelClass: 'success-snack' });
    } catch {
      this.snack.open('Impossible de supprimer le groupe', 'OK', { duration: 2500, panelClass: 'error-snack' });
    }
  }

  async createGroup(): Promise<void> {
    const name = this.newGroupName.trim();
    const members = this.selectedMemberIds();
    if (!name || members.length === 0 || this.creatingGroup) return;
    this.creatingGroup = true;
    try {
      const group = await this.groupSvc.createGroup(name, members);
      this.view.set('list');
      await this.selectGroup(group);
    } catch (err) {
      console.error('Erreur création groupe', err);
      alert('Impossible de créer le groupe. Vérifiez que les tables SQL sont créées.');
    } finally {
      this.creatingGroup = false;
    }
  }

  lastMessage(userId: string) {
    return this.chatSvc.getLastMessage(userId);
  }

  async send(): Promise<void> {
    const content = this.newMessage.trim();
    const hasAttachment = !!this.pendingFile;
    if (!content && !hasAttachment) return;
    if (this.sending) return;
    this.sending = true;
    this.newMessage = '';

    const attachment = hasAttachment ? await this.uploadFile() : null;
    this.clearAttachment();

    if (hasAttachment && !attachment) {
      this.snack.open('Échec de l\'envoi du fichier, réessayez', 'OK', { duration: 3500, panelClass: 'error-snack' });
      this.newMessage = content;
      this.sending = false;
      return;
    }

    if (this.selectedUser()) {
      const u = this.selectedUser()!;
      await this.chatSvc.send(u.id, `${u.prenom} ${u.nom}`, content || '📎', attachment);
    } else if (this.selectedGroup()) {
      const g = this.selectedGroup()!;
      await this.groupSvc.send(g.id, content || '📎', attachment);
      this.groupSvc.markRead(g.id);
    }

    this.sending = false;
    this.shouldScroll = true;
  }

  initials(u: User): string {
    return `${u.prenom[0]}${u.nom[0]}`.toUpperCase();
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.pendingFile = file;
    const isImage = file.type.startsWith('image/');
    if (isImage) {
      const reader = new FileReader();
      reader.onload = e => this.attachmentPreview.set({
        url: e.target!.result as string,
        name: file.name, size: file.size,
        mimeType: file.type, isImage: true,
      });
      reader.readAsDataURL(file);
    } else {
      this.attachmentPreview.set({
        url: '', name: file.name, size: file.size,
        mimeType: file.type, isImage: false,
      });
    }
  }

  clearAttachment(): void {
    this.attachmentPreview.set(null);
    this.pendingFile = null;
  }

  private async uploadFile(): Promise<ChatAttachment | null> {
    if (!this.pendingFile) return null;
    try {
      const formData = new FormData();
      formData.append('file', this.pendingFile);
      const token = JSON.parse(localStorage.getItem('betnabiso_auth') ?? '{}')?.token ?? '';
      const res = await fetch(`${environment.apiUrl}/uploads`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) return null;
      const json = await res.json();
      return {
        url: json.url,
        name: this.pendingFile.name,
        size: this.pendingFile.size,
        mimeType: this.pendingFile.type,
        isImage: this.pendingFile.type.startsWith('image/'),
      };
    } catch { return null; }
  }

  openImg(url: string): void { window.open(url, '_blank'); }

  senderInitials(nom: string): string {
    return nom.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);
  }

  roleLabel(role: string): string {
    const map: Record<string, string> = {
      superadmin: 'Super Admin', admin: 'Admin', support: 'Support',
      technicien: 'Technicien', chauffeur: 'Chauffeur'
    };
    return map[role] ?? role;
  }

  private startPolling(): void {
    this.pollInterval = setInterval(() => {
      this.chatSvc.loadFromApi();
      const g = this.selectedGroup();
      if (g) this.groupSvc.loadMessages(g.id);
    }, 2000);
  }

  private stopPolling(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll && this.messagesArea) {
      const el = this.messagesArea.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.shouldScroll = false;
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.autoScrollEffect.destroy();
    this.chatOpenEffect.destroy();
  }
}
