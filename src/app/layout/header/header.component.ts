import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { WebSocketMessageService } from '../../core/websocket/websocket-message.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit, OnDestroy {
  showNotifications = false;
  showProfileMenu = false;
  private messageSub: Subscription | null = null;

  constructor(
    protected auth: AuthService,
    private wsService: WebSocketMessageService
  ) {}

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      this.auth.refreshMessagesUnreadCount();
      this.wsService.connect(() => this.auth.getToken()).catch(() => {});
      this.messageSub = this.wsService.onMessage.subscribe(() =>
        this.auth.refreshMessagesUnreadCount()
      );
    }
  }

  ngOnDestroy(): void {
    this.messageSub?.unsubscribe();
  }

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) {
      this.showProfileMenu = false;
    }
  }

  toggleProfileMenu(): void {
    this.showProfileMenu = !this.showProfileMenu;
    if (this.showProfileMenu) {
      this.showNotifications = false;
    }
  }

  get profileInitials(): string {
    const user = this.auth.currentUser();
    if (!user) return 'DB';
    const nome = (user.nome || user.username || '').trim();
    const cognome = (user.cognome || '').trim();
    const first = nome ? nome[0] : '';
    const last = cognome ? cognome[0] : '';
    const initials = (first + last).toUpperCase();
    return initials || 'DB';
  }
}
