import { useState } from 'react'
import { db } from '../../db/database'
import { TIPI_INATTIVA } from '../../db/zone'
import { eliminaSchema as cascadeEliminaSchema } from '../../db/cascade'
import Modal from '../Modal'
import ConfermaAzione from '../ConfermaAzione'
import { useConferma } from '../../utils/conferma'
import type { Schema, TipoInattiva } from '../../db/schema'

/** Gli schemi sulle palle inattive, raggruppati per situazione. */

export default function SezioneSchemi({
  stagioneId,
  soloLettura,
  schemi,
}: {
  stagioneId: number
  soloLettura: boolean
  schemi: Schema[] | undefined
}) {
  const conferma = useConferma()

  const [aperto, setAperto] = useState(false)
  const [inModifica, setInModifica] = useState<Schema | null>(null)
  const [tipo, setTipo] = useState<TipoInattiva>('corner')
  const [nome, setNome] = useState('')
  const [note, setNote] = useState('')

  function apriNuovo(t: TipoInattiva) {
    setInModifica(null)
    setTipo(t)
    setNome('')
    setNote('')
    setAperto(true)
  }

  function apriModifica(s: Schema) {
    setInModifica(s)
    setTipo(s.tipo)
    setNome(s.nome)
    setNote(s.note ?? '')
    setAperto(true)
  }

  async function salva() {
    const n = nome.trim()
    if (!n) return
    const nt = note.trim() || undefined
    if (inModifica) {
      await db.schemi.update(inModifica.id!, { tipo, nome: n, note: nt })
    } else {
      await db.schemi.add({ stagioneId, tipo, nome: n, note: nt })
    }
    setAperto(false)
  }

  async function elimina(s: Schema) {
    const ok = await conferma.chiedi({
      titolo: `Eliminare lo schema «${s.nome}»?`,
      messaggio:
        'Le battute e i tiri già registrati restano, ma perdono il riferimento: nelle statistiche finiscono sotto «senza schema».',
      azione: 'Elimina lo schema',
    })
    if (!ok) return
    await cascadeEliminaSchema(s.id!)
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-1">
        Schemi palle inattive{' '}
        <span className="text-slate-400 text-sm">({schemi?.length ?? 0})</span>
      </h2>
      <p className="text-xs text-slate-500 mb-3">
        Li scegli in partita quando batti, e a fine stagione vedi quali rendono e
        quali girano a vuoto.
      </p>

      <div className="flex flex-col gap-4">
        {TIPI_INATTIVA.map((t) => {
          const delTipo = (schemi ?? []).filter((s) => s.tipo === t.value)
          return (
            <div key={t.value}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-300">
                  <span className="mr-1">{t.icona}</span>
                  {t.label}{' '}
                  <span className="text-slate-500 font-normal">
                    ({delTipo.length})
                  </span>
                </h3>
                {!soloLettura && (
                  <button
                    onClick={() => apriNuovo(t.value)}
                    className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded-lg text-xs"
                  >
                    + Schema
                  </button>
                )}
              </div>

              {delTipo.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {delTipo.map((s) => (
                    <li
                      key={s.id}
                      className="bg-slate-800 rounded-lg px-4 py-3 flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{s.nome}</div>
                        {s.note && (
                          <div className="text-xs text-slate-400 truncate">
                            {s.note}
                          </div>
                        )}
                      </div>
                      {!soloLettura && (
                        <>
                          <button
                            onClick={() => apriModifica(s)}
                            className="text-slate-400 hover:text-slate-100 text-sm px-2"
                            title="Modifica"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => elimina(s)}
                            className="text-slate-400 hover:text-red-400 text-sm px-2"
                            title="Elimina"
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500 text-xs italic">
                  Nessuno schema. Puoi comunque registrare le battute senza.
                </p>
              )}
            </div>
          )
        })}
      </div>

      <Modal
        open={aperto}
        onClose={() => setAperto(false)}
        title={inModifica ? 'Modifica schema' : 'Nuovo schema'}
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Situazione</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoInattiva)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
            >
              {TIPI_INATTIVA.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.icona} {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && salva()}
              placeholder="Es. Corto sul primo palo"
              autoFocus
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Note (opzionale)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Come si sviluppa, chi si muove dove..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => setAperto(false)}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600"
            >
              Annulla
            </button>
            <button
              onClick={salva}
              disabled={!nome.trim()}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
            >
              {inModifica ? 'Salva' : 'Aggiungi'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfermaAzione {...conferma.props} />
    </section>
  )
}
