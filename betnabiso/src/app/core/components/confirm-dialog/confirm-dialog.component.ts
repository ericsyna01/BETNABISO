import { Component, inject } from '@angular/core';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="confirm-dialog">
      <div class="confirm-icon" [class.danger]="data.danger">
        <mat-icon>{{ data.danger ? 'warning' : 'help_outline' }}</mat-icon>
      </div>
      <h2 mat-dialog-title>{{ data.title }}</h2>
      <mat-dialog-content>
        <p>{{ data.message }}</p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-stroked-button [mat-dialog-close]="false">Annuler</button>
        <button mat-raised-button [color]="data.danger ? 'warn' : 'primary'" [mat-dialog-close]="true">
          {{ data.confirmLabel }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .confirm-dialog { padding: 8px 4px; text-align: center; }
    .confirm-icon { margin: 16px auto 8px; width: 56px; height: 56px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: #e3f2fd;
      mat-icon { font-size: 30px; width: 30px; height: 30px; color: #1565c0; }
      &.danger { background: #fce4ec; mat-icon { color: #c62828; } }
    }
    h2 { font-size: 18px; font-weight: 700; margin: 8px 0 4px; color: #1a2035; }
    mat-dialog-content p { font-size: 14px; color: #6b7a99; line-height: 1.5; white-space: pre-line; }
    mat-dialog-actions { padding: 16px 0 8px; gap: 8px; }
  `]
})
export class ConfirmDialogComponent {
  data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}
