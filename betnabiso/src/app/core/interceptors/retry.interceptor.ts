import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { throwError, timer } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

const IDEMPOTENT = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);

export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError(err => {
      // Retry once on network error (status 0) for idempotent methods
      if (err.status === 0 && IDEMPOTENT.has(req.method)) {
        return timer(800).pipe(switchMap(() => next(req)));
      }
      return throwError(() => err);
    })
  );
};
