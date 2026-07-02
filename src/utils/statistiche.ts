import type { Evento, Giocatore, Partita } from '../db/schema'

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

  let inCampoAttuale = new Set<number>(partita.titolari)
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
          if (marc) marc.gol += 1
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
      }
    }
  }

  return Array.from(stats.values())
}