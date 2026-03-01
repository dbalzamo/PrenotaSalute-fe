export type UserRole = 'Medico_Curante' | 'Paziente';

export interface User {
  id: string;
  /** Identificativo di accesso (può mancare per sessioni create prima dell'aggiornamento) */
  username?: string;
  email: string;
  nome: string;
  cognome: string;
  ruolo: UserRole;
  /** Campi profilo (da signup o da API profilo) */
  codiceFiscale?: string;
  indirizzoDiResidenza?: string;
  dataDiNascita?: string;
  specializzazione?: string;
  /** Data/ora dell'ultimo accesso (login), ISO string */
  lastLoginAt?: string;
  /** Data/ora dell'accesso precedente all'ultimo (per "ultima visita" = data reale prima dell'ultimo accesso) */
  previousLoginAt?: string;
}
