import { Link } from 'react-router-dom'
import { db } from '../db/database'
import { ordineRuolo, ruoloShort } from '../db/ruoli'
import { giocatoriCoinvolti } from '../utils/evento'
import { nomeCompleto } from '../utils/giocatore'
import type { Evento, Giocatore, Partita } from '../db/schema'

/**
 * La lista dei convocati, modificabile a partita già cominciata (o finita).
 *
 * Prima si potevano scegliere solo prima del via, e bastava dimenticarsi un
 * giocatore per non poterlo più registrare: le sue giocate finivano su un
 * compagno. Qui invece si aggiunge chi manca in qualsiasi momento.
 *
 * A togliere però si sta attenti. Un convocato che è in campo o che ha già
 * eventi a suo nome non si può levare: sparirebbe da metà partita lasciando
 * eventi che puntano a un giocatore non convocato. Prima si sistemano i suoi
 * eventi, poi lo si toglie.
 */
export default function GestioneConvocati({
  partita,
  rosa,
  eventi,
  stagioneId,
  /** Tetto ai convocati, o null se non c'è. A partita iniziata non c'è. */
  limite = null,
}: {
  partita: Partita
  rosa: Giocatore[]
  eventi: Evento[]
  stagioneId: number
  limite?: number | null
}) {
  const convocati = new Set(partita.convocati)
  const inCampo = new Set(partita.inCampo)

  // Chi compare in almeno un evento, in qualsiasi ruolo.
  const conEventi = new Set<number>()
  for (const e of eventi) {
    for (const id of giocatoriCoinvolti(e)) conEventi.add(id)
  }

  const rosaOrdinata = [...rosa].sort(
    (a, b) => ordineRuolo(a.ruolo) - ordineRuolo(b.ruolo)
  )

  /** Perché questo giocatore non si può togliere, o null se si può. */
  function motivoBlocco(g: Giocatore): string | null {
    if (!convocati.has(g.id!)) return null
    if (inCampo.has(g.id!)) return 'in campo'
    if (conEventi.has(g.id!)) return 'ha eventi'
    return null
  }

  async function toggle(g: Giocatore) {
    const id = g.id!
    if (motivoBlocco(g) !== null) return
    // Rileggo dentro la transazione: la stessa cautela del pre-partita, qui
    // serve anche di più perché la partita si sta muovendo sotto.
    await db.partite
      .where('id')
      .equals(partita.id!)
      .modify((p) => {
        const conv = new Set(p.convocati)
        if (conv.has(id)) {
          conv.delete(id)
          p.titolari = p.titolari.filter((t) => t !== id)
        } else {
          if (limite !== null && conv.size >= limite) return
          conv.add(id)
        }
        p.convocati = Array.from(conv)
      })
  }

  if (rosa.length === 0) {
    return (
      <p className="text-slate-400 italic text-sm">
        Nessun giocatore in rosa.{' '}
        <Link to={`/setup-stagione/${stagioneId}`} className="text-emerald-400 underline">
          Aggiungi giocatori
        </Link>
        .
      </p>
    )
  }

  return (
    <>
      <ul className="flex flex-col gap-2">
        {rosaOrdinata.map((g) => {
          const isConv = convocati.has(g.id!)
          const blocco = motivoBlocco(g)
          const pieno = !isConv && limite !== null && convocati.size >= limite
          return (
            <li
              key={g.id}
              data-convocato={isConv ? 'si' : 'no'}
              className={`bg-slate-800 rounded-lg px-4 py-3 flex items-center gap-3 ${
                isConv ? '' : 'opacity-50'
              }`}
            >
              <input
                type="checkbox"
                checked={isConv}
                disabled={blocco !== null || pieno}
                onChange={() => toggle(g)}
                className="w-5 h-5 disabled:opacity-40"
              />
              {g.numero !== undefined && (
                <span className="bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">
                  {g.numero}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium">{nomeCompleto(g)}</div>
                <div className="text-xs text-slate-400">
                  {ruoloShort(g.ruolo)}
                  {blocco !== null && (
                    <span className="text-slate-500"> · {blocco}, non si toglie</span>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-slate-500 mt-2">
        Chi è in campo o ha già eventi a suo nome non si può togliere: prima
        sposta o cancella i suoi eventi.
      </p>
    </>
  )
}
