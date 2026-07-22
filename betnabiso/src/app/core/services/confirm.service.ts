import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent, ConfirmDialogData } from '../components/confirm-dialog/confirm-dialog.component';

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private dialog = inject(MatDialog);

  async ask(message: string, title = 'Confirmation', confirmLabel = 'Confirmer', danger = false): Promise<boolean> {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      { data: { title, message, confirmLabel, danger }, width: '420px', autoFocus: false }
    );
    return (await firstValueFrom(ref.afterClosed())) === true;
  }

  async danger(message: string, title = 'Supprimer', confirmLabel = 'Supprimer'): Promise<boolean> {
    return this.ask(message, title, confirmLabel, true);
  }
}
