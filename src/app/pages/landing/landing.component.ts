import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  template: '',
})
export class LandingComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  ngOnInit(): void {
    const route = this.auth.isAuthenticated()
      ? this.auth.getDashboardRoute()
      : '/login';
    this.router.navigateByUrl(route);
  }
}
