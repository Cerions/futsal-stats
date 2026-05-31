import { db } from './database'
import type {
  Stagione,
  Giocatore,
  SquadraAvversaria,
  Partita,
  Evento,
} from './schema'

export interface ExportData {
  formato: 'futsal-stats-export'
  versione: 1
  dataExport: number
  stagione: Omit<Stagione, 'id'>
  giocatori: Giocatore[]
  avversari: SquadraAvversaria[]
  partite: Partita[]
  eventi: Evento[]
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
    versione: 1,
    dataExport: Date.now(),
    stagione: stagioneSenzaId,
    giocatori,
    avversari,
    partite,
    eventi,
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