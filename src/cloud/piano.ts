import { useEffect, useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { cloudConfigurato, supabase } from './supabase'
import { useSessione } from './auth'

/**
 * Piano dell'account: Premium o gratuito.
 *
 * Chi è Premium lo dice la tabella `abbonamenti` su Supabase (vedi
 * supabase/abbonamenti.sql), che si modifica solo dalla dashboard. L'app la
 * legge quando c'è linea e si tiene l'ultima risposta in localStorage, così
 * offline continua a sapere com'era. Se la riga ha una scadenza, la scadenza
 * vale anche offline: il giorno dopo il piano è gratuito senza chiedere a
 * nessuno.
 *
 * Il piano gratuito permette UNA partita. Con più di una (per esempio alla
 * fine della prova) le partite si guardano ma non si modificano, e per
 * registrarne una nuova bisogna eliminarle. Niente download del backup.
 *
 * Il Premium è dell'account che possiede le stagioni: chi le riceve in
 * condivisione (sola lettura o allenatore che vota) non crea partite in
 * quelle stagioni, quindi il piano non lo riguarda.
 */

/** Quante partite si possono avere col piano gratuito. */
export const PARTITE_GRATIS = 1

/** Ultima risposta del server, salvata per quando si è offline. */
interface Verifica {
  email: string
  /** la tabella non c'è ancora sul server: il piano non è attivo, nessun limite */
  tabellaAssente: boolean
  /** c'è una riga per questa email */
  trovato: boolean
  scadeIl: string | null
  verificatoIl: number
}

const CHIAVE = 'futsal-stats-piano'
/** Sotto questo intervallo non si richiede di nuovo, salvo `forza`. */
const RINFRESCO_MS = 30_000

function leggiCache(): Verifica | null {
  try {
    const s = localStorage.getItem(CHIAVE)
    return s ? (JSON.parse(s) as Verifica) : null
  } catch {
    return null
  }
}

let cache: Verifica | null = leggiCache()
let verificando: string | null = null
let versione = 0
const ascoltatori = new Set<() => void>()

function avvisa() {
  versione++
  for (const a of ascoltatori) a()
}

function scriviCache(v: Verifica) {
  cache = v
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(v))
  } catch {
    // niente spazio: vale fino alla chiusura dell'app
  }
  avvisa()
}

function sottoscrivi(a: () => void) {
  ascoltatori.add(a)
  return () => {
    ascoltatori.delete(a)
  }
}

const leggiVersione = () => versione

function tabellaMancante(e: { code?: string; message?: string }): boolean {
  return (
    e.code === 'PGRST205' ||
    e.code === '42P01' ||
    /could not find the table|relation .* does not exist/i.test(e.message ?? '')
  )
}

const inVolo = new Map<string, Promise<void>>()

/** Chiede al server il piano di questa email. Senza linea non cambia niente. */
export function verificaPiano(email: string, forza = false): Promise<void> {
  const sb = supabase
  if (!sb) return Promise.resolve()
  const em = email.toLowerCase()
  if (!forza && cache?.email === em && Date.now() - cache.verificatoIl < RINFRESCO_MS)
    return Promise.resolve()
  const gia = inVolo.get(em)
  if (gia) return gia

  verificando = em
  avvisa()
  const p = (async () => {
    const { data, error } = await sb
      .from('abbonamenti')
      .select('scade_il')
      .eq('email', em)
      .maybeSingle()
    if (error) {
      if (tabellaMancante(error)) {
        scriviCache({
          email: em,
          tabellaAssente: true,
          trovato: false,
          scadeIl: null,
          verificatoIl: Date.now(),
        })
      }
      // Rete assente o altro errore: resta valido quel che sapevamo.
      return
    }
    const riga = data as { scade_il: string | null } | null
    scriviCache({
      email: em,
      tabellaAssente: false,
      trovato: riga !== null,
      scadeIl: riga?.scade_il ?? null,
      verificatoIl: Date.now(),
    })
  })()
    .catch(() => {})
    .finally(() => {
      inVolo.delete(em)
      if (verificando === em) verificando = null
      avvisa()
    })
  inVolo.set(em, p)
  return p
}

export type MotivoPiano =
  /** app senza Supabase (sviluppo locale): nessun limite */
  | 'senzaCloud'
  /** tabella abbonamenti non ancora creata: nessun limite */
  | 'nonAttivo'
  | 'premium'
  | 'scaduto'
  | 'gratuito'
  /** nessun account collegato su questo dispositivo */
  | 'senzaAccesso'
  /** account collegato ma mai verificato (es. offline dal primo accesso) */
  | 'daVerificare'

export interface Piano {
  premium: boolean
  motivo: MotivoPiano
  /** scadenza del Premium in ms, null se non scade o non c'è */
  scadeIl: number | null
}

// Fuori dal componente: Date.now() durante il render non è puro.
function calcolaPiano(email: string | null): Piano {
  if (!cloudConfigurato) return { premium: true, motivo: 'senzaCloud', scadeIl: null }
  if (!email) return { premium: false, motivo: 'senzaAccesso', scadeIl: null }
  const v = cache
  if (!v || v.email !== email) return { premium: false, motivo: 'daVerificare', scadeIl: null }
  if (v.tabellaAssente) return { premium: true, motivo: 'nonAttivo', scadeIl: null }
  if (!v.trovato) return { premium: false, motivo: 'gratuito', scadeIl: null }
  if (v.scadeIl === null) return { premium: true, motivo: 'premium', scadeIl: null }
  const t = Date.parse(v.scadeIl)
  return t > Date.now()
    ? { premium: true, motivo: 'premium', scadeIl: t }
    : { premium: false, motivo: 'scaduto', scadeIl: t }
}

/** Il piano dell'account collegato, aggiornato quando l'app torna visibile. */
export function usePiano(): Piano & { caricamento: boolean } {
  const { email, caricamento: sessioneInCaricamento } = useSessione()
  useSyncExternalStore(sottoscrivi, leggiVersione, leggiVersione)
  const em = email?.toLowerCase() ?? null

  useEffect(() => {
    if (!em) return
    void verificaPiano(em)
    const sveglia = () => {
      if (document.visibilityState === 'visible') void verificaPiano(em)
    }
    document.addEventListener('visibilitychange', sveglia)
    window.addEventListener('online', sveglia)
    return () => {
      document.removeEventListener('visibilitychange', sveglia)
      window.removeEventListener('online', sveglia)
    }
  }, [em])

  const piano = calcolaPiano(em)
  const caricamento =
    sessioneInCaricamento || (piano.motivo === 'daVerificare' && verificando === em)
  return { ...piano, caricamento }
}

/**
 * Partite nelle stagioni di questo account su questo dispositivo. Quelle
 * ricevute in condivisione non contano: non sono sue.
 */
export function usePartiteMie(): number | undefined {
  return useLiveQuery(async () => {
    const mie = await db.stagioni.filter((s) => !s.soloLettura).primaryKeys()
    if (mie.length === 0) return 0
    return db.partite.where('stagioneId').anyOf(mie).count()
  }, [])
}

export interface Limiti {
  piano: Piano & { caricamento: boolean }
  partite: number
  /** piano e conteggio sono arrivati: prima i blocchi non si mostrano */
  pronto: boolean
  /** si può creare una partita nuova */
  puoCreare: boolean
  /** più partite di quante ne permette il gratuito: si guardano e basta */
  sopraLimite: boolean
  /** si può scaricare il backup */
  puoEsportare: boolean
}

export function useLimiti(): Limiti {
  const piano = usePiano()
  const conteggio = usePartiteMie()
  const partite = conteggio ?? 0
  const pronto = !piano.caricamento && conteggio !== undefined
  return {
    piano,
    partite,
    pronto,
    puoCreare: pronto && (piano.premium || partite < PARTITE_GRATIS),
    sopraLimite: pronto && !piano.premium && partite > PARTITE_GRATIS,
    puoEsportare: piano.premium,
  }
}

/** Una riga che descrive il piano, per la pagina Sincronizzazione. */
export function descriviPiano(p: Piano): string {
  const data = (t: number) =>
    new Date(t).toLocaleString('it-IT', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    })
  switch (p.motivo) {
    case 'premium':
      return p.scadeIl === null ? '⭐ Premium' : `⭐ Premium fino al ${data(p.scadeIl)}`
    case 'scaduto':
      return `Piano gratuito · il Premium è scaduto il ${data(p.scadeIl!)}`
    case 'gratuito':
      return 'Piano gratuito'
    case 'daVerificare':
      return 'Piano da verificare: serve la connessione'
    case 'nonAttivo':
    case 'senzaCloud':
      return 'Nessun limite attivo'
    case 'senzaAccesso':
      return 'Piano gratuito'
  }
}
