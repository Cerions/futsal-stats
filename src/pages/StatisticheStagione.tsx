import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { calcolaStatistiche } from '../utils/statistiche'
import type { StatsGiocatore } from '../utils/statistiche'
import { nomeCorto } from '../utils/giocatore'
import { ruoloShort, ordineRuolo } from '../db/ruoli'
import { nomeSquadra } from '../utils/stagione'

type ColonnaOrdinabile =
  | 'giocatore'
  | 'presenze'
  | 'partiteGiocate'
  | 'minutiGiocati'
  | 'gol'
  | 'assist'
  | 'autogol'
  | 'golPro'
  | 'golContro'
  | 'plusMinus'

export default function StatisticheStagione() {
  const { id } = useParams()
  const stagioneId = Number(id)

  const stagione = useLiveQuery(() => db.stagioni.get(stagioneId), [stagioneId])
  const rosa = useLiveQuery(
    () => db.giocatori.where('stagioneId').equals(stagioneId).toArray(),
    [stagioneId]
  )
  const partite = useLiveQuery(
    () => db.partite.where('stagioneId').equals(stagioneId).toArray(),
    [stagioneId]
  )
  const eventi = useLiveQuery(async () => {
    if (!partite) return []
    const partiteIds = partite.map((p) => p.id!).filter(Boolean)
    if (partiteIds.length === 0) return []
    return db.eventi.where('partitaId').anyOf(partiteIds).toArray()
  }, [partite])

  const [colonna, setColonna] = useState<ColonnaOrdinabile>('gol')
  const [discendente, setDiscendente] = useState(true)

  if (!stagione || !rosa || !partite || !eventi) {
    return <div className="p-6">Caricamento...</div>
  }

  const stats = calcolaStatistiche(rosa, partite, eventi)

  const partiteFinite = partite.filter((p) => p.stato === 'finita').length

  function cambiaOrdinamento(nuovaColonna: ColonnaOrdinabile) {
    if (nuovaColonna === colonna) {
      setDiscendente(!discendente)
    } else {
      setColonna(nuovaColonna)
      // default: descendente per numeri, ascendente per giocatore
      setDiscendente(nuovaColonna !== 'giocatore')
    }
  }

  function valore(s: StatsGiocatore, c: ColonnaOrdinabile): number | string {
    switch (c) {
      case 'giocatore':
        return `${s.giocatore.cognome} ${s.giocatore.nome}`.toLowerCase()
      case 'presenze':
        return s.presenze
      case 'partiteGiocate':
        return s.partiteGiocate
      case 'minutiGiocati':
        return s.minutiGiocati
      case 'gol':
        return s.gol
      case 'assist':
        return s.assist
      case 'autogol':
        return s.autogol
      case 'golPro':
        return s.golPro
      case 'golContro':
        return s.golContro
      case 'plusMinus':
        return s.golPro - s.golContro
    }
  }

  const statsOrdinate = [...stats].sort((a, b) => {
    const va = valore(a, colonna)
    const vb = valore(b, colonna)
    // Fallback secondario: per ruolo
    if (va === vb) return ordineRuolo(a.giocatore.ruolo) - ordineRuolo(b.giocatore.ruolo)
    if (typeof va === 'number' && typeof vb === 'number') {
      return discendente ? vb - va : va - vb
    }
    return discendente
      ? String(vb).localeCompare(String(va))
      : String(va).localeCompare(String(vb))
  })

  // Componente helper per l'header cliccabile
  function Th({
    children,
    col,
  }: {
    children: React.ReactNode
    col: ColonnaOrdinabile
  }) {
    const attivo = col === colonna
    return (
      <th
        onClick={() => cambiaOrdinamento(col)}
        className={`px-2 py-2 text-right text-xs font-semibold cursor-pointer select-none ${
          attivo ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        {children}
        {attivo && <span className="ml-1">{discendente ? '↓' : '↑'}</span>}
      </th>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-4 pb-16">
      <Link to={`/stagione/${stagioneId}`} className="text-sm text-slate-400">
        ← Stagione
      </Link>
      <h1 className="text-2xl font-bold mt-1">{nomeSquadra(stagione)}</h1>
      <p className="text-sm text-slate-400 mb-4">
        Statistiche • {stagione.nome} • {partiteFinite}{' '}
        {partiteFinite === 1 ? 'partita giocata' : 'partite giocate'}
      </p>

      {partiteFinite === 0 ? (
        <p className="text-slate-500 italic mt-8 text-center">
          Nessuna partita conclusa. Le statistiche appariranno dopo la prima
          partita terminata.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th
                  onClick={() => cambiaOrdinamento('giocatore')}
                  className={`px-2 py-2 text-left text-xs font-semibold cursor-pointer select-none sticky left-0 bg-slate-900 ${
                    colonna === 'giocatore'
                      ? 'text-emerald-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Giocatore
                  {colonna === 'giocatore' && (
                    <span className="ml-1">{discendente ? '↓' : '↑'}</span>
                  )}
                </th>
                <Th col="presenze">Pres.</Th>
                <Th col="partiteGiocate">PG</Th>
                <Th col="minutiGiocati">Min</Th>
                <Th col="gol">Gol</Th>
                <Th col="assist">Ass</Th>
                <Th col="autogol">Aut</Th>
                <Th col="golPro">G+</Th>
                <Th col="golContro">G-</Th>
                <Th col="plusMinus">+/-</Th>
              </tr>
            </thead>
            <tbody>
              {statsOrdinate.map((s) => {
                const plusMinus = s.golPro - s.golContro
                return (
                  <tr
                    key={s.giocatore.id}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30"
                  >
                    <td className="px-2 py-2 sticky left-0 bg-slate-900">
                      <div className="font-medium">{nomeCorto(s.giocatore)}</div>
                      <div className="text-xs text-slate-500">
                        {ruoloShort(s.giocatore.ruolo)}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {s.presenze}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {s.partiteGiocate}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {s.minutiGiocati}'
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums font-semibold">
                      {s.gol}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {s.assist}
                    </td>
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
      )}

      {/* Legenda */}
      <div className="mt-6 text-xs text-slate-500 space-y-1">
        <p>
          <strong className="text-slate-400">Pres.</strong>: convocazioni •{' '}
          <strong className="text-slate-400">PG</strong>: partite giocate (almeno
          1 min) • <strong className="text-slate-400">Min</strong>: minuti
          giocati totali
        </p>
        <p>
          <strong className="text-slate-400">Gol</strong>: gol segnati •{' '}
          <strong className="text-slate-400">Ass</strong>: assist •{' '}
          <strong className="text-slate-400">Aut</strong>: autogol contro
        </p>
        <p>
          <strong className="text-slate-400">G+</strong>: gol della squadra
          quando era in campo • <strong className="text-slate-400">G-</strong>:
          gol subiti quando era in campo •{' '}
          <strong className="text-slate-400">+/-</strong>: differenza
        </p>
      </div>
    </div>
  )
}