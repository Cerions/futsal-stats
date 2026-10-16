import { useEffect, useState } from 'react'
import Modal from '../Modal'
import type { RigaCloud } from '../../cloud/sync'
import { impostaCondivisione } from '../../cloud/sync'
import { leggiPersone, salvaPersone } from '../../cloud/voti'
import type { PersonaStagione, Valutatore } from '../../cloud/voti'

/**
 * Chi ha accesso a una stagione, in un posto solo.
 *
 * Ogni email ha un ruolo: «Sola lettura» vede tutto, «Allenatore» vede tutto
 * e dà i voti. Agli allenatori si dà un nome (quello che compare nei voti) e,
 * se serve, le deleghe: «vota anche per» chi non ha tempo di farlo da sé.
 * Il proprietario non è nella lista — vede tutto comunque — ma può scegliere
 * di dare i voti anche lui.
 *
 * Togliere il ruolo di allenatore, o togliere la persona, non cancella i suoi
 * voti: resta nella sezione Voti come ex allenatore.
 *
 * Se le tabelle dei voti sul server non ci sono ancora, la finestra funziona
 * come prima: solo la lista in sola lettura.
 */

type Carico =
  | { stato: 'carico' }
  | { stato: 'ok'; esistenti: Valutatore[] }
  | { stato: 'senzaVoti'; motivo: string }
  | { stato: 'errore'; motivo: string }

export default function PersoneStagione({
  riga,
  miaEmail,
  onChiudi,
}: {
  riga: RigaCloud | null
  miaEmail: string
  onChiudi: (salvato: boolean) => void
}) {
  return (
    <Modal open={riga !== null} onClose={() => onChiudi(false)} title="Persone della stagione">
      {riga && <Contenuto key={riga.id} riga={riga} miaEmail={miaEmail} onChiudi={onChiudi} />}
    </Modal>
  )
}

function Contenuto({
  riga,
  miaEmail,
  onChiudi,
}: {
  riga: RigaCloud
  miaEmail: string
  onChiudi: (salvato: boolean) => void
}) {
  const mia = miaEmail.toLowerCase()
  const [carico, setCarico] = useState<Carico>({ stato: 'carico' })
  const [persone, setPersone] = useState<PersonaStagione[]>([])
  const [io, setIo] = useState({ vota: false, nome: '' })
  const [nuova, setNuova] = useState<{
    email: string
    ruolo: PersonaStagione['ruolo']
  }>({
    email: '',
    ruolo: 'lettura',
  })
  const [errore, setErrore] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let vivo = true
    leggiPersone(riga.id)
      .then(({ condivisaCon, valutatori }) => {
        if (!vivo) return
        if ('errore' in valutatori) {
          setPersone(
            condivisaCon.map((email) => ({
              email,
              ruolo: 'lettura',
              nome: '',
              votaPer: [],
            }))
          )
          setCarico({ stato: 'senzaVoti', motivo: valutatori.errore })
          return
        }
        const esistenti = valutatori
        const attivo = (email: string) => esistenti.find((v) => v.email === email && v.attivo)
        setPersone(
          condivisaCon.map((email) => ({
            email,
            ruolo: attivo(email) ? 'allenatore' : 'lettura',
            nome: esistenti.find((v) => v.email === email)?.nome ?? '',
            votaPer: esistenti
              .filter((t) => t.attivo && t.email !== null && t.delegati.includes(email))
              .map((t) => t.email!),
          }))
        )
        const mio = attivo(mia)
        setIo({
          vota: mio !== undefined,
          nome: esistenti.find((v) => v.email === mia)?.nome ?? '',
        })
        setCarico({ stato: 'ok', esistenti })
      })
      .catch((e: unknown) => {
        if (!vivo) return
        setCarico({
          stato: 'errore',
          motivo: e instanceof Error ? e.message : String(e),
        })
      })
    return () => {
      vivo = false
    }
  }, [riga.id, mia])

  const conVoti = carico.stato === 'ok'

  function cambia(email: string, campi: Partial<PersonaStagione>) {
    setPersone((ps) => ps.map((p) => (p.email === email ? { ...p, ...campi } : p)))
  }

  function aggiungi() {
    const email = nuova.email.trim().toLowerCase()
    if (!email.includes('@')) {
      setErrore("Scrivi un'email valida.")
      return
    }
    if (email === mia) {
      setErrore('Questa è la tua email: la stagione è tua, la vedi già.')
      return
    }
    if (persone.some((p) => p.email === email)) {
      setErrore('Questa email è già nella lista.')
      return
    }
    setErrore(null)
    // Un ex allenatore che torna si porta dietro il suo nome (e ritrova i voti)
    const nome =
      carico.stato === 'ok' ? (carico.esistenti.find((v) => v.email === email)?.nome ?? '') : ''
    setPersone((ps) => [...ps, { email, ruolo: nuova.ruolo, nome, votaPer: [] }])
    setNuova({ email: '', ruolo: nuova.ruolo })
  }

  async function salva() {
    const senzaNome = persone.find((p) => p.ruolo === 'allenatore' && !p.nome.trim())
    if (senzaNome) {
      setErrore(`Dai un nome all'allenatore ${senzaNome.email}: è quello che compare nei voti.`)
      return
    }
    if (io.vota && !io.nome.trim()) {
      setErrore('Scrivi anche il tuo nome, visto che dai i voti.')
      return
    }
    setSalvando(true)
    setErrore(null)
    const err =
      carico.stato === 'ok'
        ? await salvaPersone(riga.id, persone, { email: mia, ...io }, carico.esistenti)
        : await impostaCondivisione(
            riga.id,
            persone.map((p) => p.email)
          )
    setSalvando(false)
    if (err) setErrore(err)
    else onChiudi(true)
  }

  if (carico.stato === 'carico') return <p className="text-slate-400 text-sm">Caricamento...</p>
  if (carico.stato === 'errore') {
    return (
      <p className="bg-red-900/30 border border-red-800/60 text-red-200 text-sm rounded-lg px-3 py-2">
        {carico.motivo}
      </p>
    )
  }

  // Chi può comparire nel «vota anche per»: gli allenatori, te compreso
  const allenatori = [
    ...(io.vota ? [{ email: mia, nome: io.nome.trim() || 'Tu' }] : []),
    ...persone
      .filter((p) => p.ruolo === 'allenatore')
      .map((p) => ({
        email: p.email,
        nome: p.nome.trim() || p.email.split('@')[0],
      })),
  ]
  // Chi era allenatore e non lo è più: lo si dice, i voti restano
  const exAllenatori =
    carico.stato === 'ok'
      ? carico.esistenti.filter(
          (v) =>
            v.attivo &&
            v.email !== null &&
            v.email !== mia &&
            !persone.some((p) => p.email === v.email && p.ruolo === 'allenatore')
        )
      : []

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-slate-400 -mt-2">
        <strong className="text-slate-300">{riga.nome}</strong> · Sola lettura vede partite,
        statistiche e voti. Allenatore vede tutto e in più dà i voti.
      </p>

      {carico.stato === 'senzaVoti' && (
        <p className="text-xs bg-amber-900/30 border border-amber-800/60 text-amber-200 rounded-lg px-3 py-2">
          Il ruolo di allenatore non è disponibile: {carico.motivo}
        </p>
      )}

      <div className="max-h-[55vh] overflow-y-auto -mx-2 px-2 flex flex-col gap-2">
        {conVoti && (
          <div className="border border-slate-700 rounded-lg p-3" data-persona="io">
            <div className="text-sm">
              <span className="font-semibold">Tu</span>{' '}
              <span className="text-slate-500 text-xs">{mia} · proprietario</span>
            </div>
            <label className="flex items-center gap-2 mt-2 text-sm">
              <input
                type="checkbox"
                checked={io.vota}
                data-io-vota
                onChange={(e) => setIo({ ...io, vota: e.target.checked })}
                className="w-4 h-4 accent-emerald-500"
              />
              Anch'io do i voti
            </label>
            {io.vota && (
              <input
                value={io.nome}
                onChange={(e) => setIo({ ...io, nome: e.target.value })}
                placeholder="Il tuo nome nei voti (es. Luca)"
                className="w-full mt-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
              />
            )}
          </div>
        )}

        {persone.length === 0 && (
          <p className="text-slate-500 italic text-sm">Nessuno oltre a te.</p>
        )}

        {persone.map((p) => {
          const altri = allenatori.filter((a) => a.email !== p.email)
          return (
            <div
              key={p.email}
              className="border border-slate-700 rounded-lg p-3"
              data-persona={p.email}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium break-all">{p.email}</div>
                <button
                  onClick={() => setPersone((ps) => ps.filter((x) => x.email !== p.email))}
                  className="text-slate-500 hover:text-red-400 text-lg leading-none shrink-0"
                  aria-label={`Togli ${p.email}`}
                >
                  ×
                </button>
              </div>
              <div className="flex gap-1 mt-2">
                {(['lettura', 'allenatore'] as const).map((r) => (
                  <button
                    key={r}
                    data-ruolo={r}
                    disabled={!conVoti && r === 'allenatore'}
                    onClick={() => cambia(p.email, { ruolo: r })}
                    className={`flex-1 py-1.5 rounded-md text-xs font-semibold disabled:opacity-40 ${
                      p.ruolo === r ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    {r === 'lettura' ? '👀 Sola lettura' : '⭐ Allenatore'}
                  </button>
                ))}
              </div>
              {p.ruolo === 'allenatore' && (
                <>
                  <input
                    value={p.nome}
                    onChange={(e) => cambia(p.email, { nome: e.target.value })}
                    placeholder="Nome nei voti (es. Mister Rossi)"
                    className="w-full mt-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
                  />
                  {altri.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-slate-400 mb-1">Vota anche per:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {altri.map((a) => {
                          const si = p.votaPer.includes(a.email)
                          return (
                            <button
                              key={a.email}
                              data-vota-per={`${p.email}>${a.email}`}
                              onClick={() =>
                                cambia(p.email, {
                                  votaPer: si
                                    ? p.votaPer.filter((x) => x !== a.email)
                                    : [...p.votaPer, a.email],
                                })
                              }
                              className={`px-2.5 py-1 rounded-full text-xs border ${
                                si
                                  ? 'border-emerald-600 bg-emerald-900/40 text-emerald-200'
                                  : 'border-slate-700 text-slate-400'
                              }`}
                            >
                              {si ? '✓ ' : ''}
                              {a.nome}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {exAllenatori.length > 0 && (
        <p className="text-xs text-slate-400">
          {exAllenatori.map((v) => v.nome).join(', ')}{' '}
          {exAllenatori.length === 1 ? 'non sarà più allenatore' : 'non saranno più allenatori'}: i
          voti già dati restano nelle medie.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <input
          value={nuova.email}
          onChange={(e) => setNuova({ ...nuova, email: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && aggiungi()}
          type="email"
          inputMode="email"
          autoCapitalize="none"
          placeholder="email@esempio.it"
          data-nuova-email
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
        />
        <div className="flex gap-2">
          <select
            value={nuova.ruolo}
            onChange={(e) =>
              setNuova({
                ...nuova,
                ruolo: e.target.value as PersonaStagione['ruolo'],
              })
            }
            disabled={!conVoti}
            data-nuovo-ruolo
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm"
          >
            <option value="lettura">Sola lettura</option>
            <option value="allenatore">Allenatore</option>
          </select>
          <button
            onClick={aggiungi}
            className="bg-slate-700 hover:bg-slate-600 rounded-lg px-3 text-sm font-semibold"
          >
            Aggiungi
          </button>
        </div>
      </div>

      <details className="text-xs text-slate-500">
        <summary className="cursor-pointer text-slate-400">Come entra una persona nuova</summary>
        <ol className="list-decimal pl-5 mt-1 flex flex-col gap-1">
          <li>Si registra in questa app con la sua email (Sincronizzazione → Registrati).</li>
          <li>La aggiungi qui con il ruolo giusto e salvi.</li>
          <li>
            Lei apre Sincronizzazione, trova la stagione sotto «Condivise con te» e preme Scarica
            qui. Da lì si aggiorna da sola; se è allenatore trova i Voti nella pagina della
            stagione.
          </li>
        </ol>
      </details>

      {errore && (
        <p className="bg-red-900/30 border border-red-800/60 text-red-200 text-sm rounded-lg px-3 py-2">
          {errore}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          onClick={() => onChiudi(false)}
          className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600"
        >
          Annulla
        </button>
        <button
          onClick={salva}
          disabled={salvando}
          data-salva-persone
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
        >
          {salvando ? 'Salvo…' : 'Salva'}
        </button>
      </div>
    </div>
  )
}
