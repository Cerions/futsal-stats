import { useState } from 'react'
import type { Evento, Giocatore, Partita } from '../../db/schema'
import type { StatsGiocatore } from '../../utils/statistiche'
import { statistichePerOrigine } from '../../utils/statistiche'
import { andamentoPartita, perFasce, rendimentoPerPartita } from '../../utils/grafici'
import { formatXG, origineIcona, origineLabelCorta } from '../../db/zone'
import { nomeCorto } from '../../utils/giocatore'
import AndamentoXG from './AndamentoXG'
import PerPartita from './PerPartita'
import Fasce from './Fasce'
import { BarreDivergenti, BarreOrizzontali } from './BarreOrizzontali'
import { COLORI } from './tavolozza'
import { Legenda, NienteDati, TitoloGrafico } from './base'

/**
 * La sezione grafici, uguale per una partita sola e per tutta la stagione:
 * riceve già l'ambito scelto e cambia solo il primo riquadro, dove su una
 * partita ha senso il minuto per minuto e sulla stagione il confronto fra
 * partite.
 */

interface Props {
  /** le partite dell'ambito: una sola, oppure tutte quelle concluse */
  partite: Partita[]
  eventi: Evento[]
  rosa: Giocatore[]
  stats: StatsGiocatore[]
  nomeAvversario: (id: number) => string
  nomeSquadra: string
}

function Riquadro({
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

export default function SezioneGrafici({
  partite,
  eventi,
  rosa,
  stats,
  nomeAvversario,
  nomeSquadra,
}: Props) {
  const [misuraFasce, setMisuraFasce] = useState<'gol' | 'conclusioni'>('gol')

  if (partite.length === 0) {
    return <NienteDati testo="Nessuna partita conclusa: i grafici arrivano dopo la prima." />
  }

  const unaSola = partite.length === 1
  const partita = partite[0]

  // ----- 1. racconto -----
  const racconto = unaSola ? andamentoPartita(partita, eventi) : null
  const perPartita = unaSola
    ? []
    : rendimentoPerPartita(partite, eventi, nomeAvversario)

  // ----- 2. fasce -----
  const fasce = perFasce(partite, eventi)

  // ----- 3. origini -----
  const origini = statistichePerOrigine(eventi)
    .filter((o) => o.tiri > 0)
    .sort((a, b) => b.tiri - a.tiri)

  // ----- 4. giocatori -----
  const giocanti = stats
    .filter((s) => s.minutiGiocati > 0 || s.tiri > 0)
    .sort((a, b) => b.minutiGiocati - a.minutiGiocati)
  const perXG = [...giocanti]
    .filter((s) => s.tiri > 0)
    .sort((a, b) => b.xG - a.xG)
    .slice(0, 12)
  const perPiuMeno = [...giocanti]
    .sort((a, b) => b.golPro - b.golContro - (a.golPro - a.golContro))
    .slice(0, 12)

  return (
    <>
      {/* ===== 1. Il racconto ===== */}
      {unaSola ? (
        <Riquadro
          titolo="Racconto della partita"
          sottotitolo="Occasioni accumulate minuto per minuto. I cerchi sono i gol: sopra la linea dell'avversario hai creato più di lui."
        >
          <AndamentoXG
            punti={racconto!.punti}
            durataTotale={racconto!.durataTotale}
            numeroTempi={partita.config.numeroTempi}
            durataTempo={partita.config.durataTempoMinuti}
            nostro={nomeSquadra}
            loro={nomeAvversario(partita.avversarioId)}
          />
        </Riquadro>
      ) : (
        <>
          <Riquadro
            titolo="Quanto abbiamo creato, quanto abbiamo segnato"
            sottotitolo="La colonna è l'xG, il trattino i gol veri. Trattino sopra la colonna: hai raccolto più di quanto creavi."
          >
            <PerPartita righe={perPartita} fronte="nostro" />
          </Riquadro>
          <Riquadro
            titolo="Quanto abbiamo concesso, quanto abbiamo preso"
            sottotitolo="Stessa lettura dall'altra parte: colonna xGA, trattino gol subiti. Trattino sotto: il portiere ha parato più del previsto."
          >
            <PerPartita righe={perPartita} fronte="loro" />
          </Riquadro>
        </>
      )}

      {/* ===== 2. Quando succedono le cose ===== */}
      <Riquadro
        titolo="Quando succedono le cose"
        sottotitolo="Fasce di 5 minuti dentro ogni tempo. Sopra lo zero quello che facciamo noi, sotto quello che subiamo."
      >
        <div className="grid grid-cols-2 gap-2 mb-3">
          {(
            [
              ['gol', 'Gol'],
              ['conclusioni', 'Conclusioni'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setMisuraFasce(v)}
              className={`py-1.5 rounded-lg text-sm font-semibold ${
                misuraFasce === v
                  ? 'bg-slate-700 text-slate-100'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Fasce fasce={fasce} misura={misuraFasce} />
      </Riquadro>

      {/* ===== 3. Da dove nascono ===== */}
      <Riquadro
        titolo="Da dove nascono le conclusioni"
        sottotitolo="Lunghezza della barra: quante conclusioni. La parte piena sono i gol, alla punta l'xG prodotto."
      >
        {origini.length === 0 ? (
          <NienteDati testo="Nessuna conclusione registrata." />
        ) : (
          <>
            <Legenda
              voci={[
                { colore: COLORI.nostro, label: 'Gol' },
                { colore: COLORI.neutro, label: 'Altre conclusioni' },
              ]}
            />
            <BarreOrizzontali
              vuoto="Nessuna conclusione registrata."
              righe={origini.map((o) => ({
                chiave: o.origine,
                etichetta: `${origineIcona(o.origine)} ${origineLabelCorta(o.origine)}`,
                valore: o.gol,
                resto: o.tiri - o.gol,
                nota: `${o.tiri} · xG ${formatXG(o.xG)}`,
              }))}
            />
          </>
        )}
      </Riquadro>

      {/* ===== 4. I giocatori ===== */}
      <Riquadro
        titolo="Minuti giocati"
        sottotitolo="Chi ha retto il peso della partita."
      >
        <BarreOrizzontali
          vuoto="Nessun minuto registrato."
          righe={giocanti.map((s) => ({
            chiave: String(s.giocatore.id),
            etichetta: nomeCorto(s.giocatore),
            valore: s.minutiGiocati,
          }))}
          formatta={(v) => `${v}′`}
        />
      </Riquadro>

      <Riquadro
        titolo="Gol attesi e gol segnati"
        sottotitolo="La barra è l'xG prodotto, il trattino i gol veri. Chi finalizza sopra le proprie occasioni sta a destra del trattino."
      >
        <BarreOrizzontali
          vuoto="Nessuna conclusione registrata."
          righe={perXG.map((s) => ({
            chiave: String(s.giocatore.id),
            etichetta: nomeCorto(s.giocatore),
            valore: s.xG,
            marcatore: s.gol,
            nota: `${s.gol} gol · xG ${formatXG(s.xG)}`,
          }))}
          formatta={formatXG}
        />
      </Riquadro>

      <Riquadro
        titolo="Più / meno"
        sottotitolo="Gol della squadra meno gol subiti, mentre era in campo."
      >
        <BarreDivergenti
          vuoto="Nessun giocatore in campo."
          righe={perPiuMeno.map((s) => ({
            chiave: String(s.giocatore.id),
            etichetta: nomeCorto(s.giocatore),
            valore: s.golPro - s.golContro,
          }))}
        />
      </Riquadro>

      <p className="text-xs text-slate-500">
        Tocca o passa sopra una barra per il dettaglio. I numeri esatti stanno
        anche nelle tabelle delle altre viste.
      </p>
      {void rosa}
    </>
  )
}
