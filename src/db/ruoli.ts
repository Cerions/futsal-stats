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