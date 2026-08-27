import type {
  EsitoTiro,
  Evento,
  OrigineTiro,
  TipoInattiva,
  ZonaTiro,
} from './schema'

/**
 * Modello xG semplificato per il calcio a 5.
 *
 * Non è un modello allenato: è una tabella di pesi per zona, tarata su
 * conversioni tipiche del futsal (media generale intorno al 10-12% dei tiri).
 * L'idea è avere un metro di paragone stabile tra giocatori e partite,
 * non una previsione assoluta.
 *
 * Se i pesi non ti tornano rispetto a quello che vedi in campo,
 * cambia solo i valori di `peso` qui sotto: tutto il resto si ricalcola.
 */
export interface DefinizioneZona {
  value: ZonaTiro
  label: string
  labelCorta: string
  peso: number
  /** true = situazione da fermo, non disegnata sulla mappa del campo */
  daFermo: boolean
}

export const ZONE_TIRO: DefinizioneZona[] = [
  {
    value: 'AREA_CENTRALE',
    label: 'Area centrale',
    labelCorta: 'Area C',
    peso: 0.35,
    daFermo: false,
  },
  {
    value: 'AREA_SINISTRA',
    label: 'Area lato sinistro',
    labelCorta: 'Area SX',
    peso: 0.16,
    daFermo: false,
  },
  {
    value: 'AREA_DESTRA',
    label: 'Area lato destro',
    labelCorta: 'Area DX',
    peso: 0.16,
    daFermo: false,
  },
  {
    value: 'FUORI_CENTRALE',
    label: 'Fuori area, frontale',
    labelCorta: 'Fuori C',
    peso: 0.08,
    daFermo: false,
  },
  {
    value: 'FUORI_SINISTRA',
    label: 'Fuori area, sinistra',
    labelCorta: 'Fuori SX',
    peso: 0.04,
    daFermo: false,
  },
  {
    value: 'FUORI_DESTRA',
    label: 'Fuori area, destra',
    labelCorta: 'Fuori DX',
    peso: 0.04,
    daFermo: false,
  },
  {
    value: 'DISTANZA',
    label: 'Da lontano (oltre metà campo offensiva)',
    labelCorta: 'Distanza',
    peso: 0.02,
    daFermo: false,
  },
  {
    value: 'RIGORE',
    label: 'Rigore (6 m)',
    labelCorta: 'Rigore',
    peso: 0.75,
    daFermo: true,
  },
  {
    value: 'TIRO_LIBERO',
    label: 'Tiro libero (10 m)',
    labelCorta: 'Tiro libero',
    peso: 0.55,
    daFermo: true,
  },
]

const MAPPA_ZONE = new Map(ZONE_TIRO.map((z) => [z.value, z]))

export function zonaLabel(z: ZonaTiro): string {
  return MAPPA_ZONE.get(z)?.label ?? z
}

export function zonaLabelCorta(z: ZonaTiro): string {
  return MAPPA_ZONE.get(z)?.labelCorta ?? z
}

/** Valore xG di un singolo tiro da quella zona. */
export function pesoZona(z: ZonaTiro): number {
  return MAPPA_ZONE.get(z)?.peso ?? 0
}

export interface DefinizioneOrigine {
  value: OrigineTiro
  label: string
  labelCorta: string
  icona: string
  /** chiede anche la zona da cui è stata battuta la palla */
  richiedeBattuta: boolean
  /** chiede lo schema di palla inattiva */
  richiedeSchema: boolean
}

export interface DefinizioneInattiva {
  value: TipoInattiva
  label: string
  labelCorta: string
  icona: string
  /** chiede anche la zona da cui è stata battuta la palla */
  richiedeBattuta: boolean
}

/**
 * I quattro tipi di palla inattiva. Su tutti si possono definire schemi;
 * punizione e rimessa hanno in più un punto di battuta variabile
 * (il corner parte dalla bandierina, il calcio d'inizio dal centro).
 */
export const TIPI_INATTIVA: DefinizioneInattiva[] = [
  {
    value: 'piazzato',
    label: 'Punizione',
    labelCorta: 'Punizione',
    icona: '🧱',
    richiedeBattuta: true,
  },
  {
    value: 'corner',
    label: "Calcio d'angolo",
    labelCorta: 'Corner',
    icona: '🚩',
    richiedeBattuta: false,
  },
  {
    value: 'rimessa',
    label: 'Rimessa laterale',
    labelCorta: 'Rimessa',
    icona: '↔️',
    richiedeBattuta: true,
  },
  {
    value: 'inizio',
    label: "Calcio d'inizio",
    labelCorta: 'Inizio',
    icona: '⚪',
    richiedeBattuta: false,
  },
]

const MAPPA_INATTIVE = new Map(TIPI_INATTIVA.map((t) => [t.value, t]))

export function inattivaLabel(t: TipoInattiva): string {
  return MAPPA_INATTIVE.get(t)?.label ?? t
}

export function inattivaLabelCorta(t: TipoInattiva): string {
  return MAPPA_INATTIVE.get(t)?.labelCorta ?? t
}

export function inattivaIcona(t: TipoInattiva): string {
  return MAPPA_INATTIVE.get(t)?.icona ?? ''
}

/** Le origini sono l'azione di gioco aperto più le quattro palle inattive. */
export const ORIGINI_TIRO: DefinizioneOrigine[] = [
  {
    value: 'azione',
    label: 'Azione',
    labelCorta: 'Azione',
    icona: '⚡',
    richiedeBattuta: false,
    richiedeSchema: false,
  },
  ...TIPI_INATTIVA.map((t) => ({ ...t, richiedeSchema: true })),
]

const MAPPA_ORIGINI = new Map(ORIGINI_TIRO.map((o) => [o.value, o]))

/** Origine di un evento: gli eventi vecchi senza il campo sono azioni. */
export function origineDi(e: Evento): OrigineTiro {
  if (e.tipo === 'tiro' || e.tipo === 'gol_fatto') return e.origine ?? 'azione'
  return 'azione'
}

export function origineLabel(o: OrigineTiro): string {
  return MAPPA_ORIGINI.get(o)?.label ?? o
}

export function origineLabelCorta(o: OrigineTiro): string {
  return MAPPA_ORIGINI.get(o)?.labelCorta ?? o
}

export function origineIcona(o: OrigineTiro): string {
  return MAPPA_ORIGINI.get(o)?.icona ?? ''
}

export function origineRichiedeBattuta(o: OrigineTiro): boolean {
  return MAPPA_ORIGINI.get(o)?.richiedeBattuta ?? false
}

export function origineRichiedeSchema(o: OrigineTiro): boolean {
  return MAPPA_ORIGINI.get(o)?.richiedeSchema ?? false
}

export const ESITI_TIRO: { value: EsitoTiro; label: string; inPorta: boolean }[] = [
  { value: 'parato', label: 'Parato', inPorta: true },
  { value: 'fuori', label: 'Fuori', inPorta: false },
  { value: 'palo', label: 'Palo / traversa', inPorta: false },
  { value: 'ribattuto', label: 'Ribattuto', inPorta: false },
]

export function esitoLabel(e: EsitoTiro): string {
  return ESITI_TIRO.find((x) => x.value === e)?.label ?? e
}

export function esitoInPorta(e: EsitoTiro): boolean {
  return ESITI_TIRO.find((x) => x.value === e)?.inPorta ?? false
}

/**
 * Un evento conta come tiro se è un 'tiro' esplicito oppure un gol
 * a cui è stata associata una zona.
 */
export function zonaDiTiro(e: Evento): ZonaTiro | null {
  if (e.tipo === 'tiro') return e.zona
  if (e.tipo === 'gol_fatto' && e.zona !== undefined) return e.zona
  return null
}

/** xG totale di una lista di eventi (solo i tiri con zona). */
export function xgTotale(eventi: Evento[]): number {
  let tot = 0
  for (const e of eventi) {
    const z = zonaDiTiro(e)
    if (z !== null) tot += pesoZona(z)
  }
  return tot
}

/** Formatta un valore xG con 2 decimali. */
export function formatXG(x: number): string {
  return x.toFixed(2)
}
