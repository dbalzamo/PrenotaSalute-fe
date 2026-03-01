import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Richiesta, RichiestaPaziente, StatoRichiesta, StatoRichiestaPaziente } from '../../models/richiesta.model';

/** Valori ammessi per tipoRichiesta (ETipoRichiesta backend) */
export type TipoRichiesta = 'VISITA' | 'PRESCRIZIONE' | 'ESAME' | 'CONTROLLO_REFERTI' | 'ALTRO';

/** Body per POST /api/richieste-mediche/crea-richiesta (RichiestaMedicaRequest backend) */
export interface RichiestaMedicaRequest {
  tipoRichiesta: TipoRichiesta;
  descrizione: string;
  idMedico: number;
}

/** Risposta GET /api/richieste-mediche/mie-richieste (RichiestaMedica backend) */
export interface RichiestaMedicaResponse {
  id: number;
  dataEmissione?: string | number;
  data_emissione?: string | number;
  tipoRichiesta: string;
  stato: string;
  descrizione: string;
}

/** Risposta GET /api/richieste-mediche/medico/richieste (RichiestaMedicaMedicoResponse backend) */
export interface RichiestaMedicaMedicoResponse {
  id: number;
  dataEmissione?: string | number;
  data_emissione?: string | number;
  tipoRichiesta: string;
  stato: string;
  descrizione: string | null;
  pazienteId: number;
  pazienteNome: string;
  pazienteCognome: string;
}

@Injectable({ providedIn: 'root' })
export class RichiestaMedicaApiService {
  private readonly baseUrl = `${environment.apiUrl}/api/richieste-mediche`;

  constructor(private http: HttpClient) {}

  /**
   * Recupera tutte le richieste del paziente loggato (GET /api/richieste-mediche/mie-richieste).
   */
  getMieRichieste(): Observable<
    { success: true; data: RichiestaPaziente[] } | { success: false; error: string }
  > {
    return this.http
      .get<RichiestaMedicaResponse[] | { content?: RichiestaMedicaResponse[] }>(`${this.baseUrl}/mie-richieste`, {
        withCredentials: true
      })
      .pipe(
        map(body => {
          const list = Array.isArray(body) ? body : (body?.content ?? []);
          return {
            success: true as const,
            data: (list || []).map((r: RichiestaMedicaResponse) => this.mapToRichiestaPaziente(r))
          };
        }),
        catchError((err: HttpErrorResponse) =>
          of({
            success: false as const,
            error: this.extractErrorMessage(err)
          })
        )
      );
  }

  private mapToRichiestaPaziente(r: RichiestaMedicaResponse): RichiestaPaziente {
    const rawDate = r.dataEmissione ?? r.data_emissione;
    const dataRichiesta =
      typeof rawDate === 'number' ? new Date(rawDate) : rawDate ? new Date(rawDate as string) : new Date();
    return {
      id: String(r.id),
      tipo: this.tipoRichiestaToLabel(r.tipoRichiesta),
      stato: this.statoToStatoPaziente(r.stato),
      dataRichiesta: isNaN(dataRichiesta.getTime()) ? new Date() : dataRichiesta,
      descrizione: r.descrizione ?? undefined
    };
  }

  private tipoRichiestaToLabel(tipo: string): string {
    const labels: Record<string, string> = {
      VISITA: 'Visita',
      PRESCRIZIONE: 'Prescrizione',
      ESAME: 'Esame',
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
      case 'SCADUTA':
        return 'rifiutata';
      default:
        return 'in_attesa';
    }
  }

  /**
   * Recupera tutte le richieste del medico curante loggato (GET /api/richieste-mediche/medico/richieste).
   */
  getRichiesteMedico(): Observable<
    { success: true; data: Richiesta[] } | { success: false; error: string }
  > {
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
          of({
            success: false as const,
            error: this.extractErrorMessage(err)
          })
        )
      );
  }

  private mapToRichiestaMedico(r: RichiestaMedicaMedicoResponse): Richiesta {
    const rawDate = r.dataEmissione ?? r.data_emissione;
    const dataRichiesta =
      typeof rawDate === 'number' ? new Date(rawDate) : rawDate ? new Date(rawDate as string) : new Date();
    const statoBackend = (r.stato as StatoRichiesta) ?? 'INVIATA';
    // Mock semplice di priorità lato frontend (in attesa di supporto backend)
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
      stato: statoBackend,
      urgente: priorita === 'URGENTE',
      dataRichiesta: isNaN(dataRichiesta.getTime()) ? new Date() : dataRichiesta,
      priorita,
      descrizione: r.descrizione ?? undefined
    };
  }

  /**
   * Accetta una richiesta (medico curante). PUT /api/richieste-mediche/accetta-richiesta/{id}
   */
  accettaRichiesta(idRichiesta: string): Observable<{ success: true } | { success: false; error: string }> {
    return this.http
      .put<string>(`${this.baseUrl}/accetta-richiesta/${idRichiesta}`, null, {
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

  /**
   * Rifiuta una richiesta con motivazione (medico curante). POST /api/richieste-mediche/rifiuta-richiesta
   */
  rifiutaRichiesta(idRichiesta: number, motivazione: string): Observable<{ success: true } | { success: false; error: string }> {
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
          of({
            success: false as const,
            error: this.extractErrorMessage(err)
          })
        )
      );
  }

  private extractErrorMessage(err: HttpErrorResponse): string {
    if (err.error && typeof err.error === 'string') return err.error;
    if (err.error?.message) return err.error.message;
    if (err.status === 0) return 'Impossibile connettersi al server.';
    return err.message || 'Errore durante l\'invio della richiesta';
  }
}
