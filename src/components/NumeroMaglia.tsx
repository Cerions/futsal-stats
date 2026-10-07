import { useState } from 'react'
import { db } from '../db/database'
import Modal from './Modal'
import { nomeCorto } from '../utils/giocatore'
import type { Giocatore } from '../db/schema'

/**
 * Il numero di maglia, toccabile per cambiarlo.
 *
 * A questi livelli i numeri non sono di proprietà: si assegnano la domenica
 * mattina con la borsa delle maglie aperta, anche se ognuno cerca di tenersi il
 * suo. Quindi si assegna qui, mentre scegli chi gioca, e quello che metti
 * diventa il numero del giocatore — il preferito da cui si riparte la volta
 * dopo, senza passare dal setup della stagione.
 *
 * I doppioni si segnalano ma non si bloccano: per scambiare due numeri bisogna
 * passare da uno stato in cui sono uguali.
 */
export default function NumeroMaglia({
  giocatore,
  rosa,
  modificabile = false,
}: {
  giocatore: Giocatore
  /** Serve solo a dire se il numero scelto è già di qualcun altro. */
  rosa: Giocatore[]
  modificabile?: boolean
}) {
  const [aperto, setAperto] = useState(false)
  const [bozza, setBozza] = useState('')

  function apri() {
    if (!modificabile) return
    setBozza(giocatore.numero?.toString() ?? '')
    setAperto(true)
  }

  const numero = bozza.trim() === '' ? undefined : Number(bozza)
  const valido =
    numero === undefined ||
    (Number.isInteger(numero) && numero >= 0 && numero <= 99)
  const giaDi = rosa.find(
    (g) => g.id !== giocatore.id && numero !== undefined && g.numero === numero
  )

  async function salva() {
    if (!valido) return
    // Dexie cancella la proprietà quando il valore è undefined: è così che si
    // torna a «senza numero».
    await db.giocatori.update(giocatore.id!, { numero })
    setAperto(false)
  }

  const vuoto = giocatore.numero === undefined

  return (
    <>
      <button
        type="button"
        onClick={apri}
        disabled={!modificabile}
        data-numero={giocatore.id}
        title={modificabile ? 'Cambia il numero di maglia' : undefined}
        className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
          vuoto
            ? 'border border-dashed border-slate-600 text-slate-500'
            : 'bg-slate-700'
        } ${modificabile ? 'hover:bg-slate-600 cursor-pointer' : 'cursor-default'}`}
      >
        {vuoto ? '–' : giocatore.numero}
      </button>

      <Modal
        open={aperto}
        onClose={() => setAperto(false)}
        title={`Numero di ${nomeCorto(giocatore)}`}
      >
        <div className="flex flex-col gap-3">
          <input
            type="number"
            min="0"
            max="99"
            inputMode="numeric"
            value={bozza}
            onChange={(e) => setBozza(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && salva()}
            autoFocus
            data-numero-campo
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-lg focus:outline-none focus:border-emerald-500"
          />
          <p className="text-xs text-slate-500">
            Lascia vuoto per togliergli il numero. Quello che metti resta il suo
            anche nelle prossime partite, finché non lo cambi.
          </p>
          {giaDi !== undefined && (
            <p className="text-xs text-amber-300" data-numero-doppione>
              Il {numero} ce l'ha anche {nomeCorto(giaDi)}. Puoi salvare lo
              stesso — serve per scambiarli — ma poi sistemalo.
            </p>
          )}
          <div className="flex justify-end gap-2 mt-1">
            <button
              onClick={() => setAperto(false)}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600"
            >
              Annulla
            </button>
            <button
              onClick={salva}
              disabled={!valido}
              data-numero-salva
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
            >
              Salva
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
