/**
 * Identificativi stabili di giocatori e partite.
 *
 * Gli id numerici di Dexie sono locali: si rigenerano a ogni import e a ogni
 * download dal cloud, e la stessa partita ha id diversi sul PC, sul telefono e
 * nella copia condivisa di un altro allenatore. Per le cose che vivono FUORI
 * dal blob della stagione — i voti, che stanno in una tabella a parte — serve
 * un riferimento che resti uguale ovunque: lo `uid`.
 *
 * Due modi di farlo nascere:
 * - per i giocatori e le partite NUOVI, un uuid casuale, assegnato dall'hook
 *   di creazione di Dexie (database.ts) e poi portato in giro dall'export;
 * - per quelli che esistevano prima dello uid, un valore DERIVATO dal
 *   contenuto (nome e cognome, data e avversario). Derivato e non casuale
 *   perché lo calcola ogni dispositivo per conto suo, alla migrazione o
 *   importando un blob vecchio, e deve venire uguale a tutti senza che
 *   nessuno debba prima caricare niente.
 *
 * Una volta assegnato lo uid non cambia più: rinominare un giocatore non
 * tocca il suo uid, ed è proprio quello che tiene attaccati i voti.
 */

export function nuovoUid(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID()
    }
  } catch {
    // contesto non sicuro: si ripiega sotto
  }
  return (
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  )
}

function fnv1a(testo: string, seed: number): string {
  let h = seed >>> 0
  for (let i = 0; i < testo.length; i++) {
    h ^= testo.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return (h >>> 0).toString(36)
}

function hash(testo: string): string {
  return fnv1a(testo, 0x811c9dc5) + fnv1a(testo, 0x9e3779b9)
}

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase()

/**
 * Assegna gli uid derivati a una lista, in ordine. Due elementi con la
 * stessa chiave (due omonimi) prendono un suffisso secondo l'ordine: l'ordine
 * è quello degli id, che export e import conservano, quindi anche il suffisso
 * viene uguale su tutti i dispositivi.
 */
function derivaInOrdine(prefisso: string, chiavi: string[]): string[] {
  const visti = new Map<string, number>()
  return chiavi.map((k) => {
    const n = (visti.get(k) ?? 0) + 1
    visti.set(k, n)
    const base = `${prefisso}-${hash(k)}`
    return n === 1 ? base : `${base}-${n}`
  })
}

/** Uid derivati per i giocatori di UNA stagione, nell'ordine dato. */
export function uidDerivatiGiocatori(
  giocatori: { nome: string; cognome: string }[]
): string[] {
  return derivaInOrdine(
    'g',
    giocatori.map((g) => `${norm(g.nome)}|${norm(g.cognome)}`)
  )
}

/** Uid derivati per le partite di UNA stagione, nell'ordine dato. */
export function uidDerivatiPartite(
  partite: { dataOra: number; avversarioId: number }[],
  nomeAvversario: (id: number) => string
): string[] {
  return derivaInOrdine(
    'p',
    partite.map((p) => `${p.dataOra}|${norm(nomeAvversario(p.avversarioId))}`)
  )
}
