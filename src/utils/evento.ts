import type { Evento, Giocatore, Schema } from '../db/schema'
import { nomeCorto } from './giocatore'
import {
  esitoLabel,
  inattivaIcona,
  inattivaLabel,
  origineIcona,
  origineLabelCorta,
  zonaLabelCorta,
} from '../db/zone'

/**
 * Descrive un evento per la visualizzazione nel log.
 */
export function descriviEvento(
  e: Evento,
  rosa: Giocatore[],
  schemi: Schema[] = []
): string {
  const nome = (id: number) => {
    const g = rosa.find((x) => x.id === id)
    return g ? nomeCorto(g) : '???'
  }
  const nomeSchema = (id?: number) => {
    if (id === undefined) return null
    return schemi.find((s) => s.id === id)?.nome ?? null
  }
  // Coda con origine, punto di battuta e schema, quando ci sono
  const contesto = (
    ev: Extract<Evento, { tipo: 'tiro' | 'gol_fatto' }>
  ): string => {
    const parti: string[] = []
    if (ev.zona !== undefined) parti.push(zonaLabelCorta(ev.zona))
    const origine = ev.origine ?? 'azione'
    if (origine !== 'azione') {
      const schema = nomeSchema(ev.schemaId)
      const battuta =
        ev.zonaBattuta !== undefined ? `da ${zonaLabelCorta(ev.zonaBattuta)}` : null
      const dettaglio = [schema, battuta].filter(Boolean).join(', ')
      parti.push(
        `${origineIcona(origine)} ${origineLabelCorta(origine)}${
          dettaglio ? ` (${dettaglio})` : ''
        }`
      )
    }
    return parti.length > 0 ? ` · ${parti.join(' · ')}` : ''
  }
  switch (e.tipo) {
    case 'inizio_tempo':
      return `Inizio ${e.tempo}° tempo`
    case 'fine_tempo':
      return `Fine ${e.tempo}° tempo`
    case 'gol_fatto': {
      const coda = contesto(e)
      return e.assistId !== undefined
        ? `⚽ Gol di ${nome(e.giocatoreId)} (assist ${nome(e.assistId)})${coda}`
        : `⚽ Gol di ${nome(e.giocatoreId)}${coda}`
    }
    case 'gol_subito':
      return `⚽ Gol subito`
    case 'autogol_pro':
      return `⚽ Gol (autogol avversario)`
    case 'autogol_contro':
      return `⚽ Autogol di ${nome(e.giocatoreId)}`
    case 'cambio':
      return `🔄 ${nome(e.giocatoreEsceId)} ← → ${nome(e.giocatoreEntraId)}`
    case 'tiro':
      return `🎯 Tiro di ${nome(e.giocatoreId)} — ${esitoLabel(
        e.esito
      ).toLowerCase()}${contesto(e)}`
    case 'inattiva': {
      const schema = nomeSchema(e.schemaId)
      const testa = `${inattivaIcona(e.situazione)} ${inattivaLabel(e.situazione)}`
      return schema ? `${testa} — ${schema}` : testa
    }
  }
}
