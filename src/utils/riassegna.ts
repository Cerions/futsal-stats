import type { Evento } from '../db/schema'
import { ordineDiGioco } from './evento'

/**
 * Sostituzioni ricostruite a posteriori.
 *
 * Capita di accorgersi solo dopo che un giocatore era entrato: se non era fra i
 * convocati, le sue giocate finiscono registrate su chi ha sostituito. Aggiunta
 * la sostituzione mancante, tutto quello che il giocatore uscito risulta aver
 * fatto dopo quel minuto è in realtà del subentrato, e va spostato.
 *
 * Il periodo va dalla sostituzione alla fine della partita, o al momento in cui
 * l'uscito rientra: da lì in poi le giocate tornano a essere sue davvero.
 */

/** Un singolo spostamento proposto: quale evento, e in che veste. */
export interface Riassegnazione {
  evento: Evento
  /** In quale ruolo il giocatore uscito compare in questo evento. */
  ruolo: 'protagonista' | 'assist' | 'esce' | 'entra'
}

/** true se `a` è successo prima di `b`, a parità di minuto false. */
function primaDi(
  a: { tempoGioco: number; minuto: number },
  b: { tempoGioco: number; minuto: number }
): boolean {
  if (a.tempoGioco !== b.tempoGioco) return a.tempoGioco < b.tempoGioco
  return a.minuto < b.minuto
}

/**
 * Gli eventi che una sostituzione aggiunta a posteriori rende attribuibili al
 * subentrato invece che a chi è uscito.
 *
 * Sono inclusi anche quelli allo stesso minuto del cambio: se segni «uscito al
 * 20°» e c'è un gol al 20°, non si può sapere da qui se è arrivato prima o
 * dopo. Meglio proporlo e lasciar decidere che tacerlo.
 */
export function eventiDaRiassegnare(
  eventi: Evento[],
  cambio: { tempoGioco: number; minuto: number; esceId: number; entraId: number }
): Riassegnazione[] {
  const { esceId, entraId } = cambio
  if (esceId === entraId) return []

  // In ordine di gioco, non di inserimento.
  const ordinati = [...eventi].sort(ordineDiGioco)

  const fuori: Riassegnazione[] = []
  for (const e of ordinati) {
    // Tutto quello che è successo prima del cambio resta com'è.
    if (primaDi(e, cambio)) continue

    // Se l'uscito rientra, da qui in poi le giocate sono di nuovo sue.
    if (e.tipo === 'cambio' && e.giocatoreEntraId === esceId) break

    switch (e.tipo) {
      case 'gol_fatto':
        if (e.giocatoreId === esceId) fuori.push({ evento: e, ruolo: 'protagonista' })
        else if (e.assistId === esceId) fuori.push({ evento: e, ruolo: 'assist' })
        break
      case 'tiro':
      case 'autogol_contro':
        if (e.giocatoreId === esceId) fuori.push({ evento: e, ruolo: 'protagonista' })
        break
      case 'cambio':
        // Un cambio successivo che fa uscire di nuovo lo stesso giocatore: in
        // realtà a uscire era il subentrato.
        if (e.giocatoreEsceId === esceId) fuori.push({ evento: e, ruolo: 'esce' })
        break
    }
  }
  return fuori
}

/** I campi da riscrivere su un evento per spostarlo sul subentrato. */
export function campiRiassegnati(
  r: Riassegnazione,
  entraId: number
): Partial<Evento> {
  switch (r.ruolo) {
    case 'assist':
      return { assistId: entraId } as Partial<Evento>
    case 'esce':
      return { giocatoreEsceId: entraId } as Partial<Evento>
    case 'entra':
      return { giocatoreEntraId: entraId } as Partial<Evento>
    default:
      return { giocatoreId: entraId } as Partial<Evento>
  }
}
