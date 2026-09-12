import type { Evento, Giocatore, Partita } from '../db/schema'
import { esitoInPorta, pesoZona, zonaDiTiro } from '../db/zone'
import { ordineDiGioco } from './evento'
import type { StatsGiocatore } from './statistiche'

/**
 * Le statistiche che hanno senso solo per un portiere.
 *
 * Un portiere non si giudica dai gol o dai tiri: si giudica da quello che gli
 * è arrivato addosso e da quanto ne ha tenuto fuori. I gol subiti da soli non
 * bastano — dipendono da quanto concede la squadra davanti — quindi accanto ci
 * sono i tiri in porta affrontati, le parate, e l'xGA di quello che ha dovuto
 * respingere. Il divario fra xGA e gol subiti è la vera misura: sotto zero ha
 * parato più di quanto ci si aspettasse.
 */

/** Durata di riferimento per le medie: una partita piena di calcio a 5. */
export const MINUTI_PARTITA = 40

export interface StatsPortiere {
  giocatore: Giocatore
  partiteGiocate: number
  minutiGiocati: number
  /** tutto quello che è entrato mentre era in porta, autogol nostri compresi */
  golSubiti: number
  /** solo i gol su conclusione avversaria: è il denominatore delle parate */
  golSuTiro: number
  parate: number
  /** xGA delle conclusioni subite mentre era in campo */
  xga: number
  /** partite giocate in cui non ha preso gol */
  partiteSenzaGol: number
}

/** Gol subiti rapportati a una partita piena. */
export function golOgniPartita(s: StatsPortiere): number | null {
  if (s.minutiGiocati === 0) return null
  return (s.golSubiti / s.minutiGiocati) * MINUTI_PARTITA
}

/** Quota di conclusioni in porta che ha tenuto fuori. */
export function percentualeParate(s: StatsPortiere): number | null {
  const affrontati = s.parate + s.golSuTiro
  return affrontati === 0 ? null : s.parate / affrontati
}

/**
 * Quanto ha parato rispetto a quello che era lecito aspettarsi.
 * Positivo = ha tenuto fuori più di quanto valevano le conclusioni subite.
 */
export function golEvitati(s: StatsPortiere): number {
  return s.xga - s.golSubiti
}

/**
 * Le statistiche dei soli portieri dell'ambito.
 *
 * Minuti e partite giocate arrivano dal calcolo generale, che sa già ricostruire
 * chi era in campo; qui si aggiunge solo quello che riguarda la porta, seguendo
 * gli eventi nello stesso modo: scorrendo, non guardando il minuto, così un
 * cambio all'intervallo non mette due portieri in campo insieme.
 */
export function statistichePortieri(
  rosa: Giocatore[],
  partite: Partita[],
  eventi: Evento[],
  stats: StatsGiocatore[]
): StatsPortiere[] {
  const portieri = rosa.filter((g) => g.ruolo === 'PORTIERE')
  if (portieri.length === 0) return []

  const perId = new Map<number, StatsPortiere>()
  for (const g of portieri) {
    const generali = stats.find((s) => s.giocatore.id === g.id)
    perId.set(g.id!, {
      giocatore: g,
      partiteGiocate: generali?.partiteGiocate ?? 0,
      minutiGiocati: generali?.minutiGiocati ?? 0,
      golSubiti: 0,
      golSuTiro: 0,
      parate: 0,
      xga: 0,
      partiteSenzaGol: 0,
    })
  }

  for (const partita of partite) {
    const suoi = eventi.filter((e) => e.partitaId === partita.id).sort(ordineDiGioco)
    const inCampo = new Set<number>(partita.titolari)
    // Chi ha preso almeno un gol in questa partita: serve per le gare pulite.
    const haPreso = new Set<number>()

    /** Il portiere in porta adesso: nel calcio a 5 ce n'è uno solo alla volta. */
    const inPorta = (): StatsPortiere | null => {
      for (const gid of inCampo) {
        const p = perId.get(gid)
        if (p) return p
      }
      return null
    }

    for (const e of suoi) {
      if (e.tipo === 'cambio') {
        inCampo.delete(e.giocatoreEsceId)
        inCampo.add(e.giocatoreEntraId)
        continue
      }
      const p = inPorta()
      if (p === null) continue
      const id = p.giocatore.id!
      switch (e.tipo) {
        case 'gol_subito':
          p.golSubiti += 1
          p.golSuTiro += 1
          haPreso.add(id)
          break
        case 'autogol_contro':
          // Entrata lo stesso, ma non è una parata mancata: fuori dalla
          // percentuale, dentro ai gol subiti.
          p.golSubiti += 1
          haPreso.add(id)
          break
        case 'tiro_subito':
          if (esitoInPorta(e.esito)) p.parate += 1
          break
      }
      const zona = zonaDiTiro(e, 'loro')
      if (zona !== null) p.xga += pesoZona(zona)
    }

    // Gara pulita: ha giocato e non ha preso niente.
    for (const p of perId.values()) {
      const gid = p.giocatore.id!
      const haGiocato =
        partita.titolari.includes(gid) ||
        suoi.some((e) => e.tipo === 'cambio' && e.giocatoreEntraId === gid)
      if (haGiocato && !haPreso.has(gid)) p.partiteSenzaGol += 1
    }
  }

  return Array.from(perId.values()).sort((a, b) => b.minutiGiocati - a.minutiGiocati)
}
