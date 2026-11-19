import { Component, Injectable, Input, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import {
  ATTENTE_MOTIFS, ATTENTE_RELANCE_HEURES, AttenteMotif, Intervention, InterventionSuivi,
} from '../../../core/models/intervention.model';
import { InterventionService } from '../../../core/services/intervention.service';

export function attenteLabel(motif: AttenteMotif | null | undefined): string {
  return ATTENTE_MOTIFS.find(m => m.value === motif)?.label ?? 'En attente';
}

function heuresDepuis(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000));
}

function dureeLisible(h: number): string {
  if (h < 1) return "moins d'1h";
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)} j`;
}

/** Vrai si l'intervention est en attente sans mini-rapport depuis plus de 24h. */
export function attenteARelancer(i: Intervention): boolean {
  return !!i.attenteMotif && heuresDepuis(i.attenteMaj) >= ATTENTE_RELANCE_HEURES;
}

// ── Fenêtre : rédiger un mini-rapport ─────────────────────────────────────

interface RapportDialogData { intervention: Intervention }

@Component({
  selector: 'app-attente-rapport-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title class="ar-title">
      <mat-icon>pause_circle</mat-icon>
      {{ data.intervention.attenteMotif ? 'Mettre à jour l\\'attente' : 'Mettre en attente' }}
    </h2>
    <mat-dialog-content>
      <p class="ar-agent">{{ data.intervention.agentNom }} · {{ data.intervention.type }}</p>
      <div class="ar-label">Pourquoi l'intervention reste ouverte ?</div>
      <div class="ar-motifs" role="radiogroup" aria-label="Motif de l'attente">
        @for (m of motifs; track m.value) {
          <button type="button" class="ar-motif" role="radio"
                  [attr.aria-checked]="motif() === m.value"
                  [class.selected]="motif() === m.value" (click)="motif.set(m.value)">
            <mat-icon>{{ m.icon }}</mat-icon> {{ m.label }}
          </button>
        }
      </div>
      <label class="ar-label" for="ar-note">Mini-rapport</label>
      <textarea id="ar-note" class="ar-note" rows="4" maxlength="1000" [(ngModel)]="note"
                placeholder="Ex. : instructions données à l'agent pour redémarrer la caisse, il rappelle demain matin."></textarea>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="null">Annuler</button>
      <button mat-raised-button color="primary" [disabled]="!motif() || !note.trim()" (click)="valider()">
        Enregistrer
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host { display: block; max-width: 520px; }
    .ar-title { display: flex; align-items: center; gap: 8px; mat-icon { color: #e65100; } }
    .ar-agent { margin: 0 0 14px; font-size: 13px; color: var(--text-secondary); }
    .ar-label { display: block; font-size: 12px; font-weight: 600; color: #546e7a; margin: 0 0 8px; }
    .ar-motifs { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    .ar-motif {
      display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 12px;
      border: 1.5px solid #dde3ec; border-radius: 10px; background: #f8fafc;
      font: inherit; font-size: 13.5px; color: #1a2742; cursor: pointer; text-align: left;
      mat-icon { color: #78909c; font-size: 20px; width: 20px; height: 20px; }
      &:hover { border-color: #b8c4d4; }
      &.selected { border-color: #e65100; background: #fff3e0; font-weight: 600;
        mat-icon { color: #e65100; } }
    }
    .ar-note {
      width: 100%; box-sizing: border-box; padding: 10px 12px; resize: vertical;
      border: 1.5px solid #dde3ec; border-radius: 10px; background: #f8fafc;
      font: inherit; font-size: 13.5px; color: #1a2742;
      &:focus { outline: none; border-color: #2a5fa0; background: white; }
    }
  `]
})
export class AttenteRapportDialogComponent {
  data = inject<RapportDialogData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<AttenteRapportDialogComponent>);
  motifs = ATTENTE_MOTIFS;
  motif = signal<AttenteMotif | null>(this.data.intervention.attenteMotif ?? null);
  note = '';

  valider(): void {
    this.ref.close({ motif: this.motif(), note: this.note.trim() });
  }
}

// ── Fenêtre : historique des mini-rapports ────────────────────────────────

interface SuiviDialogData { intervention: Intervention; canEdit: boolean }

@Component({
  selector: 'app-attente-suivi-dialog',
  standalone: true,
  imports: [DatePipe, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title class="as-title"><mat-icon>history</mat-icon> Suivi de l'attente</h2>
    <mat-dialog-content>
      <p class="as-agent">{{ data.intervention.agentNom }} · {{ data.intervention.technicienNom }}</p>
      @if (loading()) {
        <p class="as-empty">Chargement…</p>
      } @else if (error()) {
        <p class="as-empty">Impossible de charger l'historique.</p>
      } @else if (suivis().length === 0) {
        <p class="as-empty">Aucun mini-rapport pour l'instant.</p>
      } @else {
        <ol class="as-list">
          @for (s of suivis(); track s.id) {
            <li class="as-item" [class.reprise]="s.type === 'reprise'">
              <div class="as-head">
                <mat-icon>{{ s.type === 'reprise' ? 'play_circle' : 'pause_circle' }}</mat-icon>
                <strong>{{ s.type === 'reprise' ? 'Intervention reprise' : label(s.motif) }}</strong>
              </div>
              @if (s.note) { <p class="as-note">{{ s.note }}</p> }
              <div class="as-meta">{{ s.auteurNom }} · {{ s.createdAt | date:'dd/MM/yy HH:mm' }}</div>
            </li>
          }
        </ol>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (data.canEdit && data.intervention.attenteMotif) {
        <button mat-button (click)="ref.close('reprendre')"><mat-icon>play_arrow</mat-icon> Reprendre</button>
        <button mat-raised-button color="primary" (click)="ref.close('rapport')">
          <mat-icon>edit_note</mat-icon> Nouveau mini-rapport
        </button>
      } @else {
        <button mat-button [mat-dialog-close]="null">Fermer</button>
      }
    </mat-dialog-actions>
  `,
  styles: [`
    :host { display: block; max-width: 520px; }
    .as-title { display: flex; align-items: center; gap: 8px; mat-icon { color: #2a5fa0; } }
    .as-agent { margin: 0 0 12px; font-size: 13px; color: var(--text-secondary); }
    .as-empty { font-size: 13px; color: var(--text-secondary); }
    .as-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    .as-item { border: 1px solid #ffe0b2; background: #fff8f0; border-radius: 10px; padding: 10px 12px;
      &.reprise { border-color: #c8e6c9; background: #f1f8f1; .as-head mat-icon { color: #2e7d32; } } }
    .as-head { display: flex; align-items: center; gap: 6px; font-size: 13px;
      mat-icon { color: #e65100; font-size: 18px; width: 18px; height: 18px; } }
    .as-note { margin: 6px 0 4px; font-size: 13px; white-space: pre-line; }
    .as-meta { font-size: 11.5px; color: #78909c; }
  `]
})
export class AttenteSuiviDialogComponent {
  data = inject<SuiviDialogData>(MAT_DIALOG_DATA);
  ref = inject(MatDialogRef<AttenteSuiviDialogComponent>);
  private svc = inject(InterventionService);
  suivis = signal<InterventionSuivi[]>([]);
  loading = signal(true);
  error = signal(false);
  label = attenteLabel;

  constructor() {
    this.svc.getSuivis(this.data.intervention.id)
      .then(s => this.suivis.set(s))
      .catch(() => this.error.set(true))
      .finally(() => this.loading.set(false));
  }
}

// ── Orchestration des fenêtres ────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AttenteFlowService {
  private dialog = inject(MatDialog);
  private svc = inject(InterventionService);
  private snack = inject(MatSnackBar);

  async ecrireRapport(i: Intervention): Promise<void> {
    const res = await firstValueFrom(
      this.dialog.open(AttenteRapportDialogComponent, { data: { intervention: i }, autoFocus: false }).afterClosed()
    );
    if (!res) return;
    try {
      await this.svc.mettreEnAttente(i.id, res.motif, res.note);
      this.snack.open('Mini-rapport enregistré', 'OK', { duration: 2500, panelClass: 'success-snack' });
    } catch (e: any) {
      this.snack.open(e?.error?.error ?? "Échec de l'enregistrement", 'OK', { duration: 4000 });
    }
  }

  async reprendre(i: Intervention): Promise<void> {
    try {
      await this.svc.reprendre(i.id);
      this.snack.open('Intervention reprise', 'OK', { duration: 2500, panelClass: 'success-snack' });
    } catch (e: any) {
      this.snack.open(e?.error?.error ?? 'Échec', 'OK', { duration: 4000 });
    }
  }

  async ouvrirSuivi(i: Intervention, canEdit: boolean): Promise<void> {
    const choix = await firstValueFrom(
      this.dialog.open(AttenteSuiviDialogComponent, { data: { intervention: i, canEdit }, autoFocus: false }).afterClosed()
    );
    if (choix === 'rapport') await this.ecrireRapport(i);
    if (choix === 'reprendre') await this.reprendre(i);
  }
}

// ── Badge affiché à côté du statut ────────────────────────────────────────

@Component({
  selector: 'app-attente-badge',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule],
  template: `
    @if (intervention.attenteMotif) {
      <button type="button" class="att-badge" [class.relance]="aRelancer()"
              [matTooltip]="intervention.attenteNote || ''" matTooltipClass="desc-tooltip"
              (click)="$event.stopPropagation(); flow.ouvrirSuivi(intervention, canEdit)"
              [attr.aria-label]="'Voir le suivi : ' + label()">
        <mat-icon>{{ aRelancer() ? 'notification_important' : 'pause_circle' }}</mat-icon>
        <span>{{ label() }} · {{ duree() }}</span>
        @if (aRelancer()) { <span class="att-relance">À mettre à jour</span> }
      </button>
    }
  `,
  styles: [`
    :host { display: contents; }
    .att-badge {
      display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 12px;
      border: 1px solid #ffcc80; background: #fff3e0; color: #b23c00; cursor: pointer;
      font: inherit; font-size: 11.5px; font-weight: 600; white-space: nowrap;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
      &:hover { background: #ffe0b2; }
      &.relance { border-color: #ef9a9a; background: #ffebee; color: #b71c1c; }
    }
    .att-relance { margin-left: 2px; padding-left: 6px; border-left: 1px solid #ef9a9a; }
  `]
})
export class AttenteBadgeComponent {
  @Input({ required: true }) intervention!: Intervention;
  @Input() canEdit = false;
  flow = inject(AttenteFlowService);

  label = () => ATTENTE_MOTIFS.find(m => m.value === this.intervention.attenteMotif)?.short ?? 'En attente';
  duree = () => dureeLisible(heuresDepuis(this.intervention.attenteDepuis));
  aRelancer = () => attenteARelancer(this.intervention);
}
