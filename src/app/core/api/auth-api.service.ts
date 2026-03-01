import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  id: number;
  username: string;
  email: string;
  ruoli: string[];
  token: string;
}

export interface SignupRequest {
  username: string;
  email: string;
  password: string;
  ruolo: 'PAZIENTE' | 'MEDICO_CURANTE';
  nome: string;
  cognome: string;
  codiceFiscale: string;
  indirizzoDiResidenza: string;
  dataDiNascita: string;
  specializzazione?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly baseUrl = `${environment.apiUrl}/api/auth`;

  constructor(private http: HttpClient) {}

  login(request: LoginRequest): Observable<{ success: true; data: LoginResponse } | { success: false; error: string }> {
    return this.http
      .post<LoginResponse>(`${this.baseUrl}/login`, request, {
        withCredentials: true
      })
      .pipe(
        map(data => ({ success: true as const, data })),
        catchError((err: HttpErrorResponse) =>
          of({
            success: false as const,
            error: this.extractErrorMessage(err)
          })
        )
      );
  }

  signup(request: SignupRequest): Observable<{ success: true; message: string } | { success: false; error: string }> {
    return this.http
      .post<string>(`${this.baseUrl}/signup`, request, {
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

  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/logout`, {}, { withCredentials: true });
  }

  private extractErrorMessage(err: HttpErrorResponse): string {
    if (err.error && typeof err.error === 'string') {
      return err.error;
    }
    if (err.error?.message) {
      return err.error.message;
    }
    if (err.status === 0) {
      return 'Impossibile connettersi al server. Verifica che il backend sia avviato.';
    }
    return err.message || 'Si è verificato un errore';
  }
}
