import { Link } from 'react-router-dom'
import { ruoloShort } from '../../db/ruoli'
import { nomeCorto } from '../../utils/giocatore'
import type { StatsGiocatore } from '../../utils/statistiche'
import type { ColonnaOrdinabile, Ordinamento } from '../../utils/colonne'

/** Pezzi comuni alle tabelle delle statistiche: header ordinabili e prima colonna. */

/** Header di colonna numerica, cliccabile per ordinare. */
export function Th({
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
export function ThGiocatore({ ord }: { ord: Ordinamento }) {
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

/**
 * Il nome, che porta alla scheda del giocatore. `dettaglio` è l'indirizzo su
 * cui costruire il link: senza, la cella resta testo (nessun link morto).
 */
export function TdGiocatore({
  s,
  dettaglio,
}: {
  s: StatsGiocatore
  dettaglio?: (giocatoreId: number) => string
}) {
  const dentro = (
    <>
      <div className={`font-medium ${dettaglio ? 'underline decoration-slate-600 underline-offset-2' : ''}`}>
        {nomeCorto(s.giocatore)}
      </div>
      <div className="text-xs text-slate-500">{ruoloShort(s.giocatore.ruolo)}</div>
    </>
  )
  return (
    <td className="px-2 py-2 sticky left-0 bg-slate-900">
      {dettaglio ? (
        <Link to={dettaglio(s.giocatore.id!)} className="block hover:text-emerald-400">
          {dentro}
        </Link>
      ) : (
        dentro
      )}
    </td>
  )
}

/** Riquadro con un numero grosso e un'etichetta: il mattone dei riepiloghi. */
export function Riquadro({
  etichetta,
  valore,
  nota,
  colore,
}: {
  etichetta: string
  valore: React.ReactNode
  nota?: React.ReactNode
  colore?: string
}) {
  return (
    <div className="bg-slate-800 rounded-lg p-3 text-center">
      <div className="text-xs text-slate-400">{etichetta}</div>
      <div className={`text-xl font-bold tabular-nums ${colore ?? ''}`}>{valore}</div>
      {nota !== undefined && (
        <div className="text-xs text-slate-500 tabular-nums">{nota}</div>
      )}
    </div>
  )
}
