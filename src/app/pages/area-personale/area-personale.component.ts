import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../layout/header/header.component';
import { AuthService } from '../../core/auth/auth.service';
import { PazienteApiService, type PazienteUpdateDto } from '../../core/api/paziente-api.service';
import { MedicoApiService } from '../../core/api/medico-api.service';
import { AuthApiService } from '../../core/api/auth-api.service';
import type { User } from '../../models/user.model';

@Component({
  selector: 'app-area-personale',
  standalone: true,
  imports: [RouterLink, HeaderComponent, FormsModule],
  templateUrl: './area-personale.component.html',
  styleUrl: './area-personale.component.scss'
})
export class AreaPersonaleComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly pazienteApi = inject(PazienteApiService);
  protected readonly medicoApi = inject(MedicoApiService);
  protected readonly authApi = inject(AuthApiService);
  protected readonly user = this.auth.currentUser;
  protected readonly isEditing = signal(false);
  protected readonly profileLoading = signal(false);
  protected readonly profileSaving = signal(false);
  protected readonly profileError = signal<string | null>(null);

  /** Solo paziente: medico curante associato. */
  protected readonly medicoCuranteNome = signal<string | null>(null);
  protected readonly mediciDisponibili = signal<{ id: number; nome: string; cognome: string }[]>([]);
  protected medicoSelezionatoId: number | null = null;
  protected readonly medicoSalvataggio = signal(false);
  protected readonly medicoMessaggio = signal<string | null>(null);
  protected readonly medicoErrore = signal<string | null>(null);

  /** Cambio username (PUT /api/auth/change-username). */
  protected newUsername = '';
  protected readonly accountUsernameSaving = signal(false);
  protected readonly accountUsernameError = signal<string | null>(null);
  protected readonly accountUsernameSuccess = signal<string | null>(null);

  /** Cambio password (PUT /api/auth/change-password). */
  protected passwordForm = { oldPassword: '', newPassword: '', confirmPassword: '' };
  protected readonly accountPasswordSaving = signal(false);
  protected readonly accountPasswordError = signal<string | null>(null);
  protected readonly accountPasswordSuccess = signal<string | null>(null);

  protected editForm: Partial<User> = {};

  ngOnInit(): void {
    const u = this.user();
    if (!u) return;

    this.profileLoading.set(true);
    this.profileError.set(null);
    this.newUsername = (u.username ?? '').trim();

    if (u.ruolo === 'Paziente') {
      this.pazienteApi.getProfilo().subscribe(result => {
        this.profileLoading.set(false);
        if (result.success) {
          this.auth.updateProfile(result.data);
        } else {
          this.profileError.set(result.error);
        }
      });
      this.authApi.getMediciCuranti().subscribe(list => this.mediciDisponibili.set(list ?? []));
      this.pazienteApi.getMioMedicoCurante().subscribe(m => {
        if (m.success && m.data) {
          this.medicoCuranteNome.set(`${m.data.nome} ${m.data.cognome}`.trim());
          this.medicoSelezionatoId = m.data.id;
        } else {
          this.medicoCuranteNome.set(null);
          this.medicoSelezionatoId = null;
        }
      });
    } else if (u.ruolo === 'Medico_Curante') {
      this.medicoApi.getProfilo().subscribe(result => {
        this.profileLoading.set(false);
        if (result.success) {
          this.auth.updateProfile(result.data);
        } else {
          this.profileError.set(result.error);
        }
      });
    } else {
      this.profileLoading.set(false);
    }
  }

  protected startEdit(): void {
    const u = this.user();
    if (!u) return;
    this.profileError.set(null);
    this.editForm = {
      nome: u.nome ?? '',
      cognome: u.cognome ?? '',
      email: u.email ?? '',
      codiceFiscale: u.codiceFiscale ?? '',
      indirizzoDiResidenza: u.indirizzoDiResidenza ?? '',
      dataDiNascita: u.dataDiNascita ?? '',
      specializzazione: u.specializzazione ?? ''
    };
    this.isEditing.set(true);
  }

  protected cancelEdit(): void {
    this.isEditing.set(false);
    this.editForm = {};
  }

  protected saveProfile(): void {
    const u = this.user();
    if (!u) return;

    const payload: Partial<User> = {
      nome: this.editForm.nome ?? undefined,
      cognome: this.editForm.cognome ?? undefined,
      email: this.editForm.email ?? undefined,
      codiceFiscale: this.editForm.codiceFiscale || undefined,
      indirizzoDiResidenza: this.editForm.indirizzoDiResidenza || undefined,
      dataDiNascita: this.editForm.dataDiNascita || undefined,
      specializzazione: this.editForm.specializzazione || undefined
    };

    if (u.ruolo === 'Paziente') {
      this.profileError.set(null);
      this.profileSaving.set(true);
      const dto: PazienteUpdateDto = {
        nome: this.editForm.nome ?? '',
        cognome: this.editForm.cognome ?? '',
        email: this.editForm.email ?? '',
        codiceFiscale: this.editForm.codiceFiscale ?? '',
        indirizzoDiResidenza: this.editForm.indirizzoDiResidenza ?? '',
        dataDiNascita: this.editForm.dataDiNascita ?? ''
      };
      this.pazienteApi.updatePaziente(dto).subscribe(result => {
        this.profileSaving.set(false);
        if (result.success) {
          this.auth.updateProfile(payload);
          this.isEditing.set(false);
          this.editForm = {};
        } else {
          this.profileError.set(result.error);
        }
      });
    } else {
      this.auth.updateProfile(payload);
      this.isEditing.set(false);
      this.editForm = {};
    }
  }

  protected cambiaUsername(): void {
    const u = this.user();
    if (!u) return;
    const trimmed = this.newUsername.trim();
    this.accountUsernameError.set(null);
    this.accountUsernameSuccess.set(null);
    if (trimmed.length < 3) {
      this.accountUsernameError.set('Lo username deve avere almeno 3 caratteri.');
      return;
    }
    if (trimmed.length > 50) {
      this.accountUsernameError.set('Lo username non può superare i 50 caratteri.');
      return;
    }
    if (trimmed === (u.username ?? '').trim()) {
      this.accountUsernameError.set('Il nuovo username coincide con quello attuale.');
      return;
    }
    this.accountUsernameSaving.set(true);
    this.authApi.changeUsername(trimmed).subscribe(result => {
      this.accountUsernameSaving.set(false);
      if (result.success) {
        this.auth.refreshSessionAfterUsernameChange(result.data);
        this.accountUsernameSuccess.set(
          result.data.message ?? 'Username aggiornato. Le richieste useranno il nuovo token.'
        );
      } else {
        this.accountUsernameError.set(result.error);
      }
    });
  }

  protected cambiaPassword(): void {
    const { oldPassword, newPassword, confirmPassword } = this.passwordForm;
    this.accountPasswordError.set(null);
    this.accountPasswordSuccess.set(null);
    if (!oldPassword) {
      this.accountPasswordError.set('Inserisci la password attuale.');
      return;
    }
    if (newPassword.length < 6) {
      this.accountPasswordError.set('La nuova password deve avere almeno 6 caratteri.');
      return;
    }
    if (newPassword !== confirmPassword) {
      this.accountPasswordError.set('La conferma non coincide con la nuova password.');
      return;
    }
    if (oldPassword === newPassword) {
      this.accountPasswordError.set('La nuova password deve essere diversa da quella attuale.');
      return;
    }
    this.accountPasswordSaving.set(true);
    this.authApi.changePassword(oldPassword, newPassword).subscribe(result => {
      this.accountPasswordSaving.set(false);
      if (result.success) {
        this.passwordForm = { oldPassword: '', newPassword: '', confirmPassword: '' };
        this.accountPasswordSuccess.set(result.message);
      } else {
        this.accountPasswordError.set(result.error);
      }
    });
  }

  protected salvaMedicoCurante(): void {
    const id = this.medicoSelezionatoId;
    if (id == null || id <= 0) {
      this.medicoErrore.set('Seleziona un medico curante.');
      return;
    }
    this.medicoErrore.set(null);
    this.medicoMessaggio.set(null);
    this.medicoSalvataggio.set(true);
    this.pazienteApi.setMioMedicoCurante(id).subscribe(res => {
      this.medicoSalvataggio.set(false);
      if (res.success) {
        this.medicoMessaggio.set('Medico curante aggiornato.');
        const opt = this.mediciDisponibili().find(m => m.id === id);
        if (opt) {
          this.medicoCuranteNome.set(`${opt.nome} ${opt.cognome}`.trim());
        }
      } else {
        this.medicoErrore.set(res.error);
      }
    });
  }

  protected formatDate(value: string): string {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }
}
