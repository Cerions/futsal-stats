import { useState } from 'react'
import type { Giocatore, Partita, SquadraAvversaria } from '../../db/schema'
import type { Valutatore, Voto, VotoDaSalvare } from '../../cloud/voti'
import { creaValutatoreStorico, salvaVoti } from '../../cloud/voti'
import type { LetturaFoglio, RigaFoglio } from '../../utils/foglio'
import {
  abbinaAllenatore,
  abbinaGiocatore,
  abbinaPartita,
  chiaveEvento,
} from '../../utils/abbinaFoglio'
import { nomeCompleto } from '../../utils/giocatore'
import { formatData } from '../../utils/format'

/**
 * Porta nell'app i voti tenuti finora sul foglio Google.
 *
 * Tre passi: si sceglie il file, si controllano gli abbinamenti (partite,
 * giocatori, allenatori — quelli automatici si possono correggere, quelli
 * mancanti vanno scelti o saltati), si importa. Si può rifare: un voto già
 * presente per lo stesso allenatore, partita e giocatore viene sovrascritto,
 * non duplicato.
 *
 * Un allenatore del foglio che non userà l'app (o non ancora) si può creare
 * «senza account»: i suoi voti contano nelle medie come gli altri.
 */

const SALTA = ''
const NUOVO = '__nuovo__'

type Mappa = Record<string, string>

export default function ImportaFoglio({
  cloudId,
  rosa,
  partite,
  avversari,
  valutatori,
  voti,
  onFatto,
}: {
  cloudId: string
  rosa: Giocatore[]
  partite: Partita[]
  avversari: SquadraAvversaria[]
  valutatori: Valutatore[]
  voti: Voto[]
  onFatto: () => void
}) {
  const [aperto, setAperto] = useState(false)
  const [lettura, setLettura] = useState<LetturaFoglio | null>(null)
  const [nomeFile, setNomeFile] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [esito, setEsito] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  const [mPartite, setMPartite] = useState<Mappa>({})
  const [mGiocatori, setMGiocatori] = useState<Mappa>({})
  const [mAllenatori, setMAllenatori] = useState<Mappa>({})

  async function scegliFile(file: File) {
    setErrore(null)
    setEsito(null)
    setLettura(null)
    try {
      // Il lettore si carica solo qui: chi non importa non lo scarica
      const { leggiFoglio } = await import('../../utils/foglio')
      const l = leggiFoglio(file.name, new Uint8Array(await file.arrayBuffer()))
      if (l.righe.length === 0) throw new Error('Il file non contiene voti.')
      const p: Mappa = {}
      const g: Mappa = {}
      const a: Mappa = {}
      for (const r of l.righe) {
        const k = chiaveEvento(r)
        if (!(k in p)) p[k] = abbinaPartita(r, partite, avversari) ?? SALTA
        if (!(r.giocatore in g)) g[r.giocatore] = abbinaGiocatore(r.giocatore, rosa) ?? SALTA
        if (!(r.allenatore in a)) a[r.allenatore] = abbinaAllenatore(r.allenatore, valutatori) ?? NUOVO
      }
      setMPartite(p)
      setMGiocatori(g)
      setMAllenatori(a)
      setLettura(l)
      setNomeFile(file.name)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : String(e))
    }
  }

  // ---- anteprima: cosa succede premendo Importa ----
  const righe = lettura?.righe ?? []
  const pronte = new Map<string, RigaFoglio>() // terna → ultima riga del foglio
  let saltate = 0
  for (const r of righe) {
    const p = mPartite[chiaveEvento(r)]
    const g = mGiocatori[r.giocatore]
    const a = mAllenatori[r.allenatore]
    if (!p || !g || !a) {
      saltate++
      continue
    }
    pronte.set(`${a}|${p}|${g}`, r)
  }
  const doppie = righe.length - saltate - pronte.size
  const sovrascritte = [...pronte.keys()].filter((k) => {
    const [a, p, g] = k.split('|')
    return voti.some((v) => v.valutatore === a && v.partita_uid === p && v.giocatore_uid === g)
  }).length

  async function importa() {
    setImportando(true)
    setErrore(null)
    try {
      // Prima gli allenatori nuovi, che servono come riferimento ai voti
      const idDi = new Map<string, string>()
      for (const [nome, scelta] of Object.entries(mAllenatori)) {
        if (scelta !== NUOVO) continue
        const usato = righe.some(
          (r) => r.allenatore === nome && mPartite[chiaveEvento(r)] && mGiocatori[r.giocatore]
        )
        if (!usato) continue
        const esito = await creaValutatoreStorico(cloudId, nome)
        if ('errore' in esito) throw new Error(esito.errore)
        idDi.set(NUOVO + nome, esito.id)
      }
      const daScrivere: VotoDaSalvare[] = []
      for (const [k, r] of pronte) {
        const [a, p, g] = k.split('|')
        daScrivere.push({
          valutatore: a === NUOVO ? idDi.get(NUOVO + r.allenatore)! : a,
          partita_uid: p,
          giocatore_uid: g,
          voto: r.voto,
          note: r.giudizio || null,
        })
      }
      // A blocchi: una richiesta enorme su una linea mobile rischia di cadere
      for (let i = 0; i < daScrivere.length; i += 100) {
        const err = await salvaVoti(cloudId, daScrivere.slice(i, i + 100), [])
        if (err) throw new Error(`${err} (importati ${i} voti su ${daScrivere.length})`)
      }
      setEsito(`Importati ${daScrivere.length} voti da ${nomeFile}.`)
      setLettura(null)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : String(e))
    } finally {
      setImportando(false)
      onFatto()
    }
  }

  if (!aperto) {
    return (
      <button
        onClick={() => setAperto(true)}
        data-apri-import
        className="bg-slate-800 hover:bg-slate-700/70 rounded-lg px-4 py-3 text-left"
      >
        <div className="font-semibold">📥 Importa lo storico dal foglio</div>
        <div className="text-xs text-slate-400">
          I voti tenuti finora su Google Fogli, scaricati come .xlsx
        </div>
      </button>
    )
  }

  // ---- opzioni delle tendine ----
  const opzioniPartite = [...partite]
    .filter((p) => p.stato !== 'da_giocare')
    .sort((a, b) => a.dataOra - b.dataOra)
    .map((p) => ({
      valore: p.uid!,
      label: `${formatData(p.dataOra)} vs ${avversari.find((a) => a.id === p.avversarioId)?.nome ?? '???'}`,
    }))
  const opzioniGiocatori = [...rosa]
    .sort((a, b) => a.cognome.localeCompare(b.cognome))
    .map((g) => ({ valore: g.uid!, label: `${g.cognome} ${g.nome}`.trim() || nomeCompleto(g) }))
  const opzioniAllenatori = [
    ...valutatori.map((v) => ({
      valore: v.id,
      label: !v.email ? `${v.nome} (senza account)` : v.attivo ? v.nome : `${v.nome} (ex)`,
    })),
    { valore: NUOVO, label: '➕ Nuovo, senza account' },
  ]

  const conta = (f: (r: RigaFoglio) => boolean) => righe.filter(f).length
  const eventi = [...new Map(righe.map((r) => [chiaveEvento(r), r])).values()]
  const nomiGiocatori = [...new Set(righe.map((r) => r.giocatore))]
  const nomiAllenatori = [...new Set(righe.map((r) => r.allenatore))]

  return (
    <section className="bg-slate-800 rounded-lg p-4" data-import>
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="font-semibold">Importa lo storico dal foglio</h2>
        <button
          onClick={() => {
            setAperto(false)
            setLettura(null)
          }}
          className="text-slate-400 hover:text-slate-200 text-xl leading-none"
          aria-label="Chiudi"
        >
          ×
        </button>
      </div>
      <p className="text-xs text-slate-400 mb-3">
        Su Google Fogli: File → Scarica → Microsoft Excel (.xlsx). Si legge la scheda
        «Voti». Le partite devono già esistere nell'app: si abbinano per giorno.
        Reimportare lo stesso file non crea doppioni.
      </p>

      <input
        type="file"
        accept=".xlsx,.csv"
        data-file-foglio
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void scegliFile(f)
          e.target.value = ''
        }}
        className="block w-full text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-slate-100"
      />

      {errore && (
        <p className="bg-red-900/30 border border-red-800/60 text-red-200 text-sm rounded-lg px-3 py-2 mt-3">
          {errore}
        </p>
      )}
      {esito && (
        <p className="bg-emerald-900/30 border border-emerald-800/60 text-emerald-200 text-sm rounded-lg px-3 py-2 mt-3">
          ✓ {esito}
        </p>
      )}

      {lettura && (
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-sm text-slate-300">
            <strong>{righe.length}</strong> righe in {nomeFile}: {eventi.length} partite,{' '}
            {nomiGiocatori.length} giocatori, {nomiAllenatori.length} allenatori.
            {lettura.scartate.length > 0 && (
              <span className="text-amber-300">
                {' '}
                {lettura.scartate.length} righe scartate (
                {lettura.scartate
                  .slice(0, 3)
                  .map((s) => `riga ${s.riga}: ${s.motivo}`)
                  .join('; ')}
                {lettura.scartate.length > 3 ? '…' : ''}).
              </span>
            )}
          </p>

          <Gruppo
            titolo="Partite"
            voci={eventi.map((r) => ({
              chiave: chiaveEvento(r),
              nome: r.evento,
              dettaglio: `${r.giorno ? r.giorno.split('-').reverse().join('/') : 'senza data'} · ${conta((x) => chiaveEvento(x) === chiaveEvento(r))} voti`,
            }))}
            mappa={mPartite}
            setMappa={setMPartite}
            opzioni={opzioniPartite}
            vuoto="— Salta questa partita —"
          />
          <Gruppo
            titolo="Giocatori"
            voci={nomiGiocatori.map((n) => ({
              chiave: n,
              nome: n,
              dettaglio: `${conta((x) => x.giocatore === n)} voti`,
            }))}
            mappa={mGiocatori}
            setMappa={setMGiocatori}
            opzioni={opzioniGiocatori}
            vuoto="— Salta questo giocatore —"
          />
          <Gruppo
            titolo="Allenatori"
            voci={nomiAllenatori.map((n) => ({
              chiave: n,
              nome: n,
              dettaglio: `${conta((x) => x.allenatore === n)} voti`,
            }))}
            mappa={mAllenatori}
            setMappa={setMAllenatori}
            opzioni={opzioniAllenatori}
            vuoto="— Salta i suoi voti —"
            evidenzia={(v) => v === NUOVO}
          />

          <div className="border-t border-slate-700 pt-3">
            <p className="text-sm text-slate-300 mb-2" data-anteprima>
              Si importano <strong>{pronte.size}</strong> voti
              {sovrascritte > 0 && <> ({sovrascritte} sostituiscono voti già presenti)</>}.
              {saltate > 0 && <span className="text-amber-300"> {saltate} righe saltate perché non abbinate.</span>}
              {doppie > 0 && (
                <span className="text-slate-400">
                  {' '}
                  {doppie} righe ripetute nel foglio: vale l'ultima.
                </span>
              )}
            </p>
            <button
              onClick={importa}
              disabled={importando || pronte.size === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg py-2.5 font-semibold"
            >
              {importando ? 'Importazione…' : `Importa ${pronte.size} voti`}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

/**
 * Una lista di nomi del foglio, ognuno con la sua tendina. Quelli da
 * sistemare stanno in cima e in evidenza; quelli già abbinati si possono
 * comunque riaprire e correggere.
 */
function Gruppo({
  titolo,
  voci,
  mappa,
  setMappa,
  opzioni,
  vuoto,
  evidenzia = () => false,
}: {
  titolo: string
  voci: { chiave: string; nome: string; dettaglio: string }[]
  mappa: Mappa
  setMappa: (f: (m: Mappa) => Mappa) => void
  opzioni: { valore: string; label: string }[]
  vuoto: string
  evidenzia?: (valore: string) => boolean
}) {
  // Quali mostrare si decide all'apertura del file e poi resta fermo: una
  // voce che sparisse appena scelta l'opzione non si potrebbe ricontrollare.
  const [daControllare] = useState(
    () => new Set(voci.filter((v) => !mappa[v.chiave] || evidenzia(mappa[v.chiave])).map((v) => v.chiave))
  )
  const daSistemare = voci.filter((v) => daControllare.has(v.chiave))
  const fatte = voci.filter((v) => !daControllare.has(v.chiave))
  const abbinati = voci.filter((v) => mappa[v.chiave] && !evidenzia(mappa[v.chiave])).length
  const [tutte, setTutte] = useState(false)
  const mostrate = tutte ? [...daSistemare, ...fatte] : daSistemare

  return (
    <div data-gruppo={titolo}>
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
          {titolo}{' '}
          <span className="normal-case tracking-normal font-normal">
            · {abbinati}/{voci.length} abbinati
          </span>
        </h3>
        {fatte.length > 0 && (
          <button onClick={() => setTutte(!tutte)} className="text-xs text-slate-400 underline">
            {tutte ? 'Solo da controllare' : 'Mostra tutti'}
          </button>
        )}
      </div>
      {mostrate.length === 0 ? (
        <p className="text-xs text-emerald-400/90">✓ Tutti abbinati automaticamente.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {mostrate.map((v) => {
            const valore = mappa[v.chiave] ?? ''
            const problema = !valore || evidenzia(valore)
            return (
              <li
                key={v.chiave}
                className={`rounded-lg px-3 py-2 border ${
                  problema ? 'border-amber-700/60 bg-amber-900/10' : 'border-slate-700'
                }`}
              >
                <div className="text-sm font-medium">{v.nome}</div>
                <div className="text-xs text-slate-500 mb-1.5">{v.dettaglio}</div>
                <select
                  value={valore}
                  onChange={(e) => {
                    const scelta = e.target.value
                    setMappa((m) => ({ ...m, [v.chiave]: scelta }))
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value="">{vuoto}</option>
                  {opzioni.map((o) => (
                    <option key={o.valore} value={o.valore}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
