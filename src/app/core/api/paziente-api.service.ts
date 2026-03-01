import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { User } from '../../models/user.model';

/** Risposta API GET /api/paziente/me (modello Paziente backend) */
export interface PazienteProfiloResponse {
  id: number;
  nome: string;
  cognome: string;
  indirizzoDiResidenza: string;
  dataDiNascita: string | number; // ISO string o timestamp
  codiceFiscale: string;
  account?: { id: number; username: string; email: string };
}

/** Body per PUT /api/paziente/updatePaziente (PazienteDTO backend) */
export interface PazienteUpdateDto {
  id?: number;
  nome: string;
  cognome: string;
  email: string;
  codiceFiscale: string;
  indirizzoDiResidenza: string;
  dataDiNascita: string;
}

@Injectable({ providedIn: 'root' })
export class PazienteApiService {
  private readonly baseUrl = `${environment.apiUrl}/api/paziente`;

  constructor(private http: HttpClient) {}

  /**
   * Aggiorna il paziente corrente (PUT /api/paziente/updatePaziente).
   * L'id account è preso dal backend tramite SecurityUtils.getCurrentAccountId().
   */
  updatePaziente(dto: PazienteUpdateDto): Observable<{ success: true; message: string } | { success: false; error: string }> {
    return this.http
      .put<string>(`${this.baseUrl}/updatePaziente`, dto, {
        withCredentials: true,
        responseType: 'text' as 'json'
      })
      .pipe(
        map(message => ({ success: true as const, message: message as string })),
        catchError((err: HttpErrorResponse) =>
          of({
            success: false as const,
            error: this.extractErrorMessage(err)
          })
        )
      );
  }

  /**
   * Recupera il profilo del paziente corrente (account autenticato).
   * Usa l'endpoint GET /api/paziente/me che internamente usa findByAccountId.
   */
  getProfilo(): Observable<{ success: true; data: Partial<User> } | { success: false; error: string }> {
    return this.http
      .get<PazienteProfiloResponse>(`${this.baseUrl}/me`, { withCredentials: true })
      .pipe(
        map(res => ({
          success: true as const,
          data: this.mapToUserProfile(res)
        })),
        catchError((err: HttpErrorResponse) =>
          of({
            success: false as const,
            error: this.extractErrorMessage(err)
          })
        )
      );
  }

  private mapToUserProfile(res: PazienteProfiloResponse): Partial<User> {
    const dataDiNascita =
      typeof res.dataDiNascita === 'number'
        ? new Date(res.dataDiNascita).toISOString().slice(0, 10)
        : res.dataDiNascita;
    return {
      nome: res.nome,
      cognome: res.cognome,
      email: res.account?.email ?? undefined,
      username: res.account?.username ?? undefined,
      codiceFiscale: res.codiceFiscale,
      indirizzoDiResidenza: res.indirizzoDiResidenza,
      dataDiNascita: dataDiNascita || undefined
    };
  }

  private extractErrorMessage(err: HttpErrorResponse): string {
    if (err.error && typeof err.error === 'string') return err.error;
    if (err.error?.message) return err.error.message;
    if (err.status === 0) return 'Impossibile connettersi al server.';
    return err.message || 'Si è verificato un errore';
  }
}
