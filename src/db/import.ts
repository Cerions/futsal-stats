import { db } from './database'
import { VERSIONE_EXPORT } from './export'
import type { ExportData } from './export'
import type { Evento, Partita } from './schema'

/**
 * Verifica che un oggetto sia un export valido.
 */
export function validaImport(data: unknown): data is ExportData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return (
    d.formato === 'futsal-stats-export' &&
    typeof d.versione === 'number' &&
    typeof d.dataExport === 'number' &&
    typeof d.stagione === 'object' &&
    Array.isArray(d.giocatori) &&
    Array.isArray(d.avversari) &&
    Array.isArray(d.partite) &&
    Array.isArray(d.eventi)
  )
}

/**
 * Importa una stagione da un export. Tutti gli ID vengono rigenerati.
 * Ritorna l'id della nuova stagione creata.
 */
export async function importaStagione(data: ExportData): Promise<number> {
  if (data.versione > VERSIONE_EXPORT) {
    throw new Error(
      `Versione export non supportata: ${data.versione}. Aggiorna l'app.`
    )
  }

  return await db.transaction(
    'rw',
    [db.stagioni, db.giocatori, db.avversari, db.partite, db.eventi, db.schemi],
    async () => {
      // 1. Crea la stagione e prendi il nuovo id
      const nuovaStagioneId = await db.stagioni.add({
        nome: data.stagione.nome,
        nomeSquadra: data.stagione.nomeSquadra,
        dataCreazione: data.stagione.dataCreazione,
      })

      // 2. Mappa giocatori: vecchio id → nuovo id
      const mappaGiocatori = new Map<number, number>()
      for (const g of data.giocatori) {
        const vecchioId = g.id!
        const nuovoId = await db.giocatori.add({
          stagioneId: nuovaStagioneId,
          nome: g.nome,
          cognome: g.cognome,
          numero: g.numero,
          ruolo: g.ruolo,
        })
        mappaGiocatori.set(vecchioId, nuovoId)
      }

      // 3. Mappa avversari
      const mappaAvversari = new Map<number, number>()
      for (const a of data.avversari) {
        const vecchioId = a.id!
        const nuovoId = await db.avversari.add({
          stagioneId: nuovaStagioneId,
          nome: a.nome,
        })
        mappaAvversari.set(vecchioId, nuovoId)
      }

      // 3-bis. Mappa schemi d'angolo (assenti negli export v1 e v2)
      const mappaSchemi = new Map<number, number>()
      for (const s of data.schemi ?? []) {
        const vecchioId = s.id!
        const nuovoId = await db.schemi.add({
          stagioneId: nuovaStagioneId,
          nome: s.nome,
          note: s.note,
        })
        mappaSchemi.set(vecchioId, nuovoId)
      }

      // 4. Mappa partite (riscrivendo avversarioId, convocati, titolari, inCampo)
      const mappaPartite = new Map<number, number>()
      for (const p of data.partite) {
        const vecchioId = p.id!
        const nuovaPartita: Omit<Partita, 'id'> = {
          stagioneId: nuovaStagioneId,
          avversarioId: mappaAvversari.get(p.avversarioId) ?? 0,
          dataOra: p.dataOra,
          tag: p.tag,
          config: p.config,
          convocati: p.convocati.map((id) => mappaGiocatori.get(id) ?? 0).filter((x) => x !== 0),
          titolari: p.titolari.map((id) => mappaGiocatori.get(id) ?? 0).filter((x) => x !== 0),
          inCampo: p.inCampo.map((id) => mappaGiocatori.get(id) ?? 0).filter((x) => x !== 0),
          stato: p.stato,
          cronometro: p.cronometro,
        }
        const nuovoId = await db.partite.add(nuovaPartita)
        mappaPartite.set(vecchioId, nuovoId)
      }

      // 5. Riscrivi gli eventi
      for (const e of data.eventi) {
        const nuovaPartitaId = mappaPartite.get(e.partitaId)
        if (nuovaPartitaId === undefined) continue // evento orfano, salta

        // riscriviamo i riferimenti a giocatori e schemi dentro l'evento
        const eventoRimappato = rimappaEvento(
          e,
          nuovaPartitaId,
          mappaGiocatori,
          mappaSchemi
        )
        if (eventoRimappato) {
          await db.eventi.add(eventoRimappato)
        }
      }

      return nuovaStagioneId
    }
  )
}

/**
 * Rimappa gli ID dei giocatori dentro un evento. Restituisce null se l'evento
 * non si può rimappare (giocatore di riferimento mancante).
 */
function rimappaEvento(
  e: Evento,
  nuovaPartitaId: number,
  mappa: Map<number, number>,
  mappaSchemi: Map<number, number>
): Evento | null {
  // gli id degli eventi vengono rigenerati: rimuoviamo il vecchio
  // tempoGioco default a 1 per export vecchi che non avevano il campo
  const base = {
    partitaId: nuovaPartitaId,
    minuto: e.minuto,
    tempoGioco: e.tempoGioco ?? 1,
  }

  // Uno schema che non si riesce a rimappare viene semplicemente perso:
  // l'evento resta, senza schema associato.
  const schemaRimappato = (id?: number) =>
    id === undefined ? undefined : mappaSchemi.get(id)

  // origine e punto di battuta non contengono id, si copiano così come sono
  const origine =
    e.tipo === 'tiro' || e.tipo === 'gol_fatto'
      ? { origine: e.origine, zonaBattuta: e.zonaBattuta, schemaId: schemaRimappato(e.schemaId) }
      : {}

  switch (e.tipo) {
    case 'inizio_tempo':
      return { ...base, tipo: 'inizio_tempo', tempo: e.tempo }
    case 'fine_tempo':
      return { ...base, tipo: 'fine_tempo', tempo: e.tempo }
    case 'gol_fatto': {
      const giocatoreId = mappa.get(e.giocatoreId)
      if (giocatoreId === undefined) return null
      const assistId = e.assistId !== undefined ? mappa.get(e.assistId) : undefined
      return { ...base, ...origine, tipo: 'gol_fatto', giocatoreId, assistId, zona: e.zona }
    }
    case 'gol_subito':
      return {
        ...base,
        tipo: 'gol_subito',
        noteGiocatoreAvv: e.noteGiocatoreAvv,
      }
    case 'autogol_pro':
      return {
        ...base,
        tipo: 'autogol_pro',
        noteGiocatoreAvv: e.noteGiocatoreAvv,
      }
    case 'autogol_contro': {
      const giocatoreId = mappa.get(e.giocatoreId)
      if (giocatoreId === undefined) return null
      return { ...base, tipo: 'autogol_contro', giocatoreId }
    }
    case 'cambio': {
      const entra = mappa.get(e.giocatoreEntraId)
      const esce = mappa.get(e.giocatoreEsceId)
      if (entra === undefined || esce === undefined) return null
      return {
        ...base,
        tipo: 'cambio',
        giocatoreEntraId: entra,
        giocatoreEsceId: esce,
      }
    }
    case 'tiro': {
      const giocatoreId = mappa.get(e.giocatoreId)
      if (giocatoreId === undefined) return null
      return {
        ...base,
        ...origine,
        tipo: 'tiro',
        giocatoreId,
        zona: e.zona,
        esito: e.esito,
      }
    }
    case 'corner':
      return { ...base, tipo: 'corner', schemaId: schemaRimappato(e.schemaId) }
  }
}

/**
 * Legge un file JSON dall'input e lo parsa.
 */
export async function leggiFileJSON(file: File): Promise<unknown> {
  const testo = await file.text()
  return JSON.parse(testo)
}