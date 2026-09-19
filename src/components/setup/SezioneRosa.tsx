import { useState } from 'react'
import { db } from '../../db/database'
import { RUOLI, ruoloLabel, ordineRuolo } from '../../db/ruoli'
import Modal from '../Modal'
import ConfermaAzione from '../ConfermaAzione'
import { useConferma } from '../../utils/conferma'
import { nomeCompleto } from '../../utils/giocatore'
import type { Giocatore, Ruolo } from '../../db/schema'

/** La rosa: chi c'è, con che numero e in che ruolo. */

export default function SezioneRosa({
  stagioneId,
  soloLettura,
  giocatori,
}: {
  stagioneId: number
  soloLettura: boolean
  giocatori: Giocatore[] | undefined
}) {
  const conferma = useConferma()

  // Un modale solo per l'aggiunta e la modifica: cambia il titolo e il bottone.
  const [aperto, setAperto] = useState(false)
  const [inModifica, setInModifica] = useState<Giocatore | null>(null)
  const [nome, setNome] = useState('')
  const [cognome, setCognome] = useState('')
  const [numero, setNumero] = useState('')
  const [ruolo, setRuolo] = useState<Ruolo>('UNIVERSALE')

  function apriNuovo() {
    setInModifica(null)
    setNome('')
    setCognome('')
    setNumero('')
    setRuolo('UNIVERSALE')
    setAperto(true)
  }

  function apriModifica(g: Giocatore) {
    setInModifica(g)
    setNome(g.nome)
    setCognome(g.cognome)
    setNumero(g.numero?.toString() ?? '')
    setRuolo(g.ruolo)
    setAperto(true)
  }

  async function salva() {
    const n = nome.trim()
    const c = cognome.trim()
    if (!n || !c) return
    const num = numero ? Number(numero) : undefined
    if (inModifica) {
      await db.giocatori.update(inModifica.id!, {
        nome: n,
        cognome: c,
        numero: num,
        ruolo,
      })
    } else {
      await db.giocatori.add({
        stagioneId,
        nome: n,
        cognome: c,
        numero: num,
        ruolo,
      })
    }
    setAperto(false)
  }

  async function elimina(g: Giocatore) {
    const ok = await conferma.chiedi({
      titolo: `Eliminare ${nomeCompleto(g)}?`,
      messaggio:
        'Esce dalla rosa. Gli eventi delle partite già giocate restano dove sono, ma perdono il suo nome: nelle statistiche non comparirà più.',
      azione: 'Elimina dalla rosa',
    })
    if (!ok) return
    await db.giocatori.delete(g.id!)
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">
          Rosa{' '}
          <span className="text-slate-400 text-sm">({giocatori?.length ?? 0})</span>
        </h2>
        {!soloLettura && (
          <button
            onClick={apriNuovo}
            className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-sm"
          >
            + Giocatore
          </button>
        )}
      </div>

      {giocatori && giocatori.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {[...giocatori]
            .sort((a, b) => ordineRuolo(a.ruolo) - ordineRuolo(b.ruolo))
            .map((g) => (
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
                  <div className="font-medium">{nomeCompleto(g)}</div>
                  <div className="text-xs text-slate-400">{ruoloLabel(g.ruolo)}</div>
                </div>
                {!soloLettura && (
                  <>
                    <button
                      onClick={() => apriModifica(g)}
                      className="text-slate-400 hover:text-slate-100 text-sm px-2"
                      title="Modifica"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => elimina(g)}
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
        <p className="text-slate-500 text-sm italic">Nessun giocatore in rosa.</p>
      )}

      <Modal
        open={aperto}
        onClose={() => setAperto(false)}
        title={inModifica ? 'Modifica giocatore' : 'Nuovo giocatore'}
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoFocus
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Cognome</label>
            <input
              type="text"
              value={cognome}
              onChange={(e) => setCognome(e.target.value)}
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
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Ruolo</label>
            <select
              value={ruolo}
              onChange={(e) => setRuolo(e.target.value as Ruolo)}
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
              onClick={() => setAperto(false)}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600"
            >
              Annulla
            </button>
            <button
              onClick={salva}
              disabled={!nome.trim() || !cognome.trim()}
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
