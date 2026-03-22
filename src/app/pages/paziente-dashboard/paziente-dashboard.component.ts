import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import type { RichiestaPaziente, StatoRichiestaPaziente } from '../../models/richiesta.model';
import { HeaderComponent } from '../../layout/header/header.component';
import { AuthService } from '../../core/auth/auth.service';
import { RichiestaMedicaApiService, type TipoRichiesta } from '../../core/api/richiesta-medica-api.service';
import { PazienteApiService } from '../../core/api/paziente-api.service';
import { ImpegnativaApiService } from '../../core/api/impegnativa-api.service';

@Component({
  selector: 'app-paziente-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent, RouterLink],
  templateUrl: './paziente-dashboard.component.html',
  styleUrl: './paziente-dashboard.component.scss'
})
export class PazienteDashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly richiestaMedicaApi = inject(RichiestaMedicaApiService);
  private readonly pazienteApi = inject(PazienteApiService);
  private readonly impegnativaApi = inject(ImpegnativaApiService);

  /** Opzioni per tipo richiesta (ETipoRichiesta backend) */
  readonly tipiRichiesta: { value: TipoRichiesta; label: string }[] = [
    { value: 'VISITA', label: 'Visita' },
    { value: 'PRESCRIZIONE', label: 'Prescrizione' },
    { value: 'ESAME', label: 'Esame' },
    { value: 'CONTROLLO_REFERTI', label: 'Controllo referti' },
    { value: 'ALTRO', label: 'Altro' }
  ];

  /** Nome breve usato nel saluto iniziale (fallback generico se l'utente non è caricato). */
  nomeUtente = this.authService.currentUser()?.nome ?? 'Utente';
  /** Nome e cognome completi del paziente, usati nelle card richieste. */
  pazienteNomeCompleto = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return this.nomeUtente;
    const nome = user.nome || user.username || this.nomeUtente;
    const cognome = user.cognome || '';
    const full = `${nome} ${cognome}`.trim();
    return full || this.nomeUtente;
  });
  /** Iniziali del paziente mostrate nell'avatar (es. "DB"). */
  pazienteInitials = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return 'UT';
    const nome = (user.nome || user.username || '').trim();
    const cognome = (user.cognome || '').trim();
    const first = nome ? nome[0] : '';
    const last = cognome ? cognome[0] : '';
    const initials = (first + last).toUpperCase();
    return initials || 'UT';
  });
  searchQuery = signal('');
  /** Filtri avanzati */
  showFilters = signal(false);
  /** Stati selezionati (vuoto = tutti) */
  statiFilter = signal<StatoRichiestaPaziente[]>([]);
  /** Periodo in giorni (string) */
  periodFilter = signal<string>('30');

  readonly PERIODI_OPTIONS: { value: string; label: string }[] = [
    { value: '7', label: 'Ultimi 7 giorni' },
    { value: '30', label: 'Ultimi 30 giorni' },
    { value: '90', label: 'Ultimi 90 giorni' }
  ];

  readonly STATI_FILTER_OPTIONS: { value: StatoRichiestaPaziente; label: string }[] = [
    { value: 'accettata', label: 'Accettata' },
    { value: 'rifiutata', label: 'Rifiutata' },
    { value: 'prenotata', label: 'Prenotata' }
  ];

  /** Modale nuova richiesta */
  modaleNuovaRichiestaAperta = signal(false);
  modaleInInvio = signal(false);
  modaleErrore = signal<string | null>(null);
  modaleSuccesso = signal(false);
  formRichiesta = {
    tipoRichiesta: 'VISITA' as TipoRichiesta,
    descrizione: '',
    idMedico: null as number | null
  };

  richieste = signal<RichiestaPaziente[]>([]);
  richiesteLoading = signal(false);
  richiesteError = signal<string | null>(null);
  /** Messaggio dopo tentativo fallito di download PDF impegnativa. */
  impegnativaPdfErrore = signal<string | null>(null);

  /** Id medico curante (entità MedicoCurante) per POST crea-richiesta. */
  medicoCuranteId = signal<number | null>(null);
  /** Etichetta letta da GET /api/v1/pazienti/mio-medico. */
  medicoCuranteEtichetta = signal<string | null>(null);
  medicoCuranteAvviso = signal<string | null>(null);

  ngOnInit(): void {
    this.caricaMedicoCurante();
    this.caricaRichieste();
  }

  caricaMedicoCurante(): void {
    this.medicoCuranteAvviso.set(null);
    this.pazienteApi.getMioMedicoCurante().subscribe(res => {
      if (res.success && res.data) {
        this.medicoCuranteId.set(res.data.id);
        this.medicoCuranteEtichetta.set(`${res.data.nome} ${res.data.cognome}`.trim());
      } else if (res.success) {
        this.medicoCuranteId.set(null);
        this.medicoCuranteEtichetta.set(null);
        this.medicoCuranteAvviso.set(
          'Nessun medico curante associato. Impostalo dall’area personale per inviare richieste.'
        );
      } else {
        this.medicoCuranteId.set(null);
        this.medicoCuranteEtichetta.set(null);
        this.medicoCuranteAvviso.set(res.error);
      }
    });
  }

  caricaRichieste(): void {
    this.richiesteError.set(null);
    this.richiesteLoading.set(true);
    this.richiestaMedicaApi.getMieRichieste().subscribe(result => {
      this.richiesteLoading.set(false);
      if (result.success) {
        this.richieste.set(result.data);
      } else {
        this.richiesteError.set(result.error);
      }
    });
  }

  richiesteInAttesa = computed(() =>
    this.richieste().filter(r => r.stato === 'in_attesa').length
  );

  totaleRichieste = computed(() => this.richieste().length);

  /** Data reale: accesso precedente all'ultimo (quando ha fatto login la volta prima). */
  ultimaVisita = computed(() => {
    const prev = this.authService.currentUser()?.previousLoginAt;
    if (!prev) return null;
    const d = new Date(prev);
    return isNaN(d.getTime()) ? null : d;
  });

  richiesteFiltrate = computed(() => {
    let result = this.richieste();
    const query = this.searchQuery().toLowerCase();
    const stati = this.statiFilter();
    const period = this.periodFilter();

    if (query) {
      result = result.filter(r =>
        r.tipo.toLowerCase().includes(query)
      );
    }

    if (stati.length > 0) {
      result = result.filter(r => stati.includes(r.stato));
    }

    const days = parseInt(period, 10) || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    result = result.filter(r => r.dataRichiesta >= cutoff);

    return result;
  });

  /**
   * Etichetta stato in elenco e dettaglio.
   * Per richieste accettate distingue l’attesa dell’impegnativa dalla disponibilità del PDF.
   */
  getStatoLabel(stato: StatoRichiestaPaziente, impegnativaId?: number | null): string {
    if (stato === 'accettata') {
      if (impegnativaId != null) {
        return 'Accettata — impegnativa disponibile';
      }
      return 'Accettata — in attesa dell’impegnativa';
    }
    const labels: Record<StatoRichiestaPaziente, string> = {
      in_attesa: 'In attesa',
      accettata: 'Accettata',
      rifiutata: 'Rifiutata',
      prenotata: 'Prenotata',
      scaduta: 'Scaduta'
    };
    return labels[stato];
  }

  getStatoClass(stato: StatoRichiestaPaziente): string {
    return `stato--${stato.replace('_', '-')}`;
  }

  formatDate(date: Date): string {
    const d = new Date(date);
    const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  toggleFilters(): void {
    this.showFilters.update(v => !v);
  }

  isStatoFiltroSelected(stato: StatoRichiestaPaziente): boolean {
    return this.statiFilter().includes(stato);
  }

  toggleStatoFiltro(stato: StatoRichiestaPaziente): void {
    this.statiFilter.update(prev =>
      prev.includes(stato) ? prev.filter(s => s !== stato) : [...prev, stato]
    );
  }

  setPeriod(value: string): void {
    this.periodFilter.set(value);
  }

  scelteAttive = computed(() => {
    const labels: string[] = [];
    this.statiFilter().forEach(s => {
      const opt = this.STATI_FILTER_OPTIONS.find(o => o.value === s);
      if (opt) labels.push(opt.label);
    });
    const periodOpt = this.PERIODI_OPTIONS.find(o => o.value === this.periodFilter());
    if (periodOpt) labels.push(periodOpt.label);
    return labels;
  });

  apriModaleNuovaRichiesta(): void {
    this.modaleErrore.set(null);
    this.modaleSuccesso.set(false);
    this.formRichiesta = {
      tipoRichiesta: 'VISITA',
      descrizione: '',
      idMedico: this.medicoCuranteId()
    };
    this.modaleNuovaRichiestaAperta.set(true);
  }

  chiudiModaleNuovaRichiesta(): void {
    if (!this.modaleInInvio()) {
      this.modaleNuovaRichiestaAperta.set(false);
      this.modaleErrore.set(null);
      this.modaleSuccesso.set(false);
    }
  }

  inviaRichiestaMedica(): void {
    const idMedico = this.formRichiesta.idMedico ?? this.medicoCuranteId();
    if (idMedico == null || idMedico <= 0) {
      this.modaleErrore.set(
        "Associa un medico curante dall'area personale oppure inserisci l'ID del medico curante."
      );
      return;
    }
    if (!this.formRichiesta.descrizione?.trim()) {
      this.modaleErrore.set('Inserisci una descrizione.');
      return;
    }
    this.modaleErrore.set(null);
    this.modaleInInvio.set(true);
    this.richiestaMedicaApi
      .creaRichiesta({
        tipoRichiesta: this.formRichiesta.tipoRichiesta,
        descrizione: this.formRichiesta.descrizione.trim(),
        idMedico
      })
      .subscribe(result => {
        this.modaleInInvio.set(false);
        if (result.success) {
          this.modaleSuccesso.set(true);
          setTimeout(() => {
            this.caricaRichieste();
          }, 300);
          setTimeout(() => {
            this.modaleNuovaRichiestaAperta.set(false);
            this.modaleSuccesso.set(false);
          }, 1500);
        } else {
          this.modaleErrore.set(result.error);
        }
      });
  }

  /** Richiesta selezionata per vedere il dettaglio / messaggio inviato */
  richiestaSelezionata = signal<RichiestaPaziente | null>(null);

  visualizzaRichiesta(richiesta: RichiestaPaziente): void {
    this.richiestaSelezionata.set(richiesta);
  }

  chiudiDettaglioRichiesta(): void {
    this.richiestaSelezionata.set(null);
  }

  /**
   * Scarica il PDF dell’impegnativa (solo dopo emissione da parte del medico).
   */
  scaricaImpegnativaPdf(impegnativaId: number): void {
    this.impegnativaPdfErrore.set(null);
    this.impegnativaApi.downloadPdf(impegnativaId).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `impegnativa-${impegnativaId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.impegnativaPdfErrore.set('Impossibile scaricare il PDF. Riprova tra poco.');
      }
    });
  }
}
