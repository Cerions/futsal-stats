import { useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Chiedere conferma prima di cancellare, con un modale dell'app invece del
 * popup del browser.
 *
 * L'interfaccia è volutamente la stessa di `confirm()` — si attende una
 * risposta e si va avanti solo se è sì — perché è quella che rende impossibile
 * dimenticarsi il controllo: `if (!(await chiedi(...))) return`. La differenza
 * è che il popup è una schermata dell'app, leggibile su telefono, e può dire
 * quanto si sta buttando via.
 *
 * L'hook sta in un file senza JSX e restituisce le props del modale: la regola
 * del fast refresh non vuole hook e componenti esportati dallo stesso file.
 */

export interface RichiestaConferma {
  titolo: string
  /** Cosa succede se si conferma. Va scritto al netto di giri di parole. */
  messaggio: ReactNode
  /** Etichetta del bottone che conferma. */
  azione?: string
  /**
   * Se valorizzata, va digitata per sbloccare la conferma. Per le cancellazioni
   * da cui non si torna: il nome della stagione va scritto a mano.
   */
  parolaChiave?: string
}

export interface PropsConferma {
  richiesta: RichiestaConferma | null
  onRisposta: (confermato: boolean) => void
}

export function useConferma(): {
  chiedi: (r: RichiestaConferma) => Promise<boolean>
  props: PropsConferma
} {
  const [aperta, setAperta] = useState<{
    richiesta: RichiestaConferma
    risolvi: (ok: boolean) => void
  } | null>(null)

  const chiedi = (richiesta: RichiestaConferma) =>
    new Promise<boolean>((risolvi) => setAperta({ richiesta, risolvi }))

  return {
    chiedi,
    props: {
      richiesta: aperta?.richiesta ?? null,
      onRisposta: (confermato: boolean) => {
        aperta?.risolvi(confermato)
        setAperta(null)
      },
    },
  }
}
