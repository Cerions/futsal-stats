/**
 * Pezzi comuni a tutti i grafici.
 *
 * Sono disegnati a mano in SVG invece che con una libreria: la mappa dei tiri
 * lo era già, l'app deve funzionare offline e un pacchetto di grafici pesa più
 * di tutto quello che serve qui.
 *
 * Colori: verde per noi, rosso per loro, gli stessi due dei bottoni in partita.
 * La coppia #059669 / #dc2626 passa i controlli di leggibilità sul fondo
 * slate-800, inclusa la separazione per chi non distingue rosso e verde; in
 * ogni caso nessun grafico affida l'identità al solo colore — c'è sempre una
 * legenda o un'etichetta accanto.
 */

export const COLORI = {
  nostro: '#059669',
  loro: '#dc2626',
  /** fondo delle card: serve per i distacchi fra barre e per gli anelli */
  superficie: '#1e293b',
  griglia: '#334155',
  testo: '#94a3b8',
  testoTenue: '#64748b',
  neutro: '#475569',
} as const

/** Spessore massimo di una barra: oltre, la banda si riempie e sparisce l'aria. */
export const BARRA_MAX = 24
/** Distacco in colore superficie fra barre che si toccano. */
export const DISTACCO = 2

/** Scala i valori su un'altezza, arrotondando il massimo a un numero pulito. */
export function scala(massimo: number, passi = 4) {
  if (massimo <= 0) return { cima: 1, tacche: [0, 1] }
  const grezzo = massimo / passi
  const magnitudo = Math.pow(10, Math.floor(Math.log10(grezzo)))
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * magnitudo).find((p) => p >= grezzo)!
  const cima = Math.ceil(massimo / passo) * passo
  const tacche: number[] = []
  for (let v = 0; v <= cima + 1e-9; v += passo) tacche.push(Number(v.toFixed(4)))
  return { cima, tacche }
}
