import { useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import {
  calcolaStatistiche,
  conteggiPerZona,
  contaInattive,
  contaTiri,
  risultatoPartita,
  statistichePerOrigine,
  statistichePerSchema,
} from '../utils/statistiche'
import type { StatsGiocatore } from '../utils/statistiche'
import { nomeCorto } from '../utils/giocatore'
import { formatData } from '../utils/format'
import { ruoloShort, ordineRuolo } from '../db/ruoli'
import { nomeSquadra } from '../utils/stagione'
import CampoTiri from '../components/CampoTiri'
import {
  formatXG,
  inattivaIcona,
  inattivaLabel,
  origineIcona,
  origineLabel,
  xgTotale,
  ZONE_TIRO,
} from '../db/zone'
import type { Fronte } from '../db/zone'

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
  | 'tiri'
  | 'tiriInPorta'
  | 'xG'
  | 'xGDiff'
  | 'conversione'

type Vista = 'generali' | 'tiri' | 'inattive'

/** Percentuale realizzativa: gol su tiri. -1 se non ha mai tirato. */
function conversione(s: StatsGiocatore): number {
  return s.tiri > 0 ? s.gol / s.tiri : -1
}

/** Stato dell'ordinamento, passato agli header cliccabili. */
interface Ordinamento {
  colonna: ColonnaOrdinabile
  discendente: boolean
  cambia: (c: ColonnaOrdinabile) => void
}

/** Header di colonna numerica, cliccabile per ordinare. */
function Th({
  children,
  col,
  ord,
}: {
  children: React.ReactNode
  col: ColonnaOrdinabile
  ord: Ordinamento
}) {
  const attivo = col === ord.colonna
  return (
    <th
      onClick={() => ord.cambia(col)}
      className={`px-2 py-2 text-right text-xs font-semibold cursor-pointer select-none ${
        attivo ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      {children}
      {attivo && <span className="ml-1">{ord.discendente ? '↓' : '↑'}</span>}
    </th>
  )
}

/** Prima colonna: resta agganciata a sinistra durante lo scroll orizzontale. */
function ThGiocatore({ ord }: { ord: Ordinamento }) {
  const attivo = ord.colonna === 'giocatore'
  return (
    <th
      onClick={() => ord.cambia('giocatore')}
      className={`px-2 py-2 text-left text-xs font-semibold cursor-pointer select-none sticky left-0 bg-slate-900 ${
        attivo ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      Giocatore
      {attivo && <span className="ml-1">{ord.discendente ? '↓' : '↑'}</span>}
    </th>
  )
}

function TdGiocatore({ s }: { s: StatsGiocatore }) {
  return (
    <td className="px-2 py-2 sticky left-0 bg-slate-900">
      <div className="font-medium">{nomeCorto(s.giocatore)}</div>
      <div className="text-xs text-slate-500">{ruoloShort(s.giocatore.ruolo)}</div>
    </td>
  )
}

export default function StatisticheStagione() {
  const { id } = useParams()
  const stagioneId = Number(id)

  const stagione = useLiveQuery(() => db.stagioni.get(stagioneId), [stagioneId])
  const rosa = useLiveQuery(
    () => db.giocatori.where('stagioneId').equals(stagioneId).toArray(),
    [stagioneId]
  )
  const schemi = useLiveQuery(
    () => db.schemi.where('stagioneId').equals(stagioneId).toArray(),
    [stagioneId]
  )
  const partite = useLiveQuery(
    () => db.partite.where('stagioneId').equals(stagioneId).toArray(),
    [stagioneId]
  )
  const avversari = useLiveQuery(
    () => db.avversari.where('stagioneId').equals(stagioneId).toArray(),
    [stagioneId]
  )
  const eventi = useLiveQuery(async () => {
    if (!partite) return []
    const partiteIds = partite.map((p) => p.id!).filter(Boolean)
    if (partiteIds.length === 0) return []
    return db.eventi.where('partitaId').anyOf(partiteIds).toArray()
  }, [partite])

  const [parametri, setParametri] = useSearchParams()
  const [colonna, setColonna] = useState<ColonnaOrdinabile>('gol')
  const [discendente, setDiscendente] = useState(true)
  const [vista, setVista] = useState<Vista>('generali')
  const [fronteMappa, setFronteMappa] = useState<Fronte>('nostro')

  if (!stagione || !rosa || !partite || !eventi || !schemi || !avversari) {
    return <div className="p-6">Caricamento...</div>
  }

  // Le statistiche guardano sempre e solo le partite concluse. Qui si sceglie
  // se guardarle tutte insieme o una alla volta: l'ambito scelto entra in
  // tutte e tre le viste, tabelle e mappe comprese.
  const finite = [...partite]
    .filter((p) => p.stato === 'finita')
    .sort((a, b) => b.dataOra - a.dataOra)
  const partiteFinite = finite.length

  // L'id sta nell'URL: così il link dalla pagina della partita funziona e la
  // scelta sopravvive a un ricarico. Un id non più valido torna al totale.
  const idNellUrl = Number(parametri.get('partita'))
  const partitaScelta =
    finite.find((p) => p.id === idNellUrl)?.id ?? null

  const ambito =
    partitaScelta === null ? finite : finite.filter((p) => p.id === partitaScelta)
  const idAmbito = new Set(ambito.map((p) => p.id))
  const eventiFiniti = eventi.filter((e) => idAmbito.has(e.partitaId))
  const partitaCorrente =
    partitaScelta === null ? null : ambito[0]

  const stats = calcolaStatistiche(rosa, ambito, eventiFiniti)

  const nomeAvversario = (id: number) =>
    avversari.find((a) => a.id === id)?.nome ?? '???'
  const etichettaPartita = (p: (typeof finite)[number]) => {
    const { fatti, subiti } = risultatoPartita(
      eventi.filter((e) => e.partitaId === p.id)
    )
    return `${formatData(p.dataOra)} · ${nomeAvversario(p.avversarioId)} · ${fatti}-${subiti}`
  }
  const conteggiZone = conteggiPerZona(eventiFiniti)
  const xgStagione = xgTotale(eventiFiniti)
  // Fronte avversario: mappa e xGA di quello che ci hanno tirato addosso
  const conteggiZoneSubiti = conteggiPerZona(eventiFiniti, 'loro')
  const xgaStagione = xgTotale(eventiFiniti, 'loro')
  const tiriNostri = contaTiri(eventiFiniti, 'nostro')
  const tiriLoro = contaTiri(eventiFiniti, 'loro')
  const golSubitiTotali = eventiFiniti.filter(
    (e) => e.tipo === 'gol_subito' || e.tipo === 'autogol_contro'
  ).length

  const golSenzaZona = stats.reduce((t, s) => t + s.golSenzaZona, 0)
  const perOrigine = statistichePerOrigine(eventiFiniti)
  const perSchema = statistichePerSchema(eventiFiniti, schemi)
  const inattiveStagione = contaInattive(eventiFiniti)

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
      case 'tiri':
        return s.tiri
      case 'tiriInPorta':
        return s.tiriInPorta
      case 'xG':
        return s.xG
      case 'xGDiff':
        return s.gol - s.xG
      case 'conversione':
        return conversione(s)
    }
  }

  function cambiaVista(v: Vista) {
    setVista(v)
    // L'ordinamento corrente potrebbe essere su una colonna non visibile:
    // riportiamolo su qualcosa di sensato per la vista scelta.
    setColonna(v === 'tiri' ? 'xG' : 'gol')
    setDiscendente(true)
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

  const ord: Ordinamento = { colonna, discendente, cambia: cambiaOrdinamento }

  return (
    <div className="max-w-5xl mx-auto p-4 pb-16">
      <Link to={`/stagione/${stagioneId}`} className="text-sm text-slate-400">
        ← Stagione
      </Link>
      <h1 className="text-2xl font-bold mt-1">{nomeSquadra(stagione)}</h1>
      <p className="text-sm text-slate-400 mb-4">
        Statistiche • {stagione.nome} •{' '}
        {partitaCorrente
          ? etichettaPartita(partitaCorrente)
          : `${partiteFinite} ${
              partiteFinite === 1 ? 'partita giocata' : 'partite giocate'
            }`}
      </p>

      {/* Selettore ambito: tutta la stagione o una partita sola */}
      {partiteFinite > 0 && (
        <div className="mb-3">
          <select
            value={partitaScelta ?? ''}
            onChange={(e) => {
              const v = e.target.value
              const nuovi = new URLSearchParams(parametri)
              if (v === '') nuovi.delete('partita')
              else nuovi.set('partita', v)
              setParametri(nuovi, { replace: true })
            }}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold"
          >
            <option value="">
              Tutta la stagione ({partiteFinite}{' '}
              {partiteFinite === 1 ? 'partita' : 'partite'})
            </option>
            {finite.map((p) => (
              <option key={p.id} value={p.id}>
                {etichettaPartita(p)}
              </option>
            ))}
          </select>
          {partitaCorrente && (
            <p className="text-xs text-slate-500 mt-1">
              Stai guardando una partita sola.{' '}
              <Link
                to={`/partita/${partitaCorrente.id}`}
                className="text-emerald-400 underline"
              >
                Aprila
              </Link>{' '}
              per il tabellone e il log eventi.
            </p>
          )}
        </div>
      )}

      {/* Selettore vista */}
      {partiteFinite > 0 && (
        <div className="flex gap-1 bg-slate-800 p-1 rounded-lg mb-4">
          {([
            { v: 'generali' as Vista, label: 'Generali' },
            { v: 'tiri' as Vista, label: 'Tiri & xG' },
            { v: 'inattive' as Vista, label: 'Palle inattive' },
          ]).map(({ v, label }) => (
            <button
              key={v}
              onClick={() => cambiaVista(v)}
              className={`flex-1 px-2 py-1.5 rounded-md text-sm font-semibold whitespace-nowrap ${
                vista === v
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {partiteFinite === 0 ? (
        <p className="text-slate-500 italic mt-8 text-center">
          Nessuna partita conclusa. Le statistiche appariranno dopo la prima
          partita terminata.
        </p>
      ) : vista === 'inattive' ? (
        <>
          {/* Resa per tipo di situazione */}
          <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2">
            Da cosa nascono le conclusioni
          </h2>
          <div className="overflow-x-auto -mx-4 px-4 mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-xs text-slate-400">
                  <th className="px-2 py-2 text-left font-semibold">Situazione</th>
                  <th className="px-2 py-2 text-right font-semibold">Tiri</th>
                  <th className="px-2 py-2 text-right font-semibold">Gol</th>
                  <th className="px-2 py-2 text-right font-semibold">Conv.</th>
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
                      {origineLabel(o.origine)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{o.tiri}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-semibold">
                      {o.gol}
                    </td>
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

          {/* Resa degli schemi, una tabella per situazione */}
          <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2">
            Schemi
            <span className="ml-2 normal-case tracking-normal text-slate-500 font-normal">
              {inattiveStagione} palle inattive battute
            </span>
          </h2>

          {perSchema.every((g) => g.righe.length === 0) ? (
            <p className="text-slate-500 italic text-sm">
              Nessuno schema definito e nessuna palla inattiva registrata. Gli
              schemi si aggiungono dal setup della stagione.
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
                        {g.battute} {g.battute === 1 ? 'battuta' : 'battute'} ·{' '}
                        {g.tiri} {g.tiri === 1 ? 'tiro' : 'tiri'} · {g.gol} gol
                      </span>
                    </h3>
                    <div className="overflow-x-auto -mx-4 px-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-700 text-xs text-slate-400">
                            <th className="px-2 py-2 text-left font-semibold">
                              Schema
                            </th>
                            <th className="px-2 py-2 text-right font-semibold">
                              Battute
                            </th>
                            <th className="px-2 py-2 text-right font-semibold">
                              Tiri
                            </th>
                            <th className="px-2 py-2 text-right font-semibold">
                              Gol
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
                                {r.gol}
                              </td>
                              <td className="px-2 py-2 text-right tabular-nums text-slate-400">
                                {r.battute === 0
                                  ? '—'
                                  : (r.tiri / r.battute).toFixed(2)}
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
            <strong className="text-slate-400">Battute</strong> conta quante volte
            hai giocato quello schema,{' '}
            <strong className="text-slate-400">Tiri</strong> quante volte ne è
            uscita una conclusione. Il rapporto tra i due dice se lo schema
            produce o gira a vuoto.
          </p>
        </>
      ) : vista === 'generali' ? (
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
              {statsOrdinate.map((s) => {
                const plusMinus = s.golPro - s.golContro
                return (
                  <tr
                    key={s.giocatore.id}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30"
                  >
                    <TdGiocatore s={s} />
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
      ) : (
        <>
          {/* Riepilogo squadra */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-slate-800 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400">Tiri</div>
              <div className="text-xl font-bold tabular-nums">
                {tiriNostri.totali}
              </div>
              <div className="text-xs text-slate-500 tabular-nums">
                {tiriNostri.inPorta} in porta
              </div>
            </div>
            <div className="bg-slate-800 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400">xG</div>
              <div className="text-xl font-bold tabular-nums text-emerald-400">
                {formatXG(xgStagione)}
              </div>
            </div>
            <div className="bg-slate-800 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400">Gol</div>
              <div className="text-xl font-bold tabular-nums">
                {stats.reduce((t, s) => t + s.gol, 0)}
              </div>
            </div>
          </div>

          {/* Riepilogo subiti: lo stesso metro, dall'altra parte */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-slate-800 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400">Tiri subiti</div>
              <div className="text-xl font-bold tabular-nums">
                {tiriLoro.totali}
              </div>
              <div className="text-xs text-slate-500 tabular-nums">
                {tiriLoro.inPorta} in porta
              </div>
            </div>
            <div className="bg-slate-800 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400">xGA</div>
              <div className="text-xl font-bold tabular-nums text-red-400">
                {formatXG(xgaStagione)}
              </div>
            </div>
            <div className="bg-slate-800 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400">Gol subiti</div>
              <div className="text-xl font-bold tabular-nums">{golSubitiTotali}</div>
            </div>
          </div>

          {golSenzaZona > 0 && (
            <p className="text-xs text-amber-400/90 bg-amber-900/20 border border-amber-800/50 rounded-lg px-3 py-2 mb-4">
              {golSenzaZona}{' '}
              {golSenzaZona === 1
                ? 'gol è stato registrato'
                : 'gol sono stati registrati'}{' '}
              senza zona di tiro: {golSenzaZona === 1 ? 'non conta' : 'non contano'}{' '}
              nell'xG. Puoi aggiungere la zona da "Modifica partita".
            </p>
          )}

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
                {statsOrdinate.map((s) => {
                  const diff = s.gol - s.xG
                  const conv = conversione(s)
                  return (
                    <tr
                      key={s.giocatore.id}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30"
                    >
                      <TdGiocatore s={s} />
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
                        {s.tiri === 0
                          ? '—'
                          : `${diff > 0 ? '+' : ''}${formatXG(diff)}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mappa tiri di stagione */}
          <section className="mt-6">
            <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2">
              {partitaCorrente ? 'Mappa tiri della partita' : 'Mappa tiri stagione'}
            </h2>
            <div className="grid grid-cols-2 gap-2 mb-2 max-w-sm">
              <button
                onClick={() => setFronteMappa('nostro')}
                className={`py-2 rounded-lg text-sm font-semibold ${
                  fronteMappa === 'nostro'
                    ? 'bg-emerald-600'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Nostri
              </button>
              <button
                onClick={() => setFronteMappa('loro')}
                className={`py-2 rounded-lg text-sm font-semibold ${
                  fronteMappa === 'loro'
                    ? 'bg-red-600'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Subiti
              </button>
            </div>
            <div className="max-w-sm">
              <CampoTiri
                modalita="mappa"
                conteggi={fronteMappa === 'nostro' ? conteggiZone : conteggiZoneSubiti}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              In ogni zona: <strong className="text-slate-400">gol/tiri</strong>.
              Più la zona è verde, più si è tirato da lì.{' '}
              {fronteMappa === 'loro' &&
                'Qui è la nostra porta: sono le conclusioni che abbiamo concesso.'}
            </p>
          </section>

          {/* Pesi xG usati */}
          <details className="mt-4">
            <summary className="text-xs text-slate-400 cursor-pointer select-none">
              Come viene calcolato l'xG
            </summary>
            <div className="mt-2 text-xs text-slate-500">
              <p className="mb-2">
                Ogni tiro vale un valore fisso in base alla zona da cui è partito.
                Non è un modello allenato: è una tabella tarata su conversioni
                tipiche del calcio a 5, utile per confrontare giocatori e partite
                tra loro.
              </p>
              <p className="mb-2">
                L'<strong>xGA</strong> è la stessa somma sulle conclusioni che
                subiamo: quanto era probabile che gli avversari segnassero da dove
                hanno tirato. Se i gol subiti sono più dell'xGA stiamo concedendo
                meno di quanto paghiamo (o il portiere è in giornata storta); se
                sono meno, il contrario.
              </p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {ZONE_TIRO.map((z) => (
                  <li key={z.value} className="flex justify-between">
                    <span>{z.label}</span>
                    <span className="tabular-nums text-slate-400">
                      {z.peso.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </>
      )}

      {/* Legenda */}
      <div className="mt-6 text-xs text-slate-500 space-y-1">
        {vista === 'generali' ? (
          <>
            <p>
              <strong className="text-slate-400">Pres.</strong>: convocazioni •{' '}
              <strong className="text-slate-400">PG</strong>: partite giocate
              (almeno 1 min) • <strong className="text-slate-400">Min</strong>:
              minuti giocati totali
            </p>
            <p>
              <strong className="text-slate-400">Gol</strong>: gol segnati •{' '}
              <strong className="text-slate-400">Ass</strong>: assist •{' '}
              <strong className="text-slate-400">Aut</strong>: autogol contro
            </p>
            <p>
              <strong className="text-slate-400">G+</strong>: gol della squadra
              quando era in campo •{' '}
              <strong className="text-slate-400">G-</strong>: gol subiti quando
              era in campo • <strong className="text-slate-400">+/-</strong>:
              differenza
            </p>
          </>
        ) : vista === 'inattive' ? null : (
          <>
            <p>
              <strong className="text-slate-400">Tiri</strong>: conclusioni
              totali (un gol è un tiro riuscito) •{' '}
              <strong className="text-slate-400">TP</strong>: tiri in porta
              (gol e tiri parati) •{' '}
              <strong className="text-slate-400">Conv.</strong>: gol su tiri
            </p>
            <p>
              <strong className="text-slate-400">xG</strong>: gol attesi in base
              alla zona di tiro • <strong className="text-slate-400">G−xG</strong>
              : quanto ha segnato in più (verde) o in meno (rosso) rispetto a
              quello che le sue conclusioni valevano
            </p>
          </>
        )}
      </div>
    </div>
  )
}