import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { LoadingService } from '../services/loading.service';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  // Les GET sont silencieux : données déjà en localStorage, la synchro est transparente
  if (req.method === 'GET') return next(req);

  const loadingSvc = inject(LoadingService);
  loadingSvc.show();
  return next(req).pipe(finalize(() => loadingSvc.hide()));
};
