import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { MessageResponse } from '../api/message-api.service';
import { AuthService } from '../auth/auth.service';

/** Client STOMP (tipo minimo per evitare dipendenza statica da @stomp/stompjs). */
interface StompClientLike {
  subscribe(dest: string, callback: (msg: { body: string }) => void): void;
  activate(): void;
  deactivate(): void;
  connected: boolean;
  publish(params: { destination: string; body: string }): void;
}

/** Servizio WebSocket STOMP per messaggistica real-time. Connessione a /ws con JWT in query. */
@Injectable({ providedIn: 'root' })
export class WebSocketMessageService implements OnDestroy {
  private client: StompClientLike | null = null;
  private readonly incomingMessage$ = new Subject<MessageResponse>();
  private connectionPromise: Promise<void> | null = null;

  constructor(private auth: AuthService) {}

  /** Stream dei messaggi in arrivo (solo dopo connect). */
  get onMessage(): Observable<MessageResponse> {
    return this.incomingMessage$.asObservable();
  }

  /**
   * Connette al broker WebSocket e si sottoscrive a /user/queue/messages.
   * Passa il token JWT in query per l'handshake.
   * Se già connesso o in connessione, restituisce la stessa promise.
   */
  connect(getToken: () => string | null): Promise<void> {
    if (this.connectionPromise) return this.connectionPromise;

    const token = getToken();
    if (!token) {
      return Promise.reject(new Error('Token mancante'));
    }

    const wsPath = `${environment.apiUrl}/ws`;
    const url = this.buildWsUrl(wsPath, token);

    this.connectionPromise = (async () => {
      const [stompModule, sockjsModule] = await Promise.all([
        import('@stomp/stompjs'),
        import('sockjs-client')
      ]);
      const Client = stompModule.Client as new (config: unknown) => StompClientLike;
      const SockJS = sockjsModule.default;

      return new Promise<void>((resolve, reject) => {
        this.client = new Client({
          webSocketFactory: () => new SockJS(url) as unknown as WebSocket,
          onConnect: () => {
            this.client!.subscribe('/user/queue/messages', (msg: { body: string }) => {
              try {
                const body = JSON.parse(msg.body) as MessageResponse;
                this.incomingMessage$.next(body);
                this.auth.refreshMessagesUnreadCount();
              } catch (e) {
                console.error('Parse message error', e);
              }
            });
            resolve();
          },
          onStompError: (frame: { headers?: { message?: string } }) => {
            console.error('STOMP error', frame);
            reject(new Error(frame.headers?.message || 'WebSocket error'));
          }
        });
        this.client.activate();
      });
    })();

    return this.connectionPromise;
  }

  private buildWsUrl(path: string, token: string): string {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const sep = path.startsWith('/') ? '' : '/';
    return `${base}${sep}${path}?token=${encodeURIComponent(token)}`;
  }

  /** Invia un messaggio (il backend imposta senderId dall'utente autenticato). Non invia se non connesso. */
  send(receiverId: number, content: string): void {
    if (!this.client?.connected) {
      console.error('WebSocket non connesso');
      return;
    }
    this.client.publish({
      destination: '/app/chat.send',
      body: JSON.stringify({ senderId: 0, receiverId, content })
    });
  }

  /** true se il client STOMP è connesso. */
  get isConnected(): boolean {
    return !!this.client?.connected;
  }

  disconnect(): void {
    if (this.client) {
      try {
        this.client.deactivate();
      } catch (_) {}
      this.client = null;
      this.connectionPromise = null;
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
