import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { eliminaPartita as cascadeEliminaPartita } from '../db/cascade'
import { descriviEvento } from '../utils/evento'
import { nomeCorto } from '../utils/giocatore'
import { ordineRuolo } from '../db/ruoli'
import TagSelector from '../components/TagSelector'
import Modal from '../components/Modal'
import type { Evento, TagPartita } from '../db/schema'

type TipoEventoNuovo =
  | 'gol_fatto'
  | 'gol_subito'
  | 'autogol_pro'
  | 'autogol_contro'

export default function ModificaPartita() {
  const { id } = useParams()
  const navigate = useNavigate()
  const partitaId = Number(id)

  const partita = useLiveQuery(() => db.partite.get(partitaId), [partitaId])
  const stagione = useLiveQuery(
    () => (partita ? db.stagioni.get(partita.stagioneId) : undefined),
    [partita?.stagioneId]
  )
  const avversari = useLiveQuery(
    () =>
      partita
        ? db.avversari.where('stagioneId').equals(partita.stagioneId).toArray()
        : [],
    [partita?.stagioneId]
  )
  const rosa = useLiveQuery(
    () =>
      partita
        ? db.giocatori.where('stagioneId').equals(partita.stagioneId).toArray()
        : [],
    [partita?.stagioneId]
  )
  const eventi = useLiveQuery(
    () => db.eventi.where('partitaId').equals(partitaId).sortBy('id'),
    [partitaId]
  )

  // --- Modal: aggiungi evento ---
  const [showAggiungi, setShowAggiungi] = useState(false)
  const [tipoNuovo, setTipoNuovo] = useState<TipoEventoNuovo>('gol_fatto')
  const [minutoNuovo, setMinutoNuovo] = useState('0')
  const [tempoGiocoNuovo, setTempoGiocoNuovo] = useState('1')
  const [marcatoreNuovo, setMarcatoreNuovo] = useState<number | ''>('')
  const [assistNuovo, setAssistNuovo] = useState<number | ''>('')

  // --- Modal: modifica gol esistente ---
  const [eventoInModifica, setEventoInModifica] = useState<Evento | null>(null)
  const [editMarcatore, setEditMarcatore] = useState<number | ''>('')
  const [editAssist, setEditAssist] = useState<number | ''>('')

  if (!partita || !stagione || !avversari || !rosa || !eventi) {
    return <div className="p-6">Caricamento...</div>
  }

  const rosaConvocati = rosa
    .filter((g) => partita.convocati.includes(g.id!))
    .sort((a, b) => ordineRuolo(a.ruolo) - ordineRuolo(b.ruolo))

  // ===== Update info base partita =====
  async function aggiornaAvversario(nuovoId: number) {
    await db.partite.update(partitaId, { avversarioId: nuovoId })
  }
  async function aggiornaDataOra(nuova: string) {
    await db.partite.update(partitaId, { dataOra: new Date(nuova).getTime() })
  }
  async function aggiornaTag(tag: TagPartita | undefined) {
    await db.partite.update(partitaId, { tag })
  }

  // ===== Elimina partita =====
  async function eliminaTutto() {
    if (!confirm('Eliminare definitivamente questa partita e tutti i suoi eventi?'))
      return
    await cascadeEliminaPartita(partitaId)
    navigate(`/stagione/${partita!.stagioneId}`)
  }

  // ===== Elimina evento =====
  async function eliminaEvento(e: Evento) {
    if (!confirm(`Eliminare l'evento "${descriviEvento(e, rosa!)}"?`)) return
    await db.eventi.delete(e.id!)
  }

  // ===== Aggiungi evento =====
  function apriAggiungi() {
    setTipoNuovo('gol_fatto')
    setMinutoNuovo('0')
    setTempoGiocoNuovo(String(partita!.cronometro.tempoCorrente ?? 1))
    setMarcatoreNuovo('')
    setAssistNuovo('')
    setShowAggiungi(true)
  }

  async function salvaNuovoEvento() {
    const minuto = Number(minutoNuovo)
    const tempoGioco = Number(tempoGiocoNuovo)
    if (isNaN(minuto) || isNaN(tempoGioco) || tempoGioco < 1) return

    const base = { partitaId, minuto, tempoGioco }

    switch (tipoNuovo) {
      case 'gol_fatto': {
        if (marcatoreNuovo === '') return
        await db.eventi.add({
          ...base,
          tipo: 'gol_fatto',
          giocatoreId: Number(marcatoreNuovo),
          assistId: assistNuovo === '' ? undefined : Number(assistNuovo),
        })
        break
      }
      case 'gol_subito':
        await db.eventi.add({ ...base, tipo: 'gol_subito' })
        break
      case 'autogol_pro':
        await db.eventi.add({ ...base, tipo: 'autogol_pro' })
        break
      case 'autogol_contro': {
        if (marcatoreNuovo === '') return
        await db.eventi.add({
          ...base,
          tipo: 'autogol_contro',
          giocatoreId: Number(marcatoreNuovo),
        })
        break
      }
    }
    setShowAggiungi(false)
  }

  // ===== Modifica gol esistente =====
  function apriModificaEvento(e: Evento) {
    if (e.tipo !== 'gol_fatto' && e.tipo !== 'autogol_contro') return
    setEventoInModifica(e)
    if (e.tipo === 'gol_fatto') {
      setEditMarcatore(e.giocatoreId)
      setEditAssist(e.assistId ?? '')
    } else {
      setEditMarcatore(e.giocatoreId)
      setEditAssist('')
    }
  }

  async function salvaModificaEvento() {
    if (!eventoInModifica) return
    if (editMarcatore === '') return

    if (eventoInModifica.tipo === 'gol_fatto') {
      await db.eventi.update(eventoInModifica.id!, {
        giocatoreId: Number(editMarcatore),
        assistId: editAssist === '' ? undefined : Number(editAssist),
      } as Partial<Evento>)
    } else if (eventoInModifica.tipo === 'autogol_contro') {
      await db.eventi.update(eventoInModifica.id!, {
        giocatoreId: Number(editMarcatore),
      } as Partial<Evento>)
    }
    setEventoInModifica(null)
  }

  // Etichetta tipo evento per il dropdown
  const TIPI_EVENTO: { value: TipoEventoNuovo; label: string }[] = [
    { value: 'gol_fatto', label: 'Gol nostro' },
    { value: 'gol_subito', label: 'Gol subito' },
    { value: 'autogol_pro', label: 'Autogol avversario (gol per noi)' },
    { value: 'autogol_contro', label: 'Autogol nostro (gol per loro)' },
  ]

  const richiedeGiocatore =
    tipoNuovo === 'gol_fatto' || tipoNuovo === 'autogol_contro'
  const richiedeAssist = tipoNuovo === 'gol_fatto'

  // Per la data: input datetime-local vuole "YYYY-MM-DDTHH:mm"
  const dataInputValue = new Date(partita.dataOra - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)

  return (
    <div className="max-w-2xl mx-auto p-4 pb-32">
      <Link to={`/partita/${partitaId}`} className="text-sm text-slate-400">
        ← Partita
      </Link>
      <h1 className="text-2xl font-bold mt-1 mb-4">Modifica partita</h1>

      {/* ===== Info base partita ===== */}
      <section className="bg-slate-800 rounded-xl p-4 mb-4 flex flex-col gap-3">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Avversario</label>
          <select
            value={partita.avversarioId}
            onChange={(e) => aggiornaAvversario(Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
          >
            {avversari.map((a) => (
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
            value={dataInputValue}
            onChange={(e) => aggiornaDataOra(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-2">Tipo partita</label>
          <TagSelector value={partita.tag} onChange={aggiornaTag} />
        </div>
      </section>

      {/* ===== Lista eventi ===== */}
      <section className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">
            Eventi{' '}
            <span className="text-slate-400 text-sm">({eventi.length})</span>
          </h2>
          <button
            onClick={apriAggiungi}
            className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg text-sm font-semibold"
          >
            + Aggiungi
          </button>
        </div>

        {eventi.length === 0 ? (
          <p className="text-slate-500 italic text-sm">Nessun evento registrato.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {eventi.map((e) => {
              const modificabile = e.tipo === 'gol_fatto' || e.tipo === 'autogol_contro'
              return (
                <li
                  key={e.id}
                  className="bg-slate-800/50 rounded px-3 py-2 flex items-center gap-2"
                >
                  <span className="text-slate-500 font-mono shrink-0">
                    T{e.tempoGioco} • {e.minuto}'
                  </span>
                  <span className="flex-1">{descriviEvento(e, rosa)}</span>
                  {modificabile && (
                    <button
                      onClick={() => apriModificaEvento(e)}
                      className="text-slate-400 hover:text-slate-100 text-xs px-2"
                      title="Modifica"
                    >
                      ✏️
                    </button>
                  )}
                  <button
                    onClick={() => eliminaEvento(e)}
                    className="text-slate-400 hover:text-red-400 text-xs px-2"
                    title="Elimina"
                  >
                    🗑️
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ===== Elimina partita ===== */}
      <section className="mt-8 pt-4 border-t border-slate-700">
        <button
          onClick={eliminaTutto}
          className="w-full bg-red-900 hover:bg-red-800 py-3 rounded-lg font-semibold"
        >
          Elimina partita
        </button>
      </section>

      {/* ===== MODAL: aggiungi evento ===== */}
      <Modal
        open={showAggiungi}
        onClose={() => setShowAggiungi(false)}
        title="Aggiungi evento"
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Tipo evento</label>
            <select
              value={tipoNuovo}
              onChange={(e) => setTipoNuovo(e.target.value as TipoEventoNuovo)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
            >
              {TIPI_EVENTO.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Tempo</label>
              <input
                type="number"
                min="1"
                max={partita.config.numeroTempi}
                value={tempoGiocoNuovo}
                onChange={(e) => setTempoGiocoNuovo(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Minuto</label>
              <input
                type="number"
                min="0"
                max={partita.config.durataTempoMinuti}
                value={minutoNuovo}
                onChange={(e) => setMinutoNuovo(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
              />
            </div>
          </div>

          {richiedeGiocatore && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Giocatore</label>
              <select
                value={marcatoreNuovo}
                onChange={(e) =>
                  setMarcatoreNuovo(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
              >
                <option value="">Seleziona...</option>
                {rosaConvocati.map((g) => (
                  <option key={g.id} value={g.id}>
                    {nomeCorto(g)} {g.numero !== undefined ? `(${g.numero})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {richiedeAssist && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Assist (opzionale)
              </label>
              <select
                value={assistNuovo}
                onChange={(e) =>
                  setAssistNuovo(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
              >
                <option value="">Nessun assist</option>
                {rosaConvocati
                  .filter((g) => g.id !== marcatoreNuovo)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {nomeCorto(g)} {g.numero !== undefined ? `(${g.numero})` : ''}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => setShowAggiungi(false)}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600"
            >
              Annulla
            </button>
            <button
              onClick={salvaNuovoEvento}
              disabled={richiedeGiocatore && marcatoreNuovo === ''}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
            >
              Aggiungi
            </button>
          </div>
        </div>
      </Modal>

      {/* ===== MODAL: modifica gol/autogol esistente ===== */}
      <Modal
        open={eventoInModifica !== null}
        onClose={() => setEventoInModifica(null)}
        title={
          eventoInModifica?.tipo === 'gol_fatto'
            ? 'Modifica gol'
            : 'Modifica autogol'
        }
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Giocatore</label>
            <select
              value={editMarcatore}
              onChange={(e) =>
                setEditMarcatore(e.target.value === '' ? '' : Number(e.target.value))
              }
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
            >
              <option value="">Seleziona...</option>
              {rosaConvocati.map((g) => (
                <option key={g.id} value={g.id}>
                  {nomeCorto(g)} {g.numero !== undefined ? `(${g.numero})` : ''}
                </option>
              ))}
            </select>
          </div>

          {eventoInModifica?.tipo === 'gol_fatto' && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Assist (opzionale)
              </label>
              <select
                value={editAssist}
                onChange={(e) =>
                  setEditAssist(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
              >
                <option value="">Nessun assist</option>
                {rosaConvocati
                  .filter((g) => g.id !== editMarcatore)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {nomeCorto(g)} {g.numero !== undefined ? `(${g.numero})` : ''}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => setEventoInModifica(null)}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600"
            >
              Annulla
            </button>
            <button
              onClick={salvaModificaEvento}
              disabled={editMarcatore === ''}
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