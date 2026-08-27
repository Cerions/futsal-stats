export type Ruolo = 'PORTIERE' | 'CENTRALE' | 'LATERALE' | 'PIVOT' | 'UNIVERSALE'

export interface Stagione {
  id?: number
  nome: string
  nomeSquadra: string
  dataCreazione: number
}
export interface SquadraAvversaria {
  id?: number
  stagioneId: number
  nome: string
}

export interface Giocatore {
  id?: number
  stagioneId: number
  nome: string
  cognome: string
  numero?: number
  ruolo: Ruolo
}

export interface ConfigPartita {
  numeroTempi: number
  durataTempoMinuti: number
  tempoEffettivo: boolean
}

export type StatoPartita = 'da_giocare' | 'in_corso' | 'finita'

export interface Cronometro {
  tempoCorrente: number | null
  inizioTempoTimestamp: number | null
  secondiAccumulati: number
  inPausa: boolean
}

export type TagPartita = 'Amichevole' | 'Coppa' | 'Campionato'

export const TAG_PARTITA: { value: TagPartita; colore: string; coloreBg: string }[] = [
  { value: 'Amichevole', colore: 'text-blue-100', coloreBg: 'bg-blue-600' },
  { value: 'Coppa', colore: 'text-red-100', coloreBg: 'bg-red-600' },
  { value: 'Campionato', colore: 'text-emerald-100', coloreBg: 'bg-emerald-600' },
]

/**
 * Zone di tiro semplificate per il calcio a 5.
 * La metà campo offensiva è divisa in 7 zone di campo aperto,
 * più 2 situazioni da fermo (rigore a 6m e tiro libero a 10m).
 */
export type ZonaTiro =
  | 'AREA_CENTRALE'
  | 'AREA_SINISTRA'
  | 'AREA_DESTRA'
  | 'FUORI_CENTRALE'
  | 'FUORI_SINISTRA'
  | 'FUORI_DESTRA'
  | 'DISTANZA'
  | 'RIGORE'
  | 'TIRO_LIBERO'

/**
 * Esito di un tiro che NON è finito in gol.
 * I tiri finiti in gol restano eventi 'gol_fatto' con la zona valorizzata,
 * così i gol non vengono contati due volte.
 */
export type EsitoTiro = 'parato' | 'fuori' | 'palo' | 'ribattuto'

/**
 * Da cosa nasce la conclusione. 'azione' è il default: se il campo manca
 * su un evento vecchio, va letto come azione di gioco aperto.
 * - piazzato e rimessa portano anche la zona da cui è stata battuta la palla
 * - corner porta lo schema usato
 */
export type OrigineTiro = 'azione' | 'piazzato' | 'corner' | 'rimessa'

/**
 * Schema di calcio d'angolo, definito a mano nel setup della stagione
 * e scelto in partita quando si batte un corner.
 */
export interface SchemaCorner {
  id?: number
  stagioneId: number
  nome: string
  note?: string
}

/** Campi comuni a tiri e gol, che descrivono come è nata la conclusione. */
export interface DatiOrigine {
  origine?: OrigineTiro
  /** solo per origine 'piazzato' e 'rimessa': da dove è stata battuta */
  zonaBattuta?: ZonaTiro
  /** solo per origine 'corner' */
  schemaId?: number
}

export interface Partita {
  id?: number
  stagioneId: number
  avversarioId: number
  dataOra: number
  tag?: TagPartita
  config: ConfigPartita
  convocati: number[]
  titolari: number[]
  inCampo: number[]
  stato: StatoPartita
  cronometro: Cronometro
}

export type Evento =
  | { id?: number; partitaId: number; minuto: number; tempoGioco: number; tipo: 'inizio_tempo'; tempo: number }
  | { id?: number; partitaId: number; minuto: number; tempoGioco: number; tipo: 'fine_tempo'; tempo: number }
  | ({ id?: number; partitaId: number; minuto: number; tempoGioco: number; tipo: 'gol_fatto'; giocatoreId: number; assistId?: number; zona?: ZonaTiro } & DatiOrigine)
  | { id?: number; partitaId: number; minuto: number; tempoGioco: number; tipo: 'gol_subito'; noteGiocatoreAvv?: string }
  | { id?: number; partitaId: number; minuto: number; tempoGioco: number; tipo: 'autogol_pro'; noteGiocatoreAvv?: string }
  | { id?: number; partitaId: number; minuto: number; tempoGioco: number; tipo: 'autogol_contro'; giocatoreId: number }
  | { id?: number; partitaId: number; minuto: number; tempoGioco: number; tipo: 'cambio'; giocatoreEntraId: number; giocatoreEsceId: number }
  | ({ id?: number; partitaId: number; minuto: number; tempoGioco: number; tipo: 'tiro'; giocatoreId: number; zona: ZonaTiro; esito: EsitoTiro } & DatiOrigine)
  | { id?: number; partitaId: number; minuto: number; tempoGioco: number; tipo: 'corner'; schemaId?: number }