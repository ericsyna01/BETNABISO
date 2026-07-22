import { HttpInterceptorFn } from '@angular/common/http';

const AUTH_KEY = 'betnabiso_auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const stored = localStorage.getItem(AUTH_KEY);
  const token  = stored ? JSON.parse(stored)?.token : null;

  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return next(req);
};
