import { Component, computed, effect, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { AgentService } from '../../core/services/agent.service';
import { InterventionService } from '../../core/services/intervention.service';
import { AuthService } from '../../core/services/auth.service';
import { Intervention, TechMonthlyStats } from '../../core/models/intervention.model';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

interface EscaladeItem { id: string; agentNom: string; agentZone: string; statut: string; dureeH: number; }

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, MatCardModule, MatIconModule, MatButtonModule, MatChipsModule],
  template: `
    <div class="page-container">
      <!-- En-tête -->
      <div class="dash-header">
        <div class="dh-left">
          <h1>{{ greeting() }}, {{ firstName() }}</h1>
          <div class="dh-date">{{ today | date:'EEEE d MMMM yyyy':'':'fr' }}</div>
        </div>
        <div class="dh-right">
          @if (auth.isAdmin()) {
            <a mat-stroked-button routerLink="/history" class="dh-btn-outline">
              <mat-icon>assessment</mat-icon> Rapports
            </a>
          }
          @if (auth.isAdmin()) {
            <a mat-raised-button routerLink="/agents/new" class="dh-btn-gold">
              <mat-icon>person_add</mat-icon> Nouvel agent
            </a>
          }
        </div>
      </div>

      <!-- ===== VUE TECHNICIEN ===== -->
      @if (auth.isTechnicien()) {
        <!-- Grand-livre mensuel -->
        <div class="ledger-strip">
          <div class="lg-item">
            <span class="lg-num">{{ monthlyStats().total }}</span>
            <span class="lg-label">Interventions ce mois</span>
          </div>
          <div class="lg-item">
            <span class="lg-num">{{ monthlyStats().terminees }}</span>
            <span class="lg-label">Terminées ce mois</span>
          </div>
          <div class="lg-item">
            <span class="lg-num">{{ monthlyStats().enCours + monthlyStats().assignees }}</span>
            <span class="lg-label">En attente / en cours</span>
          </div>
          <div class="lg-item">
            <span class="lg-num" [class.lg-warn]="monthlyStats().echecs > 0">{{ monthlyStats().echecs }}</span>
            <span class="lg-label">Échecs ce mois</span>
          </div>
        </div>

        <div class="dashboard-grid">
          <!-- Interventions récentes -->
          <mat-card class="recent-card">
            <mat-card-header>
              <mat-card-title>
                <mat-icon>history</mat-icon>
                Mes interventions récentes
              </mat-card-title>
              <a mat-button routerLink="/interventions" class="see-all">Voir tout</a>
            </mat-card-header>
            <mat-card-content>
              @if (recentInterventions().length === 0) {
                <div class="empty-state">
                  <mat-icon>assignment_turned_in</mat-icon>
                  <p>Aucune intervention pour le moment</p>
                </div>
              }
              <div class="ticket-list">
                @for (item of recentInterventions(); track item.id) {
                  <div class="ticket" [style.--sev]="sevColor(item.priorite)">
                    <div class="ticket-main">
                      <div class="ticket-title">{{ item.agentNom }}</div>
                      <div class="ticket-meta">{{ item.type }} · {{ item.agentZone }}</div>
                    </div>
                    <span class="status-chip {{ statusClass(item.statut) }}">{{ item.statut }}</span>
                    <span class="ticket-time">{{ item.dateDebut | date:'dd/MM HH:mm' }}</span>
                  </div>
                }
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Colonne droite technicien -->
          <div class="right-column">
            <!-- Historique 6 mois -->
            <mat-card class="status-card">
              <mat-card-header>
                <mat-card-title><mat-icon>bar_chart</mat-icon> Activité mensuelle</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="month-bars">
                  @for (m of last6Months(); track m.label) {
                    <div class="month-bar-item">
                      <div class="month-bar-wrap">
                        <div class="month-bar-fill"
                             [style.height]="barHeight(m.total, maxMonthTotal())"
                             [class.current]="$last">
                        </div>
                      </div>
                      <span class="month-bar-count">{{ m.total }}</span>
                      <span class="month-bar-label">{{ m.label }}</span>
                    </div>
                  }
                </div>
              </mat-card-content>
            </mat-card>

            <!-- Actions rapides -->
            <mat-card class="quick-card">
              <mat-card-header>
                <mat-card-title><mat-icon>flash_on</mat-icon> Actions rapides</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="quick-actions">
                  <a mat-stroked-button routerLink="/interventions/new" class="quick-btn">
                    <mat-icon>add_circle</mat-icon> Nouvelle intervention
                  </a>
                  <a mat-stroked-button routerLink="/interventions" class="quick-btn">
                    <mat-icon>list</mat-icon> Mes interventions
                  </a>
                  <a mat-stroked-button routerLink="/agents" class="quick-btn">
                    <mat-icon>search</mat-icon> Rechercher un agent
                  </a>
                </div>
              </mat-card-content>
            </mat-card>
          </div>
        </div>

        <!-- Classement mensuel -->
        @if (techRanking().length > 1) {
          <mat-card class="ranking-card">
            <mat-card-header>
              <mat-card-title>
                <mat-icon>leaderboard</mat-icon>
                Classement ce mois — {{ rankingMonthLabel() }}
              </mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="ranking-list">
                @for (stat of techRanking(); track stat.technicienId; let rank = $index) {
                  <div class="rank-row" [class.is-me]="stat.technicienId.trim() === myId()">
                    <span class="rank-pos">
                      @if (rank === 0) { <mat-icon class="medal gold">workspace_premium</mat-icon> }
                      @else if (rank === 1) { <mat-icon class="medal silver">workspace_premium</mat-icon> }
                      @else if (rank === 2) { <mat-icon class="medal bronze">workspace_premium</mat-icon> }
                      @else { <span class="rank-num">#{{ rank + 1 }}</span> }
                    </span>
                    <div class="rank-name-block">
                      <span class="rank-name">{{ stat.technicienNom }}</span>
                      @if (stat.technicienId.trim() === myId()) {
                        <span class="you-badge">Moi</span>
                      }
                    </div>
                    <div class="rank-bar-wrap">
                      <div class="rank-bar-fill"
                           [style.width]="pct(stat.terminees, maxTerminees())"
                           [class.is-me-bar]="stat.technicienId.trim() === myId()">
                      </div>
                    </div>
                    <div class="rank-stats">
                      <span class="rank-done">{{ stat.terminees }}<small>/{{ stat.total }}</small></span>
                      <span class="rank-rate" [class.rate-good]="succesRate(stat) >= 80"
                                              [class.rate-mid]="succesRate(stat) >= 50 && succesRate(stat) < 80"
                                              [class.rate-low]="succesRate(stat) < 50">
                        {{ succesRate(stat) }}%
                      </span>
                      @if (stat.dureeMoy) {
                        <span class="rank-dur">~{{ stat.dureeMoy | number:'1.0-0' }} min</span>
                      }
                    </div>
                  </div>
                }
              </div>
              <div class="ranking-legend">
                <span><span class="dot green"></span> Taux ≥ 80%</span>
                <span><span class="dot orange"></span> 50–80%</span>
                <span><span class="dot red"></span> &lt; 50%</span>
                <small>Classement par nombre d'interventions terminées ce mois</small>
              </div>
            </mat-card-content>
          </mat-card>
        }
      }

      <!-- ===== VUE ADMIN / SUPPORT / SUPERADMIN ===== -->
      @if (!auth.isTechnicien()) {
        <!-- Grand-livre -->
        <div class="ledger-strip">
          <div class="lg-item">
            <span class="lg-num">{{ agentStats().total }}</span>
            <span class="lg-label">Total agents</span>
          </div>
          <div class="lg-item">
            <span class="lg-num">{{ agentStats().actifs }}</span>
            <span class="lg-label">Agents actifs</span>
          </div>
          <div class="lg-item">
            <span class="lg-num">{{ interventionStats().total }}</span>
            <span class="lg-label">Interventions ce mois</span>
          </div>
          <div class="lg-item">
            <span class="lg-num">{{ interventionStats().enCours }}</span>
            <span class="lg-label">En cours ce mois</span>
          </div>
        </div>

        <div class="dashboard-grid">
          <!-- Interventions récentes -->
          <mat-card class="recent-card">
            <mat-card-header>
              <mat-card-title>
                <mat-icon>history</mat-icon>
                Interventions récentes
              </mat-card-title>
              <a mat-button routerLink="/interventions" class="see-all">Voir tout</a>
            </mat-card-header>
            <mat-card-content>
              @if (recentInterventions().length === 0) {
                <div class="empty-state">
                  <mat-icon>assignment_turned_in</mat-icon>
                  <p>Aucune intervention pour le moment</p>
                </div>
              }
              <div class="ticket-list">
                @for (item of recentInterventions(); track item.id) {
                  <div class="ticket" [style.--sev]="sevColor(item.priorite)">
                    <div class="ticket-main">
                      <div class="ticket-title">{{ item.agentNom }}</div>
                      <div class="ticket-meta">{{ item.type }} · {{ item.technicienNom }}</div>
                    </div>
                    <span class="status-chip {{ statusClass(item.statut) }}">{{ item.statut }}</span>
                    <span class="ticket-time">{{ item.dateDebut | date:'dd/MM HH:mm' }}</span>
                  </div>
                }
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Stats par statut & Quick actions -->
          <div class="right-column">
            <!-- Quick actions -->
            <mat-card class="quick-card">
              <mat-card-header>
                <mat-card-title><mat-icon>flash_on</mat-icon> Actions rapides</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="quick-actions">
                  @if (!auth.isChauffeur() && !auth.isSupport()) {
                    <a mat-stroked-button routerLink="/interventions/new" class="quick-btn">
                      <mat-icon>add_circle</mat-icon> Nouvelle intervention
                    </a>
                  }
                  <a mat-stroked-button routerLink="/agents" class="quick-btn">
                    <mat-icon>search</mat-icon> Rechercher un agent
                  </a>
                  @if (auth.isAdmin()) {
                    <a mat-stroked-button routerLink="/agents/new" class="quick-btn">
                      <mat-icon>person_add</mat-icon> Ajouter un agent
                    </a>
                    <a mat-stroked-button routerLink="/history" class="quick-btn">
                      <mat-icon>bar_chart</mat-icon> Voir les rapports
                    </a>
                  }
                </div>
              </mat-card-content>
            </mat-card>

            <!-- Stats by status -->
            <mat-card class="status-card">
              <mat-card-header>
                <mat-card-title><mat-icon>donut_large</mat-icon> Statuts agents</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="ring-body">
                  <canvas #ring width="176" height="176" class="ring-canvas"></canvas>
                  <div class="ring-legend">
                    <div class="rl-row"><span class="rl-dot" style="background:#4caf50"></span><span class="rl-label">Actif</span><span class="rl-val">{{ agentStats().actifs }}</span></div>
                    <div class="rl-row"><span class="rl-dot" style="background:#f44336"></span><span class="rl-label">Inactif</span><span class="rl-val">{{ agentStats().inactifs }}</span></div>
                    <div class="rl-row"><span class="rl-dot" style="background:#ff9800"></span><span class="rl-label">À redéployer</span><span class="rl-val">{{ agentStats().aRedeployer }}</span></div>
                    <div class="rl-row"><span class="rl-dot" style="background:#2196f3"></span><span class="rl-label">Redéployé</span><span class="rl-val">{{ agentStats().redeployes }}</span></div>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
          </div>
        </div>

        <!-- Classement mensuel admin -->
        @if (auth.isAdmin() && techRanking().length > 0) {
          <mat-card class="ranking-card">
            <mat-card-header>
              <mat-card-title>
                <mat-icon>leaderboard</mat-icon>
                Classement techniciens — {{ rankingMonthLabel() }}
              </mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="ranking-list">
                @for (stat of techRanking(); track stat.technicienId; let rank = $index) {
                  <div class="rank-row" [class.is-me]="stat.technicienId.trim() === myId()">
                    <span class="rank-pos">
                      @if (rank === 0) { <mat-icon class="medal gold">workspace_premium</mat-icon> }
                      @else if (rank === 1) { <mat-icon class="medal silver">workspace_premium</mat-icon> }
                      @else if (rank === 2) { <mat-icon class="medal bronze">workspace_premium</mat-icon> }
                      @else { <span class="rank-num">#{{ rank + 1 }}</span> }
                    </span>
                    <div class="rank-name-block">
                      <span class="rank-name">{{ stat.technicienNom }}</span>
                      @if (stat.technicienId.trim() === myId()) {
                        <span class="you-badge">Moi</span>
                      }
                    </div>
                    <div class="rank-bar-wrap">
                      <div class="rank-bar-fill"
                           [style.width]="pct(stat.terminees, maxTerminees())"
                           [class.is-me-bar]="stat.technicienId.trim() === myId()">
                      </div>
                    </div>
                    <div class="rank-stats">
                      <span class="rank-done">{{ stat.terminees }}<small>/{{ stat.total }}</small></span>
                      <span class="rank-rate" [class.rate-good]="succesRate(stat) >= 80"
                                              [class.rate-mid]="succesRate(stat) >= 50 && succesRate(stat) < 80"
                                              [class.rate-low]="succesRate(stat) < 50">
                        {{ succesRate(stat) }}%
                      </span>
                      @if (stat.dureeMoy) {
                        <span class="rank-dur">~{{ stat.dureeMoy | number:'1.0-0' }} min</span>
                      }
                    </div>
                  </div>
                }
              </div>
              <div class="ranking-legend">
                <span><span class="dot green"></span> Taux ≥ 80%</span>
                <span><span class="dot orange"></span> 50–80%</span>
                <span><span class="dot red"></span> &lt; 50%</span>
                <small>Classement par nombre d'interventions terminées ce mois</small>
              </div>
            </mat-card-content>
          </mat-card>
        }

        <!-- Escalades automatiques -->
        @if (auth.isAdmin() && escalades().length > 0) {
          <mat-card class="escalade-alert-card">
            <mat-card-header>
              <mat-card-title>
                <mat-icon style="color:#ff9800">warning</mat-icon>
                Escalades — {{ escalades().length }} intervention(s) en retard
              </mat-card-title>
              <a mat-button routerLink="/geomap" class="see-all">Voir la carte</a>
            </mat-card-header>
            <mat-card-content>
              <div class="ticket-list">
                @for (e of escalades(); track e.id) {
                  <div class="ticket" [style.--sev]="e.dureeH > 12 ? '#e6483c' : '#e2a33e'">
                    <div class="ticket-main">
                      <div class="ticket-title">{{ e.agentNom }}</div>
                      <div class="ticket-meta">{{ e.agentZone }}</div>
                    </div>
                    <span class="status-chip {{ statusClass(e.statut) }}">{{ e.statut }}</span>
                    <span class="ticket-time">{{ e.dureeH }}h</span>
                  </div>
                }
              </div>
            </mat-card-content>
          </mat-card>
        }
      }
    </div>
  `,
  styles: [`
    /* ── En-tête de page ─────────────────────────────────────── */
    .dash-header {
      display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 16px;
      padding-bottom: 18px; margin-bottom: 22px;
      border-bottom: 1px solid var(--border);
    }

    .dh-left h1 {
      font-family: Georgia, "Iowan Old Style", ui-serif, serif;
      font-size: 22px; font-weight: 600; color: var(--text-primary); margin: 0;
    }

    .dh-date {
      font-size: 12.5px; color: var(--text-secondary);
      margin-top: 4px; text-transform: capitalize;
    }

    .dh-right {
      display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
    }

    .dh-btn-gold {
      background: linear-gradient(135deg, #d4af37, #f4d777) !important; color: #171310 !important;
      font-weight: 700 !important; border-radius: 10px !important;
      box-shadow: 0 2px 10px rgba(212,175,55,0.3) !important;
      height: 38px;
    }

    .dh-btn-outline {
      border-color: var(--border) !important;
      color: var(--text-primary) !important; border-radius: 10px !important;
      height: 38px;
      &:hover { background: #fbf3d9 !important; border-color: #d4af37 !important; }
    }

    /* ── Grand-livre ─────────────────────────────────────────── */
    .ledger-strip {
      display: flex;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      margin-bottom: 24px;
      overflow: hidden;
    }
    .lg-item {
      flex: 1; min-width: 0;
      padding: 18px 22px;
      border-right: 1px solid var(--border);
      &:last-child { border-right: none; }
    }
    .lg-num {
      display: block;
      font-family: Georgia, "Iowan Old Style", ui-serif, serif;
      font-size: 27px; font-weight: 600; color: var(--text-primary);
      font-variant-numeric: tabular-nums; line-height: 1.1;
    }
    .lg-num.lg-warn { color: #c0392b; }
    .lg-label {
      display: block; font-size: 11.5px; color: var(--text-secondary); margin-top: 5px;
    }
    @media (max-width: 640px) {
      .ledger-strip { flex-wrap: wrap; }
      .lg-item {
        flex: 1 1 50%; border-bottom: 1px solid var(--border);
        &:nth-child(2n) { border-right: none; }
      }
      .lg-item:nth-last-child(-n+2) { border-bottom: none; }
    }

    /* ── Cards section ───────────────────────────────────────── */
    .subtitle { color: var(--text-secondary); font-size: 13px; margin-top: 4px; }

    .dashboard-grid {
      display: grid;
      grid-template-columns: 1fr 360px;
      gap: 20px;
      @media (max-width: 1024px) { grid-template-columns: 1fr; }
    }

    .recent-card, .quick-card, .status-card {
      mat-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 16px 0;
        mat-card-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 15px;
          font-weight: 600;
          mat-icon { color: var(--primary-light); font-size: 20px; }
        }
      }
      mat-card-content { padding: 12px 16px; }
    }

    .see-all { font-size: 12px; color: var(--primary-light); }

    /* ── Ticket rows (interventions récentes / escalades) ──────── */
    .ticket-list { display: flex; flex-direction: column; }
    .ticket {
      display: flex; align-items: center; gap: 14px;
      padding: 11px 4px 11px 13px;
      border-bottom: 1px solid var(--border);
      position: relative;
      &:last-child { border-bottom: none; }
      &::before {
        content: '';
        position: absolute; left: 0; top: 8px; bottom: 8px; width: 3px;
        border-radius: 2px;
        background: var(--sev, #e2a33e);
      }
    }
    .ticket-main { flex: 1; min-width: 0; }
    .ticket-title { font-weight: 600; font-size: 13px; color: var(--text-primary); }
    .ticket-meta { font-size: 11.5px; color: var(--text-secondary); margin-top: 2px; }
    .ticket-time {
      font-family: ui-monospace, "SF Mono", monospace; font-variant-numeric: tabular-nums;
      font-size: 11.5px; color: var(--text-secondary); flex-shrink: 0;
    }

    .right-column { display: flex; flex-direction: column; gap: 16px; }
    .quick-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
    .quick-btn {
      justify-content: flex-start !important; gap: 10px;
      border-radius: 10px !important; height: 42px;
      font-weight: 500 !important;
      border-color: #e2e8f0 !important;
      &:hover { background: #fbf3d9 !important; border-color: #d4af37 !important; color: #a8791e !important; }
    }

    .ring-body { display: flex; align-items: center; gap: 20px; margin-top: 4px; }
    .ring-canvas { width: 108px; height: 108px; flex-shrink: 0; }
    .ring-legend { flex: 1; display: flex; flex-direction: column; gap: 9px; min-width: 0; }
    .rl-row { display: flex; align-items: center; gap: 8px; font-size: 12.5px; }
    .rl-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .rl-label { flex: 1; color: var(--text-secondary); }
    .rl-val { font-family: ui-monospace, "SF Mono", monospace; font-variant-numeric: tabular-nums; font-weight: 700; color: var(--text-primary); }

    /* Graphique barres mensuelles */
    .month-bars {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 8px;
      height: 110px;
      padding: 8px 0 0;
    }
    .month-bar-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
      gap: 3px;
    }
    .month-bar-wrap {
      width: 100%;
      height: 72px;
      display: flex;
      align-items: flex-end;
    }
    .month-bar-fill {
      width: 100%;
      min-height: 4px;
      background: #bdd5f5;
      border-radius: 4px 4px 0 0;
      transition: height 0.4s ease;
    }
    .month-bar-fill.current { background: #d4af37; }
    .month-bar-count { font-size: 11px; font-weight: 700; color: var(--text-primary); }
    .month-bar-label { font-size: 10px; color: var(--text-secondary); white-space: nowrap; }

    @media (max-width: 768px) {
      .dashboard-grid { display: flex; flex-direction: column; gap: 16px; }
      .right-column { display: flex; flex-direction: column; gap: 16px; }
      .month-bars { height: 90px; }
      .month-bar-wrap { height: 55px; }
      .ranking-card .rank-name-block { min-width: 90px; }
      .ranking-card .rank-stats { min-width: 90px; gap: 4px; }
      .ranking-card .rank-dur { display: none; }
    }

    .empty-state { padding: 30px 0; text-align: center; color: var(--text-secondary); font-size: 13px; }

    /* Classement mensuel */
    .ranking-card {
      margin-top: 20px;
      mat-card-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 16px 16px 0;
        mat-card-title {
          display: flex; align-items: center; gap: 8px;
          font-size: 15px; font-weight: 600;
          mat-icon { color: var(--primary-light); font-size: 20px; }
        }
      }
      mat-card-content { padding: 12px 16px 16px; }
    }
    .ranking-list { display: flex; flex-direction: column; gap: 10px; }
    .rank-row {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 12px; border-radius: 10px;
      background: #f8f9fa; transition: background 0.2s;
      &.is-me { background: #fbf3d9; border: 1.5px solid #d4af37; }
    }
    .rank-pos { width: 36px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .medal { font-size: 22px !important; }
    .medal.gold { color: #f9a825; }
    .medal.silver { color: #90a4ae; }
    .medal.bronze { color: #a1672a; }
    .rank-num { font-size: 13px; font-weight: 700; color: var(--text-secondary); }
    .rank-name-block { display: flex; align-items: center; gap: 6px; min-width: 140px; }
    .rank-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
    .you-badge {
      font-size: 10px; font-weight: 700; color: #171310;
      background: #d4af37; border-radius: 10px; padding: 1px 6px;
    }
    .rank-bar-wrap {
      flex: 1; height: 8px; background: #e0e0e0;
      border-radius: 4px; overflow: hidden;
    }
    .rank-bar-fill {
      height: 100%; border-radius: 4px;
      background: #bdd5f5; transition: width 0.5s ease;
      &.is-me-bar { background: #d4af37; }
    }
    .rank-stats {
      display: flex; align-items: center; gap: 8px;
      min-width: 130px; justify-content: flex-end;
    }
    .rank-done {
      font-size: 13px; font-weight: 700; color: var(--text-primary);
      small { font-size: 11px; font-weight: 400; color: var(--text-secondary); }
    }
    .rank-rate {
      font-size: 12px; font-weight: 700; padding: 2px 8px;
      border-radius: 12px;
      &.rate-good { background: #e8f5e9; color: #2e7d32; }
      &.rate-mid  { background: #fff8e1; color: #ef6c00; }
      &.rate-low  { background: #ffebee; color: #c62828; }
    }
    .rank-dur { font-size: 11px; color: var(--text-secondary); white-space: nowrap; }
    .ranking-legend {
      display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
      margin-top: 12px; padding-top: 10px; border-top: 1px solid #eee;
      font-size: 11px; color: var(--text-secondary);
      small { margin-left: auto; font-style: italic; }
      .dot {
        display: inline-block; width: 8px; height: 8px;
        border-radius: 50%; margin-right: 4px;
        &.green { background: #4caf50; }
        &.orange { background: #ef6c00; }
        &.red { background: #f44336; }
      }
    }

    .escalade-alert-card { margin-top: 20px; border-left: 4px solid #ff9800; }
  `]
})
export class DashboardComponent implements OnInit {
  auth = inject(AuthService);
  private agentSvc = inject(AgentService);
  private interventionSvc = inject(InterventionService);
  private http = inject(HttpClient);

  escalades = signal<EscaladeItem[]>([]);
  private ringCanvas = viewChild<ElementRef<HTMLCanvasElement>>('ring');

  constructor() {
    effect(() => {
      const el = this.ringCanvas()?.nativeElement;
      const stats = this.agentStats();
      if (!el) return;
      this.drawRing(el, [
        { v: stats.actifs,      c: '#4caf50' },
        { v: stats.inactifs,    c: '#f44336' },
        { v: stats.aRedeployer, c: '#ff9800' },
        { v: stats.redeployes,  c: '#2196f3' },
      ], stats.total);
    });
  }

  private drawRing(canvas: HTMLCanvasElement, segs: { v: number; c: string }[], total: number): void {
    const dpr = window.devicePixelRatio || 1;
    const size = 108;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2, cy = size / 2, rOuter = size / 2 - 6, rInner = rOuter - 15;
    if (!total) {
      ctx.beginPath();
      ctx.arc(cx, cy, (rOuter + rInner) / 2, 0, Math.PI * 2);
      ctx.lineWidth = rOuter - rInner;
      ctx.strokeStyle = '#e0e6ed';
      ctx.stroke();
    } else {
      let angle = -Math.PI / 2;
      const gap = 0.028;
      for (const seg of segs) {
        const sweep = (seg.v / total) * Math.PI * 2;
        if (sweep > gap) {
          ctx.beginPath();
          ctx.arc(cx, cy, (rOuter + rInner) / 2, angle, angle + sweep - gap);
          ctx.lineWidth = rOuter - rInner;
          ctx.strokeStyle = seg.c;
          ctx.stroke();
        }
        angle += sweep;
      }
    }

    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#1a2035';
    ctx.font = '600 20px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(total), cx, cy - 5);
    ctx.fillStyle = '#8a94a6';
    ctx.font = '400 8.5px -apple-system, sans-serif';
    ctx.fillText('AGENTS', cx, cy + 12);
  }

  ngOnInit(): void {
    if (this.auth.isAdmin()) this.loadEscalades();
  }

  private async loadEscalades(): Promise<void> {
    try {
      const data = await firstValueFrom(
        this.http.get<EscaladeItem[]>(`${environment.apiUrl}/escalade`)
      );
      this.escalades.set(data);
    } catch { this.escalades.set([]); }
  }

  today = new Date();

  firstName = computed(() => this.auth.currentUser()?.prenom ?? '');

  greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
  });
  agentStats = computed(() => this.agentSvc.getStats());
  interventionStats = computed(() => this.interventionSvc.getStatsThisMonth());

  recentInterventions = computed<Intervention[]>(() =>
    this.interventionSvc.getAll()
      .sort((a, b) => b.dateDebut.localeCompare(a.dateDebut))
      .slice(0, 6)
  );

  monthlyStats = computed(() => {
    const user = this.auth.currentUser();
    if (!user) return { total: 0, terminees: 0, enCours: 0, assignees: 0, echecs: 0 };
    const now = new Date();
    return this.interventionSvc.getMonthlyStats(user.id, now.getFullYear(), now.getMonth());
  });

  last6Months = computed(() => {
    const user = this.auth.currentUser();
    if (!user) return [];
    return this.interventionSvc.getLast6MonthsStats(user.id);
  });

  maxMonthTotal = computed(() => {
    const months = this.last6Months();
    return Math.max(...months.map(m => m.total), 1);
  });

  myId = computed(() => this.auth.currentUser()?.id?.trim() ?? '');

  techRanking = computed(() => this.interventionSvc.getTechMonthlyStats());

  maxTerminees = computed(() =>
    Math.max(...this.techRanking().map(s => s.terminees), 1)
  );

  rankingMonthLabel = computed(() =>
    new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  );

  succesRate(stat: TechMonthlyStats): number {
    if (!stat.total) return 0;
    return Math.round((stat.terminees / stat.total) * 100);
  }

  barHeight(val: number, max: number): string {
    return `${Math.round((val / max) * 72)}px`;
  }

  statusClass(s: string): string {
    return s === 'Terminée' ? 'terminee' : s === 'En cours' ? 'en-cours' : s === 'Échec' ? 'echec' : 'assignee';
  }

  sevColor(p?: Intervention['priorite']): string {
    return p === 'Haute' ? '#e6483c' : p === 'Basse' ? '#6b84a8' : '#e2a33e';
  }

  pct(val: number, total: number): string {
    if (!total) return '0%';
    return `${Math.round((val / total) * 100)}%`;
  }
}
