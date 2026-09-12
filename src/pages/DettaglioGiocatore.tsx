import { useParams, useSearchParams, Link, Navigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import CampoTiri from '../components/CampoTiri'
import { Riquadro } from '../components/statistiche/tabella'
import { conversione } from '../utils/colonne'
import {
  calcolaStatistiche,
  conteggiPerZona,
  statistichePerOrigine,
} from '../utils/statistiche'
import { ePreset, partiteDelPreset } from '../utils/preset'
import { nomeCompleto } from '../utils/giocatore'
import { ruoloLabel } from '../db/ruoli'
import {
  formatXG,
  origineIcona,
  origineLabelCorta,
  originiPerFronte,
} from '../db/zone'

/**
 * La scheda di un giocatore: dove tira, quanto rende, da cosa nascono le sue
 * conclusioni.
 *
 * Vive sullo stesso ambito di partite della pagina statistiche — i parametri
 * del filtro viaggiano nell'URL — così arrivandoci da «solo campionato» si
 * continuano a vedere i numeri di campionato.
 */

export default function DettaglioGiocatore() {
  const { id, giocatoreId } = useParams()
  const stagioneId = Number(id)
  const gid = Number(giocatoreId)
  const [parametri] = useSearchParams()

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
    const ids = partite.map((p) => p.id!).filter(Boolean)
    if (ids.length === 0) return []
    return db.eventi.where('partitaId').anyOf(ids).toArray()
  }, [partite])

  if (!stagione || !rosa || !partite || !eventi) {
    return <div className="p-6">Caricamento...</div>
  }

  const giocatore = rosa.find((g) => g.id === gid)
  if (!giocatore) return <Navigate to={`/stagione/${stagioneId}/statistiche`} replace />

  // Stesso ambito della pagina statistiche, letto dagli stessi parametri.
  const finite = [...partite]
    .filter((p) => p.stato === 'finita')
    .sort((a, b) => b.dataOra - a.dataOra)
  const paramPartite = parametri.get('partite')
  const idsNellUrl = (paramPartite ?? parametri.get('partita') ?? '')
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && finite.some((p) => p.id === n))
  const presetNellUrl = parametri.get('filtro')
  const aMano = paramPartite !== null || idsNellUrl.length > 0
  const ambito = aMano
    ? finite.filter((p) => idsNellUrl.includes(p.id!))
    : partiteDelPreset(finite, ePreset(presetNellUrl) ? presetNellUrl : 'tutte')

  const idAmbito = new Set(ambito.map((p) => p.id!))
  const eventiAmbito = eventi.filter((e) => idAmbito.has(e.partitaId))
  const stats = calcolaStatistiche(rosa, ambito, eventiAmbito)
  const s = stats.find((x) => x.giocatore.id === gid)

  // Solo le sue conclusioni: la mappa e la divisione per situazione guardano
  // quelle, non quelle della squadra.
  const suoi = eventiAmbito.filter(
    (e) =>
      (e.tipo === 'tiro' || e.tipo === 'gol_fatto') && e.giocatoreId === gid
  )
  const conteggiZone = conteggiPerZona(suoi, 'nostro')
  const definizioni = originiPerFronte('nostro')
  const perOrigine = definizioni
    .map((d) => {
      const o = statistichePerOrigine(suoi, 'nostro').find(
        (x) => x.origine === d.value
      )
      return o ? { ...o, definizione: d } : null
    })
    .filter((o) => o !== null)
    .filter((o) => o.tiri > 0)

  const tornaA = `/stagione/${stagioneId}/statistiche${
    parametri.toString() ? `?${parametri.toString()}` : ''
  }`

  const conv = s ? conversione(s) : -1
  const diff = s ? s.gol - s.xG : 0

  return (
    <div className="max-w-2xl mx-auto p-4 pb-16">
      <Link to={tornaA} className="text-sm text-slate-400">
        ← Statistiche
      </Link>
      <h1 className="text-2xl font-bold mt-1">{nomeCompleto(giocatore)}</h1>
      <p className="text-sm text-slate-400 mb-4">
        {ruoloLabel(giocatore.ruolo)}
        {giocatore.numero !== undefined && ` · numero ${giocatore.numero}`} ·{' '}
        {ambito.length} {ambito.length === 1 ? 'partita' : 'partite'}
      </p>

      {s === undefined || ambito.length === 0 ? (
        <p className="text-slate-500 italic mt-8 text-center">
          Nessuna partita nell'ambito scelto.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <Riquadro etichetta="Presenze" valore={s.presenze} nota={`${s.partiteGiocate} giocate`} />
            <Riquadro etichetta="Minuti" valore={`${s.minutiGiocati}′`} />
            <Riquadro
              etichetta="+/−"
              valore={
                s.golPro - s.golContro > 0
                  ? `+${s.golPro - s.golContro}`
                  : s.golPro - s.golContro
              }
              colore={
                s.golPro - s.golContro > 0
                  ? 'text-emerald-400'
                  : s.golPro - s.golContro < 0
                  ? 'text-red-400'
                  : 'text-slate-300'
              }
              nota={`${s.golPro} · ${s.golContro}`}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <Riquadro etichetta="Gol" valore={s.gol} />
            <Riquadro etichetta="Assist" valore={s.assist} />
            <Riquadro
              etichetta="Tiri"
              valore={s.tiri}
              nota={`${s.tiriInPorta} in porta`}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 mb-6">
            <Riquadro
              etichetta="Conversione"
              valore={conv < 0 ? '—' : `${Math.round(conv * 100)}%`}
            />
            <Riquadro
              etichetta="xG"
              valore={formatXG(s.xG)}
              colore="text-emerald-400"
            />
            <Riquadro
              etichetta="Gol − xG"
              valore={
                s.tiri === 0 ? '—' : `${diff > 0 ? '+' : ''}${formatXG(diff)}`
              }
              colore={
                s.tiri === 0
                  ? 'text-slate-500'
                  : diff > 0.05
                  ? 'text-emerald-400'
                  : diff < -0.05
                  ? 'text-red-400'
                  : 'text-slate-300'
              }
            />
          </div>

          <section className="mb-6">
            <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2">
              Da dove tira
            </h2>
            {s.tiri === 0 ? (
              <p className="text-slate-500 italic text-sm">
                Nessuna conclusione registrata in queste partite.
              </p>
            ) : (
              <>
                <div className="max-w-sm">
                  <CampoTiri modalita="mappa" conteggi={conteggiZone} />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  In ogni zona: <strong className="text-slate-400">gol/tiri</strong>{' '}
                  suoi. Più la zona è verde, più ha tirato da lì.
                  {s.golSenzaZona > 0 && (
                    <>
                      {' '}
                      {s.golSenzaZona}{' '}
                      {s.golSenzaZona === 1
                        ? 'gol è registrato'
                        : 'gol sono registrati'}{' '}
                      senza zona e non {s.golSenzaZona === 1 ? 'compare' : 'compaiono'}{' '}
                      qui.
                    </>
                  )}
                </p>
              </>
            )}
          </section>

          <section>
            <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2">
              Da cosa nascono
            </h2>
            {perOrigine.length === 0 ? (
              <p className="text-slate-500 italic text-sm">
                Nessuna conclusione registrata in queste partite.
              </p>
            ) : (
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-xs text-slate-400">
                      <th className="px-2 py-2 text-left font-semibold">
                        Situazione
                      </th>
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
                        data-origine={o.origine}
                        className="border-b border-slate-800/50"
                      >
                        <td className="px-2 py-2">
                          <span className="mr-1">{origineIcona(o.origine)}</span>
                          {origineLabelCorta(o.origine)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {o.tiri}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums font-semibold">
                          {o.gol}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-slate-400">
                          {o.tiri === 0
                            ? '—'
                            : `${Math.round((o.gol / o.tiri) * 100)}%`}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-emerald-400">
                          {formatXG(o.xG)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-slate-500 mt-2">
              Solo le situazioni in cui ha davvero concluso: le altre resterebbero
              righe a zero.
            </p>
          </section>
        </>
      )}
    </div>
  )
}
