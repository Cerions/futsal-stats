import { TAG_PARTITA } from '../db/schema'
import type { TagPartita } from '../db/schema'

interface Props {
  value: TagPartita | undefined
  onChange: (tag: TagPartita | undefined) => void
}

export default function TagSelector({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onChange(undefined)}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
          value === undefined
            ? 'bg-slate-700 border-slate-500 text-slate-100'
            : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'
        }`}
      >
        Nessuno
      </button>
      {TAG_PARTITA.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
            value === t.value
              ? `${t.coloreBg} ${t.colore}`
              : 'bg-slate-900 text-slate-500 border border-slate-700 hover:text-slate-300'
          }`}
        >
          {t.value}
        </button>
      ))}
    </div>
  )
}