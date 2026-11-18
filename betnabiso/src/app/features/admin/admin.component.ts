import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, MatTabsModule, MatIconModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>Administration</h1>
      </div>
      <nav mat-tab-nav-bar [tabPanel]="tabPanel">
        @if (auth.isSuperadmin()) {
          <a mat-tab-link routerLink="users" routerLinkActive #rla1="routerLinkActive" [active]="rla1.isActive">
            <mat-icon>people</mat-icon>&nbsp; Utilisateurs
          </a>
        }
        <a mat-tab-link routerLink="zones" routerLinkActive #rla2="routerLinkActive" [active]="rla2.isActive">
          <mat-icon>map</mat-icon>&nbsp; Zones
        </a>
        <a mat-tab-link routerLink="creneaux" routerLinkActive #rla3="routerLinkActive" [active]="rla3.isActive">
          <mat-icon>schedule</mat-icon>&nbsp; Créneaux
        </a>
        <a mat-tab-link routerLink="types" routerLinkActive #rla4="routerLinkActive" [active]="rla4.isActive">
          <mat-icon>category</mat-icon>&nbsp; Types
        </a>
      </nav>
      <mat-tab-nav-panel #tabPanel>
        <router-outlet></router-outlet>
      </mat-tab-nav-panel>
    </div>
  `,
  styles: [`
    .page-container { padding: 24px; }
    nav { margin-bottom: 20px; }

    :host ::ng-deep nav[mat-tab-nav-bar] {
      display: inline-flex;
      width: auto;
      background: #f0f4f8;
      border-radius: 10px;
      padding: 4px;
      gap: 4px;
      border-bottom: none;

      .mat-mdc-tab-link-container { flex-grow: 0; }
      .mat-mdc-tab-header-pagination { display: none !important; }

      .mat-mdc-tab-link {
        height: 38px;
        padding: 0 16px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        letter-spacing: normal;
        color: #5a6b7c;
        opacity: 1;
        flex-grow: 0;
        transition: background .2s, color .2s;

        .mdc-tab-indicator { display: none; }

        &:hover:not(.mdc-tab--active) { background: rgba(0,0,0,.04); }

        &.mdc-tab--active {
          background: white;
          color: #1a3a5c;
          font-weight: 600;
          box-shadow: 0 1px 3px rgba(0,0,0,.08);
        }

        mat-icon { font-size: 18px; width: 18px; height: 18px; vertical-align: middle; }
      }
    }
  `]
})
export class AdminComponent {
  auth = inject(AuthService);
}
