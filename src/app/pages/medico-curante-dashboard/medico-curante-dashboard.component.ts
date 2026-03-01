import { Component, computed, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { Richiesta, StatoRichiesta } from '../../models/richiesta.model';
import { HeaderComponent } from '../../layout/header/header.component';
import { RichiestaMedicaApiService } from '../../core/api/richiesta-medica-api.service';
import { AuthService, type NotificationItem } from '../../core/auth/auth.service';

@Component({
  selector: 'app-medico-curante-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent],
  templateUrl: './medico-curante-dashboard.component.html',
  styleUrl: './medico-curante-dashboard.component.scss'
})
export class MedicoCuranteDashboardComponent {
  private richiestaApi = inject(RichiestaMedicaApiService);
  private auth = inject(AuthService);
  private pollingHandle: any = null;

  /** Testo digitato nella barra di ricerca sopra la lista. */
  searchQuery = signal('');
  /** Vista corrente per la lista richieste: tabellare oppure a card. */
  viewMode = signal<'list' | 'grid'>('list');
  /** Filtri avanzati: stati selezionati; array vuoto = nessun filtro di stato applicato. */
  statusFilter = signal<string[]>([]);
  /** Filtri avanzati: priorità selezionate (URGENTE, BREVE, DIFFERIBILE). */
  priorityFilter = signal<string[]>([]);
  /** Filtro periodo: numero di giorni da oggi entro cui mostrare le richieste. */
  periodFilter = signal<string>('30');
  /** Pill in alto nella sezione Riepilogo / Attività (tutte, urgenti, ecc.). */
  filtroAttivita = signal<'tutte' | 'urgenti' | 'brevi' | 'differibili' | 'scadute'>('tutte');
  /** Mostra/nasconde il pannello dei filtri chip sotto la search bar. */
  showFilters = signal(false);

  readonly STATI_OPTIONS: { value: StatoRichiesta; label: string }[] = [
    { value: 'INVIATA', label: 'Inviata' },
    { value: 'ACCETTATA', label: 'Accettata' },
    { value: 'RIFIUTATA', label: 'Rifiutata' },
    { value: 'SCADUTA', label: 'Scaduta' }
  ];
  readonly PRIORITA_OPTIONS: { value: string; label: string }[] = [
    { value: 'URGENTE', label: 'Urgente' },
    { value: 'BREVE', label: 'Breve' },
    { value: 'DIFFERIBILE', label: 'Differibile' }
  ];
  readonly PERIODI_OPTIONS: { value: string; label: string }[] = [
    { value: '7', label: 'Ultimi 7 giorni' },
    { value: '30', label: 'Ultimi 30 giorni' },
    { value: '90', label: 'Ultimi 90 giorni' }
  ];

  /** Lista completa delle richieste del medico curante (caricate da backend). */
  richieste = signal<Richiesta[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  /** Richiesta selezionata per il modale "Visualizza" (null = modale chiuso) */
  richiestaSelezionata = signal<Richiesta | null>(null);
  /** Richiesta per cui mostrare il modale "Rifiuta" con motivazione (null = modale chiuso) */
  richiestaDaRifiutare = signal<Richiesta | null>(null);
  motivazioneRifiuto = signal('');
  /** ID richiesta in elaborazione (accetta/rifiuta) per disabilitare i pulsanti */
  elaborazioneId = signal<string | null>(null);
  messaggioErrore = signal<string | null>(null);

  paginaCorrente = signal(1);
  readonly pageSize = 5;

  doctorName = computed(() => {
    const user = this.auth.currentUser();
    if (!user) return 'Dottore';
    const nome = user.nome || user.username || '';
    const cognome = user.cognome || '';
    return `${nome} ${cognome}`.trim() || 'Dottore';
  });

  doctorInitials = computed(() => {
    const user = this.auth.currentUser();
    if (!user) return 'DB';
    const nome = (user.nome || user.username || '').trim();
    const cognome = (user.cognome || '').trim();
    const first = nome ? nome[0] : '';
    const last = cognome ? cognome[0] : '';
    const initials = (first + last).toUpperCase();
    return initials || 'DB';
  });

  ngOnInit(): void {
    this.caricaRichieste();
    this.avviaPollingRichieste();
  }

  caricaRichieste(): void {
    this.loading.set(true);
    this.error.set(null);
    this.richiestaApi.getRichiesteMedico().subscribe(result => {
      this.loading.set(false);
      if (result.success) {
        this.richieste.set(result.data);
        this.aggiornaNotifiche();
      } else {
        this.error.set(result.error);
        this.auth.setNotificationsCount(0);
      }
    });
  }

  inAttesaOggi = computed(() =>
    this.richieste().filter(r => r.stato === 'INVIATA' || r.stato === 'VISUALIZZATA').length
  );

  accettateSettimana = computed(() =>
    this.richieste().filter(r => r.stato === 'ACCETTATA').length
  );

  urgenti = computed(() =>
    this.richieste().filter(r =>
      r.priorita === 'URGENTE' &&
      (r.stato === 'INVIATA' || r.stato === 'VISUALIZZATA')
    ).length
  );

  scadute = computed(() =>
    this.richieste().filter(r => r.stato === 'SCADUTA').length
  );

  inScadenza = computed(() => {
    const now = new Date().getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return this.richieste().filter(r => {
      const t = r.dataRichiesta.getTime();
      const diff = now - t;
      return (
        diff >= 0 &&
        diff <= sevenDaysMs &&
        (r.stato === 'INVIATA' || r.stato === 'VISUALIZZATA')
      );
    }).length;
  });

  pagineTotali = computed(() => {
    const total = this.richiesteFiltrate().length;
    return total === 0 ? 1 : Math.ceil(total / this.pageSize);
  });

  private aggiornaNotifiche(): void {
    const nuoveRichieste = this.richieste().filter(r => r.stato === 'INVIATA');
    const items: NotificationItem[] = nuoveRichieste.map(r => ({
      id: r.id,
      paziente: `${r.paziente.nome} ${r.paziente.cognome}`.trim(),
      tipo: r.tipo,
      priorita: r.priorita,
      data: r.dataRichiesta,
      descrizione: r.descrizione
    }));
    this.auth.setNotifications(items);
  }

  /** Polling leggero per aggiornare richieste e notifiche quasi in tempo reale */
  private avviaPollingRichieste(): void {
    if (this.pollingHandle) return;
    this.pollingHandle = setInterval(() => {
      this.richiestaApi.getRichiesteMedico().subscribe(result => {
        if (result.success) {
          this.richieste.set(result.data);
          this.aggiornaNotifiche();
        }
        // In caso di errore non mostriamo banner, per non disturbare la UI
      });
    }, 5000);
  }

  richiesteFiltrate = computed(() => {
    let result = this.richieste();
    const query = this.searchQuery().toLowerCase();
    const stati = this.statusFilter();
    const priorita = this.priorityFilter();
    const period = this.periodFilter();
    const filtro = this.filtroAttivita();

    if (query) {
      result = result.filter(r =>
        `${r.paziente.nome} ${r.paziente.cognome}`.toLowerCase().includes(query) ||
        r.tipo.toLowerCase().includes(query)
      );
    }

    if (filtro === 'urgenti') {
      result = result.filter(r => r.urgente);
    } else if (filtro === 'scadute') {
      result = result.filter(r => r.stato === 'SCADUTA');
    }

    if (stati.length > 0) {
      result = result.filter(r => stati.includes(r.stato));
    }

    if (priorita.length > 0) {
      result = result.filter(r => r.priorita && priorita.includes(r.priorita));
    }

    const days = parseInt(period, 10) || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    result = result.filter(r => r.dataRichiesta >= cutoff);

    return result;
  });

  richiestePaginata = computed(() => {
    const all = this.richiesteFiltrate();
    const totalPages = this.pagineTotali();
    let page = this.paginaCorrente();
    if (page > totalPages) page = totalPages;
    if (page < 1) page = 1;
    const start = (page - 1) * this.pageSize;
    return all.slice(start, start + this.pageSize);
  });

  getStatoLabel(stato: StatoRichiesta): string {
    const labels: Record<StatoRichiesta, string> = {
      INVIATA: 'Inviata',
      VISUALIZZATA: 'Visualizzata',
      ACCETTATA: 'Accettata',
      RIFIUTATA: 'Rifiutata',
      ANNULLATA: 'Annullata',
      SCADUTA: 'Scaduta'
    };
    return labels[stato] ?? stato;
  }

  getStatoClass(stato: StatoRichiesta): string {
    const classes: Record<StatoRichiesta, string> = {
      INVIATA: 'stato--inviata',
      VISUALIZZATA: 'stato--visualizzata',
      ACCETTATA: 'stato--accettata',
      RIFIUTATA: 'stato--rifiutata',
      ANNULLATA: 'stato--annullata',
      SCADUTA: 'stato--scaduta'
    };
    return classes[stato] ?? '';
  }

  getIniziali(paziente: { nome: string; cognome: string }): string {
    return `${paziente.nome[0]}${paziente.cognome[0]}`.toUpperCase();
  }

  visualizza(richiesta: Richiesta): void {
    this.richiestaSelezionata.set(richiesta);
  }

  chiudiModale(): void {
    this.richiestaSelezionata.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.richiestaSelezionata()) {
      this.chiudiModale();
    } else if (this.richiestaDaRifiutare()) {
      this.chiudiModaleRifiuta();
    }
  }

  accetta(richiesta: Richiesta): void {
    if (this.elaborazioneId()) return;
    this.messaggioErrore.set(null);
    this.elaborazioneId.set(richiesta.id);
    this.richiestaApi.accettaRichiesta(richiesta.id).subscribe(result => {
      this.elaborazioneId.set(null);
      if (result.success) {
        this.chiudiModale();
        this.caricaRichieste();
      } else {
        this.messaggioErrore.set(result.error);
      }
    });
  }

  apriModaleRifiuta(richiesta: Richiesta): void {
    this.richiestaDaRifiutare.set(richiesta);
    this.motivazioneRifiuto.set('');
    this.messaggioErrore.set(null);
  }

  chiudiModaleRifiuta(): void {
    this.richiestaDaRifiutare.set(null);
    this.motivazioneRifiuto.set('');
    this.messaggioErrore.set(null);
  }

  confermaRifiuto(): void {
    const richiesta = this.richiestaDaRifiutare();
    const motivazione = this.motivazioneRifiuto().trim();
    if (!richiesta || !motivazione) return;
    if (this.elaborazioneId()) return;
    this.messaggioErrore.set(null);
    this.elaborazioneId.set(richiesta.id);
    this.richiestaApi.rifiutaRichiesta(Number(richiesta.id), motivazione).subscribe(result => {
      this.elaborazioneId.set(null);
      if (result.success) {
        this.chiudiModaleRifiuta();
        this.chiudiModale();
        this.caricaRichieste();
      } else {
        this.messaggioErrore.set(result.error);
      }
    });
  }

  toggleViewMode(): void {
    this.viewMode.update(m => m === 'list' ? 'grid' : 'list');
  }

  selezionaFiltroAttivita(filtro: 'tutte' | 'urgenti' | 'brevi' | 'differibili' | 'scadute'): void {
    this.filtroAttivita.set(filtro);
  }

  paginaPrecedente(): void {
    const current = this.paginaCorrente();
    if (current > 1) this.paginaCorrente.set(current - 1);
  }

  paginaSuccessiva(): void {
    const current = this.paginaCorrente();
    const total = this.pagineTotali();
    if (current < total) this.paginaCorrente.set(current + 1);
  }

  toggleFilters(): void {
    this.showFilters.update(v => !v);
  }

  isStatoSelected(stato: string): boolean {
    return this.statusFilter().includes(stato);
  }

  toggleStato(stato: string): void {
    this.statusFilter.update(prev => {
      const next = prev.includes(stato) ? prev.filter(s => s !== stato) : [...prev, stato];
      return next;
    });
  }

  isPrioritaSelected(value: string): boolean {
    return this.priorityFilter().includes(value);
  }

  togglePriorita(value: string): void {
    this.priorityFilter.update(prev => {
      const next = prev.includes(value) ? prev.filter(p => p !== value) : [...prev, value];
      return next;
    });
  }

  setPeriod(value: string): void {
    this.periodFilter.set(value);
  }

  /** Etichette delle scelte attive per la riga "Scelte" */
  scelteAttive = computed(() => {
    const labels: string[] = [];
    this.statusFilter().forEach(s => {
      const opt = this.STATI_OPTIONS.find(o => o.value === s);
      if (opt) labels.push(opt.label);
    });
    this.priorityFilter().forEach(p => {
      const opt = this.PRIORITA_OPTIONS.find(o => o.value === p);
      if (opt) labels.push(opt.label);
    });
    const periodOpt = this.PERIODI_OPTIONS.find(o => o.value === this.periodFilter());
    if (periodOpt) labels.push(periodOpt.label);
    return labels;
  });

  ngOnDestroy(): void {
    if (this.pollingHandle) {
      clearInterval(this.pollingHandle);
      this.pollingHandle = null;
    }
  }
}
