# Changelog

Tutti i cambiamenti significativi a questo progetto saranno documentati in questo file.

---

## [v0.4.0-rc2] - 2026-07-01

### Aggiunto
- Supporto nativo per **Expo Router** come entry-point principale tramite `expo-router/entry`.
- Questo changelog per il tracciamento formale delle Release Candidate.

### Rimosso
- File `App.tsx` e `index.ts` temporanei/template ereditati dall'inizializzazione del progetto.

### Corretto
- Risolto errore critico di compilazione nativa iOS dovuto a spazi nel nome cartella originale (`Travel Os`). Il progetto è stato rinominato in `TravelOS` e tutte le variabili CocoaPods e la cache JSI sono state ripulite e ricompilate con successo.
