import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { InterventionService } from '../../core/services/intervention.service';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { PresenceService } from '../../core/services/presence.service';
import { NotificationService } from '../../core/services/notification.service';
import { Intervention } from '../../core/models/intervention.model';
import { User } from '../../core/models/user.model';
import { AffecterChauffeurDialogComponent } from '../interventions/intervention-list/intervention-list.component';

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [
    RouterLink, FormsModule, DatePipe,
    MatCardModule, MatButtonModule, MatIconModule, MatTableModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatMenuModule,
    MatSnackBarModule, MatTooltipModule, MatDividerModule, MatChipsModule, MatDialogModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Support — Gestion des affectations</h1>
          <p class="subtitle">Affectez et suivez les interventions des techniciens</p>
        </div>
        <div class="page-header-actions">
          <a mat-raised-button color="primary" routerLink="/support/assign">
            <mat-icon>add_task</mat-icon> Affecter une intervention
          </a>
        </div>
      </div>

      <!-- Stats cards -->
      <div class="stats-grid">
        <div class="stat-card orange">
          <div class="stat-icon"><mat-icon>pending_actions</mat-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ countByStatut('Assignée') }}</div>
            <div class="stat-label">En attente</div>
          </div>
        </div>
        <div class="stat-card blue">
          <div class="stat-icon"><mat-icon>sync</mat-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ countByStatut('En cours') }}</div>
            <div class="stat-label">En cours</div>
          </div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon"><mat-icon>task_alt</mat-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ countByStatut('Terminée') }}</div>
            <div class="stat-label">Terminées</div>
          </div>
        </div>
        <div class="stat-card purple">
          <div class="stat-icon"><mat-icon>group</mat-icon></div>
          <div class="stat-info">
            <div class="stat-value">
              {{ techniciens().length }}
              @if (techOnlineCount() > 0) {
                <span class="online-stat-chip">
                  <span class="online-pulse-dot"></span>{{ techOnlineCount() }} en ligne
                </span>
              }
            </div>
            <div class="stat-label">Techniciens</div>
          </div>
        </div>
      </div>

      <div class="support-grid">
        <!-- Tableau des affectations -->
        <div class="main-col">
          <!-- Filtres -->
          <div class="search-bar">
            <div class="pill-field" style="flex:2 1 260px">
              <label class="pill-label">Rechercher</label>
              <mat-form-field appearance="outline" class="pill-select">
                <mat-icon matPrefix>search</mat-icon>
                <input matInput [ngModel]="search()" (ngModelChange)="search.set($event)" placeholder="Agent, technicien...">
              </mat-form-field>
            </div>
            <div class="pill-field" style="flex:1 1 170px">
              <label class="pill-label">Technicien</label>
              <mat-form-field appearance="outline" class="pill-select">
                <mat-icon matPrefix>engineering</mat-icon>
                <mat-select [ngModel]="filterTech()" (ngModelChange)="filterTech.set($event)">
                  <mat-option value="">Tous</mat-option>
                  @for (t of techniciens(); track t.id) {
                    <mat-option [value]="t.id">{{ t.prenom }} {{ t.nom }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>
            <div class="pill-field" style="flex:1 1 160px">
              <label class="pill-label">Statut</label>
              <mat-form-field appearance="outline" class="pill-select">
                <mat-icon matPrefix>flag</mat-icon>
                <mat-select [ngModel]="filterStatut()" (ngModelChange)="filterStatut.set($event)">
                  <mat-option value="">Tous</mat-option>
                  <mat-option value="Assignée">Assignée</mat-option>
                  <mat-option value="En cours">En cours</mat-option>
                  <mat-option value="Terminée">Terminée</mat-option>
                  <mat-option value="Échec">Échec</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
            <span class="result-count">{{ filtered().length }} résultat(s)</span>
          </div>

          <div class="table-container">
            <table mat-table [dataSource]="filtered()">
              <!-- Priorité -->
              <ng-container matColumnDef="priorite">
                <th mat-header-cell *matHeaderCellDef (click)="toggleSort('priorite')" class="sortable-th">
                  <span class="th-inner">Prio. <mat-icon class="sort-icon">{{ sortIcon('priorite') }}</mat-icon></span>
                </th>
                <td mat-cell *matCellDef="let i">
                  <span class="prio-dot {{ prioriteClass(i.priorite) }}" [matTooltip]="i.priorite ?? 'Normale'">
                    <mat-icon>{{ prioriteIcon(i.priorite) }}</mat-icon>
                  </span>
                </td>
              </ng-container>

              <!-- Agent -->
              <ng-container matColumnDef="agent">
                <th mat-header-cell *matHeaderCellDef (click)="toggleSort('agent')" class="sortable-th">
                  <span class="th-inner">Agent <mat-icon class="sort-icon">{{ sortIcon('agent') }}</mat-icon></span>
                </th>
                <td mat-cell *matCellDef="let i">
                  <a [routerLink]="['/agents', i.agentId]" class="agent-link">{{ i.agentNom }}</a>
                  <div class="sub-text">{{ i.agentZone }}</div>
                  @if (agentDayInterventions(i.agentId, i.id).length > 0) {
                    <div class="day-badge" [matTooltip]="agentDayTooltip(i.agentId, i.id)">
                      <mat-icon>history</mat-icon>
                      {{ agentDayInterventions(i.agentId, i.id).length }} autre(s) ce jour
                    </div>
                  }
                </td>
              </ng-container>

              <!-- Technicien -->
              <ng-container matColumnDef="technicien">
                <th mat-header-cell *matHeaderCellDef (click)="toggleSort('technicien')" class="sortable-th">
                  <span class="th-inner">Technicien <mat-icon class="sort-icon">{{ sortIcon('technicien') }}</mat-icon></span>
                </th>
                <td mat-cell *matCellDef="let i">
                  <div class="tech-cell">
                    <div class="tech-av-wrap-sm">
                      <div class="tech-avatar-sm">{{ techInitialsFromNom(i.technicienNom) }}</div>
                      <span class="pres-dot-sm" [class.online]="presenceSvc.isOnline(i.technicienId ?? '')"></span>
                    </div>
                    <span>{{ i.technicienNom }}</span>
                  </div>
                </td>
              </ng-container>

              <!-- Type -->
              <ng-container matColumnDef="type">
                <th mat-header-cell *matHeaderCellDef (click)="toggleSort('type')" class="sortable-th">
                  <span class="th-inner">Type <mat-icon class="sort-icon">{{ sortIcon('type') }}</mat-icon></span>
                </th>
                <td mat-cell *matCellDef="let i">{{ i.type }}</td>
              </ng-container>

              <!-- Date planifiée -->
              <ng-container matColumnDef="date">
                <th mat-header-cell *matHeaderCellDef (click)="toggleSort('date')" class="sortable-th">
                  <span class="th-inner">Planifiée <mat-icon class="sort-icon">{{ sortIcon('date') }}</mat-icon></span>
                </th>
                <td mat-cell *matCellDef="let i">
                  {{ i.datePlanifiee ? (i.datePlanifiee | date:'dd/MM/yy HH:mm') : (i.dateDebut | date:'dd/MM/yy HH:mm') }}
                </td>
              </ng-container>

              <!-- Statut -->
              <ng-container matColumnDef="statut">
                <th mat-header-cell *matHeaderCellDef (click)="toggleSort('statut')" class="sortable-th">
                  <span class="th-inner">Statut <mat-icon class="sort-icon">{{ sortIcon('statut') }}</mat-icon></span>
                </th>
                <td mat-cell *matCellDef="let i">
                  <span class="status-chip {{ sClass(i.statut) }}">{{ i.statut }}</span>
                  @if (i.deplacementRequis && !i.deplacementValide && !i.deplacementRefuse) {
                    <div class="dep-badge dep-warn" [matTooltip]="'Déplacement demandé : ' + (i.deplacementNote || '—') + '\nPar : ' + (i.deplacementRequestedBy || '—')">
                      <mat-icon>directions_car</mat-icon> Déplacem. en attente
                    </div>
                  }
                  @if (i.deplacementRequis && i.deplacementValide && i.chauffeurId) {
                    <div class="dep-badge dep-active" [matTooltip]="'Chauffeur : ' + i.chauffeurNom + ' en route'">
                      <mat-icon>local_shipping</mat-icon> Chauffeur en route
                    </div>
                  }
                  @if (i.deplacementRequis && i.deplacementValide && !i.chauffeurId) {
                    <div class="dep-badge dep-done" matTooltip="Technicien livré sur site">
                      <mat-icon>where_to_vote</mat-icon> Livré
                    </div>
                  }
                  @if (i.deplacementRefuse) {
                    <div class="dep-badge dep-refuse" matTooltip="Déplacement refusé">
                      <mat-icon>block</mat-icon> Refusé
                    </div>
                  }
                </td>
              </ng-container>

              <!-- Actions -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let i">
                  <button mat-icon-button [matMenuTriggerFor]="menu" matTooltip="Actions">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #menu="matMenu">
                    @if (i.statut !== 'Terminée' && i.statut !== 'Échec') {
                      @if (hasActiveDeplacement(i)) {
                        <button mat-menu-item (click)="reassignWithWarning(i)" class="reassign-warn-item">
                          <mat-icon>warning</mat-icon> Réaffecter (déplacement actif !)
                        </button>
                      } @else {
                        <a mat-menu-item [routerLink]="['/support/assign']" [queryParams]="{id: i.id}">
                          <mat-icon>swap_horiz</mat-icon> Réaffecter
                        </a>
                      }
                    }
                    @if (auth.isSuperadmin()) {
                      <button mat-menu-item (click)="annuler(i)" class="delete-menu-item">
                        <mat-icon>delete</mat-icon> Supprimer
                      </button>
                    }
                    <a mat-menu-item [routerLink]="['/agents', i.agentId]">
                      <mat-icon>person</mat-icon> Voir l'agent
                    </a>
                  </mat-menu>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="cols"></tr>
              <tr mat-row *matRowDef="let row; columns: cols;"></tr>
            </table>

            <!-- Cartes (mobile) -->
            <div class="support-cards">
              @for (i of filtered(); track i.id) {
                <div class="sup-card">
                  <div class="sup-top">
                    <span class="prio-dot {{ prioriteClass(i.priorite) }}" [matTooltip]="i.priorite ?? 'Normale'">
                      <mat-icon>{{ prioriteIcon(i.priorite) }}</mat-icon>
                    </span>
                    <span class="sup-date">{{ i.datePlanifiee ? (i.datePlanifiee | date:'dd/MM/yy HH:mm') : (i.dateDebut | date:'dd/MM/yy HH:mm') }}</span>
                    <button mat-icon-button [matMenuTriggerFor]="cardMenu" matTooltip="Actions" class="sup-menu-btn">
                      <mat-icon>more_vert</mat-icon>
                    </button>
                    <mat-menu #cardMenu="matMenu">
                      @if (i.statut !== 'Terminée' && i.statut !== 'Échec') {
                        @if (hasActiveDeplacement(i)) {
                          <button mat-menu-item (click)="reassignWithWarning(i)" class="reassign-warn-item">
                            <mat-icon>warning</mat-icon> Réaffecter (déplacement actif !)
                          </button>
                        } @else {
                          <a mat-menu-item [routerLink]="['/support/assign']" [queryParams]="{id: i.id}">
                            <mat-icon>swap_horiz</mat-icon> Réaffecter
                          </a>
                        }
                      }
                      @if (auth.isSuperadmin()) {
                        <button mat-menu-item (click)="annuler(i)" class="delete-menu-item">
                          <mat-icon>delete</mat-icon> Supprimer
                        </button>
                      }
                      <a mat-menu-item [routerLink]="['/agents', i.agentId]">
                        <mat-icon>person</mat-icon> Voir l'agent
                      </a>
                    </mat-menu>
                  </div>

                  <a [routerLink]="['/agents', i.agentId]" class="agent-link sup-agent">{{ i.agentNom }}</a>
                  <div class="sub-text">{{ i.agentZone }}</div>
                  @if (agentDayInterventions(i.agentId, i.id).length > 0) {
                    <div class="day-badge" [matTooltip]="agentDayTooltip(i.agentId, i.id)">
                      <mat-icon>history</mat-icon>
                      {{ agentDayInterventions(i.agentId, i.id).length }} autre(s) ce jour
                    </div>
                  }

                  <div class="sup-line">
                    <div class="tech-cell">
                      <div class="tech-av-wrap-sm">
                        <div class="tech-avatar-sm">{{ techInitialsFromNom(i.technicienNom) }}</div>
                        <span class="pres-dot-sm" [class.online]="presenceSvc.isOnline(i.technicienId ?? '')"></span>
                      </div>
                      <span>{{ i.technicienNom }}</span>
                    </div>
                    <span class="sub-text">{{ i.type }}</span>
                  </div>

                  <div class="sup-row">
                    <span class="status-chip {{ sClass(i.statut) }}">{{ i.statut }}</span>
                    @if (i.deplacementRequis && !i.deplacementValide && !i.deplacementRefuse) {
                      <div class="dep-badge dep-warn" [matTooltip]="'Déplacement demandé : ' + (i.deplacementNote || '—')">
                        <mat-icon>directions_car</mat-icon> En attente
                      </div>
                    }
                    @if (i.deplacementRequis && i.deplacementValide && i.chauffeurId) {
                      <div class="dep-badge dep-active" [matTooltip]="'Chauffeur : ' + i.chauffeurNom + ' en route'">
                        <mat-icon>local_shipping</mat-icon> En route
                      </div>
                    }
                    @if (i.deplacementRequis && i.deplacementValide && !i.chauffeurId) {
                      <div class="dep-badge dep-done" matTooltip="Technicien livré sur site">
                        <mat-icon>where_to_vote</mat-icon> Livré
                      </div>
                    }
                    @if (i.deplacementRefuse) {
                      <div class="dep-badge dep-refuse" matTooltip="Déplacement refusé">
                        <mat-icon>block</mat-icon> Refusé
                      </div>
                    }
                  </div>
                </div>
              }
            </div>

            @if (filtered().length === 0) {
              <div class="empty-state">
                <mat-icon>assignment_turned_in</mat-icon>
                <h3>Aucune affectation</h3>
                <p>Créez votre première affectation</p>
                <a mat-raised-button color="primary" routerLink="/support/assign" style="margin-top:16px">
                  <mat-icon>add_task</mat-icon> Affecter
                </a>
              </div>
            }
          </div>
        </div>

        <!-- Panel techniciens -->
        <div class="techniciens-panel">
          <!-- Signalements des agents (libre-service, pas encore assignés) -->
          @if (pendingSignalements().length > 0) {
            <mat-card style="margin-bottom:16px;border:1.5px solid #f57f17">
              <mat-card-header>
                <mat-card-title style="color:#f57f17">
                  <mat-icon style="color:#f57f17">campaign</mat-icon>
                  Signalements agents ({{ pendingSignalements().length }})
                </mat-card-title>
              </mat-card-header>
              <mat-card-content style="padding:0 0 8px">
                @for (n of pendingSignalements(); track n.id) {
                  <div class="signal-item">
                    <div class="signal-top">
                      <span class="signal-agent">{{ n.agentNom }}</span>
                      <span class="signal-time">{{ n.createdAt | date:'dd/MM HH:mm' }}</span>
                    </div>
                    <div class="signal-msg">{{ n.message }}</div>
                    @if (n.photoUrl) {
                      <img [src]="n.photoUrl" class="signal-photo" (click)="openPhoto(n.photoUrl!)" alt="Photo de la panne">
                    }
                    @if (n.audioUrl) {
                      <audio [src]="n.audioUrl" controls class="signal-audio"></audio>
                    }
                    <div class="signal-actions">
                      <button mat-stroked-button color="primary" class="signal-assign-btn" (click)="assignerSignalement(n)">
                        <mat-icon>engineering</mat-icon> Assigner
                      </button>
                      <button mat-icon-button matTooltip="Marquer traité" (click)="traiterSignalement(n)">
                        <mat-icon>check</mat-icon>
                      </button>
                    </div>
                  </div>
                  <mat-divider></mat-divider>
                }
              </mat-card-content>
            </mat-card>
          }

          <!-- Déplacements en attente -->
          @if (deplacementPending().length > 0 && canValidate()) {
            <mat-card style="margin-bottom:16px;border:1.5px solid #ff8f00">
              <mat-card-header>
                <mat-card-title style="color:#e65100">
                  <mat-icon style="color:#e65100">local_shipping</mat-icon>
                  Déplacements ({{ deplacementPending().length }} en attente)
                </mat-card-title>
              </mat-card-header>
              <mat-card-content style="padding:0 0 8px">
                @for (d of deplacementPending(); track d.id) {
                  <div class="depl-item">
                    <div class="depl-agent">
                      <mat-icon>person_pin</mat-icon>
                      <div>
                        <div class="depl-name">{{ d.agentNom }}</div>
                        <div class="depl-zone">{{ d.agentZone }}</div>
                      </div>
                    </div>
                    <div class="depl-tech"><mat-icon>engineering</mat-icon>{{ d.technicienNom }}</div>
                    @if (d.deplacementNote) {
                      <div class="depl-note"><mat-icon>chat_bubble_outline</mat-icon>{{ d.deplacementNote }}</div>
                    }
                    <button mat-stroked-button color="primary" class="depl-validate-btn" (click)="validateDeplacement(d)">
                      <mat-icon>check_circle</mat-icon> Valider le déplacement
                    </button>
                  </div>
                  <mat-divider></mat-divider>
                }
              </mat-card-content>
            </mat-card>
          }

          <mat-card>
            <mat-card-header>
              <mat-card-title>
                <mat-icon>engineering</mat-icon> Techniciens
                @if (techOnlineCount() > 0) {
                  <span class="tech-panel-online-badge">
                    <span class="online-pulse-dot"></span>{{ techOnlineCount() }} en ligne
                  </span>
                }
              </mat-card-title>
            </mat-card-header>
            <mat-card-content>
              @for (t of sortedTechniciens(); track t.id) {
                <div class="tech-item">
                  <div class="tech-header">
                    <div class="tech-av-wrap">
                      <div class="tech-av">{{ techInitials(t) }}</div>
                      <span class="pres-dot" [class.online]="presenceSvc.isOnline(t.id)"></span>
                    </div>
                    <div class="tech-details">
                      <div class="tech-name">{{ t.prenom }} {{ t.nom }}</div>
                      <div class="tech-status"
                           [class.active]="t.actif"
                           [class.is-online]="presenceSvc.isOnline(t.id)">
                        {{ presenceSvc.isOnline(t.id) ? 'En ligne' : (t.actif ? 'Disponible' : 'Inactif') }}
                      </div>
                    </div>
                    <a mat-icon-button [routerLink]="['/support/assign']" [queryParams]="{technicienId: t.id}" matTooltip="Affecter">
                      <mat-icon>add_task</mat-icon>
                    </a>
                  </div>
                  <div class="tech-load-bar">
                    <div class="load-items">
                      <span class="load-badge assignee">{{ getAssignedCount(t.id) }} assignée(s)</span>
                      <span class="load-badge en-cours">{{ getEnCoursCount(t.id) }} en cours</span>
                    </div>
                  </div>
                </div>
                <mat-divider></mat-divider>
              }
            </mat-card-content>
          </mat-card>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .subtitle { color: var(--text-secondary); font-size: 13px; margin-top: 4px; }

    .support-grid { display: grid; grid-template-columns: 1fr 260px; gap: 20px; align-items: start; }

    .main-col { display: flex; flex-direction: column; gap: 0; }

    .agent-link { text-decoration: none; font-weight: 600; color: var(--primary); font-size: 13px; }
    .sub-text { font-size: 11px; color: var(--text-secondary); }
    .day-badge {
      display: inline-flex; align-items: center; gap: 3px; margin-top: 3px;
      font-size: 10px; font-weight: 700; color: #e65100;
      background: #fff3e0; border: 1px solid #ffcc80; border-radius: 6px;
      padding: 1px 6px; cursor: default; white-space: nowrap;
      mat-icon { font-size: 11px; width: 11px; height: 11px; }
    }
    .result-count { color: var(--text-secondary); font-size: 13px; margin-left: auto; white-space: nowrap; }

    .sortable-th { cursor: pointer; user-select: none; white-space: nowrap; }
    .sortable-th:hover { background: rgba(0,0,0,0.04); }
    .th-inner { display: inline-flex; align-items: center; gap: 2px; }
    .sort-icon { font-size: 14px; width: 14px; height: 14px; color: var(--text-secondary); }

    .prio-dot { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; mat-icon { font-size: 16px; width: 16px; height: 16px; } }
    .prio-dot.haute { background: #fce4ec; color: #c62828; }
    .prio-dot.normale { background: #e3f2fd; color: #1565c0; }
    .prio-dot.basse { background: #e8f5e9; color: #2e7d32; }

    .tech-cell { display: flex; align-items: center; gap: 8px; }
    .tech-av-wrap-sm { position: relative; flex-shrink: 0; }
    .tech-avatar-sm { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg,#1a3a5c,#2a5fa0); color: white; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
    .pres-dot-sm { position: absolute; bottom: -1px; right: -1px; width: 8px; height: 8px; border-radius: 50%; background: #bdbdbd; border: 2px solid white; }
    .pres-dot-sm.online { background: #4caf50; }

    /* Panel techniciens */
    mat-card-header { padding: 12px 16px 0 !important; mat-card-title { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; mat-icon { font-size: 18px; color: var(--primary-light); } } }
    mat-card-content { padding: 8px 0 0 !important; }

    .tech-item { padding: 12px 16px; }
    .tech-header { display: flex; align-items: center; gap: 10px; }
    .tech-av-wrap { position: relative; flex-shrink: 0; }
    .tech-av { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg,#1a3a5c,#2a5fa0); color: white; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; }
    .pres-dot { position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; border-radius: 50%; background: #bdbdbd; border: 2px solid white; }
    .pres-dot.online { background: #4caf50; }
    .tech-details { flex: 1; }
    .tech-name { font-weight: 600; font-size: 13px; }
    .tech-status { font-size: 11px; color: var(--text-secondary); &.active { color: #2e7d32; } &.is-online { color: #4caf50; font-weight: 600; } }
    .load-items { display: flex; gap: 6px; margin-top: 8px; }
    .load-badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 500; }
    .load-badge.assignee { background: #fff3e0; color: #e65100; }
    .load-badge.en-cours { background: #e3f2fd; color: #1565c0; }

    /* Déplacements en attente */
    .depl-item { padding: 10px 14px; display: flex; flex-direction: column; gap: 5px; }
    .depl-agent { display: flex; align-items: center; gap: 8px; mat-icon { color: #e65100; font-size: 18px; width: 18px; height: 18px; } }
    .depl-name { font-size: 13px; font-weight: 600; }
    .depl-zone { font-size: 11px; color: var(--text-secondary); }
    .depl-tech { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #555; mat-icon { font-size: 14px; width: 14px; height: 14px; color: var(--primary-light); } }
    .depl-note { font-size: 11px; color: var(--text-secondary); font-style: italic; display: flex; align-items: center; gap: 4px; }
    .depl-validate-btn { margin-top: 4px; font-size: 12px !important; }

    /* Signalements agents (libre-service) */
    .signal-item { padding: 10px 14px; display: flex; flex-direction: column; gap: 5px; }
    .signal-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .signal-agent { font-size: 13px; font-weight: 600; }
    .signal-time { font-size: 11px; color: var(--text-secondary); white-space: nowrap; }
    .signal-msg { font-size: 12px; color: #555; line-height: 1.4; }
    .signal-photo { width: 100%; max-height: 140px; object-fit: cover; border-radius: 8px; cursor: pointer; margin-top: 2px; }
    .signal-audio { display: block; width: 100%; height: 32px; margin-top: 4px; }
    .signal-actions { display: flex; align-items: center; gap: 4px; margin-top: 2px; }
    .signal-assign-btn { font-size: 12px !important; flex: 1; }

    /* Présence */
    .online-stat-chip {
      display: inline-flex; align-items: center; gap: 5px;
      background: rgba(76,175,80,0.12); color: #2e7d32;
      border-radius: 10px; font-size: 11px; font-weight: 600;
      padding: 2px 8px; margin-left: 8px; vertical-align: middle;
    }
    .tech-panel-online-badge {
      display: inline-flex; align-items: center; gap: 5px;
      background: rgba(76,175,80,0.12); color: #2e7d32;
      border-radius: 8px; font-size: 11px; font-weight: 600;
      padding: 2px 8px; margin-left: 8px;
    }
    .online-pulse-dot {
      width: 7px; height: 7px; border-radius: 50%; background: #4caf50; flex-shrink: 0;
      animation: pulse-dot 2s infinite;
    }
    @keyframes pulse-dot {
      0%   { box-shadow: 0 0 0 0 rgba(76,175,80,0.6); }
      70%  { box-shadow: 0 0 0 4px rgba(76,175,80,0); }
      100% { box-shadow: 0 0 0 0 rgba(76,175,80,0); }
    }

    .delete-menu-item { color: #c62828; mat-icon { color: #c62828; } }
    .reassign-warn-item { color: #e65100; mat-icon { color: #e65100; } }

    .dep-badge {
      display: inline-flex; align-items: center; gap: 3px;
      border-radius: 4px; font-size: 10px; font-weight: 600;
      padding: 2px 6px; margin-top: 4px; white-space: nowrap;
      border: 1px solid transparent; cursor: default;
      mat-icon { font-size: 11px; width: 11px; height: 11px; }
      &.dep-warn   { background: #fff3e0; color: #e65100; border-color: #ffcc80; }
      &.dep-active { background: #e3f2fd; color: #1565c0; border-color: #90caf9; }
      &.dep-done   { background: #e8f5e9; color: #2e7d32; border-color: #a5d6a7; }
      &.dep-refuse { background: #fafafa; color: #9e9e9e; border-color: #e0e0e0; }
    }

    @media (max-width: 900px) { .support-grid { grid-template-columns: 1fr; } .techniciens-panel { order: -1; } }

    .table-container { overflow-x: auto; }

    /* ── Cartes affectations (mobile) ── */
    .support-cards { display: none; }
    @media (max-width: 640px) {
      .table-container table { display: none; }
      .support-cards { display: flex; flex-direction: column; gap: 10px; padding: 2px 2px 8px; }
    }
    .sup-card { background: var(--surface, #fff); border: 1px solid #e8edf2; border-radius: 12px; padding: 12px 14px; }
    .sup-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .sup-date { font-size: 11px; color: var(--text-secondary); font-weight: 600; flex: 1; }
    .sup-menu-btn { margin-left: auto; }
    .sup-agent { display: block; font-weight: 700; font-size: 14px; margin-top: 2px; }
    .sup-line { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
    .sup-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
  `]
})
export class SupportComponent {
  private interventionSvc = inject(InterventionService);
  private userSvc         = inject(UserService);
  private router          = inject(Router);
  auth                    = inject(AuthService);
  private dialog          = inject(MatDialog);
  private snack           = inject(MatSnackBar);
  private confirmSvc      = inject(ConfirmService);
  presenceSvc             = inject(PresenceService);
  private notifSvc        = inject(NotificationService);

  cols = ['priorite', 'agent', 'technicien', 'type', 'date', 'statut', 'actions'];
  search       = signal('');
  filterTech   = signal('');
  filterStatut = signal('');
  sortCol      = signal('date');
  sortDir      = signal<'asc'|'desc'>('desc');

  canValidate = computed(() => ['superadmin', 'admin'].includes(this.auth.role() ?? ''));

  deplacementPending = computed(() => this.interventionSvc.getDeplacementPending());

  pendingSignalements = computed(() =>
    this.notifSvc.getAll()
      .filter(n => n.type === 'signalement_panne' && n.statut !== 'traitée')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  );

  assignerSignalement(n: { id: string; agentId?: string; message: string; photoUrl?: string | null; audioUrl?: string | null }): void {
    this.router.navigate(['/support/assign'], { queryParams: { agentId: n.agentId, description: n.message, photoUrl: n.photoUrl, audioUrl: n.audioUrl, notifId: n.id } });
  }

  async traiterSignalement(n: { id: string }): Promise<void> {
    await this.notifSvc.markTraitee(n.id);
  }

  openPhoto(url: string): void {
    window.open(url, '_blank');
  }

  techniciens = computed(() => {
    const byId = new Map<string, User>();
    for (const u of [...this.userSvc.getByRole('admin'), ...this.userSvc.getByRole('technicien')]) {
      byId.set(u.id, u);
    }
    return [...byId.values()];
  });

  techOnlineCount = computed(() =>
    this.techniciens().filter(t => this.presenceSvc.isOnline(t.id)).length
  );

  sortedTechniciens = computed(() =>
    [...this.techniciens()].sort((a, b) => {
      const ao = this.presenceSvc.isOnline(a.id) ? 0 : 1;
      const bo = this.presenceSvc.isOnline(b.id) ? 0 : 1;
      return ao - bo;
    })
  );

  allInterventions = computed(() => this.interventionSvc.getAllRaw());

  filtered = computed(() => {
    let items = this.allInterventions();
    const q = this.search().toLowerCase().trim();
    if (q) {
      items = items.filter(i =>
        (i.agentNom ?? '').toLowerCase().includes(q) || (i.technicienNom ?? '').toLowerCase().includes(q) ||
        (i.description ?? '').toLowerCase().includes(q)
      );
    }
    const ft = this.filterTech();
    if (ft) items = items.filter(i => i.technicienId === ft);
    const fs = this.filterStatut();
    if (fs) items = items.filter(i => i.statut === fs);
    const col = this.sortCol();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    // Copie avant tri : sort() mute le tableau en place et renvoie la même
    // référence, donc quand aucun filtre n'a créé de copie au-dessus (cas le
    // plus courant), Angular voit un computed() qui "n'a pas changé" et ne
    // propage jamais le nouvel ordre au tableau affiché.
    return [...items].sort((a, b) => {
      let cmp = 0;
      if (col === 'priorite') {
        const pMap: Record<string, number> = { 'Haute': 0, 'Normale': 1, 'Basse': 2 };
        cmp = (pMap[a.priorite ?? 'Normale'] ?? 1) - (pMap[b.priorite ?? 'Normale'] ?? 1);
      } else if (col === 'agent') {
        cmp = (a.agentNom ?? '').localeCompare(b.agentNom ?? '');
      } else if (col === 'technicien') {
        cmp = (a.technicienNom ?? '').localeCompare(b.technicienNom ?? '');
      } else if (col === 'type') {
        cmp = (a.type ?? '').localeCompare(b.type ?? '');
      } else if (col === 'date') {
        cmp = (a.datePlanifiee ?? a.dateDebut).localeCompare(b.datePlanifiee ?? b.dateDebut);
      } else if (col === 'statut') {
        cmp = (a.statut ?? '').localeCompare(b.statut ?? '');
      }
      return cmp * dir;
    });
  });

  toggleSort(col: string): void {
    if (this.sortCol() === col) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortCol.set(col);
      this.sortDir.set('asc');
    }
  }

  sortIcon(col: string): string {
    if (this.sortCol() !== col) return 'unfold_more';
    return this.sortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  countByStatut(s: string): number {
    return this.allInterventions().filter(i => i.statut === s).length;
  }

  getAssignedCount(techId: string): number {
    return this.allInterventions().filter(i => i.technicienId === techId && i.statut === 'Assignée').length;
  }

  getEnCoursCount(techId: string): number {
    return this.allInterventions().filter(i => i.technicienId === techId && i.statut === 'En cours').length;
  }

  sClass(s: string): string {
    return { 'Assignée': 'assignee', 'En cours': 'en-cours', 'Terminée': 'terminee', 'Échec': 'echec' }[s] ?? '';
  }

  prioriteClass(p: string | undefined): string {
    return (p ?? 'Normale').toLowerCase();
  }

  prioriteIcon(p: string | undefined): string {
    return { 'Haute': 'arrow_upward', 'Normale': 'remove', 'Basse': 'arrow_downward' }[p ?? 'Normale'] ?? 'remove';
  }

  techInitials(t: User): string { return `${t.prenom[0]}${t.nom[0]}`.toUpperCase(); }
  techInitialsFromNom(nom: string): string {
    const parts = nom.trim().split(' ');
    return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : nom.slice(0, 2).toUpperCase();
  }

  validateDeplacement(i: Intervention): void {
    const chauffeurs = this.userSvc.getByRole('chauffeur').filter(c => c.actif);
    const ref = this.dialog.open(AffecterChauffeurDialogComponent, {
      data: { agentNom: i.agentNom, chauffeurs },
      width: '460px'
    });
    ref.afterClosed().subscribe(async (chauffeur: User | undefined) => {
      if (!chauffeur) return;
      await this.interventionSvc.validateDeployment(i.id, chauffeur.id, `${chauffeur.prenom} ${chauffeur.nom}`);
      this.snack.open(`Affecté à ${chauffeur.prenom} ${chauffeur.nom} ✓`, 'OK', { duration: 3000, panelClass: 'success-snack' });
    });
  }

  agentDayInterventions(agentId: string, excludeId: string): Intervention[] {
    return this.interventionSvc.getAgentSameDayInterventions(agentId, excludeId);
  }

  agentDayTooltip(agentId: string, excludeId: string): string {
    return this.agentDayInterventions(agentId, excludeId)
      .map(h => {
        const time = new Date(h.dateDebut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        return `${time} — ${h.type} (${h.technicienNom}) · ${h.statut}`;
      })
      .join('\n');
  }

  hasActiveDeplacement(i: Intervention): boolean {
    return !!(i.deplacementRequis && !i.deplacementRefuse &&
      (i.statut === 'Assignée' || i.statut === 'En cours'));
  }

  async reassignWithWarning(i: Intervention): Promise<void> {
    const detail = i.chauffeurId
      ? `Un chauffeur (${i.chauffeurNom}) est déjà en route vers ce technicien.`
      : `Une demande de déplacement est en cours pour cette intervention.`;
    if (await this.confirmSvc.ask(`⚠️ Déplacement actif !\n${detail}\n\nRéaffecter quand même ?`, 'Attention', 'Réaffecter')) {
      this.router.navigate(['/support/assign'], { queryParams: { id: i.id } });
    }
  }

  async annuler(i: Intervention): Promise<void> {
    if (await this.confirmSvc.danger(`Supprimer définitivement cette intervention pour ${i.agentNom} ?`)) {
      const ok = await this.interventionSvc.delete(i.id);
      if (ok) {
        this.snack.open('Intervention supprimée', 'OK', { duration: 2000, panelClass: 'info-snack' });
      } else {
        this.snack.open('Erreur lors de la suppression', 'OK', { duration: 3000, panelClass: 'error-snack' });
      }
    }
  }
}
