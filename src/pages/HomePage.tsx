import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import Modal from '../components/Modal'

export default function HomePage() {
  const navigate = useNavigate()
  const [showNuova, setShowNuova] = useState(false)
  const [showCarica, setShowCarica] = useState(false)
  const [nomeNuova, setNomeNuova] = useState('')

  // useLiveQuery: si aggiorna da solo quando le stagioni cambiano nel DB
  const stagioni = useLiveQuery(
    () => db.stagioni.orderBy('dataCreazione').reverse().toArray(),
    []
  )

  async function creaStagione() {
    const nome = nomeNuova.trim()
    if (!nome) return
    const id = await db.stagioni.add({
      nome,
      dataCreazione: Date.now(),
    })
    setNomeNuova('')
    setShowNuova(false)
    navigate(`/setup-stagione/${id}`)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-4">
      <h1 className="text-3xl font-bold mb-8">Futsal Stats</h1>

      <button
        onClick={() => setShowNuova(true)}
        className="w-full max-w-xs bg-emerald-600 hover:bg-emerald-500 py-4 rounded-lg font-semibold"
      >
        Nuova stagione
      </button>

      <button
        onClick={() => setShowCarica(true)}
        className="w-full max-w-xs bg-slate-700 hover:bg-slate-600 py-4 rounded-lg font-semibold"
      >
        Carica stagione
      </button>

      {/* Modal: crea nuova stagione */}
      <Modal
        open={showNuova}
        onClose={() => setShowNuova(false)}
        title="Nuova stagione"
      >
        <input
          type="text"
          value={nomeNuova}
          onChange={(e) => setNomeNuova(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && creaStagione()}
          placeholder="Es. 2025/26"
          autoFocus
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:border-emerald-500"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setShowNuova(false)}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600"
          >
            Annulla
          </button>
          <button
            onClick={creaStagione}
            disabled={!nomeNuova.trim()}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Crea
          </button>
        </div>
      </Modal>

      {/* Modal: carica stagione */}
      <Modal
        open={showCarica}
        onClose={() => setShowCarica(false)}
        title="Carica stagione"
      >
        {stagioni === undefined ? (
          <p className="text-slate-400">Caricamento...</p>
        ) : stagioni.length === 0 ? (
          <p className="text-slate-400">Nessuna stagione salvata.</p>
        ) : (
          <ul className="flex flex-col gap-2 max-h-80 overflow-y-auto">
            {stagioni.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => {
                    setShowCarica(false)
                    navigate(`/stagione/${s.id}`)
                  }}
                  className="w-full text-left bg-slate-900 hover:bg-slate-700 px-4 py-3 rounded-lg"
                >
                  <div className="font-semibold">{s.nome}</div>
                  <div className="text-xs text-slate-400">
                    Creata il {new Date(s.dataCreazione).toLocaleDateString('it-IT')}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  )
}