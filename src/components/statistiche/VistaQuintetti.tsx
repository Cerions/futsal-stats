import { useState } from 'react'
import type { Evento, Giocatore, Partita } from '../../db/schema'
import { formatData } from '../../utils/format'
import { nomeCorto } from '../../utils/giocatore'
import { ordineRuolo } from '../../db/ruoli'
import {
  FINESTRA_CAMBI_MINUTI,
  nomiQuintetto,
  statistichePerQuintetto,
  turniDiPartita,
} from '../../utils/quintetti'
import type { StatsQuintetto, TurnoQuintetto } from '../../utils/quintetti'
import { NienteDati } from '../grafici/base'

/**
 * I quintetti, ricostruiti dai cambi già registrati.
 *
 * Due letture: «riuniti» somma tutti i tratti in cui gli stessi cinque erano
 * insieme, e serve a capire quale formazione regge; «in ordine di partita»
 * lascia i tratti separati, e serve a rileggere come è andata dentro una gara.
 */

function differenza(a: number, b: number) {
  const d = a - b
  const classe =
    d > 0 ? 'text-emerald-400' : d < 0 ? 'text-red-400' : 'text-slate-400'
  return (
    <span className={`tabular-nums font-semibold ${classe}`}>
      {d > 0 ? `+${d}` : d}
    </span>
  )
}

/** I cinque nomi, in ordine di ruolo, su due righe se serve. */
function Formazione({ ids, rosa }: { ids: number[]; rosa: Giocatore[] }) {
  const giocatori = nomiQuintetto({ giocatori: ids, chiave: '' }, rosa).sort(
    (a, b) => ordineRuolo(a.ruolo) - ordineRuolo(b.ruolo)
  )
  if (giocatori.length === 0) return <span className="text-slate-500">—</span>
  return (
    <span className="flex flex-wrap gap-x-1.5 gap-y-0.5">
      {giocatori.map((g) => (
        <span key={g.id} className="whitespace-nowrap">
          {nomeCorto(g)}
        </span>
      ))}
    </span>
  )
}

export default function VistaQuintetti({
  partite,
  eventi,
  rosa,
  nomeAvversario,
}: {
  partite: Partita[]
  eventi: Evento[]
  rosa: Giocatore[]
  nomeAvversario: (id: number) => string
}) {
  const [modo, setModo] = useState<'riuniti' | 'partita'>('riuniti')

  const riuniti: StatsQuintetto[] = statistichePerQuintetto(partite, eventi)
  const perPartita = [...partite]
    .sort((a, b) => b.dataOra - a.dataOra)
    .map((p) => ({ partita: p, turni: turniDiPartita(p, eventi) }))
    .filter((x) => x.turni.length > 0)

  if (riuniti.length === 0 && perPartita.length === 0) {
    return (
      <NienteDati testo="Nessun quintetto da mostrare: servono i titolari e i cambi registrati." />
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {(
          [
            ['riuniti', 'Riuniti'],
            ['partita', 'In ordine di partita'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setModo(v)}
            className={`py-1.5 rounded-lg text-sm font-semibold ${
              modo === v
                ? 'bg-slate-700 text-slate-100'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {modo === 'riuniti' ? (
        riuniti.length === 0 ? (
          <NienteDati testo="Nessun quintetto completo da cinque in queste partite." />
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-xs text-slate-400">
                  <th className="px-2 py-2 text-left font-semibold">Quintetto</th>
                  <th className="px-2 py-2 text-right font-semibold">Min</th>
                  <th className="px-2 py-2 text-right font-semibold">GF</th>
                  <th className="px-2 py-2 text-right font-semibold">GS</th>
                  <th className="px-2 py-2 text-right font-semibold whitespace-nowrap">+/−</th>
                  <th className="px-2 py-2 text-right font-semibold">TF</th>
                  <th className="px-2 py-2 text-right font-semibold">TS</th>
                </tr>
              </thead>
              <tbody>
                {riuniti.map((q) => (
                  <tr
                    key={q.chiave}
                    data-quintetto={q.chiave}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 align-top"
                  >
                    <td className="px-2 py-2 min-w-44">
                      <Formazione ids={q.giocatori} rosa={rosa} />
                      <div className="text-xs text-slate-500 mt-0.5">
                        {q.turni} {q.turni === 1 ? 'volta' : 'volte'} in campo
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{q.minuti}′</td>
                    <td className="px-2 py-2 text-right tabular-nums text-emerald-400 font-semibold">
                      {q.golFatti}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-red-400 font-semibold">
                      {q.golSubiti}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {differenza(q.golFatti, q.golSubiti)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-300">
                      {q.tiri}
                      <span className="text-slate-500 text-xs"> · {q.tiriInPorta}</span>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-300">
                      {q.tiriSubiti}
                      <span className="text-slate-500 text-xs">
                        {' '}
                        · {q.tiriSubitiInPorta}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-4">
          {perPartita.map(({ partita, turni }) => (
            <section key={partita.id}>
              <h3 className="text-sm font-semibold mb-1">
                {formatData(partita.dataOra)} ·{' '}
                <span className="text-slate-400">
                  {nomeAvversario(partita.avversarioId)}
                </span>
              </h3>
              <ul className="flex flex-col gap-1">
                {turni.map((t: TurnoQuintetto, i) => (
                  <li
                    key={i}
                    data-turno={`${t.tempoGioco}-${t.minutoInizio}`}
                    className="bg-slate-800/50 rounded px-3 py-2 text-sm"
                  >
                    <div className="flex items-baseline justify-between gap-2 mb-0.5">
                      <span className="text-slate-500 font-mono text-xs shrink-0">
                        T{t.tempoGioco} · {t.minutoInizio}′–{t.minutoFine}′
                      </span>
                      <span className="text-xs text-slate-400 tabular-nums">
                        {t.golFatti}–{t.golSubiti} · tiri {t.tiri}–{t.tiriSubiti}
                      </span>
                    </div>
                    <Formazione ids={t.giocatori} rosa={rosa} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="mt-6 text-xs text-slate-500 space-y-1">
        <p>
          <strong className="text-slate-400">GF</strong> e{' '}
          <strong className="text-slate-400">GS</strong>: gol fatti e subiti
          mentre quei cinque erano in campo •{' '}
          <strong className="text-slate-400">TF</strong> e{' '}
          <strong className="text-slate-400">TS</strong>: tiri fatti e subiti, con
          accanto quelli finiti in porta
        </p>
        <p>
          I cambi segnati a meno di {FINESTRA_CAMBI_MINUTI + 1} minuti l'uno
          dall'altro contano come un'unica sostituzione: in campo sono entrati
          insieme, e conta solo la formazione rimasta dopo l'ultimo. I quintetti
          incompleti — quando mancano cambi o titolari — restano fuori dal
          riepilogo riunito.
        </p>
      </div>
    </>
  )
}
