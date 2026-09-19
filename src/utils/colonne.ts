import { useState } from 'react'
import type { StatsGiocatore } from './statistiche'

/**
 * Le colonne ordinabili delle tabelle dei giocatori, e come si legge il valore
 * di ciascuna. Stanno qui e non accanto ai componenti perché sono dati puri:
 * la regola del fast refresh non vuole costanti e funzioni esportate dallo
 * stesso file di un componente.
 *
 * L'ordinamento è generico sul nome delle colonne: ogni tabella dichiara le
 * sue — i giocatori qui sotto, i portieri e i quintetti accanto alle rispettive
 * viste — e riusa lo stesso stato e gli stessi header cliccabili.
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
export interface Ordinamento<C extends string = ColonnaOrdinabile> {
  colonna: C
  discendente: boolean
  cambia: (c: C) => void
}

/**
 * Lo stato dell'ordinamento di una tabella.
 *
 * `testuali` elenca le colonne che si leggono come parole: quelle partono dalla
 * A, i numeri dal più grande — è quello che ci si aspetta toccando «Gol».
 * Ritoccare la colonna già attiva rovescia il verso.
 */
export function useOrdinamento<C extends string>(
  iniziale: C,
  testuali: readonly C[] = []
): Ordinamento<C> {
  const [colonna, setColonna] = useState<C>(iniziale)
  const [discendente, setDiscendente] = useState(!testuali.includes(iniziale))

  return {
    colonna,
    discendente,
    cambia: (c: C) => {
      if (c === colonna) {
        setDiscendente(!discendente)
        return
      }
      setColonna(c)
      setDiscendente(!testuali.includes(c))
    },
  }
}

/**
 * Confronto fra due valori di colonna, verso già applicato. I numeri si
 * confrontano da numeri, il resto come testo.
 */
export function confronta(
  a: number | string,
  b: number | string,
  discendente: boolean
): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return discendente ? b - a : a - b
  }
  return discendente
    ? String(b).localeCompare(String(a))
    : String(a).localeCompare(String(b))
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
