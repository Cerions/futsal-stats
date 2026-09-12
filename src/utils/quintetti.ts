import type { Evento, Giocatore, Partita } from '../db/schema'
import { ordineDiGioco } from './evento'
import { esitoInPorta } from '../db/zone'

/**
 * I quintetti che sono davvero stati in campo, ricostruiti dai cambi.
 *
 * I cambi si registrano uno alla volta, ma in campo spesso ne entrano due o tre
 * allo stesso stop di gioco. Trattarli separatamente produrrebbe quintetti
 * fantasma da zero minuti — uno per ogni cambio intermedio — che non sono mai
 * esistiti. Quindi i cambi ravvicinati si fondono, e conta solo la formazione
 * che resta in campo alla fine dell'ultimo.
 *
 * Gli eventi portano il minuto, non i secondi, e fra due cambi dello stesso
 * stop può passare il minuto: la finestra è un minuto, non zero.
 */

/** Quanto vicini devono essere due cambi per contare come uno solo. */
export const FINESTRA_CAMBI_MINUTI = 1

export interface Quintetto {
  /** Gli id dei cinque in campo, ordinati: è anche la chiave del gruppo. */
  giocatori: number[]
  chiave: string
}

/** Un tratto continuo di partita con lo stesso quintetto in campo. */
export interface TurnoQuintetto extends Quintetto {
  partitaId: number
  tempoGioco: number
  minutoInizio: number
  minutoFine: number
  minuti: number
  golFatti: number
  golSubiti: number
  tiri: number
  tiriInPorta: number
  tiriSubiti: number
  tiriSubitiInPorta: number
}

/** Tutti i turni di uno stesso quintetto, sommati. */
export interface StatsQuintetto extends Quintetto {
  turni: number
  minuti: number
  golFatti: number
  golSubiti: number
  tiri: number
  tiriInPorta: number
  tiriSubiti: number
  tiriSubitiInPorta: number
}

function chiaveDi(inCampo: Iterable<number>): string {
  return [...inCampo].sort((a, b) => a - b).join('-')
}

/**
 * I turni di una partita: un blocco per ogni formazione che è stata in campo,
 * con quello che è successo mentre c'era.
 *
 * Un turno si chiude solo quando finisce la raffica di cambi: se dopo il primo
 * cambio ne arriva un altro entro la finestra, il turno non è ancora cominciato
 * davvero e i due si fondono.
 */
export function turniDiPartita(partita: Partita, eventi: Evento[]): TurnoQuintetto[] {
  const suoi = eventi.filter((e) => e.partitaId === partita.id).sort(ordineDiGioco)
  const durataTempo = partita.config.durataTempoMinuti
  const turni: TurnoQuintetto[] = []

  const inCampo = new Set<number>(partita.titolari)
  let tempoCorrente = 1
  let inizio = 0
  let corrente: TurnoQuintetto | null = null

  const apri = (tempoGioco: number, minuto: number) => {
    corrente = {
      giocatori: [...inCampo].sort((a, b) => a - b),
      chiave: chiaveDi(inCampo),
      partitaId: partita.id!,
      tempoGioco,
      minutoInizio: minuto,
      minutoFine: minuto,
      minuti: 0,
      golFatti: 0,
      golSubiti: 0,
      tiri: 0,
      tiriInPorta: 0,
      tiriSubiti: 0,
      tiriSubitiInPorta: 0,
    }
  }

  const chiudi = (minuto: number) => {
    if (corrente === null) return
    const t: TurnoQuintetto = corrente
    t.minutoFine = Math.max(t.minutoInizio, minuto)
    t.minuti = t.minutoFine - t.minutoInizio
    // Un quintetto di cinque che non ha giocato nemmeno un minuto e non ha
    // fatto niente non è mai esistito davvero: è il residuo di una raffica di
    // cambi che il minuto non riesce a separare.
    const haFattoQualcosa =
      t.golFatti + t.golSubiti + t.tiri + t.tiriSubiti > 0
    if (t.minuti > 0 || haFattoQualcosa) turni.push(t)
    corrente = null
  }

  apri(1, 0)

  for (let i = 0; i < suoi.length; i++) {
    const e = suoi[i]

    if (e.tipo === 'inizio_tempo') {
      // I tempi successivi al primo ripartono da zero con chi era in campo.
      if (e.tempo !== tempoCorrente) {
        chiudi(durataTempo)
        tempoCorrente = e.tempo
        inizio = 0
        apri(tempoCorrente, 0)
      }
      continue
    }
    if (e.tipo === 'fine_tempo') {
      chiudi(e.minuto)
      tempoCorrente = e.tempo + 1
      inizio = 0
      // Dopo l'ultimo tempo non si apre niente: un turno per un tempo che non
      // esiste finirebbe in tabella con la durata piena di un tempo mai giocato.
      if (tempoCorrente <= partita.config.numeroTempi) apri(tempoCorrente, 0)
      continue
    }

    if (e.tipo === 'cambio') {
      chiudi(e.minuto)
      inCampo.delete(e.giocatoreEsceId)
      inCampo.add(e.giocatoreEntraId)
      // Finché il prossimo evento è un altro cambio dentro la finestra, siamo
      // ancora nello stesso stop: applicalo prima di aprire il turno nuovo.
      while (i + 1 < suoi.length) {
        const dopo = suoi[i + 1]
        if (dopo.tipo !== 'cambio') break
        if (dopo.tempoGioco !== e.tempoGioco) break
        if (dopo.minuto - e.minuto > FINESTRA_CAMBI_MINUTI) break
        inCampo.delete(dopo.giocatoreEsceId)
        inCampo.add(dopo.giocatoreEntraId)
        i += 1
      }
      inizio = suoi[i].minuto
      apri(suoi[i].tempoGioco, inizio)
      continue
    }

    if (corrente === null) continue
    const t: TurnoQuintetto = corrente
    switch (e.tipo) {
      case 'gol_fatto':
        t.golFatti += 1
        t.tiri += 1
        t.tiriInPorta += 1
        break
      case 'autogol_pro':
        t.golFatti += 1
        break
      case 'gol_subito':
        t.golSubiti += 1
        t.tiriSubiti += 1
        t.tiriSubitiInPorta += 1
        break
      case 'autogol_contro':
        t.golSubiti += 1
        break
      case 'tiro':
        t.tiri += 1
        if (esitoInPorta(e.esito)) t.tiriInPorta += 1
        break
      case 'tiro_subito':
        t.tiriSubiti += 1
        if (esitoInPorta(e.esito)) t.tiriSubitiInPorta += 1
        break
    }
  }

  // La partita finisce: chiudo l'ultimo turno alla durata prevista del tempo.
  chiudi(durataTempo)
  void inizio
  return turni
}

/**
 * Gli stessi quintetti sommati su tutte le partite dell'ambito, dal più usato.
 * Solo quintetti da cinque: se i cambi sono incompleti o mancano titolari, la
 * formazione ricostruita non è una formazione e non va confrontata con le altre.
 */
export function statistichePerQuintetto(
  partite: Partita[],
  eventi: Evento[]
): StatsQuintetto[] {
  const mappa = new Map<string, StatsQuintetto>()
  for (const p of partite) {
    for (const t of turniDiPartita(p, eventi)) {
      if (t.giocatori.length !== 5) continue
      let s = mappa.get(t.chiave)
      if (!s) {
        s = {
          giocatori: t.giocatori,
          chiave: t.chiave,
          turni: 0,
          minuti: 0,
          golFatti: 0,
          golSubiti: 0,
          tiri: 0,
          tiriInPorta: 0,
          tiriSubiti: 0,
          tiriSubitiInPorta: 0,
        }
        mappa.set(t.chiave, s)
      }
      s.turni += 1
      s.minuti += t.minuti
      s.golFatti += t.golFatti
      s.golSubiti += t.golSubiti
      s.tiri += t.tiri
      s.tiriInPorta += t.tiriInPorta
      s.tiriSubiti += t.tiriSubiti
      s.tiriSubitiInPorta += t.tiriSubitiInPorta
    }
  }
  return Array.from(mappa.values()).sort(
    (a, b) => b.minuti - a.minuti || b.turni - a.turni
  )
}

/** I nomi dei cinque, nell'ordine dei ruoli, per l'etichetta. */
export function nomiQuintetto(
  q: Quintetto,
  rosa: Giocatore[]
): Giocatore[] {
  return q.giocatori
    .map((id) => rosa.find((g) => g.id === id))
    .filter((g): g is Giocatore => g !== undefined)
}
