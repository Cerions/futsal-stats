# Futsal Stats

App PWA per registrare statistiche di partite di calcio a 5.

**Live:** https://TUOSITO.netlify.app

## Stack
- React + TypeScript + Vite
- Dexie.js (IndexedDB) per persistenza locale
- Tailwind CSS v4
- PWA installabile con service worker offline
- Deploy automatico via Netlify

## Stato attuale
- [x] Scheletro 4 schermate con routing
- [x] Schema DB (stagioni, avversari, giocatori, partite, eventi)
- [x] CRUD completo: stagioni (con nome squadra), rosa giocatori (nome, cognome, numero, ruolo), squadre avversarie, partite
- [x] Tag partita (Amichevole, Coppa, Campionato) con badge colorati
- [x] Schermata pre-match: convocati (max 12) e titolari (5)
- [x] Schermata live: cronometro per tempo, gol con assist, gol subiti, autogol pro/contro, cambi
- [x] Cronometro che riparte da 0 ad ogni nuovo tempo con avviso visivo di fine tempo
- [x] Gestione intervallo con banner esplicito per fare cambi
- [x] Eventi taggati con tempo di gioco corrente (campo tempoGioco)
- [x] Log eventi in ordine inverso cronologico
- [x] Ordinamento giocatori per ruolo (P, C, U, L, PV)
- [x] Modifica partita conclusa: cambia avversario/data/tag, aggiungi/modifica/elimina eventi
- [x] Export/import stagioni come JSON (cloud "povero" tra dispositivi)
- [x] Statistiche aggregate giocatori: presenze, partite giocate, minuti, gol, assist, autogol, gol pro/contro in campo, plus/minus, con ordinamento per colonna
- [x] xG semplificato con zone di tiro
- [x] Origine delle conclusioni: azione, calcio piazzato, calcio d'angolo, rimessa laterale
- [x] Schemi di calcio d'angolo definiti nel setup e scelti in partita, con resa per schema
- [x] PWA installabile su Android
- [x] Deploy automatico su Netlify
- [ ] xG subiti (xGA): zone anche sui tiri avversari
- [ ] Eventuale cloud sync via Supabase

## xG semplificato

Ogni conclusione viene registrata insieme alla zona da cui è partita, e ogni
zona vale un valore fisso di gol attesi. Non è un modello allenato: è una
tabella tarata su conversioni tipiche del futsal, utile per confrontare
giocatori e partite tra loro più che come previsione assoluta.

| Zona | xG |
| --- | --- |
| Area centrale | 0.35 |
| Area lato sinistro / destro | 0.16 |
| Fuori area frontale | 0.08 |
| Fuori area sinistra / destra | 0.04 |
| Da lontano | 0.02 |
| Rigore (6 m) | 0.75 |
| Tiro libero (10 m) | 0.55 |

I pesi stanno tutti in `src/db/zone.ts`: per ritararli basta cambiare i valori
di `peso`, il resto si ricalcola da solo.

I gol non vengono mai contati due volte: un tiro finito in gol è un evento
`gol_fatto` con `zona` valorizzata, gli eventi `tiro` sono solo le conclusioni
non trasformate.

## Registrare una conclusione

Tiri e gol passano dallo stesso bottone, **🎯 Tiro / Gol**, con un flusso a passi:

1. **chi ha tirato** — tra i giocatori in campo (o autogol avversario)
2. **come nasce** — azione, calcio piazzato, calcio d'angolo, rimessa laterale
3. a seconda dell'origine:
   - piazzato e rimessa → **da dove è stata battuta** la palla (mappa del campo)
   - calcio d'angolo → **quale schema**
4. **da dove ha tirato** — mappa del campo, oppure *Non lo so* per saltare
   (il gol viene registrato lo stesso, ma non conta nell'xG)
5. **esito** — gol, parato, fuori, palo, ribattuto
6. se è gol, **assist**

Il punto di battuta e la zona del tiro sono due cose distinte: chi batte una
punizione spesso non è chi conclude.

## Calci d'angolo e schemi

Gli schemi si scrivono a mano nel **setup della stagione** (nome + note
facoltative) e si scelgono in partita.

Il bottone **🚩 Corner** registra il corner battuto con il suo schema, e poi
chiede se ha prodotto una conclusione: se sì prosegue nel flusso del tiro con
origine e schema già impostati.

Corner e conclusione restano due eventi separati, ed è quello che rende leggibile
la resa di uno schema: *Corner* conta quante volte lo hai battuto, *Tiri* quante
volte ne è uscito qualcosa. Uno schema con tanti corner e pochi tiri gira a
vuoto.

Dove si legge:
- **schermata partita**: riga con tiri, xG e corner sotto il punteggio, più la
  mappa dei tiri per zona (gol/tiri, intensità in base al volume);
- **statistiche stagione**: tab *Tiri & xG* (tiri, tiri in porta, conversione,
  xG e differenza gol − xG per giocatore, più la mappa di stagione) e tab
  *Palle inattive* (resa per tipo di situazione e per schema d'angolo).

Tutto quanto sopra si aggiunge e si corregge anche a partita finita, da
*Modifica partita*: origine, punto di battuta, zona, schema, e i corner stessi.

## Formato di export

L'export JSON è alla versione 3 (aggiunge schemi d'angolo, eventi corner e
origine delle conclusioni). L'import accetta anche i file di versione 1 e 2: le
stagioni vecchie si caricano normalmente, semplicemente senza i campi nuovi.

Lo schema del database locale è alla versione Dexie 2: all'apertura la tabella
`schemi` viene creata da sola, i dati esistenti non vengono toccati.

## Sviluppo locale
```bash
npm install
npm run dev
```

## Build di produzione
```bash
npm run build
```
