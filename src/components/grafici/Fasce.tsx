import type { Fascia } from '../../utils/grafici'
import { COLORI } from './tavolozza'
import { Legenda, NienteDati } from './base'

/**
 * Quando succedono le cose: colonne divergenti attorno a uno zero.
 * Sopra quello che facciamo noi, sotto quello che subiamo — la polarità è la
 * cosa che conta, e leggerla come specchio è immediato.
 *
 * Le fasce sono dentro ciascun tempo, non sul minuto assoluto: «primi 5 del
 * secondo tempo» significa la stessa cosa anche fra partite di durata diversa.
 */

const L = 22
/** altezza massima di una colonna, per lato */
const ALTA_META = 44
/** lo zero non sta a metà: sopra serve aria per l'etichetta del valore */
const ZERO = 56
/** sotto lo zero: colonna + etichetta + minuti + nome del tempo */
const ALTA = 140
const PER_FASCIA = 26

interface Props {
  fasce: Fascia[]
  misura: 'gol' | 'conclusioni'
}

export default function Fasce({ fasce, misura }: Props) {
  const sopra = (f: Fascia) => (misura === 'gol' ? f.golFatti : f.tiri)
  const sotto = (f: Fascia) => (misura === 'gol' ? f.golSubiti : f.tiriSubiti)
  const massimo = Math.max(1, ...fasce.map((f) => Math.max(sopra(f), sotto(f))))
  if (fasce.every((f) => sopra(f) === 0 && sotto(f) === 0)) {
    return <NienteDati testo="Ancora niente da mostrare per questa misura." />
  }

  const larga = Math.max(280, L + fasce.length * PER_FASCIA + 10)
  const banda = (larga - L - 10) / fasce.length
  const spessore = Math.min(24, banda - 6)
  const h = (v: number) => (v / massimo) * ALTA_META
  const zero = ZERO

  // dove cambia il tempo, per il separatore
  const confini = fasce
    .map((f, i) => (i > 0 && f.tempo !== fasce[i - 1].tempo ? i : -1))
    .filter((i) => i >= 0)

  return (
    <>
      <Legenda
        voci={[
          { colore: COLORI.nostro, label: misura === 'gol' ? 'Gol fatti' : 'Nostre conclusioni' },
          { colore: COLORI.loro, label: misura === 'gol' ? 'Gol subiti' : 'Conclusioni subite' },
        ]}
      />
      <div className="overflow-x-auto -mx-1 px-1">
        <svg
          viewBox={`0 0 ${larga} ${ALTA}`}
          style={{ minWidth: larga * 0.85 }}
          className="w-full"
          role="img"
          aria-label={`${misura} per fasce di 5 minuti`}
        >
          <line
            x1={L}
            x2={larga - 6}
            y1={zero}
            y2={zero}
            stroke={COLORI.griglia}
            strokeWidth={1}
          />
          {confini.map((i) => (
            <line
              key={i}
              x1={L + banda * i}
              x2={L + banda * i}
              y1={4}
              y2={ZERO + ALTA_META + 4}
              stroke={COLORI.griglia}
              strokeWidth={1}
            />
          ))}

          {fasce.map((f, i) => {
            const cx = L + banda * (i + 0.5)
            const su = sopra(f)
            const giu = sotto(f)
            const x0 = cx - spessore / 2
            return (
              <g key={`${f.tempo}-${f.da}`}>
                {su > 0 && (
                  <path
                    d={`M ${x0} ${zero - 1}
                        L ${x0} ${zero - h(su) + 4}
                        Q ${x0} ${zero - h(su)} ${x0 + 4} ${zero - h(su)}
                        L ${x0 + spessore - 4} ${zero - h(su)}
                        Q ${x0 + spessore} ${zero - h(su)} ${x0 + spessore} ${zero - h(su) + 4}
                        L ${x0 + spessore} ${zero - 1} Z`}
                    fill={COLORI.nostro}
                  >
                    <title>
                      T{f.tempo} {f.da}-{f.a}′: {su}
                    </title>
                  </path>
                )}
                {giu > 0 && (
                  <path
                    d={`M ${x0} ${zero + 1}
                        L ${x0} ${zero + h(giu) - 4}
                        Q ${x0} ${zero + h(giu)} ${x0 + 4} ${zero + h(giu)}
                        L ${x0 + spessore - 4} ${zero + h(giu)}
                        Q ${x0 + spessore} ${zero + h(giu)} ${x0 + spessore} ${zero + h(giu) - 4}
                        L ${x0 + spessore} ${zero + 1} Z`}
                    fill={COLORI.loro}
                  >
                    <title>
                      T{f.tempo} {f.da}-{f.a}′: {giu}
                    </title>
                  </path>
                )}
                {su > 0 && (
                  <text
                    x={cx}
                    y={zero - h(su) - 3}
                    textAnchor="middle"
                    fontSize={9}
                    fill={COLORI.testo}
                  >
                    {su}
                  </text>
                )}
                {giu > 0 && (
                  <text
                    x={cx}
                    y={zero + h(giu) + 10}
                    textAnchor="middle"
                    fontSize={9}
                    fill={COLORI.testo}
                  >
                    {giu}
                  </text>
                )}
                <text
                  x={cx}
                  y={ALTA - 18}
                  textAnchor="middle"
                  fontSize={8}
                  fill={COLORI.testoTenue}
                >
                  {f.da}
                </text>
              </g>
            )
          })}

          {/* etichetta del tempo, sotto le sue fasce */}
          {Array.from(new Set(fasce.map((f) => f.tempo))).map((t) => {
            const indici = fasce
              .map((f, i) => (f.tempo === t ? i : -1))
              .filter((i) => i >= 0)
            const centro = L + banda * ((indici[0] + indici[indici.length - 1] + 1) / 2)
            return (
              <text
                key={t}
                x={centro}
                y={ALTA - 4}
                textAnchor="middle"
                fontSize={9}
                fill={COLORI.testo}
              >
                {t}° tempo
              </text>
            )
          })}
        </svg>
      </div>
    </>
  )
}
