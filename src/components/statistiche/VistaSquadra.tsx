import { useState } from 'react'
import type { Evento, Partita } from '../../db/schema'
import CampoTiri from '../CampoTiri'
import { Riquadro } from './tabella'
import {
  conteggiPerZona,
  contaTiri,
  precisioneTiri,
  risultatoPartita,
  statistichePerTempo,
} from '../../utils/statistiche'
import { formatPercentuale } from '../../utils/colonne'
import { formatXG, xgTotale, ZONE_TIRO } from '../../db/zone'
import type { Fronte } from '../../db/zone'

/**
 * Come sta andando la squadra, senza scendere ai singoli: il bilancio delle
 * partite, quanto si produce e quanto si concede, e le due mappe dei tiri.
 *
 * Le stesse cifre esistono anche nelle altre schede, ma lì sono accanto ai
 * nomi: qui l'unità di misura è la squadra, e il confronto che conta è fra
 * quello che facciamo e quello che subiamo.
 */

export default function VistaSquadra({
  partite,
  eventi,
}: {
  partite: Partita[]
  eventi: Evento[]
}) {
  const [fronteMappa, setFronteMappa] = useState<Fronte>('nostro')

  // Bilancio: una riga per partita, poi si contano.
  let vinte = 0
  let pari = 0
  let perse = 0
  let golFatti = 0
  let golSubiti = 0
  for (const p of partite) {
    const { fatti, subiti } = risultatoPartita(
      eventi.filter((e) => e.partitaId === p.id)
    )
    golFatti += fatti
    golSubiti += subiti
    if (fatti > subiti) vinte += 1
    else if (fatti === subiti) pari += 1
    else perse += 1
  }

  const n = partite.length
  const media = (v: number) => (n === 0 ? '—' : (v / n).toFixed(2))
  const tiriNostri = contaTiri(eventi, 'nostro')
  const tiriLoro = contaTiri(eventi, 'loro')
  const xg = xgTotale(eventi, 'nostro')
  const xga = xgTotale(eventi, 'loro')
  const conteggiZone = conteggiPerZona(eventi, 'nostro')
  const conteggiZoneSubiti = conteggiPerZona(eventi, 'loro')
  const perTempo = statistichePerTempo(partite, eventi)

  return (
    <>
      {/* Bilancio */}
      <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2">
        Bilancio
      </h2>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <Riquadro etichetta="Vinte" valore={vinte} colore="text-emerald-400" />
        <Riquadro etichetta="Pari" valore={pari} colore="text-slate-300" />
        <Riquadro etichetta="Perse" valore={perse} colore="text-red-400" />
      </div>
      <div className="grid grid-cols-3 gap-2 mb-6">
        <Riquadro
          etichetta="Gol fatti"
          valore={golFatti}
          nota={`${media(golFatti)} a partita`}
        />
        <Riquadro
          etichetta="Gol subiti"
          valore={golSubiti}
          nota={`${media(golSubiti)} a partita`}
        />
        <Riquadro
          etichetta="Differenza"
          valore={
            golFatti - golSubiti > 0 ? `+${golFatti - golSubiti}` : golFatti - golSubiti
          }
          colore={
            golFatti > golSubiti
              ? 'text-emerald-400'
              : golFatti < golSubiti
              ? 'text-red-400'
              : 'text-slate-300'
          }
          nota={`${n} ${n === 1 ? 'partita' : 'partite'}`}
        />
      </div>

      {/* Quello che produciamo */}
      <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2">
        Quello che produciamo
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Riquadro
          etichetta="Tiri"
          valore={tiriNostri.totali}
          nota={`${tiriNostri.inPorta} in porta`}
        />
        <Riquadro
          etichetta="Tiri in porta %"
          valore={formatPercentuale(precisioneTiri(tiriNostri))}
          nota={`${tiriNostri.inPorta} su ${tiriNostri.totali}`}
        />
        <Riquadro
          etichetta="xG"
          valore={formatXG(xg)}
          colore="text-emerald-400"
          nota={`${media(xg)} a partita`}
        />
        <Riquadro
          etichetta="Gol − xG"
          valore={`${golFatti - xg > 0 ? '+' : ''}${formatXG(golFatti - xg)}`}
          colore={
            golFatti - xg > 0.05
              ? 'text-emerald-400'
              : golFatti - xg < -0.05
              ? 'text-red-400'
              : 'text-slate-300'
          }
        />
      </div>

      {/* Quello che concediamo */}
      <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2">
        Quello che concediamo
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        <Riquadro
          etichetta="Tiri subiti"
          valore={tiriLoro.totali}
          nota={`${tiriLoro.inPorta} in porta`}
        />
        <Riquadro
          etichetta="Subiti in porta %"
          valore={formatPercentuale(precisioneTiri(tiriLoro))}
          nota={`${tiriLoro.inPorta} su ${tiriLoro.totali}`}
        />
        <Riquadro
          etichetta="xGA"
          valore={formatXG(xga)}
          colore="text-red-400"
          nota={`${media(xga)} a partita`}
        />
        <Riquadro
          etichetta="Subiti − xGA"
          valore={`${golSubiti - xga > 0 ? '+' : ''}${formatXG(golSubiti - xga)}`}
          colore={
            golSubiti - xga < -0.05
              ? 'text-emerald-400'
              : golSubiti - xga > 0.05
              ? 'text-red-400'
              : 'text-slate-300'
          }
        />
      </div>

      {/* Per tempo */}
      {perTempo.length > 1 && (
        <section className="mb-6">
          <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2">
            Tempo per tempo
          </h2>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-xs text-slate-400">
                  <th className="px-2 py-2 text-left font-semibold">Tempo</th>
                  <th className="px-2 py-2 text-right font-semibold">Tiri</th>
                  <th className="px-2 py-2 text-right font-semibold">TP%</th>
                  <th className="px-2 py-2 text-right font-semibold">xG</th>
                  <th className="px-2 py-2 text-right font-semibold">Gol</th>
                  <th className="px-2 py-2 text-right font-semibold">xGA</th>
                  <th className="px-2 py-2 text-right font-semibold">Subiti</th>
                </tr>
              </thead>
              <tbody>
                {perTempo.map((t) => (
                  <tr
                    key={t.tempo}
                    data-tempo={t.tempo}
                    className="border-b border-slate-800/50"
                  >
                    <td className="px-2 py-2">{t.tempo}° tempo</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {t.tiri.totali}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-400">
                      {formatPercentuale(precisioneTiri(t.tiri))}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-emerald-400">
                      {formatXG(t.xG)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums font-semibold">
                      {t.gol}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-red-400">
                      {formatXG(t.xGA)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums font-semibold">
                      {t.subiti}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            xG e xGA sommati sulle partite scelte, tempo per tempo. Gol e subiti
            sono quelli del risultato, autogol compresi.
          </p>
        </section>
      )}

      {/* Mappe */}
      <section>
        <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2">
          Mappa dei tiri
        </h2>
        <div className="grid grid-cols-2 gap-2 mb-2 max-w-sm">
          <button
            onClick={() => setFronteMappa('nostro')}
            className={`py-2 rounded-lg text-sm font-semibold ${
              fronteMappa === 'nostro'
                ? 'bg-emerald-600'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Nostri
          </button>
          <button
            onClick={() => setFronteMappa('loro')}
            className={`py-2 rounded-lg text-sm font-semibold ${
              fronteMappa === 'loro'
                ? 'bg-red-600'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Subiti
          </button>
        </div>
        <div className="max-w-sm">
          <CampoTiri
            modalita="mappa"
            conteggi={fronteMappa === 'nostro' ? conteggiZone : conteggiZoneSubiti}
          />
        </div>
        <p className="text-xs text-slate-500 mt-2">
          In ogni zona i tiri partiti da lì, e sotto quanti hanno preso la porta
          (<strong className="text-slate-400">P</strong>) e quanti sono entrati
          (<strong className="text-slate-400">G</strong>). Più la zona è verde,
          più si è tirato da lì.{' '}
          {fronteMappa === 'loro' &&
            'Qui è la nostra porta: sono le conclusioni che abbiamo concesso.'}
        </p>
      </section>

      <details className="mt-4">
        <summary className="text-xs text-slate-400 cursor-pointer select-none">
          Come viene calcolato l'xG
        </summary>
        <div className="mt-2 text-xs text-slate-500">
          <p className="mb-2">
            Ogni tiro vale un valore fisso in base alla zona da cui è partito. Non
            è un modello allenato: è una tabella tarata su conversioni tipiche del
            calcio a 5, utile per confrontare giocatori e partite tra loro.
          </p>
          <p className="mb-2">
            L'<strong>xGA</strong> è la stessa somma sulle conclusioni che
            subiamo. Se i gol subiti sono più dell'xGA stiamo concedendo meno di
            quanto paghiamo (o il portiere è in giornata storta); se sono meno, il
            contrario.
          </p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            {ZONE_TIRO.map((z) => (
              <li key={z.value} className="flex justify-between">
                <span>{z.label}</span>
                <span className="tabular-nums text-slate-400">
                  {z.peso.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </>
  )
}
