import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import Modal from '../components/Modal'
import { formatDataOra } from '../utils/format'
import { eliminaPartita as cascadeEliminaPartita } from '../db/cascade'

export default function Dashboard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const stagioneId = Number(id)

  const stagione = useLiveQuery(() => db.stagioni.get(stagioneId), [stagioneId])
  const avversari = useLiveQuery(
    () => db.avversari.where('stagioneId').equals(stagioneId).toArray(),
    [stagioneId]
  )
  const partite = useLiveQuery(
    () =>
      db.partite
        .where('stagioneId')
        .equals(stagioneId)
        .reverse()
        .sortBy('dataOra'),
    [stagioneId]
  )

  // Stato modal nuova partita
  const [showNuovaPartita, setShowNuovaPartita] = useState(false)
  const [avversarioId, setAvversarioId] = useState<number | ''>('')
  const [dataPartita, setDataPartita] = useState(
    new Date().toISOString().slice(0, 16) // formato per input datetime-local
  )
  const [numeroTempi, setNumeroTempi] = useState(2)
  const [durataTempo, setDurataTempo] = useState(20)
  const [tempoEffettivo, setTempoEffettivo] = useState(true)

  async function creaPartita() {
    if (avversarioId === '') return
    const id = await db.partite.add({
      stagioneId,
      avversarioId: Number(avversarioId),
      dataOra: new Date(dataPartita).getTime(),
      config: {
        numeroTempi,
        durataTempoMinuti: durataTempo,
        tempoEffettivo,
      },
      convocati: [],
      titolari: [],
      inCampo: [],
      stato: 'da_giocare',
      cronometro: {
        tempoCorrente: null,
        inizioTempoTimestamp: null,
        secondiAccumulati: 0,
        inPausa: false,
      },
    })
    setShowNuovaPartita(false)
    // Reset form per la prossima
    setAvversarioId('')
    navigate(`/partita/${id}`)
  }

  async function eliminaPartitaConferma(partitaId: number) {
    if (!confirm('Eliminare questa partita? Tutti gli eventi registrati verranno persi.')) return
    await cascadeEliminaPartita(partitaId)
  }

  // Lookup veloce nome avversario per renderizzare le partite
  const nomeAvversario = (id: number) =>
    avversari?.find((a) => a.id === id)?.nome ?? '???'

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

  const partiteInCorso = partite?.filter((p) => p.stato === 'in_corso') ?? []
  const partiteDaGiocare = partite?.filter((p) => p.stato === 'da_giocare') ?? []
  const partiteFinite = partite?.filter((p) => p.stato === 'finita') ?? []

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/" className="text-sm text-slate-400 hover:text-slate-200">
            ← Home
          </Link>
          <h1 className="text-2xl font-bold mt-1">{stagione.nome}</h1>
        </div>
        <Link
          to={`/setup-stagione/${stagioneId}`}
          className="text-sm text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg px-3 py-1.5"
        >
          Setup
        </Link>
      </div>

      {/* Bottone nuova partita */}
      <button
        onClick={() => setShowNuovaPartita(true)}
        disabled={!avversari || avversari.length === 0}
        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed py-4 rounded-lg font-semibold mb-6"
      >
        + Nuova partita
      </button>

      {avversari && avversari.length === 0 && (
        <p className="text-sm text-amber-400 mb-6 -mt-4">
          Prima di creare una partita aggiungi almeno una squadra avversaria dal{' '}
          <Link to={`/setup-stagione/${stagioneId}`} className="underline">
            setup
          </Link>
          .
        </p>
      )}

      {/* Partite in corso */}
      {partiteInCorso.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm uppercase tracking-wider text-amber-400 font-semibold mb-2">
            In corso
          </h2>
          <ul className="flex flex-col gap-2">
            {partiteInCorso.map((p) => (
              <li
                key={p.id}
                className="bg-slate-800 border-l-4 border-amber-500 rounded-lg px-4 py-3 flex items-center justify-between"
              >
                <button
                  onClick={() => navigate(`/partita/${p.id}`)}
                  className="text-left flex-1"
                >
                  <div className="font-semibold">vs {nomeAvversario(p.avversarioId)}</div>
                  <div className="text-xs text-slate-400">{formatDataOra(p.dataOra)}</div>
                </button>
                <span className="text-amber-400 text-sm">Riprendi →</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Partite da giocare */}
      {partiteDaGiocare.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2">
            Da giocare
          </h2>
          <ul className="flex flex-col gap-2">
            {partiteDaGiocare.map((p) => (
              <li
                key={p.id}
                className="bg-slate-800 rounded-lg px-4 py-3 flex items-center justify-between"
              >
                <button
                  onClick={() => navigate(`/partita/${p.id}`)}
                  className="text-left flex-1"
                >
                  <div className="font-semibold">vs {nomeAvversario(p.avversarioId)}</div>
                  <div className="text-xs text-slate-400">{formatDataOra(p.dataOra)}</div>
                </button>
                <button
                  onClick={() => eliminaPartitaConferma(p.id!)}
                  className="text-slate-500 hover:text-red-400 text-sm ml-3"
                >
                  Elimina
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Partite finite */}
      {partiteFinite.length > 0 && (
        <section>
          <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2">
            Giocate
          </h2>
          <ul className="flex flex-col gap-2">
            {partiteFinite.map((p) => (
              <li
                key={p.id}
                className="bg-slate-800 rounded-lg px-4 py-3 flex items-center justify-between opacity-80"
              >
                <button
                  onClick={() => navigate(`/partita/${p.id}`)}
                  className="text-left flex-1"
                >
                  <div className="font-semibold">vs {nomeAvversario(p.avversarioId)}</div>
                  <div className="text-xs text-slate-400">{formatDataOra(p.dataOra)}</div>
                </button>
                <button
                  onClick={() => eliminaPartitaConferma(p.id!)}
                  className="text-slate-500 hover:text-red-400 text-sm ml-3"
                >
                  Elimina
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {partite && partite.length === 0 && (
        <p className="text-slate-500 italic text-center mt-12">
          Nessuna partita ancora. Crea la prima!
        </p>
      )}

      {/* Modal Nuova partita */}
      <Modal
        open={showNuovaPartita}
        onClose={() => setShowNuovaPartita(false)}
        title="Nuova partita"
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Avversario</label>
            <select
              value={avversarioId}
              onChange={(e) =>
                setAvversarioId(e.target.value === '' ? '' : Number(e.target.value))
              }
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
            >
              <option value="">Seleziona...</option>
              {avversari?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Data e ora</label>
            <input
              type="datetime-local"
              value={dataPartita}
              onChange={(e) => setDataPartita(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">N° tempi</label>
              <input
                type="number"
                min="1"
                max="4"
                value={numeroTempi}
                onChange={(e) => setNumeroTempi(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Durata (min)
              </label>
              <input
                type="number"
                min="1"
                max="90"
                value={durataTempo}
                onChange={(e) => setDurataTempo(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={tempoEffettivo}
              onChange={(e) => setTempoEffettivo(e.target.checked)}
              className="w-4 h-4"
            />
            Tempo effettivo (cronometro si ferma quando la palla esce)
          </label>

          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => setShowNuovaPartita(false)}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600"
            >
              Annulla
            </button>
            <button
              onClick={creaPartita}
              disabled={avversarioId === ''}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
            >
              Crea partita
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}