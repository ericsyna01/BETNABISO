import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';
import { OutilService } from '../../core/services/outil.service';
import { TypeLabelService } from '../../core/services/type-label.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { Outil, OutilType, OUTIL_ICON_PRESETS } from '../../core/models/outil.model';

@Component({
  selector: 'app-outils',
  standalone: true,
  imports: [
    RouterLink, FormsModule, MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatButtonToggleModule, MatSelectModule, MatIconModule,
    MatSnackBarModule, MatTooltipModule
  ],
  template: `
    <div class="outils-page">
      <div class="page-header">
        <h1><mat-icon class="title-icon">construction</mat-icon> Outils & Utilitaires</h1>
        <span class="sub-title">Logiciels et scripts utilisés pour configurer les machines (AnyDesk, TeamViewer, scripts internes...)</span>
      </div>

      @if (categories().length > 0) {
        <div class="filter-chips">
          <button mat-stroked-button class="filter-chip" [class.filter-chip-active]="filterCategorie() === ''"
                  (click)="filterCategorie.set('')">Toutes</button>
          @for (c of categories(); track c.id) {
            <button mat-stroked-button class="filter-chip" [class.filter-chip-active]="filterCategorie() === c.label"
                    (click)="filterCategorie.set(c.label)">
              <mat-icon>{{ c.icone || 'label' }}</mat-icon> {{ c.label }}
            </button>
          }
        </div>
      }

      @if (auth.isAdmin()) {
        <mat-card class="add-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>{{ editId() ? 'edit' : 'add' }}</mat-icon>
              {{ editId() ? "Modifier l'outil" : 'Ajouter un outil' }}
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (!editId()) {
              <mat-button-toggle-group [(ngModel)]="formType" class="type-toggle">
                <mat-button-toggle value="lien"><mat-icon>link</mat-icon> Lien externe</mat-button-toggle>
                <mat-button-toggle value="fichier"><mat-icon>upload_file</mat-icon> Fichier hébergé</mat-button-toggle>
              </mat-button-toggle-group>
            }

            <div class="add-row">
              <div class="pill-field label-input">
                <label class="pill-label">Nom</label>
                <mat-form-field appearance="outline" class="pill-select">
                  <mat-icon matPrefix>label</mat-icon>
                  <input matInput [(ngModel)]="formLabel" placeholder="ex: AnyDesk">
                </mat-form-field>
              </div>
              <div class="pill-field icon-input">
                <label class="pill-label">Icône</label>
                <mat-form-field appearance="outline" class="pill-select">
                  <mat-icon matPrefix>{{ formIcone || 'help' }}</mat-icon>
                  <mat-select [(ngModel)]="formIcone">
                    @for (i of iconPresets; track i) {
                      <mat-option [value]="i">
                        <mat-icon style="vertical-align:middle;margin-right:6px">{{ i }}</mat-icon>{{ i }}
                      </mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>
            </div>

            <div class="pill-field full-width">
              <label class="pill-label">Description (optionnel)</label>
              <mat-form-field appearance="outline" class="pill-select pill-textarea">
                <textarea matInput rows="2" [(ngModel)]="formDescription" placeholder="ex: Prise en main à distance de la caisse"></textarea>
              </mat-form-field>
            </div>

            <div class="add-row">
              <div class="pill-field label-input">
                <label class="pill-label">Catégorie</label>
                <mat-form-field appearance="outline" class="pill-select">
                  <mat-icon matPrefix>category</mat-icon>
                  <mat-select [(ngModel)]="formCategorie">
                    <mat-option value="">Non classé</mat-option>
                    @for (c of categories(); track c.id) {
                      <mat-option [value]="c.label">
                        <mat-icon style="vertical-align:middle;margin-right:6px">{{ c.icone || 'label' }}</mat-icon>{{ c.label }}
                      </mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>
              <button type="button" mat-stroked-button matTooltip="Gérer les catégories dans Administration > Types"
                      [routerLink]="['/admin/types']">
                <mat-icon>settings</mat-icon>
              </button>
            </div>

            @if (formType === 'lien' || editId()) {
              <div class="pill-field full-width">
                <label class="pill-label">URL de téléchargement officielle</label>
                <mat-form-field appearance="outline" class="pill-select">
                  <mat-icon matPrefix>link</mat-icon>
                  <input matInput [(ngModel)]="formUrl" placeholder="https://anydesk.com/fr/downloads">
                </mat-form-field>
              </div>
            } @else {
              <div class="file-picker">
                <input type="file" #fileInput style="display:none" (change)="onFileSelected($event)">
                @if (selectedFile()) {
                  <div class="file-chip">
                    <mat-icon>description</mat-icon>
                    <span>{{ selectedFile()!.name }} ({{ formatSize(selectedFile()!.size) }})</span>
                    <button mat-icon-button (click)="selectedFile.set(null); fileInput.value=''">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                } @else {
                  <button type="button" mat-stroked-button (click)="fileInput.click()">
                    <mat-icon>upload_file</mat-icon> Choisir un fichier (.exe, .msi, .zip, .bat...)
                  </button>
                }
              </div>
            }

            <div class="form-actions">
              @if (editId()) {
                <button mat-stroked-button (click)="cancelEdit()">Annuler</button>
              }
              <button mat-raised-button color="primary" (click)="save()"
                      [disabled]="!formLabel.trim() || saving() || (!editId() && formType === 'lien' && !formUrl.trim()) || (!editId() && formType === 'fichier' && !selectedFile())">
                <mat-icon>{{ editId() ? 'save' : 'add' }}</mat-icon> {{ editId() ? 'Enregistrer' : 'Ajouter' }}
              </button>
            </div>
          </mat-card-content>
        </mat-card>
      }

      <mat-card>
        <mat-card-header>
          <mat-card-title>
            <mat-icon>list</mat-icon> Outils disponibles
            <span class="count-badge">{{ filteredOutils().length }}</span>
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (filteredOutils().length === 0) {
            <div class="empty-state">
              <mat-icon>construction</mat-icon>
              <p>Aucun outil pour le moment</p>
            </div>
          } @else {
            @for (group of groupedOutils(); track group.categorie) {
              @if (groupedOutils().length > 1) {
                <div class="categorie-heading">
                  <mat-icon>{{ categorieIcon(group.categorie) }}</mat-icon> {{ group.categorie }}
                </div>
              }
              <div class="outils-grid">
                @for (o of group.items; track o.id) {
                  <div class="outil-card">
                    <div class="outil-info">
                      <mat-icon class="outil-icon">{{ o.icone || 'construction' }}</mat-icon>
                      <div class="outil-text">
                        <div class="outil-name">{{ o.label }}</div>
                        @if (o.description) { <div class="outil-desc">{{ o.description }}</div> }
                        @if (o.type === 'fichier' && o.fileSize) {
                          <div class="outil-meta">{{ o.fileName }} · {{ formatSize(o.fileSize) }}</div>
                        }
                      </div>
                    </div>
                    <div class="outil-actions">
                      <a mat-stroked-button [href]="o.url" target="_blank" rel="noopener"
                         [download]="o.type === 'fichier' ? o.fileName : null">
                        <mat-icon>{{ o.type === 'fichier' ? 'download' : 'open_in_new' }}</mat-icon>
                        {{ o.type === 'fichier' ? 'Télécharger' : 'Ouvrir' }}
                      </a>
                      <button mat-icon-button matTooltip="Copier le lien" (click)="copyLink(o)">
                        <mat-icon>content_copy</mat-icon>
                      </button>
                      @if (auth.isAdmin()) {
                        <button mat-icon-button matTooltip="Modifier" (click)="startEdit(o)">
                          <mat-icon>edit</mat-icon>
                        </button>
                        <button mat-icon-button class="delete-btn" matTooltip="Supprimer" (click)="deleteOutil(o)">
                          <mat-icon>delete</mat-icon>
                        </button>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .outils-page { padding: 24px; max-width: 960px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
    .page-header h1 { font-size: 22px; color: #1a3a5c; margin: 0; display: flex; align-items: center; gap: 8px; }
    .title-icon { font-size: 26px; width: 26px; height: 26px; color: #1a3a5c; }
    .sub-title { font-size: 13px; color: #78909c; display: block; margin-top: 4px; }

    .filter-chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .filter-chip {
      border-radius: 20px !important; font-size: 12.5px; height: 32px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
    }
    .filter-chip-active { background: var(--primary) !important; color: white !important; border-color: var(--primary) !important; }

    .categorie-heading {
      display: flex; align-items: center; gap: 8px; margin: 12px 0 4px;
      font-size: 12.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
      color: var(--text-secondary);
      &:first-child { margin-top: 0; }
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }

    .add-card mat-card-header { padding: 12px 16px 0 !important; }
    .add-card mat-card-content { padding: 12px 16px 16px !important; display: flex; flex-direction: column; gap: 10px; }
    mat-card-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600;
      mat-icon { color: var(--primary-light); font-size: 18px; }
    }

    :host ::ng-deep .type-toggle.mat-button-toggle-group {
      align-self: flex-start;
      margin-bottom: 4px;
      display: inline-flex;
      background: #f0f4f8;
      border-radius: 10px;
      padding: 4px;
      gap: 4px;
      border: none;
      box-shadow: none;

      .mat-button-toggle-appearance-standard {
        border: none !important;
        border-radius: 8px;
        overflow: hidden;
      }

      .mat-button-toggle-checkbox-wrapper { display: none; }

      .mat-button-toggle-button { height: 38px; padding: 0 16px; }

      .mat-button-toggle-label-content {
        padding: 0; line-height: 38px; font-size: 13px; font-weight: 500; color: #5a6b7c;
        display: inline-flex; align-items: center; gap: 6px;
      }
      mat-icon { font-size: 18px; width: 18px; height: 18px; }

      .mat-button-toggle:not(.mat-button-toggle-checked):hover .mat-button-toggle-button { background: rgba(0,0,0,.04); }

      .mat-button-toggle-checked {
        background: white;
        box-shadow: 0 1px 3px rgba(0,0,0,.08);
        .mat-button-toggle-label-content { color: #1a3a5c; font-weight: 600; }
      }
    }

    .add-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .label-input { flex: 2; min-width: 180px; }
    .icon-input { flex: 1; min-width: 160px; }
    .full-width { width: 100%; }

    .file-picker { margin-top: -4px; margin-bottom: 4px; }
    .file-chip {
      display: flex; align-items: center; gap: 8px; padding: 8px 12px;
      background: var(--surface-alt, #f0f4f8); border-radius: 8px; font-size: 13px;
      mat-icon:first-child { color: var(--primary-light); }
      button { margin-left: auto; width: 28px; height: 28px; mat-icon { font-size: 16px; } }
    }

    .form-actions { display: flex; justify-content: flex-end; gap: 10px; }

    .count-badge { background: var(--primary); color: white; font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 700; margin-left: 4px; }

    mat-card-header { padding: 12px 16px 0 !important; }
    mat-card-content { padding: 12px 16px 16px !important; }

    .outils-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin-top: 8px; }

    .outil-card {
      display: flex; flex-direction: column; gap: 12px;
      padding: 14px; border: 1px solid var(--border); border-radius: 10px;
      background: #fafbff; transition: box-shadow 0.2s;
      &:hover { box-shadow: 0 2px 8px rgba(26,58,92,0.1); }
    }
    .outil-info { display: flex; align-items: flex-start; gap: 10px; }
    .outil-icon { color: var(--primary-light); flex-shrink: 0; margin-top: 2px; }
    .outil-text { min-width: 0; }
    .outil-name { font-weight: 600; font-size: 14px; color: var(--text-primary); }
    .outil-desc { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
    .outil-meta { font-size: 10.5px; color: var(--text-secondary); opacity: 0.8; margin-top: 4px; font-family: ui-monospace, monospace; }
    .outil-actions { display: flex; align-items: center; gap: 4px; }
    .outil-actions a { flex: 1; }
    .delete-btn { color: #c62828; }

    .empty-state { text-align: center; padding: 32px; color: var(--text-secondary);
      mat-icon { font-size: 40px; width: 40px; height: 40px; display: block; margin: 0 auto 8px; }
    }
  `]
})
export class OutilsComponent {
  auth               = inject(AuthService);
  private outilSvc   = inject(OutilService);
  private typeSvc    = inject(TypeLabelService);
  private snack      = inject(MatSnackBar);
  private confirmSvc = inject(ConfirmService);

  iconPresets = OUTIL_ICON_PRESETS;
  outils      = computed(() => this.outilSvc.getAll());
  categories  = computed(() => this.typeSvc.getByCategorie('outil'));

  filterCategorie = signal('');

  filteredOutils = computed(() => {
    const f = this.filterCategorie();
    const all = this.outils();
    return f ? all.filter(o => (o.categorie || '') === f) : all;
  });

  groupedOutils = computed(() => {
    const map = new Map<string, Outil[]>();
    for (const o of this.filteredOutils()) {
      const key = o.categorie || 'Non classé';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    return [...map.entries()].map(([categorie, items]) => ({ categorie, items }));
  });

  categorieIcon(nom: string): string {
    return this.categories().find(c => c.label === nom)?.icone || 'label';
  }

  editId          = signal<string | null>(null);
  formType: OutilType = 'lien';
  formLabel       = '';
  formDescription = '';
  formCategorie   = '';
  formUrl         = '';
  formIcone       = 'construction';
  selectedFile    = signal<File | null>(null);
  saving          = signal(false);

  private readonly ALLOWED_EXT = ['exe', 'msi', 'zip', '7z', 'bat', 'cmd', 'dmg', 'pkg'];
  private readonly MAX_SIZE = 100 * 1024 * 1024;

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!this.ALLOWED_EXT.includes(ext)) {
      this.snack.open(`Extension .${ext} non autorisée`, 'OK', { duration: 3000 });
      return;
    }
    if (file.size > this.MAX_SIZE) {
      this.snack.open('Fichier trop volumineux (100 Mo max)', 'OK', { duration: 3000 });
      return;
    }
    this.selectedFile.set(file);
  }

  formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  startEdit(o: Outil): void {
    this.editId.set(o.id);
    this.formLabel = o.label;
    this.formDescription = o.description ?? '';
    this.formCategorie = o.categorie ?? '';
    this.formUrl = o.type === 'lien' ? o.url : '';
    this.formIcone = o.icone || 'construction';
  }

  cancelEdit(): void {
    this.editId.set(null);
    this.formLabel = '';
    this.formDescription = '';
    this.formCategorie = '';
    this.formUrl = '';
    this.formIcone = 'construction';
    this.selectedFile.set(null);
    this.formType = 'lien';
  }

  async save(): Promise<void> {
    const label = this.formLabel.trim();
    if (!label) return;
    this.saving.set(true);
    try {
      if (this.editId()) {
        const result = await this.outilSvc.update(this.editId()!, {
          label, description: this.formDescription.trim() || undefined,
          categorie: this.formCategorie || undefined,
          url: this.formUrl.trim() || undefined, icone: this.formIcone,
        });
        this.snack.open(result ? `"${label}" modifié` : 'Erreur lors de la modification',
          'OK', { duration: 2500, panelClass: result ? 'success-snack' : undefined });
      } else if (this.formType === 'lien') {
        const result = await this.outilSvc.createLien({
          label, description: this.formDescription.trim() || undefined,
          categorie: this.formCategorie || undefined,
          url: this.formUrl.trim(), icone: this.formIcone,
        });
        this.snack.open(result ? `"${label}" ajouté` : "Erreur lors de l'ajout",
          'OK', { duration: 2500, panelClass: result ? 'success-snack' : undefined });
      } else {
        const file = this.selectedFile();
        if (!file) return;
        const result = await this.outilSvc.createFichier({
          label, description: this.formDescription.trim() || undefined,
          categorie: this.formCategorie || undefined,
          icone: this.formIcone, file,
        });
        this.snack.open(result ? `"${label}" ajouté` : "Erreur lors de l'envoi du fichier",
          'OK', { duration: 2500, panelClass: result ? 'success-snack' : undefined });
      }
      this.cancelEdit();
    } finally {
      this.saving.set(false);
    }
  }

  async deleteOutil(o: Outil): Promise<void> {
    if (await this.confirmSvc.danger(`Supprimer "${o.label}" ?`, "Supprimer l'outil")) {
      await this.outilSvc.delete(o.id);
      this.snack.open(`"${o.label}" supprimé`, 'OK', { duration: 2000, panelClass: 'success-snack' });
    }
  }

  copyLink(o: Outil): void {
    const link = o.type === 'fichier' ? window.location.origin + o.url : o.url;
    navigator.clipboard.writeText(link);
    this.snack.open('Lien copié dans le presse-papiers', 'OK', { duration: 2000, panelClass: 'info-snack' });
  }
}
