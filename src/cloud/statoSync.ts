import { useSyncExternalStore } from 'react'

/**
 * Stato della sincronizzazione automatica, per stagione.
 *
 * Sta in un piccolo store a parte perché la UI possa leggerlo senza rifare
 * l'export della stagione: a scriverlo è `SincronizzazioneAuto`, a leggerlo
 * sono le pagine che mostrano il pallino di stato.
 */
export type StatoSync =
  | 'inPari'
  | 'daCaricare'
  | 'inCorso'
  | 'inPausaPartita'
  | 'errore'

const stati = new Map<number, StatoSync>()
const ascoltatori = new Set<() => void>()

export function scriviStatoSync(stagioneId: number, stato: StatoSync) {
  if (stati.get(stagioneId) === stato) return
  stati.set(stagioneId, stato)
  for (const a of ascoltatori) a()
}

function sottoscrivi(a: () => void) {
  ascoltatori.add(a)
  return () => {
    ascoltatori.delete(a)
  }
}

/** Stato corrente di una stagione, o null se non la sta seguendo nessuno. */
export function useStatoSync(stagioneId: number): StatoSync | null {
  const leggi = () => stati.get(stagioneId) ?? null
  return useSyncExternalStore(sottoscrivi, leggi, leggi)
}
