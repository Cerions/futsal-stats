import type { Evento, Giocatore, OrigineTiro, Schema, ZonaTiro } from '../db/schema'
import { nomeCorto } from './giocatore'
import {
  esitoLabel,
  inattivaIcona,
  inattivaLabel,
  origineIcona,
  origineLabelCorta,
  zonaImplicitaOrigine,
  zonaLabelCorta,
} from '../db/zone'

/**
 * L'ordine in cui i fatti sono successi in campo.
 *
 * Non basta l'id. Dal vivo l'ordine di inserimento coincide con quello di
 * gioco, ma un evento aggiunto a mano dopo la partita prende l'id più alto di
 * tutti anche se racconta il 20° del primo tempo: ordinando per id finirebbe in
 * fondo, e un cambio inserito così non toglierebbe dal campo nessuno. Tempo e
 * minuto vengono prima; l'id resta come spareggio fra eventi dello stesso
 * minuto, dove è ancora l'indizio migliore che abbiamo.
 */
export function ordineDiGioco(
  a: { tempoGioco: number; minuto: number; id?: number },
  b: { tempoGioco: number; minuto: number; id?: number }
): number {
  if (a.tempoGioco !== b.tempoGioco) return a.tempoGioco - b.tempoGioco
  if (a.minuto !== b.minuto) return a.minuto - b.minuto
  return (a.id ?? 0) - (b.id ?? 0)
}

/**
 * I nostri giocatori nominati da un evento, in qualsiasi ruolo: marcatore,
 * assistman, chi entra, chi esce. Serve per sapere se un giocatore ha lasciato
 * tracce in partita — prima di toglierlo dai convocati — e per capire cosa
 * spostare quando una sostituzione viene aggiunta a posteriori.
 */
export function giocatoriCoinvolti(e: Evento): number[] {
  switch (e.tipo) {
    case 'gol_fatto':
      return e.assistId !== undefined
        ? [e.giocatoreId, e.assistId]
        : [e.giocatoreId]
    case 'tiro':
    case 'autogol_contro':
      return [e.giocatoreId]
    case 'cambio':
      return [e.giocatoreEsceId, e.giocatoreEntraId]
    default:
      return []
  }
}

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
  // Delle conclusioni subite sappiamo solo l'origine: niente schemi, che sono
  // gli schemi nostri, né punto di battuta.
  const codaOrigineLoro = (o?: OrigineTiro): string | null =>
    o === undefined || o === 'azione'
      ? null
      : `${origineIcona(o)} ${origineLabelCorta(o)}`

  // La zona, saltata quando è l'origine stessa a imporla: «Rigore · Rigore» non
  // dice niente in più di «Rigore».
  const zonaLoro = (z?: ZonaTiro, o?: OrigineTiro): string | null => {
    if (z === undefined) return null
    if (o !== undefined && zonaImplicitaOrigine(o) === z) return null
    return zonaLabelCorta(z)
  }

  // Coda con origine, punto di battuta e schema, quando ci sono.
  // L'autogol provocato passa di qui pure lui: non ha zona, ma ha eccome la
  // situazione da cui è nato.
  const contesto = (
    ev: Extract<Evento, { tipo: 'tiro' | 'gol_fatto' | 'autogol_pro' }>
  ): string => {
    const parti: string[] = []
    if (ev.tipo !== 'autogol_pro' && ev.zona !== undefined) {
      parti.push(zonaLabelCorta(ev.zona))
    }
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
    case 'gol_subito': {
      const parti = [zonaLoro(e.zona, e.origine), codaOrigineLoro(e.origine)].filter(
        Boolean
      )
      return `⚽ Gol subito${parti.length ? ` · ${parti.join(' · ')}` : ''}`
    }
    case 'tiro_subito': {
      const parti = [zonaLoro(e.zona, e.origine), codaOrigineLoro(e.origine)].filter(
        Boolean
      )
      return `🥅 Tiro loro — ${esitoLabel(e.esito).toLowerCase()}${
        parti.length ? ` · ${parti.join(' · ')}` : ''
      }`
    }
    case 'autogol_pro':
      return `⚽ Gol (autogol avversario)${contesto(e)}`
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
