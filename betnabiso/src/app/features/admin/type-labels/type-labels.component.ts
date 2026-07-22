import { Component, computed, inject, signal } from '@angular/core';
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
import { TypeLabelService } from '../../../core/services/type-label.service';
import { InterventionService } from '../../../core/services/intervention.service';
import { MissionService } from '../../../core/services/mission.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { TypeLabel, TypeCategorie, TYPE_ICON_PRESETS } from '../../../core/models/type-label.model';

@Component({
  selector: 'app-type-labels',
  standalone: true,
  imports: [
    FormsModule, MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatButtonToggleModule, MatSelectModule, MatIconModule,
    MatSnackBarModule, MatTooltipModule
  ],
  template: `
    <div class="types-page">

      <mat-button-toggle-group [(ngModel)]="categorie" class="cat-toggle">
        <mat-button-toggle value="intervention"><mat-icon>build</mat-icon> Types d'intervention</mat-button-toggle>
        <mat-button-toggle value="mission"><mat-icon>task_alt</mat-icon> Types de mission</mat-button-toggle>
        <mat-button-toggle value="panne"><mat-icon>report_problem</mat-icon> Types de panne</mat-button-toggle>
      </mat-button-toggle-group>

      <!-- Ajout / édition -->
      <mat-card class="add-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>{{ editId() ? 'edit' : 'add' }}</mat-icon>
            {{ editId() ? 'Modifier le type' : 'Ajouter un type' }}
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="add-row">
            <mat-form-field appearance="outline" class="label-input">
              <mat-label>Nom du type</mat-label>
              <input matInput [(ngModel)]="formLabel" placeholder="ex: Câblage réseau">
            </mat-form-field>
            <mat-form-field appearance="outline" class="icon-input">
              <mat-label>Icône</mat-label>
              <mat-select [(ngModel)]="formIcone">
                @for (i of iconPresets; track i) {
                  <mat-option [value]="i">
                    <mat-icon style="vertical-align:middle;margin-right:6px">{{ i }}</mat-icon>{{ i }}
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-icon class="icon-preview">{{ formIcone || 'help' }}</mat-icon>
          </div>
          <div class="form-actions">
            @if (editId()) {
              <button mat-stroked-button (click)="cancelEdit()">Annuler</button>
            }
            <button mat-raised-button color="primary" (click)="save()" [disabled]="!formLabel.trim()">
              <mat-icon>{{ editId() ? 'save' : 'add' }}</mat-icon> {{ editId() ? 'Enregistrer' : 'Ajouter' }}
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Liste -->
      <mat-card>
        <mat-card-header>
          <mat-card-title>
            <mat-icon>list</mat-icon> Types existants
            <span class="count-badge">{{ types().length }}</span>
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (types().length === 0) {
            <div class="empty-state">
              <mat-icon>category</mat-icon>
              <p>Aucun type défini pour cette catégorie</p>
            </div>
          } @else {
            <div class="types-grid">
              @for (t of types(); track t.id) {
                <div class="type-card">
                  <div class="type-info">
                    <mat-icon class="type-icon">{{ t.icone || 'help' }}</mat-icon>
                    <div>
                      <div class="type-name">{{ t.label }}</div>
                      <div class="type-usage">{{ usageCount(t) }} utilisation(s)</div>
                    </div>
                  </div>
                  <div class="type-actions">
                    <button mat-icon-button matTooltip="Modifier" (click)="startEdit(t)">
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button mat-icon-button class="delete-btn" matTooltip="Supprimer" (click)="deleteType(t)">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .types-page { display: flex; flex-direction: column; gap: 20px; padding-top: 16px; }
    .cat-toggle { align-self: flex-start; }

    .add-card mat-card-header { padding: 12px 16px 0 !important; }
    .add-card mat-card-content { padding: 12px 16px 16px !important; }
    mat-card-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600;
      mat-icon { color: var(--primary-light); font-size: 18px; }
    }

    .add-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .label-input { flex: 2; min-width: 180px; }
    .icon-input { flex: 1; min-width: 160px; }
    .icon-preview { font-size: 28px; width: 28px; height: 28px; color: var(--primary); }

    .form-actions { display: flex; justify-content: flex-end; gap: 10px; }

    .count-badge { background: var(--primary); color: white; font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 700; margin-left: 4px; }

    mat-card-header { padding: 12px 16px 0 !important; }
    mat-card-content { padding: 12px 16px 16px !important; }

    .types-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; margin-top: 8px; }

    .type-card {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 12px; border: 1px solid var(--border); border-radius: 10px;
      background: #fafbff; transition: box-shadow 0.2s;
      &:hover { box-shadow: 0 2px 8px rgba(26,58,92,0.1); }
    }
    .type-info { display: flex; align-items: center; gap: 10px; }
    .type-icon { color: var(--primary-light); }
    .type-name { font-weight: 600; font-size: 14px; color: var(--text-primary); }
    .type-usage { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
    .type-actions { display: flex; }
    .empty-state { text-align: center; padding: 32px; color: var(--text-secondary);
      mat-icon { font-size: 40px; width: 40px; height: 40px; display: block; margin: 0 auto 8px; }
    }
  `]
})
export class TypeLabelsComponent {
  private typeSvc        = inject(TypeLabelService);
  private interventionSvc = inject(InterventionService);
  private missionSvc     = inject(MissionService);
  private snack          = inject(MatSnackBar);
  private confirmSvc     = inject(ConfirmService);

  iconPresets = TYPE_ICON_PRESETS;
  categorie   = signal<TypeCategorie>('intervention');
  types       = computed(() => this.typeSvc.getByCategorie(this.categorie()));

  editId    = signal<string | null>(null);
  formLabel = '';
  formIcone = 'assignment';

  usageCount(t: TypeLabel): number {
    if (t.categorie === 'intervention') {
      return this.interventionSvc.getAllRaw().filter(i => i.type === t.label).length;
    }
    if (t.categorie === 'mission') {
      return this.missionSvc.getAll().filter(m => m.type === t.label).length;
    }
    return 0;
  }

  startEdit(t: TypeLabel): void {
    this.editId.set(t.id);
    this.formLabel = t.label;
    this.formIcone = t.icone || 'assignment';
  }

  cancelEdit(): void {
    this.editId.set(null);
    this.formLabel = '';
    this.formIcone = 'assignment';
  }

  async save(): Promise<void> {
    const label = this.formLabel.trim();
    if (!label) return;

    if (this.editId()) {
      const result = await this.typeSvc.update(this.editId()!, { label, icone: this.formIcone });
      if (result) this.snack.open(`Type "${label}" modifié`, 'OK', { duration: 2500, panelClass: 'success-snack' });
      else this.snack.open('Ce type existe déjà dans cette catégorie', 'OK', { duration: 2500 });
    } else {
      const result = await this.typeSvc.create({ categorie: this.categorie(), label, icone: this.formIcone });
      if (result) this.snack.open(`Type "${label}" ajouté`, 'OK', { duration: 2500, panelClass: 'success-snack' });
      else this.snack.open('Ce type existe déjà dans cette catégorie', 'OK', { duration: 2500 });
    }
    this.cancelEdit();
  }

  async deleteType(t: TypeLabel): Promise<void> {
    const count = this.usageCount(t);
    const msg = count > 0
      ? `Ce type est utilisé par ${count} élément(s) existant(s). Supprimer quand même ?`
      : `Supprimer le type "${t.label}" ?`;
    if (await this.confirmSvc.danger(msg, 'Supprimer le type')) {
      await this.typeSvc.delete(t.id);
      this.snack.open(`Type "${t.label}" supprimé`, 'OK', { duration: 2000, panelClass: 'success-snack' });
    }
  }
}
