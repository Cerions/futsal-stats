import type { StatsGiocatore } from '../../utils/statistiche'
import { formatXG } from '../../db/zone'
import { Th, ThGiocatore, TdGiocatore } from './tabella'
import { conversione } from '../../utils/colonne'
import type { Ordinamento } from '../../utils/colonne'

/** Le due tabelle dei singoli: il rendiconto generale e quello di tiri e xG. */

export function TabellaGenerali({
  stats,
  ord,
  dettaglio,
}: {
  stats: StatsGiocatore[]
  ord: Ordinamento
  dettaglio: (giocatoreId: number) => string
}) {
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <ThGiocatore ord={ord} />
            <Th col="presenze" ord={ord}>Pres.</Th>
            <Th col="partiteGiocate" ord={ord}>PG</Th>
            <Th col="minutiGiocati" ord={ord}>Min</Th>
            <Th col="gol" ord={ord}>Gol</Th>
            <Th col="assist" ord={ord}>Ass</Th>
            <Th col="autogol" ord={ord}>Aut</Th>
            <Th col="golPro" ord={ord}>G+</Th>
            <Th col="golContro" ord={ord}>G-</Th>
            <Th col="plusMinus" ord={ord}>+/-</Th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => {
            const plusMinus = s.golPro - s.golContro
            return (
              <tr
                key={s.giocatore.id}
                className="border-b border-slate-800/50 hover:bg-slate-800/30"
              >
                <TdGiocatore s={s} dettaglio={dettaglio} />
                <td className="px-2 py-2 text-right tabular-nums">{s.presenze}</td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {s.partiteGiocate}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {s.minutiGiocati}'
                </td>
                <td className="px-2 py-2 text-right tabular-nums font-semibold">
                  {s.gol}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{s.assist}</td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-500">
                  {s.autogol}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-emerald-400">
                  {s.golPro}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-red-400">
                  {s.golContro}
                </td>
                <td
                  className={`px-2 py-2 text-right tabular-nums font-semibold ${
                    plusMinus > 0
                      ? 'text-emerald-400'
                      : plusMinus < 0
                      ? 'text-red-400'
                      : 'text-slate-400'
                  }`}
                >
                  {plusMinus > 0 ? `+${plusMinus}` : plusMinus}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function TabellaTiri({
  stats,
  ord,
  dettaglio,
}: {
  stats: StatsGiocatore[]
  ord: Ordinamento
  dettaglio: (giocatoreId: number) => string
}) {
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <ThGiocatore ord={ord} />
            <Th col="tiri" ord={ord}>Tiri</Th>
            <Th col="tiriInPorta" ord={ord}>TP</Th>
            <Th col="gol" ord={ord}>Gol</Th>
            <Th col="conversione" ord={ord}>Conv.</Th>
            <Th col="xG" ord={ord}>xG</Th>
            <Th col="xGDiff" ord={ord}>G−xG</Th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => {
            const diff = s.gol - s.xG
            const conv = conversione(s)
            return (
              <tr
                key={s.giocatore.id}
                className="border-b border-slate-800/50 hover:bg-slate-800/30"
              >
                <TdGiocatore s={s} dettaglio={dettaglio} />
                <td className="px-2 py-2 text-right tabular-nums">{s.tiri}</td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-400">
                  {s.tiriInPorta}
                </td>
                <td className="px-2 py-2 text-right tabular-nums font-semibold">
                  {s.gol}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-400">
                  {conv < 0 ? '—' : `${Math.round(conv * 100)}%`}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-emerald-400">
                  {formatXG(s.xG)}
                </td>
                <td
                  className={`px-2 py-2 text-right tabular-nums font-semibold ${
                    s.tiri === 0
                      ? 'text-slate-600'
                      : diff > 0.05
                      ? 'text-emerald-400'
                      : diff < -0.05
                      ? 'text-red-400'
                      : 'text-slate-400'
                  }`}
                >
                  {s.tiri === 0 ? '—' : `${diff > 0 ? '+' : ''}${formatXG(diff)}`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
