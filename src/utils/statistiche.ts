import type {
  Evento,
  Giocatore,
  OrigineTiro,
  Partita,
  Schema,
  TipoInattiva,
  ZonaTiro,
} from '../db/schema'
import {
  esitoInPorta,
  origineDi,
  ORIGINI_TIRO,
  pesoZona,
  TIPI_INATTIVA,
} from '../db/zone'
import type { ConteggioZona } from '../components/CampoTiri'

export interface StatsGiocatore {
  giocatore: Giocatore
  presenze: number       // convocato
  partiteGiocate: number // ha giocato almeno un secondo
  minutiGiocati: number
  gol: number
  assist: number
  autogol: number
  golPro: number         // gol della squadra mentre era in campo
  golContro: number      // gol subiti mentre era in campo
  tiri: number           // tiri totali (un gol è un tiro riuscito)
  tiriInPorta: number    // gol + tiri parati
  xG: number             // somma dei pesi delle zone dei tiri con zona nota
  golSenzaZona: number   // gol senza zona: non contribuiscono all'xG
}

/**
 * Per ogni giocatore, calcola gli intervalli in cui era in campo durante una partita.
 * Un intervallo è { tempoGioco, minutoInizio, minutoFine } dove i minuti sono relativi al tempo.
 */
interface IntervalloInCampo {
  tempoGioco: number
  minutoInizio: number
  minutoFine: number
}

function intervalliInCampoPerGiocatore(
  partita: Partita,
  eventi: Evento[]
): Map<number, IntervalloInCampo[]> {
  const risultato = new Map<number, IntervalloInCampo[]>()

  // Ordiniamo gli eventi per id (l'ordine cronologico di inserimento è quello giusto)
  const eventiOrdinati = [...eventi].sort((a, b) => (a.id ?? 0) - (b.id ?? 0))

  // Per ogni tempo, ricostruiamo chi era in campo dall'inizio.
  // Nella partita, i titolari iniziano il tempo 1 in campo.
  // Nei tempi successivi non abbiamo un concetto esplicito di "chi era in campo all'inizio":
  // assumiamo che chi era in campo alla fine del tempo precedente sia in campo all'inizio del successivo.
  // Questa è l'assunzione naturale nel calcio a 5 (nessun cambio all'intervallo se non esplicito).

  const inCampoAttuale = new Set<number>(partita.titolari)
  const intervalliAperti = new Map<number, { tempoGioco: number; minutoInizio: number }>()

  // Inizializza intervalli aperti per titolari a T1 min 0
  const tempoInizialeAttuale = 1
  for (const gid of inCampoAttuale) {
    intervalliAperti.set(gid, { tempoGioco: tempoInizialeAttuale, minutoInizio: 0 })
  }

  function aggiungiIntervallo(
    giocatoreId: number,
    tempoGioco: number,
    minutoInizio: number,
    minutoFine: number
  ) {
    if (minutoFine < minutoInizio) minutoFine = minutoInizio
    if (!risultato.has(giocatoreId)) risultato.set(giocatoreId, [])
    risultato.get(giocatoreId)!.push({ tempoGioco, minutoInizio, minutoFine })
  }

  for (const e of eventiOrdinati) {
    if (e.tipo === 'cambio') {
      // Chi esce: chiudo il suo intervallo aperto
      const aperto = intervalliAperti.get(e.giocatoreEsceId)
      if (aperto) {
        aggiungiIntervallo(
          e.giocatoreEsceId,
          aperto.tempoGioco,
          aperto.minutoInizio,
          e.minuto
        )
        intervalliAperti.delete(e.giocatoreEsceId)
      }
      inCampoAttuale.delete(e.giocatoreEsceId)

      // Chi entra: apro un nuovo intervallo
      intervalliAperti.set(e.giocatoreEntraId, {
        tempoGioco: e.tempoGioco,
        minutoInizio: e.minuto,
      })
      inCampoAttuale.add(e.giocatoreEntraId)
    } else if (e.tipo === 'fine_tempo') {
      // Chiudo tutti gli intervalli aperti in questo tempo
      for (const [gid, aperto] of intervalliAperti.entries()) {
        if (aperto.tempoGioco === e.tempo) {
          aggiungiIntervallo(gid, aperto.tempoGioco, aperto.minutoInizio, e.minuto)
          // riapri l'intervallo per il tempo successivo (a minuto 0), se non è l'ultimo tempo
          if (e.tempo < partita.config.numeroTempi) {
            intervalliAperti.set(gid, {
              tempoGioco: e.tempo + 1,
              minutoInizio: 0,
            })
          } else {
            intervalliAperti.delete(gid)
          }
        }
      }
    }
  }

  // Chiudi eventuali intervalli ancora aperti (partita non terminata correttamente?)
  // Usiamo la durata del tempo come fallback
  for (const [gid, aperto] of intervalliAperti.entries()) {
    aggiungiIntervallo(
      gid,
      aperto.tempoGioco,
      aperto.minutoInizio,
      partita.config.durataTempoMinuti
    )
  }

  return risultato
}

/**
 * Verifica se un evento (con tempoGioco e minuto) è avvenuto mentre il giocatore era in campo.
 */
function eraInCampoQuando(
  intervalli: IntervalloInCampo[] | undefined,
  tempoGioco: number,
  minuto: number
): boolean {
  if (!intervalli) return false
  return intervalli.some(
    (i) =>
      i.tempoGioco === tempoGioco &&
      i.minutoInizio <= minuto &&
      minuto <= i.minutoFine
  )
}

/**
 * Calcola le statistiche complete di tutti i giocatori di una stagione.
 * Considera solo le partite con stato 'finita'.
 */
export function calcolaStatistiche(
  rosa: Giocatore[],
  partite: Partita[],
  tuttiEventi: Evento[]
): StatsGiocatore[] {
  // Solo partite finite
  const partiteFinite = partite.filter((p) => p.stato === 'finita')

  // Preinizializza uno stat vuoto per ogni giocatore
  const stats = new Map<number, StatsGiocatore>()
  for (const g of rosa) {
    stats.set(g.id!, {
      giocatore: g,
      presenze: 0,
      partiteGiocate: 0,
      minutiGiocati: 0,
      gol: 0,
      assist: 0,
      autogol: 0,
      golPro: 0,
      golContro: 0,
      tiri: 0,
      tiriInPorta: 0,
      xG: 0,
      golSenzaZona: 0,
    })
  }

  for (const partita of partiteFinite) {
    const eventiPartita = tuttiEventi.filter((e) => e.partitaId === partita.id)
    const intervalliPerGiocatore = intervalliInCampoPerGiocatore(partita, eventiPartita)

    // Presenze: chi era nei convocati
    for (const gid of partita.convocati) {
      const s = stats.get(gid)
      if (s) s.presenze += 1
    }

    // Minuti giocati + partite giocate
    for (const [gid, intervalli] of intervalliPerGiocatore.entries()) {
      const s = stats.get(gid)
      if (!s) continue
      const minuti = intervalli.reduce(
        (tot, i) => tot + (i.minutoFine - i.minutoInizio),
        0
      )
      s.minutiGiocati += minuti
      if (minuti > 0) s.partiteGiocate += 1
    }

    // Gol / Assist / Autogol + gol pro/contro in campo
    for (const e of eventiPartita) {
      switch (e.tipo) {
        case 'gol_fatto': {
          const marc = stats.get(e.giocatoreId)
          if (marc) {
            marc.gol += 1
            // Un gol è un tiro riuscito, e per definizione è in porta.
            marc.tiri += 1
            marc.tiriInPorta += 1
            if (e.zona !== undefined) {
              marc.xG += pesoZona(e.zona)
            } else {
              marc.golSenzaZona += 1
            }
          }
          if (e.assistId !== undefined) {
            const ass = stats.get(e.assistId)
            if (ass) ass.assist += 1
          }
          // gol pro per tutti quelli in campo
          for (const g of rosa) {
            if (
              eraInCampoQuando(
                intervalliPerGiocatore.get(g.id!),
                e.tempoGioco,
                e.minuto
              )
            ) {
              const s = stats.get(g.id!)
              if (s) s.golPro += 1
            }
          }
          break
        }
        case 'autogol_pro': {
          // gol per noi ma nessun marcatore; conta comunque golPro per chi era in campo
          for (const g of rosa) {
            if (
              eraInCampoQuando(
                intervalliPerGiocatore.get(g.id!),
                e.tempoGioco,
                e.minuto
              )
            ) {
              const s = stats.get(g.id!)
              if (s) s.golPro += 1
            }
          }
          break
        }
        case 'gol_subito': {
          for (const g of rosa) {
            if (
              eraInCampoQuando(
                intervalliPerGiocatore.get(g.id!),
                e.tempoGioco,
                e.minuto
              )
            ) {
              const s = stats.get(g.id!)
              if (s) s.golContro += 1
            }
          }
          break
        }
        case 'autogol_contro': {
          const auto = stats.get(e.giocatoreId)
          if (auto) auto.autogol += 1
          for (const g of rosa) {
            if (
              eraInCampoQuando(
                intervalliPerGiocatore.get(g.id!),
                e.tempoGioco,
                e.minuto
              )
            ) {
              const s = stats.get(g.id!)
              if (s) s.golContro += 1
            }
          }
          break
        }
        case 'tiro': {
          const t = stats.get(e.giocatoreId)
          if (t) {
            t.tiri += 1
            if (esitoInPorta(e.esito)) t.tiriInPorta += 1
            t.xG += pesoZona(e.zona)
          }
          break
        }
      }
    }
  }

  return Array.from(stats.values())
}

/**
 * Conta tiri e gol per ogni zona, per disegnare la mappa dei tiri.
 * Considera sia i tiri espliciti sia i gol a cui è stata associata una zona.
 */
export function conteggiPerZona(eventi: Evento[]): Map<ZonaTiro, ConteggioZona> {
  const mappa = new Map<ZonaTiro, ConteggioZona>()
  const get = (z: ZonaTiro) => {
    let c = mappa.get(z)
    if (!c) {
      c = { tiri: 0, gol: 0 }
      mappa.set(z, c)
    }
    return c
  }

  for (const e of eventi) {
    if (e.tipo === 'tiro') {
      get(e.zona).tiri += 1
    } else if (e.tipo === 'gol_fatto' && e.zona !== undefined) {
      const c = get(e.zona)
      c.tiri += 1
      c.gol += 1
    }
  }
  return mappa
}

// ===========================================================================
// PALLE INATTIVE
// ===========================================================================

export interface StatsOrigine {
  origine: OrigineTiro
  tiri: number
  gol: number
  xG: number
}

/**
 * Resa delle conclusioni divise per come sono nate.
 * Gli eventi senza il campo origine contano come azione di gioco aperto.
 */
export function statistichePerOrigine(eventi: Evento[]): StatsOrigine[] {
  const mappa = new Map<OrigineTiro, StatsOrigine>(
    ORIGINI_TIRO.map((o) => [o.value, { origine: o.value, tiri: 0, gol: 0, xG: 0 }])
  )

  for (const e of eventi) {
    if (e.tipo !== 'tiro' && e.tipo !== 'gol_fatto') continue
    const s = mappa.get(origineDi(e))
    if (!s) continue
    s.tiri += 1
    if (e.tipo === 'gol_fatto') s.gol += 1
    if (e.zona !== undefined) s.xG += pesoZona(e.zona)
  }

  return Array.from(mappa.values())
}

export interface StatsSchema {
  /** null = battute registrate senza schema associato */
  schema: Schema | null
  battute: number
  tiri: number
  gol: number
  xG: number
}

/** Righe di uno stesso tipo di palla inattiva. */
export interface GruppoSchemi {
  tipo: TipoInattiva
  righe: StatsSchema[]
  battute: number
  tiri: number
  gol: number
  xG: number
}

/**
 * Resa degli schemi, raggruppata per tipo di palla inattiva: quante volte
 * ognuno è stato battuto, quanti tiri ha prodotto e quanti gol.
 *
 * La battuta e la conclusione sono eventi separati, collegati dallo schema:
 * un tiro conta per uno schema se ha quell'origine e quello schemaId.
 */
export function statistichePerSchema(
  eventi: Evento[],
  schemi: Schema[]
): GruppoSchemi[] {
  const vuota = (schema: Schema | null): StatsSchema => ({
    schema,
    battute: 0,
    tiri: 0,
    gol: 0,
    xG: 0,
  })

  // Una riga per schema, più una riga "senza schema" per ogni tipo.
  // Chiave: id dello schema, oppure "<tipo>:0" per il senza schema.
  const righe = new Map<string, StatsSchema>()
  const tipoDiRiga = new Map<string, TipoInattiva>()
  for (const t of TIPI_INATTIVA) {
    righe.set(`${t.value}:0`, vuota(null))
    tipoDiRiga.set(`${t.value}:0`, t.value)
  }
  for (const s of schemi) {
    righe.set(String(s.id!), vuota(s))
    tipoDiRiga.set(String(s.id!), s.tipo)
  }

  /** Trova la riga giusta: quella dello schema, o il "senza schema" del tipo. */
  const riga = (tipo: TipoInattiva, schemaId?: number) => {
    if (schemaId !== undefined) {
      const r = righe.get(String(schemaId))
      if (r) return r
    }
    return righe.get(`${tipo}:0`)!
  }

  for (const e of eventi) {
    if (e.tipo === 'inattiva') {
      riga(e.situazione, e.schemaId).battute += 1
    } else if (e.tipo === 'tiro' || e.tipo === 'gol_fatto') {
      const origine = origineDi(e)
      if (origine === 'azione') continue
      const r = riga(origine, e.schemaId)
      r.tiri += 1
      if (e.tipo === 'gol_fatto') r.gol += 1
      if (e.zona !== undefined) r.xG += pesoZona(e.zona)
    }
  }

  return TIPI_INATTIVA.map((t) => {
    const delTipo = Array.from(righe.entries())
      .filter(([k]) => tipoDiRiga.get(k) === t.value)
      .map(([, r]) => r)
      // la riga "senza schema" si mostra solo se ha davvero qualcosa dentro
      .filter((r) => r.schema !== null || r.battute > 0 || r.tiri > 0)
    return {
      tipo: t.value,
      righe: delTipo,
      battute: delTipo.reduce((n, r) => n + r.battute, 0),
      tiri: delTipo.reduce((n, r) => n + r.tiri, 0),
      gol: delTipo.reduce((n, r) => n + r.gol, 0),
      xG: delTipo.reduce((n, r) => n + r.xG, 0),
    }
  })
}

/** Numero di palle inattive battute, in totale o di un tipo solo. */
export function contaInattive(eventi: Evento[], tipo?: TipoInattiva): number {
  return eventi.filter(
    (e) => e.tipo === 'inattiva' && (tipo === undefined || e.situazione === tipo)
  ).length
}