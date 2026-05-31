import type { Ruolo } from './schema'

export const RUOLI: { value: Ruolo; label: string; short: string }[] = [
  { value: 'PORTIERE', label: 'Portiere', short: 'P' },
  { value: 'CENTRALE', label: 'Centrale', short: 'C' },
  { value: 'LATERALE', label: 'Laterale', short: 'L' },
  { value: 'PIVOT', label: 'Pivot', short: 'PV' },
  { value: 'UNIVERSALE', label: 'Universale', short: 'U' },
]

export function ruoloLabel(r: Ruolo): string {
  return RUOLI.find((x) => x.value === r)?.label ?? r
}

export function ruoloShort(r: Ruolo): string {
  return RUOLI.find((x) => x.value === r)?.short ?? r
}

/**
 * Ordine canonico dei ruoli per la visualizzazione: P, C, U, L, PV.
 */
const ORDINE_RUOLI: Record<Ruolo, number> = {
  PORTIERE: 0,
  CENTRALE: 1,
  UNIVERSALE: 2,
  LATERALE: 3,
  PIVOT: 4,
}

export function ordineRuolo(r: Ruolo): number {
  return ORDINE_RUOLI[r] ?? 99
}