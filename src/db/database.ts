import Dexie, { type Table } from 'dexie'
import type {
  Stagione,
  SquadraAvversaria,
  Giocatore,
  Partita,
  Evento,
  Schema,
} from './schema'

export class FutsalDB extends Dexie {
  stagioni!: Table<Stagione, number>
  avversari!: Table<SquadraAvversaria, number>
  giocatori!: Table<Giocatore, number>
  partite!: Table<Partita, number>
  eventi!: Table<Evento, number>
  schemi!: Table<Schema, number>

  constructor() {
    super('FutsalStatsDB')
    this.version(1).stores({
      stagioni: '++id, nome, dataCreazione',
      avversari: '++id, stagioneId, nome',
      giocatori: '++id, stagioneId, nome',
      partite: '++id, stagioneId, avversarioId, dataOra, stato',
      eventi: '++id, partitaId, minuto, tipo',
    })
    // v2: schemi di calcio d'angolo.
    // Le altre tabelle restano invariate, Dexie se le porta avanti da sola.
    this.version(2).stores({
      schemi: '++id, stagioneId, nome',
    })
    // v3: gli schemi valgono per tutte le palle inattive, non solo i corner.
    // Gli schemi esistenti diventano di tipo 'corner' e gli eventi 'corner'
    // diventano eventi 'inattiva' con situazione 'corner'.
    this.version(3)
      .stores({
        schemi: '++id, stagioneId, tipo, nome',
      })
      .upgrade(async (tx) => {
        await tx
          .table('schemi')
          .toCollection()
          .modify((s: { tipo?: string }) => {
            if (s.tipo === undefined) s.tipo = 'corner'
          })
        await tx
          .table('eventi')
          .toCollection()
          .modify((e: { tipo?: string; situazione?: string }) => {
            if (e.tipo === 'corner') {
              e.tipo = 'inattiva'
              e.situazione = 'corner'
            }
          })
      })
  }
}

export const db = new FutsalDB()
