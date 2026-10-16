import { Link } from 'react-router-dom'
import type { Evento, Partita, SquadraAvversaria } from '../../db/schema'
import { campoIcona } from '../../db/schema'
import type { Valutatore, Voto } from '../../cloud/voti'
import { formatData } from '../../utils/format'
import { risultatoPartita } from '../../utils/statistiche'
import { conVoto, media, scriviMedia, coloreVoto } from '../../utils/voti'
import TagBadge from '../TagBadge'

/**
 * Le partite su cui si possono dare i voti, dalla più recente, con a colpo
 * d'occhio quanti giocatori ha già votato ciascun allenatore.
 *
 * Si vota sulle partite giocate (o in corso, per chi vuole segnare a caldo
 * all'intervallo); quelle ancora da giocare compaiono da sole quando
 * iniziano.
 */
export default function ElencoPartiteVoti({
  stagioneId,
  partite,
  avversari,
  eventi,
  valutatori,
  voti,
}: {
  stagioneId: number
  partite: Partita[]
  avversari: SquadraAvversaria[]
  eventi: Evento[]
  valutatori: Valutatore[]
  voti: Voto[]
}) {
  const votabili = partite
    .filter((p) => p.stato !== 'da_giocare')
    .sort((a, b) => b.dataOra - a.dataOra)

  if (votabili.length === 0) {
    return (
      <p className="text-slate-500 italic text-center mt-10">
        Nessuna partita giocata: i voti si danno dopo il fischio d'inizio.
      </p>
    )
  }

  const nomeAvv = (id: number) => avversari.find((a) => a.id === id)?.nome ?? '???'

  return (
    <ul className="flex flex-col gap-2">
      {votabili.map((p) => {
        const suoi = voti.filter((v) => v.partita_uid === p.uid)
        const { fatti, subiti } = risultatoPartita(eventi.filter((e) => e.partitaId === p.id))
        const m = media(conVoto(suoi).map((v) => v.voto))
        const colore =
          fatti > subiti ? 'text-emerald-400' : fatti < subiti ? 'text-red-400' : 'text-slate-300'
        return (
          <li key={p.id}>
            <Link
              to={`/stagione/${stagioneId}/voti/partita/${p.uid}`}
              data-partita-voti={p.uid}
              className="block bg-slate-800 hover:bg-slate-700/70 rounded-lg px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold flex items-center gap-2 flex-wrap">
                    {p.campo !== undefined && <span>{campoIcona(p.campo)}</span>}
                    vs {nomeAvv(p.avversarioId)}
                    <TagBadge tag={p.tag} />
                    {p.stato === 'in_corso' && (
                      <span className="text-xs text-amber-400">in corso</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">{formatData(p.dataOra)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-lg font-bold tabular-nums ${colore}`}>
                    {fatti}-{subiti}
                  </div>
                  {m !== null && (
                    <div className={`text-xs tabular-nums ${coloreVoto(m)}`}>
                      media {scriviMedia(m)}
                    </div>
                  )}
                </div>
              </div>
              {valutatori.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {valutatori
                    // gli ex e lo storico solo dove hanno votato
                    .filter((val) => (val.attivo && val.email !== null) || suoi.some((v) => v.valutatore === val.id))
                    .map((val) => {
                    const n = new Set(
                      suoi.filter((v) => v.valutatore === val.id).map((v) => v.giocatore_uid)
                    ).size
                    const tot = p.convocati.length
                    const completo = tot > 0 && n >= tot
                    return (
                      <span
                        key={val.id}
                        className={`text-xs rounded-full px-2 py-0.5 border ${
                          n === 0
                            ? 'border-slate-700 text-slate-500'
                            : completo
                            ? 'border-emerald-800/70 text-emerald-300'
                            : 'border-sky-800/70 text-sky-300'
                        }`}
                      >
                        {val.nome} {n}/{tot}
                      </span>
                    )
                  })}
                </div>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
