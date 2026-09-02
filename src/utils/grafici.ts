import type { Evento, Partita } from '../db/schema'
import { pesoZona, zonaDiTiro } from '../db/zone'
import { risultatoPartita } from './statistiche'

/**
 * Preparazione dei dati per i grafici. Sta a parte dalle statistiche perché
 * qui interessa la forma (serie di punti, secchielli, righe ordinate), non i
 * totali: le due cose cambiano per motivi diversi.
 */

// ---------------------------------------------------------------------------
// 1. Andamento xG dentro una partita
// ---------------------------------------------------------------------------

export interface PuntoAndamento {
  /** minuto dall'inizio della partita, sommando i tempi precedenti */
  minuto: number
  /** xG accumulato da noi fino a qui */
  xg: number
  /** xG accumulato da loro fino a qui */
  xga: number
  /** valorizzato solo quando il punto è un gol */
  gol?: 'nostro' | 'loro'
}

/** Minuto assoluto di un evento, sommando i tempi già giocati. */
function minutoAssoluto(e: Evento, durataTempo: number): number {
  return (e.tempoGioco - 1) * durataTempo + e.minuto
}

/**
 * La linea dell'xG cumulato dei due fronti, minuto per minuto.
 * Parte sempre da (0, 0, 0) e arriva alla fine della partita, così le due
 * linee coprono tutto l'asse anche se l'ultima conclusione è al 18°.
 */
export function andamentoPartita(
  partita: Partita,
  eventi: Evento[]
): { punti: PuntoAndamento[]; durataTotale: number } {
  const durataTempo = partita.config.durataTempoMinuti
  const durataTotale = durataTempo * partita.config.numeroTempi

  const rilevanti = eventi
    .filter((e) => e.partitaId === partita.id)
    .filter(
      (e) =>
        e.tipo === 'tiro' ||
        e.tipo === 'gol_fatto' ||
        e.tipo === 'tiro_subito' ||
        e.tipo === 'gol_subito'
    )
    .sort((a, b) => {
      const ma = minutoAssoluto(a, durataTempo)
      const mb = minutoAssoluto(b, durataTempo)
      return ma !== mb ? ma - mb : (a.id ?? 0) - (b.id ?? 0)
    })

  const punti: PuntoAndamento[] = [{ minuto: 0, xg: 0, xga: 0 }]
  let xg = 0
  let xga = 0
  for (const e of rilevanti) {
    const nostro = e.tipo === 'tiro' || e.tipo === 'gol_fatto'
    const zona = zonaDiTiro(e, nostro ? 'nostro' : 'loro')
    if (zona !== null) {
      if (nostro) xg += pesoZona(zona)
      else xga += pesoZona(zona)
    }
    const eGol = e.tipo === 'gol_fatto' || e.tipo === 'gol_subito'
    punti.push({
      minuto: minutoAssoluto(e, durataTempo),
      xg,
      xga,
      ...(eGol ? { gol: nostro ? ('nostro' as const) : ('loro' as const) } : {}),
    })
  }
  punti.push({ minuto: durataTotale, xg, xga })
  return { punti, durataTotale }
}

// ---------------------------------------------------------------------------
// 2. Una riga per partita: xG contro gol
// ---------------------------------------------------------------------------

export interface RigaPartita {
  partitaId: number
  dataOra: number
  avversario: string
  gol: number
  golSubiti: number
  xg: number
  xga: number
}

export function rendimentoPerPartita(
  partite: Partita[],
  eventi: Evento[],
  nomeAvversario: (id: number) => string
): RigaPartita[] {
  return [...partite]
    .sort((a, b) => a.dataOra - b.dataOra)
    .map((p) => {
      const suoi = eventi.filter((e) => e.partitaId === p.id)
      const { fatti, subiti } = risultatoPartita(suoi)
      let xg = 0
      let xga = 0
      for (const e of suoi) {
        const zn = zonaDiTiro(e, 'nostro')
        if (zn !== null) xg += pesoZona(zn)
        const zl = zonaDiTiro(e, 'loro')
        if (zl !== null) xga += pesoZona(zl)
      }
      return {
        partitaId: p.id!,
        dataOra: p.dataOra,
        avversario: nomeAvversario(p.avversarioId),
        gol: fatti,
        golSubiti: subiti,
        xg,
        xga,
      }
    })
}

// ---------------------------------------------------------------------------
// 3. Secchielli da 5 minuti, dentro ciascun tempo
// ---------------------------------------------------------------------------

export interface Fascia {
  tempo: number
  da: number
  a: number
  golFatti: number
  golSubiti: number
  tiri: number
  tiriSubiti: number
}

export const AMPIEZZA_FASCIA = 5

/**
 * Conta gol e conclusioni per fasce di 5 minuti DENTRO ogni tempo.
 *
 * Sul minuto assoluto le partite di durata diversa (un'amichevole da 2×20 e un
 * campionato da 2×25) finirebbero mescolate male; contando dentro il tempo la
 * fascia «primi 5 minuti del secondo tempo» vuol dire la stessa cosa ovunque.
 */
export function perFasce(partite: Partita[], eventi: Evento[]): Fascia[] {
  const idPartite = new Map(partite.map((p) => [p.id!, p]))
  const tempiMax = Math.max(1, ...partite.map((p) => p.config.numeroTempi))
  const durataMax = Math.max(
    AMPIEZZA_FASCIA,
    ...partite.map((p) => p.config.durataTempoMinuti)
  )
  const nFasce = Math.ceil(durataMax / AMPIEZZA_FASCIA)

  const fasce: Fascia[] = []
  for (let t = 1; t <= tempiMax; t++) {
    for (let f = 0; f < nFasce; f++) {
      fasce.push({
        tempo: t,
        da: f * AMPIEZZA_FASCIA,
        a: (f + 1) * AMPIEZZA_FASCIA,
        golFatti: 0,
        golSubiti: 0,
        tiri: 0,
        tiriSubiti: 0,
      })
    }
  }

  const indice = (tempo: number, minuto: number) => {
    const f = Math.min(nFasce - 1, Math.floor(minuto / AMPIEZZA_FASCIA))
    return (tempo - 1) * nFasce + f
  }

  for (const e of eventi) {
    if (!idPartite.has(e.partitaId)) continue
    if (e.tempoGioco < 1 || e.tempoGioco > tempiMax) continue
    const i = indice(e.tempoGioco, e.minuto)
    const fascia = fasce[i]
    if (!fascia) continue
    switch (e.tipo) {
      case 'gol_fatto':
        fascia.golFatti += 1
        fascia.tiri += 1
        break
      case 'tiro':
        fascia.tiri += 1
        break
      case 'gol_subito':
        fascia.golSubiti += 1
        fascia.tiriSubiti += 1
        break
      case 'tiro_subito':
        fascia.tiriSubiti += 1
        break
      case 'autogol_pro':
        fascia.golFatti += 1
        break
      case 'autogol_contro':
        fascia.golSubiti += 1
        break
    }
  }
  return fasce
}
