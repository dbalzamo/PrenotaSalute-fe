import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import type { SignupRequest } from '../../core/api/auth-api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  isLoginMode = signal(true);
  errorMessage = signal<string | null>(null);
  isLoading = signal(false);

  loginForm: FormGroup;
  registerForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.nonNullable.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });

    this.registerForm = this.fb.nonNullable.group({
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
      nome: ['', Validators.required],
      cognome: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confermaPassword: ['', Validators.required],
      ruolo: ['PAZIENTE' as SignupRequest['ruolo'], Validators.required],
      codiceFiscale: ['', [Validators.required, Validators.minLength(16), Validators.maxLength(16)]],
      indirizzoDiResidenza: ['', Validators.required],
      dataDiNascita: ['', Validators.required],
      specializzazione: ['']
    });
  }

  toggleMode(): void {
    this.isLoginMode.update(m => !m);
    this.errorMessage.set(null);
    this.loginForm.reset();
    this.registerForm.reset({ ruolo: 'PAZIENTE' });
  }

  onSubmitLogin(): void {
    this.errorMessage.set(null);
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    const { username, password } = this.loginForm.getRawValue();

    this.auth.login(username, password).subscribe({
      next: result => {
        this.isLoading.set(false);
        if (result.success) {
          this.router.navigate([this.auth.getDashboardRoute()]);
        } else {
          this.errorMessage.set(result.error ?? 'Errore durante l\'accesso');
        }
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('Errore di connessione');
      }
    });
  }

  onSubmitRegister(): void {
    this.errorMessage.set(null);
    if (this.registerForm.invalid) {
      if (this.registerForm.get('password')?.value !== this.registerForm.get('confermaPassword')?.value) {
        this.errorMessage.set('Le password non coincidono');
      }
      this.registerForm.markAllAsTouched();
      return;
    }

    const { password, confermaPassword } = this.registerForm.getRawValue();
    if (password !== confermaPassword) {
      this.errorMessage.set('Le password non coincidono');
      return;
    }

    this.isLoading.set(true);
    const formValue = this.registerForm.getRawValue();

    const signupRequest: SignupRequest = {
      username: formValue.username,
      email: formValue.email,
      password: formValue.password,
      ruolo: formValue.ruolo,
      nome: formValue.nome,
      cognome: formValue.cognome,
      codiceFiscale: formValue.codiceFiscale.toUpperCase(),
      indirizzoDiResidenza: formValue.indirizzoDiResidenza,
      dataDiNascita: formValue.dataDiNascita,
      specializzazione: formValue.specializzazione || undefined
    };

    this.auth.register(signupRequest).subscribe({
      next: result => {
        this.isLoading.set(false);
        if (result.success) {
          this.router.navigate([this.auth.getDashboardRoute()]);
        } else {
          this.errorMessage.set(result.error ?? 'Errore durante la registrazione');
        }
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('Errore di connessione');
      }
    });
  }

  passwordDimenticata(): void {
    console.log('Password dimenticata');
  }

  haiBisognoAiuto(): void {
    console.log('Hai bisogno di aiuto');
  }
}
