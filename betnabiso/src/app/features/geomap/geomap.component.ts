import { Component, signal, computed, inject, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { LocationService, TechLocation } from '../../core/services/location.service';
import { PresenceService } from '../../core/services/presence.service';
import { UserService } from '../../core/services/user.service';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import * as L from 'leaflet';

export interface EscaladeItem {
  id: string;
  agentNom: string;
  agentZone: string;
  statut: string;
  createdAt: string;
  dureeH: number;
}

@Component({
  selector: 'app-geomap',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, MatTooltipModule, MatChipsModule],
  template: `
    <div class="geo-page">
      <div class="geo-header">
        <h2><mat-icon>map</mat-icon> Carte des techniciens</h2>
        <div class="header-actions">
          <button mat-stroked-button (click)="refresh()" [disabled]="loading()">
            <mat-icon>refresh</mat-icon> Actualiser
          </button>
          <span class="last-update" *ngIf="lastRefresh()">Mis à jour : {{ lastRefresh() }}</span>
        </div>
      </div>

      <div class="layout">
        <!-- Map -->
        <mat-card class="map-card">
          <div #mapContainer id="leaflet-map"></div>
          <p class="map-note">
            <mat-icon>info</mat-icon>
            {{ locations().length }} position(s) GPS récente(s) sur {{ onlineStaff().length }} connecté(s)
          </p>
        </mat-card>

        <!-- Escalades panel -->
        <div class="side-panel">
          <mat-card class="escalade-card">
            <div class="escalade-header">
              <mat-icon class="warn-icon">warning</mat-icon>
              <h3>Escalades automatiques</h3>
            </div>
            <p class="escalade-desc">Interventions en cours depuis plus de {{ seuilH }}h sans résolution</p>

            <div class="seuil-row">
              <span>Seuil : </span>
              <button mat-icon-button (click)="changeSeuil(-1)" [disabled]="seuilH <= 1"><mat-icon>remove</mat-icon></button>
              <strong>{{ seuilH }}h</strong>
              <button mat-icon-button (click)="changeSeuil(1)"><mat-icon>add</mat-icon></button>
            </div>

            @if (escalades().length === 0) {
              <div class="no-escalade">
                <mat-icon>check_circle</mat-icon>
                <p>Aucune escalade détectée</p>
              </div>
            } @else {
              <div class="escalade-list">
                @for (e of escalades(); track e.id) {
                  <div class="escalade-item">
                    <div class="esc-top">
                      <span class="esc-nom">{{ e.agentNom }}</span>
                      <span class="esc-duree" [class.critical]="e.dureeH > 12">{{ e.dureeH }}h</span>
                    </div>
                    <div class="esc-bot">
                      <span class="esc-zone">{{ e.agentZone }}</span>
                      <span class="status-chip status-{{ statusClass(e.statut) }}">{{ e.statut }}</span>
                    </div>
                  </div>
                }
              </div>
            }
          </mat-card>

          <!-- Online technicians list -->
          <mat-card class="online-card">
            <h3><mat-icon>people</mat-icon> Techniciens en ligne</h3>
            @if (onlineStaff().length === 0) {
              <p class="no-online">Personne d'autre en ligne actuellement.</p>
            } @else {
              @for (u of onlineStaff(); track u.id) {
                <div class="tech-row">
                  <div class="tech-avatar">{{ initials(u.prenom + ' ' + u.nom) }}</div>
                  <div class="tech-info">
                    <span class="tech-nom">{{ u.prenom }} {{ u.nom }}</span>
                    @if (locationOf(u.id); as loc) {
                      <span class="tech-coords">{{ loc.lat.toFixed(4) }}, {{ loc.lng.toFixed(4) }}</span>
                    } @else {
                      <span class="tech-coords no-gps">Position indisponible</span>
                    }
                  </div>
                  <div class="online-dot"></div>
                </div>
              }
            }
          </mat-card>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .geo-page { padding: 24px; max-width: 1400px; margin: 0 auto; }
    .geo-header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
    .geo-header h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 1.4rem; flex: 1; }
    .header-actions { display: flex; align-items: center; gap: 12px; }
    .last-update { font-size: 0.8rem; color: var(--text-secondary); }
    .layout { display: grid; grid-template-columns: 1fr 320px; gap: 20px; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
    .map-card { overflow: hidden; }
    #leaflet-map { width: 100%; height: 500px; }
    .map-note { display: flex; align-items: center; gap: 6px; margin: 8px 16px; font-size: 0.8rem; color: var(--text-secondary); }
    .map-note mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .side-panel { display: flex; flex-direction: column; gap: 16px; }
    .escalade-card, .online-card { padding: 16px; }
    .escalade-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .escalade-header h3 { margin: 0; font-size: 1rem; }
    .warn-icon { color: #ff9800; }
    .escalade-desc { font-size: 0.8rem; color: var(--text-secondary); margin: 0 0 12px; }
    .seuil-row { display: flex; align-items: center; gap: 4px; margin-bottom: 12px; font-size: 0.85rem; }
    .no-escalade { text-align: center; padding: 20px; color: #4caf50; }
    .no-escalade mat-icon { font-size: 36px; width: 36px; height: 36px; display: block; margin: 0 auto 8px; }
    .escalade-list { display: flex; flex-direction: column; gap: 8px; }
    .escalade-item { background: rgba(255,152,0,0.1); border: 1px solid rgba(255,152,0,0.25); border-radius: 8px; padding: 10px 12px; }
    .esc-top { display: flex; justify-content: space-between; align-items: center; }
    .esc-nom { font-weight: 600; font-size: 0.9rem; }
    .esc-duree { font-weight: 700; font-size: 0.95rem; color: #ff9800; }
    .esc-duree.critical { color: #f44336; }
    .esc-bot { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
    .esc-zone { font-size: 0.8rem; color: var(--text-secondary); }
    .status-chip { padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 600; }
    .status-cours { background: #e3f2fd; color: #1565c0; }
    .status-assignee { background: #fff3e0; color: #e65100; }
    .status-attente { background: #eceff1; color: #607d8b; }
    .online-card h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; font-size: 1rem; }
    .no-online { font-size: 0.85rem; color: var(--text-secondary); }
    .tech-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); }
    .tech-row:last-child { border-bottom: none; }
    .tech-avatar { width: 32px; height: 32px; border-radius: 50%; background: #e3f2fd; color: #1565c0; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.75rem; flex-shrink: 0; }
    .tech-info { flex: 1; }
    .tech-nom { display: block; font-size: 0.85rem; font-weight: 600; }
    .tech-coords { display: block; font-size: 0.75rem; color: var(--text-secondary); font-family: monospace; }
    .tech-coords.no-gps { font-family: inherit; font-style: italic; }
    .online-dot { width: 8px; height: 8px; border-radius: 50%; background: #4caf50; flex-shrink: 0; }
  `]
})
export class GeomapComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  private locationSvc = inject(LocationService);
  private http        = inject(HttpClient);
  private presenceSvc = inject(PresenceService);
  private userSvc     = inject(UserService);

  locations = signal<TechLocation[]>([]);
  escalades = signal<EscaladeItem[]>([]);
  loading = signal(false);
  lastRefresh = signal('');
  seuilH = 6;

  // Tout le monde connecté (session active), pas seulement ceux ayant une
  // position GPS récente — c'est la vraie définition de "en ligne".
  onlineStaff = computed(() => this.userSvc.getAll().filter(u => this.presenceSvc.isOnline(u.id)));

  locationOf(userId: string): TechLocation | undefined {
    return this.locations().find(l => l.userId === userId);
  }

  private map: any = null;
  private markers: any[] = [];
  private refreshInterval: any;
  private resizeObserver: ResizeObserver | null = null;

  ngOnInit(): void {
    this.loadEscalades();
    this.refreshInterval = setInterval(() => this.refresh(), 60000);
  }

  ngAfterViewInit(): void {
    this.initMap();
    this.loadLocations();
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.resizeObserver?.disconnect();
    if (this.map) { this.map.remove(); this.map = null; }
  }

  private initMap(): void {
    if (typeof L === 'undefined') return;
    this.map = L.map('leaflet-map').setView([14.7, -17.4], 12);
    // tile.openstreetmap.org réserve son serveur à un usage léger/test et
    // bloque (403/429) le trafic d'applications en production comme celle-ci.
    // CARTO fournit un fond de carte basé sur les mêmes données OSM, gratuit
    // sans clé API, prévu pour ce type d'usage.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      maxZoom: 18,
      subdomains: 'abcd'
    }).addTo(this.map);
    // Le conteneur peut changer de taille après l'init (grille CSS pas encore
    // stabilisée, panneaux latéraux qui se remplissent de façon asynchrone,
    // sidebar qui s'anime...) : un setTimeout fixe ne couvre pas tous ces cas
    // et laisse Leaflet avec des tuiles décalées/manquantes. Un ResizeObserver
    // sur le conteneur recalcule à chaque changement réel de taille, quelle
    // qu'en soit la cause.
    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(this.mapContainer.nativeElement);
  }

  private async loadLocations(): Promise<void> {
    const locs = await this.locationSvc.getAll();
    this.locations.set(locs);
    this.updateMarkers(locs);
    this.lastRefresh.set(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
  }

  private async loadEscalades(): Promise<void> {
    try {
      const data = await firstValueFrom(
        this.http.get<EscaladeItem[]>(`${environment.apiUrl}/escalade?heures=${this.seuilH}`)
      );
      this.escalades.set(data);
    } catch { this.escalades.set([]); }
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    await Promise.all([this.loadLocations(), this.loadEscalades()]);
    this.loading.set(false);
  }

  changeSeuil(delta: number): void {
    this.seuilH = Math.max(1, this.seuilH + delta);
    this.loadEscalades();
  }

  private updateMarkers(locs: TechLocation[]): void {
    if (!this.map || typeof L === 'undefined') return;
    this.markers.forEach(m => m.remove());
    this.markers = [];
    for (const loc of locs) {
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:#1a73e8;color:#fff;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)">${this.initials(loc.userNom)}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });
      const marker = L.marker([loc.lat, loc.lng], { icon })
        .addTo(this.map)
        .bindPopup(`<b>${loc.userNom}</b><br>Mis à jour : ${new Date(loc.updatedAt).toLocaleTimeString('fr-FR')}`);
      this.markers.push(marker);
    }
    if (locs.length > 0) {
      // fitBounds() calcule le zoom/centre à partir de la taille actuelle du
      // conteneur : si les positions arrivent avant que le ResizeObserver
      // n'ait eu l'occasion de corriger cette taille (cas fréquent, la requête
      // pouvant répondre depuis le cache quasi instantanément), le cadrage
      // obtenu est faux et les tuiles ne remplissent plus la carte. On force
      // donc un recalcul juste avant, dans tous les cas.
      this.map.invalidateSize();
      const group = L.featureGroup(this.markers);
      this.map.fitBounds(group.getBounds().pad(0.2));
    }
  }

  initials(nom: string): string {
    return nom.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
  }

  statusClass(s: string): string {
    if (s === 'En cours') return 'cours';
    if (s === 'Assignée') return 'assignee';
    return 'attente';
  }
}
