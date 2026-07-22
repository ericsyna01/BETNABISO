import { Component, computed, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AgentService } from '../../../core/services/agent.service';
import { InterventionService } from '../../../core/services/intervention.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { HeartbeatService, AgentMachineStatus, formatMinutesAgo } from '../../../core/services/heartbeat.service';
import { SseService } from '../../../core/services/sse.service';
import { Subscription } from 'rxjs';
import { Agent } from '../../../core/models/agent.model';
import { Intervention } from '../../../core/models/intervention.model';

@Component({
  selector: 'app-agent-notif-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon style="color:#e65100;vertical-align:middle;margin-right:6px">report_problem</mat-icon>
      Signaler une modification
    </h2>
    <mat-dialog-content>
      <p class="agent-ref">Agent : <strong>{{ data.agentNom }}</strong></p>
      <mat-form-field appearance="outline" style="width:100%;margin-top:4px">
        <mat-label>Informations à modifier *</mat-label>
        <textarea matInput [(ngModel)]="message" rows="5"
          placeholder="Ex : L'ID AnyDesk caisse a changé, le nouveau est 987654321..."></textarea>
        <mat-hint>Décrivez précisément ce qui doit être mis à jour</mat-hint>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>Annuler</button>
      <button mat-raised-button color="warn" [mat-dialog-close]="message.trim()" [disabled]="!message.trim()">
        <mat-icon>send</mat-icon> Envoyer
      </button>
    </mat-dialog-actions>
  `,
  styles: [`:host { display:block; } .agent-ref { font-size:13px; color:#555; margin-bottom:8px; }`]
})
export class AgentNotifDialogComponent {
  data = inject<{ agentNom: string }>(MAT_DIALOG_DATA);
  message = '';
}

@Component({
  selector: 'app-agent-detail',
  standalone: true,
  imports: [
    RouterLink, DatePipe, FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatTabsModule, MatDividerModule, MatSnackBarModule, MatTableModule, MatTooltipModule,
    MatDialogModule, MatFormFieldModule, MatInputModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div class="header-with-back">
          <a mat-icon-button routerLink="/agents"><mat-icon>arrow_back</mat-icon></a>
          <div>
            <h1>{{ agent()?.nomAgent }}</h1>
            <div style="display:flex;gap:8px;align-items:center;margin-top:4px">
              <span class="status-chip {{ statutClass() }}">{{ agent()?.statut }}</span>
              <span style="color:var(--text-secondary);font-size:13px">{{ agent()?.zone }}</span>
            </div>
          </div>
        </div>
        <div class="page-header-actions">
          @if (!auth.isAdmin() && agent()) {
            <button mat-stroked-button color="warn" (click)="signalerModification()">
              <mat-icon>report_problem</mat-icon> Signaler une modification
            </button>
          }
          @if ((auth.isAdmin() || auth.isSupport() || auth.isTechnicien()) && agent()?.publicToken) {
            <button mat-stroked-button (click)="copySelfServiceLink()" matTooltip="Lien à donner à l'agent pour signaler une panne sans passer par le support">
              <mat-icon>link</mat-icon> Lien de signalement
            </button>
          }
          @if (auth.isAdmin() && agent()) {
            <a mat-stroked-button [routerLink]="['/interventions/new']" [queryParams]="{agentId: agent()?.id}">
              <mat-icon>add</mat-icon> Nouvelle intervention
            </a>
            <a mat-raised-button color="primary" [routerLink]="['/agents', agent()?.id, 'edit']">
              <mat-icon>edit</mat-icon> Modifier
            </a>
          }
        </div>
      </div>

      @if (!agent()) {
        <div class="empty-state"><mat-icon>person_off</mat-icon><h3>Agent introuvable</h3></div>
      } @else {
        <mat-tab-group>
          <!-- Informations -->
          <mat-tab label="Informations">
            <div class="tab-content">
              <div class="info-grid">
                <!-- Identification -->
                <mat-card>
                  <mat-card-header><mat-card-title><mat-icon>badge</mat-icon> Identification</mat-card-title></mat-card-header>
                  <mat-card-content>
                    <div class="info-rows">
                      <div class="info-row"><span class="info-label">Nom Agent</span><span class="info-val">{{ agent()?.nomAgent }}</span></div>
                      <div class="info-row"><span class="info-label">Responsable</span><span class="info-val">{{ agent()?.nomResponsable }}</span></div>
                      <div class="info-row">
                        <span class="info-label">Identifiant</span>
                        <div class="copy-row">
                          <code>{{ agent()?.identifiant }}</code>
                          @if (agent()?.identifiant) {
                            <button mat-icon-button (click)="copy(agent()!.identifiant)" matTooltip="Copier">
                              <mat-icon style="font-size:16px">content_copy</mat-icon>
                            </button>
                          }
                        </div>
                      </div>
                      <div class="info-row"><span class="info-label">Téléphone</span><span class="info-val">{{ agent()?.numero }}</span></div>
                      <div class="info-row"><span class="info-label">Zone</span><span class="info-val">{{ agent()?.zone }}</span></div>
                      <div class="info-row"><span class="info-label">Feuillet</span><span class="info-val">{{ agent()?.feuillet || '—' }}</span></div>
                    </div>
                  </mat-card-content>
                </mat-card>

                <!-- Accès à distance -->
                <mat-card>
                  <mat-card-header><mat-card-title><mat-icon>computer</mat-icon> Accès à distance</mat-card-title></mat-card-header>
                  <mat-card-content>
                    <div class="info-rows">
                      <div class="info-row">
                        <span class="info-label">AnyDesk Caisse</span>
                        <div class="copy-row">
                          <code class="anydesk-code">{{ agent()?.anydesk || '—' }}</code>
                          @if (agent()?.anydesk) {
                            <button mat-icon-button (click)="copy(agent()!.anydesk)" matTooltip="Copier">
                              <mat-icon style="font-size:16px">content_copy</mat-icon>
                            </button>
                          }
                        </div>
                      </div>
                      <div class="info-row">
                        <span class="info-label">AnyDesk Serveur</span>
                        <div class="copy-row">
                          <code class="anydesk-code">{{ agent()?.anydesk_serveur || '—' }}</code>
                          @if (agent()?.anydesk_serveur) {
                            <button mat-icon-button (click)="copy(agent()!.anydesk_serveur!)" matTooltip="Copier">
                              <mat-icon style="font-size:16px">content_copy</mat-icon>
                            </button>
                          }
                        </div>
                      </div>
                      <div class="info-row">
                        <span class="info-label">TeamViewer Caisse</span>
                        <div class="copy-row">
                          <code>{{ agent()?.teamCaisse || '—' }}</code>
                          @if (agent()?.teamCaisse) {
                            <button mat-icon-button (click)="copy(agent()!.teamCaisse!)" matTooltip="Copier">
                              <mat-icon style="font-size:16px">content_copy</mat-icon>
                            </button>
                          }
                        </div>
                      </div>
                      <div class="info-row">
                        <span class="info-label">TeamViewer Serveur</span>
                        <div class="copy-row">
                          <code>{{ agent()?.teamServeur || '—' }}</code>
                          @if (agent()?.teamServeur) {
                            <button mat-icon-button (click)="copy(agent()!.teamServeur!)" matTooltip="Copier">
                              <mat-icon style="font-size:16px">content_copy</mat-icon>
                            </button>
                          }
                        </div>
                      </div>
                      <div class="info-row">
                        <span class="info-label">Redéploiement</span>
                        <span class="info-val">
                          @if (agent()?.redeploieVersNom) {
                            → {{ agent()?.redeploieVersNom }}
                          } @else if (agent()?.redeploiement) {
                            {{ agent()?.redeploiement }}
                          } @else {
                            —
                          }
                        </span>
                      </div>
                    </div>
                  </mat-card-content>
                </mat-card>

                <!-- État des machines -->
                <mat-card class="machine-card">
                  <mat-card-header>
                    <mat-card-title>
                      <mat-icon>monitor_heart</mat-icon> État des machines
                      <span class="mc-live-dot"></span>
                    </mat-card-title>
                    <button mat-icon-button (click)="refreshStatus()" [disabled]="statusLoading()"
                            matTooltip="Actualiser" style="margin-left:auto">
                      <mat-icon [class.spin]="statusLoading()">refresh</mat-icon>
                    </button>
                  </mat-card-header>
                  <mat-card-content>
                    <div class="machine-grid">
                      <!-- Caisse -->
                      <div class="machine-box"
                           [class.m-on]="machineStatus()?.caisse?.online"
                           [class.m-off]="machineStatus()?.caisse && !machineStatus()?.caisse?.online"
                           [class.m-unk]="!machineStatus()?.caisse">
                        <div class="mb-top">
                          <div class="mb-icon-wrap">
                            <mat-icon>point_of_sale</mat-icon>
                            <span class="mb-indicator"></span>
                          </div>
                        </div>
                        <div class="mb-name">Caisse</div>
                        <div class="mb-status-badge">
                          @if (machineStatus()?.caisse) {
                            {{ machineStatus()!.caisse!.online ? 'En ligne' : 'Hors ligne' }}
                          } @else { Inconnu }
                        </div>
                        <div class="mb-detail">
                          @if (machineStatus()?.caisse?.online) {
                            <mat-icon>wifi</mat-icon><span>{{ machineStatus()!.caisse!.ip }}</span>
                          } @else if (machineStatus()?.caisse) {
                            <mat-icon>schedule</mat-icon><span>Il y a {{ formatMinutesAgo(machineStatus()!.caisse!.minutesAgo) }}</span>
                          } @else {
                            <mat-icon>help_outline</mat-icon><span>Aucun ping reçu</span>
                          }
                        </div>
                        @if (machineStatus()?.caisse?.firstSeen) {
                          <div class="mb-first-seen">Surveillé depuis le {{ machineStatus()!.caisse!.firstSeen | date:'dd/MM/yyyy HH:mm' }}</div>
                        }
                        @if (machineStatus()?.caisse?.duplicateSuspected) {
                          <div class="mb-dup-warn"
                               matTooltip="Cet identifiant d'agent semble utilisé sur plusieurs machines (IP instable)">
                            <mat-icon>warning</mat-icon><span>Doublon suspecté</span>
                          </div>
                        }
                      </div>
                      <!-- Serveur -->
                      <div class="machine-box"
                           [class.m-on]="machineStatus()?.serveur?.online"
                           [class.m-off]="machineStatus()?.serveur && !machineStatus()?.serveur?.online"
                           [class.m-unk]="!machineStatus()?.serveur">
                        <div class="mb-top">
                          <div class="mb-icon-wrap">
                            <mat-icon>dns</mat-icon>
                            <span class="mb-indicator"></span>
                          </div>
                        </div>
                        <div class="mb-name">Serveur</div>
                        <div class="mb-status-badge">
                          @if (machineStatus()?.serveur) {
                            {{ machineStatus()!.serveur!.online ? 'En ligne' : 'Hors ligne' }}
                          } @else { Inconnu }
                        </div>
                        <div class="mb-detail">
                          @if (machineStatus()?.serveur?.online) {
                            <mat-icon>wifi</mat-icon><span>{{ machineStatus()!.serveur!.ip }}</span>
                          } @else if (machineStatus()?.serveur) {
                            <mat-icon>schedule</mat-icon><span>Il y a {{ formatMinutesAgo(machineStatus()!.serveur!.minutesAgo) }}</span>
                          } @else {
                            <mat-icon>help_outline</mat-icon><span>Aucun ping reçu</span>
                          }
                        </div>
                        @if (machineStatus()?.serveur?.firstSeen) {
                          <div class="mb-first-seen">Surveillé depuis le {{ machineStatus()!.serveur!.firstSeen | date:'dd/MM/yyyy HH:mm' }}</div>
                        }
                        @if (machineStatus()?.serveur?.duplicateSuspected) {
                          <div class="mb-dup-warn"
                               matTooltip="Cet identifiant d'agent semble utilisé sur plusieurs machines (IP instable)">
                            <mat-icon>warning</mat-icon><span>Doublon suspecté</span>
                          </div>
                        }
                      </div>
                    </div>
                    <div class="mc-footer">
                      <mat-icon>autorenew</mat-icon><span>60s</span>
                      <span class="mc-sep">·</span>
                      <mat-icon>timer_off</mat-icon><span>Seuil 60s</span>
                    </div>
                  </mat-card-content>
                </mat-card>

                <!-- Statut & Dates -->
                <mat-card>
                  <mat-card-header><mat-card-title><mat-icon>info</mat-icon> Statut & Dates</mat-card-title></mat-card-header>
                  <mat-card-content>
                    <div class="info-rows">
                      <div class="info-row"><span class="info-label">Statut</span><span class="status-chip {{ statutClass() }}">{{ agent()?.statut }}</span></div>
                      <div class="info-row"><span class="info-label">Dernière intervention</span><span class="info-val">{{ agent()?.date | date:'dd/MM/yyyy' }}</span></div>
                      <div class="info-row"><span class="info-label">Créé le</span><span class="info-val">{{ agent()?.createdAt | date:'dd/MM/yyyy' }}</span></div>
                      <div class="info-row"><span class="info-label">Mis à jour</span><span class="info-val">{{ agent()?.updatedAt | date:'dd/MM/yyyy HH:mm' }}</span></div>
                      <div class="info-row"><span class="info-label">Nb. interventions</span><span class="info-val"><strong>{{ interventions().length }}</strong></span></div>
                    </div>
                  </mat-card-content>
                </mat-card>
              </div>
            </div>
          </mat-tab>

          <!-- Historique interventions -->
          <mat-tab [label]="'Interventions (' + interventions().length + ')'">
            <div class="tab-content">
              @if (interventions().length === 0) {
                <div class="empty-state">
                  <mat-icon>assignment_turned_in</mat-icon>
                  <h3>Aucune intervention</h3>
                  <p>Cet agent n'a pas encore d'intervention enregistrée</p>
                  <a mat-raised-button color="primary" routerLink="/interventions/new" style="margin-top:16px">
                    <mat-icon>add</mat-icon> Créer une intervention
                  </a>
                </div>
              } @else {
                <!-- Statistiques rapides -->
                <div class="history-stats">
                  <div class="hstat">
                    <div class="hstat-value">{{ interventions().length }}</div>
                    <div class="hstat-label">Total</div>
                  </div>
                  <div class="hstat">
                    <div class="hstat-value">{{ iStats().terminees }}</div>
                    <div class="hstat-label">Terminées</div>
                  </div>
                  <div class="hstat">
                    <div class="hstat-value">{{ iStats().echecs }}</div>
                    <div class="hstat-label">Échecs</div>
                  </div>
                  <div class="hstat">
                    <div class="hstat-value">{{ iStats().avgDuree ? iStats().avgDuree + ' min' : '—' }}</div>
                    <div class="hstat-label">Durée moy.</div>
                  </div>
                </div>

                <div class="table-container">
                  <table mat-table [dataSource]="sortedInterventions()">
                    <ng-container matColumnDef="date">
                      <th mat-header-cell *matHeaderCellDef>Date</th>
                      <td mat-cell *matCellDef="let i">{{ i.dateDebut | date:'dd/MM/yyyy HH:mm' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="type">
                      <th mat-header-cell *matHeaderCellDef>Type</th>
                      <td mat-cell *matCellDef="let i">{{ i.type }}</td>
                    </ng-container>
                    <ng-container matColumnDef="technicien">
                      <th mat-header-cell *matHeaderCellDef>Technicien</th>
                      <td mat-cell *matCellDef="let i">{{ i.technicienNom }}</td>
                    </ng-container>
                    <ng-container matColumnDef="duree">
                      <th mat-header-cell *matHeaderCellDef>Durée</th>
                      <td mat-cell *matCellDef="let i">{{ i.duree ? i.duree + ' min' : '—' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="statut">
                      <th mat-header-cell *matHeaderCellDef>Statut</th>
                      <td mat-cell *matCellDef="let i">
                        <span class="status-chip {{ iStatutClass(i.statut) }}">{{ i.statut }}</span>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="description">
                      <th mat-header-cell *matHeaderCellDef>Description</th>
                      <td mat-cell *matCellDef="let i" class="desc-cell" [matTooltip]="i.description" matTooltipClass="desc-tooltip">{{ i.description }}</td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="iCols"></tr>
                    <tr mat-row *matRowDef="let row; columns: iCols;"></tr>
                  </table>

                  <!-- Cartes (mobile) -->
                  <div class="interv-cards">
                    @for (i of sortedInterventions(); track i.id) {
                      <div class="iv-card">
                        <div class="iv-top">
                          <span class="iv-date">{{ i.dateDebut | date:'dd/MM/yy HH:mm' }}</span>
                          <span class="status-chip {{ iStatutClass(i.statut) }}">{{ i.statut }}</span>
                        </div>
                        <div class="iv-type">{{ i.type }}</div>
                        @if (i.description) {
                          <div class="iv-desc">{{ i.description }}</div>
                        }
                        <div class="iv-line">
                          <span>{{ i.technicienNom }}</span>
                          <span>{{ i.duree ? i.duree + ' min' : '—' }}</span>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          </mat-tab>
        </mat-tab-group>
      }
    </div>
  `,
  styles: [`
    .header-with-back { display: flex; align-items: center; gap: 8px; }
    .tab-content { padding: 20px 0; }
    .info-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    mat-card-header mat-card-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; mat-icon { font-size: 18px; color: var(--primary-light); } }
    mat-card-content { padding: 8px 16px 16px !important; }
    .info-rows { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
    .info-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f0f0; }
    .info-label { font-size: 12px; color: var(--text-secondary); font-weight: 500; }
    .info-val { font-size: 13px; color: var(--text-primary); font-weight: 500; text-align: right; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
    .anydesk-code { background: #e8f0fe; color: #1a3a5c; font-weight: 700; font-size: 14px; padding: 3px 8px; }
    .copy-row { display: flex; align-items: center; gap: 4px; }
    .desc-cell { max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .iCols { display: none; }

    /* ── Machines ── */
    .machine-card mat-card-header {
      display:flex; align-items:center;
      mat-card-title { display:flex; align-items:center; gap:6px; }
    }
    .mc-live-dot {
      width:7px; height:7px; border-radius:50%; background:#43a047;
      margin-left:4px; animation:live-pulse 2.4s infinite;
    }
    @keyframes live-pulse {
      0%,100% { opacity:1; transform:scale(1); }
      50%      { opacity:.3; transform:scale(.7); }
    }

    .machine-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:8px; }

    .machine-box {
      border-radius:10px; padding:16px 10px 14px; text-align:center;
      border:1.5px solid #e8edf2; background:#f8fafd;
      transition:border-color .25s, background .25s;
      position:relative; overflow:hidden;
      &::after {
        content:''; position:absolute; top:0; left:0; right:0; height:3px;
        background:#e0e0e0; border-radius:10px 10px 0 0; transition:background .25s;
      }
      &.m-on  { border-color:#c8e6c9; background:#f1fbf2; &::after { background:#43a047; } }
      &.m-off { border-color:#ffcdd2; background:#fff7f7; &::after { background:#e53935; } }
      &.m-unk { border-color:#e8edf2; background:#f8fafd; &::after { background:#cfd8dc; } }
    }

    .mb-top { display:flex; justify-content:center; margin-bottom:10px; }

    .mb-icon-wrap {
      position:relative; width:48px; height:48px;
      display:flex; align-items:center; justify-content:center;
      border-radius:12px; background:white;
      box-shadow:0 1px 6px rgba(0,0,0,.08);
      mat-icon { font-size:24px; width:24px; height:24px; color:#90a4ae; }
      .m-on  & mat-icon { color:#2e7d32; }
      .m-off & mat-icon { color:#c62828; }
    }

    .mb-indicator {
      position:absolute; bottom:-2px; right:-2px;
      width:13px; height:13px; border-radius:50%;
      background:#bdbdbd; border:2px solid white;
      .m-on  & { background:#43a047; animation:pulse-ring 2s infinite; }
      .m-off & { background:#e53935; }
    }
    @keyframes pulse-ring {
      0%   { box-shadow:0 0 0 0 rgba(67,160,71,.5); }
      70%  { box-shadow:0 0 0 5px rgba(67,160,71,0); }
      100% { box-shadow:0 0 0 0 rgba(67,160,71,0); }
    }

    .mb-name { font-size:13px; font-weight:700; color:#1a3a5c; margin-bottom:5px; }

    .mb-status-badge {
      display:inline-block; font-size:10px; font-weight:700; letter-spacing:.5px;
      padding:2px 9px; border-radius:20px; margin-bottom:11px; text-transform:uppercase;
      .m-on  & { background:#e8f5e9; color:#2e7d32; }
      .m-off & { background:#fce4ec; color:#c62828; }
      .m-unk & { background:#eeeeee; color:#9e9e9e; }
    }

    .mb-detail {
      display:flex; align-items:center; justify-content:center; gap:3px;
      font-size:11px; color:#9e9e9e;
      mat-icon { font-size:12px; width:12px; height:12px; }
    }

    .mb-dup-warn {
      display:flex; align-items:center; justify-content:center; gap:3px;
      font-size:10px; font-weight:700; color:#c07f00; margin-top:6px;
      mat-icon { font-size:13px; width:13px; height:13px; }
    }

    .mb-first-seen { font-size:10px; color:#bdbdbd; margin-top:4px; }

    .mc-footer {
      display:flex; align-items:center; justify-content:center; gap:5px;
      font-size:10px; color:#bdbdbd; margin-top:12px;
      padding-top:8px; border-top:1px solid #f5f5f5;
      mat-icon { font-size:11px; width:11px; height:11px; }
      .mc-sep { margin:0 2px; }
    }

    @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
    .spin { animation:spin .8s linear infinite; }
    .history-stats {
      display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px;
      .hstat {
        flex: 1; min-width: 100px; background: #f8faff; border: 1px solid #e2e8f0;
        border-radius: 10px; padding: 14px 16px; text-align: center;
      }
      .hstat-value { font-size: 24px; font-weight: 800; color: var(--primary); }
      .hstat-label { font-size: 11px; color: var(--text-secondary); margin-top: 2px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
    }

    /* ── Cartes interventions (mobile) ── */
    .interv-cards { display: none; }
    @media (max-width: 640px) {
      .table-container table { display: none; }
      .interv-cards { display: flex; flex-direction: column; gap: 10px; }
      .page-container { padding: 12px; }
      .info-grid { grid-template-columns: 1fr; }
      .history-stats { gap: 8px; }
    }
    .iv-card {
      background: white; border: 1px solid #e8edf2; border-radius: 12px; padding: 12px 14px;
    }
    .iv-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
    .iv-date { font-size: 11px; color: var(--text-secondary); font-weight: 600; }
    .iv-type { font-weight: 600; font-size: 13px; color: var(--primary); }
    .iv-desc { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }
    .iv-line { display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--text-secondary); margin-top: 8px; padding-top: 8px; border-top: 1px solid #f0f0f0; }
  `]
})
export class AgentDetailComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private agentSvc = inject(AgentService);
  private interventionSvc = inject(InterventionService);
  private notifSvc = inject(NotificationService);
  private heartbeatSvc = inject(HeartbeatService);
  private sseSvc = inject(SseService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  formatMinutesAgo = formatMinutesAgo;

  agent = signal<Agent | undefined>(undefined);
  interventions = signal<Intervention[]>([]);
  machineStatus = signal<AgentMachineStatus | null>(null);
  statusLoading = signal(false);
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private sseSub: Subscription | null = null;
  iCols = ['date', 'type', 'technicien', 'duree', 'statut', 'description'];

  sortedInterventions = computed(() =>
    [...this.interventions()].sort((a, b) => b.dateDebut.localeCompare(a.dateDebut))
  );

  iStats = computed(() => {
    const list = this.interventions();
    const terminees = list.filter(i => i.statut === 'Terminée').length;
    const echecs    = list.filter(i => i.statut === 'Échec').length;
    const withDuree = list.filter(i => i.duree && i.duree > 0);
    const avgDuree  = withDuree.length
      ? Math.round(withDuree.reduce((s, i) => s + (i.duree ?? 0), 0) / withDuree.length)
      : 0;
    return { terminees, echecs, avgDuree };
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.agent.set(this.agentSvc.getById(id));
    this.interventions.set(this.interventionSvc.getByAgent(id));
    this.loadStatus(id);
    this.pollTimer = setInterval(() => this.loadStatus(id), 60_000);
    this.sseSub = this.sseSvc.dataUpdate$.subscribe(type => {
      if (type === 'machine_status') this.loadStatus(id);
    });
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.sseSub?.unsubscribe();
  }

  private async loadStatus(id: string): Promise<void> {
    try {
      const status = await this.heartbeatSvc.getStatus(id);
      this.machineStatus.set(status);
    } catch { /* silencieux si l'agent n'a jamais envoyé de ping */ }
  }

  async refreshStatus(): Promise<void> {
    this.statusLoading.set(true);
    const id = this.route.snapshot.paramMap.get('id')!;
    await this.loadStatus(id);
    this.statusLoading.set(false);
  }

  statutClass(): string {
    const map: Record<string, string> = {
      'Actif': 'actif', 'Inactif': 'inactif', 'Redéployé': 'redeploye'
    };
    return map[this.agent()?.statut ?? ''] ?? '';
  }

  iStatutClass(s: string): string {
    return s === 'Terminée' ? 'terminee' : s === 'En cours' ? 'en-cours' : 'echec';
  }

  signalerModification(): void {
    const a = this.agent();
    if (!a) return;
    const ref = this.dialog.open(AgentNotifDialogComponent, {
      data: { agentNom: a.nomAgent },
      width: 'min(460px, 92vw)'
    });
    ref.afterClosed().subscribe((message: string | undefined) => {
      if (!message) return;
      const user = this.auth.currentUser();
      if (!user) return;
      this.notifSvc.send({
        type: 'agent_modification',
        agentId: a.id,
        agentNom: a.nomAgent,
        requestedById: user.id,
        requestedByNom: `${user.prenom} ${user.nom}`,
        requestedByRole: user.role,
        message
      });
      this.snack.open('Notification envoyée aux administrateurs ✓', 'OK', { duration: 3000, panelClass: 'success-snack' });
    });
  }

  copy(text: string): void {
    navigator.clipboard.writeText(text);
    this.snack.open(`Copié : ${text}`, 'OK', { duration: 2000, panelClass: 'info-snack' });
  }

  copySelfServiceLink(): void {
    const token = this.agent()?.publicToken;
    if (!token) return;
    const url = `${window.location.origin}/#/signaler/${token}`;
    navigator.clipboard.writeText(url);
    this.snack.open('Lien de signalement copié ✓', 'OK', { duration: 2500, panelClass: 'success-snack' });
  }
}
