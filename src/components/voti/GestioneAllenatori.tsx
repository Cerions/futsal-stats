import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Valutatore, Voto } from '../../cloud/voti'
import { aggiornaValutatore, eliminaValutatore } from '../../cloud/voti'
import {
  coloreVoto,
  exAllenatore,
  ioComeValutatore,
  scriviMedia,
  soloStorico,
  valutatoriScrivibili,
} from '../../utils/voti'
import { medieAllenatori } from '../../utils/medieVoti'
import type { Giocatore, Partita, SquadraAvversaria } from '../../db/schema'
import { useConferma } from '../../utils/conferma'
import ConfermaAzione from '../ConfermaAzione'
import ImportaFoglio from './ImportaFoglio'

/**
 * Chi dà i voti, da consultare: quanti voti ha dato, con che media, chi vota
 * per chi.
 *
 * Chi è allenatore e chi no si decide in un posto solo, le persone della
 * stagione in Sincronizzazione, insieme alla sola lettura: la stessa email non
 * si scrive due volte. Qui restano le cose che riguardano solo i voti:
 * - gli ex allenatori, i cui voti restano nelle medie;
 * - gli allenatori «senza account» dello storico importato, che non hanno
 *   un'email e quindi non c'entrano con la condivisione: si possono
 *   rinominare ed eliminare (con i loro voti);
 * - l'import dello storico dal foglio.
 */
export default function GestioneAllenatori({
  cloudId,
  email,
  proprietario,
  rosa,
  partite,
  avversari,
  valutatori,
  voti,
  onCambio,
}: {
  cloudId: string
  email: string | null
  proprietario: boolean
  rosa: Giocatore[]
  partite: Partita[]
  avversari: SquadraAvversaria[]
  valutatori: Valutatore[]
  voti: Voto[]
  onCambio: () => void
}) {
  const conferma = useConferma()
  const [errore, setErrore] = useState<string | null>(null)
  const [occupato, setOccupato] = useState(false)
  const [rinominando, setRinominando] = useState<{ id: string; nome: string } | null>(null)

  const io = ioComeValutatore(valutatori, email)
  const scrivibili = valutatoriScrivibili(valutatori, email, proprietario)
  // Come il foglio «Media Allenatori»: chi è più severo si vede da qui
  const dati = medieAllenatori({ partite, voti, valutatori })
  const nomeDi = (e: string) => valutatori.find((v) => v.email === e)?.nome ?? e

  const attivi = valutatori.filter((v) => v.attivo && !soloStorico(v))
  const ex = valutatori.filter(exAllenatore)
  const storici = valutatori.filter(soloStorico)

  async function esegui(op: () => Promise<string | null>) {
    setOccupato(true)
    setErrore(null)
    const err = await op()
    setOccupato(false)
    if (err) setErrore(err)
    onCambio()
  }

  async function salvaNome() {
    if (!rinominando) return
    const v = valutatori.find((x) => x.id === rinominando.id)
    const nuovo = rinominando.nome.trim()
    setRinominando(null)
    if (!v || !nuovo || nuovo === v.nome) return
    await esegui(() => aggiornaValutatore(v.id, { nome: nuovo }))
  }

  async function elimina(v: Valutatore) {
    const suoi = voti.filter((x) => x.valutatore === v.id).length
    const ok = await conferma.chiedi({
      titolo: `Eliminare ${v.nome} e i suoi voti?`,
      messaggio: `Si cancellano anche i suoi ${suoi} voti dello storico, e con loro il loro peso nelle medie. Se li hai importati per sbaglio puoi reimportare il foglio.`,
      azione: 'Elimina',
      parolaChiave: suoi > 0 ? v.nome : undefined,
    })
    if (!ok) return
    await esegui(() => eliminaValutatore(v.id))
  }

  // Una funzione che restituisce JSX, non un componente: definito qui dentro
  // verrebbe ricreato a ogni render, e il campo «Rinomina» perderebbe il focus
  // a ogni tasto.
  function scheda(v: Valutatore, etichetta?: string) {
    const dato = dati.get(v.id)
    const nVoti = voti.filter((x) => x.valutatore === v.id).length
    const delegati = v.attivo ? v.delegati.filter((d) => attivi.some((a) => a.email === d)) : []
    const modificabile = proprietario && soloStorico(v)
    return (
      <li key={v.id} data-valutatore={v.email ?? v.nome} className="bg-slate-800 rounded-lg px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {rinominando?.id === v.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void salvaNome()
                }}
                className="flex gap-2"
              >
                <input
                  autoFocus
                  value={rinominando.nome}
                  onChange={(e) => setRinominando({ id: v.id, nome: e.target.value })}
                  className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500"
                />
                <button type="submit" className="text-emerald-400 text-sm">
                  Salva
                </button>
                <button type="button" onClick={() => setRinominando(null)} className="text-slate-400 text-sm">
                  Annulla
                </button>
              </form>
            ) : (
              <div className="font-semibold">
                {v.nome}
                {io?.id === v.id && <span className="text-xs text-emerald-400 ml-2">tu</span>}
                {etichetta && <span className="text-xs text-slate-500 font-normal ml-2">{etichetta}</span>}
              </div>
            )}
            {v.email && <div className="text-xs text-slate-400 truncate">{v.email}</div>}
            <div className="text-xs text-slate-500 mt-0.5">
              {nVoti === 1 ? '1 voto' : `${nVoti} voti`}
              {dato?.media != null && (
                <>
                  {' · media data '}
                  <span className={`font-semibold tabular-nums ${coloreVoto(dato.media)}`}>
                    {scriviMedia(dato.media)}
                  </span>
                </>
              )}
            </div>
            {delegati.length > 0 && (
              <div className="text-xs text-slate-500 mt-1">
                I suoi voti li inserisce anche: {delegati.map(nomeDi).join(', ')}
              </div>
            )}
          </div>
          {modificabile && rinominando?.id !== v.id && (
            <div className="flex gap-3 text-sm shrink-0">
              <button
                onClick={() => setRinominando({ id: v.id, nome: v.nome })}
                disabled={occupato}
                className="text-slate-400 hover:text-slate-200"
              >
                Rinomina
              </button>
              <button
                onClick={() => elimina(v)}
                disabled={occupato}
                className="text-slate-500 hover:text-red-400"
              >
                Elimina
              </button>
            </div>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {errore && (
        <p className="bg-red-900/30 border border-red-800/60 text-red-200 text-sm rounded-lg px-3 py-2">
          {errore}
        </p>
      )}

      {proprietario ? (
        <Link
          to={`/cloud?persone=${cloudId}`}
          data-gestisci-persone
          className="block bg-slate-800 hover:bg-slate-700/70 rounded-lg px-4 py-3"
        >
          <div className="font-semibold">👥 Chi vede la stagione e chi vota →</div>
          <div className="text-xs text-slate-400">
            Allenatori, sola lettura e deleghe si gestiscono insieme in Sincronizzazione.
          </div>
        </Link>
      ) : (
        <p className="bg-slate-800 rounded-lg px-4 py-3 text-sm text-slate-300">
          {scrivibili.length === 0 ? (
            <>Puoi consultare voti e medie, ma non inserirne.</>
          ) : (
            <>
              Puoi inserire i voti per: <strong>{scrivibili.map((v) => v.nome).join(', ')}</strong>.
            </>
          )}
        </p>
      )}

      <section>
        <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2">Allenatori</h2>
        {attivi.length === 0 ? (
          <p className="text-slate-500 italic text-sm">
            {proprietario
              ? 'Nessuno ancora: dai il ruolo di allenatore dalle persone della stagione, te compreso.'
              : 'Chi gestisce la stagione non ha ancora indicato gli allenatori.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {attivi.map((v) => scheda(v))}
          </ul>
        )}
      </section>

      {(ex.length > 0 || storici.length > 0) && (
        <section>
          <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-1">
            Non votano più
          </h2>
          <p className="text-xs text-slate-500 mb-2">
            I loro voti restano nelle medie e nello storico delle partite.
          </p>
          <ul className="flex flex-col gap-2">
            {ex.map((v) => scheda(v, 'ex allenatore'))}
            {storici.map((v) => scheda(v, 'senza account'))}
          </ul>
        </section>
      )}

      {proprietario && (
        <ImportaFoglio
          cloudId={cloudId}
          rosa={rosa}
          partite={partite}
          avversari={avversari}
          valutatori={valutatori}
          voti={voti}
          onFatto={onCambio}
        />
      )}

      <ConfermaAzione {...conferma.props} />
    </div>
  )
}
