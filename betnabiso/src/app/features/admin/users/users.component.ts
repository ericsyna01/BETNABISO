import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule, MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { ZoneService } from '../../../core/services/zone.service';
import { ExportService } from '../../../core/services/export.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { User } from '../../../core/models/user.model';

function passwordsMatch(ctrl: AbstractControl): ValidationErrors | null {
  const a = ctrl.get('newPassword')?.value;
  const b = ctrl.get('confirmPassword')?.value;
  return a && b && a !== b ? { mismatch: true } : null;
}

@Component({
  selector: 'app-change-pwd-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon style="vertical-align:middle;margin-right:8px;color:#1a3a5c">lock_reset</mat-icon>
      Réinitialiser le mot de passe
    </h2>
    <mat-dialog-content style="padding-top:12px">
      <p style="font-size:13px;color:#555;margin:0 0 16px">
        Définir un nouveau mot de passe pour
        <strong>{{ data.prenom }} {{ data.nom }}</strong>.<br>
        L'utilisateur devra le modifier à sa prochaine connexion.
      </p>
      <form [formGroup]="form" id="pwdForm" (ngSubmit)="submit()">
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>Nouveau mot de passe</mat-label>
          <mat-icon matPrefix>lock</mat-icon>
          <input matInput [type]="show() ? 'text' : 'password'" formControlName="newPassword">
          <button matSuffix mat-icon-button type="button" (click)="show.set(!show())">
            <mat-icon>{{ show() ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
          <mat-hint>Minimum 6 caractères</mat-hint>
          @if (form.get('newPassword')?.hasError('minlength')) {
            <mat-error>Minimum 6 caractères</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline" style="width:100%;margin-top:8px">
          <mat-label>Confirmer</mat-label>
          <mat-icon matPrefix>lock_outline</mat-icon>
          <input matInput [type]="show() ? 'text' : 'password'" formControlName="confirmPassword">
          @if (form.hasError('mismatch') && form.get('confirmPassword')?.touched) {
            <mat-error>Les mots de passe ne correspondent pas</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>Annuler</button>
      <button mat-raised-button color="primary" form="pwdForm" type="submit" [disabled]="form.invalid">
        <mat-icon>save</mat-icon> Enregistrer
      </button>
    </mat-dialog-actions>
  `,
  styles: [`:host { display:block; }`]
})
export class ChangePwdDialogComponent {
  data = inject<{ prenom: string; nom: string }>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<ChangePwdDialogComponent>);
  private fb = inject(FormBuilder);
  show = signal(false);

  form = this.fb.group({
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required]
  }, { validators: passwordsMatch });

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.ref.close(this.form.value.newPassword!);
  }
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    ReactiveFormsModule, FormsModule, DatePipe, MatCardModule, MatTableModule, MatButtonModule,
    MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDialogModule, MatSnackBarModule, MatTooltipModule, MatSlideToggleModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>Gestion des utilisateurs</h1>
        <div class="page-header-actions">
          <button mat-stroked-button (click)="exportPdf()" matTooltip="Rapport PDF de tous les profils">
            <mat-icon>picture_as_pdf</mat-icon> Rapport PDF
          </button>
          <button mat-raised-button color="primary" (click)="openForm()">
            <mat-icon>person_add</mat-icon> Nouvel utilisateur
          </button>
        </div>
      </div>

      <!-- Form panel -->
      @if (showForm()) {
        <mat-card class="form-card">
          <mat-card-header>
            <mat-card-title>{{ editingUser() ? "Modifier l'utilisateur" : "Créer un utilisateur" }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <form [formGroup]="form" (ngSubmit)="onSubmit()">
              <div class="form-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Prénom *</mat-label>
                  <input matInput formControlName="prenom">
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Nom *</mat-label>
                  <input matInput formControlName="nom">
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Identifiant (username) *</mat-label>
                  <input matInput formControlName="username">
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Email *</mat-label>
                  <input matInput formControlName="email" type="email">
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Rôles * (1er = principal)</mat-label>
                  <mat-select formControlName="roles" multiple>
                    <mat-option value="admin">Admin</mat-option>
                    <mat-option value="support">Support</mat-option>
                    <mat-option value="technicien">Technicien</mat-option>
                    <mat-option value="chauffeur">Chauffeur</mat-option>
                  </mat-select>
                  <mat-hint>Sélectionner un ou plusieurs rôles</mat-hint>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Zone (Admin)</mat-label>
                  <mat-select formControlName="zone">
                    <mat-option value="">Aucune</mat-option>
                    @for (z of zones(); track z) { <mat-option [value]="z">{{ z }}</mat-option> }
                  </mat-select>
                </mat-form-field>
                @if (!editingUser()) {
                  <mat-form-field appearance="outline" class="form-full">
                    <mat-label>Mot de passe *</mat-label>
                    <input matInput formControlName="password" [type]="showPassword() ? 'text' : 'password'">
                    <button matSuffix mat-icon-button type="button" (click)="showPassword.set(!showPassword())">
                      <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
                    </button>
                    <mat-hint>Minimum 6 caractères</mat-hint>
                  </mat-form-field>
                }
              </div>
              <div class="form-actions">
                <button mat-stroked-button type="button" (click)="closeForm()">Annuler</button>
                <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid">
                  <mat-icon>save</mat-icon> {{ editingUser() ? 'Mettre à jour' : 'Créer' }}
                </button>
              </div>
            </form>
          </mat-card-content>
        </mat-card>
      }

      <!-- Filtres -->
      <div class="search-bar">
        <mat-form-field appearance="outline">
          <mat-label>Rechercher</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)"
                 placeholder="Nom, username, email...">
          @if (searchQuery()) {
            <button matSuffix mat-icon-button (click)="searchQuery.set('')">
              <mat-icon>close</mat-icon>
            </button>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" style="width:160px">
          <mat-label>Rôle</mat-label>
          <mat-select [ngModel]="filterRole()" (ngModelChange)="filterRole.set($event)">
            <mat-option value="">Tous</mat-option>
            <mat-option value="admin">Admin</mat-option>
            <mat-option value="support">Support</mat-option>
            <mat-option value="chauffeur">Chauffeur</mat-option>
            <mat-option value="technicien">Technicien</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" style="width:140px">
          <mat-label>Statut</mat-label>
          <mat-select [ngModel]="filterActif()" (ngModelChange)="filterActif.set($event)">
            <mat-option value="">Tous</mat-option>
            <mat-option value="actif">Actif</mat-option>
            <mat-option value="inactif">Inactif</mat-option>
          </mat-select>
        </mat-form-field>

        @if (hasFilter()) {
          <button mat-stroked-button (click)="resetFilters()" class="reset-btn">
            <mat-icon>filter_alt_off</mat-icon> Réinitialiser
          </button>
        }
        <span class="result-count">{{ filtered().length }} résultat(s)</span>
      </div>

      <!-- Table -->
      <div class="table-container">
        <table mat-table [dataSource]="filtered()">
          <ng-container matColumnDef="user">
            <th mat-header-cell *matHeaderCellDef>Utilisateur</th>
            <td mat-cell *matCellDef="let u">
              <div class="user-cell">
                <div class="user-avatar-sm">{{ initials(u) }}</div>
                <div>
                  <div class="user-full-name">{{ u.prenom }} {{ u.nom }}</div>
                  <div class="user-username">{{ u.username }}</div>
                </div>
              </div>
            </td>
          </ng-container>
          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef>Email</th>
            <td mat-cell *matCellDef="let u">{{ u.email }}</td>
          </ng-container>
          <ng-container matColumnDef="role">
            <th mat-header-cell *matHeaderCellDef>Rôle(s)</th>
            <td mat-cell *matCellDef="let u">
              @for (r of (u.roles ?? [u.role]); track r) {
                <span class="role-badge {{ r }}" style="margin-right:4px">{{ r }}</span>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="zone">
            <th mat-header-cell *matHeaderCellDef>Zone</th>
            <td mat-cell *matCellDef="let u">{{ u.zone || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="actif">
            <th mat-header-cell *matHeaderCellDef>Actif</th>
            <td mat-cell *matCellDef="let u">
              @if (u.id !== currentUser()?.id) {
                <mat-slide-toggle [checked]="u.actif" (change)="toggleActive(u)" color="primary"></mat-slide-toggle>
              } @else {
                <mat-slide-toggle [checked]="u.actif" disabled color="primary"></mat-slide-toggle>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="lastLogin">
            <th mat-header-cell *matHeaderCellDef>Dernière connexion</th>
            <td mat-cell *matCellDef="let u">{{ u.lastLogin ? (u.lastLogin | date:'dd/MM/yy HH:mm') : '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let u">
              @if (u.id !== currentUser()?.id && u.role !== 'superadmin') {
                <button mat-icon-button (click)="openForm(u)" matTooltip="Modifier"><mat-icon>edit</mat-icon></button>
                @if (u.role === 'technicien' || u.role === 'support' || u.role === 'chauffeur' || (u.role === 'admin' && currentUser()?.role === 'superadmin')) {
                  <button mat-icon-button (click)="resetPassword(u)" matTooltip="Réinitialiser le mot de passe" class="pwd-btn">
                    <mat-icon>lock_reset</mat-icon>
                  </button>
                }
                <button mat-icon-button (click)="deleteUser(u)" matTooltip="Supprimer" class="delete-btn"><mat-icon>delete</mat-icon></button>
              }
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let row; columns: cols;"></tr>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .form-card { margin-bottom: 20px; mat-card-content { padding: 16px 24px 24px !important; } }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; }
    .user-cell { display: flex; align-items: center; gap: 10px; }
    .user-avatar-sm { width: 32px; height: 32px; background: linear-gradient(135deg,#1a3a5c,#2a5fa0); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: white; flex-shrink: 0; }
    .user-full-name { font-weight: 600; font-size: 13px; }
    .user-username { font-size: 11px; color: var(--text-secondary); }
    .pwd-btn mat-icon { color: #1a3a5c; }
    mat-form-field { width: 100%; }
    .form-full { grid-column: 1/-1; }
    .reset-btn { color: var(--text-secondary); }
    .result-count { color: var(--text-secondary); font-size: 13px; margin-left: auto; white-space: nowrap; align-self: center; }
  `]
})
export class UsersComponent implements OnInit {
  private userSvc    = inject(UserService);
  private auth       = inject(AuthService);
  private zoneSvc    = inject(ZoneService);
  private snack      = inject(MatSnackBar);
  private fb         = inject(FormBuilder);
  private dialog     = inject(MatDialog);
  private exportSvc  = inject(ExportService);
  private confirmSvc = inject(ConfirmService);

  ngOnInit(): void { this.userSvc.loadFromApi(); }

  zones = computed(() => this.zoneSvc.getAll());
  cols = ['user', 'email', 'role', 'zone', 'actif', 'lastLogin', 'actions'];
  currentUser = this.auth.currentUser;
  showForm = signal(false);
  showPassword = signal(false);
  editingUser = signal<User | null>(null);
  searchQuery = signal('');
  filterRole = signal('');
  filterActif = signal('');

  hasFilter = computed(() => !!this.searchQuery() || !!this.filterRole() || !!this.filterActif());

  resetFilters(): void {
    this.searchQuery.set('');
    this.filterRole.set('');
    this.filterActif.set('');
  }

  filtered = computed(() => {
    let list = this.userSvc.getAll();
    const q = this.searchQuery().toLowerCase().trim();
    if (q) list = list.filter(u =>
      u.prenom.toLowerCase().includes(q) || u.nom.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
    const fr = this.filterRole();
    if (fr) list = list.filter(u => (u.roles ?? [u.role]).includes(fr as any));
    const fa = this.filterActif();
    if (fa) list = list.filter(u => fa === 'actif' ? u.actif : !u.actif);
    return list;
  });

  form = this.fb.group({
    prenom: ['', Validators.required],
    nom: ['', Validators.required],
    username: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    roles: [['technicien'] as string[], Validators.required],
    zone: [''],
    password: [''],
  });

  openForm(user?: User): void {
    this.showForm.set(true);
    this.editingUser.set(user ?? null);
    if (user) {
      this.form.patchValue({ ...user, roles: user.roles ?? [user.role] });
      this.form.get('password')?.clearValidators();
    } else {
      this.form.reset({ roles: ['technicien'] });
      this.form.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
    }
    this.form.get('password')?.updateValueAndValidity();
  }

  closeForm(): void { this.showForm.set(false); this.editingUser.set(null); }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.value;
    const roles = (v.roles as string[]) ?? ['technicien'];
    const primaryRole = roles[0] as any;
    const editing = this.editingUser();
    try {
      if (editing) {
        await this.userSvc.update(editing.id, { prenom: v.prenom!, nom: v.nom!, username: v.username!, email: v.email!, role: primaryRole, roles: roles as any, zone: v.zone ?? '' });
        if (v.password?.trim()) {
          await this.userSvc.adminSetPassword(editing.id, v.password.trim());
        }
        this.snack.open('Utilisateur mis à jour', 'OK', { duration: 2000, panelClass: 'success-snack' });
      } else {
        await this.userSvc.create({ prenom: v.prenom!, nom: v.nom!, username: v.username!, email: v.email!, role: primaryRole, roles: roles as any, zone: v.zone ?? undefined, password: v.password!, actif: true });
        this.snack.open('Utilisateur créé', 'OK', { duration: 2000, panelClass: 'success-snack' });
      }
      this.closeForm();
    } catch {
      this.snack.open('Erreur lors de la sauvegarde', 'OK', { duration: 3000, panelClass: 'error-snack' });
    }
  }

  async toggleActive(user: User): Promise<void> {
    await this.userSvc.toggleActive(user.id);
    this.snack.open(`${user.prenom} ${user.nom} : statut mis à jour`, 'OK', { duration: 2000 });
  }

  async deleteUser(user: User): Promise<void> {
    if (await this.confirmSvc.danger(`Supprimer ${user.prenom} ${user.nom} ?`)) {
      await this.userSvc.delete(user.id);
      this.snack.open('Utilisateur supprimé', 'OK', { duration: 2000, panelClass: 'success-snack' });
    }
  }

  resetPassword(user: User): void {
    const ref = this.dialog.open(ChangePwdDialogComponent, {
      data: { prenom: user.prenom, nom: user.nom },
      width: 'min(460px, 92vw)'
    });
    ref.afterClosed().subscribe(async (newPwd: string | undefined) => {
      if (!newPwd) return;
      await this.userSvc.adminSetPassword(user.id, newPwd);
      this.snack.open(`Mot de passe de ${user.prenom} ${user.nom} réinitialisé`, 'OK', { duration: 3000, panelClass: 'success-snack' });
    });
  }

  initials(u: User): string { return `${u.prenom[0]}${u.nom[0]}`.toUpperCase(); }

  exportPdf(): void {
    const cols = [
      { key: 'prenom', label: 'Prénom' },
      { key: 'nom', label: 'Nom' },
      { key: 'username', label: 'Identifiant' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Rôle' },
      { key: 'zone', label: 'Zone' },
      { key: 'actif', label: 'Actif' },
    ];
    const rows = this.filtered().map(u => ({
      ...u,
      zone: u.zone || '—',
      actif: u.actif ? 'Oui' : 'Non',
    }));
    this.exportSvc.exportPdf('Rapport des profils utilisateurs', cols, rows as unknown as Record<string, unknown>[]);
  }
}
