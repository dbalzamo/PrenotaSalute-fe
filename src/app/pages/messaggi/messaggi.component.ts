import {
  Component,
  signal,
  inject,
  OnInit,
  OnDestroy,
  computed
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../layout/header/header.component';
import { AuthService } from '../../core/auth/auth.service';
import {
  MessageApiService,
  type MessageResponse,
  type MedicoCuranteResponse,
  type PazientePerMessaggio,
  type ConversazionePreview
} from '../../core/api/message-api.service';
import { WebSocketMessageService } from '../../core/websocket/websocket-message.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-messaggi',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent],
  templateUrl: './messaggi.component.html',
  styleUrl: './messaggi.component.scss'
})
export class MessaggiComponent implements OnInit, OnDestroy {
  private readonly location = inject(Location);
  private readonly auth = inject(AuthService);
  private readonly messageApi = inject(MessageApiService);
  private readonly wsService = inject(WebSocketMessageService);

  readonly isPaziente = computed(() => this.auth.currentUser()?.ruolo === 'Paziente');
  readonly myAccountId = computed(() => {
    const id = this.auth.currentUser()?.id;
    return id != null ? Number(id) : null;
  });

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly medicoCurante = signal<MedicoCuranteResponse | null>(null);
  readonly pazientiList = signal<PazientePerMessaggio[]>([]);
  /** Per il medico: anteprime conversazioni (nome, ultimo messaggio, orario, non letti). */
  readonly conversationPreviews = signal<ConversazionePreview[]>([]);
  readonly selectedPaziente = signal<PazientePerMessaggio | null>(null);

  /** Controparte della conversazione: id account e nome da mostrare. */
  readonly receiverId = signal<number | null>(null);
  readonly otherPartyName = signal<string>('');

  readonly messages = signal<MessageResponse[]>([]);
  readonly nuovoMessaggio = signal('');
  readonly wsConnected = signal(false);
  readonly sending = signal(false);

  /** Per il medico: accountId del paziente -> numero di messaggi non letti da quel paziente. */
  readonly unreadBySender = signal<Record<number, number>>({});

  private sub = new Subscription();

  ngOnInit(): void {
    this.loading.set(true);
    this.error.set(null);

    const myId = this.myAccountId();
    if (myId == null) {
      this.loading.set(false);
      this.error.set('Utente non autenticato.');
      return;
    }
    this.auth.refreshMessagesUnreadCount();

    if (this.isPaziente()) {
      this.messageApi.getMioMedicoCurante().subscribe({
        next: result => {
          this.loading.set(false);
          if (result.success && result.data?.account?.id != null) {
            this.medicoCurante.set(result.data);
            this.receiverId.set(result.data.account.id);
            this.otherPartyName.set(`${result.data.nome} ${result.data.cognome}`.trim() || 'Medico');
            this.loadConversationAndConnect();
          } else {
            this.error.set(result.success ? 'Medico senza account.' : (result.error ?? 'Errore'));
          }
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Impossibile caricare i dati. Riprova più tardi.');
        }
      });
    } else {
      this.messageApi.getConversazioni().subscribe({
        next: list => {
          this.conversationPreviews.set(list);
          this.pazientiList.set(list.map(c => ({ id: c.id, nome: c.nome, cognome: c.cognome, accountId: c.accountId })));
          this.loading.set(false);
          if (list.length === 0) {
            this.error.set('Nessun paziente associato.');
          } else {
            this.connectWebSocketForMedico();
          }
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Impossibile caricare l\'elenco conversazioni. Riprova più tardi.');
        }
      });
    }
  }

  /** Connette il WebSocket all'apertura della Posta (medico) per ricevere messaggi in tempo reale. */
  private connectWebSocketForMedico(): void {
    this.wsService
      .connect(() => this.auth.getToken())
      .then(() => this.wsConnected.set(true))
      .catch(err => {
        console.error('WebSocket connect error', err);
        this.wsConnected.set(false);
      });

    this.sub.add(
      this.wsService.onMessage.subscribe(msg => {
        const myId = this.myAccountId();
        if (myId == null) return;
        if (msg.receiverId === myId && msg.senderId !== myId) {
          this.unreadBySender.update(m => ({
            ...m,
            [msg.senderId]: (m[msg.senderId] ?? 0) + 1
          }));
          this.updatePreviewForMessage(msg.senderId, msg.content, msg.sentAt);
        }
        const recId = this.receiverId();
        const isForOpenConversation =
          recId != null &&
          ((msg.senderId === recId && msg.receiverId === myId) ||
            (msg.senderId === myId && msg.receiverId === recId));
        if (isForOpenConversation) {
          this.messages.update(list => {
            if (list.some(m => m.id === msg.id)) return list;
            return [...list, msg].sort(
              (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
            );
          });
        }
      })
    );
  }

  /** Aggiorna anteprima conversazione quando arriva un messaggio (lista chat in tempo reale). */
  private updatePreviewForMessage(senderId: number, content: string, sentAt: string): void {
    const maxLen = 50;
    const preview = !content ? '' : content.length <= maxLen ? content : content.substring(0, maxLen) + '…';
    this.conversationPreviews.update(list => {
      const updated = list.map(c =>
        c.accountId === senderId
          ? { ...c, lastMessagePreview: preview, lastMessageAt: sentAt }
          : c
      );
      return updated.sort((a, b) => {
        if (!a.lastMessageAt) return 1;
        if (!b.lastMessageAt) return -1;
        return b.lastMessageAt.localeCompare(a.lastMessageAt);
      });
    });
  }

  /** Seleziona un paziente (ruolo medico) e carica conversazione. WebSocket già connesso. */
  selectPaziente(c: ConversazionePreview): void {
    this.selectedPaziente.set({ id: c.id, nome: c.nome, cognome: c.cognome, accountId: c.accountId });
    this.receiverId.set(c.accountId);
    this.otherPartyName.set(`${c.nome} ${c.cognome}`.trim() || 'Paziente');
    this.error.set(null);
    this.clearUnreadFor(c.accountId);
    this.loadConversationOnly();
  }

  clearUnreadFor(accountId: number): void {
    this.unreadBySender.update(m => {
      const next = { ...m };
      delete next[accountId];
      return next;
    });
    this.conversationPreviews.update(list =>
      list.map(c => c.accountId === accountId ? { ...c, unreadCount: 0 } : c)
    );
  }

  private loadConversationAndConnect(): void {
    const myId = this.myAccountId();
    const recId = this.receiverId();
    if (myId == null || recId == null) return;

    this.messageApi.getConversation(myId, recId).subscribe(conversation => {
      this.messages.set(conversation);
      this.markAsReadFromOther(recId, myId);
    });

    this.wsService
      .connect(() => this.auth.getToken())
      .then(() => this.wsConnected.set(true))
      .catch(err => {
        console.error('WebSocket connect error', err);
        this.wsConnected.set(false);
      });

    this.sub.add(
      this.wsService.onMessage.subscribe(msg => {
        const myId2 = this.myAccountId();
        const recId2 = this.receiverId();
        if (myId2 == null || recId2 == null) return;
        const isForThisConversation =
          (msg.senderId === recId2 && msg.receiverId === myId2) ||
          (msg.senderId === myId2 && msg.receiverId === recId2);
        if (isForThisConversation) {
          this.messages.update(list => {
            if (list.some(m => m.id === msg.id)) return list;
            return [...list, msg].sort(
              (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
            );
          });
        }
      })
    );
  }

  /** Solo caricamento conversazione (medico: WS già connesso). */
  private loadConversationOnly(): void {
    const myId = this.myAccountId();
    const recId = this.receiverId();
    if (myId == null || recId == null) return;

    this.messageApi.getConversation(myId, recId).subscribe(conversation => {
      this.messages.set(conversation);
      this.markAsReadFromOther(recId, myId);
    });
  }

  private markAsReadFromOther(senderId: number, receiverId: number): void {
    this.messageApi.markAsRead(senderId, receiverId).subscribe({
      next: () => this.auth.refreshMessagesUnreadCount()
    });
  }

  invia(): void {
    const testo = this.nuovoMessaggio().trim();
    const recId = this.receiverId();
    const myId = this.myAccountId();
    if (!testo || recId == null || myId == null || this.sending()) return;

    this.sending.set(true);
    this.error.set(null);

    const addOptimistic = () => {
      const optimistic: MessageResponse = {
        id: -Date.now(),
        senderId: myId,
        receiverId: recId,
        content: testo,
        sentAt: new Date().toISOString(),
        read: false
      };
      this.messages.update(list =>
        [...list, optimistic].sort(
          (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
        )
      );
      this.nuovoMessaggio.set('');
      if (!this.isPaziente()) {
        this.updatePreviewForMessage(recId, testo, optimistic.sentAt);
      }
    };

    let usedRestFallback = false;
    this.wsService
      .connect(() => this.auth.getToken())
      .then(() => {
        this.wsConnected.set(true);
        if (this.wsService.isConnected) {
          this.wsService.send(recId, testo);
          addOptimistic();
        } else {
          usedRestFallback = true;
          this.sendViaRest(recId, testo);
        }
      })
      .catch(() => {
        usedRestFallback = true;
        this.sendViaRest(recId, testo);
      })
      .finally(() => {
        if (!usedRestFallback) this.sending.set(false);
      });
  }

  /** Fallback: invia messaggio via REST e aggiorna la lista. */
  private sendViaRest(recId: number, testo: string): void {
    this.messageApi.sendMessage(recId, testo).subscribe({
      next: msg => {
        this.messages.update(list => {
          const filtered = list.filter(m => m.id !== msg.id && !(m.id < 0 && m.content === msg.content));
          return [...filtered, msg].sort(
            (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
          );
        });
        this.nuovoMessaggio.set('');
      },
      error: err => {
        console.error('Invio messaggio REST error', err);
        this.error.set('Impossibile inviare. Verifica la connessione e riprova.');
      },
      complete: () => this.sending.set(false)
    });
  }

  isFromMe(msg: MessageResponse): boolean {
    return msg.senderId === this.myAccountId();
  }

  getUnreadCount(accountId: number): number {
    return this.unreadBySender()[accountId] ?? 0;
  }

  /** Non letti mostrati in lista: da API (preview) + messaggi arrivati in sessione (unreadBySender). */
  getDisplayUnreadCount(c: ConversazionePreview): number {
    return c.unreadCount + (this.unreadBySender()[c.accountId] ?? 0);
  }

  /** Formatta orario ultimo messaggio per la lista chat (breve: oggi HH:mm, altrimenti gg/mm). */
  formatLastMessageAt(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (sameDay) {
      return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (sameDay) {
      return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  tornaIndietro(): void {
    this.location.back();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
