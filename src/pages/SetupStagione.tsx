import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { RUOLI, ruoloShort } from '../db/ruoli'
import Modal from '../components/Modal'
import type { Ruolo, Giocatore, SquadraAvversaria } from '../db/schema'

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

  // ----- MODAL GIOCATORE (unico per aggiunta + modifica) -----
  const [showGiocatore, setShowGiocatore] = useState(false)
  const [giocatoreInModifica, setGiocatoreInModifica] = useState<Giocatore | null>(null)
  const [formNome, setFormNome] = useState('')
  const [formNumero, setFormNumero] = useState('')
  const [formRuolo, setFormRuolo] = useState<Ruolo>('UNIVERSALE')

  function apriNuovoGiocatore() {
    setGiocatoreInModifica(null)
    setFormNome('')
    setFormNumero('')
    setFormRuolo('UNIVERSALE')
    setShowGiocatore(true)
  }

  function apriModificaGiocatore(g: Giocatore) {
    setGiocatoreInModifica(g)
    setFormNome(g.nome)
    setFormNumero(g.numero?.toString() ?? '')
    setFormRuolo(g.ruolo)
    setShowGiocatore(true)
  }

  async function salvaGiocatore() {
    const nome = formNome.trim()
    if (!nome) return
    const numero = formNumero ? Number(formNumero) : undefined
    if (giocatoreInModifica) {
      await db.giocatori.update(giocatoreInModifica.id!, {
        nome,
        numero,
        ruolo: formRuolo,
      })
    } else {
      await db.giocatori.add({
        stagioneId,
        nome,
        numero,
        ruolo: formRuolo,
      })
    }
    setShowGiocatore(false)
  }

  async function eliminaGiocatore(giocatoreId: number) {
    if (!confirm('Eliminare questo giocatore dalla rosa?')) return
    await db.giocatori.delete(giocatoreId)
  }

  // ----- MODAL AVVERSARIO (unico per aggiunta + modifica) -----
  const [showAvversario, setShowAvversario] = useState(false)
  const [avversarioInModifica, setAvversarioInModifica] =
    useState<SquadraAvversaria | null>(null)
  const [formAvversario, setFormAvversario] = useState('')

  function apriNuovoAvversario() {
    setAvversarioInModifica(null)
    setFormAvversario('')
    setShowAvversario(true)
  }

  function apriModificaAvversario(a: SquadraAvversaria) {
    setAvversarioInModifica(a)
    setFormAvversario(a.nome)
    setShowAvversario(true)
  }

  async function salvaAvversario() {
    const nome = formAvversario.trim()
    if (!nome) return
    if (avversarioInModifica) {
      await db.avversari.update(avversarioInModifica.id!, { nome })
    } else {
      await db.avversari.add({ stagioneId, nome })
    }
    setShowAvversario(false)
  }

  async function eliminaAvversario(avvId: number) {
    if (!confirm('Eliminare questa squadra avversaria?')) return
    await db.avversari.delete(avvId)
  }

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

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/" className="text-sm text-slate-400 hover:text-slate-200">
            ← Home
          </Link>
          <h1 className="text-2xl font-bold mt-1">{stagione.nome}</h1>
          <p className="text-sm text-slate-400">Setup stagione</p>
        </div>
        <button
          onClick={() => navigate(`/stagione/${stagioneId}`)}
          className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg font-semibold"
        >
          Vai alle partite →
        </button>
      </div>

      {/* Sezione Rosa */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">
            Rosa{' '}
            <span className="text-slate-400 text-sm">
              ({giocatori?.length ?? 0})
            </span>
          </h2>
          <button
            onClick={apriNuovoGiocatore}
            className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-sm"
          >
            + Giocatore
          </button>
        </div>

        {giocatori && giocatori.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {giocatori.map((g) => (
              <li
                key={g.id}
                className="bg-slate-800 rounded-lg px-4 py-3 flex items-center gap-3"
              >
                {g.numero !== undefined && (
                  <span className="bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">
                    {g.numero}
                  </span>
                )}
                <div className="flex-1">
                  <div className="font-medium">{g.nome}</div>
                  <div className="text-xs text-slate-400">{ruoloShort(g.ruolo)}</div>
                </div>
                <button
                  onClick={() => apriModificaGiocatore(g)}
                  className="text-slate-400 hover:text-slate-100 text-sm px-2"
                  title="Modifica"
                >
                  ✏️
                </button>
                <button
                  onClick={() => eliminaGiocatore(g.id!)}
                  className="text-slate-400 hover:text-red-400 text-sm px-2"
                  title="Elimina"
                >
                  🗑️
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500 text-sm italic">Nessun giocatore in rosa.</p>
        )}
      </section>

      {/* Sezione Avversari */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">
            Squadre avversarie{' '}
            <span className="text-slate-400 text-sm">
              ({avversari?.length ?? 0})
            </span>
          </h2>
          <button
            onClick={apriNuovoAvversario}
            className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-sm"
          >
            + Avversario
          </button>
        </div>

        {avversari && avversari.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {avversari.map((a) => (
              <li
                key={a.id}
                className="bg-slate-800 rounded-lg px-4 py-3 flex items-center gap-3"
              >
                <span className="flex-1">{a.nome}</span>
                <button
                  onClick={() => apriModificaAvversario(a)}
                  className="text-slate-400 hover:text-slate-100 text-sm px-2"
                  title="Modifica"
                >
                  ✏️
                </button>
                <button
                  onClick={() => eliminaAvversario(a.id!)}
                  className="text-slate-400 hover:text-red-400 text-sm px-2"
                  title="Elimina"
                >
                  🗑️
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500 text-sm italic">Nessuna squadra avversaria.</p>
        )}
      </section>

      {/* Modal giocatore (nuovo o modifica) */}
      <Modal
        open={showGiocatore}
        onClose={() => setShowGiocatore(false)}
        title={giocatoreInModifica ? 'Modifica giocatore' : 'Nuovo giocatore'}
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Nome</label>
            <input
              type="text"
              value={formNome}
              onChange={(e) => setFormNome(e.target.value)}
              autoFocus
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Numero (opzionale)
            </label>
            <input
              type="number"
              min="1"
              max="99"
              value={formNumero}
              onChange={(e) => setFormNumero(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Ruolo</label>
            <select
              value={formRuolo}
              onChange={(e) => setFormRuolo(e.target.value as Ruolo)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
            >
              {RUOLI.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => setShowGiocatore(false)}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600"
            >
              Annulla
            </button>
            <button
              onClick={salvaGiocatore}
              disabled={!formNome.trim()}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
            >
              {giocatoreInModifica ? 'Salva' : 'Aggiungi'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal avversario (nuovo o modifica) */}
      <Modal
        open={showAvversario}
        onClose={() => setShowAvversario(false)}
        title={
          avversarioInModifica ? 'Modifica avversario' : 'Nuova squadra avversaria'
        }
      >
        <input
          type="text"
          value={formAvversario}
          onChange={(e) => setFormAvversario(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && salvaAvversario()}
          placeholder="Es. Real Madrid Futsal"
          autoFocus
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:border-emerald-500"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setShowAvversario(false)}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600"
          >
            Annulla
          </button>
          <button
            onClick={salvaAvversario}
            disabled={!formAvversario.trim()}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
          >
            {avversarioInModifica ? 'Salva' : 'Aggiungi'}
          </button>
        </div>
      </Modal>
    </div>
  )
}