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
  | { id?: number; partitaId: number; minuto: number; tempoGioco: number; tipo: 'gol_fatto'; giocatoreId: number; assistId?: number }
  | { id?: number; partitaId: number; minuto: number; tempoGioco: number; tipo: 'gol_subito'; noteGiocatoreAvv?: string }
  | { id?: number; partitaId: number; minuto: number; tempoGioco: number; tipo: 'autogol_pro'; noteGiocatoreAvv?: string }
  | { id?: number; partitaId: number; minuto: number; tempoGioco: number; tipo: 'autogol_contro'; giocatoreId: number }
  | { id?: number; partitaId: number; minuto: number; tempoGioco: number; tipo: 'cambio'; giocatoreEntraId: number; giocatoreEsceId: number }