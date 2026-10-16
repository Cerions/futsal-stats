import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { nomeSquadra } from '../utils/stagione'
import { useVoti } from '../cloud/voti'
import Requisiti from '../components/voti/Requisiti'
import ElencoPartiteVoti from '../components/voti/ElencoPartiteVoti'
import MedieVoti from '../components/voti/MedieVoti'
import GestioneAllenatori from '../components/voti/GestioneAllenatori'
import GraficiVoti from '../components/voti/GraficiVoti'
import type { Stagione } from '../db/schema'

/**
 * La sezione Voti: i giudizi soggettivi degli allenatori, partita per
 * partita, con le loro medie.
 *
 * È un mondo a parte rispetto alle statistiche: quelle si contano dagli
 * eventi, questi li scrive una persona. Per questo stanno su un bottone
 * loro e su tabelle loro sul cloud.
 */

type Sezione = 'partite' | 'medie' | 'grafici' | 'allenatori'

const SEZIONI: { valore: Sezione; label: string; icona: string }[] = [
  { valore: 'partite', label: 'Partite', icona: '📋' },
  { valore: 'medie', label: 'Medie', icona: '🔢' },
  { valore: 'grafici', label: 'Grafici', icona: '📈' },
  { valore: 'allenatori', label: 'Allenatori', icona: '🧑‍🏫' },
]

function eSezione(v: string | null): v is Sezione {
  return v !== null && SEZIONI.some((s) => s.valore === v)
}

export default function Voti() {
  const { id } = useParams()
  const stagioneId = Number(id)
  const stagione = useLiveQuery(() => db.stagioni.get(stagioneId), [stagioneId])

  if (stagione === undefined) return <div className="p-6">Caricamento...</div>
  if (stagione === null) {
    return (
      <div className="p-6">
        <p>Stagione non trovata.</p>
        <Link to="/" className="text-emerald-400 underline">
          Torna alla home
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 pb-16">
      <Link
        to={`/stagione/${stagioneId}`}
        className="text-sm text-slate-400 hover:text-slate-200"
      >
        ← {nomeSquadra(stagione)}
      </Link>
      <h1 className="text-2xl font-bold mt-1">Voti</h1>
      <p className="text-sm text-slate-400 mb-5">{stagione.nome}</p>

      <Requisiti stagione={stagione}>
        {(ctx) => <Contenuto stagione={stagione} {...ctx} />}
      </Requisiti>
    </div>
  )
}

function Contenuto({
  stagione,
  cloudId,
  email,
  proprietario,
}: {
  stagione: Stagione
  cloudId: string
  email: string | null
  proprietario: boolean
}) {
  const stagioneId = stagione.id!
  const voti = useVoti(cloudId)
  const [parametri, setParametri] = useSearchParams()
  const sezNellUrl = parametri.get('sez')
  const sezione: Sezione = eSezione(sezNellUrl) ? sezNellUrl : 'partite'

  const rosa = useLiveQuery(
    () => db.giocatori.where('stagioneId').equals(stagioneId).toArray(),
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
    const ids = partite.map((p) => p.id!).filter(Boolean)
    if (ids.length === 0) return []
    return db.eventi.where('partitaId').anyOf(ids).toArray()
  }, [partite])

  if (!rosa || !partite || !avversari || !eventi || voti.stato === 'caricamento') {
    return <p className="text-slate-400">Caricamento...</p>
  }
  if (voti.stato === 'errore') {
    return (
      <div className="bg-red-900/30 border border-red-800/60 text-red-200 text-sm rounded-lg px-4 py-3">
        <p>{voti.messaggio}</p>
        <button onClick={voti.ricarica} className="underline mt-2">
          Riprova
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="flex gap-1.5 mb-5 bg-slate-800 rounded-xl p-1">
        {SEZIONI.map((s) => (
          <button
            key={s.valore}
            data-sez={s.valore}
            onClick={() => setParametri({ sez: s.valore }, { replace: true })}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex flex-col items-center gap-0.5 ${
              sezione === s.valore
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="text-base leading-none">{s.icona}</span>
            {s.label}
          </button>
        ))}
      </div>

      {!voti.valutatori.some((v) => v.attivo && v.email !== null) && sezione !== 'allenatori' && (
        <p className="bg-amber-900/30 border border-amber-700/60 text-amber-200 text-sm rounded-lg px-3 py-2 mb-4">
          {proprietario ? (
            <>
              Non c'è ancora nessuno che dà i voti. Il ruolo di allenatore, te
              compreso, si dà dalle{' '}
              <Link to={`/cloud?persone=${cloudId}`} className="underline">
                persone della stagione
              </Link>
              .
            </>
          ) : (
            'Chi gestisce la stagione non ha ancora indicato gli allenatori che danno i voti.'
          )}
        </p>
      )}

      {sezione === 'partite' && (
        <ElencoPartiteVoti
          stagioneId={stagioneId}
          partite={partite}
          avversari={avversari}
          eventi={eventi}
          valutatori={voti.valutatori}
          voti={voti.voti}
        />
      )}
      {sezione === 'medie' && (
        <MedieVoti
          rosa={rosa}
          partite={partite}
          avversari={avversari}
          valutatori={voti.valutatori}
          voti={voti.voti}
        />
      )}
      {sezione === 'grafici' && (
        <GraficiVoti
          rosa={rosa}
          partite={partite}
          avversari={avversari}
          valutatori={voti.valutatori}
          voti={voti.voti}
        />
      )}
      {sezione === 'allenatori' && (
        <GestioneAllenatori
          cloudId={cloudId}
          email={email}
          proprietario={proprietario}
          rosa={rosa}
          partite={partite}
          avversari={avversari}
          valutatori={voti.valutatori}
          voti={voti.voti}
          onCambio={voti.ricarica}
        />
      )}
    </>
  )
}
