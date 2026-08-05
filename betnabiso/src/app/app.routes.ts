import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { mustChangePasswordGuard } from './core/guards/must-change-password.guard';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'signaler/:token',
    loadComponent: () => import('./features/self-service/self-service.component').then(m => m.SelfServiceComponent)
  },
  {
    path: 'change-password',
    loadComponent: () => import('./features/auth/change-password/change-password.component').then(m => m.ChangePasswordComponent),
    canActivate: [authGuard]
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard, mustChangePasswordGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'agents',
        loadComponent: () => import('./features/agents/agent-list/agent-list.component').then(m => m.AgentListComponent)
      },
      {
        path: 'agents/new',
        loadComponent: () => import('./features/agents/agent-form/agent-form.component').then(m => m.AgentFormComponent),
        canActivate: [roleGuard], data: { roles: ['superadmin', 'admin'] }
      },
      {
        path: 'agents/:id',
        loadComponent: () => import('./features/agents/agent-detail/agent-detail.component').then(m => m.AgentDetailComponent)
      },
      {
        path: 'agents/:id/edit',
        loadComponent: () => import('./features/agents/agent-form/agent-form.component').then(m => m.AgentFormComponent),
        canActivate: [roleGuard], data: { roles: ['superadmin', 'admin'] }
      },
      {
        path: 'interventions',
        loadComponent: () => import('./features/interventions/intervention-list/intervention-list.component').then(m => m.InterventionListComponent)
      },
      {
        path: 'interventions/new',
        loadComponent: () => import('./features/interventions/intervention-form/intervention-form.component').then(m => m.InterventionFormComponent),
        canActivate: [roleGuard], data: { roles: ['superadmin', 'admin', 'support', 'technicien'] }
      },
      {
        path: 'support',
        loadComponent: () => import('./features/support/support.component').then(m => m.SupportComponent),
        canActivate: [roleGuard], data: { roles: ['superadmin', 'admin', 'support'] }
      },
      {
        path: 'support/assign',
        loadComponent: () => import('./features/support/assign-intervention/assign-intervention.component').then(m => m.AssignInterventionComponent),
        canActivate: [roleGuard], data: { roles: ['superadmin', 'admin', 'support'] }
      },
      {
        path: 'history',
        loadComponent: () => import('./features/history/history.component').then(m => m.HistoryComponent),
        canActivate: [roleGuard], data: { roles: ['superadmin', 'admin'] }
      },
      {
        path: 'chauffeur',
        loadComponent: () => import('./features/chauffeur/chauffeur.component').then(m => m.ChauffeurComponent),
        canActivate: [roleGuard], data: { roles: ['chauffeur'] }
      },
      {
        path: 'planning',
        loadComponent: () => import('./features/planning/planning.component').then(m => m.PlanningComponent),
        canActivate: [roleGuard], data: { roles: ['superadmin', 'admin', 'support', 'technicien', 'chauffeur'] }
      },
      {
        path: 'admin',
        loadComponent: () => import('./features/admin/admin.component').then(m => m.AdminComponent),
        canActivate: [roleGuard], data: { roles: ['superadmin', 'admin'] },
        children: [
          { path: '', redirectTo: 'zones', pathMatch: 'full' },
          {
            path: 'users',
            loadComponent: () => import('./features/admin/users/users.component').then(m => m.UsersComponent),
            canActivate: [roleGuard], data: { roles: ['superadmin'] }
          },
          {
            path: 'zones',
            loadComponent: () => import('./features/admin/zones/zones.component').then(m => m.ZonesComponent)
          },
          {
            path: 'creneaux',
            loadComponent: () => import('./features/admin/creneaux/creneaux.component').then(m => m.CreneauxComponent)
          },
          {
            path: 'types',
            loadComponent: () => import('./features/admin/type-labels/type-labels.component').then(m => m.TypeLabelsComponent)
          }
        ]
      },
      {
        path: 'audit',
        loadComponent: () => import('./features/audit/audit.component').then(m => m.AuditComponent),
        canActivate: [roleGuard], data: { roles: ['superadmin', 'admin'] }
      },
      {
        path: 'geomap',
        loadComponent: () => import('./features/geomap/geomap.component').then(m => m.GeomapComponent),
        canActivate: [roleGuard], data: { roles: ['superadmin', 'admin'] }
      },
{
        path: 'missions',
        loadComponent: () => import('./features/missions/missions.component').then(m => m.MissionsComponent),
        canActivate: [roleGuard], data: { roles: ['superadmin', 'admin', 'technicien', 'chauffeur'] }
      },
      {
        path: 'outils',
        loadComponent: () => import('./features/outils/outils.component').then(m => m.OutilsComponent)
      },
      {
        path: 'agenda',
        loadComponent: () => import('./features/agenda/agenda.component').then(m => m.AgendaComponent)
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent)
      },
      {
        path: 'docs',
        loadComponent: () => import('./features/docs/docs.component').then(m => m.DocsComponent)
      }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
