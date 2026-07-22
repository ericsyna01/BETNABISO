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
  `]
})
export class AdminComponent {
  auth = inject(AuthService);
}
