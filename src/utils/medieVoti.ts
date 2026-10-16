import type { Giocatore, Partita } from '../db/schema'
import type { Valutatore, Voto } from '../cloud/voti'
import { chiaveMese, mediaVoti } from './voti'

/**
 * I conti sui voti, gli stessi del foglio degli allenatori:
 *
 * - media di un giocatore: tutti i voti ricevuti, di qualunque allenatore
 *   (AVERAGEIFS sul giocatore);
 * - per partita: la media dei voti di quella partita (foglio «Media Giocatori»);
 * - per mese: la media di tutti i voti delle partite di quel mese (foglio
 *   «Andamento Mensile»), non la media delle medie per partita;
 * - per allenatore: la media dei voti che ha DATO e quanti ne ha dati
 *   (foglio «Media Allenatori»).
 *
 * Tutte arrotondate a due decimali come nel foglio. Le righe con la sola nota
 * non contano, e nemmeno i voti di partite che non esistono più.
 */

export type VotoNumerico = Voto & { voto: number }

export interface DatiVoti {
  rosa: Giocatore[]
  partite: Partita[]
  valutatori: Valutatore[]
  voti: Voto[]
}

export function votiValidi(d: Pick<DatiVoti, 'partite' | 'voti'>): VotoNumerico[] {
  const esistenti = new Set(d.partite.map((p) => p.uid))
  return d.voti.filter(
    (v): v is VotoNumerico => v.voto !== null && esistenti.has(v.partita_uid)
  )
}

function raggruppa<K>(voti: VotoNumerico[], chiave: (v: VotoNumerico) => K): Map<K, VotoNumerico[]> {
  const m = new Map<K, VotoNumerico[]>()
  for (const v of voti) {
    const k = chiave(v)
    const l = m.get(k)
    if (l) l.push(v)
    else m.set(k, [v])
  }
  return m
}

/** Partite con almeno un voto, dalla più vecchia: le colonne della tabella. */
export function partiteVotate(d: Pick<DatiVoti, 'partite' | 'voti'>, validi = votiValidi(d)): Partita[] {
  const con = new Set(validi.map((v) => v.partita_uid))
  return d.partite.filter((p) => p.uid !== undefined && con.has(p.uid)).sort((a, b) => a.dataOra - b.dataOra)
}

/** Mesi con almeno un voto, in ordine: "2026-08", "2026-09", ... */
export function mesiVotati(d: Pick<DatiVoti, 'partite' | 'voti'>, validi = votiValidi(d)): string[] {
  const dataDi = new Map(d.partite.map((p) => [p.uid, p.dataOra]))
  return [...new Set(validi.map((v) => chiaveMese(dataDi.get(v.partita_uid)!)))].sort()
}

export interface RigaGiocatore {
  g: Giocatore
  media: number | null
  voti: number
  partite: number
  minimo: number | null
  massimo: number | null
  perValutatore: Map<string, number | null>
  perPartita: Map<string, number>
  perMese: Map<string, number>
}

/** Una riga per ogni giocatore della rosa con almeno un voto. */
export function righeGiocatori(d: DatiVoti, validi = votiValidi(d)): RigaGiocatore[] {
  const dataDi = new Map(d.partite.map((p) => [p.uid, p.dataOra]))
  const perGiocatore = raggruppa(validi, (v) => v.giocatore_uid)
  const righe: RigaGiocatore[] = []
  for (const g of d.rosa) {
    const suoi = perGiocatore.get(g.uid!) ?? []
    if (suoi.length === 0) continue
    const numeri = suoi.map((v) => v.voto)
    righe.push({
      g,
      media: mediaVoti(suoi),
      voti: suoi.length,
      partite: new Set(suoi.map((v) => v.partita_uid)).size,
      minimo: Math.min(...numeri),
      massimo: Math.max(...numeri),
      perValutatore: new Map(
        d.valutatori.map((val) => [val.id, mediaVoti(suoi.filter((v) => v.valutatore === val.id))])
      ),
      perPartita: new Map(
        [...raggruppa(suoi, (v) => v.partita_uid)].map(([k, l]) => [k, mediaVoti(l)!])
      ),
      perMese: new Map(
        [...raggruppa(suoi, (v) => chiaveMese(dataDi.get(v.partita_uid)!))].map(([k, l]) => [
          k,
          mediaVoti(l)!,
        ])
      ),
    })
  }
  return righe
}

/** La media di squadra per partita e per mese: la riga «tutti» dei grafici. */
export function mediaSquadra(d: Pick<DatiVoti, 'partite' | 'voti'>, validi = votiValidi(d)) {
  const dataDi = new Map(d.partite.map((p) => [p.uid, p.dataOra]))
  return {
    media: mediaVoti(validi),
    perPartita: new Map(
      [...raggruppa(validi, (v) => v.partita_uid)].map(([k, l]) => [k, mediaVoti(l)!])
    ),
    perMese: new Map(
      [...raggruppa(validi, (v) => chiaveMese(dataDi.get(v.partita_uid)!))].map(([k, l]) => [
        k,
        mediaVoti(l)!,
      ])
    ),
  }
}

/** Media dei voti DATI da ogni allenatore e quanti ne ha dati. */
export function medieAllenatori(
  d: Pick<DatiVoti, 'partite' | 'voti' | 'valutatori'>,
  validi = votiValidi(d)
) {
  const per = raggruppa(validi, (v) => v.valutatore)
  return new Map(
    d.valutatori.map((val) => {
      const suoi = per.get(val.id) ?? []
      return [val.id, { media: mediaVoti(suoi), numero: suoi.length }] as const
    })
  )
}
