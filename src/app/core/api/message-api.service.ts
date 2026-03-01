import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Messaggio come restituito dal backend (MessageResponse). */
export interface MessageResponse {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  sentAt: string;
  read: boolean;
}

/** Payload per invio messaggio via WebSocket (MessageDTO). */
export interface MessageDTO {
  senderId: number;
  receiverId: number;
  content: string;
}

/** Medico curante come restituito da GET /api/paziente/mio-medico (include account per accountId). */
export interface MedicoCuranteResponse {
  id: number;
  nome: string;
  cognome: string;
  account?: { id: number; username: string; email: string };
}

/** Paziente in elenco per il medico (GET /api/medico/pazienti). */
export interface PazientePerMessaggio {
  id: number;
  nome: string;
  cognome: string;
  accountId: number;
}

/** Anteprima conversazione per lista chat medico (GET /api/medico/conversazioni). */
export interface ConversazionePreview {
  id: number;
  nome: string;
  cognome: string;
  accountId: number;
  lastMessagePreview: string;
  lastMessageAt: string;
  unreadCount: number;
}

@Injectable({ providedIn: 'root' })
export class MessageApiService {
  private readonly baseUrl = `${environment.apiUrl}/api`;

  constructor(private http: HttpClient) {}

  /** Carica lo storico della conversazione tra due account (userId = account id). */
  getConversation(userId1: number, userId2: number): Observable<MessageResponse[]> {
    return this.http
      .get<MessageResponse[]>(`${this.baseUrl}/messages/conversation`, {
        params: { userId1: String(userId1), userId2: String(userId2) },
        withCredentials: true
      })
      .pipe(
        catchError((err: HttpErrorResponse) => {
          console.error('getConversation error', err);
          return of([]);
        })
      );
  }

  /** Conteggio messaggi non letti per l'utente (account id). */
  getUnreadCount(userId: number): Observable<number> {
    return this.http
      .get<number>(`${this.baseUrl}/messages/unread/count`, {
        params: { userId: String(userId) },
        withCredentials: true
      })
      .pipe(
        catchError(() => of(0))
      );
  }

  /** Segna come letti i messaggi da senderId verso receiverId (solo il destinatario). */
  markAsRead(senderId: number, receiverId: number): Observable<void> {
    return this.http.put<void>(
      `${this.baseUrl}/messages/read`,
      null,
      {
        params: { senderId: String(senderId), receiverId: String(receiverId) },
        withCredentials: true
      }
    );
  }

  /** Restituisce il medico curante associato al paziente loggato (per Posta). 404 se non assegnato. */
  getMioMedicoCurante(): Observable<{ success: true; data: MedicoCuranteResponse } | { success: false; error: string }> {
    return this.http
      .get<MedicoCuranteResponse>(`${this.baseUrl}/paziente/mio-medico`, { withCredentials: true })
      .pipe(
        map(data => ({ success: true as const, data })),
        catchError((err: HttpErrorResponse) =>
          of({
            success: false as const,
            error: err.status === 404 ? 'Nessun medico curante associato.' : this.extractErrorMessage(err)
          })
        )
      );
  }

  /** Associa il medico curante al paziente loggato. */
  setMioMedicoCurante(medicoCuranteId: number): Observable<{ success: true } | { success: false; error: string }> {
    return this.http
      .put<string>(`${this.baseUrl}/paziente/mio-medico`, { medicoCuranteId }, { withCredentials: true })
      .pipe(
        map(() => ({ success: true as const })),
        catchError((err: HttpErrorResponse) =>
          of({ success: false as const, error: this.extractErrorMessage(err) })
        )
      );
  }

  /** Elenco pazienti del medico (per messaggistica). Solo per ruolo MEDICO_CURANTE. */
  getPazienti(): Observable<PazientePerMessaggio[]> {
    return this.http
      .get<PazientePerMessaggio[]>(`${this.baseUrl}/medico/pazienti`, { withCredentials: true })
      .pipe(
        catchError(() => of([]))
      );
  }

  /** Anteprima conversazioni medico: pazienti con ultimo messaggio, orario e non letti (lista chat stile WhatsApp). */
  getConversazioni(): Observable<ConversazionePreview[]> {
    return this.http
      .get<ConversazionePreview[]>(`${this.baseUrl}/medico/conversazioni`, { withCredentials: true })
      .pipe(
        catchError(() => of([]))
      );
  }

  /** Invia un messaggio via REST (fallback quando WebSocket non disponibile). */
  sendMessage(receiverId: number, content: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(
      `${this.baseUrl}/messages`,
      { receiverId, content },
      { withCredentials: true }
    );
  }

  private extractErrorMessage(err: HttpErrorResponse): string {
    if (err.error && typeof err.error === 'string') return err.error;
    if (err.error?.message) return err.error.message;
    if (err.status === 0) return 'Impossibile connettersi al server.';
    return err.message || 'Errore di rete';
  }
}
