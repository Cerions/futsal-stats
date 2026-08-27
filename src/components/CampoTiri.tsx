import type { ZonaTiro } from '../db/schema'
import { ZONE_TIRO, zonaLabelCorta, pesoZona } from '../db/zone'

/**
 * Metà campo offensiva di calcio a 5 disegnata in SVG.
 *
 * Coordinate: viewBox 200x200, dove 10 unità = 1 metro (metà campo 20m x 20m).
 * Porta in alto, larga 3m (x da 85 a 115). L'area di rigore del futsal è il
 * classico "D": due quarti di cerchio di raggio 6m centrati sui pali, uniti
 * da un segmento di 3m.
 *
 * Ogni zona è un path chiuso disegnato esplicitamente: niente clip-path, così
 * le aree cliccabili non si sovrappongono mai tra loro.
 */

/** Profondità della "D" all'altezza dei confini di corsia (x = 60 e x = 140). */
const Y_ARCO = 54.5436 // = sqrt(60² - 25²)
/** Confini verticali tra corsia sinistra / centrale / destra. */
const X_SX = 60
const X_DX = 140
/** Oltre questa profondità il tiro è "da lontano". */
const Y_DISTANZA = 130

/** Contorno completo dell'area di rigore, usato per le linee del campo. */
const PATH_AREA = 'M 25 0 A 60 60 0 0 0 85 60 L 115 60 A 60 60 0 0 0 175 0 Z'

interface RegioneCampo {
  zona: ZonaTiro
  d: string
  label: { x: number; y: number }
}

const REGIONI: RegioneCampo[] = [
  {
    zona: 'AREA_SINISTRA',
    d: `M 25 0 L ${X_SX} 0 L ${X_SX} ${Y_ARCO} A 60 60 0 0 1 25 0 Z`,
    label: { x: 44, y: 24 },
  },
  {
    zona: 'AREA_CENTRALE',
    d:
      `M ${X_SX} 0 L ${X_DX} 0 L ${X_DX} ${Y_ARCO} ` +
      `A 60 60 0 0 1 115 60 L 85 60 A 60 60 0 0 1 ${X_SX} ${Y_ARCO} Z`,
    label: { x: 100, y: 32 },
  },
  {
    zona: 'AREA_DESTRA',
    d: `M 175 0 L ${X_DX} 0 L ${X_DX} ${Y_ARCO} A 60 60 0 0 0 175 0 Z`,
    label: { x: 156, y: 24 },
  },
  {
    zona: 'FUORI_SINISTRA',
    d: `M 0 0 L 25 0 A 60 60 0 0 0 ${X_SX} ${Y_ARCO} L ${X_SX} ${Y_DISTANZA} L 0 ${Y_DISTANZA} Z`,
    label: { x: 30, y: 95 },
  },
  {
    zona: 'FUORI_CENTRALE',
    d:
      `M ${X_SX} ${Y_ARCO} A 60 60 0 0 0 85 60 L 115 60 ` +
      `A 60 60 0 0 0 ${X_DX} ${Y_ARCO} L ${X_DX} ${Y_DISTANZA} L ${X_SX} ${Y_DISTANZA} Z`,
    label: { x: 100, y: 95 },
  },
  {
    zona: 'FUORI_DESTRA',
    d: `M 200 0 L 175 0 A 60 60 0 0 1 ${X_DX} ${Y_ARCO} L ${X_DX} ${Y_DISTANZA} L 200 ${Y_DISTANZA} Z`,
    label: { x: 170, y: 95 },
  },
  {
    zona: 'DISTANZA',
    d: `M 0 ${Y_DISTANZA} L 200 ${Y_DISTANZA} L 200 200 L 0 200 Z`,
    label: { x: 100, y: 165 },
  },
]

export interface ConteggioZona {
  tiri: number
  gol: number
}

interface Props {
  /** 'seleziona': zone cliccabili. 'mappa': heatmap in sola lettura. */
  modalita: 'seleziona' | 'mappa'
  selezionata?: ZonaTiro | null
  onSelect?: (z: ZonaTiro) => void
  /** solo in modalità 'mappa' */
  conteggi?: Map<ZonaTiro, ConteggioZona>
  /**
   * Mostra i bottoni rigore / tiro libero. Da spegnere quando si sceglie
   * il punto di battuta di una punizione o di una rimessa: lì non ha senso.
   */
  mostraDaFermo?: boolean
}

export default function CampoTiri({
  modalita,
  selezionata = null,
  onSelect,
  conteggi,
  mostraDaFermo = true,
}: Props) {
  const seleziona = modalita === 'seleziona'
  const maxTiri = conteggi
    ? Math.max(1, ...Array.from(conteggi.values()).map((c) => c.tiri))
    : 1

  function fillZona(z: ZonaTiro): string {
    if (seleziona) {
      return selezionata === z ? 'rgba(16,185,129,0.55)' : 'rgba(148,163,184,0.07)'
    }
    const c = conteggi?.get(z)
    if (!c || c.tiri === 0) return 'rgba(148,163,184,0.05)'
    const intensita = c.tiri / maxTiri
    return `rgba(16,185,129,${(0.12 + 0.5 * intensita).toFixed(3)})`
  }

  function testoZona(z: ZonaTiro): string {
    if (seleziona) return zonaLabelCorta(z)
    const c = conteggi?.get(z)
    if (!c || c.tiri === 0) return '—'
    return `${c.gol}/${c.tiri}`
  }

  const daFermo = mostraDaFermo ? ZONE_TIRO.filter((z) => z.daFermo) : []

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox="0 0 200 200"
        className="w-full h-auto rounded-lg bg-slate-900 border border-slate-700 select-none"
        role={seleziona ? 'group' : 'img'}
        aria-label={seleziona ? 'Seleziona la zona del tiro' : 'Mappa dei tiri per zona'}
      >
        {/* Zone */}
        {REGIONI.map((r) => (
          <path
            key={r.zona}
            d={r.d}
            data-zona={r.zona}
            fill={fillZona(r.zona)}
            onClick={seleziona ? () => onSelect?.(r.zona) : undefined}
            style={seleziona ? { cursor: 'pointer' } : { pointerEvents: 'none' }}
          >
            {seleziona && <title>{zonaLabelCorta(r.zona)}</title>}
          </path>
        ))}

        {/* Linee del campo */}
        <g fill="none" stroke="rgb(100,116,139)" strokeWidth="1.2" pointerEvents="none">
          <rect x="1" y="1" width="198" height="198" rx="2" />
          <path d={PATH_AREA} />
          <line x1={X_SX} y1="0" x2={X_SX} y2={Y_DISTANZA} strokeDasharray="4 4" />
          <line x1={X_DX} y1="0" x2={X_DX} y2={Y_DISTANZA} strokeDasharray="4 4" />
          <line x1="0" y1={Y_DISTANZA} x2="200" y2={Y_DISTANZA} strokeDasharray="4 4" />
        </g>

        {/* Porta */}
        <line
          x1="85"
          y1="3"
          x2="115"
          y2="3"
          stroke="rgb(226,232,240)"
          strokeWidth="4"
          strokeLinecap="round"
          pointerEvents="none"
        />

        {/* Dischetti: rigore 6m, tiro libero 10m */}
        <circle cx="100" cy="60" r="2.5" fill="rgb(100,116,139)" pointerEvents="none" />
        <circle cx="100" cy="100" r="2.5" fill="rgb(100,116,139)" pointerEvents="none" />

        {/* Etichette */}
        {REGIONI.map((r) => (
          <text
            key={`t-${r.zona}`}
            x={r.label.x}
            y={r.label.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={seleziona ? 7.5 : 10}
            fontWeight="600"
            fill="rgb(203,213,225)"
            pointerEvents="none"
          >
            {testoZona(r.zona)}
          </text>
        ))}
      </svg>

      {/* Situazioni da fermo: fuori dal disegno, sono più comode come bottoni */}
      <div className={`grid grid-cols-2 gap-2 ${daFermo.length === 0 ? 'hidden' : ''}`}>
        {daFermo.map((z) => {
          const c = conteggi?.get(z.value)
          const attiva = selezionata === z.value
          if (seleziona) {
            return (
              <button
                key={z.value}
                type="button"
                data-zona={z.value}
                onClick={() => onSelect?.(z.value)}
                className={`py-2.5 rounded-lg text-sm font-semibold border ${
                  attiva
                    ? 'bg-emerald-600 border-emerald-500'
                    : 'bg-slate-900 border-slate-700 hover:bg-slate-700'
                }`}
              >
                {z.labelCorta}
                <span className="block text-[10px] font-normal opacity-70">
                  xG {pesoZona(z.value).toFixed(2)}
                </span>
              </button>
            )
          }
          return (
            <div
              key={z.value}
              className="py-2 rounded-lg text-center text-sm bg-slate-900 border border-slate-700"
            >
              <span className="text-slate-400">{z.labelCorta}</span>{' '}
              <span className="font-semibold tabular-nums">
                {c ? `${c.gol}/${c.tiri}` : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
