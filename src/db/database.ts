import Dexie, { type Table } from 'dexie'
import type { Stagione, SquadraAvversaria, Giocatore, Partita, Evento } from './schema'

export class FutsalDB extends Dexie {
  stagioni!: Table<Stagione, number>
  avversari!: Table<SquadraAvversaria, number>
  giocatori!: Table<Giocatore, number>
  partite!: Table<Partita, number>
  eventi!: Table<Evento, number>

  constructor() {
    super('FutsalStatsDB')
    this.version(1).stores({
      stagioni: '++id, nome, dataCreazione',
      avversari: '++id, stagioneId, nome',
      giocatori: '++id, stagioneId, nome',
      partite: '++id, stagioneId, avversarioId, dataOra, stato',
      eventi: '++id, partitaId, minuto, tipo',
    })
  }
}

export const db = new FutsalDB()