import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

export interface StarRatingDialogData {
  agentNom: string;
  interventionType: string;
}

export interface StarRatingResult {
  note: number;
  commentaire?: string;
}

@Component({
  selector: 'app-star-rating-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon style="color:#f59e0b">star</mat-icon>
      Évaluer l'intervention
    </h2>
    <mat-dialog-content>
      <p class="eval-subtitle">
        <strong>{{ data.agentNom }}</strong> — {{ data.interventionType }}
      </p>

      <div class="stars-row">
        @for (s of [1,2,3,4,5]; track s) {
          <button class="star-btn" (click)="note.set(s)" (mouseenter)="hovered.set(s)" (mouseleave)="hovered.set(0)">
            <mat-icon class="star-icon" [class.lit]="s <= (hovered() || note())">
              {{ s <= (hovered() || note()) ? 'star' : 'star_border' }}
            </mat-icon>
          </button>
        }
      </div>
      <p class="star-label">{{ noteLabel() }}</p>

      <mat-form-field appearance="outline" class="comment-field">
        <mat-label>Commentaire (optionnel)</mat-label>
        <textarea matInput [(ngModel)]="commentaire" rows="3" placeholder="Observations, points positifs, axes d'amélioration…"></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="null">Annuler</button>
      <button mat-raised-button color="primary" [disabled]="note() === 0" (click)="submit()">
        Enregistrer
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] { display: flex; align-items: center; gap: 8px; }
    .eval-subtitle { color: #64748b; font-size: 13px; margin: 0 0 16px; }

    .stars-row {
      display: flex; justify-content: center; gap: 4px; margin-bottom: 6px;
    }
    .star-btn {
      background: none; border: none; cursor: pointer; padding: 4px;
      transition: transform 0.15s;
      &:hover { transform: scale(1.2); }
    }
    .star-icon {
      font-size: 36px; width: 36px; height: 36px;
      color: #d1d5db; transition: color 0.15s;
      &.lit { color: #f59e0b; }
    }
    .star-label {
      text-align: center; font-size: 13px; color: #6b7280;
      min-height: 20px; margin: 0 0 16px;
    }
    .comment-field { width: 100%; }
  `]
})
export class StarRatingDialogComponent {
  data        = inject<StarRatingDialogData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<StarRatingDialogComponent>);

  note        = signal(0);
  hovered     = signal(0);
  commentaire = '';

  private labels = ['', 'Insuffisant', 'Passable', 'Bien', 'Très bien', 'Excellent'];

  noteLabel() { return this.labels[this.hovered() || this.note()] ?? ''; }

  submit(): void {
    this.ref.close({ note: this.note(), commentaire: this.commentaire.trim() || undefined });
  }
}
