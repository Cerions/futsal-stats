import type { Giocatore, Partita, SquadraAvversaria } from '../db/schema'
import type { Valutatore } from '../cloud/voti'
import type { RigaFoglio } from './foglio'

/**
 * Abbinamento delle righe del foglio a quello che c'è nell'app.
 *
 * Il foglio nomina le cose a parole («FM @ Virtus Aurora», «Zoghlami
 * Bayrem», «Cerioni Alessandro»), l'app le conosce per uid. Qui si fa il
 * primo abbinamento automatico; quello che non torna lo sceglie a mano chi
 * importa, e niente viene importato senza essere abbinato.
 *
 * - Partita: stesso giorno. Se quel giorno ce n'è più d'una, quella il cui
 *   avversario compare nel nome dell'evento.
 * - Giocatore: stesse parole di nome e cognome, in qualunque ordine e senza
 *   badare ad accenti e maiuscole («Chiucchiù Luca» = «Luca Chiucchiu»).
 * - Allenatore: stesse parole del nome dato nell'app, oppure il nome dell'app
 *   contenuto in quello del foglio («Alessandro» in «Cerioni Alessandro»),
 *   purché non sia ambiguo.
 */

export function parole(s: string): string[] {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
}

const stesse = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join(' ') === [...b].sort().join(' ')
const contiene = (tutte: string[], parte: string[]) =>
  parte.length > 0 && parte.every((p) => tutte.includes(p))

export function giornoLocale(t: number): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Chiave di un evento del foglio: nome più giorno, perché lo stesso nome può tornare. */
export const chiaveEvento = (r: Pick<RigaFoglio, 'evento' | 'giorno'>) => `${r.evento}|${r.giorno ?? ''}`

export function abbinaPartita(
  r: Pick<RigaFoglio, 'evento' | 'giorno'>,
  partite: Partita[],
  avversari: SquadraAvversaria[]
): string | null {
  if (!r.giorno) return null
  const quelGiorno = partite.filter((p) => giornoLocale(p.dataOra) === r.giorno)
  if (quelGiorno.length === 1) return quelGiorno[0].uid!
  const ev = parole(r.evento)
  const perNome = quelGiorno.filter((p) =>
    contiene(ev, parole(avversari.find((a) => a.id === p.avversarioId)?.nome ?? '-'))
  )
  return perNome.length === 1 ? perNome[0].uid! : null
}

export function abbinaGiocatore(nome: string, rosa: Giocatore[]): string | null {
  const p = parole(nome)
  const trovati = rosa.filter((g) => stesse(p, parole(`${g.nome} ${g.cognome}`)))
  return trovati.length === 1 ? trovati[0].uid! : null
}

export function abbinaAllenatore(nome: string, valutatori: Valutatore[]): string | null {
  const p = parole(nome)
  const esatti = valutatori.filter((v) => stesse(p, parole(v.nome)))
  if (esatti.length === 1) return esatti[0].id
  const parziali = valutatori.filter((v) => contiene(p, parole(v.nome)))
  return parziali.length === 1 ? parziali[0].id : null
}
