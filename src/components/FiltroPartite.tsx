import { useState } from 'react'
import type { Partita } from '../db/schema'
import { ETICHETTE_PRESET, PRESET, partiteDelPreset } from '../utils/preset'
import type { Preset } from '../utils/preset'

/**
 * Su quali partite guardare le statistiche.
 *
 * Due modi, e uno esclude l'altro. I preset in alto sono insiemi che si
 * ridefiniscono da soli: scelto «Campionato», una partita di campionato giocata
 * domani ci entra senza toccare niente. La lista sotto è invece una scelta a
 * mano, e allora conta esattamente quello che è spuntato.
 */

export default function FiltroPartite({
  finite,
  preset,
  selezionate,
  etichetta,
  onPreset,
  onSelezione,
}: {
  /** tutte le partite concluse, dalla più recente */
  finite: Partita[]
  /** il preset attivo, o null se la scelta è a mano */
  preset: Preset | null
  /** gli id attualmente nell'ambito */
  selezionate: Set<number>
  etichetta: (p: Partita) => string
  onPreset: (p: Preset) => void
  onSelezione: (ids: number[]) => void
}) {
  const [aperto, setAperto] = useState(preset === null)

  // Un preset senza partite non si mostra: sarebbe un bottone che porta a una
  // schermata vuota. «Tutte» resta sempre, se siamo qui c'è almeno una partita.
  const presetVisibili = PRESET.map((p) => ({
    valore: p,
    quante: partiteDelPreset(finite, p).length,
  })).filter((p) => p.valore === 'tutte' || p.quante > 0)

  const cambia = (id: number) => {
    const dopo = new Set(selezionate)
    if (dopo.has(id)) dopo.delete(id)
    else dopo.add(id)
    onSelezione(Array.from(dopo))
  }

  return (
    <div className="bg-slate-800 rounded-xl p-3 mb-3">
      <div className="flex flex-wrap gap-1.5">
        {presetVisibili.map(({ valore, quante }) => (
          <button
            key={valore}
            data-preset={valore}
            onClick={() => onPreset(valore)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
              preset === valore
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            {ETICHETTE_PRESET[valore]}{' '}
            <span className="font-normal opacity-70">{quante}</span>
          </button>
        ))}
      </div>

      <button
        onClick={() => setAperto((v) => !v)}
        className="w-full flex items-center justify-between mt-2 pt-2 border-t border-slate-700 text-sm text-slate-400 hover:text-slate-200"
      >
        <span>
          {preset === null ? 'Scelte a mano' : 'Scegli le partite a mano'}
        </span>
        <span className="text-xs">
          {selezionate.size} di {finite.length} {aperto ? '▲' : '▼'}
        </span>
      </button>

      {aperto && (
        <div className="mt-2">
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => onSelezione(finite.map((p) => p.id!))}
              className="text-xs bg-slate-900 hover:bg-slate-700 px-2 py-1 rounded"
            >
              Spunta tutte
            </button>
            <button
              onClick={() => onSelezione([])}
              className="text-xs bg-slate-900 hover:bg-slate-700 px-2 py-1 rounded"
            >
              Nessuna
            </button>
          </div>
          <ul className="flex flex-col gap-1 max-h-72 overflow-y-auto">
            {finite.map((p) => {
              const scelta = selezionate.has(p.id!)
              return (
                <li key={p.id}>
                  <label
                    data-partita={p.id}
                    data-scelta={scelta ? 'si' : 'no'}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm ${
                      scelta ? 'bg-slate-900' : 'bg-slate-900/40 text-slate-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={scelta}
                      onChange={() => cambia(p.id!)}
                      className="w-4 h-4 shrink-0"
                    />
                    <span className="flex-1 min-w-0 truncate">{etichetta(p)}</span>
                    {p.tag && (
                      <span className="text-xs text-slate-500 shrink-0">{p.tag}</span>
                    )}
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
