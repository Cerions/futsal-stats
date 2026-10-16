import type { Valutatore, Voto } from '../cloud/voti'

/**
 * Regole dei voti, senza React né rete.
 *
 * La scala è quella del foglio degli allenatori: da 1 a 10, a quarti di punto
 * (6, 6,25, 6,5, 6,75). I bottoni − e + si muovono di un quarto; a mano si
 * può scrivere qualsiasi valore con due decimali. Il voto si scrive con la
 * virgola, come sulla carta.
 */

export const VOTO_MIN = 1
export const VOTO_MAX = 10
export const PASSO_VOTO = 0.25
/** Da dove parte il primo tocco di − o + su un voto vuoto. */
export const VOTO_PARTENZA = 6

/** "6,5" → 6.5; stringa vuota → null; fuori scala o non numerico → undefined. */
export function leggiVoto(testo: string): number | null | undefined {
  const t = testo.trim().replace(',', '.')
  if (t === '') return null
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(t)) return undefined
  const n = Number(t)
  if (n < VOTO_MIN || n > VOTO_MAX) return undefined
  return n
}

/** 6.5 → "6,5", 7 → "7", 6.25 → "6,25". */
export function scriviVoto(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return ''
  return String(Math.round(v * 100) / 100).replace('.', ',')
}

/** Una media, sempre con due decimali: 6.333 → "6,33". */
export function scriviMedia(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return v.toFixed(2).replace('.', ',')
}

export function passoVoto(testo: string, verso: 1 | -1): string {
  const attuale = leggiVoto(testo)
  if (attuale === null || attuale === undefined) return scriviVoto(VOTO_PARTENZA)
  // Da un valore fuori passo (6,25) si va al passo successivo nel verso giusto
  const multipli = attuale / PASSO_VOTO
  const prossimo =
    verso === 1
      ? (Math.floor(multipli + 1e-9) + 1) * PASSO_VOTO
      : (Math.ceil(multipli - 1e-9) - 1) * PASSO_VOTO
  return scriviVoto(Math.min(VOTO_MAX, Math.max(VOTO_MIN, prossimo)))
}

/** Colore di un voto: rosso sotto il 6, neutro dal 6, verde dal 7. */
export function coloreVoto(v: number | null | undefined): string {
  if (v === null || v === undefined) return 'text-slate-500'
  if (v < 6) return 'text-red-400'
  if (v >= 7) return 'text-emerald-400'
  return 'text-slate-200'
}

// ---------------------------------------------------------------------------
// Permessi, lato interfaccia
//
// Decidono cosa MOSTRARE. A decidere cosa si può davvero scrivere è il server
// (policy RLS in supabase/voti.sql): qui si evita solo di offrire un bottone
// che poi verrebbe rifiutato.
// ---------------------------------------------------------------------------

/**
 * I valutatori per cui chi è collegato può inserire i voti: sempre e solo
 * allenatori attivi. Il proprietario li ha tutti; gli altri se stessi e i
 * colleghi che li hanno delegati, purché siano allenatori attivi anche loro.
 */
export function valutatoriScrivibili(
  valutatori: Valutatore[],
  miaEmail: string | null,
  proprietario: boolean
): Valutatore[] {
  const attivi = valutatori.filter((v) => v.attivo && v.email !== null)
  if (proprietario) return attivi
  const io = ioComeValutatore(valutatori, miaEmail)
  if (!io) return []
  return attivi.filter((v) => v.id === io.id || v.delegati.includes(io.email!))
}

/** Il valutatore attivo che corrisponde all'account collegato, se c'è. */
export function ioComeValutatore(
  valutatori: Valutatore[],
  miaEmail: string | null
): Valutatore | undefined {
  if (!miaEmail) return undefined
  const io = miaEmail.toLowerCase()
  return valutatori.find((v) => v.email === io && v.attivo)
}

/** Un allenatore senza account esiste solo per i voti dello storico. */
export function soloStorico(v: Valutatore): boolean {
  return v.email === null
}

/** Ex allenatore: aveva un account, ora non vota più. I voti restano. */
export function exAllenatore(v: Valutatore): boolean {
  return v.email !== null && !v.attivo
}

// ---------------------------------------------------------------------------
// Medie
// ---------------------------------------------------------------------------

export function media(xs: number[]): number | null {
  if (xs.length === 0) return null
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

/** Solo i voti con un numero (le righe con la sola nota non fanno media). */
export function conVoto(voti: Voto[]): (Voto & { voto: number })[] {
  return voti.filter((v): v is Voto & { voto: number } => v.voto !== null)
}

/** Media arrotondata come nel foglio: ROUND(..., 2). */
export function mediaVoti(voti: { voto: number }[]): number | null {
  const m = media(voti.map((v) => v.voto))
  return m === null ? null : Math.round(m * 100) / 100
}

// ---------------------------------------------------------------------------
// Mesi
// ---------------------------------------------------------------------------

/** "2026-09" dal timestamp di una partita, nell'ora locale. */
export function chiaveMese(timestamp: number): string {
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

/** "2026-09" → "Set 2026", o "Set" se `corto`. */
export function etichettaMese(chiave: string, corto = false): string {
  const [a, m] = chiave.split('-').map(Number)
  return corto ? MESI[m - 1] : `${MESI[m - 1]} ${a}`
}
