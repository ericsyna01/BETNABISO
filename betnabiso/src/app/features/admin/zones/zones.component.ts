import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ZoneService } from '../../../core/services/zone.service';
import { AgentService } from '../../../core/services/agent.service';
import { ConfirmService } from '../../../core/services/confirm.service';

@Component({
  selector: 'app-zones',
  standalone: true,
  imports: [
    FormsModule, MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatSnackBarModule, MatTooltipModule
  ],
  template: `
    <div class="zones-page">

      <!-- Ajout -->
      <mat-card class="add-card">
        <mat-card-header>
          <mat-card-title><mat-icon>add_location_alt</mat-icon> Ajouter une zone</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="add-row">
            <mat-form-field appearance="outline" class="zone-input">
              <mat-label>Nom de la zone</mat-label>
              <mat-icon matPrefix>location_on</mat-icon>
              <input matInput [(ngModel)]="newZone" placeholder="ex: Dakar Plateau"
                     (keydown.enter)="addZone()">
            </mat-form-field>
            <button mat-raised-button color="primary" (click)="addZone()" [disabled]="!newZone.trim()">
              <mat-icon>add</mat-icon> Ajouter
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Liste -->
      <mat-card>
        <mat-card-header>
          <mat-card-title>
            <mat-icon>map</mat-icon> Zones existantes
            <span class="count-badge">{{ zones().length }}</span>
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (zones().length === 0) {
            <div class="empty-state">
              <mat-icon>location_off</mat-icon>
              <p>Aucune zone définie</p>
            </div>
          } @else {
            <div class="zones-grid">
              @for (zone of zones(); track zone) {
                <div class="zone-card">
                  <div class="zone-info">
                    <mat-icon class="zone-icon">location_on</mat-icon>
                    <div>
                      <div class="zone-name">{{ zone }}</div>
                      <div class="zone-agents">{{ agentCount(zone) }} agent(s)</div>
                    </div>
                  </div>
                  <button mat-icon-button class="delete-btn"
                          [matTooltip]="agentCount(zone) > 0 ? 'Zone utilisée par ' + agentCount(zone) + ' agent(s)' : 'Supprimer'"
                          (click)="deleteZone(zone)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              }
            </div>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .zones-page { display: flex; flex-direction: column; gap: 20px; padding-top: 16px; }

    .add-card mat-card-header { padding: 12px 16px 0 !important; }
    .add-card mat-card-content { padding: 12px 16px 16px !important; }
    mat-card-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600;
      mat-icon { color: var(--primary-light); font-size: 18px; }
    }

    .add-row { display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
    .zone-input { flex: 1; min-width: 160px; }

    .count-badge { background: var(--primary); color: white; font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 700; margin-left: 4px; }

    mat-card-header { padding: 12px 16px 0 !important; }
    mat-card-content { padding: 12px 16px 16px !important; }

    .zones-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; margin-top: 8px; }

    .zone-card {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 12px; border: 1px solid var(--border); border-radius: 10px;
      background: #fafbff; transition: box-shadow 0.2s;
      &:hover { box-shadow: 0 2px 8px rgba(26,58,92,0.1); }
    }

    .zone-info { display: flex; align-items: center; gap: 10px; }
    .zone-icon { color: var(--primary-light); }
    .zone-name { font-weight: 600; font-size: 14px; color: var(--text-primary); }
    .zone-agents { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }

    .empty-state { text-align: center; padding: 32px; color: var(--text-secondary);
      mat-icon { font-size: 40px; width: 40px; height: 40px; display: block; margin: 0 auto 8px; }
    }
  `]
})
export class ZonesComponent {
  private zoneSvc    = inject(ZoneService);
  private agentSvc   = inject(AgentService);
  private snack      = inject(MatSnackBar);
  private confirmSvc = inject(ConfirmService);

  newZone = '';
  zones = computed(() => this.zoneSvc.getAll());

  agentCount(zone: string): number {
    return this.agentSvc.getAllRaw().filter(a => a.zone === zone).length;
  }

  async addZone(): Promise<void> {
    const ok = await this.zoneSvc.create(this.newZone);
    if (ok) {
      this.snack.open(`Zone "${this.newZone.trim()}" ajoutée`, 'OK', { duration: 2500, panelClass: 'success-snack' });
      this.newZone = '';
    } else {
      this.snack.open('Zone déjà existante ou nom invalide', 'OK', { duration: 2500 });
    }
  }

  async deleteZone(zone: string): Promise<void> {
    const count = this.agentCount(zone);
    const msg = count > 0
      ? `Cette zone est utilisée par ${count} agent(s). Supprimer quand même ?`
      : `Supprimer la zone "${zone}" ?`;
    if (await this.confirmSvc.danger(msg, 'Supprimer la zone')) {
      await this.zoneSvc.delete(zone);
      this.snack.open(`Zone "${zone}" supprimée`, 'OK', { duration: 2000, panelClass: 'success-snack' });
    }
  }
}
