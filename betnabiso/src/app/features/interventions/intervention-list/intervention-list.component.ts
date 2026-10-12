import { Component, computed, inject, signal, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { InterventionService } from '../../../core/services/intervention.service';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Intervention } from '../../../core/models/intervention.model';
import { TypeLabelService } from '../../../core/services/type-label.service';
import { ExportService } from '../../../core/services/export.service';
import { EvaluationService } from '../../../core/services/evaluation.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { User } from '../../../core/models/user.model';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { TextInputDialogComponent, TextInputDialogData } from '../../../core/components/text-input-dialog/text-input-dialog.component';
import { StarRatingDialogComponent, StarRatingDialogData, StarRatingResult } from '../../../core/components/star-rating-dialog/star-rating-dialog.component';
import { KanbanComponent } from '../kanban/kanban.component';

@Component({
  selector: 'app-affecter-chauffeur-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon style="color:#1565c0;vertical-align:middle;margin-right:6px">local_shipping</mat-icon>
      Affecter un chauffeur
    </h2>
    <mat-dialog-content>
      <p style="font-size:13px;color:#555;margin:0 0 14px">
        Agent : <strong>{{ data.agentNom }}</strong><br>
        Sélectionnez le chauffeur qui assurera le transport.
      </p>
      @if (data.chauffeurs.length === 0) {
        <div style="text-align:center;padding:20px;color:#aaa">
          <mat-icon style="font-size:36px;width:36px;height:36px">person_off</mat-icon>
          <p>Aucun chauffeur actif disponible.<br>Créez d'abord un compte chauffeur.</p>
        </div>
      } @else {
        <div class="chauffeurs-list">
          @for (c of data.chauffeurs; track c.id) {
            <div class="chauffeur-card" [class.selected]="selected?.id === c.id" (click)="selected = c">
              <div class="ch-avatar">{{ initials(c) }}</div>
              <div class="ch-info">
                <div class="ch-name">{{ c.prenom }} {{ c.nom }}</div>
                <div class="ch-role">Chauffeur</div>
              </div>
              @if (selected?.id === c.id) {
                <mat-icon class="ch-check">check_circle</mat-icon>
              }
            </div>
          }
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>Annuler</button>
      <button mat-raised-button color="primary" [mat-dialog-close]="selected" [disabled]="!selected">
        <mat-icon>local_shipping</mat-icon> Affecter ce chauffeur
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host { display:block; }
    .chauffeurs-list { display:flex; flex-direction:column; gap:8px; }
    .chauffeur-card { display:flex; align-items:center; gap:12px; padding:12px 14px; border:2px solid #e0e0e0; border-radius:10px; cursor:pointer; transition:all 0.2s; }
    .chauffeur-card:hover { border-color:#1565c0; background:#f0f7ff; }
    .chauffeur-card.selected { border-color:#1565c0; background:#e3f2fd; }
    .ch-avatar { width:40px; height:40px; border-radius:50%; background:linear-gradient(135deg,#f57c00,#ffa726); color:white; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; flex-shrink:0; }
    .ch-name { font-weight:600; font-size:13px; }
    .ch-role { font-size:11px; color:#888; }
    .ch-check { color:#1565c0; margin-left:auto; }
  `]
})
export class AffecterChauffeurDialogComponent {
  data = inject<{ agentNom: string; chauffeurs: User[] }>(MAT_DIALOG_DATA);
  selected: User | null = null;
  initials(u: User): string { return `${u.prenom?.[0] ?? '?'}${u.nom?.[0] ?? '?'}`.toUpperCase(); }
}

@Component({
  selector: 'app-deplacement-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon style="color:#e65100;vertical-align:middle;margin-right:6px">directions_car</mat-icon>
      Demander un déplacement
    </h2>
    <mat-dialog-content>
      <p class="agent-ref">Agent : <strong>{{ data.agentNom }}</strong></p>
      <mat-form-field appearance="outline" style="width:100%;margin-top:4px">
        <mat-label>Raison du déplacement *</mat-label>
        <textarea matInput [(ngModel)]="note" rows="4"
          placeholder="Ex : Problème matériel impossible à résoudre à distance, remplacement du terminal requis..."></textarea>
        <mat-hint>Décrivez pourquoi un déplacement physique est nécessaire</mat-hint>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>Annuler</button>
      <button mat-raised-button color="warn" [mat-dialog-close]="note.trim()" [disabled]="!note.trim()">
        <mat-icon>send</mat-icon> Envoyer la demande
      </button>
    </mat-dialog-actions>
  `,
  styles: [`:host { display:block; } .agent-ref { font-size:13px; color:#555; margin-bottom:8px; }`]
})
export class DeplacementDialogComponent {
  data = inject<{ agentNom: string }>(MAT_DIALOG_DATA);
  note = '';
}

@Component({
  selector: 'app-intervention-list',
  standalone: true,
  imports: [
    RouterLink, FormsModule, DatePipe,
    MatTableModule, MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatSnackBarModule, MatTooltipModule,
    MatMenuModule, MatBadgeModule, MatDialogModule, MatCheckboxModule, MatPaginatorModule,
    MatDatepickerModule,
    KanbanComponent
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>{{ auth.isTechnicien() ? 'Mes interventions' : 'Interventions' }}</h1>
          @if ((auth.isTechnicien() || auth.isAdmin()) && pendingCount() > 0) {
            <p class="pending-notice">
              <mat-icon>notifications_active</mat-icon>
              {{ pendingCount() }} intervention(s) vous ont été assignée(s) et attendent votre prise en charge
            </p>
          }
          @if (!auth.isTechnicien() && deplacementCount() > 0) {
            <p class="deplacement-notice">
              <mat-icon>directions_car</mat-icon>
              {{ deplacementCount() }} intervention(s) requièrent un déplacement de l'équipe technique
            </p>
          }
        </div>
        <div class="page-header-actions">
          <div class="view-toggle">
            <button mat-icon-button (click)="viewMode.set('list')"
                    [class.active-view]="viewMode() === 'list'" matTooltip="Vue liste">
              <mat-icon>view_list</mat-icon>
            </button>
            <button mat-icon-button (click)="viewMode.set('kanban')"
                    [class.active-view]="viewMode() === 'kanban'" matTooltip="Vue Kanban">
              <mat-icon>view_kanban</mat-icon>
            </button>
          </div>
          @if (!auth.isTechnicien()) {
            <button mat-stroked-button (click)="exportCsv()">
              <mat-icon>table_view</mat-icon> CSV
            </button>
            <button mat-stroked-button (click)="exportPdf()">
              <mat-icon>picture_as_pdf</mat-icon> PDF
            </button>
            <a mat-raised-button color="primary" routerLink="/interventions/new">
              <mat-icon>add</mat-icon> Nouvelle intervention
            </a>
          }
        </div>
      </div>

      <!-- Kanban view -->
      @if (viewMode() === 'kanban') {
        <app-kanban></app-kanban>
      }

      @if (highlightId()) {
        <div class="highlight-banner">
          <mat-icon>search</mat-icon>
          <span>Résultat de recherche — une seule intervention affichée</span>
          <button mat-button (click)="resetFilters()">Voir toutes les interventions</button>
        </div>
      }

      <!-- Filtres (liste only) -->
      @if (viewMode() === 'list') {
      <div class="search-bar">
        <mat-form-field appearance="outline">
          <mat-label>Rechercher</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)" placeholder="Agent, description...">
        </mat-form-field>

        <mat-form-field appearance="outline" style="width:160px">
          <mat-label>Type</mat-label>
          <mat-select [ngModel]="filterType()" (ngModelChange)="filterType.set($event)">
            <mat-option value="">Tous</mat-option>
            @for (t of types(); track t.id) { <mat-option [value]="t.label">{{ t.label }}</mat-option> }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" style="width:150px">
          <mat-label>Statut</mat-label>
          <mat-select [ngModel]="filterStatut()" (ngModelChange)="filterStatut.set($event)">
            <mat-option value="">Tous</mat-option>
            <mat-option value="Assignée">Assignée</mat-option>
            <mat-option value="En cours">En cours</mat-option>
            <mat-option value="Terminée">Terminée</mat-option>
            <mat-option value="Échec">Échec</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" style="width:150px">
          <mat-label>Du</mat-label>
          <input matInput [matDatepicker]="pickerFrom" [ngModel]="filterDateFrom()" (ngModelChange)="filterDateFrom.set($event)" readonly>
          <mat-datepicker-toggle matSuffix [for]="pickerFrom"></mat-datepicker-toggle>
          <mat-datepicker #pickerFrom></mat-datepicker>
        </mat-form-field>

        <mat-form-field appearance="outline" style="width:150px">
          <mat-label>Au</mat-label>
          <input matInput [matDatepicker]="pickerTo" [ngModel]="filterDateTo()" (ngModelChange)="filterDateTo.set($event)" readonly>
          <mat-datepicker-toggle matSuffix [for]="pickerTo"></mat-datepicker-toggle>
          <mat-datepicker #pickerTo></mat-datepicker>
        </mat-form-field>

        @if (!auth.isTechnicien()) {
          <button mat-stroked-button
                  [color]="filterDeplacement() ? 'warn' : ''"
                  (click)="filterDeplacement.set(!filterDeplacement())"
                  class="deplacement-filter-btn"
                  [matTooltip]="filterDeplacement() ? 'Afficher tout' : 'Déplacements uniquement'">
            <mat-icon>directions_car</mat-icon>
            Déplacements
            @if (deplacementCount() > 0) {
              <span class="dep-count-badge">{{ deplacementCount() }}</span>
            }
          </button>
        }

        @if (hasFilter()) {
          <button mat-stroked-button (click)="resetFilters()" class="reset-btn">
            <mat-icon>filter_alt_off</mat-icon> Réinitialiser
          </button>
        }

        <span class="result-count">{{ filtered().length }} résultat(s)</span>
      </div>

      <div class="table-container">
        <table mat-table [dataSource]="pagedInterventions()">
          <!-- Priorité (technicien) -->
          @if (auth.isTechnicien()) {
            <ng-container matColumnDef="priorite">
              <th mat-header-cell *matHeaderCellDef>Prio.</th>
              <td mat-cell *matCellDef="let i">
                @if (i.priorite) {
                  <span class="prio-dot {{ i.priorite.toLowerCase() }}" [matTooltip]="i.priorite">
                    <mat-icon>{{ prioIcon(i.priorite) }}</mat-icon>
                  </span>
                }
              </td>
            </ng-container>
          }

          <ng-container matColumnDef="date">
            <th mat-header-cell *matHeaderCellDef (click)="toggleSort('dateDebut')" class="sortable-th">
              Date <mat-icon class="sort-icon">{{ sortIcon('dateDebut') }}</mat-icon>
            </th>
            <td mat-cell *matCellDef="let i">
              {{ (i.datePlanifiee || i.dateDebut) | date:'dd/MM/yy HH:mm' }}
            </td>
          </ng-container>

          <ng-container matColumnDef="agent">
            <th mat-header-cell *matHeaderCellDef (click)="toggleSort('agentNom')" class="sortable-th">
              Agent <mat-icon class="sort-icon">{{ sortIcon('agentNom') }}</mat-icon>
            </th>
            <td mat-cell *matCellDef="let i">
              <a [routerLink]="['/agents', i.agentId]" class="agent-link">{{ i.agentNom }}</a>
              <div class="sub-text">{{ i.agentZone }}</div>
              @if (agentDayInterventions(i.agentId, i.id).length > 0) {
                <div class="day-badge" [matTooltip]="agentDayTooltip(i.agentId, i.id)" matTooltipClass="multiline-tooltip">
                  <mat-icon>history</mat-icon>
                  {{ agentDayInterventions(i.agentId, i.id).length }} autre(s) ce jour
                </div>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="type">
            <th mat-header-cell *matHeaderCellDef (click)="toggleSort('type')" class="sortable-th">
              Type <mat-icon class="sort-icon">{{ sortIcon('type') }}</mat-icon>
            </th>
            <td mat-cell *matCellDef="let i">
              <div class="type-cell">
                <mat-icon>{{ typeIcon(i.type) }}</mat-icon>
                {{ i.type }}
                @if (i.viaSignalement) {
                  <mat-icon class="signalement-icon" matTooltip="Créée depuis un signalement agent (QR code)">qr_code_2</mat-icon>
                }
                @if (i.pieceJointe) {
                  <img [src]="i.pieceJointe" class="attach-thumb-sm" (click)="openAttachment(i.pieceJointe)"
                       matTooltip="Photo jointe par l'agent" alt="Photo">
                }
              </div>
            </td>
          </ng-container>

          @if (!auth.isTechnicien()) {
            <ng-container matColumnDef="technicien">
              <th mat-header-cell *matHeaderCellDef (click)="toggleSort('technicienNom')" class="sortable-th">
                Technicien <mat-icon class="sort-icon">{{ sortIcon('technicienNom') }}</mat-icon>
              </th>
              <td mat-cell *matCellDef="let i">{{ i.technicienNom }}</td>
            </ng-container>
          }

          <ng-container matColumnDef="affecte">
            <th mat-header-cell *matHeaderCellDef (click)="toggleSort('assignedByNom')" class="sortable-th">
              Affecté par <mat-icon class="sort-icon">{{ sortIcon('assignedByNom') }}</mat-icon>
            </th>
            <td mat-cell *matCellDef="let i">
              @if (i.assignedByNom) {
                <span class="assigned-by">
                  <mat-icon>support_agent</mat-icon> {{ i.assignedByNom }}
                </span>
              } @else {
                <span class="sub-text">Auto</span>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="duree">
            <th mat-header-cell *matHeaderCellDef (click)="toggleSort('duree')" class="sortable-th">
              Durée <mat-icon class="sort-icon">{{ sortIcon('duree') }}</mat-icon>
            </th>
            <td mat-cell *matCellDef="let i">{{ i.duree ? i.duree + ' min' : '—' }}</td>
          </ng-container>

          <ng-container matColumnDef="statut">
            <th mat-header-cell *matHeaderCellDef (click)="toggleSort('statut')" class="sortable-th">
              Statut <mat-icon class="sort-icon">{{ sortIcon('statut') }}</mat-icon>
            </th>
            <td mat-cell *matCellDef="let i">
              <div class="statut-col">
                <span class="status-chip {{ iStatutClass(i.statut) }}">{{ i.statut }}</span>
                @if (i.deplacementRequis) {
                  <span class="dep-badge" [matTooltip]="i.deplacementNote || 'Déplacement requis'">
                    <mat-icon>directions_car</mat-icon> Déplacement
                  </span>
                }
                @if (i.observations) {
                  <mat-icon class="obs-icon" [matTooltip]="i.observations" matTooltipClass="desc-tooltip">chat_bubble_outline</mat-icon>
                }
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="description">
            <th mat-header-cell *matHeaderCellDef (click)="toggleSort('description')" class="sortable-th">
              Description <mat-icon class="sort-icon">{{ sortIcon('description') }}</mat-icon>
            </th>
            <td mat-cell *matCellDef="let i" class="desc-cell"
                [matTooltip]="i.description" matTooltipClass="desc-tooltip" [matTooltipDisabled]="!i.description">
              {{ i.description }}
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let i">
              <!-- TECHNICIEN ou ADMIN assigné à cette intervention -->
              @if (auth.isTechnicien() || isMyIntervention(i)) {
                <div class="tech-actions">
                  @if (i.statut === 'Assignée') {
                    <button mat-stroked-button color="primary" class="take-btn" (click)="prendreEnCharge(i)">
                      <mat-icon>play_arrow</mat-icon> Prendre en charge
                    </button>
                  } @else if (i.statut === 'En cours') {
                    <div class="status-actions">
                      <span class="chrono-badge">
                        <mat-icon>timer</mat-icon> {{ elapsedTime(i) }}
                      </span>
                      <button mat-flat-button class="btn-terminee" (click)="markTerminee(i)" matTooltip="Terminée">
                        <mat-icon>check_circle</mat-icon> Terminée
                      </button>
                      <button mat-flat-button class="btn-echec" (click)="markEchec(i)" matTooltip="Échec">
                        <mat-icon>cancel</mat-icon> Échec
                      </button>
                    </div>
                  }
                  @if ((i.statut === 'Assignée' || i.statut === 'En cours') && !i.deplacementRequis && !i.deplacementValide) {
                    <button mat-icon-button class="btn-dep" (click)="demanderDeplacement(i)"
                            matTooltip="Demander un déplacement physique">
                      <mat-icon>directions_car</mat-icon>
                    </button>
                  }
                  @if (i.deplacementRequis && !i.deplacementValide && !i.deplacementRefuse) {
                    <span class="dep-pending-tag" [matTooltip]="i.deplacementNote || 'Déplacement en attente de validation'">
                      <mat-icon>directions_car</mat-icon> En attente
                    </span>
                  }
                  @if (i.deplacementRequis && i.deplacementValide && i.chauffeurId) {
                    <span class="dep-valide-tag" [matTooltip]="'Chauffeur : ' + i.chauffeurNom + ' — validé par ' + i.deplacementValideBy">
                      <mat-icon>local_shipping</mat-icon> Validé — {{ i.chauffeurNom }}
                    </span>
                  }
                  @if (i.deplacementRequis && i.deplacementValide && !i.chauffeurId) {
                    <span class="dep-done-tag" matTooltip="Le chauffeur a livré le technicien sur site">
                      <mat-icon>where_to_vote</mat-icon> Technicien livré
                    </span>
                  }
                  @if (i.deplacementRequis && i.deplacementRefuse) {
                    <span class="dep-refuse-tag" [matTooltip]="'Refusé par ' + i.deplacementRefuseBy">
                      <mat-icon>block</mat-icon> Déplacement refusé
                    </span>
                  }
                </div>
              }

              <!-- SUPPORT / ADMIN non assigné / SUPERADMIN -->
              @if (!auth.isTechnicien() && (!isMyIntervention(i) || auth.isSuperadmin())) {
                <button mat-icon-button [matMenuTriggerFor]="rowMenu" matTooltip="Actions">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #rowMenu="matMenu">
                  @if ((auth.isSuperadmin() || auth.isAdmin()) && i.statut === 'Assignée') {
                    <button mat-menu-item (click)="markEnCours(i)">
                      <mat-icon>play_circle</mat-icon> Marquer En cours
                    </button>
                    <button mat-menu-item (click)="markEchec(i)">
                      <mat-icon>cancel</mat-icon> Marquer Échec
                    </button>
                  }
                  @if ((auth.isSuperadmin() || auth.isAdmin()) && i.statut === 'En cours') {
                    <button mat-menu-item (click)="markTerminee(i)">
                      <mat-icon>check_circle</mat-icon> Marquer Terminée
                    </button>
                    <button mat-menu-item (click)="markEchec(i)">
                      <mat-icon>cancel</mat-icon> Marquer Échec
                    </button>
                  }
                  <!-- Support uniquement : demander déplacement -->
                  @if (auth.isSupport() && (i.statut === 'Assignée' || i.statut === 'En cours') && !i.deplacementRequis && !i.deplacementValide) {
                    <button mat-menu-item (click)="demanderDeplacement(i)" class="dep-menu-item">
                      <mat-icon>directions_car</mat-icon> Demander un déplacement
                    </button>
                  }
                  <!-- Admin : gérer déplacement -->
                  @if (auth.isAdmin() && i.deplacementRequis && !i.deplacementValide && !i.deplacementRefuse) {
                    <button mat-menu-item (click)="affecterChauffeur(i)" class="resolve-menu-item">
                      <mat-icon>local_shipping</mat-icon> Affecter à un chauffeur
                    </button>
                    <button mat-menu-item (click)="refuserDeplacement(i)" class="refuse-menu-item">
                      <mat-icon>block</mat-icon> Refuser le déplacement
                    </button>
                  }
                  @if (auth.isAdmin() && i.deplacementRequis && i.deplacementRefuse) {
                    <button mat-menu-item (click)="affecterChauffeur(i)" class="resolve-menu-item">
                      <mat-icon>local_shipping</mat-icon> Affecter quand même un chauffeur
                    </button>
                  }
                  @if (auth.isAdmin() && i.deplacementRequis && i.statut !== 'Terminée' && i.statut !== 'Échec') {
                    <button mat-menu-item (click)="annulerDeplacement(i)" class="delete-btn">
                      <mat-icon>cancel</mat-icon> Annuler le déplacement
                    </button>
                  }
                  @if (auth.isAdmin() && i.deplacementValide) {
                    <button mat-menu-item disabled style="color:#2e7d32">
                      <mat-icon>check_circle</mat-icon> Chauffeur : {{ i.chauffeurNom }}
                    </button>
                  }
                  @if (i.statut === 'Terminée') {
                    <button mat-menu-item (click)="evaluer(i)">
                      <mat-icon>star_rate</mat-icon> Évaluer
                    </button>
                  }
                  @if (!auth.isTechnicien()) {
                    <button mat-menu-item (click)="cloner(i)">
                      <mat-icon>content_copy</mat-icon> Cloner
                    </button>
                  }
                  @if (auth.isSuperadmin()) {
                    <button mat-menu-item (click)="delete(i)" class="delete-btn">
                      <mat-icon>delete</mat-icon> Supprimer
                    </button>
                  }
                </mat-menu>
              }
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns()"></tr>
          <tr mat-row *matRowDef="let row; columns: columns();"
              [class.row-assignee]="row.statut === 'Assignée' && auth.isTechnicien()"
              [class.row-en-cours]="row.statut === 'En cours' && auth.isTechnicien()"
              [class.row-deplacement]="row.deplacementRequis"></tr>
        </table>

        <!-- Cartes (mobile) -->
        <div class="intervention-cards">
          @for (i of pagedInterventions(); track i.id) {
            <div class="int-card"
                 [class.row-assignee]="i.statut === 'Assignée' && auth.isTechnicien()"
                 [class.row-en-cours]="i.statut === 'En cours' && auth.isTechnicien()"
                 [class.row-deplacement]="i.deplacementRequis">
              <div class="ic-top">
                <div class="ic-date">{{ (i.datePlanifiee || i.dateDebut) | date:'dd/MM/yy HH:mm' }}</div>
                <div class="type-cell">
                  <mat-icon>{{ typeIcon(i.type) }}</mat-icon>{{ i.type }}
                  @if (i.viaSignalement) {
                    <mat-icon class="signalement-icon" matTooltip="Créée depuis un signalement agent (QR code)">qr_code_2</mat-icon>
                  }
                </div>
              </div>
              <a [routerLink]="['/agents', i.agentId]" class="agent-link ic-agent">{{ i.agentNom }}</a>
              <div class="sub-text">{{ i.agentZone }}</div>
              @if (i.pieceJointe) {
                <img [src]="i.pieceJointe" class="attach-thumb-mobile" (click)="openAttachment(i.pieceJointe)" alt="Photo jointe par l'agent">
              }
              @if (!auth.isTechnicien()) {
                <div class="ic-line"><span class="ic-label">Technicien</span> {{ i.technicienNom }}</div>
              }
              <div class="ic-line">
                <span class="ic-label">Affecté par</span>
                @if (i.assignedByNom) { {{ i.assignedByNom }} } @else { Auto }
              </div>
              <div class="ic-row">
                <span class="status-chip {{ iStatutClass(i.statut) }}">{{ i.statut }}</span>
                @if (i.deplacementRequis) {
                  <span class="dep-badge" [matTooltip]="i.deplacementNote || 'Déplacement requis'">
                    <mat-icon>directions_car</mat-icon> Déplacement
                  </span>
                }
                @if (i.observations) {
                  <mat-icon class="obs-icon" [matTooltip]="i.observations" matTooltipClass="desc-tooltip">chat_bubble_outline</mat-icon>
                }
              </div>
              @if (i.description) {
                <div class="ic-desc">{{ i.description }}</div>
              }

              <div class="ic-actions">
                @if (auth.isTechnicien() || isMyIntervention(i)) {
                  <div class="tech-actions">
                    @if (i.statut === 'Assignée') {
                      <button mat-stroked-button color="primary" class="take-btn" (click)="prendreEnCharge(i)">
                        <mat-icon>play_arrow</mat-icon> Prendre en charge
                      </button>
                    } @else if (i.statut === 'En cours') {
                      <div class="status-actions">
                        <span class="chrono-badge"><mat-icon>timer</mat-icon> {{ elapsedTime(i) }}</span>
                        <button mat-flat-button class="btn-terminee" (click)="markTerminee(i)" matTooltip="Terminée">
                          <mat-icon>check_circle</mat-icon> Terminée
                        </button>
                        <button mat-flat-button class="btn-echec" (click)="markEchec(i)" matTooltip="Échec">
                          <mat-icon>cancel</mat-icon> Échec
                        </button>
                      </div>
                    }
                    @if ((i.statut === 'Assignée' || i.statut === 'En cours') && !i.deplacementRequis && !i.deplacementValide) {
                      <button mat-icon-button class="btn-dep" (click)="demanderDeplacement(i)"
                              matTooltip="Demander un déplacement physique">
                        <mat-icon>directions_car</mat-icon>
                      </button>
                    }
                    @if (i.deplacementRequis && !i.deplacementValide && !i.deplacementRefuse) {
                      <span class="dep-pending-tag" [matTooltip]="i.deplacementNote || 'Déplacement en attente de validation'">
                        <mat-icon>directions_car</mat-icon> En attente
                      </span>
                    }
                    @if (i.deplacementRequis && i.deplacementValide && i.chauffeurId) {
                      <span class="dep-valide-tag" [matTooltip]="'Chauffeur : ' + i.chauffeurNom + ' — validé par ' + i.deplacementValideBy">
                        <mat-icon>local_shipping</mat-icon> Validé — {{ i.chauffeurNom }}
                      </span>
                    }
                    @if (i.deplacementRequis && i.deplacementValide && !i.chauffeurId) {
                      <span class="dep-done-tag" matTooltip="Le chauffeur a livré le technicien sur site">
                        <mat-icon>where_to_vote</mat-icon> Technicien livré
                      </span>
                    }
                    @if (i.deplacementRequis && i.deplacementRefuse) {
                      <span class="dep-refuse-tag" [matTooltip]="'Refusé par ' + i.deplacementRefuseBy">
                        <mat-icon>block</mat-icon> Déplacement refusé
                      </span>
                    }
                  </div>
                }
                @if (!auth.isTechnicien() && (!isMyIntervention(i) || auth.isSuperadmin())) {
                  <button mat-icon-button [matMenuTriggerFor]="cardRowMenu" matTooltip="Actions">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #cardRowMenu="matMenu">
                    @if ((auth.isSuperadmin() || auth.isAdmin()) && i.statut === 'Assignée') {
                      <button mat-menu-item (click)="markEnCours(i)"><mat-icon>play_circle</mat-icon> Marquer En cours</button>
                      <button mat-menu-item (click)="markEchec(i)"><mat-icon>cancel</mat-icon> Marquer Échec</button>
                    }
                    @if ((auth.isSuperadmin() || auth.isAdmin()) && i.statut === 'En cours') {
                      <button mat-menu-item (click)="markTerminee(i)"><mat-icon>check_circle</mat-icon> Marquer Terminée</button>
                      <button mat-menu-item (click)="markEchec(i)"><mat-icon>cancel</mat-icon> Marquer Échec</button>
                    }
                    @if (auth.isSupport() && (i.statut === 'Assignée' || i.statut === 'En cours') && !i.deplacementRequis && !i.deplacementValide) {
                      <button mat-menu-item (click)="demanderDeplacement(i)" class="dep-menu-item">
                        <mat-icon>directions_car</mat-icon> Demander un déplacement
                      </button>
                    }
                    @if (auth.isAdmin() && i.deplacementRequis && !i.deplacementValide && !i.deplacementRefuse) {
                      <button mat-menu-item (click)="affecterChauffeur(i)" class="resolve-menu-item">
                        <mat-icon>local_shipping</mat-icon> Affecter à un chauffeur
                      </button>
                      <button mat-menu-item (click)="refuserDeplacement(i)" class="refuse-menu-item">
                        <mat-icon>block</mat-icon> Refuser le déplacement
                      </button>
                    }
                    @if (auth.isAdmin() && i.deplacementRequis && i.deplacementRefuse) {
                      <button mat-menu-item (click)="affecterChauffeur(i)" class="resolve-menu-item">
                        <mat-icon>local_shipping</mat-icon> Affecter quand même un chauffeur
                      </button>
                    }
                    @if (auth.isAdmin() && i.deplacementRequis && i.statut !== 'Terminée' && i.statut !== 'Échec') {
                      <button mat-menu-item (click)="annulerDeplacement(i)" class="delete-btn">
                        <mat-icon>cancel</mat-icon> Annuler le déplacement
                      </button>
                    }
                    @if (auth.isAdmin() && i.deplacementValide) {
                      <button mat-menu-item disabled style="color:#2e7d32">
                        <mat-icon>check_circle</mat-icon> Chauffeur : {{ i.chauffeurNom }}
                      </button>
                    }
                    @if (i.statut === 'Terminée') {
                      <button mat-menu-item (click)="evaluer(i)"><mat-icon>star_rate</mat-icon> Évaluer</button>
                    }
                    @if (!auth.isTechnicien()) {
                      <button mat-menu-item (click)="cloner(i)"><mat-icon>content_copy</mat-icon> Cloner</button>
                    }
                    @if (auth.isSuperadmin()) {
                      <button mat-menu-item (click)="delete(i)" class="delete-btn"><mat-icon>delete</mat-icon> Supprimer</button>
                    }
                  </mat-menu>
                }
              </div>
            </div>
          }
        </div>

        @if (filtered().length === 0) {
          <div class="empty-state">
            <mat-icon>assignment_turned_in</mat-icon>
            <h3>Aucune intervention</h3>
            <p>{{ auth.isTechnicien() ? 'Aucune intervention ne vous est assignée' : 'Créez votre première intervention' }}</p>
            @if (!auth.isTechnicien()) {
              <a mat-raised-button color="primary" routerLink="/interventions/new" style="margin-top:16px">
                <mat-icon>add</mat-icon> Nouvelle intervention
              </a>
            }
          </div>
        }
      </div>

      <mat-paginator
        [length]="filtered().length"
        [pageSize]="pageSize()"
        [pageIndex]="pageIndex()"
        [pageSizeOptions]="[10, 25, 50]"
        (page)="onPage($event)"
        showFirstLastButtons>
      </mat-paginator>
      } <!-- end @if list -->
    </div>
  `,
  styles: [`
    .table-container { overflow-x: auto; }
    .pending-notice { display: flex; align-items: center; gap: 6px; color: #e65100; font-size: 13px; margin-top: 4px; font-weight: 500; mat-icon { font-size: 16px; width: 16px; height: 16px; } }
    .deplacement-notice { display: flex; align-items: center; gap: 6px; color: #6a1b9a; font-size: 13px; margin-top: 4px; font-weight: 500; mat-icon { font-size: 16px; width: 16px; height: 16px; } }
    .view-toggle { display: flex; background: #f0f4f8; border-radius: 8px; padding: 2px;
      button { border-radius: 6px !important; &.active-view { background: white; box-shadow: 0 1px 4px rgba(0,0,0,.12); mat-icon { color: var(--primary); } } }
    }

    .agent-link { text-decoration: none; font-weight: 600; color: var(--primary); font-size: 13px; }
    .sub-text { font-size: 11px; color: var(--text-secondary); }
    .sortable-th { cursor: pointer; user-select: none; white-space: nowrap;
      &:hover { background: rgba(0,0,0,0.04); }
      .sort-icon { font-size: 14px; width: 14px; height: 14px; vertical-align: middle; opacity: 0.5; }
      &:hover .sort-icon { opacity: 1; }
    }
    .day-badge {
      display: inline-flex; align-items: center; gap: 3px; margin-top: 3px;
      font-size: 10px; font-weight: 700; color: #e65100;
      background: #fff3e0; border: 1px solid #ffcc80; border-radius: 6px;
      padding: 1px 6px; cursor: default; white-space: nowrap;
      mat-icon { font-size: 11px; width: 11px; height: 11px; }
    }
    .type-cell { display: flex; align-items: center; gap: 6px; mat-icon { font-size: 16px; color: var(--primary-light); } }
    .signalement-icon { font-size: 15px !important; width: 15px !important; height: 15px !important; color: #e65100 !important; }
    .attach-thumb-sm { width: 26px; height: 26px; object-fit: cover; border-radius: 5px; cursor: pointer; border: 1px solid #e2e8f0; }
    .attach-thumb-mobile { width: 100%; max-height: 130px; object-fit: cover; border-radius: 8px; cursor: pointer; margin-top: 4px; }
    .desc-cell { max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; }
    .result-count { color: var(--text-secondary); font-size: 13px; margin-left: auto; white-space: nowrap; }

    .highlight-banner {
      display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
      padding: 10px 14px; background: #e3f2fd; border: 1px solid #90caf9; border-radius: 8px;
      font-size: 13px; color: #0d47a1;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      button { margin-left: auto; }
    }
    .delete-btn { color: #c62828; }
    .assigned-by { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #e65100; mat-icon { font-size: 14px; width: 14px; height: 14px; } }

    /* ── Cartes interventions (mobile) ── */
    .intervention-cards { display: none; }
    @media (max-width: 640px) {
      .table-container table { display: none; }
      .intervention-cards { display: flex; flex-direction: column; gap: 10px; padding: 2px 2px 8px; }
    }
    .int-card {
      background: var(--surface, #fff); border: 1px solid #e8edf2; border-radius: 12px; padding: 12px 14px;
      &.row-assignee { border-left: 3px solid #f57c00; }
      &.row-en-cours { border-left: 3px solid #1565c0; }
      &.row-deplacement { background: #faf5fc; }
    }
    .ic-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    .ic-date { font-size: 11px; color: var(--text-secondary); font-weight: 600; }
    .ic-agent { display: block; font-weight: 700; font-size: 14px; margin-top: 2px; }
    .ic-line { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }
    .ic-label { font-weight: 600; color: var(--text-primary); margin-right: 4px; }
    .ic-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
    .ic-desc { font-size: 12px; color: var(--text-secondary); margin-top: 6px; }
    .ic-actions { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding-top: 8px; border-top: 1px solid #f0f0f0; }

    /* Priorité */
    .take-btn { height: 32px; font-size: 12px; padding: 0 10px; mat-icon { font-size: 16px; } }
    .prio-dot { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; mat-icon { font-size: 14px; width: 14px; height: 14px; } }
    .prio-dot.haute { background: #fce4ec; color: #c62828; }
    .prio-dot.normale { background: #e3f2fd; color: #1565c0; }
    .prio-dot.basse { background: #e8f5e9; color: #2e7d32; }

    /* Statut + déplacement badge */
    .statut-col { display: flex; flex-direction: column; gap: 3px; }
    .dep-badge {
      display: inline-flex; align-items: center; gap: 3px;
      font-size: 10px; font-weight: 600; color: #6a1b9a;
      background: #f3e5f5; border-radius: 4px; padding: 1px 5px;
      mat-icon { font-size: 12px; width: 12px; height: 12px; }
    }
    .obs-icon {
      font-size: 15px; width: 15px; height: 15px; color: #78909c; cursor: help;
    }

    /* Actions technicien */
    .tech-actions { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
    .status-actions { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
    .chrono-badge { display: inline-flex; align-items: center; gap: 3px; background: #fff8e1; color: #e65100; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 10px; font-family: monospace; mat-icon { font-size: 13px; width: 13px; height: 13px; } }
    .btn-terminee { background: #e8f5e9 !important; color: #2e7d32 !important; font-size: 11px; height: 30px; padding: 0 8px; min-width: 0; mat-icon { font-size: 14px; width: 14px; height: 14px; margin-right: 2px; } }
    .btn-echec { background: #fce4ec !important; color: #c62828 !important; font-size: 11px; height: 30px; padding: 0 8px; min-width: 0; mat-icon { font-size: 14px; width: 14px; height: 14px; margin-right: 2px; } }
    .btn-dep { color: #6a1b9a; width: 30px; height: 30px; mat-icon { font-size: 18px; } }
    .dep-pending-tag {
      display: inline-flex; align-items: center; gap: 2px;
      font-size: 10px; font-weight: 600; color: #6a1b9a;
      background: #f3e5f5; border-radius: 4px; padding: 2px 6px; cursor: default;
      mat-icon { font-size: 12px; width: 12px; height: 12px; }
    }
    .dep-valide-tag {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 10px; font-weight: 600; color: #1b5e20;
      background: #e8f5e9; border-radius: 4px; padding: 2px 8px; cursor: default;
      mat-icon { font-size: 12px; width: 12px; height: 12px; }
    }
    .dep-refuse-tag {
      display: inline-flex; align-items: center; gap: 2px;
      font-size: 10px; font-weight: 600; color: #b71c1c;
      background: #ffebee; border-radius: 4px; padding: 2px 6px; cursor: default;
      mat-icon { font-size: 12px; width: 12px; height: 12px; }
    }
    .dep-done-tag {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 10px; font-weight: 600; color: #01579b;
      background: #e1f5fe; border-radius: 4px; padding: 2px 8px; cursor: default;
      mat-icon { font-size: 12px; width: 12px; height: 12px; }
    }

    /* Menu items */
    .dep-menu-item { color: #6a1b9a; mat-icon { color: #6a1b9a; } }
    .refuse-menu-item { color: #c62828; mat-icon { color: #c62828; } }
    .resolve-menu-item { color: #2e7d32; mat-icon { color: #2e7d32; } }

    /* Filtre déplacement */
    .deplacement-filter-btn { display: flex; align-items: center; gap: 4px; position: relative; }
    .dep-count-badge {
      background: #6a1b9a; color: white;
      border-radius: 10px; font-size: 10px; font-weight: 700;
      padding: 1px 5px; margin-left: 2px;
    }

    /* Lignes surlignées */
    .row-assignee { background: #fff8f0 !important; }
    .row-en-cours { background: #f3f8ff !important; }
    .row-deplacement { background: #fdf0ff !important; border-left: 3px solid #9c27b0; }
  `]
})
export class InterventionListComponent implements OnDestroy {
  auth       = inject(AuthService);
  private route = inject(ActivatedRoute);

  // Tick every second to drive live elapsed-time display
  private now = signal(Date.now());
  private _tick = setInterval(() => this.now.set(Date.now()), 1000);

  // Arrivée depuis la recherche globale (résultat "Intervention") : affiche
  // uniquement l'intervention visée au lieu de la liste complète non filtrée.
  highlightId = signal<string | null>(null);
  private paramSub = this.route.queryParamMap.subscribe(params => {
    this.highlightId.set(params.get('id'));
  });

  ngOnDestroy() { clearInterval(this._tick); this.paramSub.unsubscribe(); }

  elapsedTime(i: { dateDebut: string; statut: string }): string {
    if (i.statut !== 'En cours' || !i.dateDebut) return '';
    const secs = Math.floor((this.now() - new Date(i.dateDebut).getTime()) / 1000);
    if (secs < 0) return '';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2,'0')}m`;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  exportSvc  = inject(ExportService);
  private evalSvc = inject(EvaluationService);

  private readonly EXPORT_COLS = [
    { key: 'dateDebut',     label: 'Date' },
    { key: 'agentNom',      label: 'Agent' },
    { key: 'agentZone',     label: 'Zone' },
    { key: 'type',          label: 'Type' },
    { key: 'technicienNom', label: 'Technicien' },
    { key: 'duree',         label: 'Durée (min)' },
    { key: 'statut',        label: 'Statut' },
    { key: 'description',   label: 'Description' },
  ];

  exportCsv(): void {
    const rows = this.filtered().map(i => ({ ...i, dateDebut: new Date(i.dateDebut).toLocaleString('fr-FR') }));
    this.exportSvc.exportCsv(rows as never, `interventions_${new Date().toISOString().split('T')[0]}`, this.EXPORT_COLS);
  }

  exportPdf(): void {
    const rows = this.filtered().map(i => ({ ...i, dateDebut: new Date(i.dateDebut).toLocaleString('fr-FR'), duree: i.duree ? `${i.duree} min` : '—' }));
    this.exportSvc.exportPdf('Liste des Interventions', this.EXPORT_COLS, rows as never);
  }
  private interventionSvc = inject(InterventionService);
  private userSvc = inject(UserService);
  private notifSvc = inject(NotificationService);
  private dialog     = inject(MatDialog);
  private snack      = inject(MatSnackBar);
  private confirmSvc = inject(ConfirmService);
  private typeSvc    = inject(TypeLabelService);

  types = computed(() => this.typeSvc.getByCategorie('intervention'));
  viewMode          = signal<'list' | 'kanban'>('list');
  searchQuery       = signal('');
  filterType        = signal('');
  filterStatut      = signal('');
  filterDeplacement = signal(false);
  filterDateFrom    = signal<Date | null>(null);
  filterDateTo      = signal<Date | null>(null);
  sortCol           = signal<string>('dateDebut');
  sortDir           = signal<'asc' | 'desc'>('desc');

  toggleSort(col: string): void {
    if (this.sortCol() === col) {
      this.sortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortCol.set(col);
      this.sortDir.set('asc');
    }
  }

  sortIcon(col: string): string {
    if (this.sortCol() !== col) return 'unfold_more';
    return this.sortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  columns = computed(() => {
    if (this.auth.isTechnicien()) {
      return ['priorite', 'date', 'agent', 'type', 'affecte', 'duree', 'statut', 'description', 'actions'];
    }
    return ['date', 'agent', 'type', 'technicien', 'affecte', 'duree', 'statut', 'description', 'actions'];
  });

  hasFilter = computed(() =>
    !!this.searchQuery() || !!this.filterType() || !!this.filterStatut() || this.filterDeplacement() ||
    !!this.filterDateFrom() || !!this.filterDateTo() || !!this.highlightId()
  );

  private toISODate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.filterType.set('');
    this.filterStatut.set('');
    this.filterDeplacement.set(false);
    this.filterDateFrom.set(null);
    this.filterDateTo.set(null);
    this.sortCol.set('dateDebut');
    this.sortDir.set('desc');
    this.highlightId.set(null);
  }

  pendingCount = computed(() => {
    const uid = this.auth.currentUser()?.id;
    return this.interventionSvc.getAllRaw().filter(i => i.statut === 'Assignée' && i.technicienId === uid).length;
  });

  deplacementCount = computed(() =>
    this.interventionSvc.getAllRaw().filter(i => i.deplacementRequis).length
  );

  pageSize  = signal(25);
  pageIndex = signal(0);

  filtered = computed(() => {
    const hId = this.highlightId();
    if (hId) return this.interventionSvc.getAll().filter(i => i.id === hId);

    let items = this.interventionSvc.getAll();
    if (this.filterDeplacement()) items = items.filter(i => i.deplacementRequis);
    const q = this.searchQuery().toLowerCase().trim();
    if (q) items = items.filter(i =>
      (i.agentNom ?? '').toLowerCase().includes(q) || (i.technicienNom ?? '').toLowerCase().includes(q) ||
      (i.description ?? '').toLowerCase().includes(q) || (i.type ?? '').toLowerCase().includes(q)
    );
    const ft = this.filterType();
    if (ft) items = items.filter(i => i.type === ft);
    const fs = this.filterStatut();
    if (fs) items = items.filter(i => i.statut === fs);
    const from = this.filterDateFrom();
    if (from) { const s = this.toISODate(from); items = items.filter(i => i.dateDebut >= s); }
    const to = this.filterDateTo() ? this.toISODate(this.filterDateTo()!) : '';
    if (to) items = items.filter(i => i.dateDebut <= to + 'T23:59:59');

    const col = this.sortCol();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    if (col) {
      return [...items].sort((a, b) => {
        const va = String((a as unknown as Record<string, unknown>)[col] ?? '');
        const vb = String((b as unknown as Record<string, unknown>)[col] ?? '');
        return va < vb ? -dir : va > vb ? dir : 0;
      });
    }
    return [...items].sort((a, b) => {
      if (a.deplacementRequis && !b.deplacementRequis) return -1;
      if (!a.deplacementRequis && b.deplacementRequis) return 1;
      if (a.statut === 'Assignée' && b.statut !== 'Assignée') return -1;
      if (b.statut === 'Assignée' && a.statut !== 'Assignée') return 1;
      const pMap: Record<string, number> = { 'Haute': 0, 'Normale': 1, 'Basse': 2 };
      const pd = (pMap[a.priorite ?? 'Normale'] ?? 1) - (pMap[b.priorite ?? 'Normale'] ?? 1);
      if (pd !== 0) return pd;
      return b.dateDebut.localeCompare(a.dateDebut);
    });
  });

  pagedInterventions = computed(() => {
    const all  = this.filtered();
    const size = this.pageSize();
    const start = this.pageIndex() * size;
    return start >= all.length ? all.slice(0, size) : all.slice(start, start + size);
  });

  onPage(e: PageEvent): void {
    this.pageSize.set(e.pageSize);
    this.pageIndex.set(e.pageIndex);
  }

  openAttachment(url: string): void {
    window.open(url, '_blank');
  }

  typeIcon(type: string): string {
    return this.typeSvc.getIcon('intervention', type);
  }

  iStatutClass(s: string): string {
    return { 'Assignée': 'assignee', 'En cours': 'en-cours', 'Terminée': 'terminee', 'Échec': 'echec' }[s] ?? '';
  }

  prioIcon(p: string): string {
    return { 'Haute': 'arrow_upward', 'Normale': 'remove', 'Basse': 'arrow_downward' }[p] ?? 'remove';
  }

  isMyIntervention(i: Intervention): boolean {
    return i.technicienId?.trim() === this.auth.currentUser()?.id?.trim();
  }

  agentDayInterventions(agentId: string, excludeId: string): Intervention[] {
    return this.interventionSvc.getAgentSameDayInterventions(agentId, excludeId);
  }

  agentDayTooltip(agentId: string, excludeId: string): string {
    return this.agentDayInterventions(agentId, excludeId)
      .map(h => {
        const time = new Date(h.dateDebut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        return `${time} — ${h.type} · ${h.technicienNom} (${h.statut})`;
      })
      .join('\n');
  }

  async prendreEnCharge(i: Intervention): Promise<void> {
    const result = await this.interventionSvc.update(i.id, { statut: 'En cours', dateDebut: new Date().toISOString() });
    if (result) {
      this.snack.open(`Intervention prise en charge : ${i.agentNom}`, 'OK', { duration: 2500, panelClass: 'info-snack' });
      const user = this.auth.currentUser()!;
      await this.notifSvc.send({
        type: 'prise_en_charge',
        agentId: i.agentId,
        agentNom: i.agentNom,
        interventionId: i.id,
        requestedById: user.id,
        requestedByNom: `${user.prenom} ${user.nom}`,
        requestedByRole: user.role,
        message: `${user.prenom} ${user.nom} a pris en charge l'intervention (${i.type}) chez ${i.agentNom} — ${i.agentZone}`,
      });
    } else {
      this.snack.open('Erreur lors de la mise à jour', 'OK', { duration: 3000, panelClass: 'error-snack' });
    }
  }

  async markEnCours(i: Intervention): Promise<void> {
    const result = await this.interventionSvc.update(i.id, { statut: 'En cours', dateDebut: new Date().toISOString() });
    if (result) {
      this.snack.open('Intervention marquée En cours', 'OK', { duration: 2000, panelClass: 'success-snack' });
    } else {
      this.snack.open('Erreur lors de la mise à jour', 'OK', { duration: 3000, panelClass: 'error-snack' });
    }
  }

  async markTerminee(i: Intervention): Promise<void> {
    const ref = this.dialog.open<TextInputDialogComponent, TextInputDialogData, string | null>(
      TextInputDialogComponent, {
        data: { title: 'Clôturer l\'intervention', label: 'Observations / compte-rendu', icon: 'check_circle', multiline: true, placeholder: 'Résumez l\'intervention, les actions effectuées…', confirmLabel: 'Marquer Terminée' },
        width: '460px'
      }
    );
    const obs = await ref.afterClosed().toPromise();
    if (obs === undefined) return; // annulé
    const result = await this.interventionSvc.update(i.id, { statut: 'Terminée', observations: obs ?? undefined });
    if (result) {
      this.snack.open('Intervention marquée Terminée ✓', 'OK', { duration: 2500, panelClass: 'success-snack' });
    } else {
      this.snack.open('Erreur lors de la mise à jour', 'OK', { duration: 3000, panelClass: 'error-snack' });
    }
  }

  async markEchec(i: Intervention): Promise<void> {
    const ref = this.dialog.open<TextInputDialogComponent, TextInputDialogData, string | null>(
      TextInputDialogComponent, {
        data: { title: 'Marquer en Échec', label: 'Raison de l\'échec', icon: 'cancel', multiline: true, placeholder: 'Décrivez la raison de l\'échec…', confirmLabel: 'Marquer Échec' },
        width: '460px'
      }
    );
    const obs = await ref.afterClosed().toPromise();
    if (obs === undefined) return;
    const result = await this.interventionSvc.update(i.id, {
      statut: 'Échec', dateFin: new Date().toISOString(), observations: obs ?? undefined
    });
    if (result) {
      this.snack.open('Intervention marquée en Échec', 'OK', { duration: 2500, panelClass: 'error-snack' });
    } else {
      this.snack.open('Erreur lors de la mise à jour', 'OK', { duration: 3000, panelClass: 'error-snack' });
    }
  }

  demanderDeplacement(i: Intervention): void {
    const ref = this.dialog.open(DeplacementDialogComponent, {
      data: { agentNom: i.agentNom },
      width: 'min(480px, 92vw)'
    });
    ref.afterClosed().subscribe(async (note: string | undefined) => {
      if (!note) return;
      const user = this.auth.currentUser()!;
      try {
        await this.interventionSvc.requestDeployment(i.id, note, `${user.prenom} ${user.nom}`);
        await this.notifSvc.send({
          type: 'deplacement_requis',
          agentId: i.agentId,
          agentNom: i.agentNom,
          interventionId: i.id,
          requestedById: user.id,
          requestedByNom: `${user.prenom} ${user.nom}`,
          requestedByRole: user.role,
          message: note
        });
        this.snack.open('Demande de déplacement envoyée aux administrateurs ✓', 'OK', { duration: 3000, panelClass: 'success-snack' });
      } catch (err: any) {
        if (err?.status === 409) {
          this.snack.open('Un déplacement est déjà en cours pour cette intervention', 'OK', { duration: 4000, panelClass: 'warn-snack' });
          await this.interventionSvc.loadFromApi();
        } else {
          this.snack.open('Erreur réseau — vérifiez la connexion au serveur', 'OK', { duration: 5000, panelClass: 'error-snack' });
        }
      }
    });
  }

  async annulerDeplacement(i: Intervention): Promise<void> {
    if (!await this.confirmSvc.ask(`Annuler complètement la demande de déplacement pour ${i.agentNom} ?\nL'intervention redeviendra normale.`, 'Annuler le déplacement', 'Annuler')) return;
    try {
      await this.interventionSvc.cancelDeployment(i.id);
      this.snack.open(`Déplacement annulé — ${i.agentNom}`, 'OK', { duration: 2500, panelClass: 'info-snack' });
    } catch {
      this.snack.open('Erreur : impossible d\'annuler le déplacement. Vérifiez que le serveur est démarré.', 'OK', { duration: 5000, panelClass: 'error-snack' });
    }
  }

  async refuserDeplacement(i: Intervention): Promise<void> {
    if (!await this.confirmSvc.ask(`Refuser la demande de déplacement pour ${i.agentNom} ?\nL'intervention continuera sans déplacement.`, 'Refuser le déplacement', 'Refuser')) return;
    try {
      await this.interventionSvc.cancelDeployment(i.id);
      this.snack.open(`Déplacement refusé — ${i.agentNom}`, 'OK', { duration: 2500, panelClass: 'info-snack' });
    } catch {
      this.snack.open('Erreur : impossible de refuser le déplacement. Vérifiez que le serveur est démarré.', 'OK', { duration: 5000, panelClass: 'error-snack' });
    }
  }

  affecterChauffeur(i: Intervention): void {
    const chauffeurs = this.userSvc.getByRole('chauffeur').filter(c => c.actif);
    const ref = this.dialog.open(AffecterChauffeurDialogComponent, {
      data: { agentNom: i.agentNom, chauffeurs },
      width: 'min(460px, 92vw)'
    });
    ref.afterClosed().subscribe(async (chauffeur: import('../../../core/models/user.model').User | undefined) => {
      if (!chauffeur) return;
      try {
        await this.interventionSvc.validateDeployment(i.id, chauffeur.id, `${chauffeur.prenom} ${chauffeur.nom}`);
        this.snack.open(`Déplacement affecté à ${chauffeur.prenom} ${chauffeur.nom} ✓`, 'OK', { duration: 3000, panelClass: 'success-snack' });
      } catch {
        this.snack.open('Erreur : impossible de valider le déplacement. Vérifiez que le serveur est démarré.', 'OK', { duration: 5000, panelClass: 'error-snack' });
      }
    });
  }

  async evaluer(i: Intervention): Promise<void> {
    const ref = this.dialog.open<StarRatingDialogComponent, StarRatingDialogData, StarRatingResult | null>(
      StarRatingDialogComponent, {
        data: { agentNom: i.agentNom, interventionType: i.type },
        width: '400px'
      }
    );
    const result = await ref.afterClosed().toPromise();
    if (!result) return;
    await this.evalSvc.submit(i.id, i.agentId, i.agentNom, result.note, result.commentaire);
    this.snack.open(`Évaluation enregistrée — ${result.note}/5 étoiles`, 'OK', { duration: 2500, panelClass: 'success-snack' });
  }

  async delete(i: Intervention): Promise<void> {
    if (!await this.confirmSvc.danger('Supprimer cette intervention ?', 'Supprimer l\'intervention')) return;
    const ok = await this.interventionSvc.delete(i.id);
    if (ok) {
      this.snack.open('Intervention supprimée', 'OK', { duration: 2000, panelClass: 'success-snack' });
    } else {
      this.snack.open('Erreur lors de la suppression', 'OK', { duration: 3000, panelClass: 'error-snack' });
    }
  }

  async cloner(i: Intervention): Promise<void> {
    try {
      await this.interventionSvc.create({
        agentId:       i.agentId,
        agentNom:      i.agentNom,
        agentZone:     i.agentZone,
        technicienId:  i.technicienId,
        technicienNom: i.technicienNom,
        type:          i.type,
        priorite:      i.priorite,
        description:   `[Clone] ${i.description}`,
        dateDebut:     new Date().toISOString(),
        statut:        'Assignée',
      });
      this.snack.open('Intervention clonée et assignée', 'OK', { duration: 2500, panelClass: 'success-snack' });
    } catch {
      this.snack.open('Erreur lors du clonage', 'OK', { duration: 3000, panelClass: 'error-snack' });
    }
  }
}
