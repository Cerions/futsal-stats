import { db } from './database'

/**
 * Cancella una partita e tutti i suoi eventi.
 */
export async function eliminaPartita(partitaId: number) {
  await db.transaction('rw', [db.partite, db.eventi], async () => {
    await db.eventi.where('partitaId').equals(partitaId).delete()
    await db.partite.delete(partitaId)
  })
}

/**
 * Cancella una stagione, le partite, gli eventi, i giocatori e gli avversari collegati.
 */
export async function eliminaStagione(stagioneId: number) {
  await db.transaction(
    'rw',
    [db.stagioni, db.partite, db.eventi, db.giocatori, db.avversari],
    async () => {
      const partiteIds = await db.partite
        .where('stagioneId')
        .equals(stagioneId)
        .primaryKeys()

      if (partiteIds.length > 0) {
        await db.eventi.where('partitaId').anyOf(partiteIds).delete()
        await db.partite.bulkDelete(partiteIds)
      }
      await db.giocatori.where('stagioneId').equals(stagioneId).delete()
      await db.avversari.where('stagioneId').equals(stagioneId).delete()
      await db.stagioni.delete(stagioneId)
    }
  )
}