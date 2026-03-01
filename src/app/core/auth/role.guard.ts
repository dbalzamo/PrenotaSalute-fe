import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { UserRole } from '../../models/user.model';
import { AuthService } from './auth.service';

/**
 * Crea un guard che consente l'accesso solo agli utenti con il ruolo specificato.
 * Se l'utente non è autenticato → redirect a /login.
 * Se l'utente ha un ruolo diverso → redirect alla dashboard corretta per il suo ruolo.
 */
export function roleGuard(allowedRole: UserRole) {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const user = auth.currentUser();
    if (!user) {
      return router.createUrlTree(['/login']);
    }
    if (user.ruolo !== allowedRole) {
      return router.createUrlTree([auth.getDashboardRoute()]);
    }
    return true;
  };
}

export const medicoCuranteGuard = roleGuard('Medico_Curante');
export const pazienteGuard = roleGuard('Paziente');
