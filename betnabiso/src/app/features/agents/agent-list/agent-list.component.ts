import { Component, computed, effect, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { AgentService } from '../../../core/services/agent.service';
import { AuthService } from '../../../core/services/auth.service';
import { ZoneService } from '../../../core/services/zone.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { HeartbeatService, MachineSummary, AgentMachineStatus, formatMinutesAgo, isLongOnline, formatOnlineSince, isLongOffline } from '../../../core/services/heartbeat.service';
import { SseService } from '../../../core/services/sse.service';
import { Subscription } from 'rxjs';
import { Agent, AgentStatut } from '../../../core/models/agent.model';
import { ExportService } from '../../../core/services/export.service';

@Component({
  selector: 'app-redeploiement-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatAutocompleteModule],
  template: `
    <h2 mat-dialog-title>Redéployer vers un autre agent</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" style="width:100%;margin-top:12px">
        <mat-label>Agent cible *</mat-label>
        <mat-icon matPrefix>search</mat-icon>
        <input matInput [matAutocomplete]="auto" [(ngModel)]="searchText"
               (ngModelChange)="onSearch($event)" placeholder="Taper pour rechercher...">
        <mat-autocomplete #auto="matAutocomplete" [displayWith]="display"
                          (optionSelected)="onSelect($event)">
          @for (a of filtered; track a.id) {
            <mat-option [value]="a">
              <span class="opt-name">{{ a.nomAgent }}</span>
              <span class="opt-zone">{{ a.zone }}</span>
            </mat-option>
          }
          @if (filtered.length === 0) {
            <mat-option disabled>Aucun résultat</mat-option>
          }
        </mat-autocomplete>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>Annuler</button>
      <button mat-raised-button color="primary" [mat-dialog-close]="selectedAgent" [disabled]="!selectedAgent">
        Confirmer
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host { display: block; min-width: 420px; }
    .opt-name { font-weight: 500; display: block; }
    .opt-zone { font-size: 11px; color: #888; }
  `]
})
export class RedeploiementDialogComponent {
  data         = inject<{ agents: Agent[] }>(MAT_DIALOG_DATA);
  searchText   = '';
  selectedAgent: Agent | null = null;
  filtered     = [...this.data.agents];

  onSearch(val: string): void {
    const q = (typeof val === 'string' ? val : '').toLowerCase();
    this.filtered = this.data.agents.filter(a =>
      a.nomAgent.toLowerCase().includes(q) || a.zone.toLowerCase().includes(q)
    );
    if (this.selectedAgent && this.selectedAgent.nomAgent !== val) {
      this.selectedAgent = null;
    }
  }

  onSelect(e: MatAutocompleteSelectedEvent): void {
    this.selectedAgent = e.option.value as Agent;
  }

  display = (a: Agent | string): string =>
    a && typeof a === 'object' ? `${a.nomAgent} — ${a.zone}` : '';
}

@Component({
  selector: 'app-agent-list',
  standalone: true,
  imports: [
    RouterLink, FormsModule, DatePipe,
    MatTableModule, MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatMenuModule, MatSnackBarModule,
    MatTooltipModule, MatChipsModule, MatDividerModule, MatDialogModule, MatAutocompleteModule,
    MatPaginatorModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>Agents</h1>
        @if (auth.isAdmin()) {
          <div class="page-header-actions">
            <button mat-stroked-button (click)="exportCsv()">
              <mat-icon>download</mat-icon> Exporter CSV
            </button>
            <a mat-raised-button color="primary" routerLink="/agents/new">
              <mat-icon>person_add</mat-icon> Ajouter un agent
            </a>
          </div>
        }
      </div>

      <!-- Surveillance machines -->
      @if (summary()) {
        <div class="monitor-bar">
          <div class="monitor-bar-left">
            <mat-icon class="monitor-icon">monitor_heart</mat-icon>
            <span class="monitor-title">Surveillance machines</span>
            <span class="monitor-live-dot"></span>
          </div>
          <div class="monitor-stats">
            <div class="mstat mstat-on mstat-clickable" [class.mstat-active]="filterMachine() === 'caisse-on'"
                 (click)="toggleMachineFilter('caisse-on')" matTooltip="Filtrer : caisses en ligne">
              <span class="mstat-dot on"></span>
              <span class="mstat-num">{{ summary()!.caisseOnline }}</span>
              <span class="mstat-label">caisse{{ summary()!.caisseOnline > 1 ? 's' : '' }} en ligne</span>
            </div>
            <div class="mstat-sep"></div>
            <div class="mstat mstat-on mstat-clickable" [class.mstat-active]="filterMachine() === 'serveur-on'"
                 (click)="toggleMachineFilter('serveur-on')" matTooltip="Filtrer : serveurs en ligne">
              <span class="mstat-dot on"></span>
              <span class="mstat-num">{{ summary()!.serveurOnline }}</span>
              <span class="mstat-label">serveur{{ summary()!.serveurOnline > 1 ? 's' : '' }} en ligne</span>
            </div>
            <div class="mstat-sep"></div>
            <div class="mstat mstat-neutral mstat-clickable" [class.mstat-active]="filterMachine() === 'monitored'"
                 (click)="toggleMachineFilter('monitored')" matTooltip="Filtrer : agents ayant déjà envoyé au moins un ping">
              <mat-icon style="font-size:14px;width:14px;height:14px;color:#78909c">router</mat-icon>
              <span class="mstat-num">{{ summary()!.totalMonitored }}</span>
              <span class="mstat-label">agent{{ summary()!.totalMonitored > 1 ? 's' : '' }} surveillé{{ summary()!.totalMonitored > 1 ? 's' : '' }}</span>
            </div>
            @if (summary()!.duplicatesSuspected > 0) {
              <div class="mstat-sep"></div>
              <div class="mstat mstat-warn mstat-clickable" [class.mstat-active]="filterMachine() === 'duplicate'"
                   (click)="toggleMachineFilter('duplicate')"
                   matTooltip="Filtrer : un même identifiant d'agent semble utilisé sur plusieurs machines (IP instable)">
                <mat-icon style="font-size:14px;width:14px;height:14px;color:#e6a817">warning</mat-icon>
                <span class="mstat-num" style="color:#c07f00">{{ summary()!.duplicatesSuspected }}</span>
                <span class="mstat-label">doublon{{ summary()!.duplicatesSuspected > 1 ? 's' : '' }} suspecté{{ summary()!.duplicatesSuspected > 1 ? 's' : '' }}</span>
              </div>
            }
            @if (summary()!.longOnlineAgents > 0) {
              <div class="mstat-sep"></div>
              <div class="mstat mstat-warn mstat-clickable" [class.mstat-active]="filterMachine() === 'long-online'"
                   (click)="toggleMachineFilter('long-online')"
                   matTooltip="Filtrer : agents dont une machine est en ligne en continu depuis plus de 24h">
                <mat-icon style="font-size:14px;width:14px;height:14px;color:#e6a817">schedule</mat-icon>
                <span class="mstat-num" style="color:#c07f00">{{ summary()!.longOnlineAgents }}</span>
                <span class="mstat-label">agent{{ summary()!.longOnlineAgents > 1 ? 's' : '' }} en ligne +24h</span>
              </div>
            }
            @if (longOfflineCount() > 0) {
              <div class="mstat-sep"></div>
              <div class="mstat mstat-warn mstat-clickable" [class.mstat-active]="filterMachine() === 'long-offline'"
                   (click)="toggleMachineFilter('long-offline')"
                   matTooltip="Filtrer : agents dont une machine n'a envoyé aucun ping depuis plus de 24h">
                <mat-icon style="font-size:14px;width:14px;height:14px;color:#c62828">error_outline</mat-icon>
                <span class="mstat-num" style="color:#c62828">{{ longOfflineCount() }}</span>
                <span class="mstat-label">agent{{ longOfflineCount() > 1 ? 's' : '' }} hors ligne +24h</span>
              </div>
            }
          </div>
          <button mat-icon-button (click)="refreshSummary()" [disabled]="summaryLoading()"
                  matTooltip="Actualiser" class="monitor-refresh">
            <mat-icon [class.spin]="summaryLoading()">refresh</mat-icon>
          </button>
        </div>
      }

      <!-- Filtres -->
      <div class="search-bar">
        <mat-form-field appearance="outline">
          <mat-label>Rechercher</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)"
                 placeholder="Nom, identifiant, AnyDesk...">
          @if (searchQuery()) {
            <button matSuffix mat-icon-button (click)="searchQuery.set('')">
              <mat-icon>close</mat-icon>
            </button>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" style="width:180px">
          <mat-label>Zone</mat-label>
          <mat-select [ngModel]="filterZone()" (ngModelChange)="filterZone.set($event)">
            <mat-option value="">Toutes les zones</mat-option>
            @for (z of zones(); track z) {
              <mat-option [value]="z">{{ z }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" style="width:160px">
          <mat-label>Statut</mat-label>
          <mat-select [ngModel]="filterStatut()" (ngModelChange)="filterStatut.set($event)">
            <mat-option value="">Tous</mat-option>
            <mat-option value="Actif">Actif</mat-option>
            <mat-option value="Inactif">Inactif</mat-option>
            <mat-option value="Redéployé">Redéployé</mat-option>
            <mat-option value="À redéployer">À redéployer</mat-option>
          </mat-select>
        </mat-form-field>

        @if (filterMachine()) {
          <span class="machine-filter-chip" [class.machine-filter-chip-warn]="filterMachine() === 'duplicate'">
            {{ machineFilterLabel() }}
            <mat-icon (click)="toggleMachineFilter(filterMachine())">close</mat-icon>
          </span>
        }

        @if (hasFilter()) {
          <button mat-stroked-button (click)="resetFilters()" class="reset-btn">
            <mat-icon>filter_alt_off</mat-icon> Réinitialiser
          </button>
        }
        <span class="result-count">{{ filtered().length }} résultat(s)</span>
      </div>

      <!-- Table -->
      <div class="table-container">
        <table mat-table [dataSource]="pagedAgents()">
          <ng-container matColumnDef="nomAgent">
            <th mat-header-cell *matHeaderCellDef (click)="toggleSort('nomAgent')" class="sortable-th">
              Agent <mat-icon class="sort-icon">{{ sortIcon('nomAgent') }}</mat-icon>
            </th>
            <td mat-cell *matCellDef="let a">
              <a [routerLink]="['/agents', a.id]" class="agent-link">
                <div class="agent-name">{{ a.nomAgent }}</div>
                <div class="agent-sub">{{ a.identifiant }}</div>
              </a>
            </td>
          </ng-container>

          <ng-container matColumnDef="nomResponsable">
            <th mat-header-cell *matHeaderCellDef (click)="toggleSort('nomResponsable')" class="sortable-th">
              Responsable <mat-icon class="sort-icon">{{ sortIcon('nomResponsable') }}</mat-icon>
            </th>
            <td mat-cell *matCellDef="let a">{{ a.nomResponsable }}</td>
          </ng-container>

          <ng-container matColumnDef="zone">
            <th mat-header-cell *matHeaderCellDef (click)="toggleSort('zone')" class="sortable-th">
              Zone <mat-icon class="sort-icon">{{ sortIcon('zone') }}</mat-icon>
            </th>
            <td mat-cell *matCellDef="let a">
              <span class="zone-badge">{{ a.zone }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="anydesk_caisse">
            <th mat-header-cell *matHeaderCellDef>AnyDesk Caisse</th>
            <td mat-cell *matCellDef="let a">
              <div class="anydesk-cell">
                <code>{{ a.anydesk || '—' }}</code>
                @if (a.anydesk) {
                  <button mat-icon-button (click)="copyAnydesk(a.anydesk)" matTooltip="Copier">
                    <mat-icon>content_copy</mat-icon>
                  </button>
                }
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="anydesk_serveur">
            <th mat-header-cell *matHeaderCellDef>AnyDesk Serveur</th>
            <td mat-cell *matCellDef="let a">
              <div class="anydesk-cell">
                <code>{{ a.anydesk_serveur || '—' }}</code>
                @if (a.anydesk_serveur) {
                  <button mat-icon-button (click)="copyAnydesk(a.anydesk_serveur)" matTooltip="Copier">
                    <mat-icon>content_copy</mat-icon>
                  </button>
                }
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="caisse_status">
            <th mat-header-cell *matHeaderCellDef class="ms-col-th">
              <mat-icon class="ms-col-icon" matTooltip="État caisse">point_of_sale</mat-icon>
            </th>
            <td mat-cell *matCellDef="let a" class="ms-col">
              @if (allStatuses()[a.id]?.caisse?.online) {
                <span class="ms-dot on" [class.ms-dot-long]="isLongOnline(allStatuses()[a.id]?.caisse)"
                      [matTooltip]="'Caisse en ligne · ' + allStatuses()[a.id]!.caisse!.ip + (allStatuses()[a.id]!.caisse!.onlineSince ? ' · depuis ' + formatOnlineSince(allStatuses()[a.id]!.caisse!.onlineSince!) : '')"></span>
              } @else if (allStatuses()[a.id]?.caisse) {
                <span class="ms-dot off" [class.ms-dot-dead]="isLongOffline(allStatuses()[a.id]?.caisse)"
                      [matTooltip]="'Caisse hors ligne · vérifié il y a ' + formatMinutesAgo(allStatuses()[a.id]!.caisse!.minutesAgo)"></span>
              } @else {
                <span class="ms-dot unk" matTooltip="Jamais vérifié"></span>
              }
              @if (allStatuses()[a.id]?.caisse?.duplicateSuspected) {
                <mat-icon class="ms-dup-warn"
                          matTooltip="Cet identifiant d'agent semble utilisé sur plusieurs machines (IP instable)">warning</mat-icon>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="serveur_status">
            <th mat-header-cell *matHeaderCellDef class="ms-col-th">
              <mat-icon class="ms-col-icon" matTooltip="État serveur">dns</mat-icon>
            </th>
            <td mat-cell *matCellDef="let a" class="ms-col">
              @if (allStatuses()[a.id]?.serveur?.online) {
                <span class="ms-dot on" [class.ms-dot-long]="isLongOnline(allStatuses()[a.id]?.serveur)"
                      [matTooltip]="'Serveur en ligne · ' + allStatuses()[a.id]!.serveur!.ip + (allStatuses()[a.id]!.serveur!.onlineSince ? ' · depuis ' + formatOnlineSince(allStatuses()[a.id]!.serveur!.onlineSince!) : '')"></span>
              } @else if (allStatuses()[a.id]?.serveur) {
                <span class="ms-dot off" [class.ms-dot-dead]="isLongOffline(allStatuses()[a.id]?.serveur)"
                      [matTooltip]="'Serveur hors ligne · vérifié il y a ' + formatMinutesAgo(allStatuses()[a.id]!.serveur!.minutesAgo)"></span>
              } @else {
                <span class="ms-dot unk" matTooltip="Jamais vérifié"></span>
              }
              @if (allStatuses()[a.id]?.serveur?.duplicateSuspected) {
                <mat-icon class="ms-dup-warn"
                          matTooltip="Cet identifiant d'agent semble utilisé sur plusieurs machines (IP instable)">warning</mat-icon>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="statut">
            <th mat-header-cell *matHeaderCellDef>Statut</th>
            <td mat-cell *matCellDef="let a">
              <div class="statut-cell">
                <span class="status-chip {{ statutClass(a.statut) }}">{{ a.statut }}</span>
                @if (a.statut === 'Redéployé' && a.redeploieVersNom) {
                  <span class="redeploie-vers" [matTooltip]="'Vers : ' + a.redeploieVersNom">
                    → {{ a.redeploieVersNom }}
                  </span>
                }
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="date">
            <th mat-header-cell *matHeaderCellDef>Dernière MAJ</th>
            <td mat-cell *matCellDef="let a">{{ a.date | date:'dd/MM/yyyy' }}</td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let a">
              <div class="actions-cell">
                <a mat-icon-button [routerLink]="['/agents', a.id]" matTooltip="Voir détail">
                  <mat-icon>visibility</mat-icon>
                </a>
                @if (auth.isAdmin()) {
                  <a mat-icon-button [routerLink]="['/agents', a.id, 'edit']" matTooltip="Modifier">
                    <mat-icon>edit</mat-icon>
                  </a>
                  <button mat-icon-button [matMenuTriggerFor]="statusMenu" matTooltip="Changer statut">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #statusMenu="matMenu">
                    <button mat-menu-item (click)="changeStatut(a, 'Actif')"><mat-icon>check_circle</mat-icon> Actif</button>
                    <button mat-menu-item (click)="changeStatut(a, 'Inactif')"><mat-icon>cancel</mat-icon> Inactif</button>
                    <button mat-menu-item (click)="changeStatut(a, 'Redéployé')"><mat-icon>swap_horiz</mat-icon> Redéployé</button>
                    <button mat-menu-item (click)="changeStatut(a, 'À redéployer')"><mat-icon>schedule_send</mat-icon> À redéployer</button>
                    @if (auth.isSuperadmin()) {
                      <mat-divider></mat-divider>
                      <button mat-menu-item (click)="deleteAgent(a)" class="delete-btn">
                        <mat-icon>delete</mat-icon> Supprimer
                      </button>
                    }
                  </mat-menu>
                }
              </div>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns;"
              [class.row-a-redeployer]="row.statut === 'À redéployer'"
              [class.row-inactif]="row.statut === 'Inactif'"
              [class.row-redeploye]="row.statut === 'Redéployé'"></tr>
        </table>

        <!-- Cartes (mobile) -->
        <div class="agent-cards">
          @for (a of pagedAgents(); track a.id) {
            <div class="agent-card"
                 [class.row-a-redeployer]="a.statut === 'À redéployer'"
                 [class.row-inactif]="a.statut === 'Inactif'"
                 [class.row-redeploye]="a.statut === 'Redéployé'">
              <a [routerLink]="['/agents', a.id]" class="ac-main">
                <div class="ac-name">{{ a.nomAgent }}</div>
                <div class="ac-sub">{{ a.identifiant }}</div>
              </a>
              <div class="ac-row">
                <span class="zone-badge">{{ a.zone }}</span>
                <span class="status-chip {{ statutClass(a.statut) }}">{{ a.statut }}</span>
              </div>
              <div class="ac-status-row">
                <span class="ac-status">
                  <mat-icon class="ms-col-icon" matTooltip="État caisse">point_of_sale</mat-icon>
                  @if (allStatuses()[a.id]?.caisse?.online) {
                    <span class="ms-dot on" [class.ms-dot-long]="isLongOnline(allStatuses()[a.id]?.caisse)"
                          [matTooltip]="'Caisse en ligne' + (allStatuses()[a.id]!.caisse!.onlineSince ? ' · depuis ' + formatOnlineSince(allStatuses()[a.id]!.caisse!.onlineSince!) : '')"></span>
                  } @else if (allStatuses()[a.id]?.caisse) {
                    <span class="ms-dot off" [class.ms-dot-dead]="isLongOffline(allStatuses()[a.id]?.caisse)"
                          [matTooltip]="'Caisse hors ligne · vérifié il y a ' + formatMinutesAgo(allStatuses()[a.id]!.caisse!.minutesAgo)"></span>
                  } @else {
                    <span class="ms-dot unk" matTooltip="Jamais vérifié"></span>
                  }
                </span>
                <span class="ac-status">
                  <mat-icon class="ms-col-icon" matTooltip="État serveur">dns</mat-icon>
                  @if (allStatuses()[a.id]?.serveur?.online) {
                    <span class="ms-dot on" [class.ms-dot-long]="isLongOnline(allStatuses()[a.id]?.serveur)"
                          [matTooltip]="'Serveur en ligne' + (allStatuses()[a.id]!.serveur!.onlineSince ? ' · depuis ' + formatOnlineSince(allStatuses()[a.id]!.serveur!.onlineSince!) : '')"></span>
                  } @else if (allStatuses()[a.id]?.serveur) {
                    <span class="ms-dot off" [class.ms-dot-dead]="isLongOffline(allStatuses()[a.id]?.serveur)"
                          [matTooltip]="'Serveur hors ligne · vérifié il y a ' + formatMinutesAgo(allStatuses()[a.id]!.serveur!.minutesAgo)"></span>
                  } @else {
                    <span class="ms-dot unk" matTooltip="Jamais vérifié"></span>
                  }
                </span>
              </div>
              <div class="ac-actions">
                <a mat-icon-button [routerLink]="['/agents', a.id]" matTooltip="Voir détail">
                  <mat-icon>visibility</mat-icon>
                </a>
                @if (auth.isAdmin()) {
                  <a mat-icon-button [routerLink]="['/agents', a.id, 'edit']" matTooltip="Modifier">
                    <mat-icon>edit</mat-icon>
                  </a>
                  <button mat-icon-button [matMenuTriggerFor]="cardStatusMenu" matTooltip="Changer statut">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #cardStatusMenu="matMenu">
                    <button mat-menu-item (click)="changeStatut(a, 'Actif')"><mat-icon>check_circle</mat-icon> Actif</button>
                    <button mat-menu-item (click)="changeStatut(a, 'Inactif')"><mat-icon>cancel</mat-icon> Inactif</button>
                    <button mat-menu-item (click)="changeStatut(a, 'Redéployé')"><mat-icon>swap_horiz</mat-icon> Redéployé</button>
                    <button mat-menu-item (click)="changeStatut(a, 'À redéployer')"><mat-icon>schedule_send</mat-icon> À redéployer</button>
                    @if (auth.isSuperadmin()) {
                      <mat-divider></mat-divider>
                      <button mat-menu-item (click)="deleteAgent(a)" class="delete-btn">
                        <mat-icon>delete</mat-icon> Supprimer
                      </button>
                    }
                  </mat-menu>
                }
              </div>
            </div>
          }
        </div>

        @if (filtered().length === 0) {
          <div class="empty-state">
            <mat-icon>people_outline</mat-icon>
            <h3>Aucun agent trouvé</h3>
            <p>Modifiez vos filtres ou ajoutez un nouvel agent</p>
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
    </div>
  `,
  styles: [`
    /* ── Monitor bar ── */
    .monitor-bar {
      display: flex; align-items: center; gap: 16px;
      background: white; border: 1.5px solid #e8edf2;
      border-radius: 12px; padding: 10px 16px; margin-bottom: 16px;
      box-shadow: 0 1px 4px rgba(0,0,0,.05);
    }
    .monitor-bar-left { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .monitor-icon { color: var(--primary-light); font-size: 20px; width: 20px; height: 20px; }
    .monitor-title { font-size: 13px; font-weight: 700; color: #1a3a5c; white-space: nowrap; }
    .monitor-live-dot {
      width: 7px; height: 7px; border-radius: 50%; background: #43a047;
      animation: live-pulse 2.4s infinite;
    }
    @keyframes live-pulse {
      0%,100% { opacity: 1; transform: scale(1); }
      50%      { opacity: .3; transform: scale(.7); }
    }
    .monitor-stats { display: flex; align-items: center; gap: 0; flex: 1; }
    .mstat {
      display: flex; align-items: center; gap: 6px;
      padding: 0 16px;
    }
    .mstat-dot {
      width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0;
      &.on { background: #43a047; box-shadow: 0 0 0 3px rgba(67,160,71,.2); animation: pulse-sm 2s infinite; }
    }
    @keyframes pulse-sm {
      0%   { box-shadow: 0 0 0 0 rgba(67,160,71,.4); }
      70%  { box-shadow: 0 0 0 5px rgba(67,160,71,0); }
      100% { box-shadow: 0 0 0 0 rgba(67,160,71,0); }
    }
    .mstat-num { font-size: 18px; font-weight: 800; color: #2e7d32; line-height: 1; }
    .mstat-neutral .mstat-num { color: #546e7a; }
    .mstat-label { font-size: 11px; color: var(--text-secondary); white-space: nowrap; }
    .mstat-sep { width: 1px; height: 28px; background: #e8edf2; flex-shrink: 0; }
    .mstat-clickable {
      cursor: pointer; border-radius: 8px; transition: background .15s;
      &:hover { background: #e8f5e9; }
      &.mstat-warn:hover { background: #fdf2df; }
    }
    .mstat-active { background: #c8e6c9; box-shadow: inset 0 0 0 1.5px #43a047; }
    .mstat-warn.mstat-active { background: #fdf2df; box-shadow: inset 0 0 0 1.5px #e6a817; }
    .machine-filter-chip {
      display: flex; align-items: center; gap: 4px;
      background: #e8f5e9; color: #2e7d32; font-size: 12px; font-weight: 600;
      padding: 6px 10px; border-radius: 16px; white-space: nowrap;
      mat-icon { font-size: 15px; width: 15px; height: 15px; cursor: pointer; opacity: .7; &:hover { opacity: 1; } }
    }
    .machine-filter-chip-warn { background: #fdf2df; color: #c07f00; }
    .monitor-refresh { margin-left: auto; flex-shrink: 0; color: var(--text-secondary) !important; }
    @media (max-width: 640px) {
      .monitor-bar { flex-wrap: wrap; }
      .monitor-stats { flex-wrap: wrap; row-gap: 6px; }
      .mstat { padding: 0 10px; }
    }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .spin { animation: spin .8s linear infinite; }

    /* ── Machine status dots in table ── */
    .ms-col-th { width: 36px; text-align: center; padding: 0 4px !important; }
    .ms-col    { text-align: center; padding: 0 4px !important; }
    .ms-col-icon { font-size: 15px; width: 15px; height: 15px; color: #90a4ae; vertical-align: middle; }
    .ms-dot {
      display: inline-block; width: 11px; height: 11px; border-radius: 50%; vertical-align: middle;
      &.on  { background: #43a047; box-shadow: 0 0 0 3px rgba(67,160,71,.2); animation: pulse-sm 2s infinite; }
      &.off { background: #e53935; }
      &.unk { background: #d0d0d0; }
      &.ms-dot-long { background: #fb8c00; box-shadow: 0 0 0 3px rgba(251,140,0,.22); }
      &.ms-dot-dead { background: #7a1f1f; }
    }
    @keyframes pulse-sm {
      0%   { box-shadow: 0 0 0 0 rgba(67,160,71,.45); }
      70%  { box-shadow: 0 0 0 5px rgba(67,160,71,0); }
      100% { box-shadow: 0 0 0 0 rgba(67,160,71,0); }
    }
    .ms-dup-warn { font-size: 13px; width: 13px; height: 13px; color: #e6a817; vertical-align: middle; margin-left: 2px; }

    .agent-link { text-decoration: none; color: inherit; }
    .agent-name { font-weight: 600; color: var(--primary); font-size: 13px; }
    .agent-sub { font-size: 11px; color: var(--text-secondary); }
    .sortable-th { cursor: pointer; user-select: none; white-space: nowrap;
      &:hover { background: rgba(0,0,0,0.04); }
      .sort-icon { font-size: 14px; width: 14px; height: 14px; vertical-align: middle; opacity: 0.5; transition: opacity .15s; }
      &:hover .sort-icon, &.sorted .sort-icon { opacity: 1; }
    }
    .zone-badge { background: #e8f0fe; color: #1a3a5c; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
    .anydesk-cell { display: flex; align-items: center; gap: 4px; }
    .anydesk-cell code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
    .anydesk-cell button { width: 28px; height: 28px; mat-icon { font-size: 16px; } }
    .actions-cell { display: flex; align-items: center; gap: 0; }
    .reset-btn { color: var(--text-secondary); }
    .result-count { color: var(--text-secondary); font-size: 13px; margin-left: auto; white-space: nowrap; }
    .delete-btn { color: #c62828; }
    mat-divider { margin: 4px 0; }
    .statut-cell { display: flex; flex-direction: column; gap: 2px; }
    .redeploie-vers { font-size: 11px; color: #1565c0; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px; cursor: default; }

    /* ── Cartes agents (mobile) ── */
    .agent-cards { display: none; }
    @media (max-width: 640px) {
      .table-container table { display: none; }
      .agent-cards { display: flex; flex-direction: column; gap: 10px; padding: 2px 2px 8px; }
    }
    .agent-card {
      background: var(--surface, #fff); border: 1px solid #e8edf2; border-radius: 12px;
      padding: 14px 14px 8px;
      &.row-a-redeployer { border-left: 3px solid #f57c00; }
      &.row-inactif { opacity: .65; }
      &.row-redeploye { border-left: 3px solid #1565c0; }
    }
    .ac-main { text-decoration: none; color: inherit; display: block; margin-bottom: 8px; }
    .ac-name { font-weight: 700; color: var(--primary); font-size: 14px; }
    .ac-sub { font-size: 11px; color: var(--text-secondary); }
    .ac-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
    .ac-status-row {
      display: flex; gap: 20px; margin-bottom: 6px; padding-top: 8px; border-top: 1px solid #f0f0f0;
    }
    .ac-status {
      display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-secondary);
      .ms-col-icon { vertical-align: middle; }
    }
    .ac-actions {
      display: flex; justify-content: flex-end; border-top: 1px solid #f0f0f0; margin-top: 2px;
    }
  `]
})
export class AgentListComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  private agentSvc      = inject(AgentService);
  private zoneSvc       = inject(ZoneService);
  private snack         = inject(MatSnackBar);
  private dialog        = inject(MatDialog);
  private confirmSvc    = inject(ConfirmService);
  private heartbeatSvc  = inject(HeartbeatService);
  private sseSvc        = inject(SseService);
  private exportSvc     = inject(ExportService);

  formatMinutesAgo = formatMinutesAgo;

  summary        = signal<MachineSummary | null>(null);
  allStatuses    = signal<Record<string, AgentMachineStatus>>({});
  summaryLoading = signal(false);
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private sseSub: Subscription | null = null;

  private static readonly FILTERS_KEY = 'betnabiso_agent_list_filters';

  // Efface les filtres persistés juste avant un vrai rechargement de page
  // (bouton du navigateur, F5, fermeture d'onglet) — cet événement ne se
  // déclenche jamais pour une navigation interne à l'app (retour depuis la
  // fiche détail), qui doit elle continuer à conserver les filtres.
  private clearOnRealReload = () => sessionStorage.removeItem(AgentListComponent.FILTERS_KEY);

  constructor() {
    window.addEventListener('beforeunload', this.clearOnRealReload);

    // Restaure les filtres/tri/pagination de la dernière visite (le composant
    // est recréé quand on revient de la fiche détail, ce qui remettait tout à zéro).
    const saved = sessionStorage.getItem(AgentListComponent.FILTERS_KEY);
    if (saved) {
      try {
        const f = JSON.parse(saved);
        if (f.searchQuery)    this.searchQuery.set(f.searchQuery);
        if (f.filterZone)     this.filterZone.set(f.filterZone);
        if (f.filterStatut)   this.filterStatut.set(f.filterStatut);
        if (f.filterMachine)  this.filterMachine.set(f.filterMachine);
        if (f.sortCol)        this.sortCol.set(f.sortCol);
        if (f.sortDir)        this.sortDir.set(f.sortDir);
        if (typeof f.pageIndex === 'number') this.pageIndex.set(f.pageIndex);
        if (typeof f.pageSize === 'number')  this.pageSize.set(f.pageSize);
      } catch {}
    }

    effect(() => {
      const state = {
        searchQuery: this.searchQuery(), filterZone: this.filterZone(),
        filterStatut: this.filterStatut(), filterMachine: this.filterMachine(),
        sortCol: this.sortCol(), sortDir: this.sortDir(),
        pageIndex: this.pageIndex(), pageSize: this.pageSize(),
      };
      sessionStorage.setItem(AgentListComponent.FILTERS_KEY, JSON.stringify(state));
    });
  }

  ngOnInit(): void {
    this.loadSummary();
    this.pollTimer = setInterval(() => this.loadSummary(), 120_000);
    this.sseSub = this.sseSvc.dataUpdate$.subscribe(type => {
      if (type === 'machine_status') this.loadSummary();
    });
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.sseSub?.unsubscribe();
    window.removeEventListener('beforeunload', this.clearOnRealReload);
  }

  private async loadSummary(): Promise<void> {
    try {
      const [s, all] = await Promise.all([
        this.heartbeatSvc.getSummary(),
        this.heartbeatSvc.getAllStatuses(),
      ]);
      this.summary.set(s);
      this.allStatuses.set(all);
    } catch { /* silencieux si aucune machine n'a encore pingé */ }
  }

  async refreshSummary(): Promise<void> {
    this.resetFilters();
    this.summaryLoading.set(true);
    await this.loadSummary();
    this.summaryLoading.set(false);
  }

  columns = ['nomAgent', 'nomResponsable', 'zone', 'anydesk_caisse', 'anydesk_serveur', 'caisse_status', 'serveur_status', 'statut', 'date', 'actions'];
  zones = computed(() => this.zoneSvc.getAll());
  searchQuery = signal('');
  filterZone = signal('');
  filterStatut = signal('');
  filterMachine = signal<'' | 'caisse-on' | 'serveur-on' | 'duplicate' | 'monitored' | 'long-online' | 'long-offline'>('');
  isLongOnline = isLongOnline;
  isLongOffline = isLongOffline;
  formatOnlineSince = formatOnlineSince;

  private allAgents = computed(() => this.agentSvc.getAll());

  longOfflineCount = computed(() => {
    const statuses = this.allStatuses();
    return this.allAgents().filter(a =>
      isLongOffline(statuses[a.id]?.caisse) || isLongOffline(statuses[a.id]?.serveur)
    ).length;
  });

  hasFilter = computed(() => !!this.searchQuery() || !!this.filterZone() || !!this.filterStatut() || !!this.filterMachine());

  machineFilterLabel = computed(() => {
    switch (this.filterMachine()) {
      case 'caisse-on':   return 'Caisses en ligne';
      case 'serveur-on':  return 'Serveurs en ligne';
      case 'duplicate':   return 'Doublons suspectés';
      case 'monitored':   return 'Agents surveillés';
      case 'long-online':  return 'En ligne depuis +24h';
      case 'long-offline': return 'Hors ligne depuis +24h';
      default:            return '';
    }
  });

  resetFilters(): void {
    this.searchQuery.set('');
    this.filterZone.set('');
    this.filterStatut.set('');
    this.filterMachine.set('');
    this.pageIndex.set(0);
  }

  toggleMachineFilter(value: '' | 'caisse-on' | 'serveur-on' | 'duplicate' | 'monitored' | 'long-online' | 'long-offline'): void {
    this.filterMachine.set(this.filterMachine() === value ? '' : value);
    this.pageIndex.set(0);
  }

  private statutOrder: Record<string, number> = {
    'Actif':        0,
    'Inactif':      1,
    'À redéployer': 2,
    'Redéployé':    3,
  };

  pageSize  = signal(25);
  pageIndex = signal(0);
  sortCol   = signal<string>('');
  sortDir   = signal<'asc' | 'desc'>('asc');

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

  filtered = computed(() => {
    let agents = this.allAgents();
    const q = this.searchQuery().toLowerCase().trim();
    if (q) agents = agents.filter(a =>
      (a.nomAgent       ?? '').toLowerCase().includes(q) ||
      (a.nomResponsable ?? '').toLowerCase().includes(q) ||
      (a.identifiant    ?? '').toLowerCase().includes(q) ||
      (a.anydesk        ?? '').includes(q) ||
      (a.anydesk_serveur?? '').includes(q) ||
      (a.numero         ?? '').includes(q)
    );
    const fz = this.filterZone();
    if (fz) agents = agents.filter(a => a.zone === fz);
    const fs = this.filterStatut();
    if (fs) agents = agents.filter(a => a.statut === fs);
    const fm = this.filterMachine();
    if (fm === 'caisse-on') agents = agents.filter(a => this.allStatuses()[a.id]?.caisse?.online);
    if (fm === 'serveur-on') agents = agents.filter(a => this.allStatuses()[a.id]?.serveur?.online);
    if (fm === 'duplicate') agents = agents.filter(a =>
      this.allStatuses()[a.id]?.caisse?.duplicateSuspected || this.allStatuses()[a.id]?.serveur?.duplicateSuspected
    );
    if (fm === 'monitored') agents = agents.filter(a =>
      !!this.allStatuses()[a.id]?.caisse || !!this.allStatuses()[a.id]?.serveur
    );
    if (fm === 'long-online') agents = agents.filter(a =>
      isLongOnline(this.allStatuses()[a.id]?.caisse) || isLongOnline(this.allStatuses()[a.id]?.serveur)
    );
    if (fm === 'long-offline') agents = agents.filter(a =>
      isLongOffline(this.allStatuses()[a.id]?.caisse) || isLongOffline(this.allStatuses()[a.id]?.serveur)
    );

    const col = this.sortCol();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return [...agents].sort((a, b) => {
      if (col) {
        const va = String((a as unknown as Record<string, unknown>)[col] ?? '').toLowerCase();
        const vb = String((b as unknown as Record<string, unknown>)[col] ?? '').toLowerCase();
        if (va < vb) return -dir;
        if (va > vb) return dir;
        return 0;
      }
      const diff = (this.statutOrder[a.statut] ?? 9) - (this.statutOrder[b.statut] ?? 9);
      return diff !== 0 ? diff : a.nomAgent.localeCompare(b.nomAgent, 'fr');
    });
  });

  pagedAgents = computed(() => {
    const all   = this.filtered();
    const size  = this.pageSize();
    const page  = this.pageIndex();
    const start = page * size;
    // Si la page courante est hors limites (après changement de filtre), afficher depuis le début
    return start >= all.length ? all.slice(0, size) : all.slice(start, start + size);
  });

  onPage(e: PageEvent): void {
    this.pageSize.set(e.pageSize);
    this.pageIndex.set(e.pageIndex);
  }

  statutClass(s: AgentStatut): string {
    const map: Record<string, string> = { 'Actif': 'actif', 'Inactif': 'inactif', 'Redéployé': 'redeploye', 'À redéployer': 'a-redeployer' };
    return map[s] ?? '';
  }

  copyAnydesk(id: string): void {
    navigator.clipboard.writeText(id);
    this.snack.open(`AnyDesk ID copié : ${id}`, 'OK', { duration: 2000, panelClass: 'info-snack' });
  }

  changeStatut(agent: Agent, statut: AgentStatut): void {
    if (statut === 'Redéployé') {
      const others = this.agentSvc.getAll().filter(a => a.id !== agent.id);
      const ref = this.dialog.open(RedeploiementDialogComponent, {
        data: { agents: others },
        width: '420px'
      });
      ref.afterClosed().subscribe(async (target: Agent | null) => {
        if (!target) return;
        await this.agentSvc.update(agent.id, {
          statut: 'Redéployé',
          redeploieVersId: target.id,
          redeploieVersNom: target.nomAgent,
          date: new Date().toISOString().split('T')[0]
        });
        this.snack.open(`${agent.nomAgent} redéployé vers ${target.nomAgent}`, 'OK', { duration: 3000, panelClass: 'success-snack' });
      });
    } else {
      this.agentSvc.update(agent.id, {
        statut,
        redeploieVersId: undefined,
        redeploieVersNom: undefined,
        date: new Date().toISOString().split('T')[0]
      });
      this.snack.open(`Statut de ${agent.nomAgent} : ${statut}`, 'OK', { duration: 2500, panelClass: 'success-snack' });
    }
  }

  async deleteAgent(agent: Agent): Promise<void> {
    if (await this.confirmSvc.danger(`Supprimer définitivement l'agent ${agent.nomAgent} ?`)) {
      await this.agentSvc.delete(agent.id);
      this.snack.open('Agent supprimé', 'OK', { duration: 2000, panelClass: 'success-snack' });
    }
  }

  private readonly EXPORT_COLS = [
    { key: 'nomAgent',        label: 'Agent' },
    { key: 'identifiant',     label: 'Identifiant' },
    { key: 'zone',            label: 'Zone' },
    { key: 'nomResponsable',  label: 'Responsable' },
    { key: 'numero',          label: 'Numéro' },
    { key: 'anydesk',         label: 'AnyDesk Caisse' },
    { key: 'anydesk_serveur', label: 'AnyDesk Serveur' },
    { key: 'statut',          label: 'Statut' },
    { key: 'date',            label: 'Dernière MAJ' },
  ];

  exportCsv(): void {
    this.exportSvc.exportCsv(
      this.filtered() as unknown as Record<string, unknown>[],
      `agents_${new Date().toISOString().split('T')[0]}`,
      this.EXPORT_COLS
    );
  }
}
