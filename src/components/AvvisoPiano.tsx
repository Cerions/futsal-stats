import { Link } from 'react-router-dom'
import { GESTORE } from '../config'
import type { MotivoPiano } from '../cloud/piano'

/**
 * Riquadro che spiega perché qualcosa è bloccato dal piano gratuito.
 *
 * - `creare`: c'è già la partita del piano gratuito, non se ne crea un'altra
 * - `bloccata`: le partite sono più di una, si possono solo guardare
 */
export default function AvvisoPiano({
  tipo,
  motivo,
  className = '',
}: {
  tipo: 'creare' | 'bloccata'
  motivo: MotivoPiano
  className?: string
}) {
  return (
    <div
      data-avviso-piano={tipo}
      className={`bg-amber-900/30 border border-amber-800/60 text-amber-100 text-sm rounded-lg px-3 py-2 ${className}`}
    >
      {tipo === 'creare' ? (
        <p>
          🔒 <strong>Piano gratuito</strong>: comprende una partita. Per
          registrarne altre serve il Premium, oppure elimina quella che hai.
        </p>
      ) : (
        <p>
          🔒 <strong>Piano gratuito</strong>: hai più di una partita, quindi
          puoi guardarle tutte ma non modificarle né iniziarne di nuove. Per
          tornare a registrare serve il Premium, oppure elimina le partite:
          con una sola quella torna modificabile, con nessuna puoi crearne una
          nuova.
        </p>
      )}
      <Contatto motivo={motivo} />
    </div>
  )
}

function Contatto({ motivo }: { motivo: MotivoPiano }) {
  if (motivo === 'senzaAccesso') {
    return (
      <p className="mt-1 text-amber-200/80 text-xs">
        Hai già il Premium?{' '}
        <Link to="/cloud" className="underline">
          Accedi da Sincronizzazione
        </Link>
        .
      </p>
    )
  }
  if (motivo === 'daVerificare') {
    return (
      <p className="mt-1 text-amber-200/80 text-xs">
        Non riesco a verificare il tuo piano: riprova quando hai linea.
      </p>
    )
  }
  if (!GESTORE.email) return null
  return (
    <p className="mt-1 text-amber-200/80 text-xs">
      Per il Premium scrivi a{' '}
      <a href={`mailto:${GESTORE.email}?subject=Futsal%20Stats%20Premium`} className="underline">
        {GESTORE.email}
      </a>
      .
    </p>
  )
}
