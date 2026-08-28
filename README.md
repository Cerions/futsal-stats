# Futsal Stats

App PWA per registrare statistiche di partite di calcio a 5.

**Live:** https://futsalstatsrobur.netlify.app/

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
- [x] Origine delle conclusioni: azione, punizione, calcio d'angolo, rimessa laterale, calcio d'inizio
- [x] Schemi per tutte le palle inattive, definiti nel setup e scelti in partita, con resa per schema
- [x] PWA installabile su Android
- [x] Deploy automatico su Netlify
- [x] Sincronizzazione tra dispositivi via Supabase, con condivisione in sola lettura
- [ ] xG subiti (xGA): zone anche sui tiri avversari

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
2. **come nasce** — azione, punizione, calcio d'angolo, rimessa laterale,
   calcio d'inizio
3. a seconda dell'origine:
   - punizione e rimessa → **da dove è stata battuta** la palla (mappa del campo)
   - tutte le palle inattive → **quale schema**
4. **da dove ha tirato** — mappa del campo, oppure *Non lo so* per saltare
   (il gol viene registrato lo stesso, ma non conta nell'xG)
5. **esito** — gol, parato, fuori, palo, ribattuto
6. se è gol, **assist**

Il punto di battuta e la zona del tiro sono due cose distinte: chi batte una
punizione spesso non è chi conclude.

## Palle inattive e schemi

Le situazioni da fermo sono quattro, e su ognuna si possono definire schemi:

| Situazione | Punto di battuta | Schemi |
| --- | --- | --- |
| 🧱 Punizione | scelto sulla mappa | sì |
| 🚩 Calcio d'angolo | fisso (bandierina) | sì |
| ↔️ Rimessa laterale | scelto sulla mappa | sì |
| ⚪ Calcio d'inizio | fisso (centrocampo) | sì |

Gli schemi si scrivono a mano nel **setup della stagione** — nome, note
facoltative e la situazione a cui appartengono — e si scelgono in partita.

Il bottone **🚩 Palla inattiva** registra la battuta con il suo schema, e poi
chiede se ha prodotto una conclusione: se sì prosegue nel flusso del tiro con
origine e schema già impostati.

Battuta e conclusione restano due eventi separati, ed è quello che rende
leggibile la resa di uno schema: *Battute* conta quante volte lo hai giocato,
*Tiri* quante volte ne è uscito qualcosa. Uno schema con tante battute e pochi
tiri gira a vuoto.

Se scegli una palla inattiva direttamente dentro il flusso del tiro (senza
passare dal bottone dedicato), la battuta viene registrata lo stesso in
automatico, così il conteggio non si sbilancia.

Dove si legge:
- **schermata partita**: riga con tiri, xG e palle inattive sotto il punteggio,
  più la mappa dei tiri per zona (gol/tiri, intensità in base al volume);
- **statistiche stagione**: tab *Tiri & xG* (tiri, tiri in porta, conversione,
  xG e differenza gol − xG per giocatore, più la mappa di stagione) e tab
  *Palle inattive* (resa per tipo di situazione, e una tabella di schemi per
  ogni situazione).

Tutto quanto sopra si aggiunge e si corregge anche a partita finita, da
*Modifica partita*: origine, punto di battuta, zona, schema, e le battute stesse.

## Sincronizzazione tra dispositivi

I dati restano sul dispositivo: Supabase è solo il posto dove appoggiarli per
riprenderli altrove. Si sincronizza **una stagione intera alla volta**, non
record per record.

Ogni stagione sul cloud ha un contatore `versione`. Chi carica dichiara quale
versione sta sovrascrivendo: se nel frattempo ha caricato un altro dispositivo
l'update non tocca niente e l'app mostra il conflitto, con la scelta esplicita
tra scaricare la versione del cloud o sovrascriverla. Non si perde niente di
nascosto.

Il flusso normale è: registri la partita sul telefono, premi **⬆ Carica**, e
dal PC premi **⬇ Scarica**. Scaricando, il contenuto della stagione locale
viene sostituito in blocco dentro una transazione, ma l'id locale resta lo
stesso, quindi i link alle partite continuano a funzionare.

Una stagione si può condividere in **sola lettura** con altre email: chi la
riceve la vede nella sua app ma non può ricaricarla, e le policy sul database
glielo impediscono comunque.

### Configurazione

1. Crea un progetto su Supabase ed esegui `supabase/schema.sql` nel SQL Editor:
   crea la tabella `stagioni_cloud` e le policy RLS.
2. Metti in un file `.env` (non versionato) le due variabili di `.env.example`:

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=...
   ```

3. Le stesse due variabili vanno anche su Netlify, in *Site configuration →
   Environment variables*, altrimenti in produzione la sincronizzazione resta
   spenta.

La chiave anon è pubblica per definizione e finisce nel bundle: a proteggere i
dati sono le policy RLS, non la segretezza della chiave. La `service_role` non
va invece mai messa nel front-end.

Senza le variabili l'app funziona esattamente come prima, tutta offline: il
bottone di sincronizzazione semplicemente non compare.

## Formato di export

L'export JSON è alla versione 4 (gli schemi hanno un tipo, il corner battuto è
diventato un evento `inattiva` generico). L'import accetta anche i file di
versione 1, 2 e 3 e li normalizza al volo: le stagioni vecchie si caricano
normalmente, semplicemente senza i campi nuovi.

Lo schema del database locale è alla versione Dexie 3. All'apertura la
migrazione è automatica: gli schemi esistenti diventano di tipo `corner` e i
vecchi eventi `corner` diventano eventi `inattiva` con situazione `corner`.
Nessun dato viene perso.

## Sviluppo locale
```bash
npm install
npm run dev
```

## Build di produzione
```bash
npm run build
```
