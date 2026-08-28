import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { cloudConfigurato, supabase } from './supabase'

/**
 * Sessione Supabase corrente.
 * `caricamento` resta true finché non sappiamo se c'è già una sessione salvata,
 * così la UI non lampeggia mostrando il login a chi è già dentro.
 */
export function useSessione() {
  const [sessione, setSessione] = useState<Session | null>(null)
  const [caricamento, setCaricamento] = useState(cloudConfigurato)

  useEffect(() => {
    // Senza client non c'è niente da caricare: `caricamento` parte già a false
    if (!supabase) return
    let vivo = true
    supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return
      setSessione(data.session)
      setCaricamento(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSessione(s)
    })
    return () => {
      vivo = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return { sessione, caricamento, email: sessione?.user.email ?? null }
}

/** Traduce i messaggi di errore più comuni di Supabase. */
function traduciErrore(messaggio: string): string {
  const m = messaggio.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email o password non corretti.'
  if (m.includes('email not confirmed'))
    return 'Devi confermare la mail prima di entrare (o disattiva la conferma su Supabase).'
  if (m.includes('user already registered')) return 'Esiste già un account con questa email.'
  if (m.includes('password should be')) return 'La password è troppo corta: almeno 6 caratteri.'
  if (m.includes('failed to fetch') || m.includes('network'))
    return 'Nessuna connessione: riprova quando hai linea.'
  return messaggio
}

export async function accedi(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'Sincronizzazione non configurata.'
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  return error ? traduciErrore(error.message) : null
}

export async function registrati(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'Sincronizzazione non configurata.'
  const { error } = await supabase.auth.signUp({ email: email.trim(), password })
  return error ? traduciErrore(error.message) : null
}

export async function esci(): Promise<void> {
  await supabase?.auth.signOut()
}
