import { useCallback, useEffect, useState } from 'react'
import { client } from './supabase'

/**
 * Voti degli allenatori, sul cloud (tabelle `valutatori` e `voti`, vedi
 * supabase/voti.sql).
 *
 * A differenza del resto dell'app non passano da Dexie: li scrivono più
 * persone dai loro account e i permessi li decide il server riga per riga.
 * Quindi si leggono e si scrivono solo online. Giocatori e partite si
 * agganciano per `uid`, che è uguale su tutti i dispositivi.
 */

export interface Valutatore {
  id: string
  stagione_cloud: string
  nome: string
  /**
   * Email dell'account con cui vota. Null per gli allenatori «solo storico»:
   * esistono per tenere i voti importati dal foglio, ma non entrano nell'app.
   */
  email: string | null
  /** email di chi può inserire i voti al posto suo */
  delegati: string[]
  /**
   * false = ex allenatore: non vota più, ma i suoi voti restano nelle medie.
   * Lo decide il ruolo dato in Sincronizzazione, non si tocca a mano.
   */
  attivo: boolean
  creato_il: string
}

export interface Voto {
  id: string
  stagione_cloud: string
  valutatore: string
  partita_uid: string
  giocatore_uid: string
  voto: number | null
  note: string | null
  aggiornato_il: string
  aggiornato_da: string | null
}

/** Un voto da scrivere: identificato dalla terna, il resto è il contenuto. */
export interface VotoDaSalvare {
  valutatore: string
  partita_uid: string
  giocatore_uid: string
  voto: number | null
  note: string | null
}

function messaggioErrore(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  if (/failed to fetch|networkerror|load failed/i.test(m))
    return 'Nessuna connessione: i voti si leggono e si salvano solo online.'
  if (/relation .*(voti|valutatori).* does not exist|could not find the table/i.test(m))
    return 'Le tabelle dei voti non esistono ancora su Supabase: va eseguito supabase/voti.sql.'
  if (/row-level security|permission denied/i.test(m))
    return 'Il server non ti dà il permesso per questa operazione.'
  return m
}

/** PostgREST può restituire i numeric come stringa: si normalizza qui. */
function normalizzaVoto(v: Voto): Voto {
  return { ...v, voto: v.voto === null ? null : Number(v.voto) }
}

// ---------------------------------------------------------------------------
// Lettura
// ---------------------------------------------------------------------------

export async function leggiVoti(
  cloudId: string
): Promise<{ valutatori: Valutatore[]; voti: Voto[] }> {
  const sb = client()
  const [v, w] = await Promise.all([
    sb
      .from('valutatori')
      .select('*')
      .eq('stagione_cloud', cloudId)
      .order('creato_il', { ascending: true }),
    sb.from('voti').select('*').eq('stagione_cloud', cloudId),
  ])
  if (v.error) throw new Error(v.error.message)
  if (w.error) throw new Error(w.error.message)
  return {
    valutatori: (v.data ?? []) as Valutatore[],
    voti: ((w.data ?? []) as Voto[]).map(normalizzaVoto),
  }
}

export type StatoVoti =
  | { stato: 'caricamento' }
  | { stato: 'errore'; messaggio: string }
  | { stato: 'ok'; valutatori: Valutatore[]; voti: Voto[] }

/**
 * I voti di una stagione, tenuti freschi: si rileggono quando l'app torna
 * in primo piano e quando torna la linea, così i voti messi da un altro
 * allenatore compaiono senza dover ricaricare la pagina.
 */
export function useVoti(cloudId: string | undefined) {
  const [stato, setStato] = useState<StatoVoti>({ stato: 'caricamento' })
  const [battito, setBattito] = useState(0)
  const ricarica = useCallback(() => setBattito((b) => b + 1), [])

  useEffect(() => {
    const sveglia = () => {
      if (document.visibilityState === 'visible') ricarica()
    }
    document.addEventListener('visibilitychange', sveglia)
    window.addEventListener('online', ricarica)
    return () => {
      document.removeEventListener('visibilitychange', sveglia)
      window.removeEventListener('online', ricarica)
    }
  }, [ricarica])

  useEffect(() => {
    if (!cloudId) return
    let vivo = true
    leggiVoti(cloudId)
      .then((r) => vivo && setStato({ stato: 'ok', ...r }))
      .catch((e) => vivo && setStato({ stato: 'errore', messaggio: messaggioErrore(e) }))
    return () => {
      vivo = false
    }
  }, [cloudId, battito])

  return { ...stato, ricarica } as StatoVoti & { ricarica: () => void }
}

// ---------------------------------------------------------------------------
// Scrittura dei voti
// ---------------------------------------------------------------------------

/**
 * Scrive in un colpo i voti cambiati e cancella quelli svuotati.
 * Ritorna null se è andato tutto bene, altrimenti il messaggio d'errore.
 */
export async function salvaVoti(
  cloudId: string,
  daScrivere: VotoDaSalvare[],
  daCancellare: string[]
): Promise<string | null> {
  try {
    const sb = client()
    if (daScrivere.length > 0) {
      const { error } = await sb.from('voti').upsert(
        daScrivere.map((v) => ({ ...v, stagione_cloud: cloudId })),
        { onConflict: 'valutatore,partita_uid,giocatore_uid' }
      )
      if (error) throw new Error(error.message)
    }
    if (daCancellare.length > 0) {
      const { error } = await sb.from('voti').delete().in('id', daCancellare)
      if (error) throw new Error(error.message)
    }
    return null
  } catch (e) {
    return messaggioErrore(e)
  }
}

// ---------------------------------------------------------------------------
// Persone della stagione: condivisione e allenatori insieme
// ---------------------------------------------------------------------------

const pulisciEmail = (e: string) => e.trim().toLowerCase()

/** Una persona come la si imposta in Sincronizzazione. */
export interface PersonaStagione {
  email: string
  ruolo: 'lettura' | 'allenatore'
  /** solo per gli allenatori: il nome che compare nei voti */
  nome: string
  /** email degli allenatori per cui può inserire i voti */
  votaPer: string[]
}

/**
 * Chi vede la stagione e chi dà i voti, letti freschi dal server: la lista
 * in memoria della pagina potrebbe essere di qualche secondo fa.
 */
export async function leggiPersone(
  cloudId: string
): Promise<{ condivisaCon: string[]; valutatori: Valutatore[] | { errore: string } }> {
  const { data, error } = await client()
    .from('stagioni_cloud')
    .select('condivisa_con')
    .eq('id', cloudId)
    .single()
  if (error) throw new Error(messaggioErrore(new Error(error.message)))
  const condivisaCon = ((data as { condivisa_con: string[] }).condivisa_con ?? []).map(pulisciEmail)
  try {
    return { condivisaCon, valutatori: await leggiValutatori(cloudId) }
  } catch (e) {
    // Le tabelle dei voti possono non esserci ancora: la condivisione funziona lo stesso
    return { condivisaCon, valutatori: { errore: e instanceof Error ? e.message : String(e) } }
  }
}

export async function leggiValutatori(cloudId: string): Promise<Valutatore[]> {
  const { data, error } = await client()
    .from('valutatori')
    .select('*')
    .eq('stagione_cloud', cloudId)
    .order('creato_il', { ascending: true })
  if (error) throw new Error(messaggioErrore(new Error(error.message)))
  return (data ?? []) as Valutatore[]
}

/**
 * Salva in un colpo chi vede la stagione e chi dà i voti.
 *
 * È una lista sola: «può votare» è un livello di accesso in più rispetto al
 * «può vedere», quindi le email si scrivono una volta. Da qui:
 * - la lista di condivisione diventa esattamente le persone indicate;
 * - ogni allenatore ha la sua riga in `valutatori` (riattivata se esistente già,
 *   così ritrova i suoi voti), con le deleghe ricavate da «vota per»;
 * - chi non è più allenatore diventa ex: niente voti nuovi, quelli vecchi
 *   restano.
 * Il proprietario non sta nella condivisione: se dà i voti, `io` è la sua riga.
 */
export async function salvaPersone(
  cloudId: string,
  persone: PersonaStagione[],
  io: { email: string; vota: boolean; nome: string },
  esistenti: Valutatore[]
): Promise<string | null> {
  try {
    const sb = client()
    const mia = pulisciEmail(io.email)
    const pulite = persone
      .map((p) => ({ ...p, email: pulisciEmail(p.email), nome: p.nome.trim() }))
      .filter((p) => p.email.includes('@') && p.email !== mia)

    const { error: e1 } = await sb
      .from('stagioni_cloud')
      .update({ condivisa_con: [...new Set(pulite.map((p) => p.email))] })
      .eq('id', cloudId)
    if (e1) throw new Error(e1.message)

    const allenatori = [
      ...(io.vota ? [{ email: mia, nome: io.nome.trim() || 'Io', votaPer: [] as string[] }] : []),
      ...pulite
        .filter((p) => p.ruolo === 'allenatore')
        .map((p) => ({ email: p.email, nome: p.nome || p.email.split('@')[0], votaPer: p.votaPer })),
    ]
    const emailAllenatori = new Set(allenatori.map((a) => a.email))

    for (const a of allenatori) {
      // Le deleghe si salvano sul delegante: chi ha `a` nel suo «vota per»
      const delegati = allenatori
        .filter((x) => x.email !== a.email && x.votaPer.includes(a.email))
        .map((x) => x.email)
      const esistente = esistenti.find((v) => v.email === a.email)
      const { error } = esistente
        ? await sb
            .from('valutatori')
            .update({ nome: a.nome, delegati, attivo: true })
            .eq('id', esistente.id)
        : await sb
            .from('valutatori')
            .insert({ stagione_cloud: cloudId, nome: a.nome, email: a.email, delegati, attivo: true })
      if (error) throw new Error(error.message)
    }

    for (const v of esistenti) {
      if (v.email === null || emailAllenatori.has(v.email)) continue
      if (!v.attivo && v.delegati.length === 0) continue
      const { error } = await sb
        .from('valutatori')
        .update({ attivo: false, delegati: [] })
        .eq('id', v.id)
      if (error) throw new Error(error.message)
    }
    return null
  } catch (e) {
    return messaggioErrore(e)
  }
}

export async function aggiornaValutatore(
  id: string,
  campi: { nome?: string; delegati?: string[] }
): Promise<string | null> {
  try {
    const pulito = {
      ...(campi.nome !== undefined ? { nome: campi.nome.trim() } : {}),
      ...(campi.delegati !== undefined
        ? { delegati: [...new Set(campi.delegati.map(pulisciEmail))] }
        : {}),
    }
    const { error } = await client().from('valutatori').update(pulito).eq('id', id)
    if (error) throw new Error(error.message)
    return null
  } catch (e) {
    return messaggioErrore(e)
  }
}

/**
 * Crea un allenatore senza account, per i voti dello storico. Nessuno lo
 * impersona: i suoi voti li può scrivere solo il proprietario (o chi riceve
 * la delega). Restituisce il nuovo id, o un messaggio d'errore.
 */
export async function creaValutatoreStorico(
  cloudId: string,
  nome: string
): Promise<{ id: string } | { errore: string }> {
  try {
    const { data, error } = await client()
      .from('valutatori')
      .insert({ stagione_cloud: cloudId, nome: nome.trim(), email: null })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return { id: (data as { id: string }).id }
  } catch (e) {
    const m = messaggioErrore(e)
    return {
      errore: /null value in column "email"/i.test(m)
        ? 'Per gli allenatori senza account va rieseguito supabase/voti.sql aggiornato.'
        : m,
    }
  }
}

/** Elimina un valutatore E tutti i suoi voti (cascade sul server). */
export async function eliminaValutatore(id: string): Promise<string | null> {
  try {
    const { error } = await client().from('valutatori').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return null
  } catch (e) {
    return messaggioErrore(e)
  }
}
