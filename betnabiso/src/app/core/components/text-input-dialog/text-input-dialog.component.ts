import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

export interface TextInputDialogData {
  title: string;
  label: string;
  placeholder?: string;
  icon?: string;
  required?: boolean;
  multiline?: boolean;
  confirmLabel?: string;
}

@Component({
  selector: 'app-text-input-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule],
  template: `
    <div class="tid-wrap">
      <h2 mat-dialog-title>
        @if (data.icon) { <mat-icon class="tid-icon">{{ data.icon }}</mat-icon> }
        {{ data.title }}
      </h2>
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="tid-field">
          <mat-label>{{ data.label }}</mat-label>
          @if (data.multiline) {
            <textarea matInput [(ngModel)]="value" [placeholder]="data.placeholder ?? ''"
                      rows="4" cdkFocusInitial></textarea>
          } @else {
            <input matInput [(ngModel)]="value" [placeholder]="data.placeholder ?? ''" cdkFocusInitial>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button [mat-dialog-close]="null">Annuler</button>
        <button mat-raised-button color="primary"
                [disabled]="data.required && !value.trim()"
                (click)="confirm()">
          {{ data.confirmLabel ?? 'Valider' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .tid-wrap { min-width: 380px; }
    h2[mat-dialog-title] { display: flex; align-items: center; gap: 8px; }
    .tid-icon { color: var(--primary-light); }
    .tid-field { width: 100%; margin-top: 8px; }
    mat-dialog-content { padding-bottom: 0 !important; }
  `]
})
export class TextInputDialogComponent {
  data    = inject<TextInputDialogData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<TextInputDialogComponent>);
  value = '';

  confirm(): void {
    this.ref.close(this.value.trim() || null);
  }
}
