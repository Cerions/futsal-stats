import type { RigaPartita } from '../../utils/grafici'
import { formatXG } from '../../db/zone'
import { COLORI, scala } from './tavolozza'
import { NienteDati } from './base'

/**
 * Una colonna per partita: l'xG creato, con un trattino sul numero di gol
 * davvero segnati. Sopra il trattino hai raccolto più di quanto creavi, sotto
 * meno. Colonna e trattino sono la stessa unità (gol), quindi un asse solo.
 */

const L = 26
const T = 12
const B = 34
const ALTA = 150
const PER_COLONNA = 46

interface Props {
  righe: RigaPartita[]
  fronte: 'nostro' | 'loro'
}

export default function PerPartita({ righe, fronte }: Props) {
  if (righe.length === 0) {
    return <NienteDati testo="Nessuna partita conclusa." />
  }
  const nostro = fronte === 'nostro'
  const colore = nostro ? COLORI.nostro : COLORI.loro
  const valoreXG = (r: RigaPartita) => (nostro ? r.xg : r.xga)
  const valoreGol = (r: RigaPartita) => (nostro ? r.gol : r.golSubiti)

  const larga = Math.max(220, L + righe.length * PER_COLONNA + 12)
  const { cima, tacche } = scala(
    Math.max(1, ...righe.map((r) => Math.max(valoreXG(r), valoreGol(r))))
  )
  const y = (v: number) => T + (1 - v / cima) * (ALTA - T - B)
  const banda = (larga - L - 12) / righe.length
  const spessore = Math.min(24, banda - 10)

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <svg
        viewBox={`0 0 ${larga} ${ALTA}`}
        style={{ minWidth: larga * 0.85 }}
        className="w-full"
        role="img"
        aria-label={`${nostro ? 'xG e gol' : 'xGA e gol subiti'} partita per partita`}
      >
        {tacche.map((t) => (
          <g key={t}>
            <line
              x1={L}
              x2={larga - 6}
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
              {t}
            </text>
          </g>
        ))}

        {righe.map((r, i) => {
          const cx = L + banda * (i + 0.5)
          const xg = valoreXG(r)
          const gol = valoreGol(r)
          const altezza = Math.max(0, y(xg) - y(0)) * -1
          return (
            <g key={r.partitaId}>
              {/* colonna xG: estremità arrotondata in cima, squadrata alla base */}
              <path
                d={`M ${cx - spessore / 2} ${y(0)}
                    L ${cx - spessore / 2} ${y(xg) + 4}
                    Q ${cx - spessore / 2} ${y(xg)} ${cx - spessore / 2 + 4} ${y(xg)}
                    L ${cx + spessore / 2 - 4} ${y(xg)}
                    Q ${cx + spessore / 2} ${y(xg)} ${cx + spessore / 2} ${y(xg) + 4}
                    L ${cx + spessore / 2} ${y(0)} Z`}
                fill={colore}
                opacity={0.55}
              >
                <title>
                  {r.avversario}: {nostro ? 'xG' : 'xGA'} {formatXG(xg)},{' '}
                  {nostro ? 'gol' : 'gol subiti'} {gol}
                </title>
              </path>
              {/* i gol veri: trattino spesso sullo stesso asse */}
              <line
                x1={cx - spessore / 2 - 3}
                x2={cx + spessore / 2 + 3}
                y1={y(gol)}
                y2={y(gol)}
                stroke={colore}
                strokeWidth={3}
                strokeLinecap="round"
              />
              <text
                x={cx}
                y={ALTA - 20}
                textAnchor="middle"
                fontSize={9}
                fill={COLORI.testo}
              >
                {r.avversario.length > 9
                  ? r.avversario.slice(0, 8) + '…'
                  : r.avversario}
              </text>
              <text
                x={cx}
                y={ALTA - 8}
                textAnchor="middle"
                fontSize={9}
                fill={COLORI.testoTenue}
              >
                {gol} · {formatXG(xg)}
              </text>
              {void altezza}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
