import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const TOKEN_KEY = 'prenota_salute_token';

/**
 * Aggiunge l'header Authorization: Bearer <token> alle richieste verso l'API
 * quando il token è presente in sessionStorage. Così l'autenticazione funziona
 * anche se il cookie non viene inviato (es. proxy, CORS).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const isApiRequest =
    req.url.startsWith(environment.apiUrl) || req.url.includes(environment.apiUrl);
  const hasValidToken =
    !!token && token !== 'undefined' && token !== 'null';
  if (hasValidToken && isApiRequest) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }
  return next(req);
};
