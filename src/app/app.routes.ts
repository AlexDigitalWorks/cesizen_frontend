import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'acceuil'
  },
  {
    path: 'acceuil',
    title: 'Acceuil',
    loadComponent: () =>
      import('./features/home/home.page').then((m) => m.HomePage)
  },
  {
    path: 'informations',
    title: 'Informations',
    loadComponent: () =>
      import('./features/informations/informations.page').then(
        (m) => m.InformationsPage
      )
  },
  {
    path: 'auto-diagnostic',
    title: 'Auto-diagnostic',
    loadComponent: () =>
      import('./features/auto-diagnostic/auto-diagnostic.page').then(
        (m) => m.AutoDiagnosticPage
      )
  },
  {
    path: 'connexion',
    title: 'Se connecter',
    loadComponent: () =>
      import('./features/auth/login.page').then((m) => m.LoginPage)
  }
];
