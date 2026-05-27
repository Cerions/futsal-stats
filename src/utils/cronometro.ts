import type { Cronometro, Partita } from '../db/schema'

/**
 * Calcola i secondi totali trascorsi nella partita (tutti i tempi sommati).
 * Se il cronometro è in corso, somma anche i secondi dal timestamp di inizio.
 */
export function secondiTrascorsi(c: Cronometro, now: number = Date.now()): number {
  let totale = c.secondiAccumulati
  if (c.inizioTempoTimestamp !== null && !c.inPausa) {
    totale += Math.floor((now - c.inizioTempoTimestamp) / 1000)
  }
  return totale
}

/**
 * Formatta i secondi come "MM:SS" con padding.
 */
export function formatCronometro(secondi: number): string {
  const m = Math.floor(secondi / 60)
  const s = secondi % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

/**
 * Restituisce il minuto di gioco (intero, 0-based) usato come "tag" per gli eventi.
 */
export function minutoCorrente(c: Cronometro, now: number = Date.now()): number {
  return Math.floor(secondiTrascorsi(c, now) / 60)
}

/**
 * Calcola la durata totale prevista della partita in secondi.
 */
export function durataTotaleSecondi(p: Partita): number {
  return p.config.numeroTempi * p.config.durataTempoMinuti * 60
}