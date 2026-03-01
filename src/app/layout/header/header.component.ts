import { Component } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  showNotifications = false;
  showProfileMenu = false;

  constructor(protected auth: AuthService) {}

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
