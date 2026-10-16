import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cloudConfigurato } from '../../cloud/supabase'
import { useSessione } from '../../cloud/auth'
import type { Stagione } from '../../db/schema'

/**
 * I voti vivono sul cloud: senza Supabase configurato, senza login o con la
 * stagione non collegata non c'è niente da mostrare. Qui si spiega cosa manca
 * invece di mostrare una pagina vuota, e si passa ai figli quello che serve.
 */
export default function Requisiti({
  stagione,
  children,
}: {
  stagione: Stagione
  children: (ctx: { cloudId: string; email: string | null; proprietario: boolean }) => ReactNode
}) {
  const { sessione, caricamento, email } = useSessione()

  if (!cloudConfigurato) {
    return (
      <Avviso>
        I voti si salvano sul cloud, e su questa installazione la
        sincronizzazione non è configurata.
      </Avviso>
    )
  }
  if (caricamento) return <p className="text-slate-400">Caricamento...</p>
  if (!sessione) {
    return (
      <Avviso>
        Per vedere e dare i voti devi entrare con il tuo account dalla pagina{' '}
        <Link to="/cloud" className="underline">
          Sincronizzazione
        </Link>
        .
      </Avviso>
    )
  }
  if (!stagione.cloudId) {
    return (
      <Avviso>
        Questa stagione non è collegata al cloud. I voti si agganciano alla
        copia sul cloud, perché li scrivono più allenatori: caricala dalla
        pagina{' '}
        <Link to="/cloud" className="underline">
          Sincronizzazione
        </Link>{' '}
        e poi torna qui.
      </Avviso>
    )
  }

  return (
    <>
      {children({
        cloudId: stagione.cloudId,
        email,
        // Le stagioni non in sola lettura e collegate sono di chi le ha
        // caricate. Il server lo verifica comunque per conto suo.
        proprietario: stagione.soloLettura !== true,
      })}
    </>
  )
}

function Avviso({ children }: { children: ReactNode }) {
  return (
    <p className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-4 py-3">
      {children}
    </p>
  )
}
