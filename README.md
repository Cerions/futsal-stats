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
- [x] Cronometro che riparte da 0 ad ogni nuovo tempo
- [x] Eventi taggati con tempo di gioco corrente (campo tempoGioco)
- [x] Log eventi in ordine inverso cronologico
- [x] Ordinamento giocatori per ruolo (P, C, U, L, PV)
- [x] Modifica partita conclusa: cambia avversario/data/tag, aggiungi/modifica/elimina eventi
- [x] Export/import stagioni come JSON (cloud "povero" tra dispositivi)
- [x] PWA installabile su Android
- [x] Deploy automatico su Netlify
- [ ] Statistiche aggregate giocatori (gol, assist, minuti, plus/minus)
- [ ] xG semplificato con zone di tiro
- [ ] Eventuale cloud sync via Supabase

## Sviluppo locale
```bash
npm install
npm run dev
```

## Build di produzione
```bash
npm run build
```