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

/**
 * Da che parte si guarda una conclusione: quelle che facciamo noi
 * ('nostro') o quelle che ci fanno gli avversari ('loro', da cui l'xGA).
 */
export type Fronte = 'nostro' | 'loro'

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

/**
 * Le origini: gioco aperto, contropiede, più le quattro palle inattive.
 * Solo le inattive hanno schemi; azione e contropiede no, sono gioco in
 * movimento e non c'è niente di preparato da scegliere.
 */
export const ORIGINI_TIRO: DefinizioneOrigine[] = [
  {
    value: 'azione',
    label: 'Azione',
    labelCorta: 'Azione',
    icona: '⚡',
    richiedeBattuta: false,
    richiedeSchema: false,
  },
  {
    value: 'contropiede',
    label: 'Contropiede',
    labelCorta: 'Contropiede',
    icona: '🏃',
    richiedeBattuta: false,
    richiedeSchema: false,
  },
  ...TIPI_INATTIVA.map((t) => ({ ...t, richiedeSchema: true })),
]

const MAPPA_ORIGINI = new Map(ORIGINI_TIRO.map((o) => [o.value, o]))

/**
 * Le origini che ha senso mostrare, per fronte.
 *
 * Delle conclusioni che subiamo registriamo solo se sono nate da contropiede:
 * mentre segui la partita non c'è tempo per classificare anche le loro palle
 * inattive. Quindi da quel lato esistono due sole categorie, e «azione» vuol
 * dire «tutto il resto» — elencare corner e punizioni a zero racconterebbe una
 * cosa falsa, cioè che non ne hanno mai battute.
 */
export function originiPerFronte(fronte: Fronte): DefinizioneOrigine[] {
  if (fronte === 'nostro') return ORIGINI_TIRO
  const azione = MAPPA_ORIGINI.get('azione')!
  const contropiede = MAPPA_ORIGINI.get('contropiede')!
  return [
    { ...azione, label: 'Resto del gioco', labelCorta: 'Resto' },
    contropiede,
  ]
}

/**
 * Origine di una conclusione, da entrambi i fronti. Gli eventi registrati
 * prima che il campo esistesse non ce l'hanno: contano come azione, che è la
 * situazione di gran lunga più comune.
 */
export function origineDi(e: Evento): OrigineTiro {
  switch (e.tipo) {
    case 'tiro':
    case 'gol_fatto':
    case 'tiro_subito':
    case 'gol_subito':
      return e.origine ?? 'azione'
    default:
      return 'azione'
  }
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

/**
 * L'origine letta come palla inattiva, o null se non lo è.
 * Azione e contropiede non hanno schemi: per loro non c'è niente da filtrare.
 */
export function origineComeInattiva(o: OrigineTiro): TipoInattiva | null {
  return MAPPA_INATTIVE.has(o as TipoInattiva) ? (o as TipoInattiva) : null
}

/**
 * Cosa conta come «tiro in porta»: solo le conclusioni che la porta l'hanno
 * presa davvero, cioè gol e parate.
 *
 * Fuori no. Palo e traversa nemmeno: il legno non è la porta, e infatti anche
 * le convenzioni professionali (Opta e simili) li contano a parte. Ribattuto
 * no di sicuro: la palla l'ha presa un difensore, non si sa dove sarebbe
 * finita.
 */
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
 * a cui è stata associata una zona. L'autogol non ha zona e non conta
 * per nessuno dei due fronti: non è una conclusione verso la porta.
 */
export function zonaDiTiro(e: Evento, fronte: Fronte = 'nostro'): ZonaTiro | null {
  if (fronte === 'nostro') {
    if (e.tipo === 'tiro') return e.zona
    if (e.tipo === 'gol_fatto' && e.zona !== undefined) return e.zona
    return null
  }
  if (e.tipo === 'tiro_subito') return e.zona
  if (e.tipo === 'gol_subito' && e.zona !== undefined) return e.zona
  return null
}

/** true se l'evento è un gol per il fronte richiesto, con la zona registrata. */
export function eGolConZona(e: Evento, fronte: Fronte = 'nostro'): boolean {
  const tipoGol = fronte === 'nostro' ? 'gol_fatto' : 'gol_subito'
  return e.tipo === tipoGol && e.zona !== undefined
}

/**
 * xG totale di una lista di eventi (solo le conclusioni con zona).
 * Con fronte 'loro' è l'xGA: quanto era probabile che gli avversari
 * segnassero da dove hanno concluso.
 */
export function xgTotale(eventi: Evento[], fronte: Fronte = 'nostro'): number {
  let tot = 0
  for (const e of eventi) {
    const z = zonaDiTiro(e, fronte)
    if (z !== null) tot += pesoZona(z)
  }
  return tot
}

/** Formatta un valore xG con 2 decimali. */
export function formatXG(x: number): string {
  return x.toFixed(2)
}
