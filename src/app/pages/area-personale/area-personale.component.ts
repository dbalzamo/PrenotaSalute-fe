import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../layout/header/header.component';
import { AuthService } from '../../core/auth/auth.service';
import { PazienteApiService, type PazienteUpdateDto } from '../../core/api/paziente-api.service';
import { MedicoApiService } from '../../core/api/medico-api.service';
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
  protected readonly user = this.auth.currentUser;
  protected readonly isEditing = signal(false);
  protected readonly profileLoading = signal(false);
  protected readonly profileSaving = signal(false);
  protected readonly profileError = signal<string | null>(null);

  protected editForm: Partial<User> = {};

  ngOnInit(): void {
    const u = this.user();
    if (!u) return;

    this.profileLoading.set(true);
    this.profileError.set(null);

    if (u.ruolo === 'Paziente') {
      this.pazienteApi.getProfilo().subscribe(result => {
        this.profileLoading.set(false);
        if (result.success) {
          this.auth.updateProfile(result.data);
        } else {
          this.profileError.set(result.error);
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

  protected formatDate(value: string): string {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }
}
