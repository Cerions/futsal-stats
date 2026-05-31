import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import Modal from '../components/Modal'
import { ruoloShort } from '../db/ruoli'
import {
  secondiTrascorsi,
  formatCronometro,
  minutoCorrente,
} from '../utils/cronometro'
import type { Evento, Giocatore, Partita as PartitaType } from '../db/schema'
import { nomeSquadra } from '../utils/stagione'
import { nomeCompleto, nomeCorto } from '../utils/giocatore'

export default function Partita() {
  const { id } = useParams()
  const partitaId = Number(id)

  const partita = useLiveQuery(() => db.partite.get(partitaId), [partitaId])
  const stagione = useLiveQuery(
    () => (partita ? db.stagioni.get(partita.stagioneId) : undefined),
    [partita?.stagioneId]
  )
  const avversario = useLiveQuery(
    () => (partita ? db.avversari.get(partita.avversarioId) : undefined),
    [partita?.avversarioId]
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

  if (!partita || !stagione || !avversario || !rosa) {
    return <div className="p-6">Caricamento...</div>
  }

  // Routing interno in base allo stato
  if (partita.stato === 'da_giocare') {
    return (
      <PreMatch
        partita={partita}
        rosa={rosa}
        avversarioNome={avversario.nome}
        stagioneId={stagione.id!}
      />
    )
  }

  return (
    <Live
      partita={partita}
      rosa={rosa}
      eventi={eventi ?? []}
      avversarioNome={avversario.nome}
      squadraNome={nomeSquadra(stagione)}
      stagioneId={stagione.id!}
    />
  )
}

// ===========================================================================
// PRE-MATCH: scelta convocati + titolari
// ===========================================================================

function PreMatch({
  partita,
  rosa,
  avversarioNome,
  stagioneId,
}: {
  partita: PartitaType
  rosa: Giocatore[]
  avversarioNome: string
  stagioneId: number
}) {
  const [convocati, setConvocati] = useState<Set<number>>(
    new Set(partita.convocati)
  )
  const [titolari, setTitolari] = useState<Set<number>>(
    new Set(partita.titolari)
  )

  const MAX_CONVOCATI = 12
  const MAX_TITOLARI = 5 // calcio a 5

  function toggleConvocato(id: number) {
    const next = new Set(convocati)
    if (next.has(id)) {
      next.delete(id)
      // Se era anche titolare, lo togliamo
      const nextTit = new Set(titolari)
      nextTit.delete(id)
      setTitolari(nextTit)
    } else {
      if (next.size >= MAX_CONVOCATI) return
      next.add(id)
    }
    setConvocati(next)
  }

  function toggleTitolare(id: number) {
    if (!convocati.has(id)) return // solo i convocati possono essere titolari
    const next = new Set(titolari)
    if (next.has(id)) {
      next.delete(id)
    } else {
      if (next.size >= MAX_TITOLARI) return
      next.add(id)
    }
    setTitolari(next)
  }

  async function salva() {
    await db.partite.update(partita.id!, {
      convocati: Array.from(convocati),
      titolari: Array.from(titolari),
    })
  }

  async function iniziaPartita() {
    if (titolari.size !== MAX_TITOLARI) {
      alert(`Devi selezionare esattamente ${MAX_TITOLARI} titolari.`)
      return
    }
    const now = Date.now()
    await db.partite.update(partita.id!, {
      convocati: Array.from(convocati),
      titolari: Array.from(titolari),
      inCampo: Array.from(titolari),
      stato: 'in_corso',
      cronometro: {
        tempoCorrente: 1,
        inizioTempoTimestamp: now,
        secondiAccumulati: 0,
        inPausa: false,
      },
    })
    await db.eventi.add({
      partitaId: partita.id!,
      minuto: 0,
      tipo: 'inizio_tempo',
      tempo: 1,
    })
  }

  return (
    <div className="max-w-2xl mx-auto p-6 pb-32">
      <Link to={`/stagione/${stagioneId}`} className="text-sm text-slate-400">
        ← Stagione
      </Link>
      <h1 className="text-2xl font-bold mt-1">vs {avversarioNome}</h1>
      <p className="text-sm text-slate-400 mb-6">Setup pre-partita</p>

      {/* Contatori */}
      <div className="flex gap-4 mb-4 text-sm">
        <div className="bg-slate-800 px-3 py-1.5 rounded-lg">
          Convocati: <span className="font-bold">{convocati.size}</span>/{MAX_CONVOCATI}
        </div>
        <div className="bg-slate-800 px-3 py-1.5 rounded-lg">
          Titolari: <span className="font-bold">{titolari.size}</span>/{MAX_TITOLARI}
        </div>
      </div>

      {/* Lista rosa */}
      <ul className="flex flex-col gap-2 mb-6">
        {rosa.map((g) => {
          const isConv = convocati.has(g.id!)
          const isTit = titolari.has(g.id!)
          return (
            <li
              key={g.id}
              className={`bg-slate-800 rounded-lg px-4 py-3 flex items-center gap-3 ${
                isConv ? '' : 'opacity-50'
              }`}
            >
              <input
                type="checkbox"
                checked={isConv}
                onChange={() => toggleConvocato(g.id!)}
                className="w-5 h-5"
              />
              {g.numero !== undefined && (
                <span className="bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">
                  {g.numero}
                </span>
              )}
              <div className="flex-1">
                <div className="font-medium">{nomeCompleto(g)}</div>
                <div className="text-xs text-slate-400">{ruoloShort(g.ruolo)}</div>
              </div>
              {isConv && (
                <button
                  onClick={() => toggleTitolare(g.id!)}
                  className={`px-3 py-1 rounded-lg text-sm font-semibold ${
                    isTit
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  {isTit ? 'Titolare' : 'Panchina'}
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {rosa.length === 0 && (
        <p className="text-slate-400 italic">
          Nessun giocatore in rosa.{' '}
          <Link
            to={`/setup-stagione/${stagioneId}`}
            className="text-emerald-400 underline"
          >
            Aggiungi giocatori
          </Link>
          .
        </p>
      )}

      {/* Bottoni sticky in fondo */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-700 p-4">
        <div className="max-w-2xl mx-auto flex gap-2">
          <button
            onClick={salva}
            className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-semibold"
          >
            Salva
          </button>
          <button
            onClick={iniziaPartita}
            disabled={titolari.size !== MAX_TITOLARI}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-lg font-semibold"
          >
            Inizia partita →
          </button>
        </div>
      </div>
    </div>
  )
}

// ===========================================================================
// LIVE: cronometro + bottoni gol/cambi
// ===========================================================================

function Live({
  partita,
  rosa,
  eventi,
  avversarioNome,
  squadraNome,
  stagioneId,
}: {
  partita: PartitaType
  rosa: Giocatore[]
  eventi: Evento[]
  avversarioNome: string
  squadraNome: string
  stagioneId: number
}) {
  // Tick locale per aggiornare il cronometro a video ogni secondo (non in DB!)
  const [, setTick] = useState(0)
  useEffect(() => {
    if (partita.cronometro.inPausa || partita.cronometro.inizioTempoTimestamp === null) {
      return
    }
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [partita.cronometro.inPausa, partita.cronometro.inizioTempoTimestamp])

  const secondi = secondiTrascorsi(partita.cronometro)
  const minuto = minutoCorrente(partita.cronometro)
  const inCampo = rosa.filter((g) => partita.inCampo.includes(g.id!))
  const panchina = rosa.filter(
    (g) => partita.convocati.includes(g.id!) && !partita.inCampo.includes(g.id!)
  )

  // Risultato calcolato dagli eventi
  const golFatti = eventi.filter((e) => e.tipo === 'gol_fatto').length
  const golSubiti = eventi.filter((e) => e.tipo === 'gol_subito').length

  // ----- STATE: modali -----
  const [showGol, setShowGol] = useState(false)
  const [showCambio, setShowCambio] = useState(false)
  const [esceId, setEsceId] = useState<number | null>(null)
  const [showFineTempo, setShowFineTempo] = useState(false)
  const [showFinePartita, setShowFinePartita] = useState(false)

  // ----- AZIONI -----

  async function segnaGol(giocatoreId: number) {
    await db.eventi.add({
      partitaId: partita.id!,
      minuto,
      tipo: 'gol_fatto',
      giocatoreId,
    })
    setShowGol(false)
  }

  async function segnaGolSubito() {
    await db.eventi.add({
      partitaId: partita.id!,
      minuto,
      tipo: 'gol_subito',
    })
  }

  async function eseguiCambio(entraId: number) {
    if (esceId === null) return
    await db.eventi.add({
      partitaId: partita.id!,
      minuto,
      tipo: 'cambio',
      giocatoreEntraId: entraId,
      giocatoreEsceId: esceId,
    })
    const nuoviInCampo = partita.inCampo.map((id) => (id === esceId ? entraId : id))
    await db.partite.update(partita.id!, { inCampo: nuoviInCampo })
    setEsceId(null)
    setShowCambio(false)
  }

  async function pausaRiprendi() {
    if (partita.cronometro.inPausa) {
      // riprendi
      await db.partite.update(partita.id!, {
        cronometro: {
          ...partita.cronometro,
          inizioTempoTimestamp: Date.now(),
          inPausa: false,
        },
      })
    } else {
      // pausa: accumula i secondi trascorsi finora
      await db.partite.update(partita.id!, {
        cronometro: {
          ...partita.cronometro,
          secondiAccumulati: secondi,
          inizioTempoTimestamp: null,
          inPausa: true,
        },
      })
    }
  }

  async function fineTempo() {
    const tempoFinito = partita.cronometro.tempoCorrente ?? 1
    await db.eventi.add({
      partitaId: partita.id!,
      minuto,
      tipo: 'fine_tempo',
      tempo: tempoFinito,
    })

    if (tempoFinito >= partita.config.numeroTempi) {
      // era l'ultimo tempo → fine partita
      await db.partite.update(partita.id!, {
        stato: 'finita',
        cronometro: {
          ...partita.cronometro,
          secondiAccumulati: secondi,
          inizioTempoTimestamp: null,
          inPausa: true,
        },
      })
    } else {
      // pausa tra i tempi
      await db.partite.update(partita.id!, {
        cronometro: {
          tempoCorrente: tempoFinito + 1,
          inizioTempoTimestamp: null,
          secondiAccumulati: secondi,
          inPausa: true,
        },
      })
      await db.eventi.add({
        partitaId: partita.id!,
        minuto,
        tipo: 'inizio_tempo',
        tempo: tempoFinito + 1,
      })
    }
    setShowFineTempo(false)
  }

  async function chiudiPartita() {
    await db.partite.update(partita.id!, {
      stato: 'finita',
      cronometro: {
        ...partita.cronometro,
        secondiAccumulati: secondi,
        inizioTempoTimestamp: null,
        inPausa: true,
      },
    })
    setShowFinePartita(false)
  }

  const finita = partita.stato === 'finita'

  return (
    <div className="max-w-2xl mx-auto p-4 pb-32">
      <Link to={`/stagione/${stagioneId}`} className="text-sm text-slate-400">
        ← Stagione
      </Link>

      {/* Scoreboard */}
      <div className="bg-slate-800 rounded-xl p-4 mt-2 mb-4">
        <div className="flex items-center justify-between">
          <div className="text-center flex-1 min-w-0">
            <div className="text-xs text-slate-400 truncate" title={squadraNome}>
              {squadraNome}
            </div>
            <div className="text-4xl font-bold">{golFatti}</div>
          </div>
          <div className="text-center">
            <div className="font-mono text-2xl font-bold">
              {formatCronometro(secondi)}
            </div>
            <div className="text-xs text-slate-400">
              {finita
                ? 'Finita'
                : `${partita.cronometro.tempoCorrente}° tempo${
                    partita.cronometro.inPausa ? ' • pausa' : ''
                  }`}
            </div>
          </div>
          <div className="text-center flex-1 min-w-0">
            <div className="text-xs text-slate-400 truncate" title={avversarioNome}>
              {avversarioNome}
            </div>
            <div className="text-4xl font-bold">{golSubiti}</div>
          </div>
        </div>
      </div>

      {!finita && (
        <>
          {/* Bottoni cronometro */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={pausaRiprendi}
              className="bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-semibold"
            >
              {partita.cronometro.inPausa ? '▶ Riprendi' : '⏸ Pausa'}
            </button>
            <button
              onClick={() => setShowFineTempo(true)}
              className="bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-semibold"
            >
              Fine tempo
            </button>
          </div>

          {/* Bottoni gol */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => setShowGol(true)}
              className="bg-emerald-600 hover:bg-emerald-500 py-4 rounded-lg font-bold text-lg"
            >
              ⚽ Gol nostro
            </button>
            <button
              onClick={segnaGolSubito}
              className="bg-red-600 hover:bg-red-500 py-4 rounded-lg font-bold text-lg"
            >
              ⚽ Gol subito
            </button>
          </div>

          {/* In campo */}
          <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2 mt-4">
            In campo
          </h2>
          <ul className="flex flex-col gap-1 mb-4">
            {inCampo.map((g) => (
              <li
                key={g.id}
                className="bg-slate-800 rounded-lg px-4 py-2 flex items-center gap-3"
              >
                {g.numero !== undefined && (
                  <span className="bg-slate-700 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold">
                    {g.numero}
                  </span>
                )}
                <span className="flex-1">{nomeCorto(g)}</span>
                <span className="text-xs text-slate-500">{ruoloShort(g.ruolo)}</span>
                <button
                  onClick={() => {
                    setEsceId(g.id!)
                    setShowCambio(true)
                  }}
                  className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded"
                >
                  Cambia
                </button>
              </li>
            ))}
          </ul>

          {/* Panchina (info) */}
          {panchina.length > 0 && (
            <>
              <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2">
                Panchina
              </h2>
              <ul className="flex flex-col gap-1 mb-4 opacity-70">
                {panchina.map((g) => (
                  <li key={g.id} className="bg-slate-800/50 rounded-lg px-4 py-2 flex items-center gap-3">
                    {g.numero !== undefined && (
                      <span className="bg-slate-700 w-7 h-7 rounded-full flex items-center justify-center text-xs">
                        {g.numero}
                      </span>
                    )}
                    <span className="flex-1 text-sm">{nomeCorto(g)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Bottone fine partita */}
          <button
            onClick={() => setShowFinePartita(true)}
            className="w-full bg-slate-700 hover:bg-red-700 py-3 rounded-lg font-semibold mt-4"
          >
            Termina partita
          </button>
        </>
      )}

      {/* Eventi log */}
      {eventi.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2">
            Log eventi
          </h2>
          <ul className="flex flex-col gap-1 text-sm">
            {eventi.map((e) => (
              <li key={e.id} className="bg-slate-800/50 rounded px-3 py-1.5">
                <span className="text-slate-500 font-mono mr-2">{e.minuto}'</span>
                {descriviEvento(e, rosa)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ----- MODAL: scegli marcatore ----- */}
      <Modal open={showGol} onClose={() => setShowGol(false)} title="Chi ha segnato?">
        <ul className="flex flex-col gap-2 max-h-80 overflow-y-auto">
          {inCampo.map((g) => (
            <li key={g.id}>
              <button
                onClick={() => segnaGol(g.id!)}
                className="w-full text-left bg-slate-900 hover:bg-slate-700 px-4 py-3 rounded-lg flex items-center gap-3"
              >
                {g.numero !== undefined && (
                  <span className="bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">
                    {g.numero}
                  </span>
                )}
                <span>{nomeCorto(g)}</span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>

      {/* ----- MODAL: scegli chi entra ----- */}
      <Modal
        open={showCambio}
        onClose={() => {
          setShowCambio(false)
          setEsceId(null)
        }}
        title="Chi entra?"
      >
        {panchina.length === 0 ? (
          <p className="text-slate-400">Nessun giocatore in panchina.</p>
        ) : (
          <ul className="flex flex-col gap-2 max-h-80 overflow-y-auto">
            {panchina.map((g) => (
              <li key={g.id}>
                <button
                  onClick={() => eseguiCambio(g.id!)}
                  className="w-full text-left bg-slate-900 hover:bg-slate-700 px-4 py-3 rounded-lg flex items-center gap-3"
                >
                  {g.numero !== undefined && (
                    <span className="bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">
                      {g.numero}
                    </span>
                  )}
                  <span>{nomeCorto(g)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {/* ----- MODAL: conferma fine tempo ----- */}
      <Modal
        open={showFineTempo}
        onClose={() => setShowFineTempo(false)}
        title="Fine del tempo?"
      >
        <p className="text-slate-300 mb-4">
          Stai terminando il <strong>{partita.cronometro.tempoCorrente}° tempo</strong>.
          {partita.cronometro.tempoCorrente === partita.config.numeroTempi
            ? ' Questo è l\'ultimo tempo, la partita verrà chiusa.'
            : ' Il cronometro andrà in pausa fino all\'inizio del tempo successivo.'}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setShowFineTempo(false)}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600"
          >
            Annulla
          </button>
          <button
            onClick={fineTempo}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500"
          >
            Conferma
          </button>
        </div>
      </Modal>

      {/* ----- MODAL: conferma fine partita ----- */}
      <Modal
        open={showFinePartita}
        onClose={() => setShowFinePartita(false)}
        title="Terminare la partita?"
      >
        <p className="text-slate-300 mb-4">
          La partita verrà chiusa con il risultato corrente di{' '}
          <strong>
            {golFatti}-{golSubiti}
          </strong>
          . Non potrai più aggiungere eventi.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setShowFinePartita(false)}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600"
          >
            Annulla
          </button>
          <button
            onClick={chiudiPartita}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500"
          >
            Termina
          </button>
        </div>
      </Modal>
    </div>
  )
}

// Descrive un evento per il log
function descriviEvento(e: Evento, rosa: Giocatore[]): string {
  const nome = (id: number) => {
    const g = rosa.find((x) => x.id === id)
    return g ? nomeCorto(g) : '???'
  }
  switch (e.tipo) {
    case 'inizio_tempo':
      return `Inizio ${e.tempo}° tempo`
    case 'fine_tempo':
      return `Fine ${e.tempo}° tempo`
    case 'gol_fatto':
      return `⚽ Gol di ${nome(e.giocatoreId)}`
    case 'gol_subito':
      return `⚽ Gol subito`
    case 'cambio':
      return `🔄 ${nome(e.giocatoreEsceId)} ← → ${nome(e.giocatoreEntraId)}`
  }
}