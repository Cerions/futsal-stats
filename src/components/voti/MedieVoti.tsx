import { useSearchParams } from 'react-router-dom'
import type { Giocatore, Partita, SquadraAvversaria } from '../../db/schema'
import type { Valutatore, Voto } from '../../cloud/voti'
import { ruoloShort, ordineRuolo } from '../../db/ruoli'
import { nomeCorto } from '../../utils/giocatore'
import { confronta, useOrdinamento } from '../../utils/colonne'
import { scriviMedia, coloreVoto, etichettaMese } from '../../utils/voti'
import {
  mesiVotati,
  partiteVotate,
  righeGiocatori,
  votiValidi,
  type RigaGiocatore,
} from '../../utils/medieVoti'
import { Th } from '../statistiche/tabella'
import { NienteDati } from '../grafici/base'

/**
 * Le medie voto, in tre tagli — gli stessi tre fogli che gli allenatori
 * tenevano su Google:
 *
 * - Stagione: media di tutti i voti, quanti, e la media per allenatore;
 * - Per partita: una colonna per partita con la media dei voti di quel giorno;
 * - Mensile: una colonna per mese, per vedere chi sta crescendo.
 *
 * Le medie sono tutte «di tutti i voti»: tre voti in una partita pesano tre
 * volte. Le note senza voto non contano.
 */

type Vista = 'stagione' | 'partite' | 'mesi'

const VISTE: { valore: Vista; label: string }[] = [
  { valore: 'stagione', label: 'Stagione' },
  { valore: 'partite', label: 'Per partita' },
  { valore: 'mesi', label: 'Mensile' },
]

const eVista = (v: string | null): v is Vista => VISTE.some((x) => x.valore === v)

export default function MedieVoti({
  rosa,
  partite,
  avversari,
  valutatori,
  voti,
}: {
  rosa: Giocatore[]
  partite: Partita[]
  avversari: SquadraAvversaria[]
  valutatori: Valutatore[]
  voti: Voto[]
}) {
  const [parametri, setParametri] = useSearchParams()
  const v = parametri.get('vista')
  const vista: Vista = eVista(v) ? v : 'stagione'

  const dati = { rosa, partite, valutatori, voti }
  const validi = votiValidi(dati)
  const righe = righeGiocatori(dati, validi)

  if (righe.length === 0) {
    return <NienteDati testo="Nessun voto ancora: le medie compaiono dal primo voto." />
  }

  return (
    <>
      <div className="flex gap-1.5 mb-4">
        {VISTE.map((x) => (
          <button
            key={x.valore}
            data-vista={x.valore}
            onClick={() => {
              const p = new URLSearchParams(parametri)
              p.set('vista', x.valore)
              setParametri(p, { replace: true })
            }}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
              vista === x.valore
                ? 'bg-slate-700 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {vista === 'stagione' && <Stagione righe={righe} valutatori={valutatori} />}
      {vista === 'partite' && (
        <Matrice
          righe={righe}
          colonne={partiteVotate(dati, validi).map((p) => ({
            chiave: p.uid!,
            sopra: dataBreve(p.dataOra),
            sotto: avversari.find((a) => a.id === p.avversarioId)?.nome ?? '???',
          }))}
          valore={(r, k) => r.perPartita.get(k)}
          spiegazione="Ogni casella è la media dei voti di quella partita. In fondo, la media di tutti i voti della stagione."
        />
      )}
      {vista === 'mesi' && (
        <Matrice
          righe={righe}
          colonne={mesiVotati(dati, validi).map((m) => ({
            chiave: m,
            sopra: etichettaMese(m, true),
            sotto: m.slice(0, 4),
          }))}
          valore={(r, k) => r.perMese.get(k)}
          spiegazione="Ogni casella è la media di tutti i voti ricevuti in quel mese, come nel foglio «Andamento Mensile»."
        />
      )}
    </>
  )
}

function dataBreve(t: number): string {
  return new Date(t).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
}

/** Prima colonna comune: nome corto e ruolo. */
function CellaGiocatore({ g }: { g: Giocatore }) {
  return (
    <td className="px-2 py-2 sticky left-0 bg-slate-900 z-10">
      <div className="font-medium whitespace-nowrap">{nomeCorto(g)}</div>
      <div className="text-xs text-slate-500">{ruoloShort(g.ruolo)}</div>
    </td>
  )
}

const ordinaPerNome = (a: RigaGiocatore, b: RigaGiocatore) =>
  a.g.cognome.localeCompare(b.g.cognome)

// ---------------------------------------------------------------------------

type ColStagione = 'giocatore' | 'ruolo' | 'media' | 'voti' | 'partite' | `v:${string}`

function Stagione({ righe, valutatori }: { righe: RigaGiocatore[]; valutatori: Valutatore[] }) {
  const ord = useOrdinamento<ColStagione>('media', ['giocatore', 'ruolo'])
  const valore = (r: RigaGiocatore, c: ColStagione): number | string => {
    if (c === 'giocatore') return `${r.g.cognome} ${r.g.nome}`.toLowerCase()
    if (c === 'ruolo') return ordineRuolo(r.g.ruolo)
    if (c === 'media') return r.media ?? -1
    if (c === 'voti') return r.voti
    if (c === 'partite') return r.partite
    return r.perValutatore.get(c.slice(2)) ?? -1
  }
  const ordinate = [...righe].sort(
    (a, b) => confronta(valore(a, ord.colonna), valore(b, ord.colonna), ord.discendente) || ordinaPerNome(a, b)
  )
  // Solo gli allenatori che hanno dato almeno un voto: una colonna di trattini
  // non dice niente e su telefono ruba spazio.
  const conVoti = valutatori.filter((v) => righe.some((r) => r.perValutatore.get(v.id) != null))

  return (
    <>
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <Th col="giocatore" ord={ord} sinistra sticky>
                Giocatore
              </Th>
              <Th col="media" ord={ord}>Media</Th>
              <Th col="partite" ord={ord} titolo="Partite in cui ha ricevuto almeno un voto">
                PV
              </Th>
              <Th col="voti" ord={ord} titolo="Voti ricevuti, da tutti gli allenatori">
                Voti
              </Th>
              {conVoti.map((v) => (
                <Th key={v.id} col={`v:${v.id}`} ord={ord} titolo={`Media dei voti di ${v.nome}`}>
                  {v.nome}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordinate.map((r) => (
              <tr
                key={r.g.id}
                data-media-voti={r.g.uid}
                className="border-b border-slate-800/50 hover:bg-slate-800/30"
              >
                <CellaGiocatore g={r.g} />
                <td className={`px-2 py-2 text-right tabular-nums font-bold ${coloreVoto(r.media)}`}>
                  {scriviMedia(r.media)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-400">{r.partite}</td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-400">{r.voti}</td>
                {conVoti.map((v) => {
                  const m = r.perValutatore.get(v.id) ?? null
                  return (
                    <td key={v.id} className={`px-2 py-2 text-right tabular-nums ${coloreVoto(m)}`}>
                      {scriviMedia(m)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6 text-xs text-slate-500 space-y-1">
        <p>
          <strong className="text-slate-400">Media</strong>: tutti i voti ricevuti, di
          qualunque allenatore • <strong className="text-slate-400">PV</strong>: partite
          in cui ha almeno un voto
        </p>
        <p>Le note senza voto non entrano nella media.</p>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------

/**
 * Giocatori per righe, partite o mesi per colonne. Si legge in orizzontale:
 * la prima colonna resta ferma, il resto scorre. Ordinata per ruolo come nel
 * foglio, ma ogni intestazione si tocca per ordinare.
 */
function Matrice({
  righe,
  colonne,
  valore,
  spiegazione,
}: {
  righe: RigaGiocatore[]
  colonne: { chiave: string; sopra: string; sotto: string }[]
  valore: (r: RigaGiocatore, chiave: string) => number | undefined
  spiegazione: string
}) {
  type Col = 'ruolo' | 'giocatore' | 'media' | `c:${string}`
  const ord = useOrdinamento<Col>('ruolo', ['ruolo', 'giocatore'])
  const val = (r: RigaGiocatore, c: Col): number | string => {
    if (c === 'giocatore') return `${r.g.cognome} ${r.g.nome}`.toLowerCase()
    if (c === 'ruolo') return ordineRuolo(r.g.ruolo)
    if (c === 'media') return r.media ?? -1
    return valore(r, c.slice(2)) ?? -1
  }
  const ordinate = [...righe].sort(
    (a, b) => confronta(val(a, ord.colonna), val(b, ord.colonna), ord.discendente) || ordinaPerNome(a, b)
  )

  return (
    <>
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="text-sm border-separate border-spacing-0">
          <thead>
            <tr>
              <Th col="ruolo" ord={ord} sinistra sticky>
                Giocatore
              </Th>
              {colonne.map((c) => (
                <th
                  key={c.chiave}
                  onClick={() => ord.cambia(`c:${c.chiave}`)}
                  className={`px-2 py-2 text-xs font-semibold text-right cursor-pointer select-none border-b border-slate-700 ${
                    ord.colonna === `c:${c.chiave}` ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  <div className="tabular-nums">{c.sopra}</div>
                  <div className="font-normal text-slate-500 max-w-[5.5rem] truncate" title={c.sotto}>
                    {c.sotto}
                  </div>
                </th>
              ))}
              <Th col="media" ord={ord}>Media</Th>
            </tr>
          </thead>
          <tbody>
            {ordinate.map((r) => (
              <tr key={r.g.id} className="hover:bg-slate-800/30">
                <CellaGiocatore g={r.g} />
                {colonne.map((c) => {
                  const m = valore(r, c.chiave)
                  return (
                    <td
                      key={c.chiave}
                      className={`px-2 py-2 text-right tabular-nums border-b border-slate-800/50 ${coloreVoto(m)}`}
                    >
                      {m === undefined ? <span className="text-slate-700">·</span> : scriviMedia(m)}
                    </td>
                  )
                })}
                <td
                  className={`px-2 py-2 text-right tabular-nums font-bold border-b border-slate-800/50 border-l border-l-slate-700 ${coloreVoto(r.media)}`}
                >
                  {scriviMedia(r.media)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-6 text-xs text-slate-500">{spiegazione}</p>
    </>
  )
}
