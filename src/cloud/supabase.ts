import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Client Supabase, creato solo se le variabili d'ambiente ci sono.
 *
 * La chiave anon è pubblica per progetto: finisce nel bundle ed è normale.
 * A proteggere i dati sono le policy RLS definite in supabase/schema.sql,
 * non la segretezza della chiave.
 *
 * Se le variabili mancano l'app funziona lo stesso, completamente offline:
 * `cloudConfigurato` resta false e la UI non mostra la sincronizzazione.
 */
const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

export const cloudConfigurato = Boolean(url && anon)

export const supabase: SupabaseClient | null = cloudConfigurato
  ? createClient(url!, anon!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null

/** Il client, o un errore chiaro se la sincronizzazione non è configurata. */
export function client(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Sincronizzazione non configurata: mancano VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY.'
    )
  }
  return supabase
}

/**
 * Etichetta del dispositivo, per capire dall'elenco chi ha fatto l'ultimo
 * salvataggio. Generata una volta e tenuta in localStorage.
 */
const CHIAVE_DISPOSITIVO = 'futsal-stats-dispositivo'

export function nomeDispositivo(): string {
  try {
    const salvato = localStorage.getItem(CHIAVE_DISPOSITIVO)
    if (salvato) return salvato
    const ua = navigator.userAgent
    const indovinato = /android|iphone|ipad|mobile/i.test(ua) ? 'Telefono' : 'PC'
    const etichetta = `${indovinato} ${Math.random().toString(36).slice(2, 6)}`
    localStorage.setItem(CHIAVE_DISPOSITIVO, etichetta)
    return etichetta
  } catch {
    return 'Dispositivo'
  }
}

export function rinominaDispositivo(nome: string) {
  try {
    localStorage.setItem(CHIAVE_DISPOSITIVO, nome.trim() || 'Dispositivo')
  } catch {
    // spazio non disponibile: pazienza, è solo un'etichetta
  }
}
