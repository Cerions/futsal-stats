import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { esportaStagione } from '../db/export'
import { improntaDati } from './impronta'
import { caricaStagione, scaricaStagione, versioneCloud } from './sync'
import { cloudConfigurato } from './supabase'
import { useSessione } from './auth'
import { scriviStatoSync } from './statoSync'
import type { Stagione } from '../db/schema'

/**
 * Sincronizzazione automatica delle stagioni collegate al cloud.
 *
 * L'idea: il setup fatto sul PC deve ritrovarsi sul telefono senza premere
 * niente. Il modello di sincronizzazione resta quello a stagione intera
 * (una riga sul cloud con dentro l'export completo); qui si aggiunge solo
 * quando farlo partire da solo.
 *
 * - CARICA quando i dati locali sono cambiati rispetto all'ultima
 *   sincronizzazione, dopo qualche secondo di quiete.
 * - SCARICA quando il cloud ha una versione più alta di quella che abbiamo
 *   già visto, e non ci sono modifiche locali in attesa.
 * - SI FERMA quando c'è una partita in corso: durante la partita i dati
 *   cambiano a ogni tocco, e ricaricare l'intera stagione ogni pochi secondi
 *   brucerebbe traffico per niente. Alla fine della partita riparte da sola.
 * - SI FERMA su conflitto (cambiata sia qui sia altrove): la scelta di quale
 *   versione tenere è dell'utente e si fa dalla pagina Cloud.
 */

/** Quiete da aspettare prima di caricare, per non caricare a ogni tasto. */
const RITARDO_CARICA_MS = 2500
/** Ogni quanto ricontrollare il cloud mentre l'app è aperta e visibile. */
const INTERVALLO_CONTROLLO_MS = 60_000

// ---------------------------------------------------------------------------

/** Vera solo per le stagioni che la sincronizzazione automatica deve seguire. */
function daSeguire(s: Stagione): boolean {
  return Boolean(s.cloudId) && s.cloudAuto !== false && !s.cloudConflitto
}

export default function SincronizzazioneAuto() {
  const { sessione } = useSessione()
  const stagioni = useLiveQuery(() => db.stagioni.toArray(), [])

  // Senza cloud configurato o senza login non c'è niente da sincronizzare.
  if (!cloudConfigurato || !sessione) return null

  return (
    <>
      {(stagioni ?? []).filter(daSeguire).map((s) => (
        <StagioneSincronizzata key={s.id} stagione={s} />
      ))}
    </>
  )
}

function StagioneSincronizzata({ stagione }: { stagione: Stagione }) {
  const stagioneId = stagione.id!
  const cloudId = stagione.cloudId!
  const location = useLocation()

  // Rieseguito da Dexie a ogni modifica dei dati della stagione: è questo il
  // segnale che qualcosa è cambiato. L'impronta dice *se* è cambiato davvero.
  const dati = useLiveQuery(() => esportaStagione(stagioneId), [stagioneId])
  const impronta = dati ? improntaDati(dati) : null

  const partitaInCorso = (dati?.partite ?? []).some((p) => p.stato === 'in_corso')
  const daCaricare =
    !stagione.soloLettura && impronta !== null && impronta !== stagione.cloudImpronta

  // Scaricare rimappa gli id locali: se si sta guardando una partita, la
  // pagina aperta sparirebbe sotto i piedi. Si rimanda al controllo dopo.
  const dentroUnaPartita = location.pathname.startsWith('/partita/')

  // Battito per riprovare: al ritorno sull'app, quando torna la linea, e
  // ogni tanto mentre è aperta.
  const [battito, setBattito] = useState(0)
  useEffect(() => {
    const sveglia = () => setBattito((b) => b + 1)
    const seVisibile = () => {
      if (document.visibilityState === 'visible') sveglia()
    }
    document.addEventListener('visibilitychange', seVisibile)
    window.addEventListener('online', sveglia)
    const timer = setInterval(seVisibile, INTERVALLO_CONTROLLO_MS)
    return () => {
      document.removeEventListener('visibilitychange', seVisibile)
      window.removeEventListener('online', sveglia)
      clearInterval(timer)
    }
  }, [])

  // Una operazione alla volta per stagione: senza questo, un caricamento lento
  // e un controllo periodico potrebbero accavallarsi sulla stessa riga.
  const occupata = useRef(false)

  // ----- CARICA -----
  useEffect(() => {
    if (partitaInCorso) {
      scriviStatoSync(stagioneId, 'inPausaPartita')
      return
    }
    if (!daCaricare) {
      scriviStatoSync(stagioneId, 'inPari')
      return
    }
    scriviStatoSync(stagioneId, 'daCaricare')
    let vivo = true
    const timer = setTimeout(async () => {
      if (!vivo || occupata.current) return
      occupata.current = true
      scriviStatoSync(stagioneId, 'inCorso')
      try {
        const esito = await caricaStagione(stagioneId)
        // Il conflitto viene scritto sulla stagione da caricaStagione: questo
        // componente smette di essere renderizzato e la UI mostra il banner.
        scriviStatoSync(stagioneId, esito.esito === 'errore' ? 'errore' : 'inPari')
      } finally {
        occupata.current = false
      }
    }, RITARDO_CARICA_MS)
    return () => {
      vivo = false
      clearTimeout(timer)
    }
  }, [daCaricare, impronta, partitaInCorso, stagioneId, battito])

  // ----- SCARICA -----
  useEffect(() => {
    // Finché l'impronta non è calcolata non so se ho modifiche locali in
    // attesa: scaricare adesso le butterebbe via senza accorgersene.
    if (impronta === null) return
    if (partitaInCorso || dentroUnaPartita || daCaricare) return
    let vivo = true
    void (async () => {
      if (occupata.current) return
      try {
        const versione = await versioneCloud(cloudId)
        if (!vivo || versione === null) return
        if (versione <= (stagione.cloudVersione ?? 0)) return
        if (occupata.current) return
        occupata.current = true
        try {
          await scaricaStagione(cloudId, { soloLettura: stagione.soloLettura })
        } finally {
          occupata.current = false
        }
      } catch {
        // Nessuna linea: si riprova al prossimo battito.
      }
    })()
    return () => {
      vivo = false
    }
  }, [
    battito,
    impronta,
    cloudId,
    stagione.cloudVersione,
    stagione.soloLettura,
    daCaricare,
    partitaInCorso,
    dentroUnaPartita,
  ])

  // Non disegna niente: esiste solo per i suoi effetti.
  return null
}
