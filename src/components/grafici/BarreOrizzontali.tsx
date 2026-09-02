import { COLORI } from './tavolozza'
import { NienteDati } from './base'

/**
 * Barre orizzontali, in tre forme: semplice, impilata a due segmenti, e
 * divergente attorno a uno zero. Le tengo insieme perché condividono
 * geometria ed etichette; a cambiare è solo come si riempie la banda.
 */

export interface RigaBarra {
  chiave: string
  etichetta: string
  /** barra semplice o segmento in evidenza di quella impilata */
  valore: number
  /** secondo segmento della barra impilata (il resto) */
  resto?: number
  /** testo alla punta, se serve dire qualcosa in più del numero */
  nota?: string
  /** marcatore su un secondo valore, stessa unità (es. gol sull'xG) */
  marcatore?: number
}

const ALTEZZA_RIGA = 26
const BARRA = 14
const DISTACCO = 2
const ETICHETTA = 96

/** Le etichette a sinistra hanno una corsia fissa: quelle lunghe si accorciano. */
function accorcia(testo: string, max = 15): string {
  return testo.length > max ? testo.slice(0, max - 1) + '…' : testo
}

export function BarreOrizzontali({
  righe,
  colore = COLORI.nostro,
  coloreResto,
  formatta = (v: number) => String(v),
  vuoto,
}: {
  righe: RigaBarra[]
  colore?: string
  coloreResto?: string
  formatta?: (v: number) => string
  vuoto: string
}) {
  const massimo = Math.max(
    ...righe.map((r) => r.valore + (r.resto ?? 0)),
    ...righe.map((r) => r.marcatore ?? 0),
    0
  )
  if (massimo <= 0) return <NienteDati testo={vuoto} />

  // La pista si accorcia quanto serve perché l'etichetta alla punta ci stia
  // dentro: un testo tagliato a metà è peggio di una barra un po' più corta.
  const larga = 320
  const testoAllaPunta = righe.map((r) => r.nota ?? formatta(r.valore + (r.resto ?? 0)))
  const riserva = Math.min(
    150,
    Math.max(30, Math.max(...testoAllaPunta.map((t) => t.length)) * 5.6 + 10)
  )
  const pista = larga - ETICHETTA - riserva
  const w = (v: number) => (v / massimo) * pista
  const alta = righe.length * ALTEZZA_RIGA + 4

  return (
    <svg viewBox={`0 0 ${larga} ${alta}`} className="w-full" role="img">
      {righe.map((r, i) => {
        const y = i * ALTEZZA_RIGA + 4
        const cy = y + BARRA / 2
        const wv = w(r.valore)
        const wr = r.resto ? w(r.resto) : 0
        return (
          <g key={r.chiave}>
            <text
              x={ETICHETTA - 8}
              y={cy + 4}
              textAnchor="end"
              fontSize={10}
              fill={COLORI.testo}
            >
              {accorcia(r.etichetta)}
            </text>
            {wv > 0 && (
              <rect
                x={ETICHETTA}
                y={y}
                width={Math.max(wv, 2)}
                height={BARRA}
                rx={wr > 0 ? 0 : 4}
                fill={colore}
              >
                <title>
                  {r.etichetta}: {formatta(r.valore)}
                </title>
              </rect>
            )}
            {wr > 0 && (
              <rect
                x={ETICHETTA + wv + DISTACCO}
                y={y}
                width={Math.max(wr - DISTACCO, 2)}
                height={BARRA}
                rx={4}
                fill={coloreResto ?? COLORI.neutro}
              />
            )}
            {r.marcatore !== undefined && (
              <line
                x1={ETICHETTA + w(r.marcatore)}
                x2={ETICHETTA + w(r.marcatore)}
                y1={y - 2}
                y2={y + BARRA + 2}
                stroke={COLORI.testo}
                strokeWidth={2}
                strokeLinecap="round"
              />
            )}
            <text
              x={
                ETICHETTA +
                Math.max(wv + wr, r.marcatore !== undefined ? w(r.marcatore) : 0, 2) +
                10
              }
              y={cy + 4}
              fontSize={10}
              fill={COLORI.testo}
              fontWeight="600"
            >
              {r.nota ?? formatta(r.valore + (r.resto ?? 0))}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** Barre che partono da uno zero centrale: negativo a sinistra, positivo a destra. */
export function BarreDivergenti({
  righe,
  vuoto,
}: {
  righe: { chiave: string; etichetta: string; valore: number }[]
  vuoto: string
}) {
  const estremo = Math.max(1, ...righe.map((r) => Math.abs(r.valore)))
  if (righe.length === 0) return <NienteDati testo={vuoto} />

  // Una corsia riservata per lato: senza, l'etichetta della barra negativa
  // finisce sopra il nome del giocatore.
  const larga = 320
  const RISERVA = 30
  const meta = (larga - ETICHETTA - 12 - RISERVA * 2) / 2
  const zero = ETICHETTA + RISERVA + meta
  const w = (v: number) => (Math.abs(v) / estremo) * meta
  const alta = righe.length * ALTEZZA_RIGA + 4

  return (
    <svg viewBox={`0 0 ${larga} ${alta}`} className="w-full" role="img">
      <line
        x1={zero}
        x2={zero}
        y1={0}
        y2={alta}
        stroke={COLORI.griglia}
        strokeWidth={1}
      />
      {righe.map((r, i) => {
        const y = i * ALTEZZA_RIGA + 4
        const cy = y + BARRA / 2
        const positivo = r.valore >= 0
        const lung = w(r.valore)
        return (
          <g key={r.chiave}>
            <text
              x={ETICHETTA - 8}
              y={cy + 4}
              textAnchor="end"
              fontSize={10}
              fill={COLORI.testo}
            >
              {accorcia(r.etichetta)}
            </text>
            {r.valore !== 0 && (
              <rect
                x={positivo ? zero + 1 : zero - lung}
                y={y}
                width={Math.max(lung - 1, 2)}
                height={BARRA}
                rx={4}
                fill={positivo ? COLORI.nostro : COLORI.loro}
              >
                <title>
                  {r.etichetta}: {r.valore > 0 ? '+' : ''}
                  {r.valore}
                </title>
              </rect>
            )}
            <text
              x={positivo ? zero + lung + 6 : zero - lung - 6}
              y={cy + 4}
              textAnchor={positivo ? 'start' : 'end'}
              fontSize={10}
              fill={COLORI.testo}
              fontWeight="600"
            >
              {r.valore > 0 ? '+' : ''}
              {r.valore}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
