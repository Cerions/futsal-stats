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
import { confronta, useOrdinamento } from '../../utils/colonne'
import { Th } from './tabella'
import { NienteDati } from '../grafici/base'

/**
 * I quintetti, ricostruiti dai cambi già registrati.
 *
 * Due letture: «riuniti» somma tutti i tratti in cui gli stessi cinque erano
 * insieme, e serve a capire quale formazione regge; «in ordine di partita»
 * lascia i tratti separati, e serve a rileggere come è andata dentro una gara.
 */

/** Le colonne della tabella dei quintetti riuniti. */
type Colonna =
  | 'quintetto'
  | 'turni'
  | 'minuti'
  | 'golFatti'
  | 'golSubiti'
  | 'differenza'
  | 'tiri'
  | 'tiriSubiti'

const TESTUALI = ['quintetto'] as const

/**
 * Una riga della tabella: le statistiche più i nomi già composti. I nomi
 * servono sia a disegnarla sia a ordinarla, e comporli una volta sola evita
 * che le due cose possano divergere.
 */
interface Riga {
  q: StatsQuintetto
  nomi: string
}

function valore(r: Riga, c: Colonna): number | string {
  switch (c) {
    case 'quintetto':
      return r.nomi.toLowerCase()
    case 'turni':
      return r.q.turni
    case 'minuti':
      return r.q.minuti
    case 'golFatti':
      return r.q.golFatti
    case 'golSubiti':
      return r.q.golSubiti
    case 'differenza':
      return r.q.golFatti - r.q.golSubiti
    case 'tiri':
      return r.q.tiri
    case 'tiriSubiti':
      return r.q.tiriSubiti
  }
}

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

/** I cinque, in ordine di ruolo: dal portiere in avanti. */
function giocatoriDi(ids: number[], rosa: Giocatore[]): Giocatore[] {
  return nomiQuintetto({ giocatori: ids, chiave: '' }, rosa).sort(
    (a, b) => ordineRuolo(a.ruolo) - ordineRuolo(b.ruolo)
  )
}

/** I cinque nomi, in ordine di ruolo, su due righe se serve. */
function Formazione({ ids, rosa }: { ids: number[]; rosa: Giocatore[] }) {
  const giocatori = giocatoriDi(ids, rosa)
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
  const [senzaPortiere, setSenzaPortiere] = useState(false)
  const ord = useOrdinamento<Colonna>('minuti', TESTUALI)

  // Chi sta in porta cambia spesso senza che cambi la squadra davanti: lasciando
  // fuori i portieri, due turni che differivano solo per quello diventano lo
  // stesso gruppo, e si legge il rendimento dei quattro di movimento.
  const portieri = new Set(
    rosa.filter((g) => g.ruolo === 'PORTIERE').map((g) => g.id!)
  )
  const escludi = senzaPortiere ? portieri : new Set<number>()
  const nascondi = (ids: number[]) =>
    senzaPortiere ? ids.filter((id) => !portieri.has(id)) : ids

  const riuniti: StatsQuintetto[] = statistichePerQuintetto(
    partite,
    eventi,
    escludi
  )
  const righe: Riga[] = riuniti.map((q) => ({
    q,
    nomi: giocatoriDi(q.giocatori, rosa)
      .map((g) => nomeCorto(g))
      .join(' '),
  }))
  // A parità, i minuti: fra due quintetti con lo stesso bilancio viene prima
  // quello che ha retto più a lungo.
  const ordinate = [...righe].sort((a, b) => {
    const d = confronta(valore(a, ord.colonna), valore(b, ord.colonna), ord.discendente)
    return d !== 0 ? d : b.q.minuti - a.q.minuti
  })
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
      <div className="grid grid-cols-2 gap-2 mb-2">
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

      <label className="flex items-center gap-2 mb-4 text-sm text-slate-300 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={senzaPortiere}
          onChange={() => setSenzaPortiere((p) => !p)}
          data-senza-portiere
          className="w-4 h-4"
        />
        Senza il portiere
        <span className="text-xs text-slate-500">
          — i quattro di movimento, con i cambi fra i pali messi insieme
        </span>
      </label>

      {modo === 'riuniti' ? (
        riuniti.length === 0 ? (
          <NienteDati testo="Nessun quintetto completo da cinque in queste partite." />
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <Th col="quintetto" ord={ord} sinistra>Quintetto</Th>
                  <Th col="turni" ord={ord} titolo="Quante volte quei cinque sono stati in campo insieme">
                    Volte
                  </Th>
                  <Th col="minuti" ord={ord}>Min</Th>
                  <Th col="golFatti" ord={ord}>GF</Th>
                  <Th col="golSubiti" ord={ord}>GS</Th>
                  <Th col="differenza" ord={ord}>
                    <span className="whitespace-nowrap">+/−</span>
                  </Th>
                  <Th col="tiri" ord={ord}>TF</Th>
                  <Th col="tiriSubiti" ord={ord}>TS</Th>
                </tr>
              </thead>
              <tbody>
                {ordinate.map(({ q }) => (
                  <tr
                    key={q.chiave}
                    data-quintetto={q.chiave}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 align-top"
                  >
                    <td className="px-2 py-2 min-w-44">
                      <Formazione ids={q.giocatori} rosa={rosa} />
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-400">
                      {q.turni}
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
                    <Formazione ids={nascondi(t.giocatori)} rosa={rosa} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="mt-6 text-xs text-slate-500 space-y-1">
        <p>
          <strong className="text-slate-400">Volte</strong>: quante volte quel
          gruppo è stato in campo insieme •{' '}
          <strong className="text-slate-400">GF</strong> e{' '}
          <strong className="text-slate-400">GS</strong>: gol fatti e subiti
          mentre c'era •{' '}
          <strong className="text-slate-400">TF</strong> e{' '}
          <strong className="text-slate-400">TS</strong>: tiri fatti e subiti, con
          accanto quelli finiti in porta
        </p>
        {senzaPortiere && (
          <p className="text-slate-400">
            Senza il portiere: i numeri sono sempre quelli dei cinque in campo —
            i gol li prende la squadra, non i quattro davanti — ma i turni in cui
            cambiava solo chi stava fra i pali sono messi insieme.
          </p>
        )}
        <p>
          Tocca un'intestazione per ordinare la tabella, e ritoccala per
          rovesciare il verso. I cambi segnati a meno di{' '}
          {FINESTRA_CAMBI_MINUTI + 1} minuti l'uno
          dall'altro contano come un'unica sostituzione: in campo sono entrati
          insieme, e conta solo la formazione rimasta dopo l'ultimo. I quintetti
          incompleti — quando mancano cambi o titolari — restano fuori dal
          riepilogo riunito.
        </p>
      </div>
    </>
  )
}
