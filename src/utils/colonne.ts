import type { StatsGiocatore } from './statistiche'

/**
 * Le colonne ordinabili delle tabelle dei giocatori, e come si legge il valore
 * di ciascuna. Stanno qui e non accanto ai componenti perché sono dati puri:
 * la regola del fast refresh non vuole costanti e funzioni esportate dallo
 * stesso file di un componente.
 */

export type ColonnaOrdinabile =
  | 'giocatore'
  | 'presenze'
  | 'partiteGiocate'
  | 'minutiGiocati'
  | 'gol'
  | 'assist'
  | 'autogol'
  | 'golPro'
  | 'golContro'
  | 'plusMinus'
  | 'tiri'
  | 'tiriInPorta'
  | 'xG'
  | 'xGDiff'
  | 'conversione'

/** Stato dell'ordinamento, passato agli header cliccabili. */
export interface Ordinamento {
  colonna: ColonnaOrdinabile
  discendente: boolean
  cambia: (c: ColonnaOrdinabile) => void
}

/** Percentuale realizzativa: gol su tiri. -1 se non ha mai tirato. */
export function conversione(s: StatsGiocatore): number {
  return s.tiri > 0 ? s.gol / s.tiri : -1
}

export function valoreColonna(
  s: StatsGiocatore,
  c: ColonnaOrdinabile
): number | string {
  switch (c) {
    case 'giocatore':
      return `${s.giocatore.cognome} ${s.giocatore.nome}`.toLowerCase()
    case 'presenze':
      return s.presenze
    case 'partiteGiocate':
      return s.partiteGiocate
    case 'minutiGiocati':
      return s.minutiGiocati
    case 'gol':
      return s.gol
    case 'assist':
      return s.assist
    case 'autogol':
      return s.autogol
    case 'golPro':
      return s.golPro
    case 'golContro':
      return s.golContro
    case 'plusMinus':
      return s.golPro - s.golContro
    case 'tiri':
      return s.tiri
    case 'tiriInPorta':
      return s.tiriInPorta
    case 'xG':
      return s.xG
    case 'xGDiff':
      return s.gol - s.xG
    case 'conversione':
      return conversione(s)
  }
}
