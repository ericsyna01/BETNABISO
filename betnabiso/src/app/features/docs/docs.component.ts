import { Component, signal, computed, inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { AuthService } from '../../core/services/auth.service';

interface DocSection {
  id: string;
  icon: string;
  title: string;
  content: string;
  steps?: { icon: string; title: string; detail: string }[];
  tips?: string[];
  warnings?: string[];
  table?: { headers: string[]; rows: string[][] };
}

interface RoleDoc {
  role: string;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  description: string;
  sections: DocSection[];
}

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [
    CommonModule, MatTabsModule, MatCardModule, MatIconModule,
    MatButtonModule, MatExpansionModule, MatChipsModule,
    MatDividerModule, MatBadgeModule,
  ],
  template: `
<div class="docs-container">

  <!-- En-tête -->
  <div class="docs-hero">
    <div class="hero-content">
      <mat-icon class="hero-icon">menu_book</mat-icon>
      <div>
        <h1>Documentation</h1>
        <p>Guide d'utilisation détaillé par profil — BETNABISO</p>
      </div>
    </div>
    <div class="hero-meta">
      <span class="meta-chip"><mat-icon>people</mat-icon> 4 profils</span>
      <span class="meta-chip"><mat-icon>article</mat-icon> Guide complet</span>
      <span class="meta-chip"><mat-icon>new_releases</mat-icon> v2 — Juin 2026</span>
    </div>
  </div>

  <!-- Sélecteur de profil (mobile) -->
  <div class="role-pills-mobile">
    @for (doc of visibleRoleDocs(); track doc.role; let i = $index) {
      <button class="role-pill" [class.active]="activeTab === i"
              [style.color]="activeTab === i ? doc.color : ''"
              [style.background]="activeTab === i ? doc.bgColor : ''"
              (click)="activeTab = i">
        <mat-icon>{{ doc.icon }}</mat-icon>
        <span>{{ doc.label }}</span>
      </button>
    }
  </div>

  <!-- Tabs par rôle -->
  <mat-tab-group [(selectedIndex)]="activeTab" animationDuration="200ms" class="role-tabs">

    @for (doc of visibleRoleDocs(); track doc.role; let i = $index) {
      <mat-tab>
        <ng-template mat-tab-label>
          <div class="tab-label" [style.color]="activeTab === i ? doc.color : ''">
            <mat-icon>{{ doc.icon }}</mat-icon>
            <span>{{ doc.label }}</span>
          </div>
        </ng-template>

        <div class="doc-layout">

          <!-- Sidebar table des matières -->
          <nav class="toc-sidebar">
            <div class="toc-role-badge" [style.background]="doc.bgColor" [style.color]="doc.color">
              <mat-icon>{{ doc.icon }}</mat-icon>
              {{ doc.label }}
            </div>
            <ul class="toc-list">
              @for (s of doc.sections; track s.id) {
                <li>
                  <a class="toc-link" [class.active]="activeSection() === s.id"
                     (click)="scrollTo(s.id)">
                    <mat-icon>{{ s.icon }}</mat-icon>
                    {{ s.title }}
                  </a>
                </li>
              }
            </ul>
          </nav>

          <!-- Contenu principal -->
          <div class="doc-content" #contentArea>

            <!-- Carte de présentation du profil -->
            <div class="role-overview" [style.border-left-color]="doc.color">
              <div class="role-overview-header" [style.background]="doc.bgColor">
                <mat-icon [style.color]="doc.color" class="overview-icon">{{ doc.icon }}</mat-icon>
                <div>
                  <h2 [style.color]="doc.color">{{ doc.label }}</h2>
                  <p>{{ doc.description }}</p>
                </div>
              </div>
            </div>

            <!-- Sections -->
            @for (section of doc.sections; track section.id) {
              <section class="doc-section" [id]="section.id">

                <div class="section-header" [style.border-left-color]="doc.color">
                  <mat-icon [style.color]="doc.color">{{ section.icon }}</mat-icon>
                  <h3>{{ section.title }}</h3>
                </div>

                <p class="section-intro" [innerHTML]="section.content"></p>

                <!-- Étapes numérotées -->
                @if (section.steps && section.steps.length) {
                  <div class="steps-grid">
                    @for (step of section.steps; track step.title; let si = $index) {
                      <div class="step-card">
                        <div class="step-num" [style.background]="doc.color">{{ si + 1 }}</div>
                        <mat-icon class="step-icon">{{ step.icon }}</mat-icon>
                        <div class="step-body">
                          <strong>{{ step.title }}</strong>
                          <span>{{ step.detail }}</span>
                        </div>
                      </div>
                    }
                  </div>
                }

                <!-- Tableau -->
                @if (section.table) {
                  <div class="doc-table-wrap">
                    <table class="doc-table">
                      <thead>
                        <tr>
                          @for (h of section.table.headers; track h) {
                            <th>{{ h }}</th>
                          }
                        </tr>
                      </thead>
                      <tbody>
                        @for (row of section.table.rows; track $index) {
                          <tr>
                            @for (cell of row; track $index) {
                              <td [innerHTML]="cell"></td>
                            }
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }

                <!-- Conseils -->
                @if (section.tips && section.tips.length) {
                  <div class="tips-box">
                    <div class="tips-header"><mat-icon>lightbulb</mat-icon> Conseils</div>
                    <ul>
                      @for (tip of section.tips; track tip) {
                        <li [innerHTML]="tip"></li>
                      }
                    </ul>
                  </div>
                }

                <!-- Avertissements -->
                @if (section.warnings && section.warnings.length) {
                  <div class="warn-box">
                    <div class="warn-header"><mat-icon>warning</mat-icon> Important</div>
                    <ul>
                      @for (w of section.warnings; track w) {
                        <li [innerHTML]="w"></li>
                      }
                    </ul>
                  </div>
                }

              </section>
            }

          </div>
        </div>
      </mat-tab>
    }

  </mat-tab-group>
</div>
  `,
  styles: [`
    .docs-container { padding: 0; min-height: 100vh; background: #f5f7fa; }

    /* ── Hero ── */
    .docs-hero {
      background: linear-gradient(135deg, #000000 60%, #1a1409);
      padding: 28px 32px 24px;
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;
    }
    .hero-content { display: flex; align-items: center; gap: 16px; }
    .hero-icon { font-size: 44px; width: 44px; height: 44px; color: #d4af37; }
    .hero-content h1 { margin: 0; font-size: 26px; font-weight: 800; color: white; }
    .hero-content p { margin: 4px 0 0; color: #b3a88a; font-size: 14px; }
    .hero-meta { display: flex; gap: 10px; flex-wrap: wrap; }
    .meta-chip {
      display: inline-flex; align-items: center; gap: 5px;
      background: rgba(212,175,55,0.12); color: #f2e9d0;
      border-radius: 20px; padding: 5px 12px; font-size: 12px; font-weight: 500;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }

    /* ── Tabs ── */
    .role-tabs { background: transparent; }
    ::ng-deep .role-tabs .mat-mdc-tab-header { background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    ::ng-deep .role-tabs .mat-mdc-tab { min-width: 140px; }
    .tab-label { display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 13px; }
    .tab-label mat-icon { font-size: 18px; width: 18px; height: 18px; }

    /* ── Sélecteur de profil (mobile) ── */
    .role-pills-mobile { display: none; }
    .role-pill {
      display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;
      border: none; border-radius: 20px; padding: 8px 14px;
      font-size: 12.5px; font-weight: 600; color: #546e7a; background: #eef2f6;
      white-space: nowrap;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &.active { box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
    }

    /* ── Layout ── */
    .doc-layout { display: flex; gap: 0; min-height: calc(100vh - 180px); }

    /* ── TOC sidebar ── */
    .toc-sidebar {
      width: 220px; min-width: 220px;
      background: white; border-right: 1px solid #e0e6ed;
      padding: 20px 0; position: sticky; top: 0; height: fit-content;
      max-height: calc(100vh - 180px); overflow-y: auto;
    }
    .toc-role-badge {
      display: flex; align-items: center; gap: 8px;
      margin: 0 14px 16px; padding: 8px 12px;
      border-radius: 8px; font-size: 12px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.5px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .toc-list { list-style: none; margin: 0; padding: 0; }
    .toc-link {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 16px; cursor: pointer; font-size: 13px;
      color: #455a64; transition: all 0.15s; border-left: 3px solid transparent;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #90a4ae; flex-shrink: 0; }
      &:hover { background: #f5f7fa; color: #171310; }
      &.active { color: #171310; font-weight: 600; background: #fbf3d9; border-left-color: #d4af37; }
    }

    /* ── Doc content ── */
    .doc-content { flex: 1; padding: 28px 32px; overflow-y: auto; max-width: 860px; }

    /* Role overview card */
    .role-overview {
      border-left: 4px solid; border-radius: 8px; margin-bottom: 32px;
      overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    }
    .role-overview-header {
      display: flex; align-items: flex-start; gap: 16px; padding: 20px 24px;
    }
    .overview-icon { font-size: 36px; width: 36px; height: 36px; flex-shrink: 0; margin-top: 2px; }
    .role-overview-header h2 { margin: 0 0 6px; font-size: 20px; font-weight: 700; }
    .role-overview-header p { margin: 0; font-size: 14px; color: #37474f; line-height: 1.6; }

    /* Section */
    .doc-section { margin-bottom: 40px; scroll-margin-top: 20px; }
    .section-header {
      display: flex; align-items: center; gap: 10px;
      border-left: 4px solid; padding-left: 14px; margin-bottom: 14px;
      mat-icon { font-size: 22px; width: 22px; height: 22px; }
      h3 { margin: 0; font-size: 16px; font-weight: 700; color: #1a2035; }
    }
    .section-intro { color: #37474f; font-size: 14px; line-height: 1.7; margin: 0 0 16px; }

    /* Steps */
    .steps-grid { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
    .step-card {
      display: flex; align-items: flex-start; gap: 14px;
      background: white; border: 1px solid #e0e6ed; border-radius: 10px;
      padding: 14px 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.04);
    }
    .step-num {
      min-width: 28px; height: 28px; border-radius: 50%;
      color: white; font-weight: 800; font-size: 13px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .step-icon { color: #90a4ae; font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; margin-top: 2px; }
    .step-body { display: flex; flex-direction: column; gap: 2px;
      strong { font-size: 13px; color: #1a2035; }
      span { font-size: 12px; color: #6b7a99; line-height: 1.5; }
    }

    /* Table */
    .doc-table-wrap { overflow-x: auto; border-radius: 8px; margin-bottom: 16px; box-shadow: 0 1px 6px rgba(0,0,0,0.06); }
    .doc-table { width: 100%; border-collapse: collapse; font-size: 13px; background: white; }
    .doc-table thead tr { background: #171310; color: #f2e9d0; }
    .doc-table th { padding: 10px 14px; text-align: left; font-weight: 600; white-space: nowrap; }
    .doc-table tbody tr:nth-child(even) { background: #f8fafc; }
    .doc-table td { padding: 9px 14px; border-bottom: 1px solid #e0e6ed; color: #37474f; vertical-align: middle; }
    .doc-table tbody tr:hover { background: #fbf3d9; }

    /* Tips / Warnings */
    .tips-box, .warn-box {
      border-radius: 8px; padding: 14px 16px; margin-bottom: 16px;
      ul { margin: 8px 0 0 18px; padding: 0; }
      li { font-size: 13px; line-height: 1.6; margin-bottom: 4px; color: #37474f; }
    }
    .tips-box { background: #e8f5e9; border-left: 4px solid #4caf50; }
    .tips-header { display: flex; align-items: center; gap: 6px; font-weight: 700; color: #2e7d32; font-size: 13px;
      mat-icon { font-size: 17px; width: 17px; height: 17px; } }
    .warn-box { background: #fff8e1; border-left: 4px solid #ff9800; }
    .warn-header { display: flex; align-items: center; gap: 6px; font-weight: 700; color: #e65100; font-size: 13px;
      mat-icon { font-size: 17px; width: 17px; height: 17px; } }

    /* Chip inline */
    .chip-actif    { display:inline-block;padding:2px 8px;border-radius:12px;background:#e8f5e9;color:#2e7d32;font-weight:700;font-size:11px; }
    .chip-inactif  { display:inline-block;padding:2px 8px;border-radius:12px;background:#fce4ec;color:#c62828;font-weight:700;font-size:11px; }
    .chip-redepl   { display:inline-block;padding:2px 8px;border-radius:12px;background:#e3f2fd;color:#0277bd;font-weight:700;font-size:11px; }
    .chip-ared     { display:inline-block;padding:2px 8px;border-radius:12px;background:#fff3e0;color:#bf360c;font-weight:700;font-size:11px; }

    /* Keyboard shortcut keys */
    kbd {
      display: inline-block;
      padding: 2px 7px; border-radius: 4px;
      background: #e8ecf0; color: #1a2035;
      font-family: monospace; font-size: 12px; font-weight: 700;
      border: 1px solid #b0bec5; box-shadow: 0 1px 0 #90a4ae;
    }

    @media (max-width: 768px) {
      .docs-hero { padding: 16px; }
      .hero-content h1 { font-size: 20px; }
      .hero-content p { font-size: 12.5px; }
      .hero-meta { display: none; }
      .toc-sidebar { display: none; }
      ::ng-deep .role-tabs .mat-mdc-tab-header { display: none; }
      .role-pills-mobile {
        display: flex; gap: 8px; overflow-x: auto; -webkit-overflow-scrolling: touch;
        padding: 12px 16px; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      }
      .doc-content { padding: 16px; }
    }
  `]
})
export class DocsComponent {
  auth = inject(AuthService);
  activeTab = 0;
  activeSection = signal('');

  // Un utilisateur peut cumuler plusieurs rôles : on affiche la doc de
  // chacun d'eux, plus la section "Nouveautés" qui concerne tout le monde.
  visibleRoleDocs = computed(() => {
    const myRoles = this.auth.roles();
    return this.roleDocs.filter(d => d.role === 'nouveautes' || myRoles.includes(d.role as any));
  });

  scrollTo(id: string) {
    this.activeSection.set(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  readonly roleDocs: RoleDoc[] = [
    // ══════════════════════════════════════════════════════════════
    // NOUVEAUTÉS v2
    // ══════════════════════════════════════════════════════════════
    {
      role: 'nouveautes',
      label: 'Nouveautés v2',
      icon: 'new_releases',
      color: '#00695c',
      bgColor: '#e0f2f1',
      description: 'Cette section présente toutes les nouvelles fonctionnalités ajoutées à la plateforme BETNABISO v2 : interface améliorée, navigation clavier, vue Kanban, import CSV, export PDF réel, PWA et bien plus encore.',
      sections: [
        {
          id: 'nv-interface',
          icon: 'palette',
          title: 'Mode sombre & Thème',
          content: 'Un bouton de bascule du mode sombre est disponible dans la barre de navigation en haut à droite. La préférence est enregistrée dans le navigateur et restaurée automatiquement à la prochaine connexion.',
          steps: [
            { icon: 'dark_mode', title: 'Activer le mode sombre', detail: 'Barre de navigation → icône lune/soleil (à droite). Clic pour basculer entre mode clair et mode sombre.' },
            { icon: 'save', title: 'Mémorisation automatique', detail: 'Le choix est conservé dans le navigateur (localStorage). Pas besoin de le recocher à chaque connexion.' },
          ],
          tips: [
            'Le mode sombre réduit la fatigue oculaire lors des longues sessions de travail.',
            'Tous les composants — tableaux, dialogues, menus, badges — s\'adaptent automatiquement.',
          ]
        },
        {
          id: 'nv-search',
          icon: 'search',
          title: 'Recherche globale étendue',
          content: 'La barre de recherche globale (en-tête) couvre désormais <strong>agents, interventions et missions</strong>. Les résultats sont groupés par type avec un badge coloré (bleu = agent, orange = intervention, violet = mission).',
          steps: [
            { icon: 'search', title: 'Ouvrir la recherche', detail: 'Cliquer sur l\'icône loupe dans la barre de navigation ou utiliser le raccourci clavier /' },
            { icon: 'category', title: 'Résultats multi-types', detail: 'Les résultats affichent les agents (nom, zone), interventions (description, statut) et missions (titre, type) correspondant au terme saisi.' },
            { icon: 'open_in_new', title: 'Naviguer vers le résultat', detail: 'Cliquer sur un résultat pour accéder directement à la page concernée.' },
          ],
          tips: ['Taper au moins 2 caractères pour déclencher la recherche.']
        },
        {
          id: 'nv-keyboard',
          icon: 'keyboard',
          title: 'Raccourcis clavier',
          content: 'La plateforme supporte des raccourcis clavier de style Gmail pour naviguer rapidement entre les sections sans utiliser la souris.',
          table: {
            headers: ['Raccourci', 'Action'],
            rows: [
              ['<kbd>?</kbd> ou <kbd>/</kbd>', 'Afficher / masquer l\'aide des raccourcis'],
              ['<kbd>G</kbd> puis <kbd>D</kbd>', 'Aller au Tableau de bord'],
              ['<kbd>G</kbd> puis <kbd>A</kbd>', 'Aller aux Agents'],
              ['<kbd>G</kbd> puis <kbd>I</kbd>', 'Aller aux Interventions'],
              ['<kbd>G</kbd> puis <kbd>P</kbd>', 'Aller au Planning'],
              ['<kbd>G</kbd> puis <kbd>M</kbd>', 'Aller aux Missions'],
              ['<kbd>G</kbd> puis <kbd>S</kbd>', 'Aller au Support / Affectations'],
              ['<kbd>G</kbd> puis <kbd>R</kbd>', 'Aller au Rapport'],
              ['<kbd>Échap</kbd>', 'Fermer l\'aide des raccourcis'],
            ]
          },
          tips: [
            'Appuyer sur <strong>?</strong> depuis n\'importe quelle page pour voir tous les raccourcis disponibles.',
            'Les raccourcis sont désactivés quand le curseur est dans un champ de saisie (recherche, formulaire...).',
            'Le raccourci <strong>G</strong> ouvre une fenêtre de 1,5 seconde pendant laquelle taper la lettre de destination.',
          ]
        },
        {
          id: 'nv-pwa',
          icon: 'install_mobile',
          title: 'Application installable (PWA)',
          content: 'La plateforme BETNABISO peut être installée comme une application native sur votre ordinateur ou votre téléphone, sans passer par un store. Elle fonctionne hors ligne pour les données en cache.',
          steps: [
            { icon: 'language', title: 'Ouvrir dans Chrome / Edge', detail: 'Naviguer vers l\'URL de la plateforme dans Chrome ou Edge (iOS : Safari).' },
            { icon: 'install_desktop', title: 'Installer l\'application', detail: 'Chrome : icône d\'installation dans la barre d\'adresse (⬇ ou ⊕) → « Installer ». Sur mobile : menu → « Ajouter à l\'écran d\'accueil ».' },
            { icon: 'apps', title: 'Lancer depuis le bureau', detail: 'L\'icône BETNABISO apparaît sur le bureau ou l\'écran d\'accueil. L\'app s\'ouvre sans barre d\'adresse, comme une vraie application.' },
          ],
          tips: [
            'Sur mobile (chauffeur, technicien terrain), l\'installation PWA est vivement recommandée pour un accès rapide.',
            'Les données récentes sont mises en cache — consultables même sans connexion Internet.',
          ]
        },
        {
          id: 'nv-sidebar-badge',
          icon: 'notifications_active',
          title: 'Badge Interventions en attente',
          content: 'La barre latérale affiche désormais un <strong>badge rouge clignotant</strong> sur le menu « Interventions » indiquant le nombre d\'interventions au statut <em>Assignée</em> (attribuées à un technicien mais pas encore démarrées).',
          tips: [
            'Ce badge est visible pour les techniciens et les admins.',
            'Cliquer sur « Interventions » dans la barre latérale pour voir la liste filtrée par statut.',
            'Le badge disparaît quand toutes les interventions assignées sont démarrées ou clôturées.',
          ]
        },
        {
          id: 'nv-sorting',
          icon: 'sort',
          title: 'Tri par colonnes',
          content: 'Dans la liste des agents et la liste des interventions, il est possible de <strong>trier par colonne</strong> en cliquant sur l\'en-tête. Un second clic inverse l\'ordre (ASC → DESC → aucun tri).',
          table: {
            headers: ['Liste', 'Colonnes triables'],
            rows: [
              ['Agents', 'Nom agent, Nom responsable, Zone'],
              ['Interventions', 'Date, Priorité, Statut, Type, Agent'],
            ]
          },
          tips: [
            'Une icône ▲ / ▼ apparaît dans l\'en-tête de la colonne active.',
            'Le tri se cumule avec les filtres (recherche, statut, zone) déjà appliqués.',
          ]
        },
        {
          id: 'nv-date-filter',
          icon: 'date_range',
          title: 'Filtre par période (Interventions)',
          content: 'La liste des interventions dispose maintenant de deux champs de date — <strong>Du</strong> et <strong>Au</strong> — permettant de filtrer les interventions sur une période précise.',
          steps: [
            { icon: 'assignment', title: 'Ouvrir la liste des interventions', detail: 'Menu → « Toutes les interventions » ou « Mes interventions ».' },
            { icon: 'date_range', title: 'Définir la période', detail: 'Renseigner les champs « Du » et « Au » dans la barre de filtres. Le filtre s\'applique instantanément.' },
            { icon: 'filter_list_off', title: 'Réinitialiser', detail: 'Bouton « Réinitialiser filtres » → efface la période et tous les autres filtres.' },
          ],
          tips: [
            'Le filtre de période est cumulable avec la recherche texte, le statut et la priorité.',
            'Laisser un champ vide signifie « sans limite » de ce côté (ex : « Du » vide = depuis le début).',
          ]
        },
        {
          id: 'nv-kanban',
          icon: 'view_kanban',
          title: 'Vue Kanban des interventions',
          content: 'En plus de la vue tableau classique, les interventions peuvent être affichées en mode <strong>Kanban</strong> avec 4 colonnes correspondant aux statuts : En attente, Assignée, En cours, Terminée/Échec.',
          steps: [
            { icon: 'assignment', title: 'Aller aux interventions', detail: 'Menu → « Toutes les interventions ».' },
            { icon: 'view_kanban', title: 'Basculer en vue Kanban', detail: 'Bouton « Kanban » (icône tableau Kanban) en haut à droite de la liste. Cliquer à nouveau pour revenir à la vue liste.' },
            { icon: 'drag_indicator', title: 'Lire les cartes', detail: 'Chaque carte affiche : point de priorité coloré, type, agent concerné, zone, technicien assigné et date.' },
            { icon: 'play_arrow', title: 'Technicien : Prendre en charge', detail: 'En vue Kanban, un bouton « Prendre en charge » apparaît sur les cartes « En attente » pour les techniciens.' },
          ],
          tips: [
            'La vue Kanban est responsive : 4 colonnes sur écran large, 2 sur tablette, 1 sur mobile.',
            'Les cartes « Urgentes » affichent un point rouge vif pour les repérer immédiatement.',
          ]
        },
        {
          id: 'nv-chrono',
          icon: 'timer',
          title: 'Chronomètre sur les interventions en cours',
          content: 'Les interventions au statut <strong>« En cours »</strong> affichent désormais un badge chronomètre en temps réel indiquant la durée écoulée depuis le démarrage.',
          tips: [
            'Le chronomètre est visible dans la liste (badge orange) et dans les détails de l\'intervention.',
            'Il se met à jour chaque seconde automatiquement — pas besoin de recharger la page.',
            'Un temps anormalement long peut indiquer qu\'un technicien est bloqué et nécessite assistance.',
          ]
        },
        {
          id: 'nv-clone',
          icon: 'content_copy',
          title: 'Cloner une intervention',
          content: 'Il est maintenant possible de <strong>dupliquer</strong> une intervention existante en un clic. Utile pour recréer rapidement une intervention similaire à une précédente sans repartir de zéro.',
          steps: [
            { icon: 'assignment', title: 'Trouver l\'intervention à dupliquer', detail: 'Liste des interventions → repérer l\'intervention à copier.' },
            { icon: 'content_copy', title: 'Cliquer sur Cloner', detail: 'Icône de copie (content_copy) dans la ligne → une nouvelle intervention est créée avec les mêmes paramètres (agent, type, priorité, description) au statut « En attente ».' },
            { icon: 'edit', title: 'Ajuster si besoin', detail: 'Modifier la nouvelle intervention avant de l\'assigner si le problème présente des différences.' },
          ],
          tips: [
            'La date de la copie est la date du jour — pas celle de l\'intervention d\'origine.',
            'Le statut repart à « En attente » pour être réassigné.',
          ]
        },
        {
          id: 'nv-csv',
          icon: 'upload_file',
          title: 'Import CSV d\'agents',
          content: 'Les administrateurs et le Super Admin peuvent importer un lot d\'agents depuis un fichier CSV, évitant la saisie manuelle un par un.',
          steps: [
            { icon: 'people', title: 'Aller à la liste des agents', detail: 'Menu → « Agents ».' },
            { icon: 'upload_file', title: 'Cliquer sur « Importer CSV »', detail: 'Bouton en haut de la liste → dialogue d\'import CSV.' },
            { icon: 'drag_indicator', title: 'Glisser le fichier ou parcourir', detail: 'Glisser-déposer un fichier .csv dans la zone, ou cliquer « Choisir un fichier ». Séparateur accepté : <code>;</code> ou <code>,</code>.' },
            { icon: 'preview', title: 'Vérifier l\'aperçu', detail: 'Les 5 premières lignes s\'affichent dans un tableau de prévisualisation. Les erreurs de format sont signalées en rouge.' },
            { icon: 'check', title: 'Confirmer l\'import', detail: 'Bouton « Importer N agent(s) » → les agents sont ajoutés à la liste.' },
          ],
          table: {
            headers: ['Colonne CSV', 'Obligatoire', 'Description'],
            rows: [
              ['nomAgent', 'Oui', 'Nom complet de l\'agent'],
              ['identifiant', 'Non', 'Login sur l\'application de caisse'],
              ['zone', 'Oui', 'Zone géographique (ex : Zone 1)'],
              ['anydesk', 'Non', 'ID AnyDesk caisse'],
              ['anydesk_serveur', 'Non', 'ID AnyDesk serveur'],
              ['nomResponsable', 'Non', 'Nom du responsable'],
              ['numero', 'Non', 'Numéro de téléphone'],
            ]
          },
          warnings: [
            'La première ligne du fichier doit être la ligne d\'en-tête avec les noms de colonnes.',
            'Les colonnes <strong>nomAgent</strong> et <strong>zone</strong> sont obligatoires — l\'import est bloqué si elles manquent.',
          ]
        },
        {
          id: 'nv-pdf',
          icon: 'picture_as_pdf',
          title: 'Export PDF réel (jsPDF)',
          content: 'L\'export PDF génère désormais un <strong>vrai fichier PDF</strong> (A4 paysage) avec en-tête coloré BETNABISO, tableau de données formaté et pied de page numéroté. Plus de fenêtre d\'impression navigateur.',
          steps: [
            { icon: 'filter_list', title: 'Appliquer les filtres', detail: 'Agents ou interventions → filtrer les données à exporter (zone, statut, période...).' },
            { icon: 'picture_as_pdf', title: 'Cliquer sur « Export PDF »', detail: 'Bouton Export PDF → le fichier est généré et téléchargé automatiquement.' },
            { icon: 'folder_open', title: 'Ouvrir le PDF', detail: 'Le fichier apparaît dans les téléchargements du navigateur avec le nom et la date générés automatiquement.' },
          ],
          tips: [
            'Le PDF inclut la date de génération et le numéro de page dans le pied de page.',
            'Un rapport multi-sections (KPIs + tableau) est disponible depuis la page Historique & Rapports.',
          ]
        },
        {
          id: 'nv-planning',
          icon: 'event_busy',
          title: 'Détection de conflits Planning',
          content: 'Lors de l\'ajout d\'une entrée dans le Planning, la plateforme détecte automatiquement si un utilisateur est déjà affecté le même jour et affiche une <strong>alerte de conflit</strong> pour confirmation.',
          steps: [
            { icon: 'calendar_month', title: 'Créer un créneau', detail: 'Planning → cliquer sur un créneau → remplir le formulaire → « Enregistrer ».' },
            { icon: 'warning', title: 'Alerte de conflit', detail: 'Si la personne est déjà planifiée ce jour, une boîte de dialogue apparaît : « X est déjà affecté ce jour. Ajouter quand même ? »' },
            { icon: 'check', title: 'Confirmer ou annuler', detail: '« Ajouter quand même » pour forcer la double affectation, ou « Annuler » pour revenir au formulaire.' },
          ],
          tips: [
            'La détection de conflit s\'applique par date — plusieurs créneaux sur la même date sont signalés.',
            'La vue Planning est responsive : fonctionne correctement sur tablette et mobile.',
          ]
        },
        {
          id: 'nv-load',
          icon: 'bar_chart',
          title: 'Indicateur de charge technicien',
          content: 'Lors de l\'affectation d\'une intervention à un technicien, un <strong>indicateur de charge visuel</strong> affiche le nombre d\'interventions en cours, une barre de progression et un avertissement de surcharge.',
          table: {
            headers: ['Charge', 'Couleur barre', 'Message affiché'],
            rows: [
              ['0–3 interventions', '● Vert', 'Charge normale'],
              ['4–5 interventions', '● Orange', 'Charge élevée'],
              ['6+ interventions', '● Rouge', 'Technicien surchargé — préférer un autre technicien'],
            ]
          },
          tips: [
            'L\'indicateur est visible dans la boîte de dialogue « Affecter technicien ».',
            'Privilégier les techniciens dont la barre est verte pour une répartition équitable de la charge.',
          ]
        },
      ]
    },

    // ══════════════════════════════════════════════════════════════
    // SUPER ADMINISTRATEUR
    // ══════════════════════════════════════════════════════════════
    {
      role: 'superadmin',
      label: 'Super Administrateur',
      icon: 'admin_panel_settings',
      color: '#4527a0',
      bgColor: '#ede7f6',
      description: 'Le Super Administrateur dispose d\'un accès complet et illimité à toutes les fonctionnalités de la plateforme, sur l\'ensemble des 22 zones géographiques. Il gère les utilisateurs, les agents, les interventions et la configuration globale du système.',
      sections: [
        {
          id: 'sa-connexion',
          icon: 'login',
          title: 'Connexion & Navigation',
          content: 'Accédez à la plateforme via votre navigateur. Saisissez vos identifiants (login + mot de passe) sur la page de connexion. Après authentification, vous arrivez directement sur le <strong>Tableau de bord global</strong> qui affiche une vue consolidée de l\'ensemble des zones.',
          steps: [
            { icon: 'language', title: 'Ouvrir le navigateur', detail: 'Utiliser Chrome ou Firefox. L\'URL vous est communiquée par votre administrateur système.' },
            { icon: 'person', title: 'Saisir les identifiants', detail: 'Entrer votre login et mot de passe Super Admin. Les champs sont sensibles à la casse.' },
            { icon: 'lock_open', title: 'Valider', detail: 'Cliquer sur « Se connecter ». Vous êtes redirigé vers le tableau de bord global.' },
            { icon: 'menu', title: 'Barre latérale complète', detail: 'Toutes les rubriques du menu sont visibles : Agents, Interventions, Support, Historique, Administration, Audit, Carte...' },
          ],
          tips: [
            'La session reste active jusqu\'à déconnexion manuelle — pensez à vous déconnecter sur poste partagé.',
            'Le badge vert sur « Missions » dans le menu indique le nombre de missions en attente.',
          ]
        },
        {
          id: 'sa-dashboard',
          icon: 'dashboard',
          title: 'Tableau de bord',
          content: 'Le tableau de bord Super Admin affiche les statistiques <strong>globales</strong> de toutes les zones : nombre total d\'agents, actifs/inactifs, interventions en cours, répartition par statut, classement mensuel des techniciens et graphiques de performance.',
          table: {
            headers: ['Bloc', 'Contenu', 'Utilité'],
            rows: [
              ['Compteurs KPI', 'Total agents, Actifs, Interventions du jour', 'Vue instantanée de l\'activité globale'],
              ['Répartition statuts', 'Barres Actif / Inactif / À redéployer / Redéployé', 'Détecter les agents en situation critique'],
              ['Classement techniciens', 'Top 5 par nombre d\'interventions terminées', 'Identifier les techniciens les plus productifs'],
              ['Graphique mensuel', 'Évolution des interventions par mois', 'Tendances et pics d\'activité'],
              ['Interventions récentes', 'Liste des 5 dernières interventions', 'Suivi immédiat sans quitter le dashboard'],
            ]
          },
          tips: [
            'Cliquer sur un statut dans les barres pour accéder directement à la liste filtrée.',
            'Les données se rafraîchissent automatiquement via SSE — pas besoin de recharger la page.',
          ]
        },
        {
          id: 'sa-agents',
          icon: 'people',
          title: 'Gestion des Agents',
          content: 'En tant que Super Admin, vous gérez la <strong>totalité des 375 agents</strong> répartis sur 20 zones. Vous pouvez créer, modifier, supprimer un agent, changer son statut et effectuer des redéploiements inter-zones.',
          steps: [
            { icon: 'list', title: 'Accéder à la liste', detail: 'Menu latéral → « Agents ». La liste est triée par priorité : Actif → Inactif → À redéployer → Redéployé.' },
            { icon: 'search', title: 'Rechercher', detail: 'Barre de recherche : saisir nom, code (2020XXX), responsable, numéro AnyDesk ou téléphone. Résultats en temps réel.' },
            { icon: 'filter_list', title: 'Filtrer par zone / statut', detail: 'Menus déroulants « Zone » et « Statut » pour affiner la liste. Cumulables avec la recherche texte.' },
            { icon: 'add', title: 'Créer un agent', detail: 'Bouton « + Nouvel Agent » → remplir le formulaire (nom, responsable, zone, AnyDesk…).' },
            { icon: 'edit', title: 'Modifier un agent', detail: 'Clic sur l\'icône crayon dans la ligne → formulaire pré-rempli → modifier → « Enregistrer ».' },
            { icon: 'delete', title: 'Supprimer un agent', detail: 'Icône corbeille → confirmation obligatoire. Action irréversible.' },
          ],
          table: {
            headers: ['Statut', 'Couleur ligne', 'Action recommandée'],
            rows: [
              ['<span class="chip-actif">Actif</span>', 'Blanc (défaut)', 'Aucune action requise'],
              ['<span class="chip-inactif">Inactif</span>', 'Fond rouge pâle + bordure rouge', 'Vérifier la situation — démission ou absence prolongée'],
              ['<span class="chip-ared">À redéployer</span>', 'Fond orange + bordure orange', 'Initier un redéploiement vers une zone disponible'],
              ['<span class="chip-redepl">Redéployé</span>', 'Fond bleu + bordure bleue', 'Vérifier que la prise de poste est effective'],
            ]
          },
          warnings: [
            'La suppression d\'un agent est <strong>définitive</strong> et ne peut pas être annulée.',
            'Changer le statut vers « Redéployé » ouvre automatiquement la boîte de dialogue de sélection de la destination.',
          ]
        },
        {
          id: 'sa-redeploiement',
          icon: 'swap_horiz',
          title: 'Redéploiement d\'Agents',
          content: 'Le redéploiement permet de transférer officiellement un agent <span class="chip-ared">À redéployer</span> vers un autre poste. La plateforme trace automatiquement la destination dans le champ « Redéployé vers ».',
          steps: [
            { icon: 'filter_list', title: 'Filtrer les agents « À redéployer »', detail: 'Filtre Statut → « À redéployer » pour isoler les 54 agents concernés.' },
            { icon: 'more_vert', title: 'Ouvrir le menu de l\'agent', detail: 'Clic sur ⋮ à droite de la ligne → « Redéployer ».' },
            { icon: 'search', title: 'Rechercher la destination', detail: 'Taper le nom ou la zone cible dans la boîte de dialogue autocomplete.' },
            { icon: 'check_circle', title: 'Confirmer', detail: 'Sélectionner l\'agent cible → « Redéployer ». Le statut passe à Redéployé et la destination est enregistrée.' },
          ],
          tips: [
            'La recherche dans la boîte de dialogue filtre par nom ET par zone simultanément.',
            'Après redéploiement, l\'agent source passe en <span class="chip-redepl">Redéployé</span> avec le nom de la destination visible au survol.',
          ]
        },
        {
          id: 'sa-interventions',
          icon: 'build',
          title: 'Toutes les Interventions',
          content: 'Le Super Admin accède à <strong>toutes les interventions</strong> de toutes les zones, peu importe le technicien ou la zone. Il peut créer, modifier, réassigner ou clôturer n\'importe quelle intervention.',
          steps: [
            { icon: 'assignment', title: 'Liste des interventions', detail: 'Menu → « Toutes les interventions ». Filtres disponibles : statut, technicien, période, priorité.' },
            { icon: 'add_circle', title: 'Créer une intervention', detail: '« + Nouvelle intervention » → choisir l\'agent, le type, la priorité (Basse/Normale/Haute/Urgente) et une description.' },
            { icon: 'person_add', title: 'Assigner un technicien', detail: 'Dans le formulaire ou depuis la liste → champ autocomplete pour trouver le technicien.' },
            { icon: 'done_all', title: 'Clôturer', detail: 'Mettre le statut à « Terminée » ou « Échec » avec une note de résolution.' },
          ],
          table: {
            headers: ['Priorité', 'Délai conseillé', 'Couleur'],
            rows: [
              ['Urgente', 'Traitement immédiat (< 1h)', '<strong style="color:#c62828">●</strong> Rouge'],
              ['Haute', 'Traitement dans la journée', '<strong style="color:#ff9800">●</strong> Orange'],
              ['Normale', 'Traitement sous 48h', '<strong style="color:#2196f3">●</strong> Bleu'],
              ['Basse', 'Planifier selon disponibilité', '<strong style="color:#9e9e9e">●</strong> Gris'],
            ]
          }
        },
        {
          id: 'sa-users',
          icon: 'manage_accounts',
          title: 'Gestion des Utilisateurs',
          content: 'Seul le Super Admin peut créer, modifier et supprimer des comptes utilisateurs. Accès via <strong>Administration → Utilisateurs</strong>.',
          steps: [
            { icon: 'admin_panel_settings', title: 'Accéder à l\'administration', detail: 'Menu → « Administration » → onglet « Utilisateurs ».' },
            { icon: 'person_add', title: 'Créer un compte', detail: 'Bouton « + Nouvel utilisateur » → saisir login, mot de passe, rôle et zone (pour les admins).' },
            { icon: 'edit', title: 'Modifier un compte', detail: 'Clic sur l\'icône crayon → changer le rôle, la zone ou réinitialiser le mot de passe.' },
            { icon: 'block', title: 'Désactiver / Supprimer', detail: 'Supprimer le compte si l\'utilisateur quitte la structure. Irréversible.' },
          ],
          table: {
            headers: ['Rôle', 'Restriction zone', 'Droits principaux'],
            rows: [
              ['superadmin', 'Aucune — accès global', 'Tout créer / modifier / supprimer'],
              ['admin', 'Oui — sa zone uniquement', 'Agents + interventions de sa zone'],
              ['support', 'Non', 'Créer interventions, affecter techniciens, chat'],
              ['technicien', 'Non', 'Voir et traiter ses propres interventions'],
              ['chauffeur', 'Non', 'Ses missions de livraison uniquement'],
            ]
          },
          warnings: [
            'Ne jamais partager vos identifiants Super Admin. En cas de compromission, changer immédiatement le mot de passe.',
          ]
        },
        {
          id: 'sa-audit',
          icon: 'security',
          title: 'Journal d\'Audit',
          content: 'Le journal d\'audit enregistre toutes les actions critiques effectuées sur la plateforme : connexions, modifications d\'agents, créations d\'interventions, suppressions... Accessible via <strong>Menu → Journal d\'audit</strong>.',
          tips: [
            'Filtrer par utilisateur ou par type d\'action pour cibler une investigation.',
            'L\'horodatage de chaque action est conservé pour traçabilité.',
            'Les exports CSV du journal permettent une analyse externe (Excel, BI...).',
          ]
        },
        {
          id: 'sa-csv-import',
          icon: 'upload_file',
          title: 'Import CSV d\'agents',
          content: 'Le Super Admin peut importer un lot d\'agents en masse depuis un fichier CSV. Voir la section <strong>Nouveautés → Import CSV d\'agents</strong> pour le détail du format et de la procédure.',
          steps: [
            { icon: 'people', title: 'Aller à la liste des agents', detail: 'Menu → « Agents ».' },
            { icon: 'upload_file', title: 'Cliquer sur « Importer CSV »', detail: 'Bouton en haut de liste → dialogue drag & drop → prévisualisation → confirmer.' },
          ]
        },
        {
          id: 'sa-export',
          icon: 'download',
          title: 'Export & Rapports',
          content: 'Générez des exports PDF réels (A4 paysage, en-tête coloré, tableau formaté) et CSV depuis la liste des agents ou l\'historique des interventions.',
          steps: [
            { icon: 'people', title: 'Export agents', detail: 'Agents → appliquer les filtres souhaités → bouton « Export PDF » (fichier téléchargé directement) ou « Export CSV ».' },
            { icon: 'history', title: 'Export interventions', detail: 'Historique → filtrer par période → « Exporter ». Le PDF inclut date et numérotation de pages.' },
            { icon: 'assessment', title: 'Rapport productivité', detail: 'Menu → « Rapport productivité » (Super Admin uniquement) → vue mensuelle par technicien avec export PDF multi-sections.' },
          ],
          tips: [
            'Appliquer les filtres voulus avant d\'exporter — seules les données affichées sont incluses dans le PDF.',
          ]
        },
      ]
    },

    // ══════════════════════════════════════════════════════════════
    // ADMINISTRATEUR DE ZONE
    // ══════════════════════════════════════════════════════════════
    {
      role: 'admin',
      label: 'Admin de Zone',
      icon: 'location_city',
      color: '#0d47a1',
      bgColor: '#e3f2fd',
      description: 'L\'Administrateur de Zone gère les agents et les interventions de sa zone géographique uniquement. Il supervise son équipe locale, suit les interventions et coordonne les techniciens de sa zone.',
      sections: [
        {
          id: 'az-connexion',
          icon: 'login',
          title: 'Connexion & Vue de Zone',
          content: 'Après connexion, vous arrivez sur le tableau de bord filtré sur <strong>votre zone uniquement</strong>. Toutes les données (agents, interventions, statistiques) sont automatiquement limitées à votre périmètre géographique.',
          steps: [
            { icon: 'login', title: 'Se connecter', detail: 'Saisir login + mot de passe Admin sur la page de connexion.' },
            { icon: 'location_on', title: 'Vue filtrée automatiquement', detail: 'Le système détecte votre zone d\'affectation et n\'affiche que les données correspondantes.' },
            { icon: 'dashboard', title: 'Tableau de bord de zone', detail: 'KPIs, interventions et agents filtrés sur votre zone. Aucune donnée des autres zones n\'est visible.' },
          ],
          tips: [
            'Si votre zone n\'est pas correcte, contacter le Super Administrateur pour vérifier votre affectation.',
          ]
        },
        {
          id: 'az-agents',
          icon: 'people',
          title: 'Agents de ma Zone',
          content: 'Vous gérez uniquement les agents de votre zone. La liste affiche automatiquement vos agents, triés par statut de priorité.',
          steps: [
            { icon: 'list', title: 'Consulter la liste', detail: 'Menu → « Agents ». Seuls les agents de votre zone sont affichés. Le filtre Zone est verrouillé.' },
            { icon: 'search', title: 'Rechercher un agent', detail: 'Par nom, code, responsable, AnyDesk ou numéro de téléphone.' },
            { icon: 'add', title: 'Ajouter un agent', detail: '« + Nouvel Agent » → le champ Zone est pré-rempli avec votre zone et non modifiable.' },
            { icon: 'edit', title: 'Modifier un agent', detail: 'Icône crayon → modifier les informations (identifiant, AnyDesk, statut...).' },
            { icon: 'swap_horiz', title: 'Changer le statut', detail: 'Menu ⋮ → choisir le nouveau statut. Pour « Redéployé », sélectionner l\'agent de destination.' },
          ],
          warnings: [
            'Vous ne pouvez pas <strong>supprimer</strong> un agent — cette action est réservée au Super Admin.',
            'Vous ne pouvez pas modifier la <strong>zone</strong> d\'un agent — un redéploiement inter-zones doit être demandé au Super Admin.',
          ]
        },
        {
          id: 'az-interventions',
          icon: 'build',
          title: 'Interventions de ma Zone',
          content: 'Vous suivez toutes les interventions créées sur votre zone. Vous pouvez créer des interventions, les assigner à vos techniciens et consulter l\'historique.',
          steps: [
            { icon: 'assignment', title: 'Liste des interventions', detail: 'Menu → « Toutes les interventions ». Liste filtrée automatiquement sur votre zone.' },
            { icon: 'add_circle', title: 'Créer une intervention', detail: '« + Nouvelle » → choisir l\'agent concerné (dans votre zone), type, priorité, description.' },
            { icon: 'person_add', title: 'Assigner à un technicien', detail: 'Champ autocomplete → taper le nom du technicien → sélectionner. L\'intervention passe en « Assignée ».' },
            { icon: 'history', title: 'Consulter l\'historique', detail: 'Menu → « Historique » → filtrer par période ou technicien.' },
          ],
          table: {
            headers: ['Statut intervention', 'Signification', 'Action possible'],
            rows: [
              ['En attente', 'Créée, pas encore assignée', 'Assigner un technicien'],
              ['Assignée', 'Technicien désigné, pas démarré', 'Relancer le technicien si nécessaire'],
              ['En cours', 'Technicien en train de traiter', 'Suivre la progression'],
              ['Terminée', 'Résolue avec succès', 'Consulter le rapport de résolution'],
              ['Échec', 'Non résolue', 'Créer une nouvelle intervention ou escalader'],
            ]
          }
        },
        {
          id: 'az-planning',
          icon: 'calendar_month',
          title: 'Planning & Rotation',
          content: 'Le module Planning vous permet de visualiser et gérer les plannings de présence des agents et techniciens de votre zone. La vue est <strong>responsive</strong> (fonctionne sur mobile).',
          steps: [
            { icon: 'calendar_month', title: 'Accéder au planning', detail: 'Menu → « Planning & Rotation ».' },
            { icon: 'add', title: 'Créer un créneau', detail: 'Cliquer sur une case horaire → renseigner l\'agent/technicien et le type de créneau.' },
            { icon: 'event_busy', title: 'Alerte de conflit', detail: 'Si la personne est déjà planifiée ce jour, une boîte de dialogue de confirmation s\'affiche avant l\'enregistrement.' },
            { icon: 'swap_horiz', title: 'Gérer les rotations', detail: 'Vue hebdomadaire pour équilibrer la charge entre techniciens.' },
          ],
          tips: [
            'La détection de conflit est automatique — elle compare la date et la personne avant d\'enregistrer.',
          ]
        },
        {
          id: 'az-export',
          icon: 'download',
          title: 'Exports',
          content: 'Exportez les données de votre zone pour vos rapports internes.',
          steps: [
            { icon: 'people', title: 'Export agents de ma zone', detail: 'Agents → les données exportées (PDF/CSV) contiennent uniquement votre zone.' },
            { icon: 'history', title: 'Export historique', detail: 'Historique → filtrer → exporter la période souhaitée.' },
          ]
        },
      ]
    },

    // ══════════════════════════════════════════════════════════════
    // TECHNICIEN
    // ══════════════════════════════════════════════════════════════
    {
      role: 'technicien',
      label: 'Technicien',
      icon: 'engineering',
      color: '#00695c',
      bgColor: '#e0f2f1',
      description: 'Le Technicien reçoit les interventions qui lui sont assignées, les traite et met à jour leur statut. Il peut consulter les fiches agents pour les informations de connexion à distance (AnyDesk, TeamViewer) et communiquer via le chat de support.',
      sections: [
        {
          id: 'tech-connexion',
          icon: 'login',
          title: 'Connexion & Mes Interventions',
          content: 'Après connexion, vous accédez directement à vos interventions assignées. Votre menu est simplifié : Tableau de bord, Mes interventions, Nouvelle intervention, Planning, Missions.',
          steps: [
            { icon: 'login', title: 'Se connecter', detail: 'Saisir login technicien + mot de passe.' },
            { icon: 'dashboard', title: 'Tableau de bord personnel', detail: 'KPIs de vos propres interventions : en cours, terminées ce mois, taux de résolution.' },
            { icon: 'notifications', title: 'Activer les notifications', detail: 'Accepter la demande de notification navigateur pour être alerté quand une intervention vous est assignée.' },
          ]
        },
        {
          id: 'tech-interventions',
          icon: 'assignment',
          title: 'Traiter mes Interventions',
          content: 'Voici le cycle de vie complet d\'une intervention côté technicien : de la réception à la clôture. La liste propose une vue <strong>tableau</strong> et une vue <strong>Kanban</strong> (bouton de bascule en haut à droite).',
          steps: [
            { icon: 'notification_important', title: 'Recevoir une notification', detail: 'Une alerte navigateur + badge rouge clignotant dans le menu « Interventions » vous prévient qu\'une intervention vous est assignée.' },
            { icon: 'assignment', title: 'Consulter l\'intervention', detail: 'Menu → « Mes interventions » → cliquer sur l\'intervention pour voir les détails (agent, type, description, priorité). En vue Kanban, les cartes « En attente » affichent un bouton « Prendre en charge ».' },
            { icon: 'people', title: 'Identifier l\'agent', detail: 'Voir la fiche de l\'agent concerné : nom, téléphone, AnyDesk caisse, AnyDesk serveur, TeamViewer.' },
            { icon: 'play_arrow', title: 'Démarrer l\'intervention', detail: 'Bouton « Démarrer » → le statut passe à « En cours ». Un badge chronomètre s\'affiche en temps réel sur la ligne.' },
            { icon: 'computer', title: 'Intervenir à distance', detail: 'Utiliser l\'ID AnyDesk ou TeamViewer indiqué sur la fiche agent pour établir la connexion.' },
            { icon: 'done', title: 'Clôturer', detail: 'Bouton « Terminer » → ajouter une note de résolution → statut « Terminée ». Ou « Échec » si non résolu.' },
          ],
          tips: [
            'L\'AnyDesk Caisse et l\'AnyDesk Serveur sont distincts — vérifier lequel est concerné avant de vous connecter.',
            'Rédiger une note de résolution claire aide l\'historique et le Super Admin à analyser les incidents récurrents.',
            'Pour les interventions urgentes, traiter en priorité même si d\'autres sont en attente.',
            'Utilisez le filtre « Du / Au » pour retrouver rapidement des interventions sur une période précise.',
            'Le bouton Cloner (icône copie) permet de dupliquer une intervention pour un problème récurrent similaire.',
          ],
          warnings: [
            'Ne jamais clôturer une intervention « Terminée » sans s\'être assuré que le problème est réellement résolu.',
            'En cas d\'échec, expliquer précisément la raison pour faciliter la reprise par un autre technicien.',
          ]
        },
        {
          id: 'tech-agents',
          icon: 'people',
          title: 'Consulter les Fiches Agents',
          content: 'Vous pouvez consulter la liste des agents pour accéder aux informations de connexion à distance nécessaires à votre travail. Vous ne pouvez pas modifier les fiches agents.',
          table: {
            headers: ['Champ', 'Usage technicien'],
            rows: [
              ['AnyDesk Caisse', 'ID pour connexion remote sur le poste de caisse'],
              ['AnyDesk Serveur', 'ID pour connexion remote sur le serveur du point de vente'],
              ['TeamViewer Caisse', 'Alternative à AnyDesk pour la caisse'],
              ['TeamViewer Serveur', 'Alternative à AnyDesk pour le serveur'],
              ['Numéro téléphone', 'Contact direct de l\'agent pour coordination vocale'],
              ['Identifiant', 'Login de l\'agent sur l\'application de caisse'],
            ]
          },
          tips: [
            'Utiliser la barre de recherche pour retrouver rapidement un agent par son ID AnyDesk.',
            'Si l\'agent n\'est pas joignable, vérifier le numéro de téléphone du responsable sur sa fiche.',
          ]
        },
        {
          id: 'tech-nouvelle',
          icon: 'add_circle',
          title: 'Créer une Intervention',
          content: 'En dehors des interventions assignées, vous pouvez créer vous-même une intervention si vous constatez un problème lors d\'une connexion.',
          steps: [
            { icon: 'add_circle', title: 'Nouvelle intervention', detail: 'Menu → « Nouvelle intervention ».' },
            { icon: 'search', title: 'Sélectionner l\'agent', detail: 'Rechercher l\'agent concerné dans le champ autocomplete.' },
            { icon: 'category', title: 'Choisir le type', detail: 'Sélectionner parmi : Problème réseau, Panne matérielle, Logiciel, Récupération données, Formation, Autre.' },
            { icon: 'priority_high', title: 'Définir la priorité', detail: 'Basse / Normale / Haute / Urgente selon l\'impact sur l\'activité.' },
            { icon: 'description', title: 'Décrire le problème', detail: 'Saisir une description précise du problème observé.' },
            { icon: 'send', title: 'Soumettre', detail: 'Cliquer « Créer ». L\'intervention vous est auto-assignée.' },
          ]
        },
        {
          id: 'tech-planning',
          icon: 'calendar_month',
          title: 'Planning & Missions',
          content: 'Consultez votre planning de présence et vos missions assignées.',
          steps: [
            { icon: 'calendar_month', title: 'Voir mon planning', detail: 'Menu → « Planning & Rotation » → vue de votre calendrier personnel.' },
            { icon: 'assignment_ind', title: 'Mes missions', detail: 'Menu → « Missions internes » → liste des missions de livraison ou de terrain qui vous sont attribuées.' },
          ]
        },
      ]
    },

    // ══════════════════════════════════════════════════════════════
    // SUPPORT
    // ══════════════════════════════════════════════════════════════
    {
      role: 'support',
      label: 'Support',
      icon: 'headset_mic',
      color: '#e65100',
      bgColor: '#fff3e0',
      description: 'Le profil Support gère les demandes d\'assistance en temps réel. Il crée et affecte les interventions aux techniciens disponibles, communique avec les agents via le chat intégré et assure le premier niveau de réponse aux incidents.',
      sections: [
        {
          id: 'sup-connexion',
          icon: 'login',
          title: 'Connexion & Interface Support',
          content: 'Le menu Support inclut : Tableau de bord, Agents, Affectations, Affecter, Planning et Missions. L\'interface est centrée sur la réactivité et la communication.',
          steps: [
            { icon: 'login', title: 'Se connecter', detail: 'Login + mot de passe Support sur la page de connexion.' },
            { icon: 'notifications_active', title: 'Activer les notifications', detail: 'Autoriser les notifications navigateur pour recevoir les alertes en temps réel.' },
            { icon: 'headset_mic', title: 'Interface Support', detail: 'Menu → « Affectations » pour voir les demandes entrantes. Menu → « Chat » pour la messagerie.' },
          ]
        },
        {
          id: 'sup-affecter',
          icon: 'add_task',
          title: 'Créer & Affecter une Intervention',
          content: 'La principale mission du Support est de créer rapidement une intervention dès réception d\'un appel ou d\'un message agent, puis de l\'affecter au technicien le plus adapté.',
          steps: [
            { icon: 'phone', title: 'Réception de la demande', detail: 'L\'agent vous contacte (téléphone, chat, mail). Collecter : identité de l\'agent, nature du problème, urgence.' },
            { icon: 'search', title: 'Trouver la fiche agent', detail: 'Menu → « Agents » → rechercher par nom, code ou AnyDesk. Vérifier le statut (doit être Actif).' },
            { icon: 'add_task', title: 'Créer l\'intervention', detail: 'Menu → « Affecter » → sélectionner l\'agent dans l\'autocomplete → type, priorité, description.' },
            { icon: 'person_search', title: 'Choisir le technicien', detail: 'Champ autocomplete → taper le nom ou la zone → sélectionner le technicien disponible. Un indicateur de charge (barre verte / orange / rouge) indique sa charge actuelle.' },
            { icon: 'send', title: 'Affecter', detail: 'Valider → le technicien reçoit une notification immédiate. L\'intervention passe en « Assignée » et un badge apparaît dans son menu.' },
            { icon: 'track_changes', title: 'Suivre l\'avancement', detail: 'Menu → « Affectations » → surveiller le statut en temps réel.' },
          ],
          tips: [
            'Prioriser les interventions <strong>Urgentes</strong> — les affecter immédiatement sans attendre.',
            'Indiquer dans la description : le symptôme exact, l\'heure du début, si l\'agent a déjà essayé de redémarrer.',
          ]
        },
        {
          id: 'sup-chat',
          icon: 'chat',
          title: 'Chat de Support',
          content: 'Le chat permet de communiquer directement avec les agents pour diagnostiquer un problème avant de créer une intervention, ou pour les guider pendant l\'intervention.',
          steps: [
            { icon: 'headset_mic', title: 'Accéder au chat', detail: 'Icône chat dans la barre de navigation ou depuis la fiche agent → bouton « Contacter ».' },
            { icon: 'search', title: 'Trouver l\'agent', detail: 'Barre de recherche du chat → taper nom ou zone. Résultats filtrés en temps réel.' },
            { icon: 'chat_bubble', title: 'Envoyer un message', detail: 'Zone de texte → écrire le message → Entrée ou bouton Envoyer. L\'agent reçoit une notification.' },
            { icon: 'attach_file', title: 'Joindre un fichier', detail: 'Icône trombone → sélectionner une image ou un PDF (capture d\'écran d\'erreur, document de procédure...).' },
            { icon: 'image', title: 'Partager une capture', detail: 'Coller directement une capture d\'écran dans le chat (Ctrl+V) pour montrer une procédure ou un message d\'erreur.' },
          ],
          tips: [
            'Garder le chat ouvert en arrière-plan — une pastille rouge indique les messages non lus.',
            'Joindre des captures d\'écran des étapes de résolution pour que l\'agent puisse les suivre.',
            'Le chat est archivé : relire les échanges précédents avec un agent pour mieux comprendre les incidents récurrents.',
          ],
          warnings: [
            'Ne pas partager de mots de passe dans le chat — utiliser uniquement les canaux sécurisés pour ce type d\'information.',
          ]
        },
        {
          id: 'sup-suivi',
          icon: 'track_changes',
          title: 'Suivi des Affectations',
          content: 'Depuis le menu « Affectations », vous suivez en temps réel l\'état de toutes les interventions que vous avez créées ou affectées.',
          table: {
            headers: ['Statut', 'Action Support recommandée'],
            rows: [
              ['En attente', 'Affecter un technicien sans délai'],
              ['Assignée > 30 min', 'Relancer le technicien par téléphone ou chat'],
              ['En cours > 2h (Urgente)', 'Escalader vers l\'Admin ou créer une 2e intervention'],
              ['Échec', 'Analyser la cause, créer une nouvelle intervention ou escalader'],
              ['Terminée', 'Confirmer avec l\'agent que le problème est bien résolu'],
            ]
          },
          tips: [
            'Filtrer par « En attente » pour s\'assurer qu\'aucune intervention ne reste non assignée.',
            'Contacter l\'agent après clôture pour vérifier sa satisfaction — cela réduit les récidives.',
          ]
        },
        {
          id: 'sup-agents',
          icon: 'people',
          title: 'Accès aux Fiches Agents',
          content: 'Le profil Support peut consulter toutes les fiches agents pour les informations de contact et d\'accès à distance. Il peut également créer de nouveaux agents.',
          steps: [
            { icon: 'list', title: 'Liste des agents', detail: 'Menu → « Agents » → vue complète de tous les agents (toutes zones).' },
            { icon: 'person', title: 'Fiche détaillée', detail: 'Cliquer sur un agent → voir AnyDesk, TeamViewer, numéro, identifiant, statut.' },
            { icon: 'add', title: 'Créer un agent', detail: 'Le Support peut enregistrer un nouvel agent si nécessaire.' },
          ],
          warnings: [
            'Le Support ne peut pas <strong>supprimer</strong> un agent ni modifier les zones — contacter un Admin ou Super Admin.',
          ]
        },
      ]
    },
    // ══════════════════════════════════════════════════════════════
    // CHAUFFEUR
    // ══════════════════════════════════════════════════════════════
    {
      role: 'chauffeur',
      label: 'Chauffeur',
      icon: 'local_shipping',
      color: '#f57f17',
      bgColor: '#fff8e1',
      description: 'Le Chauffeur est chargé du transport des techniciens sur le terrain. Il consulte ses missions de transport assignées, gère leur cycle de vie (démarrer / terminer) et peut naviguer vers la destination via Google Maps directement depuis la plateforme.',
      sections: [
        {
          id: 'ch-connexion',
          icon: 'login',
          title: 'Connexion & Interface',
          content: 'Après connexion, le chauffeur accède à une interface épurée centrée sur ses missions de transport. Le menu latéral affiche uniquement les rubriques utiles : <strong>Mes missions</strong>, <strong>Planning & Rotation</strong> et <strong>Missions internes</strong>.',
          steps: [
            { icon: 'login', title: 'Se connecter', detail: 'Saisir votre login chauffeur et votre mot de passe sur la page de connexion.' },
            { icon: 'notifications', title: 'Activer les notifications', detail: 'Autoriser les notifications navigateur pour être alerté dès qu\'une nouvelle mission vous est assignée.' },
            { icon: 'local_shipping', title: 'Accéder à Mes missions', detail: 'Menu → « Mes missions ». Vous voyez directement les missions d\'aujourd\'hui, puis les futures et les passées.' },
          ],
          tips: [
            'L\'application fonctionne aussi sur téléphone mobile — installer la PWA depuis le navigateur pour un accès rapide sur le terrain.',
            'Activer la localisation GPS de votre appareil pour que le lien Google Maps calcule le trajet depuis votre position actuelle.',
          ]
        },
        {
          id: 'ch-missions',
          icon: 'route',
          title: 'Mes Missions de Transport',
          content: 'La liste de vos missions est organisée en trois groupes : <strong>Aujourd\'hui</strong> (prioritaires), <strong>À venir</strong> et <strong>Passées</strong>. Chaque carte mission affiche les informations essentielles pour la course.',
          table: {
            headers: ['Zone de la carte', 'Contenu affiché'],
            rows: [
              ['En-tête', 'Type de mission, statut coloré, badge Priorité Haute si urgent'],
              ['Informations', 'Date et heure de départ, agent à transporter, lieu de destination'],
              ['Description', 'Détails de la mission communiqués par l\'Admin ou le Support'],
              ['Note', 'Instructions complémentaires (point de rendez-vous, accès particulier...)'],
              ['Actions', 'Boutons Démarrer / Terminer et lien Google Maps'],
            ]
          },
          tips: [
            'Les missions du <strong>jour en cours</strong> apparaissent en premier, avec un encadré mis en évidence.',
            'Une bordure rouge sur la carte indique une mission de <strong>haute priorité</strong> — à traiter en premier.',
            'Utiliser le champ de recherche pour retrouver une mission par nom d\'agent, type ou zone.',
          ]
        },
        {
          id: 'ch-cycle',
          icon: 'play_circle',
          title: 'Cycle de vie d\'une Mission',
          content: 'Une mission de transport passe par trois statuts successifs. Vous êtes responsable de faire évoluer le statut en temps réel pour que l\'Admin puisse suivre la progression.',
          steps: [
            { icon: 'notifications_active', title: 'Recevoir la mission', detail: 'Une notification navigateur vous alerte. La mission apparaît dans « Mes missions » avec le statut Assignée (orange).' },
            { icon: 'visibility', title: 'Consulter les détails', detail: 'Ouvrir la carte mission → lire les informations : qui transporter, où aller, à quelle heure, instructions spéciales.' },
            { icon: 'map', title: 'Naviguer vers la destination', detail: 'Cliquer sur le bouton « Maps » (icône navigation) → Google Maps s\'ouvre avec l\'itinéraire depuis votre position.' },
            { icon: 'play_arrow', title: 'Démarrer la mission', detail: 'Bouton « Démarrer » (bleu) → le statut passe à « En cours ». À faire juste avant de partir.' },
            { icon: 'check_circle', title: 'Terminer la mission', detail: 'À l\'arrivée, bouton « Technicien livré » (vert) → statut « Terminée ». Le technicien peut alors commencer son intervention.' },
          ],
          warnings: [
            'Cliquer « Démarrer » uniquement quand vous êtes effectivement en route — cela déclenche le suivi de la mission.',
            'Ne pas oublier de cliquer « Terminer » à l\'arrivée — sinon la mission reste « En cours » et l\'Admin ne sait pas que le technicien est bien arrivé.',
          ]
        },
        {
          id: 'ch-statuts',
          icon: 'label',
          title: 'Statuts des Missions',
          content: 'Chaque mission est identifiable par sa couleur de statut, visible sur la barre latérale gauche de la carte et sur le chip en haut à droite.',
          table: {
            headers: ['Statut', 'Couleur', 'Signification', 'Action à faire'],
            rows: [
              ['Assignée', '<strong style="color:#e65100">● Orange</strong>', 'Mission attribuée, pas encore démarrée', 'Consulter les détails et se préparer'],
              ['En cours', '<strong style="color:#1565c0">● Bleu</strong>', 'Vous êtes en route / sur place', 'Finaliser la livraison du technicien'],
              ['Terminée', '<strong style="color:#2e7d32">● Vert</strong>', 'Technicien livré à destination', 'Aucune — mission clôturée'],
              ['Échec', '<strong style="color:#c62828">● Rouge</strong>', 'Mission annulée ou non réalisée', 'Contacter l\'Admin pour replanifier'],
            ]
          }
        },
        {
          id: 'ch-navigation',
          icon: 'map',
          title: 'Navigation GPS',
          content: 'Chaque mission dispose d\'un lien de navigation directe vers Google Maps. Il calcule automatiquement l\'itinéraire depuis votre position GPS jusqu\'à la destination de la mission.',
          steps: [
            { icon: 'location_on', title: 'Autoriser la géolocalisation', detail: 'Lors de la première ouverture, autoriser l\'accès à votre position GPS dans le navigateur.' },
            { icon: 'map', title: 'Cliquer sur le bouton Maps', detail: 'Bouton « Maps » (icône navigation bleue) sur la carte mission → s\'ouvre dans Google Maps.' },
            { icon: 'directions_car', title: 'Suivre l\'itinéraire', detail: 'Google Maps calcule le meilleur trajet en voiture depuis votre position jusqu\'à la destination.' },
          ],
          tips: [
            'Si la destination n\'est pas précisée sur la carte, contacter le Support ou l\'Admin pour obtenir l\'adresse exacte avant de démarrer.',
            'En cas de perturbation traffic, utiliser l\'option « Éviter les péages » dans Google Maps si nécessaire.',
          ]
        },
        {
          id: 'ch-export',
          icon: 'picture_as_pdf',
          title: 'Export PDF des Missions',
          content: 'Vous pouvez exporter la liste de vos missions du jour en PDF pour l\'avoir en format papier ou l\'envoyer par email.',
          steps: [
            { icon: 'local_shipping', title: 'Aller dans Mes missions', detail: 'Menu → « Mes missions ».' },
            { icon: 'picture_as_pdf', title: 'Cliquer sur Export PDF', detail: 'Bouton « Export PDF » en haut à droite → un fichier PDF est généré avec toutes vos missions du jour.' },
            { icon: 'print', title: 'Imprimer ou partager', detail: 'Ouvrir le PDF → imprimer ou partager via WhatsApp/email si nécessaire.' },
          ]
        },
        {
          id: 'ch-planning',
          icon: 'calendar_month',
          title: 'Planning & Missions internes',
          content: 'En dehors des missions de transport, vous pouvez consulter votre planning de présence et vos missions internes (ex : courses administratives, approvisionnement...).',
          steps: [
            { icon: 'calendar_month', title: 'Mon planning', detail: 'Menu → « Planning & Rotation » → voir vos créneaux de présence et de disponibilité.' },
            { icon: 'assignment_ind', title: 'Missions internes', detail: 'Menu → « Missions internes » → liste des missions non-transport qui vous sont assignées (livraisons de matériel, documents...).' },
          ],
          tips: [
            'Si vous avez un planning chargé, informer votre Admin pour éviter les conflits d\'affectation.',
          ]
        },
      ]
    },
  ];
}
