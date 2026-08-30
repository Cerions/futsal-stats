import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { nomeSquadra } from '../utils/stagione'
import Modal from '../components/Modal'
import type { Stagione } from '../db/schema'
import { cloudConfigurato, nomeDispositivo, rinominaDispositivo } from '../cloud/supabase'
import { accedi, esci, registrati, useSessione } from '../cloud/auth'
import {
  caricaStagione,
  elencoCloud,
  eliminaDalCloud,
  impostaAuto,
  impostaCondivisione,
  scaricaStagione,
  scollegaStagione,
  type EsitoCarica,
  type RigaCloud,
} from '../cloud/sync'

function quando(iso: string | number): string {
  const d = new Date(iso)
  return d.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Cloud() {
  const navigate = useNavigate()
  const { sessione, caricamento, email } = useSessione()

  const stagioni = useLiveQuery(
    () => db.stagioni.orderBy('dataCreazione').reverse().toArray(),
    []
  )

  const [righeCloud, setRigheCloud] = useState<RigaCloud[] | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, setInCorso] = useState<string | null>(null)
  const [conflitto, setConflitto] = useState<{
    stagione: Stagione
    versioneCloud: number
    aggiornatoDa: string | null
  } | null>(null)
  const [condivisione, setCondivisione] = useState<RigaCloud | null>(null)
  const [emailCondivise, setEmailCondivise] = useState('')
  const [dispositivo, setDispositivo] = useState(nomeDispositivo())

  const aggiornaElenco = useCallback(async () => {
    if (!sessione) return
    try {
      setRigheCloud(await elencoCloud())
      setErrore(null)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : String(e))
    }
  }, [sessione])

  // Primo caricamento dell'elenco quando entriamo o cambia la sessione.
  // Lo stato si tocca solo dentro le callback della promise, mai in modo
  // sincrono nell'effetto, e `vivo` evita di scrivere dopo lo smontaggio.
  useEffect(() => {
    if (!sessione) return
    let vivo = true
    elencoCloud()
      .then((righe) => {
        if (!vivo) return
        setRigheCloud(righe)
        setErrore(null)
      })
      .catch((e: unknown) => {
        if (!vivo) return
        setErrore(e instanceof Error ? e.message : String(e))
      })
    return () => {
      vivo = false
    }
  }, [sessione])

  // ---- azioni ----

  async function carica(s: Stagione, forza = false) {
    setInCorso(`up-${s.id}`)
    setErrore(null)
    const esito: EsitoCarica = await caricaStagione(s.id!, { forza })
    setInCorso(null)
    if (esito.esito === 'conflitto') {
      setConflitto({
        stagione: s,
        versioneCloud: esito.versioneCloud,
        aggiornatoDa: esito.aggiornatoDa,
      })
      return
    }
    if (esito.esito === 'errore') {
      setErrore(esito.messaggio)
      return
    }
    setConflitto(null)
    await aggiornaElenco()
  }

  async function scarica(cloudId: string, soloLettura: boolean) {
    setInCorso(`down-${cloudId}`)
    setErrore(null)
    const esito = await scaricaStagione(cloudId, { soloLettura })
    setInCorso(null)
    if (esito.esito === 'errore') {
      setErrore(esito.messaggio)
      return
    }
    setConflitto(null)
    await aggiornaElenco()
  }

  async function scollega(s: Stagione) {
    if (!confirm('Scollegare questa stagione dal cloud? I dati locali restano.'))
      return
    await scollegaStagione(s.id!)
    await aggiornaElenco()
  }

  async function eliminaCloud(riga: RigaCloud) {
    if (
      !confirm(
        `Eliminare "${riga.nome}" dal cloud? La copia sul dispositivo resta, ma gli altri dispositivi non la vedranno più.`
      )
    )
      return
    const err = await eliminaDalCloud(riga.id)
    if (err) setErrore(err)
    await aggiornaElenco()
  }

  function apriCondivisione(riga: RigaCloud) {
    setCondivisione(riga)
    setEmailCondivise(riga.condivisa_con.join('\n'))
  }

  async function salvaCondivisione() {
    if (!condivisione) return
    const err = await impostaCondivisione(
      condivisione.id,
      emailCondivise.split(/[\n,;]+/)
    )
    if (err) setErrore(err)
    setCondivisione(null)
    await aggiornaElenco()
  }

  // ---- stati della pagina ----

  if (!cloudConfigurato) {
    return (
      <Guscio>
        <p className="text-slate-400">
          La sincronizzazione non è configurata su questa installazione: mancano
          le variabili <code className="text-slate-300">VITE_SUPABASE_URL</code> e{' '}
          <code className="text-slate-300">VITE_SUPABASE_ANON_KEY</code>.
        </p>
        <p className="text-slate-500 text-sm mt-3">
          L'app continua a funzionare normalmente offline: i dati restano sul
          dispositivo e puoi spostarli con export e import da file.
        </p>
      </Guscio>
    )
  }

  if (caricamento) {
    return (
      <Guscio>
        <p className="text-slate-400">Caricamento...</p>
      </Guscio>
    )
  }

  if (!sessione) {
    return (
      <Guscio>
        <Login />
      </Guscio>
    )
  }

  const mie = (stagioni ?? []).filter((s) => !s.soloLettura)
  const condivise = (stagioni ?? []).filter((s) => s.soloLettura)
  const idLocali = new Set((stagioni ?? []).map((s) => s.cloudId).filter(Boolean))
  const miaUtenza = sessione.user.id
  // Righe sul cloud non ancora presenti qui, tenute separate: le mie da
  // scaricare, e quelle che qualcun altro ha condiviso con me. Chi riceve una
  // condivisione deve trovarla in un posto solo, sotto «Condivise con te».
  const nonScaricate = (righeCloud ?? []).filter((r) => !idLocali.has(r.id))
  const soloSulCloud = nonScaricate.filter((r) => r.proprietario === miaUtenza)
  const condiviseDaScaricare = nonScaricate.filter(
    (r) => r.proprietario !== miaUtenza
  )

  return (
    <Guscio>
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="text-sm text-slate-400 min-w-0">
          Collegato come <span className="text-slate-200">{email}</span>
          <div className="text-xs text-slate-500">
            Questo dispositivo si chiama{' '}
            <button
              onClick={() => {
                const n = prompt('Nome di questo dispositivo', dispositivo)
                if (n !== null) {
                  rinominaDispositivo(n)
                  setDispositivo(nomeDispositivo())
                }
              }}
              className="underline hover:text-slate-300"
            >
              {dispositivo}
            </button>
          </div>
        </div>
        <button
          onClick={() => esci()}
          className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-sm"
        >
          Esci
        </button>
      </div>

      {errore && (
        <p className="bg-red-900/30 border border-red-800/60 text-red-200 text-sm rounded-lg px-3 py-2 mb-4">
          {errore}
        </p>
      )}

      {/* ---- stagioni su questo dispositivo ---- */}
      <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2">
        Su questo dispositivo
      </h2>
      {mie.length === 0 ? (
        <p className="text-slate-500 italic text-sm mb-6">
          Nessuna stagione salvata qui.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 mb-6">
          {mie.map((s) => {
            const riga = righeCloud?.find((r) => r.id === s.cloudId)
            const allineata =
              riga !== undefined && riga.versione === s.cloudVersione
            return (
              <li key={s.id} className="bg-slate-800 rounded-lg px-4 py-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{s.nome}</div>
                    <div className="text-xs text-slate-400">{nomeSquadra(s)}</div>
                    <div className="text-xs mt-1">
                      {!s.cloudId ? (
                        <span className="text-slate-500">Mai caricata sul cloud</span>
                      ) : riga === undefined ? (
                        <span className="text-amber-400/80">
                          Collegata, ma non la vedo sul cloud
                        </span>
                      ) : allineata ? (
                        <span className="text-emerald-400">
                          Allineata · v{riga.versione} · {quando(riga.aggiornato_il)}
                          {riga.aggiornato_da ? ` da ${riga.aggiornato_da}` : ''}
                        </span>
                      ) : (
                        <span className="text-amber-400">
                          Sul cloud c'è la v{riga.versione}
                          {riga.aggiornato_da ? ` da ${riga.aggiornato_da}` : ''}, tu
                          hai la v{s.cloudVersione}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {s.cloudId && (
                  <label className="flex items-center gap-2 mt-2 text-xs text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={s.cloudAuto !== false}
                      onChange={(e) => impostaAuto(s.id!, e.target.checked)}
                      className="w-4 h-4"
                    />
                    Sincronizza da sola: carica le modifiche e scarica quelle
                    fatte sugli altri dispositivi, senza premere niente. In pausa
                    durante le partite.
                  </label>
                )}

                {s.cloudConflitto && (
                  <p className="mt-2 text-xs bg-amber-900/30 border border-amber-800/60 text-amber-200 rounded-lg px-3 py-2">
                    La stagione è cambiata sia qui sia sul cloud, quindi la
                    sincronizzazione automatica si è fermata per non buttare via
                    niente. Scegli tu: <strong>Carica</strong> per tenere questa
                    versione, <strong>Scarica</strong> per tenere quella del cloud.
                  </p>
                )}

                <div className="flex gap-2 mt-3 flex-wrap">
                  <button
                    onClick={() => carica(s)}
                    disabled={inCorso === `up-${s.id}`}
                    className="flex-1 min-w-28 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-2 rounded-lg text-sm font-semibold"
                  >
                    {inCorso === `up-${s.id}` ? 'Carico...' : '⬆ Carica'}
                  </button>
                  {s.cloudId && (
                    <button
                      onClick={() => scarica(s.cloudId!, false)}
                      disabled={inCorso === `down-${s.cloudId}`}
                      className="flex-1 min-w-28 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 py-2 rounded-lg text-sm font-semibold"
                    >
                      {inCorso === `down-${s.cloudId}` ? 'Scarico...' : '⬇ Scarica'}
                    </button>
                  )}
                  {riga && riga.proprietario === miaUtenza && (
                    <button
                      onClick={() => apriCondivisione(riga)}
                      className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-sm"
                      title="Condividi in sola lettura"
                    >
                      👥{riga.condivisa_con.length > 0 ? ` ${riga.condivisa_con.length}` : ''}
                    </button>
                  )}
                  {s.cloudId && (
                    <button
                      onClick={() => scollega(s)}
                      className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-sm"
                      title="Scollega dal cloud"
                    >
                      ⛓️‍💥
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* ---- stagioni presenti solo sul cloud ---- */}
      <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2">
        Solo sul cloud
      </h2>
      {righeCloud === null ? (
        <p className="text-slate-500 text-sm mb-6">Sto leggendo...</p>
      ) : soloSulCloud.length === 0 ? (
        <p className="text-slate-500 italic text-sm mb-6">
          Nessuna tua stagione da scaricare: le hai già tutte qui.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 mb-6">
          {soloSulCloud.map((r) => (
            <li key={r.id} className="bg-slate-800 rounded-lg px-4 py-3">
              <div className="font-semibold">{r.nome}</div>
              <div className="text-xs text-slate-400">{r.nome_squadra}</div>
              <div className="text-xs text-slate-500 mt-1">
                v{r.versione} · {quando(r.aggiornato_il)}
                {r.aggiornato_da ? ` da ${r.aggiornato_da}` : ''}
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => scarica(r.id, false)}
                  disabled={inCorso === `down-${r.id}`}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-2 rounded-lg text-sm font-semibold"
                >
                  {inCorso === `down-${r.id}` ? 'Scarico...' : '⬇ Scarica qui'}
                </button>
                <button
                  onClick={() => eliminaCloud(r)}
                  className="bg-slate-700 hover:bg-red-700 px-3 py-2 rounded-lg text-sm"
                  title="Elimina dal cloud"
                >
                  🗑️
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ---- stagioni che altri hanno condiviso con me, in sola lettura ---- */}
      {(condivise.length > 0 || condiviseDaScaricare.length > 0) && (
        <>
          <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2">
            Condivise con te
          </h2>
          <p className="text-xs text-slate-500 mb-2">
            Le puoi consultare ma non modificare. Una volta scaricate si
            aggiornano da sole quando chi te le ha condivise registra qualcosa.
          </p>
          <ul className="flex flex-col gap-2 mb-6">
            {condiviseDaScaricare.map((r) => (
              <li key={r.id} className="bg-slate-800 rounded-lg px-4 py-3">
                <div className="font-semibold">{r.nome}</div>
                <div className="text-xs text-slate-400">{r.nome_squadra}</div>
                <div className="text-xs text-slate-500 mt-1">
                  v{r.versione} · {quando(r.aggiornato_il)} · sola lettura
                </div>
                <button
                  onClick={() => scarica(r.id, true)}
                  disabled={inCorso === `down-${r.id}`}
                  className="w-full mt-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-2 rounded-lg text-sm font-semibold"
                >
                  {inCorso === `down-${r.id}` ? 'Scarico...' : '⬇ Scarica qui'}
                </button>
              </li>
            ))}
            {condivise.map((s) => (
              <li key={s.id} className="bg-slate-800 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{s.nome}</div>
                    <div className="text-xs text-slate-400">
                      {nomeSquadra(s)} · sola lettura
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/stagione/${s.id}`)}
                    className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-sm"
                  >
                    Apri
                  </button>
                  {s.cloudId && (
                    <button
                      onClick={() => scarica(s.cloudId!, true)}
                      disabled={inCorso === `down-${s.cloudId}`}
                      className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-3 py-2 rounded-lg text-sm"
                    >
                      ⬇
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <button
        onClick={aggiornaElenco}
        className="w-full bg-slate-700 hover:bg-slate-600 py-2.5 rounded-lg text-sm font-semibold"
      >
        Aggiorna elenco
      </button>

      {/* ---- conflitto ---- */}
      <Modal
        open={conflitto !== null}
        onClose={() => setConflitto(null)}
        title="Versioni diverse"
      >
        {conflitto && (
          <>
            <p className="text-slate-300 text-sm mb-4">
              Sul cloud c'è la versione {conflitto.versioneCloud}
              {conflitto.aggiornatoDa ? ` caricata da ${conflitto.aggiornatoDa}` : ''},
              più recente di quella che conosce questo dispositivo. Se carichi
              adesso, le modifiche fatte sull'altro dispositivo vengono perse.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => scarica(conflitto.stagione.cloudId!, false)}
                className="bg-emerald-600 hover:bg-emerald-500 px-4 py-3 rounded-lg font-semibold"
              >
                ⬇ Scarica la versione del cloud
                <span className="block text-xs font-normal opacity-80">
                  perdi le modifiche fatte qui
                </span>
              </button>
              <button
                onClick={() => carica(conflitto.stagione, true)}
                className="bg-slate-900 hover:bg-red-800 px-4 py-3 rounded-lg text-left"
              >
                ⬆ Sovrascrivi il cloud con questa versione
                <span className="block text-xs opacity-70">
                  perdi le modifiche fatte sull'altro dispositivo
                </span>
              </button>
              <button
                onClick={() => setConflitto(null)}
                className="bg-slate-700 hover:bg-slate-600 px-4 py-2.5 rounded-lg text-sm"
              >
                Annulla, decido dopo
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* ---- condivisione ---- */}
      <Modal
        open={condivisione !== null}
        onClose={() => setCondivisione(null)}
        title="Condividi in sola lettura"
      >
        <p className="text-slate-400 text-sm mb-3">
          Un'email per riga. Chi è in elenco vede la stagione ma non può
          modificarla: nella sua app non compaiono i bottoni per registrare o
          cambiare niente, e il permesso di scrittura non ce l'ha nemmeno il
          server.
        </p>
        <ol className="text-slate-400 text-xs mb-3 list-decimal pl-5 flex flex-col gap-1">
          <li>
            Prima deve registrarsi lui su questa app, con l'email che scrivi qui.
          </li>
          <li>Poi la aggiungi qui sotto e salvi.</li>
          <li>
            Lui apre Sincronizzazione, la trova sotto «Condivise con te» e
            preme Scarica qui. Da lì in poi si aggiorna da sola.
          </li>
        </ol>
        <textarea
          value={emailCondivise}
          onChange={(e) => setEmailCondivise(e.target.value)}
          rows={4}
          placeholder="mister@esempio.it"
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 mb-4 resize-none"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setCondivisione(null)}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600"
          >
            Annulla
          </button>
          <button
            onClick={salvaCondivisione}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500"
          >
            Salva
          </button>
        </div>
      </Modal>
    </Guscio>
  )
}

function Guscio({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-2xl mx-auto p-6 pb-16">
      <Link to="/" className="text-sm text-slate-400 hover:text-slate-200">
        ← Home
      </Link>
      <h1 className="text-2xl font-bold mt-1 mb-1">Sincronizzazione</h1>
      <p className="text-sm text-slate-400 mb-6">
        Le stagioni restano sul dispositivo: qui le carichi sul cloud e le
        riprendi altrove.
      </p>
      {children}
    </div>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [attesa, setAttesa] = useState(false)
  const [modo, setModo] = useState<'accedi' | 'registrati'>('accedi')

  async function invia() {
    if (!email.trim() || !password) return
    setAttesa(true)
    setErrore(null)
    const err =
      modo === 'accedi'
        ? await accedi(email, password)
        : await registrati(email, password)
    setAttesa(false)
    if (err) setErrore(err)
    else if (modo === 'registrati')
      setErrore('Account creato. Se Supabase chiede la conferma, controlla la mail.')
  }

  return (
    <div className="flex flex-col gap-3 max-w-sm">
      <div>
        <label htmlFor="cloud-email" className="block text-sm text-slate-400 mb-1">
          Email
        </label>
        <input
          id="cloud-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
        />
      </div>
      <div>
        <label htmlFor="cloud-password" className="block text-sm text-slate-400 mb-1">
          Password
        </label>
        <input
          id="cloud-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && invia()}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
        />
      </div>

      {errore && (
        <p className="bg-red-900/30 border border-red-800/60 text-red-200 text-sm rounded-lg px-3 py-2">
          {errore}
        </p>
      )}

      <button
        onClick={invia}
        disabled={attesa || !email.trim() || !password}
        className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-3 rounded-lg font-semibold"
      >
        {attesa ? 'Un attimo...' : modo === 'accedi' ? 'Accedi' : 'Crea account'}
      </button>
      <button
        onClick={() => {
          setModo(modo === 'accedi' ? 'registrati' : 'accedi')
          setErrore(null)
        }}
        className="text-sm text-slate-400 hover:text-slate-200 underline"
      >
        {modo === 'accedi'
          ? 'Non hai un account? Creane uno'
          : 'Hai già un account? Accedi'}
      </button>
    </div>
  )
}
