import { useState } from 'react'
import type { Evento, OrigineTiro, Schema } from '../../db/schema'
import {
  contaInattive,
  statistichePerOrigine,
  statistichePerSchema,
} from '../../utils/statistiche'
import {
  formatXG,
  inattivaIcona,
  inattivaLabel,
  origineIcona,
  origineLabel,
  originiPerFronte,
} from '../../db/zone'
import type { Fronte } from '../../db/zone'

/**
 * Da cosa nascono le conclusioni e quanto rendono gli schemi.
 *
 * Le due tabelle stanno insieme perché rispondono alla stessa domanda a due
 * livelli: prima la situazione (corner, punizione, contropiede), poi lo schema
 * preciso dentro quella situazione.
 *
 * Nella colonna «Gol» ci sono anche gli autogol che abbiamo provocato: per lo
 * schema sono una riuscita esattamente come un gol nostro, ed era strano
 * vedere «0 gol» su un corner finito in rete. «AG» resta accanto a dire quanti
 * di quei gol sono arrivati così. Conversione e xG invece no: vogliono un tiro
 * nostro dietro, e un corner con un tiro e due gol darebbe il 200%.
 */

/** I gol che quella situazione o quello schema ha prodotto, autogol compresi. */
function golTotali(r: { gol: number; autogol: number }): number {
  return r.gol + r.autogol
}

export default function VistaInattive({
  eventi,
  schemi,
}: {
  eventi: Evento[]
  schemi: Schema[]
}) {
  const [fronte, setFronte] = useState<Fronte>('nostro')

  const definizioni = originiPerFronte(fronte)
  const conteggi = statistichePerOrigine(eventi, fronte)
  const perOrigine = definizioni
    .map((d) => conteggi.find((o) => o.origine === d.value))
    .filter((o) => o !== undefined)
  const etichetta = (o: OrigineTiro) =>
    definizioni.find((d) => d.value === o)?.label ?? origineLabel(o)
  const autogolProvocati = perOrigine.reduce((n, o) => n + o.autogol, 0)
  const mostraAutogol = fronte === 'nostro'
  const perSchema = statistichePerSchema(eventi, schemi)
  const battute = contaInattive(eventi)

  return (
    <>
      <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2">
        Da cosa nascono le conclusioni
      </h2>
      <div className="grid grid-cols-2 gap-2 mb-2">
        {(
          [
            ['nostro', 'Nostre'],
            ['loro', 'Subite'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setFronte(v)}
            className={`py-1.5 rounded-lg text-sm font-semibold ${
              fronte === v
                ? v === 'nostro'
                  ? 'bg-emerald-600'
                  : 'bg-red-600'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto -mx-4 px-4 mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-xs text-slate-400">
              <th className="px-2 py-2 text-left font-semibold">Situazione</th>
              <th className="px-2 py-2 text-right font-semibold">Tiri</th>
              <th
                className="px-2 py-2 text-right font-semibold"
                title={
                  mostraAutogol
                    ? 'Gol nati da questa situazione, autogol avversari compresi'
                    : 'Gol subiti da questa situazione'
                }
              >
                Gol
              </th>
              {mostraAutogol && (
                <th
                  className="px-2 py-2 text-right font-semibold"
                  title="Quanti di quei gol sono autogol avversari che abbiamo provocato"
                >
                  AG
                </th>
              )}
              <th
                className="px-2 py-2 text-right font-semibold"
                title="Gol su tiri: contano solo le conclusioni, gli autogol restano fuori"
              >
                Conv.
              </th>
              <th className="px-2 py-2 text-right font-semibold">xG</th>
            </tr>
          </thead>
          <tbody>
            {perOrigine.map((o) => (
              <tr
                key={o.origine}
                className="border-b border-slate-800/50 hover:bg-slate-800/30"
              >
                <td className="px-2 py-2">
                  <span className="mr-1">{origineIcona(o.origine)}</span>
                  {etichetta(o.origine)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{o.tiri}</td>
                <td className="px-2 py-2 text-right tabular-nums font-semibold">
                  {golTotali(o)}
                </td>
                {mostraAutogol && (
                  <td className="px-2 py-2 text-right tabular-nums text-slate-400">
                    {o.autogol === 0 ? '—' : o.autogol}
                  </td>
                )}
                <td className="px-2 py-2 text-right tabular-nums text-slate-400">
                  {o.tiri === 0 ? '—' : `${Math.round((o.gol / o.tiri) * 100)}%`}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-emerald-400">
                  {formatXG(o.xG)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {mostraAutogol && autogolProvocati > 0 && (
        <p className="text-xs text-slate-500 -mt-4 mb-6">
          Nei <strong className="text-slate-400">Gol</strong> ci sono anche gli
          autogol che abbiamo provocato — {autogolProvocati} in queste partite,
          la colonna <strong className="text-slate-400">AG</strong>: contano nel
          risultato come gli altri, ma non sono tiri nostri, quindi restano
          fuori da conversione e xG.
        </p>
      )}

      <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2">
        Schemi
        <span className="ml-2 normal-case tracking-normal text-slate-500 font-normal">
          {battute} palle inattive battute
        </span>
      </h2>

      {perSchema.every((g) => g.righe.length === 0) ? (
        <p className="text-slate-500 italic text-sm">
          Nessuno schema definito e nessuna palla inattiva registrata. Gli schemi
          si aggiungono dal setup della stagione.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {perSchema
            .filter((g) => g.righe.length > 0)
            .map((g) => (
              <div key={g.tipo}>
                <h3 className="text-sm font-semibold text-slate-300 mb-1">
                  <span className="mr-1">{inattivaIcona(g.tipo)}</span>
                  {inattivaLabel(g.tipo)}
                  <span className="ml-2 text-slate-500 font-normal">
                    {g.battute} {g.battute === 1 ? 'battuta' : 'battute'} · {g.tiri}{' '}
                    {g.tiri === 1 ? 'tiro' : 'tiri'} · {golTotali(g)} gol
                  </span>
                </h3>
                <div className="overflow-x-auto -mx-4 px-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-xs text-slate-400">
                        <th className="px-2 py-2 text-left font-semibold">Schema</th>
                        <th className="px-2 py-2 text-right font-semibold">
                          Battute
                        </th>
                        <th className="px-2 py-2 text-right font-semibold">Tiri</th>
                        <th
                          className="px-2 py-2 text-right font-semibold"
                          title="Gol nati da questo schema, autogol avversari compresi"
                        >
                          Gol
                        </th>
                        <th
                          className="px-2 py-2 text-right font-semibold"
                          title="Quanti di quei gol sono autogol avversari che lo schema ha provocato"
                        >
                          AG
                        </th>
                        <th className="px-2 py-2 text-right font-semibold">
                          Tiri/battuta
                        </th>
                        <th className="px-2 py-2 text-right font-semibold">xG</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.righe.map((r) => (
                        <tr
                          key={r.schema?.id ?? `${g.tipo}-nessuno`}
                          className="border-b border-slate-800/50 hover:bg-slate-800/30"
                        >
                          <td className="px-2 py-2">
                            <div className="font-medium">
                              {r.schema?.nome ?? (
                                <span className="text-slate-500 italic">
                                  Senza schema
                                </span>
                              )}
                            </div>
                            {r.schema?.note && (
                              <div className="text-xs text-slate-500">
                                {r.schema.note}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">
                            {r.battute}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">
                            {r.tiri}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums font-semibold">
                            {golTotali(r)}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-slate-400">
                            {r.autogol === 0 ? '—' : r.autogol}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-slate-400">
                            {r.battute === 0 ? '—' : (r.tiri / r.battute).toFixed(2)}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-emerald-400">
                            {formatXG(r.xG)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
        </div>
      )}

      <p className="text-xs text-slate-500 mt-4">
        La battuta e la conclusione che ne nasce sono due eventi separati:{' '}
        <strong className="text-slate-400">Battute</strong> conta quante volte hai
        giocato quello schema, <strong className="text-slate-400">Tiri</strong>{' '}
        quante volte ne è uscita una conclusione. Il rapporto tra i due dice se lo
        schema produce o gira a vuoto. Nei{' '}
        <strong className="text-slate-400">Gol</strong> ci sono anche gli autogol
        avversari che lo schema ha provocato — la colonna{' '}
        <strong className="text-slate-400">AG</strong> dice quanti: per lo schema
        sono una riuscita, ma un tiro nostro dietro non c'è, quindi in xG non
        entrano.
      </p>
    </>
  )
}
