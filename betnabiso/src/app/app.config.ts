import { ApplicationConfig, provideBrowserGlobalErrorListeners, LOCALE_ID, isDevMode } from '@angular/core';
import { provideRouter, withViewTransitions, withHashLocation, withPreloading, PreloadAllModules } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { routes } from './app.routes';
import { provideNativeDateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { sessionInterceptor } from './core/interceptors/session.interceptor';
import { retryInterceptor } from './core/interceptors/retry.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';

registerLocaleData(localeFr, 'fr');

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withViewTransitions(), withHashLocation(), withPreloading(PreloadAllModules)),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([authInterceptor, sessionInterceptor, retryInterceptor, loadingInterceptor])),
    { provide: LOCALE_ID, useValue: 'fr' },
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'fr-FR' },
    provideServiceWorker('ngsw-worker.js', { enabled: false }),
  ]
};
