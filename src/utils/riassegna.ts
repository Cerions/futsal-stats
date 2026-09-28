import type { Evento } from '../db/schema'
import { ordineDiGioco } from './evento'

/**
 * Sostituzioni ricostruite o corrette a posteriori.
 *
 * Capita di accorgersi solo dopo che un giocatore era entrato: se non era fra i
 * convocati, le sue giocate finiscono registrate su chi ha sostituito. Aggiunta
 * la sostituzione mancante, tutto quello che il giocatore uscito risulta aver
 * fatto dopo quel minuto è in realtà del subentrato, e va spostato.
 *
 * Il periodo va dalla sostituzione alla fine della partita, o al momento in cui
 * l'uscito rientra: da lì in poi le giocate tornano a essere sue davvero.
 *
 * Lo stesso vale per un cambio già registrato che si sposta nel tempo: lì la
 * finestra da rivedere è quella fra il vecchio minuto e il nuovo —
 * `eventiDaSpostare` più sotto.
 */

/** Un singolo spostamento proposto: quale evento, e in che veste. */
export interface Riassegnazione {
  evento: Evento
  /** In quale ruolo il giocatore uscito compare in questo evento. */
  ruolo: 'protagonista' | 'assist' | 'esce' | 'entra'
}

/** Un punto della partita: tempo e minuto, che insieme dicono «quando». */
export interface Istante {
  tempoGioco: number
  minuto: number
}

/** In che veste un giocatore compare in un evento, se ci compare. */
function ruoloIn(e: Evento, id: number): Riassegnazione['ruolo'] | null {
  switch (e.tipo) {
    case 'gol_fatto':
      if (e.giocatoreId === id) return 'protagonista'
      if (e.assistId === id) return 'assist'
      return null
    case 'tiro':
    case 'autogol_contro':
      return e.giocatoreId === id ? 'protagonista' : null
    case 'cambio':
      // Solo chi esce: se in mezzo ci fosse un altro ingresso dello stesso
      // giocatore, girarlo all'altro produrrebbe un cambio senza senso.
      return e.giocatoreEsceId === id ? 'esce' : null
    default:
      return null
  }
}

/** true se `t` sta nella finestra fra `a` e `b`, estremi compresi. */
function dentroLaFinestra(t: Istante, a: Istante, b: Istante): boolean {
  const dopoA = t.tempoGioco > a.tempoGioco ||
    (t.tempoGioco === a.tempoGioco && t.minuto >= a.minuto)
  const primaDiB = t.tempoGioco < b.tempoGioco ||
    (t.tempoGioco === b.tempoGioco && t.minuto <= b.minuto)
  return dopoA && primaDiB
}

/** Il risultato di uno spostamento: cosa proporre, e da chi verso chi. */
export interface SpostamentoCambio {
  proposte: Riassegnazione[]
  /** Il giocatore a cui quelle giocate risultano intestate adesso. */
  daId: number
  /** Quello a cui andrebbero girate. */
  versoId: number
  /** true se il cambio è stato spostato più avanti nella partita. */
  inAvanti: boolean
}

/**
 * Le conseguenze di un cambio spostato nel tempo.
 *
 * Spostare una sostituzione non cambia solo un numero: cambia chi era in campo
 * nella finestra fra il vecchio minuto e il nuovo, e lì dentro le giocate
 * restano intestate a chi, dopo lo spostamento, non c'era.
 *
 * - **spostato in avanti**: fra il vecchio minuto e il nuovo il subentrato non
 *   era ancora entrato, quindi quello che risulta suo è di chi è uscito;
 * - **spostato indietro**: in quella finestra chi è uscito era già fuori,
 *   quindi quello che risulta suo è del subentrato.
 *
 * Gli estremi sono compresi: allo stesso minuto del cambio non si può sapere
 * cosa sia venuto prima, e una proposta di troppo si toglie con una spunta.
 */
export function eventiDaSpostare(
  eventi: Evento[],
  cambio: { id: number; esceId: number; entraId: number },
  da: Istante,
  a: Istante
): SpostamentoCambio {
  const inAvanti =
    a.tempoGioco > da.tempoGioco ||
    (a.tempoGioco === da.tempoGioco && a.minuto > da.minuto)
  const fermo = a.tempoGioco === da.tempoGioco && a.minuto === da.minuto

  const daId = inAvanti ? cambio.entraId : cambio.esceId
  const versoId = inAvanti ? cambio.esceId : cambio.entraId
  const niente = { proposte: [], daId, versoId, inAvanti }
  if (fermo || cambio.esceId === cambio.entraId) return niente

  const inizio = inAvanti ? da : a
  const fine = inAvanti ? a : da

  const proposte: Riassegnazione[] = []
  for (const e of [...eventi].sort(ordineDiGioco)) {
    if (e.id === cambio.id) continue
    if (!dentroLaFinestra(e, inizio, fine)) continue
    const ruolo = ruoloIn(e, daId)
    if (ruolo !== null) proposte.push({ evento: e, ruolo })
  }
  return { proposte, daId, versoId, inAvanti }
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
