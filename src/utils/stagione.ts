import type { Stagione } from '../db/schema'

/**
 * Restituisce il nome della squadra, con fallback per stagioni vecchie
 * create prima dell'aggiunta del campo.
 */
export function nomeSquadra(s: Stagione | undefined | null): string {
  return s?.nomeSquadra?.trim() || 'La mia squadra'
}