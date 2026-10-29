import { Link } from 'react-router-dom'
import { GESTORE, PRIVACY_AGGIORNATA_IL } from '../config'

/**
 * Privacy policy minima. Il testo descrive quello che l'app fa davvero:
 * dati sul dispositivo, cloud solo per chi accede, niente pubblicità né
 * tracciamento. Se cambia il funzionamento, cambia anche questa pagina (e la
 * data in config.ts).
 */
export default function Privacy() {
  const compilato = Boolean(GESTORE.nome && GESTORE.email)
  const contatto = GESTORE.email ? (
    <a href={`mailto:${GESTORE.email}`} className="underline">
      {GESTORE.email}
    </a>
  ) : (
    <span className="text-amber-300">[email da inserire]</span>
  )

  return (
    <div className="max-w-2xl mx-auto p-6 pb-16 text-sm leading-relaxed text-slate-300">
      <Link to="/" className="text-sm text-slate-400 hover:text-slate-200">
        ← Home
      </Link>
      <h1 className="text-2xl font-bold mt-1 mb-1 text-slate-100">Privacy</h1>
      <p className="text-slate-500 mb-6">Ultimo aggiornamento: {PRIVACY_AGGIORNATA_IL}</p>

      {!compilato && (
        <p className="bg-amber-900/30 border border-amber-800/60 text-amber-200 rounded-lg px-3 py-2 mb-6">
          Mancano nome ed email di chi gestisce l'app: vanno inseriti in{' '}
          <code>src/config.ts</code>.
        </p>
      )}

      <Sezione titolo="Chi gestisce i dati">
        <p>
          Futsal Stats è gestita da{' '}
          {GESTORE.nome || <span className="text-amber-300">[nome da inserire]</span>}.
          Per qualsiasi domanda sui tuoi dati scrivi a {contatto}.
        </p>
      </Sezione>

      <Sezione titolo="Quali dati">
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>
            <strong>Quello che inserisci</strong>: stagioni, nome della squadra,
            avversari, giocatori (nome, cognome, numero di maglia, ruolo),
            partite con i loro eventi, e — se usi la sezione Voti — voti e note
            degli allenatori.
          </li>
          <li>
            <strong>Account</strong>, solo se usi la sincronizzazione: la tua
            email e la password, che è conservata cifrata e nessuno può leggere.
          </li>
          <li>
            <strong>Condivisione</strong>: le email delle persone con cui
            condividi una stagione.
          </li>
          <li>
            <strong>Premium</strong>, se lo attivi: la tua email e la data di
            scadenza. I dati del pagamento restano a chi lo gestisce (banca,
            PayPal o simili), qui non arrivano.
          </li>
        </ul>
        <p className="mt-2">
          Non c'è pubblicità, non ci sono statistiche di utilizzo né cookie di
          profilazione. Il browser tiene solo quello che serve all'app per
          funzionare: i dati delle stagioni, l'accesso all'account e qualche
          impostazione.
        </p>
      </Sezione>

      <Sezione titolo="Dove stanno">
        <p>
          Prima di tutto <strong>sul tuo dispositivo</strong>, nella memoria del
          browser: l'app funziona anche offline e senza account.
        </p>
        <p className="mt-2">
          Se accedi e sincronizzi, una copia delle stagioni e i voti vanno su{' '}
          <strong>Supabase</strong>, il servizio che fa da database
          {GESTORE.regioneServer ? ` (server: ${GESTORE.regioneServer})` : ''}.
          L'app è pubblicata su <strong>Netlify</strong>, che per servirla vede
          dati tecnici come l'indirizzo IP. Entrambi trattano i dati solo per
          conto di chi gestisce l'app.
        </p>
      </Sezione>

      <Sezione titolo="Perché">
        <p>
          Solo per far funzionare l'app: registrare le statistiche, tenerle in
          pari tra i dispositivi e farle vedere a chi decidi tu. I dati non
          vengono venduti né usati per altro.
        </p>
      </Sezione>

      <Sezione titolo="I dati dei tuoi giocatori">
        <p>
          I giocatori li inserisci tu, quindi sei tu (o la tua società) a
          decidere che dati mettere e a doverli informare. Bastano nome e
          numero: non servono dati sensibili. Se in rosa ci sono minorenni,
          assicurati di avere il permesso di chi ne ha la responsabilità.
        </p>
      </Sezione>

      <Sezione titolo="Quanto restano">
        <p>
          Sul dispositivo finché non elimini la stagione o i dati del browser.
          Sul cloud finché non elimini la stagione dalla pagina
          Sincronizzazione, o finché non chiedi di cancellare l'account: in
          quel caso vengono cancellati anche le stagioni e i voti collegati.
        </p>
      </Sezione>

      <Sezione titolo="I tuoi diritti">
        <p>
          Puoi chiedere in qualsiasi momento di vedere i tuoi dati, correggerli,
          cancellarli o averne una copia, scrivendo a {contatto}. Se pensi che i
          tuoi dati siano trattati male puoi rivolgerti al Garante per la
          protezione dei dati personali (
          <a
            href="https://www.garanteprivacy.it"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            garanteprivacy.it
          </a>
          ).
        </p>
      </Sezione>
    </div>
  )
}

function Sezione({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-base font-semibold text-slate-100 mb-2">{titolo}</h2>
      {children}
    </section>
  )
}
