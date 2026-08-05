import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AgendaService } from '../../core/services/agenda.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { AgendaItem } from '../../core/models/agenda.model';

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-agenda',
  standalone: true,
  imports: [
    DatePipe, FormsModule, MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatCheckboxModule, MatDatepickerModule,
    MatSnackBarModule, MatTooltipModule,
  ],
  template: `
    <div class="agenda-page">
      <div class="page-header">
        <h1><mat-icon class="title-icon">event_note</mat-icon> Mon agenda</h1>
        <span class="sub-title">Rappels personnels — visibles uniquement par vous</span>
      </div>

      <mat-card class="add-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>{{ editId() ? 'edit' : 'add' }}</mat-icon>
            {{ editId() ? 'Modifier le rappel' : 'Nouveau rappel' }}
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Titre</mat-label>
            <input matInput [(ngModel)]="formTitre" placeholder="ex: Rappeler le fournisseur X">
          </mat-form-field>

          <div class="add-row">
            <mat-form-field appearance="outline" class="date-input">
              <mat-label>Date</mat-label>
              <input matInput [matDatepicker]="picker" [(ngModel)]="formDate" placeholder="jj/mm/aaaa" readonly>
              <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
              <mat-datepicker #picker></mat-datepicker>
            </mat-form-field>
            <mat-form-field appearance="outline" class="heure-input">
              <mat-label>Heure (optionnel)</mat-label>
              <input matInput type="time" [(ngModel)]="formHeure">
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Note (optionnel)</mat-label>
            <textarea matInput rows="2" [(ngModel)]="formNote" placeholder="Détails..."></textarea>
          </mat-form-field>

          <div class="form-actions">
            @if (editId()) {
              <button mat-stroked-button (click)="cancelEdit()">Annuler</button>
            }
            <button mat-raised-button color="primary" (click)="save()" [disabled]="!formTitre.trim() || !formDate || saving()">
              <mat-icon>{{ editId() ? 'save' : 'add' }}</mat-icon> {{ editId() ? 'Enregistrer' : 'Ajouter' }}
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      @for (group of groupedItems(); track group.key) {
        @if (group.items.length > 0) {
          <mat-card class="group-card">
            <mat-card-header>
              <mat-card-title [class]="'group-title ' + group.key">
                <mat-icon>{{ group.icon }}</mat-icon> {{ group.label }}
                <span class="count-badge">{{ group.items.length }}</span>
              </mat-card-title>
            </mat-card-header>
            <mat-card-content>
              @for (a of group.items; track a.id) {
                <div class="agenda-item" [class.done]="a.fait">
                  <mat-checkbox [checked]="a.fait" (change)="toggleFait(a)"></mat-checkbox>
                  <div class="item-body">
                    <div class="item-titre">{{ a.titre }}</div>
                    @if (a.note) { <div class="item-note">{{ a.note }}</div> }
                    <div class="item-date">
                      {{ a.dateRappel | date:'dd/MM/yyyy' }}
                      @if (a.heure) { · {{ a.heure }} }
                    </div>
                  </div>
                  <div class="item-actions">
                    <button mat-icon-button matTooltip="Modifier" (click)="startEdit(a)">
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button mat-icon-button class="delete-btn" matTooltip="Supprimer" (click)="deleteItem(a)">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </div>
              }
            </mat-card-content>
          </mat-card>
        }
      }

      @if (items().length === 0) {
        <div class="empty-state">
          <mat-icon>event_available</mat-icon>
          <p>Aucun rappel pour le moment</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .agenda-page { padding: 24px; max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
    .page-header h1 { font-size: 22px; color: #1a3a5c; margin: 0; display: flex; align-items: center; gap: 8px; }
    .title-icon { font-size: 26px; width: 26px; height: 26px; color: #1a3a5c; }
    .sub-title { font-size: 13px; color: #78909c; display: block; margin-top: 4px; }

    .add-card mat-card-header, .group-card mat-card-header { padding: 12px 16px 0 !important; }
    .add-card mat-card-content { padding: 12px 16px 16px !important; display: flex; flex-direction: column; gap: 10px; }
    .group-card mat-card-content { padding: 8px 16px 12px !important; }
    mat-card-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600;
      mat-icon { color: var(--primary-light); font-size: 18px; }
    }
    .group-title.overdue mat-icon { color: #c62828; }
    .group-title.today   mat-icon { color: #e65100; }
    .group-title.upcoming mat-icon { color: #1565c0; }
    .group-title.done    mat-icon { color: #43a047; }

    .add-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .date-input { flex: 1; min-width: 140px; }
    .heure-input { flex: 1; min-width: 140px; }
    .full-width { width: 100%; }
    .form-actions { display: flex; justify-content: flex-end; gap: 10px; }

    .count-badge { background: var(--primary); color: white; font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 700; margin-left: auto; }

    .agenda-item {
      display: flex; align-items: flex-start; gap: 10px; padding: 10px 4px;
      border-bottom: 1px solid var(--border, #eef2f6);
      &:last-child { border-bottom: none; }
      &.done { opacity: .55; }
      &.done .item-titre { text-decoration: line-through; }
    }
    .item-body { flex: 1; min-width: 0; }
    .item-titre { font-weight: 600; font-size: 13.5px; color: var(--text-primary, #1a3a5c); }
    .item-note { font-size: 12px; color: var(--text-secondary, #78909c); margin-top: 2px; }
    .item-date { font-size: 11px; color: var(--text-secondary, #90a4ae); margin-top: 4px; }
    .item-actions { display: flex; gap: 2px; flex-shrink: 0; }
    .delete-btn { color: #c62828; }

    .empty-state { text-align: center; padding: 32px; color: var(--text-secondary);
      mat-icon { font-size: 40px; width: 40px; height: 40px; display: block; margin: 0 auto 8px; }
    }
  `]
})
export class AgendaComponent {
  private agendaSvc  = inject(AgendaService);
  private snack      = inject(MatSnackBar);
  private confirmSvc = inject(ConfirmService);

  items = computed(() => this.agendaSvc.getAll());

  groupedItems = computed(() => {
    const todayStr = toDateStr(new Date());
    const pending = this.items().filter(a => !a.fait).sort((a, b) => (a.dateRappel + (a.heure ?? '')).localeCompare(b.dateRappel + (b.heure ?? '')));
    const done    = this.items().filter(a => a.fait).sort((a, b) => b.dateRappel.localeCompare(a.dateRappel));

    return [
      { key: 'overdue',  label: 'En retard', icon: 'warning',        items: pending.filter(a => a.dateRappel < todayStr) },
      { key: 'today',    label: "Aujourd'hui", icon: 'today',        items: pending.filter(a => a.dateRappel === todayStr) },
      { key: 'upcoming', label: 'À venir',    icon: 'event_upcoming', items: pending.filter(a => a.dateRappel > todayStr) },
      { key: 'done',     label: 'Terminés',   icon: 'check_circle',  items: done },
    ];
  });

  editId     = signal<string | null>(null);
  formTitre  = '';
  formNote   = '';
  formDate: Date | null = null;
  formHeure  = '';
  saving     = signal(false);

  startEdit(a: AgendaItem): void {
    this.editId.set(a.id);
    this.formTitre = a.titre;
    this.formNote  = a.note ?? '';
    this.formDate  = new Date(a.dateRappel);
    this.formHeure = a.heure ?? '';
  }

  cancelEdit(): void {
    this.editId.set(null);
    this.formTitre = '';
    this.formNote  = '';
    this.formDate  = null;
    this.formHeure = '';
  }

  async save(): Promise<void> {
    const titre = this.formTitre.trim();
    if (!titre || !this.formDate) return;
    this.saving.set(true);
    try {
      const dateRappel = toDateStr(this.formDate);
      const payload = { titre, note: this.formNote.trim() || undefined, dateRappel, heure: this.formHeure || undefined };
      const result = this.editId()
        ? await this.agendaSvc.update(this.editId()!, payload)
        : await this.agendaSvc.create(payload);
      this.snack.open(
        result ? (this.editId() ? 'Rappel modifié' : 'Rappel ajouté') : 'Erreur, réessayez',
        'OK', { duration: 2000, panelClass: result ? 'success-snack' : undefined }
      );
      if (result) this.cancelEdit();
    } finally {
      this.saving.set(false);
    }
  }

  async toggleFait(a: AgendaItem): Promise<void> {
    await this.agendaSvc.toggleFait(a.id, !a.fait);
  }

  async deleteItem(a: AgendaItem): Promise<void> {
    if (await this.confirmSvc.danger(`Supprimer "${a.titre}" ?`, 'Supprimer le rappel')) {
      await this.agendaSvc.delete(a.id);
      this.snack.open('Rappel supprimé', 'OK', { duration: 2000, panelClass: 'success-snack' });
    }
  }
}
