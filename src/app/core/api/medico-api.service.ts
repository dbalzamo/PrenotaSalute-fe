import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { User } from '../../models/user.model';

/** Risposta GET /api/v1/medici-curanti/me (MedicoCuranteDTO). */
export interface MedicoProfiloResponse {
  id: number;
  nome: string;
  cognome: string;
  indirizzoDiResidenza: string;
  dataDiNascita: string;
  codiceFiscale: string;
  specializzazione?: string | null;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class MedicoApiService {
  private readonly baseUrl = `${environment.apiUrl}/api/v1/medici-curanti`;

  constructor(private http: HttpClient) {}

  getProfilo(): Observable<{ success: true; data: Partial<User> } | { success: false; error: string }> {
    return this.http.get<MedicoProfiloResponse>(`${this.baseUrl}/me`, { withCredentials: true }).pipe(
      map(res => ({
        success: true as const,
        data: this.mapToUserProfile(res)
      })),
      catchError((err: HttpErrorResponse) =>
        of({ success: false as const, error: this.extractErrorMessage(err) })
      )
    );
  }

  private mapToUserProfile(res: MedicoProfiloResponse): Partial<User> {
    return {
      nome: res.nome,
      cognome: res.cognome,
      email: res.email,
      codiceFiscale: res.codiceFiscale,
      indirizzoDiResidenza: res.indirizzoDiResidenza,
      dataDiNascita: res.dataDiNascita || undefined,
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
