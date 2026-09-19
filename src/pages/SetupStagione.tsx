import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { nomeSquadra } from '../utils/stagione'
import SezioneRosa from '../components/setup/SezioneRosa'
import SezioneAvversari from '../components/setup/SezioneAvversari'
import SezioneSchemi from '../components/setup/SezioneSchemi'

/**
 * Il setup della stagione, una scheda per volta.
 *
 * Erano tre elenchi uno sotto l'altro nella stessa pagina: per aggiungere uno
 * schema si scorreva oltre tutta la rosa. Sono cose che si toccano in momenti
 * diversi — la rosa a inizio anno, gli avversari quando esce il calendario, gli
 * schemi quando se ne prova uno nuovo — quindi ognuna ha la sua schermata.
 *
 * La scheda aperta sta nell'URL: si torna indietro dal telefono e si ritrova
 * dov'eravamo, e un link porta dove volevi mandarlo.
 */

type Sezione = 'rosa' | 'avversari' | 'schemi'

const SEZIONI: { valore: Sezione; label: string; icona: string }[] = [
  { valore: 'rosa', label: 'Rosa', icona: '👕' },
  { valore: 'avversari', label: 'Avversari', icona: '🆚' },
  { valore: 'schemi', label: 'Schemi', icona: '📐' },
]

function eSezione(v: string | null): v is Sezione {
  return v !== null && SEZIONI.some((s) => s.valore === v)
}

export default function SetupStagione() {
  const { id } = useParams()
  const navigate = useNavigate()
  const stagioneId = Number(id)

  const stagione = useLiveQuery(() => db.stagioni.get(stagioneId), [stagioneId])
  const giocatori = useLiveQuery(
    () => db.giocatori.where('stagioneId').equals(stagioneId).toArray(),
    [stagioneId]
  )
  const avversari = useLiveQuery(
    () => db.avversari.where('stagioneId').equals(stagioneId).toArray(),
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

  const [parametri, setParametri] = useSearchParams()

  if (stagione === undefined) {
    return <div className="p-6">Caricamento...</div>
  }
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

  const nellUrl = parametri.get('sez')
  const sezione: Sezione = eSezione(nellUrl) ? nellUrl : 'rosa'
  const soloLettura = stagione.soloLettura === true

  const quante: Record<Sezione, number> = {
    rosa: giocatori?.length ?? 0,
    avversari: avversari?.length ?? 0,
    schemi: schemi?.length ?? 0,
  }

  function scegli(s: Sezione) {
    const nuovi = new URLSearchParams(parametri)
    if (s === 'rosa') nuovi.delete('sez')
    else nuovi.set('sez', s)
    setParametri(nuovi, { replace: true })
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <Link to="/" className="text-sm text-slate-400 hover:text-slate-200">
            ← Home
          </Link>
          <h1 className="text-2xl font-bold mt-1 truncate">
            {nomeSquadra(stagione)}
          </h1>
          <p className="text-sm text-slate-400">{stagione.nome} • Setup stagione</p>
        </div>
        <button
          onClick={() => navigate(`/stagione/${stagioneId}`)}
          className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg font-semibold shrink-0"
        >
          Partite →
        </button>
      </div>

      {soloLettura && (
        <p className="bg-sky-900/30 border border-sky-800/60 text-sky-200 text-sm rounded-lg px-3 py-2 mb-4">
          👀 <strong>Sola lettura</strong>: rosa, avversari e schemi di questa
          stagione li gestisce chi te l'ha condivisa.
        </p>
      )}

      <div className="grid grid-cols-3 gap-1 bg-slate-800 p-1 rounded-lg mb-6">
        {SEZIONI.map((s) => (
          <button
            key={s.valore}
            data-sez-setup={s.valore}
            onClick={() => scegli(s.valore)}
            className={`px-1 py-2 rounded-md text-sm font-semibold ${
              sezione === s.valore
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="mr-1">{s.icona}</span>
            {s.label}
            <span
              className={`ml-1 font-normal ${
                sezione === s.valore ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              {quante[s.valore]}
            </span>
          </button>
        ))}
      </div>

      {sezione === 'rosa' ? (
        <SezioneRosa
          stagioneId={stagioneId}
          soloLettura={soloLettura}
          giocatori={giocatori}
        />
      ) : sezione === 'avversari' ? (
        <SezioneAvversari
          stagioneId={stagioneId}
          soloLettura={soloLettura}
          avversari={avversari}
          partite={partite}
        />
      ) : (
        <SezioneSchemi
          stagioneId={stagioneId}
          soloLettura={soloLettura}
          schemi={schemi}
        />
      )}
    </div>
  )
}
