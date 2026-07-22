import { Component, computed, inject, signal, OnInit, SecurityContext } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MailService } from '../../core/services/mail.service';
import { MailSettings, MailPreview, MailMessage, MAIL_PROVIDERS } from '../../core/models/mail.model';
import { ConfirmService } from '../../core/services/confirm.service';

@Component({
  selector: 'app-mail',
  standalone: true,
  imports: [
    FormsModule, DatePipe,
    MatIconModule, MatButtonModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatCheckboxModule, MatProgressSpinnerModule,
    MatTooltipModule, MatSnackBarModule, MatDividerModule
  ],
  template: `
<div class="mail-page">

  <!-- ── HEADER ─────────────────────────────────────────────── -->
  <div class="mail-header">
    <div class="mail-title">
      <mat-icon>mail</mat-icon>
      <div>
        <h1>Messagerie externe</h1>
        @if (settings()) {
          <p class="mail-account">{{ settings()!.username }}</p>
        }
      </div>
    </div>
    <div class="mail-header-actions">
      @if (settings()) {
        <button mat-stroked-button (click)="refresh()" [disabled]="loading()" matTooltip="Actualiser">
          <mat-icon [class.spin]="loading()">refresh</mat-icon>
        </button>
        <button mat-stroked-button color="warn" (click)="disconnect()" matTooltip="Déconnecter">
          <mat-icon>link_off</mat-icon> Déconnecter
        </button>
      }
    </div>
  </div>

  <!-- ── PAS DE CONFIGURATION ───────────────────────────────── -->
  @if (!settings()) {
    <div class="setup-container">
      <div class="setup-card">
        <div class="setup-icon"><mat-icon>mail_lock</mat-icon></div>
        <h2>Connectez votre messagerie</h2>
        <p class="setup-desc">Entrez vos identifiants IMAP pour accéder à vos emails directement depuis la plateforme.</p>

        <!-- Fournisseur -->
        <div class="provider-grid">
          @for (p of providers; track p.name) {
            <button class="provider-btn" [class.selected]="selectedProvider === p.name"
                    (click)="selectProvider(p)">
              <mat-icon>{{ p.host ? 'mail' : 'settings' }}</mat-icon>
              <span>{{ p.name }}</span>
            </button>
          }
        </div>

        <!-- Formulaire IMAP -->
        <div class="imap-form">
          <div class="form-row">
            <mat-form-field appearance="outline" class="host-field">
              <mat-label>Serveur IMAP</mat-label>
              <input matInput [(ngModel)]="form.host" placeholder="imap.gmail.com">
            </mat-form-field>
            <mat-form-field appearance="outline" class="port-field">
              <mat-label>Port</mat-label>
              <input matInput type="number" [(ngModel)]="form.port">
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline" style="width:100%">
            <mat-label>Adresse email</mat-label>
            <mat-icon matPrefix>person</mat-icon>
            <input matInput type="email" [(ngModel)]="form.username" placeholder="vous@exemple.com">
          </mat-form-field>

          <mat-form-field appearance="outline" style="width:100%">
            <mat-label>Mot de passe</mat-label>
            <mat-icon matPrefix>lock</mat-icon>
            <input matInput [type]="showPass ? 'text' : 'password'" [(ngModel)]="form.password">
            <button matSuffix mat-icon-button (click)="showPass = !showPass" type="button">
              <mat-icon>{{ showPass ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
          </mat-form-field>

          <mat-checkbox [(ngModel)]="form.ssl" color="primary">Connexion SSL/TLS</mat-checkbox>

          @if (selectedProvider === 'Gmail') {
            <div class="gmail-hint">
              <mat-icon>info</mat-icon>
              <span>Gmail : activez l'accès IMAP dans les paramètres Gmail et utilisez un <strong>mot de passe d'application</strong> (non votre mot de passe habituel) si vous avez la validation en deux étapes.</span>
            </div>
          }

          @if (connectError()) {
            <div class="connect-error">
              <mat-icon>error</mat-icon>
              <div>
                <div>{{ connectError() }}</div>
                @if (connectHint()) {
                  <div class="connect-hint">{{ connectHint() }}</div>
                }
              </div>
            </div>
          }

          <div class="form-actions">
            <button mat-stroked-button (click)="testConnection()" [disabled]="connecting()">
              @if (connecting()) { <mat-spinner diameter="16"></mat-spinner> }
              @else { <mat-icon>wifi_tethering</mat-icon> }
              Tester la connexion
            </button>
            <button mat-raised-button color="primary" (click)="connect()" [disabled]="connecting() || !canConnect">
              <mat-icon>login</mat-icon> Se connecter
            </button>
          </div>
        </div>
      </div>
    </div>
  }

  <!-- ── INBOX ──────────────────────────────────────────────── -->
  @if (settings()) {
    <div class="inbox-layout" [class.has-reader]="selectedMail()">

      <!-- Colonne gauche : liste emails -->
      <div class="email-list-col">
        <!-- Barre de recherche -->
        <div class="list-toolbar">
          <div class="search-wrap">
            <mat-icon>search</mat-icon>
            <input type="text" [ngModel]="search()" (ngModelChange)="search.set($event)" placeholder="Rechercher dans la boîte...">
            @if (search()) {
              <button mat-icon-button (click)="search.set('')" class="clear-btn"><mat-icon>close</mat-icon></button>
            }
          </div>
          <span class="email-count">
            @if (total() > 0) { {{ total() }} email(s) }
          </span>
        </div>

        <!-- Erreur chargement -->
        @if (loadError()) {
          <div class="load-error">
            <mat-icon>error_outline</mat-icon>
            <p>{{ loadError() }}</p>
            <button mat-stroked-button (click)="loadInbox()">Réessayer</button>
          </div>
        }

        <!-- Chargement -->
        @if (loading() && emails().length === 0) {
          <div class="loading-state">
            <mat-spinner diameter="36"></mat-spinner>
            <p>Chargement des emails…</p>
          </div>
        }

        <!-- Liste -->
        <div class="email-list">
          @for (mail of filteredEmails(); track mail.uid) {
            <div class="email-item"
                 [class.unread]="!mail.seen"
                 [class.active]="selectedMail()?.uid === mail.uid"
                 (click)="openMail(mail)">
              <div class="email-avatar">{{ senderInitial(mail) }}</div>
              <div class="email-info">
                <div class="email-from">{{ senderName(mail) }}</div>
                <div class="email-subject">{{ mail.subject }}</div>
              </div>
              <div class="email-meta">
                <span class="email-date">{{ mail.date | date:'dd/MM HH:mm' }}</span>
                @if (!mail.seen) { <span class="unread-dot"></span> }
              </div>
            </div>
          }

          @if (!loading() && filteredEmails().length === 0 && !loadError()) {
            <div class="empty-inbox">
              <mat-icon>inbox</mat-icon>
              <p>{{ search() ? 'Aucun résultat' : 'Boîte vide' }}</p>
            </div>
          }
        </div>

        <!-- Pagination -->
        @if (totalPages() > 1) {
          <div class="pagination">
            <button mat-icon-button (click)="prevPage()" [disabled]="page() <= 1">
              <mat-icon>chevron_left</mat-icon>
            </button>
            <span>{{ page() }} / {{ totalPages() }}</span>
            <button mat-icon-button (click)="nextPage()" [disabled]="page() >= totalPages()">
              <mat-icon>chevron_right</mat-icon>
            </button>
          </div>
        }
      </div>

      <!-- Colonne droite : lecteur -->
      @if (selectedMail()) {
        <div class="email-reader-col">
          @if (loadingMail()) {
            <div class="reader-loading">
              <mat-spinner diameter="32"></mat-spinner>
              <p>Chargement…</p>
            </div>
          } @else if (openedMail()) {
            <div class="reader-header">
              <button mat-icon-button (click)="selectedMail.set(null)" matTooltip="Fermer">
                <mat-icon>close</mat-icon>
              </button>
              <h2 class="reader-subject">{{ openedMail()!.subject }}</h2>
            </div>
            <div class="reader-meta">
              <div class="reader-from">
                <div class="from-avatar">{{ senderInitial(openedMail()!) }}</div>
                <div>
                  <div class="from-name">{{ openedMail()!.fromName || openedMail()!.from }}</div>
                  <div class="from-email">{{ openedMail()!.from }}</div>
                </div>
              </div>
              <div class="reader-date">{{ openedMail()!.date | date:'dd/MM/yyyy HH:mm' }}</div>
            </div>
            <div class="reader-to">
              <mat-icon>arrow_forward</mat-icon>
              <span>À : {{ openedMail()!.to }}</span>
            </div>
            <mat-divider></mat-divider>
            <div class="reader-body">
              @if (openedMail()!.isHtml) {
                <div class="html-body" [innerHTML]="safeBody()"></div>
              } @else {
                <pre class="plain-body">{{ openedMail()!.body }}</pre>
              }
            </div>
          }
        </div>
      }

    </div>
  }

</div>
  `,
  styles: [`
    .mail-page { display:flex; flex-direction:column; height:calc(100vh - var(--header-height)); overflow:hidden; background:var(--bg); }

    /* ── Header ───────────────────────────────── */
    .mail-header {
      display:flex; align-items:center; justify-content:space-between;
      padding:16px 24px; background:white; border-bottom:1px solid var(--border);
      flex-shrink:0;
    }
    .mail-title { display:flex; align-items:center; gap:12px; }
    .mail-title mat-icon { font-size:28px; width:28px; height:28px; color:var(--primary); }
    .mail-title h1 { margin:0; font-size:20px; font-weight:700; }
    .mail-account { margin:0; font-size:12px; color:var(--text-secondary); }
    .mail-header-actions { display:flex; gap:8px; }

    /* ── Setup ────────────────────────────────── */
    .setup-container { flex:1; display:flex; align-items:center; justify-content:center; padding:24px; overflow-y:auto; }
    .setup-card { background:white; border-radius:16px; padding:36px 40px; width:100%; max-width:560px; box-shadow:0 4px 24px rgba(0,0,0,.08); }
    .setup-icon { text-align:center; margin-bottom:16px; }
    .setup-icon mat-icon { font-size:56px; width:56px; height:56px; color:var(--primary); }
    .setup-card h2 { text-align:center; font-size:20px; font-weight:700; margin:0 0 8px; }
    .setup-desc { text-align:center; color:var(--text-secondary); font-size:13px; margin:0 0 24px; }

    .provider-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:24px; }
    .provider-btn {
      display:flex; flex-direction:column; align-items:center; gap:4px;
      padding:10px 8px; border:2px solid #e0e0e0; border-radius:10px;
      background:white; cursor:pointer; font-size:11px; font-weight:600; color:#555;
      transition:all 0.2s;
    }
    .provider-btn mat-icon { font-size:20px; width:20px; height:20px; color:var(--primary-light); }
    .provider-btn:hover { border-color:var(--primary); color:var(--primary); }
    .provider-btn.selected { border-color:var(--primary); background:#e8f0fe; color:var(--primary); }

    .imap-form { display:flex; flex-direction:column; gap:12px; }
    .form-row { display:flex; gap:12px; }
    .host-field { flex:1; }
    .port-field { width:110px; }

    .gmail-hint {
      display:flex; align-items:flex-start; gap:8px; background:#fff8e1;
      border:1px solid #ffe082; border-radius:8px; padding:10px 12px;
      font-size:12px; color:#7b5800;
    }
    .gmail-hint mat-icon { font-size:16px; width:16px; height:16px; flex-shrink:0; margin-top:1px; }

    .connect-error {
      display:flex; align-items:center; gap:8px; background:#fce4ec;
      border-radius:8px; padding:10px 12px; font-size:12px; color:#c62828;
    }
    .connect-error mat-icon { font-size:16px; width:16px; height:16px; flex-shrink:0; }
    .connect-hint { font-size:11.5px; color:#b45309; margin-top:4px; }

    .form-actions { display:flex; gap:10px; justify-content:flex-end; margin-top:4px; }

    /* ── Inbox layout ─────────────────────────── */
    .inbox-layout {
      flex:1; display:flex; overflow:hidden;
    }

    /* ── Email list ───────────────────────────── */
    .email-list-col {
      width:380px; flex-shrink:0; display:flex; flex-direction:column;
      border-right:1px solid var(--border); background:white; overflow:hidden;
    }
    .inbox-layout.has-reader .email-list-col { width:320px; }

    .list-toolbar {
      display:flex; align-items:center; gap:8px; padding:10px 12px;
      border-bottom:1px solid #f0f0f0; flex-shrink:0;
    }
    .search-wrap {
      flex:1; display:flex; align-items:center; gap:6px;
      background:#f5f7fa; border-radius:20px; padding:4px 10px;
    }
    .search-wrap mat-icon { font-size:16px; color:#aaa; }
    .search-wrap input { flex:1; border:none; background:none; outline:none; font-size:13px; }
    .clear-btn { width:24px; height:24px; }
    .email-count { font-size:12px; color:var(--text-secondary); white-space:nowrap; }

    .load-error { padding:24px; text-align:center; color:#c62828; }
    .load-error mat-icon { font-size:36px; width:36px; height:36px; display:block; margin:0 auto 8px; }
    .load-error p { font-size:13px; margin:0 0 12px; }

    .loading-state { display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1; gap:12px; color:var(--text-secondary); padding:40px; }
    .loading-state p { font-size:13px; margin:0; }

    .email-list { flex:1; overflow-y:auto; }

    .email-item {
      display:flex; align-items:center; gap:10px; padding:12px 14px;
      cursor:pointer; border-bottom:1px solid #f5f5f5; transition:background 0.15s;
    }
    .email-item:hover { background:#f8f9fa; }
    .email-item.active { background:#e8f0fe; }
    .email-item.unread .email-from { font-weight:700; color:#111; }
    .email-item.unread .email-subject { font-weight:600; color:#333; }

    .email-avatar {
      width:36px; height:36px; border-radius:50%; flex-shrink:0;
      background:linear-gradient(135deg,#1a3a5c,#2a5fa0);
      color:white; display:flex; align-items:center; justify-content:center;
      font-size:14px; font-weight:700;
    }
    .email-info { flex:1; min-width:0; }
    .email-from { font-size:13px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#333; }
    .email-subject { font-size:12px; color:#777; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px; }
    .email-meta { display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0; }
    .email-date { font-size:10px; color:#aaa; }
    .unread-dot { width:8px; height:8px; border-radius:50%; background:#1565c0; }

    .empty-inbox { text-align:center; padding:60px 20px; color:#ccc; }
    .empty-inbox mat-icon { font-size:48px; width:48px; height:48px; display:block; margin:0 auto 8px; }
    .empty-inbox p { font-size:13px; margin:0; }

    .pagination { display:flex; align-items:center; justify-content:center; gap:8px; padding:10px; border-top:1px solid #f0f0f0; font-size:13px; color:#555; flex-shrink:0; }

    /* ── Email reader ─────────────────────────── */
    .email-reader-col { flex:1; display:flex; flex-direction:column; overflow:hidden; background:white; }

    .reader-loading { display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1; gap:12px; color:var(--text-secondary); }
    .reader-loading p { margin:0; font-size:13px; }

    .reader-header { display:flex; align-items:center; gap:12px; padding:14px 20px; border-bottom:1px solid #f0f0f0; flex-shrink:0; }
    .reader-subject { margin:0; font-size:16px; font-weight:700; flex:1; }

    .reader-meta { display:flex; align-items:center; justify-content:space-between; padding:12px 20px; flex-shrink:0; }
    .reader-from { display:flex; align-items:center; gap:10px; }
    .from-avatar {
      width:36px; height:36px; border-radius:50%;
      background:linear-gradient(135deg,#6a1b9a,#ab47bc);
      color:white; display:flex; align-items:center; justify-content:center;
      font-size:13px; font-weight:700;
    }
    .from-name { font-size:13px; font-weight:600; }
    .from-email { font-size:11px; color:var(--text-secondary); }
    .reader-date { font-size:12px; color:var(--text-secondary); }

    .reader-to { display:flex; align-items:center; gap:6px; padding:4px 20px 12px; font-size:12px; color:var(--text-secondary); flex-shrink:0; }
    .reader-to mat-icon { font-size:14px; width:14px; height:14px; }

    .reader-body { flex:1; overflow-y:auto; padding:20px; }
    .html-body { font-size:14px; line-height:1.6; }
    .html-body img { max-width:100%; height:auto; }
    .plain-body { font-family:inherit; font-size:13px; white-space:pre-wrap; word-break:break-word; line-height:1.6; margin:0; }

    /* Spinner animation */
    @keyframes spin { to { transform:rotate(360deg); } }
    .spin { animation:spin 1s linear infinite; }
  `]
})
export class MailComponent implements OnInit {
  private mailSvc    = inject(MailService);
  private sanitizer  = inject(DomSanitizer);
  private snack      = inject(MatSnackBar);
  private confirmSvc = inject(ConfirmService);

  providers        = MAIL_PROVIDERS;
  selectedProvider = 'Gmail';
  showPass         = false;

  form: MailSettings = { host: 'imap.gmail.com', port: 993, ssl: true, username: '', password: '' };

  settings     = signal<MailSettings | null>(this.mailSvc.getSettings());
  emails       = signal<MailPreview[]>([]);
  selectedMail = signal<MailPreview | null>(null);
  openedMail   = signal<MailMessage | null>(null);
  search       = signal('');
  page         = signal(1);
  totalPages   = signal(1);
  total        = signal(0);

  loading     = signal(false);
  connecting  = signal(false);
  loadingMail = signal(false);
  loadError   = signal('');
  connectError = signal('');
  connectHint  = signal('');

  get canConnect(): boolean { return !!this.form.host && !!this.form.username && !!this.form.password; }

  filteredEmails = computed(() => {
    const q = this.search().toLowerCase().trim();
    if (!q) return this.emails();
    return this.emails().filter(e =>
      e.subject.toLowerCase().includes(q) ||
      e.fromName.toLowerCase().includes(q) ||
      e.from.toLowerCase().includes(q)
    );
  });

  safeBody = computed((): SafeHtml => {
    const mail = this.openedMail();
    if (!mail?.body) return '';
    if (mail.isHtml) return this.sanitizer.bypassSecurityTrustHtml(mail.body);
    return mail.body;
  });

  ngOnInit(): void {
    if (this.settings()) this.loadInbox();
  }

  selectProvider(p: typeof MAIL_PROVIDERS[0]): void {
    this.selectedProvider = p.name;
    if (p.host) {
      this.form.host = p.host;
      this.form.port = p.port;
      this.form.ssl  = p.ssl;
    }
    this.connectError.set('');
  }

  async testConnection(): Promise<void> {
    if (!this.canConnect) return;
    this.connecting.set(true);
    this.connectError.set('');
    this.connectHint.set('');
    try {
      const res = await this.mailSvc.testConnection(this.form);
      this.snack.open(`Connexion réussie — ${res.total} emails, ${res.unread} non lus ✓`, 'OK', { duration: 4000, panelClass: 'success-snack' });
    } catch (e: any) {
      this.connectError.set(e?.error?.error ?? 'Connexion échouée');
      this.connectHint.set(e?.error?.hint ?? '');
    } finally {
      this.connecting.set(false);
    }
  }

  async connect(): Promise<void> {
    if (!this.canConnect) return;
    this.connecting.set(true);
    this.connectError.set('');
    this.connectHint.set('');
    try {
      await this.mailSvc.testConnection(this.form);
      this.mailSvc.saveSettings({ ...this.form });
      this.settings.set({ ...this.form });
      await this.loadInbox();
    } catch (e: any) {
      this.connectError.set(e?.error?.error ?? 'Impossible de se connecter');
      this.connectHint.set(e?.error?.hint ?? '');
    } finally {
      this.connecting.set(false);
    }
  }

  async disconnect(): Promise<void> {
    if (!await this.confirmSvc.ask('Déconnecter cette messagerie ?', 'Déconnexion messagerie', 'Déconnecter')) return;
    this.mailSvc.clearSettings();
    this.settings.set(null);
    this.emails.set([]);
    this.selectedMail.set(null);
    this.openedMail.set(null);
  }

  async loadInbox(): Promise<void> {
    const s = this.settings();
    if (!s) return;
    this.loading.set(true);
    this.loadError.set('');
    try {
      const res = await this.mailSvc.getInbox(s, this.page());
      this.emails.set(res.emails);
      this.total.set(res.total);
      this.totalPages.set(res.pages);
    } catch (e: any) {
      this.loadError.set(e?.error?.error ?? 'Erreur de chargement');
    } finally {
      this.loading.set(false);
    }
  }

  async refresh(): Promise<void> {
    this.page.set(1);
    await this.loadInbox();
  }

  async nextPage(): Promise<void> {
    if (this.page() >= this.totalPages()) return;
    this.page.update(p => p + 1);
    await this.loadInbox();
  }

  async prevPage(): Promise<void> {
    if (this.page() <= 1) return;
    this.page.update(p => p - 1);
    await this.loadInbox();
  }

  async openMail(mail: MailPreview): Promise<void> {
    const s = this.settings();
    if (!s) return;
    this.selectedMail.set(mail);
    this.openedMail.set(null);
    this.loadingMail.set(true);
    try {
      const full = await this.mailSvc.readEmail(s, mail.uid);
      this.openedMail.set(full);
      // Marquer comme lu dans la liste locale
      this.emails.update(list => list.map(e => e.uid === mail.uid ? { ...e, seen: true } : e));
    } catch (e: any) {
      this.snack.open(e?.error?.error ?? 'Impossible de lire l\'email', 'OK', { duration: 3000 });
    } finally {
      this.loadingMail.set(false);
    }
  }

  senderName(mail: MailPreview | MailMessage): string {
    const n = mail.fromName?.trim();
    if (n && n !== mail.from) return n;
    const m = mail.from.match(/"?([^"<]+)"?\s*</);
    return m ? m[1].trim() : mail.from.split('@')[0];
  }

  senderInitial(mail: MailPreview | MailMessage): string {
    return this.senderName(mail).charAt(0).toUpperCase() || '?';
  }
}
