import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { SpringPage } from '../models/page.model';
import type { Richiesta, RichiestaPaziente, StatoRichiesta, StatoRichiestaPaziente } from '../../models/richiesta.model';

/** Valori ammessi per tipoRichiesta (ETipoRichiesta backend). */
export type TipoRichiesta = 'VISITA' | 'PRESCRIZIONE' | 'ESAME' | 'CONTROLLO_REFERTI' | 'ALTRO';

/** Body POST /api/v1/richieste-mediche/crea-richiesta. */
export interface RichiestaMedicaRequest {
  tipoRichiesta: TipoRichiesta;
  descrizione: string;
  idMedico: number;
}

/** Elemento lista (RichiestaMedicaListItemDTO). */
export interface RichiestaMedicaListItemDTO {
  id: number;
  dataEmissione?: string | number;
  dataAccettazione?: string | number;
  tipoRichiesta: string;
  stato: string;
  descrizione: string;
  impegnativaId?: number | null;
}

/** Risposta GET medico/richieste (RichiestaMedicaMedicoResponse). */
export interface RichiestaMedicaMedicoResponse {
  id: number;
  dataEmissione?: string | number;
  tipoRichiesta: string;
  stato: string;
  descrizione: string | null;
  pazienteId: number;
  pazienteNome: string;
  pazienteCognome: string;
  impegnativaId?: number | null;
}

@Injectable({ providedIn: 'root' })
export class RichiestaMedicaApiService {
  private readonly baseUrl = `${environment.apiUrl}/api/v1/richieste-mediche`;

  constructor(private http: HttpClient) {}

  /**
   * Richieste del paziente (paginate). Default prima pagina, fino a 100 elementi.
   */
  getMieRichieste(
    page = 0,
    size = 100
  ): Observable<{ success: true; data: RichiestaPaziente[] } | { success: false; error: string }> {
    const params = new HttpParams().set('page', String(page)).set('size', String(size));
    return this.http
      .get<SpringPage<RichiestaMedicaListItemDTO>>(`${this.baseUrl}/mie-richieste`, {
        withCredentials: true,
        params
      })
      .pipe(
        map(body => ({
          success: true as const,
          data: (body.content ?? []).map(r => this.mapToRichiestaPaziente(r))
        })),
        catchError((err: HttpErrorResponse) =>
          of({ success: false as const, error: this.extractErrorMessage(err) })
        )
      );
  }

  getRichiesteMedico(): Observable<{ success: true; data: Richiesta[] } | { success: false; error: string }> {
    return this.http
      .get<RichiestaMedicaMedicoResponse[]>(`${this.baseUrl}/medico/richieste`, {
        withCredentials: true
      })
      .pipe(
        map(list => ({
          success: true as const,
          data: (list ?? []).map(r => this.mapToRichiestaMedico(r))
        })),
        catchError((err: HttpErrorResponse) =>
          of({ success: false as const, error: this.extractErrorMessage(err) })
        )
      );
  }

  /**
   * Segna la richiesta come visualizzata (medico curante).
   */
  visualizzaRichiestaMedica(
    idRichiesta: number
  ): Observable<{ success: true; message: string } | { success: false; error: string }> {
    return this.http
      .put<string>(`${this.baseUrl}/visualizza-richiesta/${idRichiesta}`, {}, {
        withCredentials: true,
        responseType: 'text' as 'json'
      })
      .pipe(
        map(message => ({ success: true as const, message: String(message) })),
        catchError((err: HttpErrorResponse) =>
          of({ success: false as const, error: this.extractErrorMessage(err) })
        )
      );
  }

  accettaRichiesta(idRichiesta: string): Observable<{ success: true } | { success: false; error: string }> {
    return this.http
      .put<string>(`${this.baseUrl}/accetta-richiesta/${idRichiesta}`, {}, {
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

  rifiutaRichiesta(
    idRichiesta: number,
    motivazione: string
  ): Observable<{ success: true } | { success: false; error: string }> {
    return this.http
      .post<string>(`${this.baseUrl}/rifiuta-richiesta`, { idRichiesta, motivazione }, {
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

  creaRichiesta(
    request: RichiestaMedicaRequest
  ): Observable<{ success: true; message: string } | { success: false; error: string }> {
    return this.http
      .post<string>(`${this.baseUrl}/crea-richiesta`, request, {
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

  private mapToRichiestaPaziente(r: RichiestaMedicaListItemDTO): RichiestaPaziente {
    const rawDate = r.dataEmissione;
    const dataRichiesta =
      typeof rawDate === 'number' ? new Date(rawDate) : rawDate ? new Date(rawDate as string) : new Date();
    return {
      id: String(r.id),
      tipo: this.tipoRichiestaToLabel(r.tipoRichiesta),
      tipoCodice: r.tipoRichiesta,
      stato: this.statoToStatoPaziente(r.stato),
      dataRichiesta: isNaN(dataRichiesta.getTime()) ? new Date() : dataRichiesta,
      descrizione: r.descrizione ?? undefined,
      impegnativaId: r.impegnativaId ?? null
    };
  }

  private tipoRichiestaToLabel(tipo: string): string {
    const labels: Record<string, string> = {
      VISITA: 'Visita',
      PRESCRIZIONE: 'Prescrizione',
      ESAME: 'Esame',
      FARMACO: 'Farmaco',
      CONTROLLO_REFERTI: 'Controllo referti',
      ALTRO: 'Altro'
    };
    return labels[tipo] ?? tipo;
  }

  private statoToStatoPaziente(stato: string): StatoRichiestaPaziente {
    switch (stato) {
      case 'INVIATA':
      case 'VISUALIZZATA':
        return 'in_attesa';
      case 'ACCETTATA':
        return 'accettata';
      case 'RIFIUTATA':
      case 'ANNULLATA':
        return 'rifiutata';
      case 'SCADUTA':
        return 'scaduta';
      default:
        return 'in_attesa';
    }
  }

  private mapToRichiestaMedico(r: RichiestaMedicaMedicoResponse): Richiesta {
    const rawDate = r.dataEmissione;
    const dataRichiesta =
      typeof rawDate === 'number' ? new Date(rawDate) : rawDate ? new Date(rawDate as string) : new Date();
    const statoBackend = (r.stato as StatoRichiesta) ?? 'INVIATA';
    const idNum = Number(r.id ?? 0);
    const priorita: 'URGENTE' | 'BREVE' | 'DIFFERIBILE' =
      idNum % 3 === 0 ? 'URGENTE' : idNum % 3 === 1 ? 'BREVE' : 'DIFFERIBILE';
    return {
      id: String(r.id),
      paziente: {
        id: String(r.pazienteId),
        nome: r.pazienteNome ?? '',
        cognome: r.pazienteCognome ?? ''
      },
      tipo: this.tipoRichiestaToLabel(r.tipoRichiesta),
      tipoCodice: r.tipoRichiesta,
      stato: statoBackend,
      urgente: priorita === 'URGENTE',
      dataRichiesta: isNaN(dataRichiesta.getTime()) ? new Date() : dataRichiesta,
      priorita,
      descrizione: r.descrizione ?? undefined,
      impegnativaId: r.impegnativaId ?? null
    };
  }

  private extractErrorMessage(err: HttpErrorResponse): string {
    if (err.error && typeof err.error === 'string') return err.error;
    if (err.error?.message) return err.error.message;
    if (err.status === 0) return 'Impossibile connettersi al server.';
    return err.message || "Errore durante l'invio della richiesta";
  }
}
