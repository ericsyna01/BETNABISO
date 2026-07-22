import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

// Force la déconnexion dès qu'une requête authentifiée échoue en 401 (session
// expirée ou compte désactivé entre-temps par un admin). Exclut /auth lui-même :
// un 401 sur la connexion ou le changement de mot de passe est une erreur de
// saisie normale, pas une session à couper.
export const sessionInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError(err => {
      if (err.status === 401 && !req.url.includes('/auth')) {
        auth.logout();
      }
      return throwError(() => err);
    })
  );
};
