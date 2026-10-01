import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './services/auth.service';

export const signedInGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.current() ? true : inject(Router).createUrlTree([auth.hasAccounts() ? '/login' : '/register']);
};

export const signedOutGuard: CanActivateFn = () => (
  inject(AuthService).current() ? inject(Router).createUrlTree(['/today']) : true
);
