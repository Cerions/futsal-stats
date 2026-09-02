export function Legenda({
  voci,
}: {
  voci: { colore: string; label: string }[]
}) {
  return (
    <div className="flex items-center gap-4 flex-wrap text-xs text-slate-400 mb-2">
      {voci.map((v) => (
        <span key={v.label} className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ backgroundColor: v.colore }}
          />
          {v.label}
        </span>
      ))}
    </div>
  )
}

export function TitoloGrafico({
  titolo,
  sottotitolo,
}: {
  titolo: string
  sottotitolo?: string
}) {
  return (
    <>
      <h3 className="text-sm uppercase tracking-wider text-slate-400 font-semibold">
        {titolo}
      </h3>
      {sottotitolo && (
        <p className="text-xs text-slate-500 mb-2 mt-0.5">{sottotitolo}</p>
      )}
    </>
  )
}

export function NienteDati({ testo }: { testo: string }) {
  return <p className="text-slate-500 italic text-sm py-6 text-center">{testo}</p>
}

