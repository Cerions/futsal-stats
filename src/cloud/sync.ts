import { db } from '../db/database'
import { esportaStagione, type ExportData } from '../db/export'
import { importaStagione, sostituisciStagione, validaImport } from '../db/import'
import { client, nomeDispositivo } from './supabase'

/**
 * Sincronizzazione a livello di stagione intera.
 *
 * Il cloud tiene una riga per stagione con dentro l'export JSON completo.
 * `versione` è un lock ottimistico: chi carica dichiara quale versione sta
 * sovrascrivendo e, se nel frattempo qualcun altro ha caricato, l'update non
 * tocca nessuna riga e qui torna un conflitto invece di perdere dati.
 */

const TABELLA = 'stagioni_cloud'

/** Una stagione come sta sul cloud, senza il blob dei dati. */
export interface RigaCloud {
  id: string
  nome: string
  nome_squadra: string
  versione: number
  aggiornato_il: string
  aggiornato_da: string | null
  proprietario: string
  condivisa_con: string[]
}

const COLONNE =
  'id, nome, nome_squadra, versione, aggiornato_il, aggiornato_da, proprietario, condivisa_con'

export type EsitoCarica =
  | { esito: 'ok'; versione: number }
  | { esito: 'conflitto'; versioneCloud: number; aggiornatoDa: string | null }
  | { esito: 'errore'; messaggio: string }

export type EsitoScarica =
  | { esito: 'ok'; stagioneId: number }
  | { esito: 'errore'; messaggio: string }

function messaggioErrore(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  if (/failed to fetch|networkerror|load failed/i.test(m))
    return 'Nessuna connessione: riprova quando hai linea.'
  return m
}

/** Elenca le stagioni sul cloud: le proprie e quelle condivise con me. */
export async function elencoCloud(): Promise<RigaCloud[]> {
  const { data, error } = await client()
    .from(TABELLA)
    .select(COLONNE)
    .order('aggiornato_il', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as RigaCloud[]
}

/**
 * Carica sul cloud una stagione locale.
 * Alla prima volta crea la riga, dopo aggiorna solo se nessun altro ha
 * caricato nel frattempo.
 */
export async function caricaStagione(
  stagioneId: number,
  opzioni: { forza?: boolean } = {}
): Promise<EsitoCarica> {
  try {
    const stagione = await db.stagioni.get(stagioneId)
    if (!stagione) return { esito: 'errore', messaggio: 'Stagione non trovata.' }
    if (stagione.soloLettura)
      return {
        esito: 'errore',
        messaggio: 'Questa stagione è condivisa in sola lettura: non puoi caricarla.',
      }

    const dati = await esportaStagione(stagioneId)
    const sb = client()

    // Prima volta: creo la riga
    if (!stagione.cloudId) {
      const { data, error } = await sb
        .from(TABELLA)
        .insert({
          nome: stagione.nome,
          nome_squadra: stagione.nomeSquadra,
          versione: 1,
          aggiornato_da: nomeDispositivo(),
          dati,
        })
        .select(COLONNE)
        .single()
      if (error) throw new Error(error.message)
      const riga = data as unknown as RigaCloud
      await db.stagioni.update(stagioneId, {
        cloudId: riga.id,
        cloudVersione: riga.versione,
        cloudSyncIl: Date.now(),
      })
      return { esito: 'ok', versione: riga.versione }
    }

    // Aggiornamento con lock ottimistico sulla versione attesa.
    // Con `forza` prendiamo la versione che c'è adesso sul cloud, così il
    // lock passa comunque: è la scelta esplicita di sovrascrivere l'altro.
    let attesa = stagione.cloudVersione ?? 0
    if (opzioni.forza) {
      const { data: corrente } = await sb
        .from(TABELLA)
        .select('versione')
        .eq('id', stagione.cloudId)
        .maybeSingle()
      const v = (corrente as { versione: number } | null)?.versione
      if (typeof v === 'number') attesa = v
    }
    const { data, error } = await sb
      .from(TABELLA)
      .update({
        nome: stagione.nome,
        nome_squadra: stagione.nomeSquadra,
        versione: attesa + 1,
        aggiornato_da: nomeDispositivo(),
        dati,
      })
      .eq('id', stagione.cloudId)
      .eq('versione', attesa)
      .select(COLONNE)
    if (error) throw new Error(error.message)

    const righe = (data ?? []) as unknown as RigaCloud[]
    if (righe.length === 0) {
      // Nessuna riga aggiornata: o la versione è cambiata, o la riga non c'è più
      const { data: attuale } = await sb
        .from(TABELLA)
        .select(COLONNE)
        .eq('id', stagione.cloudId)
        .maybeSingle()
      const riga = attuale as unknown as RigaCloud | null
      if (!riga)
        return {
          esito: 'errore',
          messaggio: 'La stagione non esiste più sul cloud.',
        }
      return {
        esito: 'conflitto',
        versioneCloud: riga.versione,
        aggiornatoDa: riga.aggiornato_da,
      }
    }

    await db.stagioni.update(stagioneId, {
      cloudVersione: righe[0].versione,
      cloudSyncIl: Date.now(),
    })
    return { esito: 'ok', versione: righe[0].versione }
  } catch (e) {
    return { esito: 'errore', messaggio: messaggioErrore(e) }
  }
}

/** Legge una riga completa dal cloud, blob dei dati incluso. */
async function leggiCloud(
  cloudId: string
): Promise<{ riga: RigaCloud; dati: ExportData }> {
  const { data, error } = await client()
    .from(TABELLA)
    .select(`${COLONNE}, dati`)
    .eq('id', cloudId)
    .single()
  if (error) throw new Error(error.message)
  const record = data as unknown as RigaCloud & { dati: unknown }
  if (!validaImport(record.dati))
    throw new Error('I dati sul cloud non sono un export valido.')
  const { dati, ...riga } = record
  return { riga, dati }
}

/**
 * Scarica dal cloud una stagione e la scrive in locale.
 * Se la stagione è già collegata a questo dispositivo ne sostituisce il
 * contenuto tenendo lo stesso id locale, altrimenti la crea.
 */
export async function scaricaStagione(
  cloudId: string,
  opzioni: { soloLettura?: boolean } = {}
): Promise<EsitoScarica> {
  try {
    const { riga, dati } = await leggiCloud(cloudId)
    const campiCloud = {
      cloudId: riga.id,
      cloudVersione: riga.versione,
      cloudSyncIl: Date.now(),
    }

    // Le stagioni sono poche: una scansione è più semplice di un indice in più
    const gia = await db.stagioni.filter((s) => s.cloudId === cloudId).first()
    if (gia?.id !== undefined) {
      await sostituisciStagione(dati, gia.id, campiCloud)
      if (opzioni.soloLettura !== undefined) {
        await db.stagioni.update(gia.id, { soloLettura: opzioni.soloLettura })
      }
      return { esito: 'ok', stagioneId: gia.id }
    }

    const nuovaId = await importaStagione(dati)
    await db.stagioni.update(nuovaId, {
      ...campiCloud,
      soloLettura: opzioni.soloLettura ?? false,
    })
    return { esito: 'ok', stagioneId: nuovaId }
  } catch (e) {
    return { esito: 'errore', messaggio: messaggioErrore(e) }
  }
}

/** Stacca una stagione locale dal cloud, lasciando i dati dove sono. */
export async function scollegaStagione(stagioneId: number): Promise<void> {
  await db.stagioni.where('id').equals(stagioneId).modify((s) => {
    delete s.cloudId
    delete s.cloudVersione
    delete s.cloudSyncIl
    delete s.soloLettura
  })
}

/** Elimina la copia sul cloud. I dati locali restano. */
export async function eliminaDalCloud(cloudId: string): Promise<string | null> {
  try {
    const { error } = await client().from(TABELLA).delete().eq('id', cloudId)
    if (error) throw new Error(error.message)
    const locali = await db.stagioni.filter((s) => s.cloudId === cloudId).toArray()
    for (const s of locali) await scollegaStagione(s.id!)
    return null
  } catch (e) {
    return messaggioErrore(e)
  }
}

/** Aggiorna l'elenco delle email con cui la stagione è condivisa. */
export async function impostaCondivisione(
  cloudId: string,
  email: string[]
): Promise<string | null> {
  try {
    const pulite = email
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0)
    const { error } = await client()
      .from(TABELLA)
      .update({ condivisa_con: pulite })
      .eq('id', cloudId)
    if (error) throw new Error(error.message)
    return null
  } catch (e) {
    return messaggioErrore(e)
  }
}
