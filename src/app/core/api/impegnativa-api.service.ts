import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { PrestazioneSanitariaDTO } from './prestazione-sanitaria-api.service';

/** EPrioritàPrescrizione backend. */
export type PrioritaPrescrizione = 'U' | 'B' | 'D' | 'P';

/** Body POST /api/v1/impegnative/genera-impegnativa (ImpegnativaRequest). */
export interface ImpegnativaGeneraRequest {
  idRichiestaMedica: number;
  priorita: PrioritaPrescrizione;
  prestazioneSanitariaDTO: PrestazioneSanitariaDTO;
}

@Injectable({ providedIn: 'root' })
export class ImpegnativaApiService {
  private readonly baseUrl = `${environment.apiUrl}/api/v1/impegnative`;

  constructor(private http: HttpClient) {}

  /**
   * Scarica il PDF dell'impegnativa (paziente o medico titolare).
   */
  downloadPdf(impegnativaId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${impegnativaId}/pdf`, {
      responseType: 'blob',
      withCredentials: true
    });
  }

  generaImpegnativa(
    body: ImpegnativaGeneraRequest
  ): Observable<{ success: true; message: string } | { success: false; error: string }> {
    return this.http
      .post<string>(`${this.baseUrl}/genera-impegnativa`, body, {
        withCredentials: true,
        responseType: 'text' as 'json'
      })
      .pipe(
        map(message => ({ success: true as const, message: message as string })),
        catchError((err: HttpErrorResponse) =>
          of({ success: false as const, error: this.extractErrorMessage(err) })
        )
      );
  }

  private extractErrorMessage(err: HttpErrorResponse): string {
    if (err.error && typeof err.error === 'string') return err.error;
    if (err.error?.message) return err.error.message;
    if (err.status === 0) return 'Impossibile connettersi al server.';
    return err.message || 'Errore durante la generazione dell\'impegnativa';
  }
}
