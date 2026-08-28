import { Link } from 'react-router-dom'
import { useStatoSync } from '../cloud/statoSync'
import { cloudConfigurato } from '../cloud/supabase'
import type { Stagione } from '../db/schema'

/**
 * Pillola di stato della sincronizzazione automatica.
 * Conflitto e "spenta" si leggono dalla stagione, il resto dallo store che
 * `SincronizzazioneAuto` tiene aggiornato.
 */
export default function StatoCloud({ stagione }: { stagione: Stagione }) {
  const stato = useStatoSync(stagione.id!)

  if (!cloudConfigurato || !stagione.cloudId) return null

  if (stagione.cloudConflitto) {
    return (
      <Link
        to="/cloud"
        className="inline-flex items-center gap-1.5 text-xs bg-amber-900/40 border border-amber-700/60 text-amber-200 rounded-full px-2.5 py-1"
      >
        ⚠️ Conflitto — scegli quale versione tenere
      </Link>
    )
  }

  if (stagione.cloudAuto === false) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 border border-slate-700 rounded-full px-2.5 py-1">
        ☁️ Sincronizzazione automatica spenta
      </span>
    )
  }

  const testo: Record<string, string> = {
    inPari: '☁️ Sincronizzata',
    daCaricare: '☁️ Salvataggio…',
    inCorso: '☁️ Salvataggio…',
    inPausaPartita: '⏸️ In pausa durante la partita',
    errore: '📴 Offline — riproverà da sola',
  }
  const colore =
    stato === 'errore'
      ? 'text-slate-400 border-slate-700'
      : stato === 'inPari'
      ? 'text-emerald-400/90 border-emerald-800/60'
      : 'text-slate-400 border-slate-700'

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs border rounded-full px-2.5 py-1 ${colore}`}
    >
      {stato === null ? '☁️ Collegata al cloud' : testo[stato]}
    </span>
  )
}
