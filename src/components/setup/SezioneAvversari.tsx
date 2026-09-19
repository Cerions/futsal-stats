import { useState } from 'react'
import { db } from '../../db/database'
import Modal from '../Modal'
import ConfermaAzione from '../ConfermaAzione'
import { useConferma } from '../../utils/conferma'
import type { Partita, SquadraAvversaria } from '../../db/schema'

/** Le squadre che si incontrano: si scelgono qui e si richiamano in partita. */

export default function SezioneAvversari({
  stagioneId,
  soloLettura,
  avversari,
  partite,
}: {
  stagioneId: number
  soloLettura: boolean
  avversari: SquadraAvversaria[] | undefined
  /** Solo per dire, prima di cancellare, quante partite riguardano quella squadra. */
  partite: Partita[] | undefined
}) {
  const conferma = useConferma()

  const [aperto, setAperto] = useState(false)
  const [inModifica, setInModifica] = useState<SquadraAvversaria | null>(null)
  const [nome, setNome] = useState('')

  function apriNuovo() {
    setInModifica(null)
    setNome('')
    setAperto(true)
  }

  function apriModifica(a: SquadraAvversaria) {
    setInModifica(a)
    setNome(a.nome)
    setAperto(true)
  }

  async function salva() {
    const n = nome.trim()
    if (!n) return
    if (inModifica) {
      await db.avversari.update(inModifica.id!, { nome: n })
    } else {
      await db.avversari.add({ stagioneId, nome: n })
    }
    setAperto(false)
  }

  async function elimina(a: SquadraAvversaria) {
    const sue = (partite ?? []).filter((p) => p.avversarioId === a.id).length
    const ok = await conferma.chiedi({
      titolo: `Eliminare «${a.nome}»?`,
      messaggio:
        sue === 0
          ? "Non ci sono partite contro questa squadra: esce solo dall'elenco."
          : `Ci sono ${sue} ${sue === 1 ? 'partita' : 'partite'} contro di loro: restano, ma nell'elenco l'avversario diventa «???».`,
      azione: 'Elimina la squadra',
    })
    if (!ok) return
    await db.avversari.delete(a.id!)
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">
          Squadre avversarie{' '}
          <span className="text-slate-400 text-sm">({avversari?.length ?? 0})</span>
        </h2>
        {!soloLettura && (
          <button
            onClick={apriNuovo}
            className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-sm"
          >
            + Avversario
          </button>
        )}
      </div>

      {avversari && avversari.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {avversari.map((a) => (
            <li
              key={a.id}
              className="bg-slate-800 rounded-lg px-4 py-3 flex items-center gap-3"
            >
              <span className="flex-1">{a.nome}</span>
              {!soloLettura && (
                <>
                  <button
                    onClick={() => apriModifica(a)}
                    className="text-slate-400 hover:text-slate-100 text-sm px-2"
                    title="Modifica"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => elimina(a)}
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
        <p className="text-slate-500 text-sm italic">Nessuna squadra avversaria.</p>
      )}

      <Modal
        open={aperto}
        onClose={() => setAperto(false)}
        title={inModifica ? 'Modifica avversario' : 'Nuova squadra avversaria'}
      >
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && salva()}
          placeholder="Es. Real Madrid Futsal"
          autoFocus
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:border-emerald-500"
        />
        <div className="flex justify-end gap-2">
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
      </Modal>

      <ConfermaAzione {...conferma.props} />
    </section>
  )
}
