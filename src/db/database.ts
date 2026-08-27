import Dexie, { type Table } from 'dexie'
import type {
  Stagione,
  SquadraAvversaria,
  Giocatore,
  Partita,
  Evento,
  SchemaCorner,
} from './schema'

export class FutsalDB extends Dexie {
  stagioni!: Table<Stagione, number>
  avversari!: Table<SquadraAvversaria, number>
  giocatori!: Table<Giocatore, number>
  partite!: Table<Partita, number>
  eventi!: Table<Evento, number>
  schemi!: Table<SchemaCorner, number>

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
  }
}

export const db = new FutsalDB()
