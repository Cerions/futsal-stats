import { nomeCorto } from '../../utils/giocatore'
import { formatXG } from '../../db/zone'
import {
  MINUTI_PARTITA,
  golEvitati,
  golOgniPartita,
  percentualeParate,
} from '../../utils/portieri'
import type { StatsPortiere } from '../../utils/portieri'
import { BarreOrizzontali, BarreDivergenti } from '../grafici/BarreOrizzontali'
import { COLORI } from '../grafici/tavolozza'
import { NienteDati, TitoloGrafico } from '../grafici/base'

/**
 * I portieri, con il metro che serve a loro.
 *
 * I gol subiti in assoluto dicono poco: chi gioca di più ne prende di più, e
 * chi ha davanti una difesa che regala occasioni pure. Quindi accanto al totale
 * c'è la media rapportata a una partita piena, la quota di conclusioni tenute
 * fuori, e soprattutto il divario fra l'xGA affrontato e i gol presi — l'unico
 * numero che prova a separare il portiere da quello che gli succede intorno.
 */

function Sezione({
  titolo,
  sottotitolo,
  children,
}: {
  titolo: string
  sottotitolo?: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-slate-800 rounded-xl p-4 mb-4">
      <TitoloGrafico titolo={titolo} sottotitolo={sottotitolo} />
      {children}
    </section>
  )
}

export default function VistaPortieri({ portieri }: { portieri: StatsPortiere[] }) {
  if (portieri.length === 0) {
    return (
      <NienteDati testo="Nessun portiere in rosa: assegna il ruolo dal setup della stagione." />
    )
  }
  const giocanti = portieri.filter((p) => p.minutiGiocati > 0)
  if (giocanti.length === 0) {
    return <NienteDati testo="Nessun portiere ha ancora giocato in queste partite." />
  }

  const perc = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`)

  return (
    <>
      <div className="overflow-x-auto -mx-4 px-4 mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-xs text-slate-400">
              <th className="px-2 py-2 text-left font-semibold sticky left-0 bg-slate-900">
                Portiere
              </th>
              <th className="px-2 py-2 text-right font-semibold">PG</th>
              <th className="px-2 py-2 text-right font-semibold">Min</th>
              <th className="px-2 py-2 text-right font-semibold">GS</th>
              <th
                className="px-2 py-2 text-right font-semibold"
                title={`Gol subiti rapportati a ${MINUTI_PARTITA} minuti`}
              >
                GS/{MINUTI_PARTITA}′
              </th>
              <th className="px-2 py-2 text-right font-semibold">Parate</th>
              <th className="px-2 py-2 text-right font-semibold">%P</th>
              <th className="px-2 py-2 text-right font-semibold">xGA</th>
              <th className="px-2 py-2 text-right font-semibold">Evitati</th>
              <th className="px-2 py-2 text-right font-semibold">Pulite</th>
            </tr>
          </thead>
          <tbody>
            {giocanti.map((p) => {
              const ogni = golOgniPartita(p)
              const evitati = golEvitati(p)
              return (
                <tr
                  key={p.giocatore.id}
                  data-portiere={p.giocatore.id}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30"
                >
                  <td className="px-2 py-2 sticky left-0 bg-slate-900 font-medium">
                    {nomeCorto(p.giocatore)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {p.partiteGiocate}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {p.minutiGiocati}′
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums font-semibold">
                    {p.golSubiti}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-300">
                    {ogni === null ? '—' : ogni.toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{p.parate}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-400">
                    {perc(percentualeParate(p))}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-red-400">
                    {formatXG(p.xga)}
                  </td>
                  <td
                    className={`px-2 py-2 text-right tabular-nums font-semibold ${
                      evitati > 0.05
                        ? 'text-emerald-400'
                        : evitati < -0.05
                        ? 'text-red-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {evitati > 0 ? '+' : ''}
                    {formatXG(evitati)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-400">
                    {p.partiteSenzaGol}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Sezione
        titolo={`Gol subiti ogni ${MINUTI_PARTITA} minuti`}
        sottotitolo="Rapportati a una partita piena, così chi ha giocato poco si confronta con chi ha giocato tutto. Più corta è la barra, meglio è."
      >
        <BarreOrizzontali
          colore={COLORI.loro}
          vuoto="Nessun minuto giocato."
          righe={giocanti.map((p) => ({
            chiave: String(p.giocatore.id),
            etichetta: nomeCorto(p.giocatore),
            valore: golOgniPartita(p) ?? 0,
            nota: `${p.golSubiti} in ${p.minutiGiocati}′`,
          }))}
          formatta={(v) => v.toFixed(2)}
        />
      </Sezione>

      <Sezione
        titolo="Gol evitati"
        sottotitolo="xGA affrontato meno gol presi. A destra dello zero ha tenuto fuori più di quanto valevano le conclusioni subite; a sinistra, meno."
      >
        <BarreDivergenti
          vuoto="Nessuna conclusione subita."
          righe={giocanti.map((p) => ({
            chiave: String(p.giocatore.id),
            etichetta: nomeCorto(p.giocatore),
            valore: Number(golEvitati(p).toFixed(2)),
          }))}
        />
      </Sezione>

      <div className="text-xs text-slate-500 space-y-1">
        <p>
          <strong className="text-slate-400">GS</strong>: gol subiti mentre era in
          porta, autogol nostri compresi •{' '}
          <strong className="text-slate-400">GS/{MINUTI_PARTITA}′</strong>: gli
          stessi gol rapportati a una partita piena
        </p>
        <p>
          <strong className="text-slate-400">%P</strong>: parate su conclusioni in
          porta affrontate — gli autogol restano fuori, non sono parate mancate •{' '}
          <strong className="text-slate-400">Pulite</strong>: partite giocate senza
          prendere gol
        </p>
        <p>
          <strong className="text-slate-400">Evitati</strong>: xGA meno gol subiti.
          È il numero che prova a separare il portiere dalla difesa davanti a lui:
          a parità di gol presi, chi ha affrontato conclusioni più pericolose sta
          più in alto.
        </p>
      </div>
    </>
  )
}
