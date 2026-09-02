import { useState } from 'react'
import type { PuntoAndamento } from '../../utils/grafici'
import { formatXG } from '../../db/zone'
import { COLORI, scala } from './tavolozza'
import { Legenda, NienteDati } from './base'

/**
 * Il racconto della partita: xG cumulato dei due fronti minuto per minuto.
 *
 * A gradini, non interpolato: l'xG sale di scatto quando arriva una
 * conclusione e resta fermo in mezzo. Una linea morbida direbbe che nei minuti
 * senza tiri è successo qualcosa, e non è vero.
 */

const L = 34 // margine sinistro per le tacche
const R = 44 // margine destro per l'etichetta di fine linea
const T = 10
const B = 22
const LARGA = 320
const ALTA = 150

interface Props {
  punti: PuntoAndamento[]
  durataTotale: number
  numeroTempi: number
  durataTempo: number
  nostro: string
  loro: string
}

/** Percorso a gradini: orizzontale fino al minuto, poi verticale sul valore. */
function gradini(
  punti: PuntoAndamento[],
  valore: (p: PuntoAndamento) => number,
  x: (m: number) => number,
  y: (v: number) => number
): string {
  if (punti.length === 0) return ''
  const d: string[] = [`M ${x(punti[0].minuto)} ${y(valore(punti[0]))}`]
  for (let i = 1; i < punti.length; i++) {
    d.push(`L ${x(punti[i].minuto)} ${y(valore(punti[i - 1]))}`)
    d.push(`L ${x(punti[i].minuto)} ${y(valore(punti[i]))}`)
  }
  return d.join(' ')
}

export default function AndamentoXG({
  punti,
  durataTotale,
  numeroTempi,
  durataTempo,
  nostro,
  loro,
}: Props) {
  const [sonda, setSonda] = useState<number | null>(null)

  const ultimo = punti[punti.length - 1]
  if (!ultimo || (ultimo.xg === 0 && ultimo.xga === 0)) {
    return (
      <NienteDati testo="Nessuna conclusione con zona registrata in questa partita." />
    )
  }

  const { cima, tacche } = scala(Math.max(ultimo.xg, ultimo.xga))
  const x = (m: number) => L + (m / durataTotale) * (LARGA - L - R)
  const y = (v: number) => T + (1 - v / cima) * (ALTA - T - B)

  const gol = punti.filter((p) => p.gol)

  // il punto della sonda: l'ultimo evento fino al minuto puntato
  const alMinuto = (m: number) => {
    let scelto = punti[0]
    for (const p of punti) if (p.minuto <= m) scelto = p
    return scelto
  }
  const puntato = sonda === null ? null : alMinuto(sonda)

  return (
    <>
      <Legenda
        voci={[
          { colore: COLORI.nostro, label: `${nostro} (xG)` },
          { colore: COLORI.loro, label: `${loro} (xGA)` },
        ]}
      />
      <svg
        viewBox={`0 0 ${LARGA} ${ALTA}`}
        className="w-full touch-none"
        role="img"
        aria-label={`Andamento xG: ${nostro} ${formatXG(ultimo.xg)}, ${loro} ${formatXG(ultimo.xga)}`}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const px = ((e.clientX - r.left) / r.width) * LARGA
          const m = ((px - L) / (LARGA - L - R)) * durataTotale
          setSonda(Math.max(0, Math.min(durataTotale, m)))
        }}
        onPointerLeave={() => setSonda(null)}
      >
        {/* griglia orizzontale */}
        {tacche.map((t) => (
          <g key={t}>
            <line
              x1={L}
              x2={LARGA - R}
              y1={y(t)}
              y2={y(t)}
              stroke={COLORI.griglia}
              strokeWidth={1}
            />
            <text
              x={L - 6}
              y={y(t) + 3}
              textAnchor="end"
              fontSize={9}
              fill={COLORI.testoTenue}
            >
              {t.toFixed(1)}
            </text>
          </g>
        ))}

        {/* fine di ogni tempo */}
        {Array.from({ length: numeroTempi - 1 }, (_, i) => (i + 1) * durataTempo).map(
          (m) => (
            <line
              key={m}
              x1={x(m)}
              x2={x(m)}
              y1={T}
              y2={ALTA - B}
              stroke={COLORI.griglia}
              strokeWidth={1}
            />
          )
        )}

        {/* minuti sull'asse */}
        {Array.from({ length: numeroTempi }, (_, i) => i).map((i) => (
          <text
            key={i}
            x={x(i * durataTempo + durataTempo / 2)}
            y={ALTA - 6}
            textAnchor="middle"
            fontSize={9}
            fill={COLORI.testoTenue}
          >
            {i + 1}° tempo
          </text>
        ))}

        {/* le due linee */}
        <path
          d={gradini(punti, (p) => p.xga, x, y)}
          fill="none"
          stroke={COLORI.loro}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={gradini(punti, (p) => p.xg, x, y)}
          fill="none"
          stroke={COLORI.nostro}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* i gol, con anello in colore superficie per restare leggibili */}
        {gol.map((p, i) => (
          <circle
            key={i}
            cx={x(p.minuto)}
            cy={y(p.gol === 'nostro' ? p.xg : p.xga)}
            r={4}
            fill={p.gol === 'nostro' ? COLORI.nostro : COLORI.loro}
            stroke={COLORI.superficie}
            strokeWidth={2}
          >
            <title>
              {p.gol === 'nostro' ? nostro : loro} — gol al {p.minuto}′
            </title>
          </circle>
        ))}

        {/* valore finale, etichettato direttamente sulla linea */}
        <text
          x={LARGA - R + 4}
          y={y(ultimo.xg) + 3}
          fontSize={10}
          fill={COLORI.testo}
          fontWeight="600"
        >
          {formatXG(ultimo.xg)}
        </text>
        <text
          x={LARGA - R + 4}
          y={y(ultimo.xga) + 3}
          fontSize={10}
          fill={COLORI.testo}
          fontWeight="600"
        >
          {formatXG(ultimo.xga)}
        </text>

        {/* sonda */}
        {puntato && sonda !== null && (
          <g>
            <line
              x1={x(sonda)}
              x2={x(sonda)}
              y1={T}
              y2={ALTA - B}
              stroke={COLORI.testoTenue}
              strokeWidth={1}
            />
            <circle
              cx={x(puntato.minuto)}
              cy={y(puntato.xg)}
              r={3}
              fill={COLORI.nostro}
              stroke={COLORI.superficie}
              strokeWidth={2}
            />
            <circle
              cx={x(puntato.minuto)}
              cy={y(puntato.xga)}
              r={3}
              fill={COLORI.loro}
              stroke={COLORI.superficie}
              strokeWidth={2}
            />
          </g>
        )}
      </svg>
      <p className="text-xs text-slate-400 text-center tabular-nums h-4">
        {puntato
          ? `${puntato.minuto}′ — ${nostro} ${formatXG(puntato.xg)} · ${loro} ${formatXG(puntato.xga)}`
          : ''}
      </p>
    </>
  )
}
