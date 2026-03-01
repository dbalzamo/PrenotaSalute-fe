export type StatoRichiesta =
  | 'INVIATA'
  | 'VISUALIZZATA'
  | 'ACCETTATA'
  | 'RIFIUTATA'
  | 'ANNULLATA'
  | 'SCADUTA';

export type StatoRichiestaPaziente =
  | 'in_attesa'
  | 'accettata'
  | 'rifiutata'
  | 'prenotata'
  | 'scaduta';

export interface RichiestaPaziente {
  id: string;
  tipo: string;
  stato: StatoRichiestaPaziente;
  dataRichiesta: Date;
  /** Messaggio/descrizione inviata con la richiesta (se disponibile) */
  descrizione?: string;
}

export interface Paziente {
  id: string;
  nome: string;
  cognome: string;
  avatarUrl?: string;
}

export interface Richiesta {
  id: string;
  paziente: Paziente;
  tipo: string;
  stato: StatoRichiesta;
  urgente: boolean;
  dataRichiesta: Date;
  /** Priorità visuale per il medico (mock lato frontend) */
  priorita?: 'URGENTE' | 'BREVE' | 'DIFFERIBILE';
  /** Messaggio/descrizione inviata dal paziente con la richiesta */
  descrizione?: string;
}
