import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const roles: UserRole[] = route.data['roles'] ?? [];
  if (roles.length === 0 || auth.hasRole(...roles)) return true;
  router.navigate(['/dashboard']);
  return false;
};
