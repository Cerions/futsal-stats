import type { ExportData } from '../db/export'

/**
 * Impronta dei dati di una stagione: serve solo a rispondere alla domanda
 * "da quando ho sincronizzato, è cambiato qualcosa?".
 *
 * Non è crittografia, è un rilevatore di modifiche: due hash FNV-1a con seed
 * diversi più la lunghezza del JSON. Sincrono, senza dipendere da
 * crypto.subtle (che vuole un contesto sicuro), e con uno spazio abbastanza
 * grande da rendere una collisione irrilevante per l'uso che ne facciamo.
 *
 * `dataExport` è escluso di proposito: cambia a ogni export e renderebbe la
 * stagione sempre "modificata".
 */
function fnv1a(testo: string, seed: number): number {
  let h = seed >>> 0
  for (let i = 0; i < testo.length; i++) {
    h ^= testo.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

export function improntaDati(dati: ExportData): string {
  const { dataExport: _data, ...resto } = dati
  void _data
  const json = JSON.stringify(resto)
  return [
    fnv1a(json, 0x811c9dc5).toString(36),
    fnv1a(json, 0x9e3779b9).toString(36),
    json.length.toString(36),
  ].join('-')
}
