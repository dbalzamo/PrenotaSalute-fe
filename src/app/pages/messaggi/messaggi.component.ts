import { Component, signal, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../layout/header/header.component';

interface Messaggio {
  id: number;
  autore: 'paziente' | 'medico';
  testo: string;
  timestamp: Date;
}

@Component({
  selector: 'app-messaggi',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent],
  templateUrl: './messaggi.component.html',
  styleUrl: './messaggi.component.scss'
})
export class MessaggiComponent {
  private readonly location = inject(Location);
  readonly conversazione = signal<Messaggio[]>([
    {
      id: 1,
      autore: 'medico',
      testo: 'Buongiorno, come posso aiutarla?',
      timestamp: new Date()
    }
  ]);

  nuovoMessaggio = signal('');

  invia(): void {
    const testo = this.nuovoMessaggio().trim();
    if (!testo) return;

    const nextId = this.conversazione().length
      ? Math.max(...this.conversazione().map(m => m.id)) + 1
      : 1;

    this.conversazione.update(list => [
      ...list,
      { id: nextId, autore: 'paziente', testo, timestamp: new Date() }
    ]);

    this.nuovoMessaggio.set('');
  }

  tornaIndietro(): void {
    this.location.back();
  }
}

