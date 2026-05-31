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

export interface Partita {
  id?: number
  stagioneId: number
  avversarioId: number
  dataOra: number
  config: ConfigPartita
  convocati: number[]
  titolari: number[]
  inCampo: number[]
  stato: StatoPartita
  cronometro: Cronometro
}

export type Evento =
  | { id?: number; partitaId: number; minuto: number; tipo: 'inizio_tempo'; tempo: number }
  | { id?: number; partitaId: number; minuto: number; tipo: 'fine_tempo'; tempo: number }
  | { id?: number; partitaId: number; minuto: number; tipo: 'gol_fatto'; giocatoreId: number; assistId?: number }
  | { id?: number; partitaId: number; minuto: number; tipo: 'gol_subito'; noteGiocatoreAvv?: string }
  | { id?: number; partitaId: number; minuto: number; tipo: 'cambio'; giocatoreEntraId: number; giocatoreEsceId: number }