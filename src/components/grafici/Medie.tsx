import type { MedieAmbito } from '../../utils/grafici'
import { COLORI, scala } from './tavolozza'
import { NienteDati } from './base'

/**
 * Le quattro medie a partita, in due gruppi affiancati: a sinistra l'attacco
 * (quanto abbiamo segnato, quanto abbiamo creato), a destra la difesa (quanto
 * abbiamo preso, quanto abbiamo concesso).
 *
 * Un asse solo per tutte e quattro, perché sono tutte gol a partita: è quello
 * che rende leggibile il confronto fra i due lati, non solo dentro ciascuno.
 *
 * Il colore dice di chi è la porta — verde noi, rosso loro — e il riempimento
 * dice se il numero è successo davvero: pieno per i gol contati, contorno per
 * quelli attesi. Così l'identità non è mai affidata al solo colore, e il
 * divario fra le due barre di un gruppo si legge a colpo d'occhio.
 */

const L = 30
const T = 18
const B = 50
const ALTA = 200
const LARGA = 340
const SPESSORE_MAX = 42

interface Barra {
  chiave: string
  etichetta: string
  valore: number
  colore: string
  /** true = numero contato, riempimento pieno. false = atteso, contorno. */
  reale: boolean
  descrizione: string
}

export default function Medie({ medie }: { medie: MedieAmbito }) {
  if (medie.partite === 0) {
    return <NienteDati testo="Nessuna partita conclusa." />
  }

  const gruppi: { titolo: string; barre: Barra[] }[] = [
    {
      titolo: 'Attacco',
      barre: [
        {
          chiave: 'segnato',
          etichetta: 'Segnato',
          valore: medie.golFatti,
          colore: COLORI.nostro,
          reale: true,
          descrizione: 'Gol segnati a partita',
        },
        {
          chiave: 'creato',
          etichetta: 'Creato',
          valore: medie.xg,
          colore: COLORI.nostro,
          reale: false,
          descrizione: 'xG prodotto a partita',
        },
      ],
    },
    {
      titolo: 'Difesa',
      barre: [
        {
          chiave: 'preso',
          etichetta: 'Preso',
          valore: medie.golSubiti,
          colore: COLORI.loro,
          reale: true,
          descrizione: 'Gol subiti a partita',
        },
        {
          chiave: 'concesso',
          etichetta: 'Concesso',
          valore: medie.xga,
          colore: COLORI.loro,
          reale: false,
          descrizione: 'xGA concesso a partita',
        },
      ],
    },
  ]

  const tutte = gruppi.flatMap((g) => g.barre)
  const { cima, tacche } = scala(Math.max(0.5, ...tutte.map((b) => b.valore)))
  const y = (v: number) => T + (1 - v / cima) * (ALTA - T - B)

  const utile = LARGA - L - 10
  const largaGruppo = utile / gruppi.length
  const banda = largaGruppo / 2
  const spessore = Math.min(SPESSORE_MAX, banda - 14)
  const meta = L + largaGruppo

  /** Colonna con la cima arrotondata e la base piantata sull'asse. */
  const colonna = (cx: number, valore: number) => {
    const cimaY = y(valore)
    const base = y(0)
    // Sotto i 4px l'arrotondamento non ci sta: la barra resta un rettangolo.
    const r = Math.min(4, Math.max(0, (base - cimaY) / 2))
    const sx = cx - spessore / 2
    const dx = cx + spessore / 2
    return `M ${sx} ${base}
            L ${sx} ${cimaY + r}
            Q ${sx} ${cimaY} ${sx + r} ${cimaY}
            L ${dx - r} ${cimaY}
            Q ${dx} ${cimaY} ${dx} ${cimaY + r}
            L ${dx} ${base} Z`
  }

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <svg
        viewBox={`0 0 ${LARGA} ${ALTA}`}
        className="w-full"
        style={{ minWidth: 280 }}
        role="img"
        aria-label={
          `Medie a partita su ${medie.partite} partite: ` +
          tutte.map((b) => `${b.etichetta} ${b.valore.toFixed(2)}`).join(', ')
        }
      >
        {tacche.map((t) => (
          <g key={t}>
            <line
              x1={L}
              x2={LARGA - 6}
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

        {/* Il confine fra i due gruppi: tenue, serve solo a dire che si cambia lato */}
        <line
          x1={meta}
          x2={meta}
          y1={T - 6}
          y2={ALTA - B + 22}
          stroke={COLORI.griglia}
          strokeWidth={1}
          strokeDasharray="3 3"
        />

        {gruppi.map((g, ig) =>
          g.barre.map((b, ib) => {
            const cx = L + largaGruppo * ig + banda * (ib + 0.5)
            return (
              <g key={b.chiave}>
                <path
                  d={colonna(cx, b.valore)}
                  fill={b.colore}
                  fillOpacity={b.reale ? 1 : 0.22}
                  stroke={b.reale ? 'none' : b.colore}
                  strokeWidth={b.reale ? 0 : 2}
                >
                  <title>
                    {b.descrizione}: {b.valore.toFixed(2)}
                  </title>
                </path>
                <text
                  x={cx}
                  y={y(b.valore) - 5}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={600}
                  fill={COLORI.testo}
                >
                  {b.valore.toFixed(2)}
                </text>
                <text
                  x={cx}
                  y={ALTA - B + 16}
                  textAnchor="middle"
                  fontSize={10}
                  fill={COLORI.testo}
                >
                  {b.etichetta}
                </text>
              </g>
            )
          })
        )}

        {gruppi.map((g, ig) => (
          <text
            key={g.titolo}
            x={L + largaGruppo * (ig + 0.5)}
            y={ALTA - 8}
            textAnchor="middle"
            fontSize={9}
            fill={COLORI.testoTenue}
            letterSpacing={1}
          >
            {g.titolo.toUpperCase()}
          </text>
        ))}
      </svg>
    </div>
  )
}
