import Dexie, { type Table } from 'dexie'
import type {
  Stagione,
  SquadraAvversaria,
  Giocatore,
  Partita,
  Evento,
  Schema,
} from './schema'
import { nuovoUid, uidDerivatiGiocatori, uidDerivatiPartite } from './uid'

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
    // v4: uid stabili su giocatori e partite, per i voti (vedi db/uid.ts).
    // Quelli esistenti prendono uno uid derivato dal contenuto, così ogni
    // dispositivo calcola gli stessi valori senza doversi parlare.
    this.version(4)
      .stores({
        giocatori: '++id, stagioneId, nome, uid',
        partite: '++id, stagioneId, avversarioId, dataOra, stato, uid',
      })
      .upgrade(async (tx) => {
        const giocatori = (await tx.table('giocatori').toArray()) as Giocatore[]
        const partite = (await tx.table('partite').toArray()) as Partita[]
        const avversari = (await tx.table('avversari').toArray()) as SquadraAvversaria[]
        const nomeAvv = new Map(avversari.map((a) => [a.id!, a.nome]))

        const perStagione = <T extends { stagioneId: number; id?: number }>(xs: T[]) => {
          const m = new Map<number, T[]>()
          for (const x of [...xs].sort((a, b) => a.id! - b.id!)) {
            const l = m.get(x.stagioneId) ?? []
            l.push(x)
            m.set(x.stagioneId, l)
          }
          return m
        }

        for (const lista of perStagione(giocatori).values()) {
          const uid = uidDerivatiGiocatori(lista)
          for (let i = 0; i < lista.length; i++) {
            if (!lista[i].uid) await tx.table('giocatori').update(lista[i].id!, { uid: uid[i] })
          }
        }
        for (const lista of perStagione(partite).values()) {
          const uid = uidDerivatiPartite(lista, (id) => nomeAvv.get(id) ?? '')
          for (let i = 0; i < lista.length; i++) {
            if (!lista[i].uid) await tx.table('partite').update(lista[i].id!, { uid: uid[i] })
          }
        }
      })

    // Ogni giocatore o partita nuova nasce con il suo uid. L'import ne passa
    // uno già pronto (quello del file, o derivato) e qui viene rispettato.
    this.giocatori.hook('creating', (_pk, obj) => {
      if (!obj.uid) obj.uid = nuovoUid()
    })
    this.partite.hook('creating', (_pk, obj) => {
      if (!obj.uid) obj.uid = nuovoUid()
    })
  }
}

export const db = new FutsalDB()
