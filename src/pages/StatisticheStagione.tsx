import { useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { calcolaStatistiche, risultatoPartita } from '../utils/statistiche'
import { statistichePortieri } from '../utils/portieri'
import { formatData } from '../utils/format'
import { ordineRuolo } from '../db/ruoli'
import { nomeSquadra } from '../utils/stagione'
import SezioneGrafici from '../components/grafici/SezioneGrafici'
import FiltroPartite from '../components/FiltroPartite'
import { ePreset, partiteDelPreset } from '../utils/preset'
import type { Preset } from '../utils/preset'
import VistaSquadra from '../components/statistiche/VistaSquadra'
import VistaPortieri from '../components/statistiche/VistaPortieri'
import VistaQuintetti from '../components/statistiche/VistaQuintetti'
import VistaInattive from '../components/statistiche/VistaInattive'
import {
  TabellaGenerali,
  TabellaTiri,
} from '../components/statistiche/VistaGiocatori'
import { valoreColonna } from '../utils/colonne'
import type { ColonnaOrdinabile, Ordinamento } from '../utils/colonne'

/**
 * Le statistiche, divise per soggetto invece che per tipo di numero.
 *
 * Prima era una pagina sola con quattro schede, e ogni aggiunta la allungava.
 * Ora il primo livello dice DI CHI si parla — la squadra, i giocatori, i
 * portieri, i quintetti — e il secondo, dove serve, che taglio dare. È la
 * domanda che ci si fa arrivando qui: «come sta andando la squadra» e «come sta
 * andando Rossi» non si leggono nella stessa tabella.
 */

type Sezione = 'squadra' | 'giocatori' | 'portieri' | 'quintetti'

/** Le sotto-schede, per le sezioni che ne hanno. */
const SOTTO: Record<Sezione, { valore: string; label: string }[]> = {
  squadra: [
    { valore: 'riepilogo', label: 'Riepilogo' },
    { valore: 'grafici', label: 'Grafici' },
    { valore: 'inattive', label: 'Palle inattive' },
  ],
  giocatori: [
    { valore: 'generali', label: 'Generali' },
    { valore: 'tiri', label: 'Tiri & xG' },
    { valore: 'grafici', label: 'Grafici' },
  ],
  portieri: [],
  quintetti: [],
}

const SEZIONI: { valore: Sezione; label: string; icona: string }[] = [
  { valore: 'squadra', label: 'Squadra', icona: '🏆' },
  { valore: 'giocatori', label: 'Giocatori', icona: '👤' },
  { valore: 'portieri', label: 'Portieri', icona: '🧤' },
  { valore: 'quintetti', label: 'Quintetti', icona: '🔁' },
]

function eSezione(v: string | null): v is Sezione {
  return v !== null && SEZIONI.some((s) => s.valore === v)
}

export default function StatisticheStagione() {
  const { id } = useParams()
  const stagioneId = Number(id)

  const stagione = useLiveQuery(() => db.stagioni.get(stagioneId), [stagioneId])
  const rosa = useLiveQuery(
    () => db.giocatori.where('stagioneId').equals(stagioneId).toArray(),
    [stagioneId]
  )
  const schemi = useLiveQuery(
    () => db.schemi.where('stagioneId').equals(stagioneId).toArray(),
    [stagioneId]
  )
  const partite = useLiveQuery(
    () => db.partite.where('stagioneId').equals(stagioneId).toArray(),
    [stagioneId]
  )
  const avversari = useLiveQuery(
    () => db.avversari.where('stagioneId').equals(stagioneId).toArray(),
    [stagioneId]
  )
  const eventi = useLiveQuery(async () => {
    if (!partite) return []
    const partiteIds = partite.map((p) => p.id!).filter(Boolean)
    if (partiteIds.length === 0) return []
    return db.eventi.where('partitaId').anyOf(partiteIds).toArray()
  }, [partite])

  const [parametri, setParametri] = useSearchParams()
  const [colonna, setColonna] = useState<ColonnaOrdinabile>('gol')
  const [discendente, setDiscendente] = useState(true)

  if (!stagione || !rosa || !partite || !eventi || !schemi || !avversari) {
    return <div className="p-6">Caricamento...</div>
  }

  // Le statistiche guardano sempre e solo le partite concluse. Qui si sceglie
  // quali: l'ambito entra in tutte le sezioni, tabelle e mappe comprese.
  const finite = [...partite]
    .filter((p) => p.stato === 'finita')
    .sort((a, b) => b.dataOra - a.dataOra)
  const partiteFinite = finite.length

  // La scelta sta nell'URL, così sopravvive a un ricarico e si può linkare.
  // «partita» al singolare è la forma vecchia, quella che usa il link dalla
  // pagina della partita: continua a valere come selezione di una sola.
  const paramPartite = parametri.get('partite')
  const idsNellUrl = (paramPartite ?? parametri.get('partita') ?? '')
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && finite.some((p) => p.id === n))
  const presetNellUrl = parametri.get('filtro')
  // Una scelta a mano vince sul preset. «partite» presente vale come scelta
  // anche quando è vuota — si può deselezionare tutto — mentre la vecchia
  // «partita» con un id sparito torna al totale, come ha sempre fatto.
  const aMano = paramPartite !== null || idsNellUrl.length > 0
  const preset: Preset | null = aMano
    ? null
    : ePreset(presetNellUrl)
    ? presetNellUrl
    : 'tutte'

  const ambito =
    preset !== null
      ? partiteDelPreset(finite, preset)
      : finite.filter((p) => idsNellUrl.includes(p.id!))
  const idAmbito = new Set(ambito.map((p) => p.id!))
  const eventiFiniti = eventi.filter((e) => idAmbito.has(e.partitaId))
  // Il link «aprila» e il titolo con il risultato hanno senso solo quando
  // l'ambito è davvero una partita sola, comunque ci si sia arrivati.
  const partitaCorrente = ambito.length === 1 ? ambito[0] : null

  // Anche la scheda aperta sta nell'URL: si torna indietro dal dettaglio di un
  // giocatore e si ritrova dov'eravamo, e un link porta dove volevi mandarlo.
  const sezNellUrl = parametri.get('sez')
  const sezione: Sezione = eSezione(sezNellUrl) ? sezNellUrl : 'squadra'
  const sottoDisponibili = SOTTO[sezione]
  const sottoNellUrl = parametri.get('vista')
  const sotto =
    sottoDisponibili.find((s) => s.valore === sottoNellUrl)?.valore ??
    sottoDisponibili[0]?.valore ??
    ''

  function scegliPreset(p: Preset) {
    const nuovi = new URLSearchParams(parametri)
    nuovi.delete('partite')
    nuovi.delete('partita')
    if (p === 'tutte') nuovi.delete('filtro')
    else nuovi.set('filtro', p)
    setParametri(nuovi, { replace: true })
  }

  function scegliPartite(ids: number[]) {
    const nuovi = new URLSearchParams(parametri)
    nuovi.delete('filtro')
    nuovi.delete('partita')
    nuovi.set('partite', ids.join(','))
    setParametri(nuovi, { replace: true })
  }

  function scegliSezione(s: Sezione) {
    const nuovi = new URLSearchParams(parametri)
    if (s === 'squadra') nuovi.delete('sez')
    else nuovi.set('sez', s)
    // La sotto-scheda di prima potrebbe non esistere qui: si riparte dalla prima.
    nuovi.delete('vista')
    setParametri(nuovi, { replace: true })
    if (s === 'giocatori') {
      setColonna('gol')
      setDiscendente(true)
    }
  }

  function scegliSotto(v: string) {
    const nuovi = new URLSearchParams(parametri)
    nuovi.set('vista', v)
    setParametri(nuovi, { replace: true })
    // L'ordinamento corrente potrebbe essere su una colonna non visibile.
    if (sezione === 'giocatori') {
      setColonna(v === 'tiri' ? 'xG' : 'gol')
      setDiscendente(true)
    }
  }

  const stats = calcolaStatistiche(rosa, ambito, eventiFiniti)
  const portieri = statistichePortieri(rosa, ambito, eventiFiniti, stats)

  const nomeAvversario = (id: number) =>
    avversari.find((a) => a.id === id)?.nome ?? '???'
  const etichettaPartita = (p: (typeof finite)[number]) => {
    const { fatti, subiti } = risultatoPartita(
      eventi.filter((e) => e.partitaId === p.id)
    )
    return `${formatData(p.dataOra)} · ${nomeAvversario(p.avversarioId)} · ${fatti}-${subiti}`
  }

  /** Il dettaglio di un giocatore, con lo stesso ambito di partite addosso. */
  const linkDettaglio = (giocatoreId: number) => {
    const q = parametri.toString()
    return `/stagione/${stagioneId}/statistiche/giocatore/${giocatoreId}${
      q ? `?${q}` : ''
    }`
  }

  function cambiaOrdinamento(nuovaColonna: ColonnaOrdinabile) {
    if (nuovaColonna === colonna) {
      setDiscendente(!discendente)
    } else {
      setColonna(nuovaColonna)
      // default: discendente per i numeri, ascendente per il nome
      setDiscendente(nuovaColonna !== 'giocatore')
    }
  }

  const statsOrdinate = [...stats].sort((a, b) => {
    const va = valoreColonna(a, colonna)
    const vb = valoreColonna(b, colonna)
    // A parità, per ruolo.
    if (va === vb) return ordineRuolo(a.giocatore.ruolo) - ordineRuolo(b.giocatore.ruolo)
    if (typeof va === 'number' && typeof vb === 'number') {
      return discendente ? vb - va : va - vb
    }
    return discendente
      ? String(vb).localeCompare(String(va))
      : String(va).localeCompare(String(vb))
  })

  const ord: Ordinamento = { colonna, discendente, cambia: cambiaOrdinamento }

  return (
    <div className="max-w-5xl mx-auto p-4 pb-16">
      <Link to={`/stagione/${stagioneId}`} className="text-sm text-slate-400">
        ← Stagione
      </Link>
      <h1 className="text-2xl font-bold mt-1">{nomeSquadra(stagione)}</h1>
      <p className="text-sm text-slate-400 mb-4">
        Statistiche • {stagione.nome} •{' '}
        {partitaCorrente
          ? etichettaPartita(partitaCorrente)
          : `${ambito.length} ${
              ambito.length === 1 ? 'partita' : 'partite'
            } su ${partiteFinite}`}
      </p>

      {/* Su quali partite: preset, oppure una scelta a mano */}
      {partiteFinite > 0 && (
        <>
          <FiltroPartite
            finite={finite}
            preset={preset}
            selezionate={idAmbito}
            etichetta={etichettaPartita}
            onPreset={scegliPreset}
            onSelezione={scegliPartite}
          />
          {partitaCorrente && (
            <p className="text-xs text-slate-500 -mt-1 mb-3">
              Stai guardando una partita sola.{' '}
              <Link
                to={`/partita/${partitaCorrente.id}`}
                className="text-emerald-400 underline"
              >
                Aprila
              </Link>{' '}
              per il tabellone e il log eventi.
            </p>
          )}
        </>
      )}

      {/* Primo livello: di chi parliamo */}
      {partiteFinite > 0 && (
        <div className="grid grid-cols-4 gap-1 bg-slate-800 p-1 rounded-lg mb-2">
          {SEZIONI.map((s) => (
            <button
              key={s.valore}
              data-sezione={s.valore}
              onClick={() => scegliSezione(s.valore)}
              className={`px-1 py-2 rounded-md text-xs sm:text-sm font-semibold ${
                sezione === s.valore
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="block sm:inline sm:mr-1">{s.icona}</span>
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Secondo livello: che taglio */}
      {partiteFinite > 0 && sottoDisponibili.length > 0 && (
        <div className="flex gap-1 mb-4 text-sm">
          {sottoDisponibili.map((s) => (
            <button
              key={s.valore}
              data-sotto={s.valore}
              onClick={() => scegliSotto(s.valore)}
              className={`px-3 py-1 rounded-full font-medium ${
                sotto === s.valore
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {partiteFinite === 0 ? (
        <p className="text-slate-500 italic mt-8 text-center">
          Nessuna partita conclusa. Le statistiche appariranno dopo la prima
          partita terminata.
        </p>
      ) : ambito.length === 0 ? (
        <p className="text-slate-500 italic mt-8 text-center">
          Nessuna partita selezionata: spuntane almeno una qui sopra, o torna a
          «Tutte».
        </p>
      ) : sezione === 'squadra' ? (
        sotto === 'grafici' ? (
          <SezioneGrafici
            partite={ambito}
            eventi={eventiFiniti}
            rosa={rosa}
            stats={stats}
            nomeAvversario={nomeAvversario}
            nomeSquadra={nomeSquadra(stagione)}
            ambito="squadra"
          />
        ) : sotto === 'inattive' ? (
          <VistaInattive eventi={eventiFiniti} schemi={schemi} />
        ) : (
          <VistaSquadra partite={ambito} eventi={eventiFiniti} />
        )
      ) : sezione === 'portieri' ? (
        <VistaPortieri portieri={portieri} />
      ) : sezione === 'quintetti' ? (
        <VistaQuintetti
          partite={ambito}
          eventi={eventiFiniti}
          rosa={rosa}
          nomeAvversario={nomeAvversario}
        />
      ) : sotto === 'grafici' ? (
        <SezioneGrafici
          partite={ambito}
          eventi={eventiFiniti}
          rosa={rosa}
          stats={stats}
          nomeAvversario={nomeAvversario}
          nomeSquadra={nomeSquadra(stagione)}
          ambito="giocatori"
        />
      ) : sotto === 'tiri' ? (
        <>
          <TabellaTiri stats={statsOrdinate} ord={ord} dettaglio={linkDettaglio} />
          <div className="mt-6 text-xs text-slate-500 space-y-1">
            <p>
              <strong className="text-slate-400">Tiri</strong>: conclusioni totali
              (un gol è un tiro riuscito) •{' '}
              <strong className="text-slate-400">TP</strong>: tiri in porta (gol e
              tiri parati) • <strong className="text-slate-400">Conv.</strong>: gol
              su tiri
            </p>
            <p>
              <strong className="text-slate-400">xG</strong>: gol attesi in base
              alla zona di tiro • <strong className="text-slate-400">G−xG</strong>:
              quanto ha segnato in più (verde) o in meno (rosso) rispetto a quello
              che le sue conclusioni valevano
            </p>
            <p>Tocca un nome per la sua scheda, con la mappa dei tiri.</p>
          </div>
        </>
      ) : (
        <>
          <TabellaGenerali
            stats={statsOrdinate}
            ord={ord}
            dettaglio={linkDettaglio}
          />
          <div className="mt-6 text-xs text-slate-500 space-y-1">
            <p>
              <strong className="text-slate-400">Pres.</strong>: convocazioni •{' '}
              <strong className="text-slate-400">PG</strong>: partite giocate
              (almeno 1 min) • <strong className="text-slate-400">Min</strong>:
              minuti giocati totali
            </p>
            <p>
              <strong className="text-slate-400">Gol</strong>: gol segnati •{' '}
              <strong className="text-slate-400">Ass</strong>: assist •{' '}
              <strong className="text-slate-400">Aut</strong>: autogol contro
            </p>
            <p>
              <strong className="text-slate-400">G+</strong>: gol della squadra
              quando era in campo • <strong className="text-slate-400">G-</strong>:
              gol subiti quando era in campo •{' '}
              <strong className="text-slate-400">+/-</strong>: differenza
            </p>
            <p>Tocca un nome per la sua scheda, con la mappa dei tiri.</p>
          </div>
        </>
      )}
    </div>
  )
}
