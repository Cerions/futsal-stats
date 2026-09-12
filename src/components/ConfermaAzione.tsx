import { useEffect, useState } from 'react'
import type { PropsConferma, RichiestaConferma } from '../utils/conferma'

/**
 * Il modale che chiede conferma prima di cancellare.
 *
 * Il bottone rosso sta a destra e non è quello di partenza: chiudendo con Esc o
 * toccando fuori si annulla, mai si conferma. Dove serve una parola chiave il
 * bottone resta spento finché non combacia — non per burocrazia, ma perché
 * quelle cancellazioni non hanno un ritorno.
 */
export default function ConfermaAzione({ richiesta, onRisposta }: PropsConferma) {
  // Il corpo esiste solo mentre c'è una domanda aperta: fra due richieste si
  // smonta, e il campo della parola chiave riparte vuoto da sé, senza che
  // nessuno lo debba azzerare a mano.
  if (richiesta === null) return null
  return <Corpo richiesta={richiesta} onRisposta={onRisposta} />
}

function Corpo({
  richiesta,
  onRisposta,
}: {
  richiesta: RichiestaConferma
  onRisposta: (confermato: boolean) => void
}) {
  const [digitato, setDigitato] = useState('')

  useEffect(() => {
    const perEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onRisposta(false)
    }
    window.addEventListener('keydown', perEsc)
    return () => window.removeEventListener('keydown', perEsc)
  }, [onRisposta])

  const serveParola = richiesta.parolaChiave !== undefined
  const pronto = !serveParola || digitato.trim() === richiesta.parolaChiave

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
      onClick={() => onRisposta(false)}
      data-conferma="aperta"
    >
      <div
        className="bg-slate-800 rounded-xl p-5 w-full max-w-md shadow-2xl border border-slate-700"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h2 className="text-lg font-bold mb-2">{richiesta.titolo}</h2>
        <div className="text-sm text-slate-300 mb-4">{richiesta.messaggio}</div>

        {serveParola && (
          <div className="mb-4">
            <label className="block text-xs text-slate-400 mb-1">
              Scrivi «{richiesta.parolaChiave}» per confermare
            </label>
            <input
              autoFocus
              value={digitato}
              onChange={(e) => setDigitato(e.target.value)}
              data-conferma-parola
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-red-500"
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={() => onRisposta(false)}
            data-conferma-annulla
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 font-semibold"
          >
            Annulla
          </button>
          <button
            onClick={() => onRisposta(true)}
            disabled={!pronto}
            data-conferma-ok
            className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {richiesta.azione ?? 'Elimina'}
          </button>
        </div>
      </div>
    </div>
  )
}
