import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { ruoloShort, ordineRuolo } from '../db/ruoli'
import { campoIcona } from '../db/schema'
import type { Giocatore, Partita, Stagione } from '../db/schema'
import { nomeCompleto } from '../utils/giocatore'
import { formatData } from '../utils/format'
import { risultatoPartita } from '../utils/statistiche'
import { salvaVoti, useVoti } from '../cloud/voti'
import type { Valutatore, Voto, VotoDaSalvare } from '../cloud/voti'
import {
  coloreVoto,
  conVoto,
  ioComeValutatore,
  leggiVoto,
  media,
  passoVoto,
  scriviMedia,
  scriviVoto,
  valutatoriScrivibili,
} from '../utils/voti'
import Requisiti from '../components/voti/Requisiti'
import TagBadge from '../components/TagBadge'
import ConfermaAzione from '../components/ConfermaAzione'
import { useConferma } from '../utils/conferma'

/**
 * I voti di una partita.
 *
 * La partita si apre per `uid`, non per id locale: la sincronizzazione
 * automatica può riscaricare la stagione mentre la pagina è aperta, e con lei
 * gli id locali cambiano. Lo uid no.
 *
 * Si vota «come» un allenatore alla volta — se stessi, o un collega per cui
 * si ha la delega — e si vedono sotto i voti degli altri. Nessun voto è
 * obbligatorio: chi resta vuoto semplicemente non ha voto.
 */
export default function VotiPartita() {
  const { id, uid } = useParams()
  const stagioneId = Number(id)
  const stagione = useLiveQuery(() => db.stagioni.get(stagioneId), [stagioneId])
  const partita = useLiveQuery(
    () =>
      db.partite
        .where('uid')
        .equals(uid ?? '')
        .filter((p) => p.stagioneId === stagioneId)
        .first()
        .then((p) => p ?? null),
    [uid, stagioneId]
  )

  if (stagione === undefined || partita === undefined) {
    return <div className="p-6">Caricamento...</div>
  }
  if (stagione === null || partita === null) {
    return (
      <div className="p-6">
        <p>Partita non trovata.</p>
        <Link to={`/stagione/${stagioneId}/voti`} className="text-emerald-400 underline">
          Torna ai voti
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 pb-32">
      <Requisiti stagione={stagione}>
        {(ctx) => <Pagina stagione={stagione} partita={partita} {...ctx} />}
      </Requisiti>
    </div>
  )
}

interface Bozza {
  voto: string
  note: string
}

function Pagina({
  stagione,
  partita,
  cloudId,
  email,
  proprietario,
}: {
  stagione: Stagione
  partita: Partita
  cloudId: string
  email: string | null
  proprietario: boolean
}) {
  const stagioneId = stagione.id!
  const navigate = useNavigate()
  const conferma = useConferma()
  const stato = useVoti(cloudId)

  const rosa = useLiveQuery(
    () => db.giocatori.where('stagioneId').equals(stagioneId).toArray(),
    [stagioneId]
  )
  const avversario = useLiveQuery(() => db.avversari.get(partita.avversarioId), [partita.avversarioId])
  const eventi = useLiveQuery(
    () => db.eventi.where('partitaId').equals(partita.id!).toArray(),
    [partita.id]
  )

  const [sceltoId, setSceltoId] = useState<string | null>(null)
  const [modifiche, setModifiche] = useState<Record<string, Bozza>>({})
  const [aperte, setAperte] = useState<Set<string>>(new Set())
  const [errore, setErrore] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const valutatori = stato.stato === 'ok' ? stato.valutatori : []
  const tuttiVoti = stato.stato === 'ok' ? stato.voti : []
  const scrivibili = valutatoriScrivibili(valutatori, email, proprietario)
  // Si parte da se stessi, se si può; altrimenti dal primo per cui si ha delega
  const predefinito =
    scrivibili.find((v) => v.id === ioComeValutatore(valutatori, email)?.id) ?? scrivibili[0]
  const scelto = scrivibili.find((v) => v.id === sceltoId) ?? predefinito

  const votiPartita = tuttiVoti.filter((v) => v.partita_uid === partita.uid)
  const votoDi = (valId: string, gUid: string) =>
    votiPartita.find((v) => v.valutatore === valId && v.giocatore_uid === gUid)

  const bozzaDi = (gUid: string): Bozza => {
    if (modifiche[gUid]) return modifiche[gUid]
    const v = scelto ? votoDi(scelto.id, gUid) : undefined
    return { voto: scriviVoto(v?.voto), note: v?.note ?? '' }
  }

  const cambiate = Object.entries(modifiche).filter(([gUid, b]) => {
    const v = scelto ? votoDi(scelto.id, gUid) : undefined
    return b.voto.trim() !== scriviVoto(v?.voto) || b.note.trim() !== (v?.note ?? '').trim()
  })
  const sporco = cambiate.length > 0

  // Uscire dall'app con voti non salvati: il browser chiede conferma
  useEffect(() => {
    if (!sporco) return
    const avvisa = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', avvisa)
    return () => window.removeEventListener('beforeunload', avvisa)
  }, [sporco])

  if (!rosa || !eventi || stato.stato === 'caricamento') {
    return <p className="text-slate-400">Caricamento...</p>
  }

  // I votabili sono i convocati. Chi ha già un voto ma non risulta convocato
  // (un convocato tolto dopo, un voto importato) resta in fondo: il voto c'è
  // e nasconderlo lo renderebbe impossibile da correggere.
  const perUid = new Map(rosa.map((g) => [g.uid!, g]))
  const convocati = partita.convocati
    .map((gid) => rosa.find((g) => g.id === gid))
    .filter((g): g is Giocatore => g !== undefined)
  const extra = [...new Set(votiPartita.map((v) => v.giocatore_uid))]
    .filter((u) => !convocati.some((g) => g.uid === u))
    .map((u) => perUid.get(u))
    .filter((g): g is Giocatore => g !== undefined)
  const ordina = (a: Giocatore, b: Giocatore) =>
    ordineRuolo(a.ruolo) - ordineRuolo(b.ruolo) || a.cognome.localeCompare(b.cognome)
  const giocatori = [...convocati.sort(ordina), ...extra.sort(ordina)]

  const { fatti, subiti } = risultatoPartita(eventi)
  const indietro = `/stagione/${stagioneId}/voti`

  async function esci() {
    if (sporco) {
      const ok = await conferma.chiedi({
        titolo: 'Uscire senza salvare?',
        messaggio: `Hai ${cambiate.length === 1 ? 'una modifica' : `${cambiate.length} modifiche`} non salvate: andranno perse.`,
        azione: 'Esci senza salvare',
      })
      if (!ok) return
    }
    navigate(indietro)
  }

  async function scegli(v: Valutatore) {
    if (v.id === scelto?.id) return
    if (sporco) {
      const ok = await conferma.chiedi({
        titolo: `Passare ai voti di ${v.nome}?`,
        messaggio: `Le modifiche ai voti di ${scelto?.nome} non sono salvate e andranno perse.`,
        azione: 'Cambia senza salvare',
      })
      if (!ok) return
    }
    setModifiche({})
    setErrore(null)
    setSceltoId(v.id)
  }

  function modifica(gUid: string, campo: keyof Bozza, valore: string) {
    setModifiche((m) => ({ ...m, [gUid]: { ...bozzaDi(gUid), [campo]: valore } }))
  }

  async function salva() {
    if (!scelto) return
    const daScrivere: VotoDaSalvare[] = []
    const daCancellare: string[] = []
    for (const [gUid, b] of cambiate) {
      const voto = leggiVoto(b.voto)
      if (voto === undefined) {
        const g = perUid.get(gUid)
        setErrore(`Il voto di ${g ? nomeCompleto(g) : 'un giocatore'} non è valido: serve un numero da 0 a 10, es. 6,5.`)
        return
      }
      const note = b.note.trim() || null
      const esistente = votoDi(scelto.id, gUid)
      if (voto === null && note === null) {
        if (esistente) daCancellare.push(esistente.id)
        continue
      }
      daScrivere.push({
        valutatore: scelto.id,
        partita_uid: partita.uid!,
        giocatore_uid: gUid,
        voto,
        note,
      })
    }
    setSalvando(true)
    setErrore(null)
    const err = await salvaVoti(cloudId, daScrivere, daCancellare)
    setSalvando(false)
    if (err) {
      setErrore(err)
      return
    }
    setModifiche({})
    stato.ricarica()
  }

  return (
    <>
      <button onClick={esci} className="text-sm text-slate-400 hover:text-slate-200">
        ← Voti
      </button>
      <div className="flex items-start justify-between gap-3 mt-1 mb-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 flex-wrap">
            {partita.campo !== undefined && <span>{campoIcona(partita.campo)}</span>}
            vs {avversario?.nome ?? '???'}
          </h1>
          <div className="text-sm text-slate-400 flex items-center gap-2">
            {formatData(partita.dataOra)} <TagBadge tag={partita.tag} />
          </div>
        </div>
        <div className="text-2xl font-bold tabular-nums">
          {fatti}-{subiti}
        </div>
      </div>

      {stato.stato === 'errore' && (
        <div className="bg-red-900/30 border border-red-800/60 text-red-200 text-sm rounded-lg px-4 py-3 mb-4">
          <p>{stato.messaggio}</p>
          <button onClick={stato.ricarica} className="underline mt-2">
            Riprova
          </button>
        </div>
      )}

      {stato.stato === 'ok' && valutatori.length === 0 && (
        <p className="text-slate-400 text-sm">
          Non ci sono ancora allenatori che danno i voti: il ruolo si dà dalle persone
          della stagione, in Sincronizzazione.
        </p>
      )}

      {giocatori.length === 0 && valutatori.length > 0 && (
        <p className="text-slate-500 italic text-sm">
          La partita non ha convocati: i voti si danno ai convocati.
        </p>
      )}

      {scelto && (
        <div className="mb-4">
          <div className="text-xs text-slate-400 mb-1.5">Stai votando come</div>
          <div className="flex flex-wrap gap-1.5">
            {scrivibili.map((v) => (
              <button
                key={v.id}
                data-vota-come={v.email}
                onClick={() => scegli(v)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                  v.id === scelto.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {v.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      {!scelto && valutatori.length > 0 && (
        <p className="text-xs text-slate-500 mb-4">
          Stai guardando i voti: per inserirne ti serve il permesso di chi gestisce
          la stagione.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {giocatori.map((g) => {
          const gUid = g.uid!
          const altri = valutatori
            .filter((v) => v.id !== scelto?.id)
            .map((v) => ({ v, voto: votoDi(v.id, gUid) }))
            .filter((x) => x.voto !== undefined) as { v: Valutatore; voto: Voto }[]
          const mediaPartita = media(
            conVoto(votiPartita.filter((v) => v.giocatore_uid === gUid)).map((v) => v.voto)
          )
          const nonConvocato = !convocati.includes(g)
          const bozza = bozzaDi(gUid)
          const valido = leggiVoto(bozza.voto) !== undefined
          const notaAperta = aperte.has(gUid) || bozza.note !== ''

          return (
            <li key={gUid} data-voto-giocatore={gUid} className="bg-slate-800 rounded-lg px-3 py-3">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium leading-tight break-words">{nomeCompleto(g)}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {g.numero !== undefined && <span className="tabular-nums">#{g.numero} · </span>}
                    {ruoloShort(g.ruolo)}
                    {nonConvocato && <span className="text-amber-400/80"> · non convocato</span>}
                    {mediaPartita !== null && altri.length > 0 && (
                      <span className={coloreVoto(mediaPartita)}>
                        {' '}
                        · media {scriviMedia(mediaPartita)}
                      </span>
                    )}
                  </div>
                </div>

                {scelto ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => modifica(gUid, 'voto', passoVoto(bozza.voto, -1))}
                      aria-label="Abbassa voto"
                      className="w-8 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-lg"
                    >
                      −
                    </button>
                    <input
                      value={bozza.voto}
                      onChange={(e) => modifica(gUid, 'voto', e.target.value)}
                      inputMode="decimal"
                      placeholder="–"
                      aria-label={`Voto di ${nomeCompleto(g)}`}
                      className={`w-12 h-10 text-center text-lg font-bold tabular-nums bg-slate-900 border rounded-lg focus:outline-none ${
                        valido
                          ? `border-slate-700 focus:border-emerald-500 ${coloreVoto(leggiVoto(bozza.voto))}`
                          : 'border-red-500 text-red-300'
                      }`}
                    />
                    <button
                      onClick={() => modifica(gUid, 'voto', passoVoto(bozza.voto, 1))}
                      aria-label="Alza voto"
                      className="w-8 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-lg"
                    >
                      +
                    </button>
                    <button
                      onClick={() =>
                        setAperte((s) => {
                          const n = new Set(s)
                          if (n.has(gUid)) n.delete(gUid)
                          else n.add(gUid)
                          return n
                        })
                      }
                      aria-label="Nota"
                      className={`w-8 h-10 rounded-lg text-sm ${
                        bozza.note ? 'bg-sky-800/60' : 'bg-slate-700 hover:bg-slate-600'
                      }`}
                    >
                      📝
                    </button>
                  </div>
                ) : (
                  <div className={`text-lg font-bold tabular-nums ${coloreVoto(mediaPartita)}`}>
                    {scriviMedia(mediaPartita)}
                  </div>
                )}
              </div>

              {scelto && notaAperta && (
                <textarea
                  value={bozza.note}
                  onChange={(e) => modifica(gUid, 'note', e.target.value)}
                  rows={2}
                  placeholder="Nota (facoltativa)"
                  className="w-full mt-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-emerald-500"
                />
              )}

              {altri.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  {altri.map(({ v, voto }) => (
                    <div key={v.id} className="text-xs text-slate-400">
                      <span className="text-slate-500">{v.nome}:</span>{' '}
                      <span className={`font-semibold tabular-nums ${coloreVoto(voto.voto)}`}>
                        {voto.voto === null ? '—' : scriviVoto(voto.voto)}
                      </span>
                      {voto.note && <span className="italic"> — {voto.note}</span>}
                    </div>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {scelto && giocatori.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-slate-900/95 border-t border-slate-800 p-4">
          <div className="max-w-2xl mx-auto">
            {errore && <p className="text-red-300 text-sm mb-2">{errore}</p>}
            <button
              onClick={salva}
              disabled={!sporco || salvando}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400 py-3 rounded-lg font-semibold"
            >
              {salvando
                ? 'Salvataggio…'
                : sporco
                ? `Salva i voti di ${scelto.nome} (${cambiate.length})`
                : 'Tutto salvato'}
            </button>
          </div>
        </div>
      )}

      <ConfermaAzione {...conferma.props} />
    </>
  )
}
