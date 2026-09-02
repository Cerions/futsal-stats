import { useState } from 'react'
import { useParams, useNavigate, Link, Navigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { eliminaPartita as cascadeEliminaPartita } from '../db/cascade'
import { descriviEvento } from '../utils/evento'
import { nomeCorto } from '../utils/giocatore'
import { ordineRuolo } from '../db/ruoli'
import TagSelector from '../components/TagSelector'
import Modal from '../components/Modal'
import type {
  EsitoTiro,
  Evento,
  OrigineTiro,
  Schema,
  TagPartita,
  TipoInattiva,
  ZonaTiro,
} from '../db/schema'
import {
  ESITI_TIRO,
  ORIGINI_TIRO,
  TIPI_INATTIVA,
  ZONE_TIRO,
  origineComeInattiva,
  origineRichiedeBattuta,
  origineRichiedeSchema,
} from '../db/zone'

type TipoEventoNuovo =
  | 'gol_fatto'
  | 'gol_subito'
  | 'autogol_pro'
  | 'autogol_contro'
  | 'tiro'
  | 'tiro_subito'
  | 'inattiva'

/** Eventi che si possono correggere a posteriori dalla lista. */
function eventoModificabile(e: Evento): boolean {
  return (
    e.tipo === 'gol_fatto' ||
    e.tipo === 'autogol_contro' ||
    e.tipo === 'tiro' ||
    e.tipo === 'gol_subito' ||
    e.tipo === 'tiro_subito' ||
    e.tipo === 'inattiva'
  )
}

/** Select riutilizzabile per la zona di tiro. */
function SelectZona({
  value,
  onChange,
  opzionale,
  soloCampo = false,
}: {
  value: ZonaTiro | ''
  onChange: (z: ZonaTiro | '') => void
  opzionale: boolean
  /** esclude rigore e tiro libero: non sono punti di battuta */
  soloCampo?: boolean
}) {
  const zone = soloCampo ? ZONE_TIRO.filter((z) => !z.daFermo) : ZONE_TIRO
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value === '' ? '' : (e.target.value as ZonaTiro))}
      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
    >
      <option value="">{opzionale ? 'Non registrata (niente xG)' : 'Seleziona...'}</option>
      {zone.map((z) => (
        <option key={z.value} value={z.value}>
          {z.label}
          {soloCampo ? '' : ` — xG ${z.peso.toFixed(2)}`}
        </option>
      ))}
    </select>
  )
}

/** Select riutilizzabile per lo schema, filtrato sulla situazione. */
function SelectSchema({
  value,
  onChange,
  schemi,
  tipo,
}: {
  value: number | ''
  onChange: (id: number | '') => void
  schemi: Schema[]
  tipo: TipoInattiva | null
}) {
  const disponibili = tipo === null ? [] : schemi.filter((s) => s.tipo === tipo)
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
    >
      <option value="">Nessuno schema</option>
      {disponibili.map((s) => (
        <option key={s.id} value={s.id}>
          {s.nome}
        </option>
      ))}
    </select>
  )
}

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
  const schemi = useLiveQuery(
    () =>
      partita
        ? db.schemi.where('stagioneId').equals(partita.stagioneId).toArray()
        : [],
    [partita?.stagioneId]
  )

  // --- Modal: aggiungi evento ---
  const [showAggiungi, setShowAggiungi] = useState(false)
  const [tipoNuovo, setTipoNuovo] = useState<TipoEventoNuovo>('gol_fatto')
  const [minutoNuovo, setMinutoNuovo] = useState('0')
  const [tempoGiocoNuovo, setTempoGiocoNuovo] = useState('1')
  const [marcatoreNuovo, setMarcatoreNuovo] = useState<number | ''>('')
  const [assistNuovo, setAssistNuovo] = useState<number | ''>('')
  const [zonaNuova, setZonaNuova] = useState<ZonaTiro | ''>('')
  const [esitoNuovo, setEsitoNuovo] = useState<EsitoTiro>('parato')
  const [origineNuova, setOrigineNuova] = useState<OrigineTiro>('azione')
  const [battutaNuova, setBattutaNuova] = useState<ZonaTiro | ''>('')
  const [schemaNuovo, setSchemaNuovo] = useState<number | ''>('')
  const [situazioneNuova, setSituazioneNuova] = useState<TipoInattiva>('corner')

  // --- Modal: modifica evento esistente ---
  const [eventoInModifica, setEventoInModifica] = useState<Evento | null>(null)
  const [editMarcatore, setEditMarcatore] = useState<number | ''>('')
  const [editAssist, setEditAssist] = useState<number | ''>('')
  const [editZona, setEditZona] = useState<ZonaTiro | ''>('')
  const [editEsito, setEditEsito] = useState<EsitoTiro>('parato')
  const [editOrigine, setEditOrigine] = useState<OrigineTiro>('azione')
  const [editBattuta, setEditBattuta] = useState<ZonaTiro | ''>('')
  const [editSchema, setEditSchema] = useState<number | ''>('')
  const [editSituazione, setEditSituazione] = useState<TipoInattiva>('corner')

  if (!partita || !stagione || !avversari || !rosa || !eventi || !schemi) {
    return <div className="p-6">Caricamento...</div>
  }

  // Le stagioni condivise si guardano e basta: qui non si entra proprio.
  if (stagione.soloLettura) {
    return <Navigate to={`/partita/${partitaId}`} replace />
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
    if (!confirm(`Eliminare l'evento "${descriviEvento(e, rosa!, schemi!)}"?`)) return
    await db.eventi.delete(e.id!)
  }

  // ===== Aggiungi evento =====
  function apriAggiungi() {
    setTipoNuovo('gol_fatto')
    setMinutoNuovo('0')
    setTempoGiocoNuovo(String(partita!.cronometro.tempoCorrente ?? 1))
    setMarcatoreNuovo('')
    setAssistNuovo('')
    setZonaNuova('')
    setEsitoNuovo('parato')
    setOrigineNuova('azione')
    setBattutaNuova('')
    setSchemaNuovo('')
    setSituazioneNuova('corner')
    setShowAggiungi(true)
  }

  /** Campi comuni a tiri e gol che descrivono come è nata la conclusione. */
  function datiOrigineNuovi() {
    return {
      origine: origineNuova,
      zonaBattuta: origineRichiedeBattuta(origineNuova)
        ? battutaNuova === ''
          ? undefined
          : battutaNuova
        : undefined,
      schemaId: origineRichiedeSchema(origineNuova)
        ? schemaNuovo === ''
          ? undefined
          : Number(schemaNuovo)
        : undefined,
    }
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
          ...datiOrigineNuovi(),
          tipo: 'gol_fatto',
          giocatoreId: Number(marcatoreNuovo),
          assistId: assistNuovo === '' ? undefined : Number(assistNuovo),
          zona: zonaNuova === '' ? undefined : zonaNuova,
        })
        break
      }
      case 'tiro': {
        if (marcatoreNuovo === '' || zonaNuova === '') return
        await db.eventi.add({
          ...base,
          ...datiOrigineNuovi(),
          tipo: 'tiro',
          giocatoreId: Number(marcatoreNuovo),
          zona: zonaNuova,
          esito: esitoNuovo,
        })
        break
      }
      case 'inattiva':
        await db.eventi.add({
          ...base,
          tipo: 'inattiva',
          situazione: situazioneNuova,
          schemaId: schemaNuovo === '' ? undefined : Number(schemaNuovo),
        })
        break
      case 'gol_subito':
        await db.eventi.add({
          ...base,
          tipo: 'gol_subito',
          zona: zonaNuova === '' ? undefined : zonaNuova,
          origine: origineNuova,
        })
        break
      case 'tiro_subito': {
        if (zonaNuova === '') return
        await db.eventi.add({
          ...base,
          tipo: 'tiro_subito',
          zona: zonaNuova,
          esito: esitoNuovo,
          origine: origineNuova,
        })
        break
      }
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
    if (!eventoModificabile(e)) return
    setEventoInModifica(e)
    setEditAssist('')
    setEditZona('')
    setEditEsito('parato')
    setEditOrigine('azione')
    setEditBattuta('')
    setEditSchema('')
    setEditSituazione('corner')
    switch (e.tipo) {
      case 'gol_fatto':
        setEditMarcatore(e.giocatoreId)
        setEditAssist(e.assistId ?? '')
        setEditZona(e.zona ?? '')
        setEditOrigine(e.origine ?? 'azione')
        setEditBattuta(e.zonaBattuta ?? '')
        setEditSchema(e.schemaId ?? '')
        break
      case 'autogol_contro':
        setEditMarcatore(e.giocatoreId)
        break
      case 'gol_subito':
        // niente giocatore nostro: sblocchiamo il salvataggio
        setEditMarcatore(0)
        setEditZona(e.zona ?? '')
        setEditOrigine(e.origine ?? 'azione')
        break
      case 'tiro_subito':
        setEditMarcatore(0)
        setEditZona(e.zona)
        setEditEsito(e.esito)
        setEditOrigine(e.origine ?? 'azione')
        break
      case 'tiro':
        setEditMarcatore(e.giocatoreId)
        setEditZona(e.zona)
        setEditEsito(e.esito)
        setEditOrigine(e.origine ?? 'azione')
        setEditBattuta(e.zonaBattuta ?? '')
        setEditSchema(e.schemaId ?? '')
        break
      case 'inattiva':
        // la battuta non ha giocatore: sblocchiamo il salvataggio
        setEditMarcatore(0)
        setEditSituazione(e.situazione)
        setEditSchema(e.schemaId ?? '')
        break
    }
  }

  async function salvaModificaEvento() {
    if (!eventoInModifica) return
    if (editMarcatore === '') return

    // Campi di origine, coerenti con l'origine scelta:
    // battuta e schema si azzerano se l'origine non li prevede.
    const datiOrigineEdit = {
      origine: editOrigine,
      zonaBattuta: origineRichiedeBattuta(editOrigine)
        ? editBattuta === ''
          ? undefined
          : editBattuta
        : undefined,
      schemaId: origineRichiedeSchema(editOrigine)
        ? editSchema === ''
          ? undefined
          : Number(editSchema)
        : undefined,
    }

    if (eventoInModifica.tipo === 'gol_fatto') {
      await db.eventi.update(eventoInModifica.id!, {
        ...datiOrigineEdit,
        giocatoreId: Number(editMarcatore),
        assistId: editAssist === '' ? undefined : Number(editAssist),
        zona: editZona === '' ? undefined : editZona,
      } as Partial<Evento>)
    } else if (eventoInModifica.tipo === 'autogol_contro') {
      await db.eventi.update(eventoInModifica.id!, {
        giocatoreId: Number(editMarcatore),
      } as Partial<Evento>)
    } else if (eventoInModifica.tipo === 'tiro') {
      if (editZona === '') return
      await db.eventi.update(eventoInModifica.id!, {
        ...datiOrigineEdit,
        giocatoreId: Number(editMarcatore),
        zona: editZona,
        esito: editEsito,
      } as Partial<Evento>)
    } else if (eventoInModifica.tipo === 'gol_subito') {
      await db.eventi.update(eventoInModifica.id!, {
        zona: editZona === '' ? undefined : editZona,
        origine: editOrigine,
      } as Partial<Evento>)
    } else if (eventoInModifica.tipo === 'tiro_subito') {
      if (editZona === '') return
      await db.eventi.update(eventoInModifica.id!, {
        zona: editZona,
        esito: editEsito,
        origine: editOrigine,
      } as Partial<Evento>)
    } else if (eventoInModifica.tipo === 'inattiva') {
      await db.eventi.update(eventoInModifica.id!, {
        situazione: editSituazione,
        schemaId: editSchema === '' ? undefined : Number(editSchema),
      } as Partial<Evento>)
    }
    setEventoInModifica(null)
  }

  // Etichetta tipo evento per il dropdown
  const TIPI_EVENTO: { value: TipoEventoNuovo; label: string }[] = [
    { value: 'gol_fatto', label: 'Gol nostro' },
    { value: 'tiro', label: 'Tiro (non gol)' },
    { value: 'inattiva', label: 'Palla inattiva battuta' },
    { value: 'gol_subito', label: 'Gol subito' },
    { value: 'tiro_subito', label: 'Tiro loro (non gol)' },
    { value: 'autogol_pro', label: 'Autogol avversario (gol per noi)' },
    { value: 'autogol_contro', label: 'Autogol nostro (gol per loro)' },
  ]

  // Che campi mostra il modale di modifica, in base al tipo di evento aperto.
  const tipoInModifica = eventoInModifica?.tipo
  const editHaGiocatore =
    tipoInModifica === 'gol_fatto' ||
    tipoInModifica === 'tiro' ||
    tipoInModifica === 'autogol_contro'
  const editHaZona =
    tipoInModifica === 'gol_fatto' ||
    tipoInModifica === 'tiro' ||
    tipoInModifica === 'gol_subito' ||
    tipoInModifica === 'tiro_subito'
  const editZonaOpzionale =
    tipoInModifica === 'gol_fatto' || tipoInModifica === 'gol_subito'
  const editHaEsito = tipoInModifica === 'tiro' || tipoInModifica === 'tiro_subito'
  const editHaOrigine = tipoInModifica === 'gol_fatto' || tipoInModifica === 'tiro'
  /** Sui subiti si sceglie l'origine, ma non schema né punto di battuta. */
  const editHaSoloOrigine =
    tipoInModifica === 'gol_subito' || tipoInModifica === 'tiro_subito'

  const richiedeGiocatore =
    tipoNuovo === 'gol_fatto' ||
    tipoNuovo === 'autogol_contro' ||
    tipoNuovo === 'tiro'
  const richiedeAssist = tipoNuovo === 'gol_fatto'
  const mostraZona =
    tipoNuovo === 'gol_fatto' ||
    tipoNuovo === 'tiro' ||
    tipoNuovo === 'gol_subito' ||
    tipoNuovo === 'tiro_subito'
  const zonaObbligatoria = tipoNuovo === 'tiro' || tipoNuovo === 'tiro_subito'
  // Origine e schema descrivono come costruiamo NOI l'azione: delle conclusioni
  // subite registriamo solo da dove sono partite e com'è finita.
  // Il corner ha lo schema ma non l'origine: è lui stesso una palla inattiva
  const mostraOrigine = tipoNuovo === 'gol_fatto' || tipoNuovo === 'tiro'
  const mostraSoloOrigine =
    tipoNuovo === 'gol_subito' || tipoNuovo === 'tiro_subito'
  const mostraSchemaNuovo =
    tipoNuovo === 'inattiva' || (mostraOrigine && origineRichiedeSchema(origineNuova))
  /** Il tipo di palla inattiva a cui appartengono gli schemi da mostrare. */
  const tipoSchemaNuovo: TipoInattiva | null =
    tipoNuovo === 'inattiva'
      ? situazioneNuova
      : origineComeInattiva(origineNuova)
  const mostraBattutaNuova = mostraOrigine && origineRichiedeBattuta(origineNuova)

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
              const modificabile = eventoModificabile(e)
              return (
                <li
                  key={e.id}
                  className="bg-slate-800/50 rounded px-3 py-2 flex items-center gap-2"
                >
                  <span className="text-slate-500 font-mono shrink-0">
                    T{e.tempoGioco} • {e.minuto}'
                  </span>
                  <span className="flex-1">{descriviEvento(e, rosa, schemi)}</span>
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

          {mostraZona && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                {tipoNuovo === 'gol_subito' || tipoNuovo === 'tiro_subito'
                  ? 'Zona da cui hanno concluso'
                  : 'Zona di tiro'}{' '}
                {zonaObbligatoria ? '' : '(opzionale)'}
              </label>
              <SelectZona
                value={zonaNuova}
                onChange={setZonaNuova}
                opzionale={!zonaObbligatoria}
              />
            </div>
          )}

          {mostraSoloOrigine && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={origineNuova === 'contropiede'}
                onChange={(e) =>
                  setOrigineNuova(e.target.checked ? 'contropiede' : 'azione')
                }
                className="w-4 h-4"
              />
              🏃 Su contropiede
            </label>
          )}

          {mostraOrigine && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Come nasce
              </label>
              <select
                value={origineNuova}
                onChange={(e) => setOrigineNuova(e.target.value as OrigineTiro)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
              >
                {ORIGINI_TIRO.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.icona} {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {mostraBattutaNuova && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Battuta da (opzionale)
              </label>
              <SelectZona
                value={battutaNuova}
                onChange={setBattutaNuova}
                opzionale
                soloCampo
              />
            </div>
          )}

          {tipoNuovo === 'inattiva' && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Situazione</label>
              <select
                value={situazioneNuova}
                onChange={(e) => {
                  setSituazioneNuova(e.target.value as TipoInattiva)
                  setSchemaNuovo('')
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
              >
                {TIPI_INATTIVA.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.icona} {t.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {mostraSchemaNuovo && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Schema</label>
              <SelectSchema
                value={schemaNuovo}
                onChange={setSchemaNuovo}
                schemi={schemi}
                tipo={tipoSchemaNuovo}
              />
              {tipoSchemaNuovo !== null &&
                schemi.filter((s) => s.tipo === tipoSchemaNuovo).length === 0 && (
                  <p className="text-xs text-slate-500 mt-1">
                    Nessuno schema definito per questa situazione.
                  </p>
                )}
            </div>
          )}

          {(tipoNuovo === 'tiro' || tipoNuovo === 'tiro_subito') && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Esito</label>
              <select
                value={esitoNuovo}
                onChange={(e) => setEsitoNuovo(e.target.value as EsitoTiro)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
              >
                {ESITI_TIRO.map((es) => (
                  <option key={es.value} value={es.value}>
                    {es.label}
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
              disabled={
                (richiedeGiocatore && marcatoreNuovo === '') ||
                (zonaObbligatoria && zonaNuova === '')
              }
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
            >
              Aggiungi
            </button>
          </div>
        </div>
      </Modal>

      {/* ===== MODAL: modifica evento esistente ===== */}
      <Modal
        open={eventoInModifica !== null}
        onClose={() => setEventoInModifica(null)}
        title={
          eventoInModifica?.tipo === 'gol_fatto'
            ? 'Modifica gol'
            : eventoInModifica?.tipo === 'tiro'
            ? 'Modifica tiro'
            : eventoInModifica?.tipo === 'gol_subito'
            ? 'Modifica gol subito'
            : eventoInModifica?.tipo === 'tiro_subito'
            ? 'Modifica tiro loro'
            : eventoInModifica?.tipo === 'inattiva'
            ? 'Modifica palla inattiva'
            : 'Modifica autogol'
        }
      >
        <div className="flex flex-col gap-3">
          {editHaGiocatore && (
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
          )}

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

          {editHaZona && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                {tipoInModifica === 'gol_subito' || tipoInModifica === 'tiro_subito'
                  ? 'Zona da cui hanno concluso'
                  : 'Zona di tiro'}{' '}
                {editZonaOpzionale ? '(opzionale)' : ''}
              </label>
              <SelectZona
                value={editZona}
                onChange={setEditZona}
                opzionale={editZonaOpzionale}
              />
            </div>
          )}

          {editHaEsito && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Esito</label>
              <select
                value={editEsito}
                onChange={(e) => setEditEsito(e.target.value as EsitoTiro)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
              >
                {ESITI_TIRO.map((es) => (
                  <option key={es.value} value={es.value}>
                    {es.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {editHaSoloOrigine && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={editOrigine === 'contropiede'}
                onChange={(e) =>
                  setEditOrigine(e.target.checked ? 'contropiede' : 'azione')
                }
                className="w-4 h-4"
              />
              🏃 Su contropiede
            </label>
          )}

          {editHaOrigine && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Come nasce
              </label>
              <select
                value={editOrigine}
                onChange={(e) => setEditOrigine(e.target.value as OrigineTiro)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
              >
                {ORIGINI_TIRO.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.icona} {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {editHaOrigine && (
            <>
              {origineRichiedeBattuta(editOrigine) && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    Battuta da (opzionale)
                  </label>
                  <SelectZona
                    value={editBattuta}
                    onChange={setEditBattuta}
                    opzionale
                    soloCampo
                  />
                </div>
              )}
            </>
          )}

          {(eventoInModifica?.tipo === 'inattiva' ||
            (editHaOrigine && origineRichiedeSchema(editOrigine))) && (
            <div className="flex flex-col gap-3">
              {eventoInModifica?.tipo === 'inattiva' && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    Situazione
                  </label>
                  <select
                    value={editSituazione}
                    onChange={(e) => {
                      setEditSituazione(e.target.value as TipoInattiva)
                      setEditSchema('')
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
                  >
                    {TIPI_INATTIVA.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.icona} {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Schema</label>
                <SelectSchema
                  value={editSchema}
                  onChange={setEditSchema}
                  schemi={schemi}
                  tipo={
                    eventoInModifica?.tipo === 'inattiva'
                      ? editSituazione
                      : origineComeInattiva(editOrigine)
                  }
                />
              </div>
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
              disabled={
                (editHaGiocatore && editMarcatore === '') ||
                (editHaEsito && editZona === '')
              }
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