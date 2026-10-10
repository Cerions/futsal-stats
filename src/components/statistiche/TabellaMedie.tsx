import type { StatsGiocatore } from '../../utils/statistiche'
import { confronta, useOrdinamento } from '../../utils/colonne'
import { Th, TdGiocatore } from './tabella'
import { NienteDati } from '../grafici/base'

/**
 * Quanto rende un giocatore in una partita tipo.
 *
 * I totali premiano chi c'è sempre: chi ha saltato mezza stagione sta in fondo
 * a ogni colonna anche quando, le volte che gioca, fa più di tutti. Qui ogni
 * numero è diviso per le partite che ha davvero giocato, così i due si possono
 * confrontare. Chi non è mai sceso in campo resta fuori: dividere per zero non
 * dice niente.
 */

type Colonna =
  | 'giocatore'
  | 'partiteGiocate'
  | 'minuti'
  | 'gol'
  | 'assist'
  | 'tiri'
  | 'tiriInPorta'
  | 'xG'
  | 'golPro'
  | 'golContro'
  | 'plusMinus'

const TESTUALI = ['giocatore'] as const

/** I numeri del giocatore, già divisi per le partite giocate. */
interface Media {
  s: StatsGiocatore
  minuti: number
  gol: number
  assist: number
  tiri: number
  tiriInPorta: number
  xG: number
  golPro: number
  golContro: number
  plusMinus: number
}

function mediaDi(s: StatsGiocatore): Media {
  const n = s.partiteGiocate
  const per = (v: number) => v / n
  return {
    s,
    minuti: per(s.minutiGiocati),
    gol: per(s.gol),
    assist: per(s.assist),
    tiri: per(s.tiri),
    tiriInPorta: per(s.tiriInPorta),
    xG: per(s.xG),
    golPro: per(s.golPro),
    golContro: per(s.golContro),
    plusMinus: per(s.golPro - s.golContro),
  }
}

function valore(m: Media, c: Colonna): number | string {
  switch (c) {
    case 'giocatore':
      return `${m.s.giocatore.cognome} ${m.s.giocatore.nome}`.toLowerCase()
    case 'partiteGiocate':
      return m.s.partiteGiocate
    case 'minuti':
      return m.minuti
    case 'gol':
      return m.gol
    case 'assist':
      return m.assist
    case 'tiri':
      return m.tiri
    case 'tiriInPorta':
      return m.tiriInPorta
    case 'xG':
      return m.xG
    case 'golPro':
      return m.golPro
    case 'golContro':
      return m.golContro
    case 'plusMinus':
      return m.plusMinus
  }
}

/** Due decimali per tutto, uno per i minuti: lì il centesimo non dice niente. */
const due = (v: number) => v.toFixed(2)
const uno = (v: number) => v.toFixed(1)

export default function TabellaMedie({
  stats,
  dettaglio,
}: {
  stats: StatsGiocatore[]
  dettaglio: (giocatoreId: number) => string
}) {
  const ord = useOrdinamento<Colonna>('minuti', TESTUALI)

  const giocanti = stats.filter((s) => s.partiteGiocate > 0)
  if (giocanti.length === 0) {
    return (
      <NienteDati testo="Nessuno ha ancora giocato in queste partite: non c'è niente su cui fare la media." />
    )
  }

  const fuori = stats.length - giocanti.length
  const medie = giocanti.map(mediaDi).sort((a, b) => {
    const d = confronta(valore(a, ord.colonna), valore(b, ord.colonna), ord.discendente)
    return d !== 0 ? d : a.s.giocatore.cognome.localeCompare(b.s.giocatore.cognome)
  })

  return (
    <>
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <Th col="giocatore" ord={ord} sinistra sticky>
                Giocatore
              </Th>
              <Th col="partiteGiocate" ord={ord} titolo="Partite giocate: il divisore di tutto il resto">
                PG
              </Th>
              <Th col="minuti" ord={ord}>Min</Th>
              <Th col="gol" ord={ord}>Gol</Th>
              <Th col="assist" ord={ord}>Ass</Th>
              <Th col="tiri" ord={ord}>Tiri</Th>
              <Th col="tiriInPorta" ord={ord}>TP</Th>
              <Th col="xG" ord={ord}>xG</Th>
              <Th col="golPro" ord={ord}>G+</Th>
              <Th col="golContro" ord={ord}>G-</Th>
              <Th col="plusMinus" ord={ord}>+/-</Th>
            </tr>
          </thead>
          <tbody>
            {medie.map((m) => (
              <tr
                key={m.s.giocatore.id}
                data-media={m.s.giocatore.id}
                className="border-b border-slate-800/50 hover:bg-slate-800/30"
              >
                <TdGiocatore s={m.s} dettaglio={dettaglio} />
                <td className="px-2 py-2 text-right tabular-nums text-slate-400">
                  {m.s.partiteGiocate}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{uno(m.minuti)}</td>
                <td className="px-2 py-2 text-right tabular-nums font-semibold">
                  {due(m.gol)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{due(m.assist)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{due(m.tiri)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-400">
                  {due(m.tiriInPorta)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-emerald-400">
                  {due(m.xG)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-emerald-400">
                  {due(m.golPro)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-red-400">
                  {due(m.golContro)}
                </td>
                <td
                  className={`px-2 py-2 text-right tabular-nums font-semibold ${
                    m.plusMinus > 0.005
                      ? 'text-emerald-400'
                      : m.plusMinus < -0.005
                      ? 'text-red-400'
                      : 'text-slate-400'
                  }`}
                >
                  {m.plusMinus > 0 ? '+' : ''}
                  {due(m.plusMinus)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 text-xs text-slate-500 space-y-1">
        <p>
          Ogni numero è diviso per le{' '}
          <strong className="text-slate-400">partite giocate</strong>, non per le
          convocazioni: chi è stato in panchina tutta la gara non si porta dietro
          una partita a zero.
        </p>
        <p>
          <strong className="text-slate-400">Min</strong>: minuti a partita •{' '}
          <strong className="text-slate-400">TP</strong>: tiri in porta •{' '}
          <strong className="text-slate-400">G+</strong> e{' '}
          <strong className="text-slate-400">G-</strong>: gol della squadra fatti
          e subiti mentre era in campo
        </p>
        {fuori > 0 && (
          <p>
            {fuori === 1
              ? 'Un giocatore non è mai sceso in campo e resta fuori da qui.'
              : `${fuori} giocatori non sono mai scesi in campo e restano fuori da qui.`}
          </p>
        )}
        <p>Tocca un nome per la sua scheda, con la mappa dei tiri.</p>
      </div>
    </>
  )
}
