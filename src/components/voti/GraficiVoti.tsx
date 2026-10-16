import { useState } from 'react'
import type { Giocatore, Partita, SquadraAvversaria } from '../../db/schema'
import type { Valutatore, Voto } from '../../cloud/voti'
import { nomeCorto } from '../../utils/giocatore'
import { etichettaMese, scriviMedia, scriviVoto } from '../../utils/voti'
import {
  mediaSquadra,
  mesiVotati,
  partiteVotate,
  righeGiocatori,
  votiValidi,
  type RigaGiocatore,
} from '../../utils/medieVoti'
import { COLORI } from '../grafici/tavolozza'
import { Legenda, NienteDati, TitoloGrafico } from '../grafici/base'

/**
 * I due grafici del foglio, rifatti per il telefono.
 *
 * 1. Media voto per giocatore: un punto per la media e una barretta dal voto
 *    più basso al più alto. Barre da zero schiaccerebbero tutto fra il 6 e
 *    l'8; i punti si possono leggere su una scala che parte vicino ai voti.
 * 2. Andamento: per mese o partita per partita. Il foglio metteva tutti i
 *    giocatori sullo stesso grafico, ed era un gomitolo: qui se ne scelgono
 *    fino a tre, sopra la media di squadra.
 */

/**
 * Colori dei giocatori scelti. Validati sul fondo slate-800 (lightness,
 * croma, separazione per daltonismo e contrasto): con tre la coppia peggiore
 * resta distinguibile. Un quarto colore non passava, per questo il limite è 3.
 * Il colore segue il giocatore: chi resta selezionato non cambia colore
 * quando un altro viene tolto.
 */
const SERIE = ['#3987e5', '#d95926', '#199e70'] as const
const MAX_SCELTI = SERIE.length

export default function GraficiVoti({
  rosa,
  partite,
  avversari,
  valutatori,
  voti,
}: {
  rosa: Giocatore[]
  partite: Partita[]
  avversari: SquadraAvversaria[]
  valutatori: Valutatore[]
  voti: Voto[]
}) {
  const dati = { rosa, partite, valutatori, voti }
  const validi = votiValidi(dati)
  const righe = righeGiocatori(dati, validi)

  if (righe.length === 0) {
    return <NienteDati testo="Nessun voto ancora: i grafici compaiono dal primo voto." />
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-slate-800 rounded-xl p-4">
        <TitoloGrafico
          titolo="Media voto per giocatore"
          sottotitolo="Il punto è la media, la barretta va dal voto più basso al più alto"
        />
        <PuntiMedie righe={righe} />
      </section>
      <section className="bg-slate-800 rounded-xl p-4">
        <Andamento
          righe={righe}
          dati={dati}
          validi={validi}
          avversari={avversari}
        />
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Media per giocatore
// ---------------------------------------------------------------------------

const ETICHETTA = 92
const VALORE = 34
const RIGA = 24

function PuntiMedie({ righe }: { righe: RigaGiocatore[] }) {
  const [sopra, setSopra] = useState<string | null>(null)
  const ordinate = [...righe].sort((a, b) => (b.media ?? 0) - (a.media ?? 0))
  const minimo = Math.min(...ordinate.map((r) => r.minimo ?? 10))
  const da = Math.max(1, Math.floor(minimo) - (minimo % 1 === 0 ? 1 : 0))
  const a = 10
  const larga = 320
  const alta = ordinate.length * RIGA + 18
  const x = (v: number) => ETICHETTA + ((v - da) / (a - da)) * (larga - ETICHETTA - VALORE)
  const tacche = Array.from({ length: a - da + 1 }, (_, i) => da + i)
  const puntata = ordinate.find((r) => r.g.uid === sopra)

  return (
    <>
      <svg viewBox={`0 0 ${larga} ${alta}`} className="w-full" role="img" aria-label="Media voto per giocatore">
        {tacche.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={0} y2={alta - 16} stroke={COLORI.griglia} strokeWidth={1} />
            <text x={x(t)} y={alta - 4} textAnchor="middle" fontSize={9} fill={COLORI.testoTenue}>
              {t}
            </text>
          </g>
        ))}
        {ordinate.map((r, i) => {
          const cy = i * RIGA + RIGA / 2
          const attiva = sopra === r.g.uid
          return (
            <g
              key={r.g.uid}
              data-punto-media={r.g.uid}
              onPointerEnter={() => setSopra(r.g.uid!)}
              onPointerLeave={() => setSopra(null)}
              onClick={() => setSopra(attiva ? null : r.g.uid!)}
              className="cursor-pointer"
            >
              {/* bersaglio più grande della riga, per il dito */}
              <rect x={0} y={i * RIGA} width={larga} height={RIGA} fill={attiva ? COLORI.griglia : 'transparent'} opacity={0.35} rx={4} />
              <text x={ETICHETTA - 8} y={cy + 3.5} textAnchor="end" fontSize={10.5} fill={COLORI.testo}>
                {accorcia(nomeCorto(r.g))}
              </text>
              {r.minimo !== null && r.massimo !== null && r.massimo > r.minimo && (
                <line
                  x1={x(r.minimo)}
                  x2={x(r.massimo)}
                  y1={cy}
                  y2={cy}
                  stroke={COLORI.neutro}
                  strokeWidth={4}
                  strokeLinecap="round"
                />
              )}
              <circle cx={x(r.media!)} cy={cy} r={5} fill={COLORI.nostro} stroke={COLORI.superficie} strokeWidth={2} />
              <text x={larga - 2} y={cy + 3.5} textAnchor="end" fontSize={10.5} fontWeight={600} fill="#e2e8f0">
                {scriviMedia(r.media)}
              </text>
              <title>
                {`${nomeCorto(r.g)}: media ${scriviMedia(r.media)} su ${r.voti} voti (da ${scriviVoto(r.minimo)} a ${scriviVoto(r.massimo)})`}
              </title>
            </g>
          )
        })}
      </svg>
      <p className="text-xs text-slate-400 mt-1 min-h-4">
        {puntata
          ? `${nomeCorto(puntata.g)} — media ${scriviMedia(puntata.media)}, ${puntata.voti} voti in ${puntata.partite} partite, da ${scriviVoto(puntata.minimo)} a ${scriviVoto(puntata.massimo)}`
          : 'Tocca un giocatore per i dettagli.'}
      </p>
    </>
  )
}

function accorcia(t: string, max = 14) {
  return t.length > max ? t.slice(0, max - 1) + '…' : t
}

// ---------------------------------------------------------------------------
// Andamento
// ---------------------------------------------------------------------------

type Asse = 'mesi' | 'partite'

const L = 26
const R = 8
const T = 10
const B = 30
const LARGA = 320
const ALTA = 190

function Andamento({
  righe,
  dati,
  validi,
  avversari,
}: {
  righe: RigaGiocatore[]
  dati: Parameters<typeof mesiVotati>[0]
  validi: ReturnType<typeof votiValidi>
  avversari: SquadraAvversaria[]
}) {
  const [asse, setAsse] = useState<Asse>('mesi')
  // Uno slot per colore: togliere un giocatore lascia il buco, così gli altri
  // tengono il loro colore. Si parte dai tre con la media più alta.
  const [slot, setSlot] = useState<(string | null)[]>(() => {
    const migliori = [...righe]
      .sort((a, b) => (b.media ?? 0) - (a.media ?? 0))
      .slice(0, MAX_SCELTI)
      .map((r) => r.g.uid!)
    return Array.from({ length: MAX_SCELTI }, (_, i) => migliori[i] ?? null)
  })
  const [sonda, setSonda] = useState<number | null>(null)

  const squadra = mediaSquadra(dati, validi)
  const categorie =
    asse === 'mesi'
      ? mesiVotati(dati, validi).map((m) => ({
          chiave: m,
          etichetta: etichettaMese(m, true),
          esteso: etichettaMese(m),
        }))
      : partiteVotate(dati, validi).map((p) => {
          const avv = avversari.find((a) => a.id === p.avversarioId)?.nome ?? '???'
          const giorno = new Date(p.dataOra).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
          return { chiave: p.uid!, etichetta: giorno, esteso: `${giorno} vs ${avv}` }
        })

  const scelte = slot
    .map((uid, i) => ({ riga: righe.find((r) => r.g.uid === uid), colore: SERIE[i] }))
    .filter((s): s is { riga: RigaGiocatore; colore: (typeof SERIE)[number] } => s.riga !== undefined)

  const valoreDi = (r: RigaGiocatore, k: string) =>
    asse === 'mesi' ? r.perMese.get(k) : r.perPartita.get(k)
  const valoreSquadra = (k: string) =>
    asse === 'mesi' ? squadra.perMese.get(k) : squadra.perPartita.get(k)

  function cambia(uid: string) {
    setSlot((s) => {
      const i = s.indexOf(uid)
      if (i >= 0) return s.map((x, j) => (j === i ? null : x))
      const libero = s.indexOf(null)
      if (libero < 0) return s
      return s.map((x, j) => (j === libero ? uid : x))
    })
  }
  const pieno = !slot.includes(null)

  // Scala verticale vicina ai voti, sempre fino al 10
  const tutti = [
    ...categorie.map((c) => valoreSquadra(c.chiave)),
    ...scelte.flatMap((s) => categorie.map((c) => valoreDi(s.riga, c.chiave))),
  ].filter((v): v is number => v !== undefined)
  const da = tutti.length > 0 ? Math.max(1, Math.floor(Math.min(...tutti)) - 1) : 4
  const a = 10
  const tacche = Array.from({ length: a - da + 1 }, (_, i) => da + i).filter(
    (t) => (a - da <= 6 ? true : (t - da) % 2 === 0)
  )
  const n = categorie.length
  const x = (i: number) => (n === 1 ? (L + LARGA - R) / 2 : L + (i / (n - 1)) * (LARGA - L - R))
  const y = (v: number) => T + (1 - (v - da) / (a - da)) * (ALTA - T - B)

  /** Segmenti solo fra categorie consecutive con un valore: niente ponti sui buchi. */
  function percorso(valore: (k: string) => number | undefined): string {
    const d: string[] = []
    let dentro = false
    categorie.forEach((c, i) => {
      const v = valore(c.chiave)
      if (v === undefined) {
        dentro = false
        return
      }
      d.push(`${dentro ? 'L' : 'M'} ${x(i)} ${y(v)}`)
      dentro = true
    })
    return d.join(' ')
  }

  // Etichette dell'asse x: se sono tante se ne mostra una sì e una no
  const ogni = n > 8 ? Math.ceil(n / 6) : 1
  const puntata = sonda === null ? null : categorie[sonda]

  return (
    <>
      <div className="flex items-start justify-between gap-2 mb-2">
        <TitoloGrafico titolo="Andamento" sottotitolo={asse === 'mesi' ? 'Media per mese' : 'Media per partita'} />
        <div className="flex gap-1 shrink-0">
          {(['mesi', 'partite'] as const).map((v) => (
            <button
              key={v}
              data-asse={v}
              onClick={() => {
                setAsse(v)
                setSonda(null)
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                asse === v ? 'bg-slate-600 text-white' : 'bg-slate-900 text-slate-400'
              }`}
            >
              {v === 'mesi' ? 'Mesi' : 'Partite'}
            </button>
          ))}
        </div>
      </div>

      <Legenda
        voci={[
          ...scelte.map((s) => ({ colore: s.colore, label: nomeCorto(s.riga.g) })),
          { colore: COLORI.testoTenue, label: 'Media squadra', vuota: true },
        ]}
      />

      {n === 0 ? (
        <NienteDati testo="Nessun voto da mettere in fila." />
      ) : (
        <svg
          viewBox={`0 0 ${LARGA} ${ALTA}`}
          className="w-full touch-none"
          role="img"
          aria-label="Andamento della media voto"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            const px = ((e.clientX - r.left) / r.width) * LARGA
            const i = n === 1 ? 0 : Math.round(((px - L) / (LARGA - L - R)) * (n - 1))
            setSonda(Math.max(0, Math.min(n - 1, i)))
          }}
          onPointerLeave={() => setSonda(null)}
        >
          {tacche.map((t) => (
            <g key={t}>
              <line x1={L} x2={LARGA - R} y1={y(t)} y2={y(t)} stroke={COLORI.griglia} strokeWidth={1} />
              <text x={L - 6} y={y(t) + 3} textAnchor="end" fontSize={9} fill={COLORI.testoTenue}>
                {t}
              </text>
            </g>
          ))}
          {categorie.map((c, i) =>
            i % ogni === 0 || i === n - 1 ? (
              <text
                key={c.chiave}
                x={x(i)}
                y={ALTA - B + 14}
                // agli estremi l'etichetta si allinea verso l'interno, se no esce dal riquadro
                textAnchor={n > 1 && i === 0 ? 'start' : n > 1 && i === n - 1 ? 'end' : 'middle'}
                fontSize={9}
                fill={COLORI.testoTenue}
              >
                {c.etichetta}
              </text>
            ) : null
          )}

          {sonda !== null && (
            <line x1={x(sonda)} x2={x(sonda)} y1={T} y2={ALTA - B} stroke={COLORI.testoTenue} strokeWidth={1} />
          )}

          {/* media squadra: grigia e tratteggiata, è il riferimento */}
          <path d={percorso(valoreSquadra)} fill="none" stroke={COLORI.testoTenue} strokeWidth={2} strokeDasharray="4 3" />

          {scelte.map((s) => (
            <g key={s.riga.g.uid}>
              <path
                d={percorso((k) => valoreDi(s.riga, k))}
                fill="none"
                stroke={s.colore}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {categorie.map((c, i) => {
                const v = valoreDi(s.riga, c.chiave)
                return v === undefined ? null : (
                  <circle key={c.chiave} cx={x(i)} cy={y(v)} r={4} fill={s.colore} stroke={COLORI.superficie} strokeWidth={2} />
                )
              })}
            </g>
          ))}
        </svg>
      )}

      {/* il dettaglio della categoria puntata, in testo: si legge anche senza colori */}
      <div className="text-xs text-slate-400 min-h-10 mt-1">
        {puntata ? (
          <>
            <div className="font-semibold text-slate-300">{puntata.esteso}</div>
            <div className="flex flex-wrap gap-x-3">
              {scelte.map((s) => {
                const v = valoreDi(s.riga, puntata.chiave)
                return (
                  <span key={s.riga.g.uid}>
                    <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: s.colore }} />
                    {nomeCorto(s.riga.g)} {v === undefined ? '—' : scriviMedia(v)}
                  </span>
                )
              })}
              <span>Squadra {scriviMedia(valoreSquadra(puntata.chiave))}</span>
            </div>
          </>
        ) : (
          'Scorri sul grafico per leggere i valori.'
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-700/60">
        <div className="text-xs text-slate-400 mb-1.5">
          Giocatori nel grafico (fino a {MAX_SCELTI})
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[...righe]
            .sort((a, b) => a.g.cognome.localeCompare(b.g.cognome))
            .map((r) => {
              const i = slot.indexOf(r.g.uid!)
              const scelto = i >= 0
              return (
                <button
                  key={r.g.uid}
                  data-scegli={r.g.uid}
                  onClick={() => cambia(r.g.uid!)}
                  disabled={!scelto && pieno}
                  className={`px-2.5 py-1 rounded-full text-xs border flex items-center gap-1.5 ${
                    scelto
                      ? 'border-slate-500 text-slate-100 bg-slate-700'
                      : 'border-slate-700 text-slate-400 disabled:opacity-40'
                  }`}
                >
                  {scelto && (
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: SERIE[i] }} />
                  )}
                  {nomeCorto(r.g)}
                </button>
              )
            })}
        </div>
      </div>
    </>
  )
}
