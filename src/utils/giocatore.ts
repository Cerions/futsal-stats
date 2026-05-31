import type { Giocatore } from '../db/schema'

/**
 * Nome completo del giocatore: "Nome Cognome" o solo "Nome" se manca.
 */
export function nomeCompleto(g: Giocatore): string {
  return g.cognome?.trim() ? `${g.nome} ${g.cognome}` : g.nome
}

/**
 * Versione corta: "N. Cognome" se ha cognome, altrimenti solo "Nome".
 * Utile per liste compatte (es. log eventi, scoreboard).
 */
export function nomeCorto(g: Giocatore): string {
  if (g.cognome?.trim()) {
    return `${g.nome.charAt(0)}. ${g.cognome}`
  }
  return g.nome
}