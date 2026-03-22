import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { guestGuard } from './core/auth/guest.guard';
import { medicoCuranteGuard } from './core/auth/role.guard';
import { pazienteGuard } from './core/auth/role.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/landing/landing.component').then(m => m.LandingComponent)
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then(m => m.LoginComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'medico-curante',
    loadComponent: () =>
      import('./pages/medico-curante-dashboard/medico-curante-dashboard.component').then(
        m => m.MedicoCuranteDashboardComponent
      ),
    canActivate: [medicoCuranteGuard]
  },
  {
    path: 'paziente',
    loadComponent: () =>
      import('./pages/paziente-dashboard/paziente-dashboard.component').then(
        m => m.PazienteDashboardComponent
      ),
    canActivate: [pazienteGuard]
  },
  {
    path: 'area-personale',
    loadComponent: () =>
      import('./pages/area-personale/area-personale.component').then(
        m => m.AreaPersonaleComponent
      ),
    canActivate: [authGuard]
  }
];
