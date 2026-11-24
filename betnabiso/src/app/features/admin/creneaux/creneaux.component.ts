import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CreneauService } from '../../../core/services/creneau.service';
import { PlanningService } from '../../../core/services/planning.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { Creneau, CRENEAU_PALETTE } from '../../../core/models/creneau.model';

@Component({
  selector: 'app-creneaux',
  standalone: true,
  imports: [
    FormsModule, MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatSnackBarModule, MatTooltipModule
  ],
  template: `
    <div class="creneaux-page">

      <!-- Ajout / édition -->
      <mat-card class="add-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>{{ editId() ? 'edit' : 'add_alarm' }}</mat-icon>
            {{ editId() ? 'Modifier le créneau' : 'Ajouter un créneau' }}
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="add-row">
            <div class="pill-field label-input">
              <label class="pill-label">Nom du créneau</label>
              <mat-form-field appearance="outline" class="pill-select">
                <mat-icon matPrefix>label</mat-icon>
                <input matInput [(ngModel)]="formLabel" placeholder="ex: Nuit">
              </mat-form-field>
            </div>
            <div class="pill-field time-input">
              <label class="pill-label">Début</label>
              <mat-form-field appearance="outline" class="pill-select">
                <mat-icon matPrefix>schedule</mat-icon>
                <input matInput type="time" [(ngModel)]="formDebut">
              </mat-form-field>
            </div>
            <div class="pill-field time-input">
              <label class="pill-label">Fin</label>
              <mat-form-field appearance="outline" class="pill-select">
                <mat-icon matPrefix>schedule</mat-icon>
                <input matInput type="time" [(ngModel)]="formFin">
              </mat-form-field>
            </div>
          </div>
          <div class="palette-row">
            <span class="palette-label">Couleur</span>
            @for (c of palette; track c.texte) {
              <button type="button" class="swatch" [style.background]="c.fond" [style.color]="c.texte"
                      [class.selected]="formCouleur().texte === c.texte"
                      (click)="formCouleur.set(c)" matTooltip="Choisir cette couleur">
                <mat-icon>circle</mat-icon>
              </button>
            }
          </div>
          <div class="form-actions">
            @if (editId()) {
              <button mat-stroked-button (click)="cancelEdit()">Annuler</button>
            }
            <button mat-raised-button color="primary" (click)="save()" [disabled]="!formLabel.trim() || !formDebut || !formFin">
              <mat-icon>{{ editId() ? 'save' : 'add' }}</mat-icon> {{ editId() ? 'Enregistrer' : 'Ajouter' }}
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Liste -->
      <mat-card>
        <mat-card-header>
          <mat-card-title>
            <mat-icon>schedule</mat-icon> Créneaux existants
            <span class="count-badge">{{ creneaux().length }}</span>
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (creneaux().length === 0) {
            <div class="empty-state">
              <mat-icon>event_busy</mat-icon>
              <p>Aucun créneau défini</p>
            </div>
          } @else {
            <div class="creneaux-grid">
              @for (c of creneaux(); track c.id) {
                <div class="creneau-card" [style.border-left-color]="c.couleurTexte">
                  <div class="creneau-info">
                    <span class="creneau-chip" [style.background]="c.couleurFond" [style.color]="c.couleurTexte">{{ c.label }}</span>
                    <div class="creneau-hours">{{ c.heureDebut }} – {{ c.heureFin }}</div>
                    <div class="creneau-usage">{{ usageCount(c.label) }} affectation(s) en cours</div>
                  </div>
                  <div class="creneau-actions">
                    <button mat-icon-button matTooltip="Modifier" (click)="startEdit(c)">
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button mat-icon-button class="delete-btn" matTooltip="Supprimer" (click)="deleteCreneau(c)">
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
    .creneaux-page { display: flex; flex-direction: column; gap: 20px; padding-top: 16px; }

    .add-card mat-card-header { padding: 12px 16px 0 !important; }
    .add-card mat-card-content { padding: 12px 16px 16px !important; }
    mat-card-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600;
      mat-icon { color: var(--primary-light); font-size: 18px; }
    }

    .add-row { display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
    .label-input { flex: 2; min-width: 160px; }
    .time-input { flex: 1; min-width: 110px; }

    .palette-row { display: flex; align-items: center; gap: 8px; margin: 14px 0 12px; flex-wrap: wrap; }
    .palette-label { font-size: 12px; color: var(--text-secondary); margin-right: 4px; }
    .swatch {
      width: 26px; height: 26px; border-radius: 50%; border: 2px solid transparent;
      cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }
    .swatch.selected { border-color: var(--text-primary); }

    .form-actions { display: flex; justify-content: flex-end; gap: 10px; }

    .count-badge { background: var(--primary); color: white; font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 700; margin-left: 4px; }

    mat-card-header { padding: 12px 16px 0 !important; }
    mat-card-content { padding: 12px 16px 16px !important; }

    .creneaux-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; margin-top: 8px; }

    .creneau-card {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 12px; border: 1px solid var(--border); border-left: 4px solid; border-radius: 10px;
      background: #fafbff; transition: box-shadow 0.2s;
      &:hover { box-shadow: 0 2px 8px rgba(26,58,92,0.1); }
    }
    .creneau-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .creneau-chip { display: inline-block; align-self: flex-start; font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 10px; }
    .creneau-hours { font-size: 12px; color: var(--text-primary); font-weight: 500; }
    .creneau-usage { font-size: 11px; color: var(--text-secondary); }
    .creneau-actions { display: flex; }
    .empty-state { text-align: center; padding: 32px; color: var(--text-secondary);
      mat-icon { font-size: 40px; width: 40px; height: 40px; display: block; margin: 0 auto 8px; }
    }
  `]
})
export class CreneauxComponent {
  private creneauSvc  = inject(CreneauService);
  private planningSvc = inject(PlanningService);
  private snack       = inject(MatSnackBar);
  private confirmSvc  = inject(ConfirmService);

  palette = CRENEAU_PALETTE;
  creneaux = computed(() => this.creneauSvc.getAll());

  editId       = signal<string | null>(null);
  formLabel    = '';
  formDebut    = '';
  formFin      = '';
  formCouleur  = signal(CRENEAU_PALETTE[0]);

  usageCount(label: string): number {
    return this.planningSvc.getAll().filter(e => e.type === label).length;
  }

  startEdit(c: Creneau): void {
    this.editId.set(c.id);
    this.formLabel = c.label;
    this.formDebut = c.heureDebut;
    this.formFin   = c.heureFin;
    this.formCouleur.set({ texte: c.couleurTexte, fond: c.couleurFond });
  }

  cancelEdit(): void {
    this.editId.set(null);
    this.formLabel = ''; this.formDebut = ''; this.formFin = '';
    this.formCouleur.set(CRENEAU_PALETTE[0]);
  }

  async save(): Promise<void> {
    const label = this.formLabel.trim();
    if (!label || !this.formDebut || !this.formFin) return;
    const payload = {
      label, heureDebut: this.formDebut, heureFin: this.formFin,
      couleurTexte: this.formCouleur().texte, couleurFond: this.formCouleur().fond,
    };

    if (this.editId()) {
      const result = await this.creneauSvc.update(this.editId()!, payload);
      if (result) this.snack.open(`Créneau "${label}" modifié`, 'OK', { duration: 2500, panelClass: 'success-snack' });
      else this.snack.open('Ce nom de créneau existe déjà', 'OK', { duration: 2500 });
    } else {
      const result = await this.creneauSvc.create(payload);
      if (result) this.snack.open(`Créneau "${label}" ajouté`, 'OK', { duration: 2500, panelClass: 'success-snack' });
      else this.snack.open('Ce nom de créneau existe déjà', 'OK', { duration: 2500 });
    }
    this.cancelEdit();
  }

  async deleteCreneau(c: Creneau): Promise<void> {
    const count = this.usageCount(c.label);
    const msg = count > 0
      ? `Ce créneau est utilisé par ${count} affectation(s) en cours. Supprimer quand même ?`
      : `Supprimer le créneau "${c.label}" ?`;
    if (await this.confirmSvc.danger(msg, 'Supprimer le créneau')) {
      await this.creneauSvc.delete(c.id);
      this.snack.open(`Créneau "${c.label}" supprimé`, 'OK', { duration: 2000, panelClass: 'success-snack' });
    }
  }
}
