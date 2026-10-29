/**
 * Dati di chi gestisce l'app, usati dalla privacy policy e dagli avvisi del
 * piano gratuito («scrivi a … per il Premium»).
 *
 * DA COMPILARE prima di pubblicare: finché restano vuoti la privacy policy
 * mostra un avviso al posto del contatto.
 */
export const GESTORE = {
  /** Nome e cognome di chi risponde dei dati (il «titolare»). */
  nome: 'Luca Cerioni',
  /** Email a cui scrivere per il Premium e per le richieste sui dati. */
  email: 'cerions2@gmail.com',
  /**
   * Regione del progetto Supabase dove stanno i dati sincronizzati.
   * Si legge in Supabase → Project Settings → General (es. «Frankfurt, UE»).
   */
  regioneServer: '',
} as const

/** Data dell'ultima modifica della privacy policy, da aggiornare se la cambi. */
export const PRIVACY_AGGIORNATA_IL = '28 ottobre 2026'
