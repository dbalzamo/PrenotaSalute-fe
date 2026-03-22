import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { SpringPage } from '../models/page.model';

/** Allineato a PrestazioneSanitariaDTO backend. */
export interface PrestazioneSanitariaDTO {
  id?: number;
  codicePrestazione: number;
  descrizione?: string;
  note?: string;
  quantita: number;
}

@Injectable({ providedIn: 'root' })
export class PrestazioneSanitariaApiService {
  private readonly baseUrl = `${environment.apiUrl}/api/v1/prestazioni-sanitarie`;

  constructor(private http: HttpClient) {}

  /**
   * Catalogo prestazioni (GenericController commons: GET .../getAll/paged).
   */
  getAllPaged(
    page = 0,
    size = 50
  ): Observable<{ success: true; data: SpringPage<PrestazioneSanitariaDTO> } | { success: false; error: string }> {
    const params = new HttpParams().set('page', String(page)).set('size', String(size));
    return this.http
      .get<SpringPage<PrestazioneSanitariaDTO>>(`${this.baseUrl}/getAll/paged`, {
        withCredentials: true,
        params
      })
      .pipe(
        map(data => ({ success: true as const, data })),
        catchError((err: HttpErrorResponse) =>
          of({ success: false as const, error: this.extractErrorMessage(err) })
        )
      );
  }

  private extractErrorMessage(err: HttpErrorResponse): string {
    if (err.error && typeof err.error === 'string') return err.error;
    if (err.error?.message) return err.error.message;
    if (err.status === 0) return 'Impossibile connettersi al server.';
    return err.message || 'Errore nel caricamento delle prestazioni';
  }
}
