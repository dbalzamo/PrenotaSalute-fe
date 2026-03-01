import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { tap, switchMap, of } from 'rxjs';
import type { User, UserRole } from '../../models/user.model';
import { AuthApiService, type LoginResponse, type SignupRequest } from '../api/auth-api.service';
import { MessageApiService } from '../api/message-api.service';

const STORAGE_KEY = 'prenota_salute_user';
const TOKEN_KEY = 'prenota_salute_token';

export interface NotificationItem {
  id: string;
  paziente: string;
  tipo: string;
  priorita?: 'URGENTE' | 'BREVE' | 'DIFFERIBILE';
  data: Date;
  descrizione?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSignal = signal<User | null>(this.loadFromStorage());
  private notificationsSignal = signal<NotificationItem[]>([]);

  currentUser = this.currentUserSignal.asReadonly();
  notificationItems = this.notificationsSignal.asReadonly();
  isAuthenticated = computed(() => this.currentUserSignal() !== null);
  notificationsCount = signal(0);
  /** Conteggio messaggi non letti (Posta). Aggiornato con refreshMessagesUnreadCount(). */
  messagesUnreadCount = signal(0);

  constructor(
    private router: Router,
    private authApi: AuthApiService,
    private messageApi: MessageApiService
  ) {}

  private loadFromStorage(): User | null {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  private saveToStorage(user: User | null): void {
    if (user) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }

  private mapRoleFromBackend(ruoli: string[]): UserRole {
    if (ruoli?.some(r => r === 'ROLE_MEDICO_CURANTE')) {
      return 'Medico_Curante';
    }
    return 'Paziente';
  }

  private mapResponseToUser(data: LoginResponse, merge?: Partial<User>): User {
    const ruolo = this.mapRoleFromBackend(data.ruoli || []);
    const base: User = {
      id: String(data.id),
      username: data.username,
      email: data.email,
      nome: data.username.split('@')[0],
      cognome: '',
      ruolo
    };
    return merge ? { ...base, ...merge } : base;
  }

  login(username: string, password: string) {
    return this.authApi.login({ username, password }).pipe(
      tap(result => {
        if (result.success && result.data.token) {
          this.setToken(result.data.token);
          const current = this.currentUserSignal();
          const now = new Date().toISOString();
          const user: User = {
            ...this.mapResponseToUser(result.data),
            previousLoginAt: current?.lastLoginAt ?? undefined,
            lastLoginAt: now
          };
          this.currentUserSignal.set(user);
          this.saveToStorage(user);
        }
      })
    );
  }

  register(signupRequest: SignupRequest) {
    return this.authApi.signup(signupRequest).pipe(
      switchMap(signupResult => {
        if (signupResult.success) {
          return this.authApi.login({
            username: signupRequest.username,
            password: signupRequest.password
          });
        }
        return of(signupResult);
      }),
      tap(loginResult => {
        if (loginResult.success && 'data' in loginResult && loginResult.data.token) {
          this.setToken(loginResult.data.token);
          const current = this.currentUserSignal();
          const now = new Date().toISOString();
          const merge: Partial<User> = {
            nome: signupRequest.nome,
            cognome: signupRequest.cognome,
            codiceFiscale: signupRequest.codiceFiscale,
            indirizzoDiResidenza: signupRequest.indirizzoDiResidenza,
            dataDiNascita: signupRequest.dataDiNascita,
            specializzazione: signupRequest.specializzazione,
            previousLoginAt: current?.lastLoginAt ?? undefined,
            lastLoginAt: now
          };
          const user = this.mapResponseToUser(loginResult.data, merge);
          this.currentUserSignal.set(user);
          this.saveToStorage(user);
        }
      })
    );
  }

  /** Aggiorna il profilo utente corrente (locale + storage). */
  updateProfile(partial: Partial<User>): void {
    const current = this.currentUserSignal();
    if (!current) return;
    const updated: User = { ...current, ...partial };
    this.currentUserSignal.set(updated);
    this.saveToStorage(updated);
  }

  logout(): void {
    this.authApi.logout().subscribe({
      next: () => this.clearAndRedirect(),
      error: () => this.clearAndRedirect()
    });
  }

  private clearAndRedirect(): void {
    this.currentUserSignal.set(null);
    this.saveToStorage(null);
    this.clearToken();
    this.notificationsCount.set(0);
    this.messagesUnreadCount.set(0);
    this.router.navigate(['/login']);
  }

  private setToken(token: string): void {
    sessionStorage.setItem(TOKEN_KEY, token);
  }

  private clearToken(): void {
    sessionStorage.removeItem(TOKEN_KEY);
  }

  /** Token JWT per richieste autenticate (es. WebSocket handshake). */
  getToken(): string | null {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  getDashboardRoute(): string {
    const user = this.currentUserSignal();
    if (!user) return '/login';
    return user.ruolo === 'Medico_Curante' ? '/medico-curante' : '/paziente';
  }

  setNotificationsCount(count: number): void {
    this.notificationsCount.set(count);
  }

  setNotifications(items: NotificationItem[]): void {
    this.notificationsSignal.set(items);
    this.notificationsCount.set(items.length);
  }

  /** Aggiorna il conteggio messaggi non letti (badge Posta). Chiamare dopo login, alla ricezione di un messaggio, o all'apertura della pagina Messaggi. */
  refreshMessagesUnreadCount(): void {
    const user = this.currentUserSignal();
    if (!user?.id) {
      this.messagesUnreadCount.set(0);
      return;
    }
    this.messageApi.getUnreadCount(Number(user.id)).subscribe({
      next: (count) => this.messagesUnreadCount.set(count),
      error: () => this.messagesUnreadCount.set(0)
    });
  }
}

