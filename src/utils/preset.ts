import type { Partita } from '../db/schema'

/**
 * I gruppi di partite già pronti nella pagina statistiche.
 *
 * Sono insiemi che si ridefiniscono da soli, non liste congelate: scelto
 * «Campionato», una partita di campionato giocata domani ci entra senza che
 * nessuno tocchi il filtro. Le partite senza tag stanno solo in «tutte».
 */

export const PRESET = [
  'tutte',
  'ufficiali',
  'campionato',
  'coppa',
  'amichevole',
] as const

export type Preset = (typeof PRESET)[number]

export const ETICHETTE_PRESET: Record<Preset, string> = {
  tutte: 'Tutte',
  ufficiali: 'Ufficiali',
  campionato: 'Campionato',
  coppa: 'Coppa',
  amichevole: 'Amichevoli',
}

export function ePreset(v: string | null): v is Preset {
  return v !== null && (PRESET as readonly string[]).includes(v)
}

/** Le partite che un preset comprende, calcolate ogni volta sull'elenco vero. */
export function partiteDelPreset(finite: Partita[], preset: Preset): Partita[] {
  switch (preset) {
    case 'ufficiali':
      return finite.filter((p) => p.tag === 'Campionato' || p.tag === 'Coppa')
    case 'campionato':
      return finite.filter((p) => p.tag === 'Campionato')
    case 'coppa':
      return finite.filter((p) => p.tag === 'Coppa')
    case 'amichevole':
      return finite.filter((p) => p.tag === 'Amichevole')
    case 'tutte':
      return finite
  }
}
