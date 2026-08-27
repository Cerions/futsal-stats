import { db } from './database'
import type {
  Stagione,
  Giocatore,
  SquadraAvversaria,
  Partita,
  Evento,
  SchemaCorner,
} from './schema'

/**
 * Versione del formato di export.
 * 1 → formato originale
 * 2 → aggiunge i tiri e la zona sui gol (xG)
 * 3 → aggiunge schemi d'angolo, eventi corner e origine delle conclusioni
 * L'import accetta tutte le versioni fino a questa: i file più vecchi
 * semplicemente non hanno i campi nuovi.
 */
export const VERSIONE_EXPORT = 3

export interface ExportData {
  formato: 'futsal-stats-export'
  versione: number
  dataExport: number
  stagione: Omit<Stagione, 'id'>
  giocatori: Giocatore[]
  avversari: SquadraAvversaria[]
  partite: Partita[]
  eventi: Evento[]
  /** assente nei file v1 e v2 */
  schemi?: SchemaCorner[]
}

/**
 * Esporta una stagione completa in un oggetto JSON-serializable.
 */
export async function esportaStagione(stagioneId: number): Promise<ExportData> {
  const stagione = await db.stagioni.get(stagioneId)
  if (!stagione) throw new Error('Stagione non trovata')

  const giocatori = await db.giocatori
    .where('stagioneId')
    .equals(stagioneId)
    .toArray()
  const avversari = await db.avversari
    .where('stagioneId')
    .equals(stagioneId)
    .toArray()
  const schemi = await db.schemi.where('stagioneId').equals(stagioneId).toArray()
  const partite = await db.partite
    .where('stagioneId')
    .equals(stagioneId)
    .toArray()
  const partiteIds = partite.map((p) => p.id!).filter((x) => x !== undefined)
  const eventi =
    partiteIds.length > 0
      ? await db.eventi.where('partitaId').anyOf(partiteIds).toArray()
      : []

  // togliamo l'id dalla stagione (verrà rigenerato in import)
  const { id: _id, ...stagioneSenzaId } = stagione
  void _id

  return {
    formato: 'futsal-stats-export',
    versione: VERSIONE_EXPORT,
    dataExport: Date.now(),
    stagione: stagioneSenzaId,
    giocatori,
    avversari,
    partite,
    eventi,
    schemi,
  }
}

/**
 * Genera il nome del file di backup per una stagione.
 */
export function nomeFileExport(nomeStagione: string, nomeSquadra: string): string {
  const safe = (s: string) =>
    s.replace(/[^a-z0-9-_]/gi, '_').replace(/_+/g, '_').toLowerCase()
  const data = new Date().toISOString().slice(0, 10)
  return `futsal_${safe(nomeSquadra)}_${safe(nomeStagione)}_${data}.json`
}

/**
 * Scarica un oggetto come file JSON nel browser.
 */
export function scaricaJSON(data: ExportData, filename: string) {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}