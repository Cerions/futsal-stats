import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { eliminaStagione } from '../db/cascade'
import { nomeSquadra } from '../utils/stagione'
import Modal from '../components/Modal'
import type { Stagione } from '../db/schema'
import { esportaStagione, nomeFileExport, scaricaJSON } from '../db/export'
import { importaStagione, validaImport, leggiFileJSON } from '../db/import'

export default function HomePage() {
  const navigate = useNavigate()
  const [showNuova, setShowNuova] = useState(false)
  const [showCarica, setShowCarica] = useState(false)
  const [nomeNuova, setNomeNuova] = useState('')
  const [nomeSquadraNuova, setNomeSquadraNuova] = useState('')
  // Per il file picker (input nascosto)
  const fileInputId = 'import-file-input'

  // Modal di rinomina
  const [stagioneInModifica, setStagioneInModifica] = useState<Stagione | null>(null)
  const [nomeModificato, setNomeModificato] = useState('')
  const [nomeSquadraModificato, setNomeSquadraModificato] = useState('')

  const stagioni = useLiveQuery(
    () => db.stagioni.orderBy('dataCreazione').reverse().toArray(),
    []
  )

  async function creaStagione() {
    const nome = nomeNuova.trim()
    const squadra = nomeSquadraNuova.trim()
    if (!nome || !squadra) return
    const id = await db.stagioni.add({
      nome,
      nomeSquadra: squadra,
      dataCreazione: Date.now(),
    })
    setNomeNuova('')
    setNomeSquadraNuova('')
    setShowNuova(false)
    navigate(`/setup-stagione/${id}`)
  }

  function apriRinomina(s: Stagione) {
    setStagioneInModifica(s)
    setNomeModificato(s.nome)
    setNomeSquadraModificato(s.nomeSquadra ?? '')
  }

  async function salvaRinomina() {
    if (!stagioneInModifica) return
    const nome = nomeModificato.trim()
    const squadra = nomeSquadraModificato.trim()
    if (!nome || !squadra) return
    await db.stagioni.update(stagioneInModifica.id!, {
      nome,
      nomeSquadra: squadra,
    })
    setStagioneInModifica(null)
  }

  async function eliminaStagioneConferma(s: Stagione) {
    const conferma = prompt(
      `Sei sicuro di voler eliminare la stagione "${s.nome}"?\n` +
        `Verranno cancellati TUTTI i giocatori, gli avversari, le partite e gli eventi.\n\n` +
        `Per confermare, scrivi il nome della stagione qui sotto:`
    )
    if (conferma === null) return
    if (conferma.trim() !== s.nome) {
      alert('Nome non corrispondente. Eliminazione annullata.')
      return
    }
    await eliminaStagione(s.id!)
  }

  async function esportaStagioneFile(s: Stagione) {
    try {
      const data = await esportaStagione(s.id!)
      const filename = nomeFileExport(s.nome, nomeSquadra(s))
      scaricaJSON(data, filename)
    } catch (err) {
      alert(`Errore durante l'export: ${err instanceof Error ? err.message : err}`)
    }
  }

  async function importaDaFile(file: File) {
    try {
      const data = await leggiFileJSON(file)
      if (!validaImport(data)) {
        alert('Il file non è un export valido di Futsal Stats.')
        return
      }
      const nuovaStagioneId = await importaStagione(data)
      setShowCarica(false)
      navigate(`/stagione/${nuovaStagioneId}`)
    } catch (err) {
      alert(
        `Errore durante l'import: ${err instanceof Error ? err.message : err}`
      )
    }
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
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Nome stagione
            </label>
            <input
              type="text"
              value={nomeNuova}
              onChange={(e) => setNomeNuova(e.target.value)}
              placeholder="Es. 2025/26"
              autoFocus
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Nome della tua squadra
            </label>
            <input
              type="text"
              value={nomeSquadraNuova}
              onChange={(e) => setNomeSquadraNuova(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && creaStagione()}
              placeholder="Es. Polisportiva Brusafini"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => setShowNuova(false)}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600"
            >
              Annulla
            </button>
            <button
              onClick={creaStagione}
              disabled={!nomeNuova.trim() || !nomeSquadraNuova.trim()}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Crea
            </button>
          </div>
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
        ) : (
          <>
            {stagioni.length === 0 ? (
              <p className="text-slate-400 mb-4">Nessuna stagione salvata.</p>
            ) : (
              <ul className="flex flex-col gap-2 max-h-80 overflow-y-auto mb-4">
                {stagioni.map((s) => (
                  <li
                    key={s.id}
                    className="bg-slate-900 rounded-lg flex items-center gap-1 pr-1"
                  >
                    <button
                      onClick={() => {
                        setShowCarica(false)
                        navigate(`/stagione/${s.id}`)
                      }}
                      className="flex-1 text-left hover:bg-slate-700 px-4 py-3 rounded-lg"
                    >
                      <div className="font-semibold">{s.nome}</div>
                      <div className="text-xs text-slate-400">
                        {nomeSquadra(s)} • creata il{' '}
                        {new Date(s.dataCreazione).toLocaleDateString('it-IT')}
                      </div>
                    </button>
                    <button
                      onClick={() => esportaStagioneFile(s)}
                      className="text-slate-400 hover:text-slate-100 px-2 py-1 text-sm"
                      title="Esporta backup"
                    >
                      ⬇️
                    </button>
                    <button
                      onClick={() => apriRinomina(s)}
                      className="text-slate-400 hover:text-slate-100 px-2 py-1 text-sm"
                      title="Modifica"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => eliminaStagioneConferma(s)}
                      className="text-slate-400 hover:text-red-400 px-2 py-1 text-sm"
                      title="Elimina"
                    >
                      🗑️
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Bottone importa da file */}
            <div className="border-t border-slate-700 pt-4">
              <label
                htmlFor={fileInputId}
                className="block w-full text-center bg-slate-700 hover:bg-slate-600 py-2.5 rounded-lg font-semibold cursor-pointer"
              >
                ⬆️ Importa da file
              </label>
              <input
                id={fileInputId}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    importaDaFile(file)
                    e.target.value = '' // reset così puoi reimportare stesso file
                  }
                }}
              />
              <p className="text-xs text-slate-500 mt-2 text-center">
                Carica un backup .json esportato in precedenza
              </p>
            </div>
          </>
        )}
      </Modal>

      {/* Modal: rinomina stagione */}
      <Modal
        open={stagioneInModifica !== null}
        onClose={() => setStagioneInModifica(null)}
        title="Modifica stagione"
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Nome stagione
            </label>
            <input
              type="text"
              value={nomeModificato}
              onChange={(e) => setNomeModificato(e.target.value)}
              autoFocus
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Nome della tua squadra
            </label>
            <input
              type="text"
              value={nomeSquadraModificato}
              onChange={(e) => setNomeSquadraModificato(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && salvaRinomina()}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => setStagioneInModifica(null)}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600"
            >
              Annulla
            </button>
            <button
              onClick={salvaRinomina}
              disabled={!nomeModificato.trim() || !nomeSquadraModificato.trim()}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
            >
              Salva
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}