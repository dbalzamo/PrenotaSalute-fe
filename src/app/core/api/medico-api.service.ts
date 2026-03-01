import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { User } from '../../models/user.model';

/** Risposta API GET /api/medico/me (modello MedicoCurante backend) */
export interface MedicoProfiloResponse {
  id: number;
  nome: string;
  cognome: string;
  indirizzoDiResidenza: string;
  dataDiNascita: string | number;
  codiceFiscale: string;
  specializzazione?: string | null;
  account?: { id: number; username: string; email: string };
}

@Injectable({ providedIn: 'root' })
export class MedicoApiService {
  private readonly baseUrl = `${environment.apiUrl}/api/medico`;

  constructor(private http: HttpClient) {}

  /**
   * Recupera il profilo del medico curante corrente (account autenticato).
   * Usa l'endpoint GET /api/medico/me che internamente usa findByAccountId.
   */
  getProfilo(): Observable<{ success: true; data: Partial<User> } | { success: false; error: string }> {
    return this.http
      .get<MedicoProfiloResponse>(`${this.baseUrl}/me`, { withCredentials: true })
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

  private mapToUserProfile(res: MedicoProfiloResponse): Partial<User> {
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
      dataDiNascita: dataDiNascita || undefined,
      specializzazione: res.specializzazione || undefined
    };
  }

  private extractErrorMessage(err: HttpErrorResponse): string {
    if (err.error && typeof err.error === 'string') return err.error;
    if (err.error?.message) return err.error.message;
    if (err.status === 0) return 'Impossibile connettersi al server.';
    return err.message || 'Si è verificato un errore';
  }
}

