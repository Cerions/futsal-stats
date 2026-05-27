@'
# Futsal Stats

App PWA per registrare statistiche di partite di calcio a 5.

**Live:** https://stellar-pony-de245a.netlify.app/

## Stack
- React + TypeScript + Vite
- Dexie.js (IndexedDB) per persistenza locale
- Tailwind CSS v4
- PWA installabile con service worker offline
- Deploy automatico via Netlify

## Stato attuale
- [x] Scheletro 4 schermate con routing
- [x] Schema DB (stagioni, avversari, giocatori, partite, eventi)
- [x] Creazione/caricamento/modifica/eliminazione stagioni
- [x] Gestione rosa giocatori e squadre avversarie (CRUD)
- [x] Creazione partite con configurazione tempi
- [x] Schermata pre-match: convocati e titolari
- [x] Schermata live: cronometro, gol, gol subiti, cambi, fine tempo
- [x] PWA installabile su Android
- [x] Deploy automatico su Netlify
- [ ] Nome squadra personalizzabile per stagione
- [ ] xG semplificato con zone di tiro
- [ ] Export/import JSON per backup
- [ ] Statistiche aggregate (marcatori, minutaggi)

## Sviluppo locale
```bash
npm install
npm run dev
```

## Build di produzione
```bash
npm run build
```
'@ | Out-File -Encoding utf8 -FilePath README.md