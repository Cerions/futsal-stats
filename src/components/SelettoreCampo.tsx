import { CAMPI_PARTITA } from '../db/schema'
import type { CampoPartita } from '../db/schema'

/**
 * Casa o trasferta, con la terza possibilità di non dirlo.
 *
 * «Non impostato» non è un ripiego: è lo stato delle partite registrate prima
 * che questo campo esistesse, e deve restare raggiungibile anche a mano — se
 * l'hai messo per sbaglio devi poterlo togliere, invece di scegliere fra due
 * valori di cui uno è comunque falso.
 */
export default function SelettoreCampo({
  value,
  onChange,
}: {
  value: CampoPartita | undefined
  onChange: (c: CampoPartita | undefined) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {CAMPI_PARTITA.map((c) => (
        <button
          key={c.value}
          type="button"
          data-campo={c.value}
          onClick={() => onChange(value === c.value ? undefined : c.value)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
            value === c.value
              ? 'bg-slate-700 border-slate-500 text-slate-100'
              : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'
          }`}
        >
          {c.icona} {c.label}
        </button>
      ))}
      <button
        type="button"
        data-campo="nessuno"
        onClick={() => onChange(undefined)}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
          value === undefined
            ? 'bg-slate-700 border-slate-500 text-slate-100'
            : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'
        }`}
      >
        Non impostato
      </button>
    </div>
  )
}
