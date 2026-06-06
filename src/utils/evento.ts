import type { Evento, Giocatore } from '../db/schema'
import { nomeCorto } from './giocatore'

/**
 * Descrive un evento per la visualizzazione nel log.
 */
export function descriviEvento(e: Evento, rosa: Giocatore[]): string {
  const nome = (id: number) => {
    const g = rosa.find((x) => x.id === id)
    return g ? nomeCorto(g) : '???'
  }
  switch (e.tipo) {
    case 'inizio_tempo':
      return `Inizio ${e.tempo}° tempo`
    case 'fine_tempo':
      return `Fine ${e.tempo}° tempo`
    case 'gol_fatto':
      return e.assistId !== undefined
        ? `⚽ Gol di ${nome(e.giocatoreId)} (assist ${nome(e.assistId)})`
        : `⚽ Gol di ${nome(e.giocatoreId)}`
    case 'gol_subito':
      return `⚽ Gol subito`
    case 'autogol_pro':
      return `⚽ Gol (autogol avversario)`
    case 'autogol_contro':
      return `⚽ Autogol di ${nome(e.giocatoreId)}`
    case 'cambio':
      return `🔄 ${nome(e.giocatoreEsceId)} ← → ${nome(e.giocatoreEntraId)}`
  }
}