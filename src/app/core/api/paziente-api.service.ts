import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { User } from '../../models/user.model';

/** Risposta GET /api/v1/pazienti/me (PazienteDTO). */
export interface PazienteProfiloResponse {
  id: number;
  nome: string;
  cognome: string;
  indirizzoDiResidenza: string;
  dataDiNascita: string;
  codiceFiscale: string;
  email: string;
}

/** Risposta GET /api/v1/pazienti/mio-medico. */
export interface MedicoCuranteResponse {
  id: number;
  nome: string;
  cognome: string;
  account?: { id: number; username: string; email: string };
}

/** Body PUT /api/v1/pazienti/updatePaziente (PazienteDTO). */
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
  private readonly baseUrl = `${environment.apiUrl}/api/v1/pazienti`;

  constructor(private http: HttpClient) {}

  updatePaziente(
    dto: PazienteUpdateDto
  ): Observable<{ success: true; message: string } | { success: false; error: string }> {
    return this.http
      .put<string>(`${this.baseUrl}/updatePaziente`, dto, {
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

  getProfilo(): Observable<{ success: true; data: Partial<User> } | { success: false; error: string }> {
    return this.http.get<PazienteProfiloResponse>(`${this.baseUrl}/me`, { withCredentials: true }).pipe(
      map(res => ({
        success: true as const,
        data: this.mapToUserProfile(res)
      })),
      catchError((err: HttpErrorResponse) =>
        of({ success: false as const, error: this.extractErrorMessage(err) })
      )
    );
  }

  getMioMedicoCurante(): Observable<
    | { success: true; data: MedicoCuranteResponse | null }
    | { success: false; error: string }
  > {
    return this.http.get<MedicoCuranteResponse | null>(`${this.baseUrl}/mio-medico`, { withCredentials: true }).pipe(
      map(data =>
        data == null
          ? { success: true as const, data: null }
          : { success: true as const, data }
      ),
      catchError((err: HttpErrorResponse) =>
        of({
          success: false as const,
          error: err.status === 404 ? 'Nessun medico curante associato.' : this.extractErrorMessage(err)
        })
      )
    );
  }

  setMioMedicoCurante(
    medicoCuranteId: number
  ): Observable<{ success: true } | { success: false; error: string }> {
    return this.http
      .put<string>(`${this.baseUrl}/mio-medico`, { medicoCuranteId }, {
        withCredentials: true,
        responseType: 'text' as 'json'
      })
      .pipe(
        map(() => ({ success: true as const })),
        catchError((err: HttpErrorResponse) =>
          of({ success: false as const, error: this.extractErrorMessage(err) })
        )
      );
  }

  private mapToUserProfile(res: PazienteProfiloResponse): Partial<User> {
    return {
      nome: res.nome,
      cognome: res.cognome,
      email: res.email,
      codiceFiscale: res.codiceFiscale,
      indirizzoDiResidenza: res.indirizzoDiResidenza,
      dataDiNascita: res.dataDiNascita || undefined
    };
  }

  private extractErrorMessage(err: HttpErrorResponse): string {
    if (err.error && typeof err.error === 'string') return err.error;
    if (err.error?.message) return err.error.message;
    if (err.status === 0) return 'Impossibile connettersi al server.';
    return err.message || 'Si è verificato un errore';
  }
}
