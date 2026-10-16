import { unzipSync, strFromU8 } from 'fflate'

/**
 * Lettura del foglio dei voti tenuto finora su Google Fogli, scaricato come
 * .xlsx (o la sola scheda «Voti» come .csv).
 *
 * Serve una volta sola, per portare lo storico nell'app, quindi niente
 * libreria per Excel da mezzo mega: un .xlsx è uno zip di file XML, e qui
 * serve leggerne una scheda con sei colonne. Si cercano le colonne per nome
 * nell'intestazione (Evento, Data, Allenatore, Giocatore, Voto, Giudizio),
 * non per posizione, così una colonna spostata non sballa niente.
 *
 * Nessuna dipendenza dal DOM: si può provare anche fuori dal browser.
 */

export interface RigaFoglio {
  /** numero di riga nel foglio, per poterla ritrovare */
  riga: number
  evento: string
  /** giorno della partita, "AAAA-MM-GG", o null se illeggibile */
  giorno: string | null
  allenatore: string
  giocatore: string
  voto: number | null
  giudizio: string
}

export interface LetturaFoglio {
  righe: RigaFoglio[]
  /** righe scartate perché incomplete, con il motivo */
  scartate: { riga: number; motivo: string }[]
}

type Campo = 'evento' | 'giorno' | 'allenatore' | 'giocatore' | 'voto' | 'giudizio'

function campoDi(intestazione: string): Campo | null {
  const t = intestazione.trim().toLowerCase()
  if (t.startsWith('evento') || t.startsWith('partita')) return 'evento'
  if (t.startsWith('data')) return 'giorno'
  if (t.startsWith('allenatore') || t.startsWith('tecnico')) return 'allenatore'
  if (t.startsWith('giocatore')) return 'giocatore'
  if (t.startsWith('voto')) return 'voto'
  if (t.startsWith('giudizio') || t.startsWith('nota') || t.startsWith('note')) return 'giudizio'
  return null
}

// ---------------------------------------------------------------------------
// Celle grezze → righe
// ---------------------------------------------------------------------------

type Cella = string | number | null

function righeDaTabella(tabella: Cella[][]): LetturaFoglio {
  const iHeader = tabella.findIndex((r) => {
    const campi = r.map((c) => (typeof c === 'string' ? campoDi(c) : null))
    return campi.includes('giocatore') && campi.includes('voto')
  })
  if (iHeader < 0) {
    throw new Error(
      'Nel file non trovo le colonne «Giocatore» e «Voto»: serve la scheda «Voti» del foglio.'
    )
  }
  const colonne = new Map<Campo, number>()
  tabella[iHeader].forEach((c, i) => {
    const campo = typeof c === 'string' ? campoDi(c) : null
    if (campo && !colonne.has(campo)) colonne.set(campo, i)
  })
  for (const necessario of ['evento', 'giorno', 'allenatore'] as const) {
    if (!colonne.has(necessario))
      throw new Error(`Nel file manca la colonna «${necessario === 'giorno' ? 'Data' : necessario[0].toUpperCase() + necessario.slice(1)}».`)
  }

  const prendi = (r: Cella[], c: Campo) => {
    const i = colonne.get(c)
    return i === undefined ? null : (r[i] ?? null)
  }
  const testo = (v: Cella) => (v === null ? '' : String(v).trim())

  const righe: RigaFoglio[] = []
  const scartate: LetturaFoglio['scartate'] = []
  tabella.slice(iHeader + 1).forEach((r, k) => {
    const riga = iHeader + 2 + k
    const giocatore = testo(prendi(r, 'giocatore'))
    const evento = testo(prendi(r, 'evento'))
    const allenatore = testo(prendi(r, 'allenatore'))
    const giudizio = testo(prendi(r, 'giudizio'))
    const grezzoVoto = prendi(r, 'voto')
    if (!giocatore && !evento && !allenatore && grezzoVoto === null && !giudizio) return // riga vuota
    const voto = leggiNumero(grezzoVoto)
    if (!giocatore || !evento || !allenatore) {
      scartate.push({ riga, motivo: 'mancano partita, allenatore o giocatore' })
      return
    }
    if (voto === undefined) {
      scartate.push({ riga, motivo: `voto «${testo(grezzoVoto)}» non valido` })
      return
    }
    if (voto === null && !giudizio) {
      scartate.push({ riga, motivo: 'né voto né giudizio' })
      return
    }
    righe.push({
      riga,
      evento,
      giorno: leggiGiorno(prendi(r, 'giorno')),
      allenatore,
      giocatore,
      voto,
      giudizio,
    })
  })
  return { righe, scartate }
}

/** Numero dal foglio: 6.5, "6,5", "6.5". Vuoto → null, illeggibile o fuori 1–10 → undefined. */
function leggiNumero(v: Cella): number | null | undefined {
  if (v === null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'))
  if (!Number.isFinite(n) || n < 1 || n > 10) return undefined
  return Math.round(n * 100) / 100
}

/**
 * Data dal foglio: numero seriale di Excel (giorni dal 30/12/1899), oppure
 * testo "28/08/2026" o "2026-08-28". Si tiene solo il giorno.
 */
function leggiGiorno(v: Cella): string | null {
  if (v === null || v === '') return null
  const due = (n: number) => String(n).padStart(2, '0')
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400000))
    return `${d.getUTCFullYear()}-${due(d.getUTCMonth() + 1)}-${due(d.getUTCDate())}`
  }
  const t = v.trim()
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${due(+m[2])}-${due(+m[3])}`
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (m) {
    const anno = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
    return `${anno}-${due(+m[2])}-${due(+m[1])}`
  }
  if (/^\d+(\.\d+)?$/.test(t)) return leggiGiorno(Number(t))
  return null
}

// ---------------------------------------------------------------------------
// XLSX
// ---------------------------------------------------------------------------

const ENTITA: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
function decodifica(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (tutto, e: string) => {
    if (e[0] === '#')
      return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
    return ENTITA[e] ?? tutto
  })
}

/** Il testo di un nodo con eventuali pezzi formattati (<r><t>…</t></r>). */
function testoNodo(xml: string): string {
  let out = ''
  for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += m[1]
  return decodifica(out)
}

function indiceColonna(lettere: string): number {
  let n = 0
  for (const c of lettere) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}

function leggiXlsx(bytes: Uint8Array): Cella[][] {
  const file = unzipSync(bytes)
  const leggi = (p: string) => (file[p] ? strFromU8(file[p]) : null)

  const workbook = leggi('xl/workbook.xml')
  const rels = leggi('xl/_rels/workbook.xml.rels')
  if (!workbook || !rels) throw new Error('Il file non sembra un .xlsx valido.')

  const condivise: string[] = []
  const ss = leggi('xl/sharedStrings.xml')
  if (ss) for (const m of ss.matchAll(/<si>([\s\S]*?)<\/si>/g)) condivise.push(testoNodo(m[1]))

  // Le schede, nell'ordine del file; si preferisce quella che si chiama «Voti»
  const schede = [...workbook.matchAll(/<sheet\b[^>]*>/g)].map((m) => ({
    nome: decodifica(m[0].match(/name="([^"]*)"/)?.[1] ?? ''),
    rid: m[0].match(/r:id="([^"]*)"/)?.[1] ?? '',
  }))
  const percorso = (rid: string) => {
    const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].find((m) => m[0].includes(`Id="${rid}"`))
    const target = rel?.[0].match(/Target="([^"]*)"/)?.[1]
    if (!target) return null
    return target.startsWith('/') ? target.slice(1) : `xl/${target}`
  }
  const ordinate = [
    ...schede.filter((s) => s.nome.trim().toLowerCase() === 'voti'),
    ...schede.filter((s) => s.nome.trim().toLowerCase() !== 'voti'),
  ]

  for (const s of ordinate) {
    const p = percorso(s.rid)
    const xml = p ? leggi(p) : null
    if (!xml) continue
    const tabella = tabellaDaScheda(xml, condivise)
    const haIntestazione = tabella.some((r) => {
      const campi = r.map((c) => (typeof c === 'string' ? campoDi(c) : null))
      return campi.includes('giocatore') && campi.includes('voto')
    })
    if (haIntestazione) return tabella
  }
  throw new Error('Nel file non trovo la scheda dei voti (colonne «Giocatore» e «Voto»).')
}

function tabellaDaScheda(xml: string, condivise: string[]): Cella[][] {
  const tabella: Cella[][] = []
  for (const r of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const numero = Number(r[0].match(/\br="(\d+)"/)?.[1] ?? tabella.length + 1)
    const riga: Cella[] = []
    for (const c of (r[1] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attr = c[1]
      const dentro = c[2] ?? ''
      const ref = attr.match(/\br="([A-Z]+)\d+"/)?.[1]
      const col = ref ? indiceColonna(ref) : riga.length
      const tipo = attr.match(/\bt="([^"]*)"/)?.[1]
      const v = dentro.match(/<v>([\s\S]*?)<\/v>/)?.[1]
      let valore: Cella = null
      if (tipo === 's') valore = v !== undefined ? (condivise[Number(v)] ?? null) : null
      else if (tipo === 'inlineStr') valore = testoNodo(dentro)
      else if (tipo === 'str' || tipo === 'e') valore = v !== undefined ? decodifica(v) : null
      else if (tipo === 'b') valore = v === '1' ? 'VERO' : 'FALSO'
      else if (v !== undefined) valore = Number(v)
      riga[col] = valore
    }
    tabella[numero - 1] = Array.from(riga, (x) => x ?? null)
  }
  return Array.from(tabella, (r) => r ?? [])
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function leggiCsv(testo: string): Cella[][] {
  const pulito = testo.replace(/^\uFEFF/, '')
  // Google esporta con la virgola; un CSV fatto in Excel italiano usa il ;
  const primaRiga = pulito.split(/\r?\n/, 1)[0]
  const sep = (primaRiga.match(/;/g)?.length ?? 0) > (primaRiga.match(/,/g)?.length ?? 0) ? ';' : ','
  const righe: Cella[][] = []
  let riga: Cella[] = []
  let campo = ''
  let tra = false
  for (let i = 0; i < pulito.length; i++) {
    const c = pulito[i]
    if (tra) {
      if (c === '"' && pulito[i + 1] === '"') {
        campo += '"'
        i++
      } else if (c === '"') tra = false
      else campo += c
    } else if (c === '"') tra = true
    else if (c === sep) {
      riga.push(campo)
      campo = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && pulito[i + 1] === '\n') i++
      riga.push(campo)
      righe.push(riga)
      riga = []
      campo = ''
    } else campo += c
  }
  if (campo !== '' || riga.length > 0) {
    riga.push(campo)
    righe.push(riga)
  }
  return righe.map((r) => r.map((x) => (x === '' ? null : x)))
}

// ---------------------------------------------------------------------------

export function leggiFoglio(nomeFile: string, bytes: Uint8Array): LetturaFoglio {
  const csv = /\.csv$/i.test(nomeFile)
  // Un .xlsx inizia con la firma dello zip, "PK"
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b
  if (!csv && !zip) throw new Error('Formato non riconosciuto: servono un .xlsx o un .csv.')
  const tabella = zip ? leggiXlsx(bytes) : leggiCsv(new TextDecoder('utf-8').decode(bytes))
  return righeDaTabella(tabella)
}
