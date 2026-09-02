import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import Modal from '../components/Modal'
import { ruoloShort, ordineRuolo } from '../db/ruoli'
import {
  adesso as oraCorrente,
  secondiTrascorsi,
  formatCronometro,
  minutoCorrente,
} from '../utils/cronometro'
import type { Fronte } from '../db/zone'
import type {
  Evento,
  EsitoTiro,
  Giocatore,
  OrigineTiro,
  Partita as PartitaType,
  Schema,
  SquadraAvversaria,
  TipoInattiva,
  ZonaTiro,
} from '../db/schema'
import { nomeSquadra } from '../utils/stagione'
import { nomeCompleto, nomeCorto } from '../utils/giocatore'
import { formatDataOra } from '../utils/format'
import TagBadge from '../components/TagBadge'
import TagSelector from '../components/TagSelector'
import { descriviEvento } from '../utils/evento'
import CampoTiri from '../components/CampoTiri'
import {
  conteggiPerZona,
  contaInattive,
  contaTiri,
  contaTiriConZona,
  risultatoPartita,
} from '../utils/statistiche'
import {
  ESITI_TIRO,
  ORIGINI_TIRO,
  TIPI_INATTIVA,
  formatXG,
  inattivaIcona,
  inattivaLabel,
  origineLabel,
  origineRichiedeBattuta,
  origineRichiedeSchema,
  pesoZona,
  xgTotale,
  zonaLabel,
} from '../db/zone'

/** Passi del flusso di registrazione di una conclusione. */
type PassoTiro = 'giocatore' | 'origine' | 'battuta' | 'schema' | 'zona' | 'esito' | 'assist'

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

  if (!partita || !stagione || !avversario || !rosa) {
    return <div className="p-6">Caricamento...</div>
  }

  // Routing interno in base allo stato
  if (partita.stato === 'da_giocare') {
    return (
      <PreMatch
        partita={partita}
        rosa={rosa}
        avversari={avversari ?? []}
        stagioneId={stagione.id!}
        soloLettura={stagione.soloLettura === true}
      />
    )
  }

  return (
    <Live
      partita={partita}
      rosa={rosa}
      eventi={eventi ?? []}
      schemi={schemi ?? []}
      avversarioNome={avversario.nome}
      squadraNome={nomeSquadra(stagione)}
      stagioneId={stagione.id!}
      soloLettura={stagione.soloLettura === true}
    />
  )
}

// ===========================================================================
// PRE-MATCH: impostazioni, convocati, titolari, e poi il via
// ===========================================================================

function PreMatch({
  partita,
  rosa,
  avversari,
  stagioneId,
  soloLettura,
}: {
  partita: PartitaType
  rosa: Giocatore[]
  avversari: SquadraAvversaria[]
  stagioneId: number
  soloLettura: boolean
}) {
  const [showInizio, setShowInizio] = useState(false)
  // I due campi numerici hanno stato locale: salvarli a ogni tasto premuto
  // renderebbe impossibile svuotare la casella per riscrivere il numero.
  const [tempiBozza, setTempiBozza] = useState(String(partita.config.numeroTempi))
  const [durataBozza, setDurataBozza] = useState(
    String(partita.config.durataTempoMinuti)
  )

  // Il tetto dei 12 convocati è una regola di gara: in amichevole non ha
  // senso, ci si porta chi c'è. null = nessun limite.
  const maxConvocati: number | null = partita.tag === 'Amichevole' ? null : 12
  const MAX_TITOLARI = 5 // calcio a 5

  const convocati = new Set(partita.convocati)
  const titolari = new Set(partita.titolari)

  // Tutto si salva subito: si torna su questa schermata più volte mentre
  // la squadra arriva, e non deve esserci niente da ricordarsi di confermare.
  // Ogni modifica rilegge il record dentro la transazione invece di partire
  // dalla copia in mano al componente: due interventi ravvicinati (esco da un
  // campo numerico e nello stesso istante spunto una casella) altrimenti si
  // sovrascrivono a vicenda.
  async function modifica(cambia: (p: PartitaType) => void) {
    await db.partite.where('id').equals(partita.id!).modify(cambia)
  }

  async function aggiorna(campi: Partial<PartitaType>) {
    await modifica((p) => {
      Object.assign(p, campi)
    })
  }

  async function aggiornaConfig(campi: Partial<PartitaType['config']>) {
    await modifica((p) => {
      p.config = { ...p.config, ...campi }
    })
  }

  async function toggleConvocato(id: number) {
    await modifica((p) => {
      const conv = new Set(p.convocati)
      const tit = new Set(p.titolari)
      if (conv.has(id)) {
        conv.delete(id)
        tit.delete(id) // se era titolare non può restarlo
      } else {
        if (maxConvocati !== null && conv.size >= maxConvocati) return
        conv.add(id)
      }
      p.convocati = Array.from(conv)
      p.titolari = Array.from(tit)
    })
  }

  async function toggleTitolare(id: number) {
    await modifica((p) => {
      if (!p.convocati.includes(id)) return
      const tit = new Set(p.titolari)
      if (tit.has(id)) tit.delete(id)
      else {
        if (tit.size >= MAX_TITOLARI) return
        tit.add(id)
      }
      p.titolari = Array.from(tit)
    })
  }

  async function iniziaPartita() {
    const adesso = oraCorrente()
    await modifica((p) => {
      // L'orario che avevi messo era una previsione: il via è adesso.
      p.dataOra = adesso
      p.inCampo = [...p.titolari]
      p.stato = 'in_corso'
      p.cronometro = {
        tempoCorrente: 1,
        inizioTempoTimestamp: adesso,
        secondiAccumulati: 0,
        inPausa: false,
      }
    })
    await db.eventi.add({
      partitaId: partita.id!,
      minuto: 0,
      tempoGioco: 1,
      tipo: 'inizio_tempo',
      tempo: 1,
    })
    setShowInizio(false)
  }

  const rosaOrdinata = [...rosa].sort(
    (a, b) => ordineRuolo(a.ruolo) - ordineRuolo(b.ruolo)
  )
  const avversarioNome =
    avversari.find((a) => a.id === partita.avversarioId)?.nome ?? '???'
  const prontaAlVia = titolari.size === MAX_TITOLARI

  // datetime-local vuole "YYYY-MM-DDTHH:mm" in ora locale
  const dataInputValue = new Date(
    partita.dataOra - new Date().getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 16)

  const formato = (
    <>
      {partita.config.numeroTempi} tempi da {partita.config.durataTempoMinuti}′ ·
      tempo effettivo {partita.config.tempoEffettivo ? 'acceso' : 'spento'}
    </>
  )

  // Stagione condivisa: della preparazione si legge solo il risultato.
  if (soloLettura) {
    const nomiConvocati = rosaOrdinata.filter((g) => convocati.has(g.id!))
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Link to={`/stagione/${stagioneId}`} className="text-sm text-slate-400">
          ← Stagione
        </Link>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <h1 className="text-2xl font-bold">vs {avversarioNome}</h1>
          <TagBadge tag={partita.tag} />
        </div>
        <p className="text-sm text-slate-400 mb-6">
          Non ancora iniziata · {formatDataOra(partita.dataOra)} · {formato}
        </p>

        <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2">
          Convocati ({nomiConvocati.length})
        </h2>
        {nomiConvocati.length === 0 ? (
          <p className="text-slate-500 italic text-sm">
            Nessun convocato ancora scelto.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {nomiConvocati.map((g) => (
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
                <span className="text-xs text-slate-500">
                  {ruoloShort(g.ruolo)}
                </span>
                {titolari.has(g.id!) && (
                  <span className="text-xs bg-emerald-600 px-2 py-0.5 rounded">
                    Titolare
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 pb-32">
      <Link to={`/stagione/${stagioneId}`} className="text-sm text-slate-400">
        ← Stagione
      </Link>
      <div className="flex items-center gap-2 flex-wrap mt-1">
        <h1 className="text-2xl font-bold">vs {avversarioNome}</h1>
        <TagBadge tag={partita.tag} />
      </div>
      <p className="text-sm text-slate-400 mb-6">Preparazione · {formato}</p>

      {/* ===== 1. Impostazioni ===== */}
      <section className="bg-slate-800 rounded-xl p-4 mb-6 flex flex-col gap-3">
        <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold">
          Impostazioni
        </h2>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Avversario</label>
          <select
            value={partita.avversarioId}
            onChange={(e) => aggiorna({ avversarioId: Number(e.target.value) })}
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
          <label className="block text-sm text-slate-400 mb-1">
            Data e ora prevista
          </label>
          <input
            type="datetime-local"
            value={dataInputValue}
            onChange={(e) => {
              const t = new Date(e.target.value).getTime()
              if (!Number.isNaN(t)) aggiorna({ dataOra: t })
            }}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
          />
          <p className="text-xs text-slate-500 mt-1">
            È solo la previsione per il calendario. Quando premi «Inizia
            partita» viene sostituita con l'ora vera del fischio d'inizio.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1">N° tempi</label>
            <input
              type="number"
              min="1"
              max="4"
              value={tempiBozza}
              onChange={(e) => setTempiBozza(e.target.value)}
              onBlur={() => {
                const n = Number(tempiBozza)
                if (Number.isInteger(n) && n >= 1 && n <= 4) {
                  aggiornaConfig({ numeroTempi: n })
                } else {
                  setTempiBozza(String(partita.config.numeroTempi))
                }
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Durata tempo (min)
            </label>
            <input
              type="number"
              min="1"
              max="90"
              value={durataBozza}
              onChange={(e) => setDurataBozza(e.target.value)}
              onBlur={() => {
                const n = Number(durataBozza)
                if (Number.isInteger(n) && n >= 1 && n <= 90) {
                  aggiornaConfig({ durataTempoMinuti: n })
                } else {
                  setDurataBozza(String(partita.config.durataTempoMinuti))
                }
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={partita.config.tempoEffettivo}
            onChange={(e) => aggiornaConfig({ tempoEffettivo: e.target.checked })}
            className="w-4 h-4"
          />
          Tempo effettivo (cronometro fermo quando la palla esce)
        </label>

        <div>
          <label className="block text-sm text-slate-400 mb-2">Tipo partita</label>
          <TagSelector
            value={partita.tag}
            onChange={(tag) => aggiorna({ tag })}
          />
        </div>
      </section>

      {/* ===== 2. Convocati ===== */}
      <section className="mb-6">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold">
            Convocati
          </h2>
          <span className="text-sm">
            <span className="font-bold">{convocati.size}</span>
            {maxConvocati !== null ? (
              <span className="text-slate-400">/{maxConvocati}</span>
            ) : (
              <span className="text-slate-500"> · nessun limite in amichevole</span>
            )}
          </span>
        </div>

        {rosa.length === 0 ? (
          <p className="text-slate-400 italic text-sm">
            Nessun giocatore in rosa.{' '}
            <Link
              to={`/setup-stagione/${stagioneId}`}
              className="text-emerald-400 underline"
            >
              Aggiungi giocatori
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rosaOrdinata.map((g) => {
              const isConv = convocati.has(g.id!)
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
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{nomeCompleto(g)}</div>
                    <div className="text-xs text-slate-400">
                      {ruoloShort(g.ruolo)}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ===== 3. Titolari ===== */}
      <section className="mb-6">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold">
            Titolari
          </h2>
          <span className="text-sm">
            <span className={`font-bold ${prontaAlVia ? 'text-emerald-400' : ''}`}>
              {titolari.size}
            </span>
            <span className="text-slate-400">/{MAX_TITOLARI}</span>
          </span>
        </div>

        {convocati.size === 0 ? (
          <p className="text-slate-500 italic text-sm">
            Scegli prima i convocati, poi qui decidi chi parte in campo.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rosaOrdinata
              .filter((g) => convocati.has(g.id!))
              .map((g) => {
                const isTit = titolari.has(g.id!)
                return (
                  <li
                    key={g.id}
                    className="bg-slate-800 rounded-lg px-4 py-2.5 flex items-center gap-3"
                  >
                    {g.numero !== undefined && (
                      <span className="bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">
                        {g.numero}
                      </span>
                    )}
                    <span className="flex-1 min-w-0">{nomeCorto(g)}</span>
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
                  </li>
                )
              })}
          </ul>
        )}
      </section>

      {/* ===== 4. Il via ===== */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-700 p-4">
        <div className="max-w-2xl mx-auto">
          {!prontaAlVia && (
            <p className="text-xs text-amber-400/90 mb-2 text-center">
              Servono esattamente {MAX_TITOLARI} titolari per iniziare (ne hai{' '}
              {titolari.size}).
            </p>
          )}
          <button
            onClick={() => setShowInizio(true)}
            disabled={!prontaAlVia}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed py-4 rounded-lg font-bold text-lg"
          >
            Inizia partita →
          </button>
          <p className="text-xs text-slate-500 mt-2 text-center">
            Tutto si salva da solo: puoi uscire e tornare quando vuoi.
          </p>
        </div>
      </div>

      {/* ===== MODAL: conferma del via ===== */}
      <Modal
        open={showInizio}
        onClose={() => setShowInizio(false)}
        title="Si comincia?"
      >
        <p className="text-slate-300 text-sm mb-4">
          Il cronometro parte adesso e la data della partita viene fissata a
          questo momento. Da qui in poi registri gol, tiri e palle inattive.
        </p>
        <ul className="text-sm text-slate-400 mb-4 flex flex-col gap-1">
          <li>
            Avversario: <span className="text-slate-200">{avversarioNome}</span>
          </li>
          <li>
            Formato:{' '}
            <span className="text-slate-200">
              {partita.config.numeroTempi} × {partita.config.durataTempoMinuti}′
            </span>
            , tempo effettivo{' '}
            {partita.config.tempoEffettivo ? 'acceso' : 'spento'}
          </li>
          <li>
            Convocati: <span className="text-slate-200">{convocati.size}</span>,
            di cui {titolari.size} in campo
          </li>
        </ul>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setShowInizio(false)}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600"
          >
            Non ancora
          </button>
          <button
            onClick={iniziaPartita}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold"
          >
            Via!
          </button>
        </div>
      </Modal>
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
  schemi,
  avversarioNome,
  squadraNome,
  stagioneId,
  soloLettura,
}: {
  partita: PartitaType
  rosa: Giocatore[]
  eventi: Evento[]
  schemi: Schema[]
  avversarioNome: string
  squadraNome: string
  stagioneId: number
  /** Stagione condivisa da altri: si guarda e basta. */
  soloLettura: boolean
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
  const tempoGioco = partita.cronometro.tempoCorrente ?? 1
  // Durata prevista del tempo corrente in secondi
  const durataTempoSecondi = partita.config.durataTempoMinuti * 60
  const sforato = secondi > durataTempoSecondi
  const quasiFinito = !sforato && secondi > durataTempoSecondi - 60 // ultimo minuto
  const inCampo = rosa
    .filter((g) => partita.inCampo.includes(g.id!))
    .sort((a, b) => ordineRuolo(a.ruolo) - ordineRuolo(b.ruolo))
  const panchina = rosa
    .filter(
      (g) => partita.convocati.includes(g.id!) && !partita.inCampo.includes(g.id!)
    )
    .sort((a, b) => ordineRuolo(a.ruolo) - ordineRuolo(b.ruolo))

  // Risultato calcolato dagli eventi
  // Gol nostri = gol_fatto + autogol_pro (avversario in proprio)
  // Gol loro = gol_subito + autogol_contro (nostro in proprio)
  const { fatti: golFatti, subiti: golSubiti } = risultatoPartita(eventi)

  // ----- STATE: modali -----
  const [showGolSubito, setShowGolSubito] = useState(false)
  const [showAutogolContro, setShowAutogolContro] = useState(false)
  const [showCambio, setShowCambio] = useState(false)
  const [esceId, setEsceId] = useState<number | null>(null)
  const [showFineTempo, setShowFineTempo] = useState(false)
  const [showFinePartita, setShowFinePartita] = useState(false)

  // ----- STATE: registrazione conclusione -----
  // Un solo flusso per tiri e gol:
  // giocatore → origine → [battuta | schema] → zona → esito → [assist]
  const [showTiro, setShowTiro] = useState(false)
  const [passo, setPasso] = useState<PassoTiro>('giocatore')
  const [tiroGiocatoreId, setTiroGiocatoreId] = useState<number | null>(null)
  const [tiroOrigine, setTiroOrigine] = useState<OrigineTiro>('azione')
  const [tiroBattuta, setTiroBattuta] = useState<ZonaTiro | null>(null)
  const [tiroSchemaId, setTiroSchemaId] = useState<number | null>(null)
  const [tiroZona, setTiroZona] = useState<ZonaTiro | null>(null)
  // true quando il flusso arriva dal bottone Corner: origine e schema già decisi
  const [origineFissata, setOrigineFissata] = useState(false)

  // ----- STATE: conclusione subita -----
  // Stesso principio del flusso nostro, ma senza giocatore: degli avversari
  // ci interessa solo da dove hanno concluso e com'è finita.
  const [passoSubito, setPassoSubito] = useState<'zona' | 'esito'>('zona')
  const [subitoZona, setSubitoZona] = useState<ZonaTiro | null>(null)

  // ----- STATE: palla inattiva battuta -----
  const [showInattiva, setShowInattiva] = useState(false)
  const [passoInattiva, setPassoInattiva] = useState<'tipo' | 'schema' | 'esito'>('tipo')
  const [inattivaTipo, setInattivaTipo] = useState<TipoInattiva>('corner')
  const [inattivaSchemaId, setInattivaSchemaId] = useState<number | null>(null)

  const [showMappa, setShowMappa] = useState(false)
  const [fronteMappa, setFronteMappa] = useState<Fronte>('nostro')

  // ----- Tiri e xG della partita -----
  const conteggiZone = conteggiPerZona(eventi)
  const xgPartita = xgTotale(eventi)
  const tiriNostri = contaTiri(eventi, 'nostro')
  const tiriLoro = contaTiri(eventi, 'loro')
  const tiriConZona = eventi.filter(
    (e) => e.tipo === 'tiro' || (e.tipo === 'gol_fatto' && e.zona !== undefined)
  ).length
  const inattiveBattute = contaInattive(eventi)
  /** Gli schemi disponibili per una certa situazione. */
  const schemiPerTipo = (t: TipoInattiva) => schemi.filter((s) => s.tipo === t)
  /**
   * Gli schemi da proporre nel flusso della conclusione: solo quelli della
   * situazione scelta, non tutti quelli della stagione.
   */
  const schemiTiro = origineRichiedeSchema(tiroOrigine)
    ? schemiPerTipo(tiroOrigine as TipoInattiva)
    : []

  // ----- Conclusioni subite e xGA -----
  const conteggiZoneSubiti = conteggiPerZona(eventi, 'loro')
  const xgaPartita = xgTotale(eventi, 'loro')
  const tiriSubitiConZona = contaTiriConZona(eventi, 'loro')

  // ----- AZIONI -----

  // ----- CONCLUSIONE SUBITA: zona → esito -----

  function apriSubito() {
    setSubitoZona(null)
    setPassoSubito('zona')
    setShowGolSubito(true)
  }

  function chiudiSubito() {
    setShowGolSubito(false)
    setSubitoZona(null)
    setPassoSubito('zona')
  }

  function scegliZonaSubito(z: ZonaTiro) {
    setSubitoZona(z)
    setPassoSubito('esito')
  }

  async function segnaGolSubito() {
    await db.eventi.add({
      partitaId: partita.id!,
      minuto,
      tempoGioco,
      tipo: 'gol_subito',
      zona: subitoZona ?? undefined,
    })
    chiudiSubito()
  }

  async function registraTiroSubito(esito: EsitoTiro) {
    // Senza zona non c'è xGA da calcolare: un tiro loro che non so
    // localizzare non aggiunge niente, quindi non lo registro.
    if (subitoZona === null) return
    await db.eventi.add({
      partitaId: partita.id!,
      minuto,
      tempoGioco,
      tipo: 'tiro_subito',
      zona: subitoZona,
      esito,
    })
    chiudiSubito()
  }

  function apriAutogolContro() {
    chiudiSubito()
    setShowAutogolContro(true)
  }

  async function segnaAutogolContro(giocatoreId: number) {
    await db.eventi.add({
      partitaId: partita.id!,
      minuto,
      tempoGioco,
      tipo: 'autogol_contro',
      giocatoreId,
    })
    setShowAutogolContro(false)
  }

  // Autogol pro = avversario fa autogol → gol per noi senza marcatore nostro
  async function segnaAutogolPro() {
    await db.eventi.add({
      partitaId: partita.id!,
      minuto,
      tempoGioco,
      tipo: 'autogol_pro',
    })
  }

  // ----- CONCLUSIONE: flusso unico per tiri e gol -----

  function apriTiro(preset?: { origine: OrigineTiro; schemaId: number | null }) {
    setTiroGiocatoreId(null)
    setTiroZona(null)
    setTiroBattuta(null)
    setTiroOrigine(preset?.origine ?? 'azione')
    setTiroSchemaId(preset?.schemaId ?? null)
    setOrigineFissata(preset !== undefined)
    setPasso('giocatore')
    setShowTiro(true)
  }

  function chiudiTiro() {
    setShowTiro(false)
    setTiroGiocatoreId(null)
    setTiroZona(null)
    setTiroBattuta(null)
    setTiroSchemaId(null)
    setTiroOrigine('azione')
    setOrigineFissata(false)
    setPasso('giocatore')
  }

  function scegliTiratore(giocatoreId: number) {
    setTiroGiocatoreId(giocatoreId)
    if (!origineFissata) {
      setPasso('origine')
      return
    }
    // Il flusso arriva dalla palla inattiva: origine e schema sono già decisi,
    // ma punizione e rimessa vogliono ancora il punto di battuta.
    setPasso(origineRichiedeBattuta(tiroOrigine) ? 'battuta' : 'zona')
  }

  function scegliOrigine(o: OrigineTiro) {
    setTiroOrigine(o)
    setTiroBattuta(null)
    setTiroSchemaId(null)
    if (origineRichiedeBattuta(o)) setPasso('battuta')
    else if (origineRichiedeSchema(o) && schemiPerTipo(o as TipoInattiva).length > 0)
      setPasso('schema')
    else setPasso('zona')
  }

  function scegliBattuta(z: ZonaTiro) {
    setTiroBattuta(z)
    const chiediSchema =
      !origineFissata &&
      origineRichiedeSchema(tiroOrigine) &&
      schemiPerTipo(tiroOrigine as TipoInattiva).length > 0
    setPasso(chiediSchema ? 'schema' : 'zona')
  }

  function scegliSchema(schemaId: number | null) {
    setTiroSchemaId(schemaId)
    setPasso('zona')
  }

  function scegliZonaTiro(z: ZonaTiro) {
    setTiroZona(z)
    setPasso('esito')
  }

  /** Torna al passo precedente, saltando quelli che questa origine non usa. */
  function indietro() {
    switch (passo) {
      case 'origine':
        setPasso('giocatore')
        break
      case 'battuta':
        setPasso(origineFissata ? 'giocatore' : 'origine')
        break
      case 'schema':
        setPasso(origineRichiedeBattuta(tiroOrigine) ? 'battuta' : 'origine')
        break
      case 'zona':
        if (origineRichiedeSchema(tiroOrigine) && !origineFissata) setPasso('schema')
        else if (origineRichiedeBattuta(tiroOrigine)) setPasso('battuta')
        else setPasso(origineFissata ? 'giocatore' : 'origine')
        break
      case 'esito':
        setPasso('zona')
        break
      case 'assist':
        setPasso('esito')
        break
      default:
        break
    }
  }

  /** I campi che descrivono come è nata la conclusione, comuni a tiro e gol. */
  function datiOrigine() {
    return {
      origine: tiroOrigine,
      zonaBattuta: tiroBattuta ?? undefined,
      schemaId: tiroSchemaId ?? undefined,
    }
  }

  /**
   * Se la conclusione nasce da una palla inattiva scelta dentro questo flusso
   * (e non arriva dal bottone dedicato, che l'ha già registrata), salva anche
   * l'evento della battuta: così il conteggio delle battute resta completo.
   */
  async function registraBattutaImplicita() {
    if (origineFissata || tiroOrigine === 'azione') return
    await db.eventi.add({
      partitaId: partita.id!,
      minuto,
      tempoGioco,
      tipo: 'inattiva',
      situazione: tiroOrigine,
      schemaId: tiroSchemaId ?? undefined,
    })
  }

  async function registraTiroNonGol(esito: EsitoTiro) {
    if (tiroGiocatoreId === null || tiroZona === null) return
    await registraBattutaImplicita()
    await db.eventi.add({
      partitaId: partita.id!,
      minuto,
      tempoGioco,
      ...datiOrigine(),
      tipo: 'tiro',
      giocatoreId: tiroGiocatoreId,
      zona: tiroZona,
      esito,
    })
    chiudiTiro()
  }

  async function registraTiroGol(assistId: number | null) {
    if (tiroGiocatoreId === null) return
    await registraBattutaImplicita()
    await db.eventi.add({
      partitaId: partita.id!,
      minuto,
      tempoGioco,
      ...datiOrigine(),
      tipo: 'gol_fatto',
      giocatoreId: tiroGiocatoreId,
      assistId: assistId ?? undefined,
      zona: tiroZona ?? undefined,
    })
    chiudiTiro()
  }

  const tiratore = rosa.find((g) => g.id === tiroGiocatoreId)

  const TITOLI_PASSO: Record<PassoTiro, string> = {
    giocatore: 'Chi ha tirato?',
    origine: 'Come nasce?',
    battuta: 'Da dove è stata battuta?',
    schema: 'Che schema?',
    zona: 'Da dove ha tirato?',
    esito: "Com'è finita?",
    assist: 'Assist?',
  }
  const titoloPassoTiro = TITOLI_PASSO[passo]

  // ----- PALLA INATTIVA BATTUTA -----

  function apriInattiva() {
    setInattivaSchemaId(null)
    setInattivaTipo('corner')
    setPassoInattiva('tipo')
    setShowInattiva(true)
  }

  function chiudiInattiva() {
    setShowInattiva(false)
    setInattivaSchemaId(null)
    setPassoInattiva('tipo')
  }

  function scegliTipoInattiva(t: TipoInattiva) {
    setInattivaTipo(t)
    setInattivaSchemaId(null)
    // se per questa situazione non ci sono schemi, salta direttamente all'esito
    setPassoInattiva(schemiPerTipo(t).length > 0 ? 'schema' : 'esito')
  }

  /**
   * Salva la palla inattiva battuta. Se ha prodotto una conclusione, prosegue
   * nel flusso del tiro con origine e schema già impostati.
   */
  async function salvaInattiva(conTiro: boolean) {
    const schemaId = inattivaSchemaId
    const situazione = inattivaTipo
    await db.eventi.add({
      partitaId: partita.id!,
      minuto,
      tempoGioco,
      tipo: 'inattiva',
      situazione,
      schemaId: schemaId ?? undefined,
    })
    chiudiInattiva()
    if (conTiro) apriTiro({ origine: situazione, schemaId })
  }

  async function eseguiCambio(entraId: number) {
    if (esceId === null) return
    await db.eventi.add({
      partitaId: partita.id!,
      minuto,
      tempoGioco,
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
      // riprendi (sia che sia una semplice ripresa, sia che sia inizio di un nuovo tempo)
      const inizioNuovoTempo = partita.cronometro.secondiAccumulati === 0
      const adesso = oraCorrente()
      await db.partite.update(partita.id!, {
        cronometro: {
          ...partita.cronometro,
          inizioTempoTimestamp: adesso,
          inPausa: false,
        },
      })
      // se è inizio di un nuovo tempo, registralo come evento
      if (inizioNuovoTempo && partita.cronometro.tempoCorrente !== null) {
        await db.eventi.add({
          partitaId: partita.id!,
          minuto: 0,
          tempoGioco: partita.cronometro.tempoCorrente,
          tipo: 'inizio_tempo',
          tempo: partita.cronometro.tempoCorrente,
        })
      }
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
      tempoGioco: tempoFinito,
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
      // pausa tra i tempi: cronometro azzerato, pronto a ripartire da 0
      await db.partite.update(partita.id!, {
        cronometro: {
          tempoCorrente: tempoFinito + 1,
          inizioTempoTimestamp: null,
          secondiAccumulati: 0,
          inPausa: true,
        },
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

      {partita.tag && (
        <div className="mt-2">
          <TagBadge tag={partita.tag} />
        </div>
      )}

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
            <div
              className={`font-mono text-2xl font-bold ${
                sforato
                  ? 'text-red-400 animate-pulse'
                  : quasiFinito
                  ? 'text-amber-400'
                  : ''
              }`}
            >
              {formatCronometro(secondi)}
            </div>
            <div className="text-xs text-slate-400">
              {finita
                ? 'Finita'
                : partita.cronometro.inPausa &&
                  partita.cronometro.secondiAccumulati === 0 &&
                  (partita.cronometro.tempoCorrente ?? 1) > 1
                ? `Intervallo → ${partita.cronometro.tempoCorrente}° tempo`
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

        {/* Riepilogo conclusioni: una riga per fronte */}
        {(tiriNostri.totali > 0 || tiriLoro.totali > 0 || inattiveBattute > 0) && (
          <div className="mt-3 pt-3 border-t border-slate-700/60 flex flex-col gap-1 text-xs text-slate-400">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className="text-slate-500 w-10 text-right">Noi</span>
              <span>
                Tiri <span className="font-semibold text-slate-200">{tiriNostri.totali}</span>
              </span>
              <span className="text-slate-600">•</span>
              <span>
                in porta{' '}
                <span className="font-semibold text-slate-200">{tiriNostri.inPorta}</span>
              </span>
              <span className="text-slate-600">•</span>
              <span>
                xG{' '}
                <span className="font-semibold text-emerald-400 tabular-nums">
                  {formatXG(xgPartita)}
                </span>
              </span>
            </div>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className="text-slate-500 w-10 text-right">Loro</span>
              <span>
                Tiri <span className="font-semibold text-slate-200">{tiriLoro.totali}</span>
              </span>
              <span className="text-slate-600">•</span>
              <span>
                in porta{' '}
                <span className="font-semibold text-slate-200">{tiriLoro.inPorta}</span>
              </span>
              <span className="text-slate-600">•</span>
              <span>
                xGA{' '}
                <span className="font-semibold text-red-400 tabular-nums">
                  {formatXG(xgaPartita)}
                </span>
              </span>
            </div>
            {(inattiveBattute > 0 || tiriConZona < tiriNostri.totali) && (
              <div className="flex items-center justify-center gap-2 flex-wrap pt-0.5">
                {inattiveBattute > 0 && (
                  <span>
                    Inattive{' '}
                    <span className="font-semibold text-slate-200">
                      {inattiveBattute}
                    </span>
                  </span>
                )}
                {inattiveBattute > 0 && tiriConZona < tiriNostri.totali && (
                  <span className="text-slate-600">•</span>
                )}
                {tiriConZona < tiriNostri.totali && (
                  <span className="text-amber-400/80">
                    {tiriNostri.totali - tiriConZona} senza zona
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {!finita && (
        <>
          {!soloLettura && (
            <>
            {/* Bottoni cronometro */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={pausaRiprendi}
                className="bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-semibold"
              >
                {partita.cronometro.inPausa
                  ? partita.cronometro.secondiAccumulati === 0 &&
                    partita.cronometro.tempoCorrente !== null &&
                    partita.cronometro.tempoCorrente > 1
                    ? `▶ Inizio ${partita.cronometro.tempoCorrente}° tempo`
                    : '▶ Riprendi'
                  : '⏸ Pausa'}
              </button>
              <button
                onClick={() => setShowFineTempo(true)}
                className="bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-semibold"
              >
                Fine tempo
              </button>
            </div>

            {/* Conclusioni */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                onClick={() => apriTiro()}
                className="bg-emerald-600 hover:bg-emerald-500 py-4 rounded-lg font-bold text-lg"
              >
                🎯 Tiro / Gol
              </button>
              <button
                onClick={apriSubito}
                className="bg-red-600 hover:bg-red-500 py-4 rounded-lg font-bold text-lg"
              >
                🥅 Tiro / Gol loro
              </button>
            </div>

            <button
              onClick={apriInattiva}
              className="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-semibold mb-4"
            >
              🚩 Palla inattiva
            </button>

            {/* Banner intervallo */}
            {partita.cronometro.inPausa &&
              partita.cronometro.secondiAccumulati === 0 &&
              (partita.cronometro.tempoCorrente ?? 1) > 1 && (
                <div className="bg-amber-900/40 border border-amber-700/60 rounded-lg p-3 mb-4 text-sm">
                  <p className="font-semibold text-amber-200">
                    🕐 Intervallo prima del {partita.cronometro.tempoCorrente}° tempo
                  </p>
                  <p className="text-amber-200/80 text-xs mt-1">
                    Puoi fare cambi ora. Premi "Inizio {partita.cronometro.tempoCorrente}° tempo" quando pronto.
                  </p>
                </div>
              )}
            </>
          )}

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
                {!soloLettura && (
                  <button
                    onClick={() => {
                      setEsceId(g.id!)
                      setShowCambio(true)
                    }}
                    className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded"
                  >
                    Cambia
                  </button>
                )}
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

          {/* Bottoni gestione partita */}
          {!soloLettura && (
            <div className="grid grid-cols-2 gap-2 mt-4">
              <Link
                to={`/partita/${partita.id}/modifica`}
                className="bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-semibold text-center"
              >
                Modifica
              </Link>
              <button
                onClick={() => setShowFinePartita(true)}
                className="bg-slate-700 hover:bg-red-700 py-3 rounded-lg font-semibold"
              >
                Termina partita
              </button>
            </div>
          )}
        </>
      )}

      {/* Partita finita: modifica e statistiche di questa partita */}
      {finita && (
        <div className="flex gap-2 mb-4">
          {!soloLettura && (
            <Link
              to={`/partita/${partita.id}/modifica`}
              className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-semibold text-center"
            >
              Modifica partita
            </Link>
          )}
          <Link
            to={`/stagione/${stagioneId}/statistiche?partita=${partita.id}`}
            className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-semibold text-center"
          >
            📊 Statistiche
          </Link>
        </div>
      )}

      {/* Mappa tiri */}
      {tiriConZona + tiriSubitiConZona > 0 && (
        <section className="mt-6">
          <button
            onClick={() => setShowMappa((v) => !v)}
            className="w-full flex items-center justify-between text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2"
          >
            <span>
              Mappa tiri ({fronteMappa === 'nostro' ? tiriConZona : tiriSubitiConZona})
            </span>
            <span className="text-slate-500">{showMappa ? '▲' : '▼'}</span>
          </button>
          {showMappa && (
            <>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  onClick={() => setFronteMappa('nostro')}
                  className={`py-2 rounded-lg text-sm font-semibold ${
                    fronteMappa === 'nostro'
                      ? 'bg-emerald-600'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  Nostri ({tiriConZona})
                </button>
                <button
                  onClick={() => setFronteMappa('loro')}
                  className={`py-2 rounded-lg text-sm font-semibold ${
                    fronteMappa === 'loro'
                      ? 'bg-red-600'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  Subiti ({tiriSubitiConZona})
                </button>
              </div>
              <CampoTiri
                modalita="mappa"
                conteggi={fronteMappa === 'nostro' ? conteggiZone : conteggiZoneSubiti}
              />
              <p className="text-xs text-slate-500 mt-2">
                In ogni zona: <strong className="text-slate-400">gol/tiri</strong>.
                Più la zona è verde, più si è tirato da lì.{' '}
                {fronteMappa === 'nostro' ? (
                  <>
                    xG partita:{' '}
                    <strong className="text-emerald-400">{formatXG(xgPartita)}</strong>
                  </>
                ) : (
                  <>
                    xGA partita:{' '}
                    <strong className="text-red-400">{formatXG(xgaPartita)}</strong>
                  </>
                )}
              </p>
            </>
          )}
        </section>
      )}

      {/* Eventi log */}
      {eventi.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2">
            Log eventi
          </h2>
          <ul className="flex flex-col gap-1 text-sm">
            {[...eventi].reverse().map((e) => (
              <li key={e.id} className="bg-slate-800/50 rounded px-3 py-1.5">
                <span className="text-slate-500 font-mono mr-2">
                  T{e.tempoGioco} • {e.minuto}'
                </span>
                {descriviEvento(e, rosa, schemi)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ----- MODAL: conclusione (giocatore → origine → [battuta|schema] → zona → esito → assist) ----- */}
      <Modal open={showTiro} onClose={chiudiTiro} title={titoloPassoTiro}>
        {passo === 'giocatore' && (
          <>
            <ul className="flex flex-col gap-2 max-h-80 overflow-y-auto">
              {inCampo.map((g) => (
                <li key={g.id}>
                  <button
                    onClick={() => scegliTiratore(g.id!)}
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
            <div className="border-t border-slate-700 mt-3 pt-3">
              <button
                onClick={() => {
                  chiudiTiro()
                  segnaAutogolPro()
                }}
                className="w-full bg-slate-700 hover:bg-slate-600 py-2.5 rounded-lg text-sm"
              >
                Autogol avversario (nessun marcatore)
              </button>
            </div>
          </>
        )}

        {passo === 'origine' && (
          <>
            <div className="flex flex-col gap-2">
              {ORIGINI_TIRO.map((o) => (
                <button
                  key={o.value}
                  onClick={() => scegliOrigine(o.value)}
                  className="bg-slate-900 hover:bg-slate-700 px-4 py-3 rounded-lg text-left flex items-center gap-3"
                >
                  <span className="text-xl">{o.icona}</span>
                  <span className="font-semibold">{o.label}</span>
                </button>
              ))}
            </div>
            <div className="border-t border-slate-700 mt-3 pt-3">
              <button
                onClick={indietro}
                className="w-full bg-slate-700 hover:bg-slate-600 py-2.5 rounded-lg text-sm"
              >
                ← Cambia giocatore
              </button>
            </div>
          </>
        )}

        {passo === 'battuta' && (
          <>
            <p className="text-xs text-slate-400 mb-2">
              Tocca il punto da cui è stata battuta. La porta avversaria è in alto.
            </p>
            <CampoTiri
              modalita="seleziona"
              mostraDaFermo={false}
              onSelect={scegliBattuta}
            />
            <div className="border-t border-slate-700 mt-3 pt-3">
              <button
                onClick={indietro}
                className="w-full bg-slate-700 hover:bg-slate-600 py-2.5 rounded-lg text-sm"
              >
                ← Indietro
              </button>
            </div>
          </>
        )}

        {passo === 'schema' && (
          <>
            <p className="text-xs text-slate-400 mb-2">
              Schemi da {inattivaLabel(tiroOrigine as TipoInattiva).toLowerCase()}
            </p>
            {schemiTiro.length === 0 ? (
              <p className="text-slate-400 text-sm mb-3">
                Nessuno schema definito per questa situazione. Puoi aggiungerli
                dal setup della stagione.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 max-h-72 overflow-y-auto mb-3">
                {schemiTiro.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => scegliSchema(s.id!)}
                      className="w-full text-left bg-slate-900 hover:bg-slate-700 px-4 py-3 rounded-lg"
                    >
                      <div className="font-semibold">{s.nome}</div>
                      {s.note && (
                        <div className="text-xs text-slate-400 truncate">{s.note}</div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-slate-700 pt-3 flex gap-2">
              <button
                onClick={indietro}
                className="flex-1 bg-slate-700 hover:bg-slate-600 py-2.5 rounded-lg text-sm"
              >
                ← Indietro
              </button>
              <button
                onClick={() => scegliSchema(null)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 py-2.5 rounded-lg text-sm"
              >
                Nessuno schema
              </button>
            </div>
          </>
        )}

        {passo === 'zona' && (
          <>
            <p className="text-xs text-slate-400 mb-2">
              Tocca la zona da cui è partita la conclusione. La porta è in alto.
            </p>
            <CampoTiri modalita="seleziona" onSelect={scegliZonaTiro} />
            <div className="border-t border-slate-700 mt-3 pt-3 flex gap-2">
              <button
                onClick={indietro}
                className="flex-1 bg-slate-700 hover:bg-slate-600 py-2.5 rounded-lg text-sm"
              >
                ← Indietro
              </button>
              <button
                onClick={() => {
                  setTiroZona(null)
                  setPasso('esito')
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 py-2.5 rounded-lg text-sm"
                title="Registra senza zona: non conterà nell'xG"
              >
                Non lo so
              </button>
            </div>
          </>
        )}

        {passo === 'esito' && (
          <>
            <p className="text-sm text-slate-400 mb-3">
              {tiratore ? nomeCorto(tiratore) : '???'}
              {tiroZona !== null ? (
                <>
                  {' '}da <strong className="text-slate-200">{zonaLabel(tiroZona)}</strong>{' '}
                  <span className="text-emerald-400">
                    (xG {pesoZona(tiroZona).toFixed(2)})
                  </span>
                </>
              ) : (
                <span className="text-amber-400/80"> — zona non registrata</span>
              )}
              {tiroOrigine !== 'azione' && (
                <span className="block text-xs mt-0.5">
                  {origineLabel(tiroOrigine)}
                  {tiroSchemaId !== null &&
                    ` — ${schemi.find((s) => s.id === tiroSchemaId)?.nome ?? 'schema'}`}
                  {tiroBattuta !== null && ` — battuta da ${zonaLabel(tiroBattuta)}`}
                </span>
              )}
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setPasso('assist')}
                className="bg-emerald-600 hover:bg-emerald-500 px-4 py-3 rounded-lg font-bold"
              >
                ⚽ Gol
              </button>
              {ESITI_TIRO.map((es) => (
                <button
                  key={es.value}
                  onClick={() => registraTiroNonGol(es.value)}
                  className="bg-slate-900 hover:bg-slate-700 px-4 py-3 rounded-lg text-left"
                >
                  {es.label}
                  {es.inPorta && (
                    <span className="text-xs text-slate-400 ml-2">(in porta)</span>
                  )}
                </button>
              ))}
            </div>
            <div className="border-t border-slate-700 mt-3 pt-3">
              <button
                onClick={indietro}
                className="w-full bg-slate-700 hover:bg-slate-600 py-2.5 rounded-lg text-sm"
              >
                ← Cambia zona
              </button>
            </div>
          </>
        )}

        {passo === 'assist' && (
          <>
            <ul className="flex flex-col gap-2 max-h-64 overflow-y-auto">
              {inCampo
                .filter((g) => g.id !== tiroGiocatoreId)
                .map((g) => (
                  <li key={g.id}>
                    <button
                      onClick={() => registraTiroGol(g.id!)}
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
            <div className="border-t border-slate-700 mt-3 pt-3 flex gap-2">
              <button
                onClick={indietro}
                className="flex-1 bg-slate-700 hover:bg-slate-600 py-2.5 rounded-lg text-sm"
              >
                ← Indietro
              </button>
              <button
                onClick={() => registraTiroGol(null)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2.5 rounded-lg text-sm font-semibold"
              >
                Nessun assist
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* ----- MODAL: palla inattiva battuta ----- */}
      <Modal
        open={showInattiva}
        onClose={chiudiInattiva}
        title={
          passoInattiva === 'tipo'
            ? 'Che palla inattiva?'
            : passoInattiva === 'schema'
            ? 'Che schema?'
            : `${inattivaLabel(inattivaTipo)} battuta`
        }
      >
        {passoInattiva === 'tipo' && (
          <div className="flex flex-col gap-2">
            {TIPI_INATTIVA.map((t) => (
              <button
                key={t.value}
                onClick={() => scegliTipoInattiva(t.value)}
                className="bg-slate-900 hover:bg-slate-700 px-4 py-3 rounded-lg text-left flex items-center gap-3"
              >
                <span className="text-xl">{t.icona}</span>
                <span className="flex-1 font-semibold">{t.label}</span>
                <span className="text-xs text-slate-500">
                  {schemiPerTipo(t.value).length}{' '}
                  {schemiPerTipo(t.value).length === 1 ? 'schema' : 'schemi'}
                </span>
              </button>
            ))}
          </div>
        )}

        {passoInattiva === 'schema' && (
          <>
            <ul className="flex flex-col gap-2 max-h-72 overflow-y-auto mb-3">
              {schemiPerTipo(inattivaTipo).map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => {
                      setInattivaSchemaId(s.id!)
                      setPassoInattiva('esito')
                    }}
                    className="w-full text-left bg-slate-900 hover:bg-slate-700 px-4 py-3 rounded-lg"
                  >
                    <div className="font-semibold">{s.nome}</div>
                    {s.note && (
                      <div className="text-xs text-slate-400 truncate">{s.note}</div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            <div className="border-t border-slate-700 pt-3 flex gap-2">
              <button
                onClick={() => setPassoInattiva('tipo')}
                className="flex-1 bg-slate-700 hover:bg-slate-600 py-2.5 rounded-lg text-sm"
              >
                ← Indietro
              </button>
              <button
                onClick={() => {
                  setInattivaSchemaId(null)
                  setPassoInattiva('esito')
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 py-2.5 rounded-lg text-sm"
              >
                Nessuno schema
              </button>
            </div>
          </>
        )}

        {passoInattiva === 'esito' && (
          <>
            <p className="text-sm text-slate-400 mb-3">
              {inattivaIcona(inattivaTipo)} {inattivaLabel(inattivaTipo)} —{' '}
              {inattivaSchemaId !== null
                ? schemi.find((s) => s.id === inattivaSchemaId)?.nome ?? 'schema'
                : 'senza schema'}
              . Ha prodotto una conclusione?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => salvaInattiva(true)}
                className="bg-emerald-600 hover:bg-emerald-500 px-4 py-3 rounded-lg font-bold"
              >
                Sì, registra il tiro
              </button>
              <button
                onClick={() => salvaInattiva(false)}
                className="bg-slate-900 hover:bg-slate-700 px-4 py-3 rounded-lg"
              >
                No, solo la battuta
              </button>
            </div>
            <div className="border-t border-slate-700 mt-3 pt-3">
              <button
                onClick={() =>
                  setPassoInattiva(
                    schemiPerTipo(inattivaTipo).length > 0 ? 'schema' : 'tipo'
                  )
                }
                className="w-full bg-slate-700 hover:bg-slate-600 py-2.5 rounded-lg text-sm"
              >
                ← Indietro
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* ----- MODAL: conclusione subita (zona → esito) ----- */}
      <Modal open={showGolSubito} onClose={chiudiSubito} title="Conclusione loro">
        {passoSubito === 'zona' && (
          <>
            <p className="text-xs text-slate-400 mb-2">
              Tocca la zona da cui hanno concluso. È la nostra porta, vista da
              loro: la porta è in alto.
            </p>
            <CampoTiri modalita="seleziona" onSelect={scegliZonaSubito} />
            <div className="border-t border-slate-700 mt-3 pt-3 flex flex-col gap-2">
              <button
                onClick={() => {
                  setSubitoZona(null)
                  setPassoSubito('esito')
                }}
                className="w-full bg-slate-700 hover:bg-slate-600 py-2.5 rounded-lg text-sm"
                title="Solo per un gol subito: senza zona non conta nell'xGA"
              >
                Non lo so — è comunque gol
              </button>
              <button
                onClick={apriAutogolContro}
                className="w-full bg-slate-700 hover:bg-slate-600 py-2.5 rounded-lg text-sm"
              >
                Autogol di un nostro
              </button>
            </div>
          </>
        )}

        {passoSubito === 'esito' && (
          <>
            <p className="text-sm text-slate-400 mb-3">
              {subitoZona !== null ? (
                <>
                  Hanno concluso da{' '}
                  <strong className="text-slate-200">{zonaLabel(subitoZona)}</strong>{' '}
                  <span className="text-red-400">
                    (xGA {pesoZona(subitoZona).toFixed(2)})
                  </span>
                </>
              ) : (
                <span className="text-amber-400/80">Zona non registrata</span>
              )}
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={segnaGolSubito}
                className="bg-red-600 hover:bg-red-500 px-4 py-3 rounded-lg font-bold"
              >
                ⚽ Gol subito
              </button>
              {subitoZona !== null &&
                ESITI_TIRO.map((es) => (
                  <button
                    key={es.value}
                    onClick={() => registraTiroSubito(es.value)}
                    className="bg-slate-900 hover:bg-slate-700 px-4 py-3 rounded-lg text-left"
                  >
                    {es.label}
                    {es.inPorta && (
                      <span className="text-xs text-slate-400 ml-2">(in porta)</span>
                    )}
                  </button>
                ))}
            </div>
            <div className="border-t border-slate-700 mt-3 pt-3">
              <button
                onClick={() => setPassoSubito('zona')}
                className="w-full bg-slate-700 hover:bg-slate-600 py-2.5 rounded-lg text-sm"
              >
                ← Indietro
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* ----- MODAL: chi ha fatto autogol contro ----- */}
      <Modal
        open={showAutogolContro}
        onClose={() => setShowAutogolContro(false)}
        title="Autogol di chi?"
      >
        <ul className="flex flex-col gap-2 max-h-80 overflow-y-auto">
          {inCampo.map((g) => (
            <li key={g.id}>
              <button
                onClick={() => segnaAutogolContro(g.id!)}
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