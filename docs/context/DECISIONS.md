# DECISIONS.md

> Indice delle Architecture Decision Record in `docs/adr/`, con stato **verificato nel codice**, non solo il campo `Stato` dichiarato nel documento (che può essere disallineato — vedi sotto).

## ADR-001 — Composizione Reattiva dello Stato e Roadmap verso il Provider Layer

[docs/adr/001-reactive-state-composition-vs-async-storage.md](../adr/001-reactive-state-composition-vs-async-storage.md)

**Dichiara**: Accettato/Validato. **Verificato**: sì — il pattern ContextEngine/Event Bus/View Layer Hooks descritto è realmente implementato ed è il nucleo reattivo di oggi (vedi [ARCHITECTURE.md](../architecture/ARCHITECTURE.md)). Il "Provider Layer" descritto come lavoro futuro ("Pre-Fase 2") è in realtà **già implementato** sotto il nome SIP/`TravelServices` — l'ADR va considerato superato in questo punto specifico, non ancora aggiornato per riflettere lo stato reale. Vedi [DATA_FLOW.md](../architecture/DATA_FLOW.md). Nota tecnica: questo file non risulta mai committato in git (sempre `??` in `git status`) nonostante descriva l'architettura fondante del progetto.

## ADR-014 — Traveler DNA / Memory Engine

[docs/adr/014-traveler-dna-memory-engine.md](../adr/014-traveler-dna-memory-engine.md)

**Dichiara**: `Proposed — Solo design, nessuna implementazione`. **Verificato**: corretto, zero codice esiste. Disegna un `MemoryEngine` che deriva un profilo comportamentale (`TravelerDNA`) dallo stream di eventi, prerequisito architetturale per un futuro AI Concierge. Blocco reale: richiede `UserContext` (risoluzione `tripId → userId`), oggi hardcoded su un utente di default. Vedi [AI_ARCHITECTURE.md](../architecture/AI_ARCHITECTURE.md).

## ADR-015 — Domain Events Purity (Sprint 13.1/13.2/13.3)

[docs/adr/015-domain-events-purity.md](../adr/015-domain-events-purity.md)

**Dichiara**: `Proposed — Solo design, nessuna implementazione`. **Verificato**: **disallineato** — Sprint 13.1 (pulizia eventi fittizi, taxonomy granulare degli eventi Timeline, rimozione whitelist per nome in `trip.store.ts`) è già implementato nel commit `9e06fac` ("fix: purify domain events bus"), datato dopo la stesura dell'ADR. Sprint 13.2 (watcher `TripStarted`/`TripCompleted`) e Sprint 13.3 (`PlaceRated`) restano non implementati, coerenti con lo stato dichiarato. **Trattare questo documento come parzialmente eseguito, non come puro design.** Vedi [EVENT_BUS.md](../architecture/EVENT_BUS.md) e [CURRENT_ROADMAP.md](CURRENT_ROADMAP.md).

## ADR-016 — Journey Score: caso limite NaN

[docs/adr/016-journey-score-nan-edge-case.md](../adr/016-journey-score-nan-edge-case.md)

**Dichiara**: `Documentato — correzione proposta, non implementata`. **Verificato**: corretto. Un caso limite preesistente (`savedPlacesCount > 0` con `days.length === 0` → divisione 0/0 → `NaN` propagato nel punteggio) è stato scoperto durante l'estrazione di `JourneyScoreCalculator` da `ContextEngine`, preservato deliberatamente (non è stato "corretto silenziosamente" durante il refactoring) e bloccato da un test esplicito. Tre opzioni di fix proposte, nessuna implementata; l'Opzione A (guardia locale sulla divisione) è la raccomandata. Vedi [TESTING_STRATEGY.md](../architecture/TESTING_STRATEGY.md) per il pattern generale che questa ADR esemplifica.

## Perché lo stato dichiarato in un'ADR può non bastare

Le ADR in questo repo sono documenti di decisione scritti in un momento preciso — non vengono necessariamente riaperte e aggiornate quando il codice che descrivono viene poi implementato (vedi ADR-015). **Prima di trattare un'ADR come "non fatta" per il solo fatto che dice `Proposed`, verifica nel codice sorgente citato o in `git log`.** Questo documento (`DECISIONS.md`) esiste per mantenere quella verifica aggiornata senza dover rileggere ogni volta l'intera ADR e il codice.

## Aggiungere una nuova ADR

Le ADR vivono in `docs/adr/`, numerate progressivamente, in italiano, seguendo lo stile esistente (Contesto → Decisione → Conseguenze → Alternative considerate). Dopo averla scritta, aggiungi una voce qui con lo stato verificato — non lasciare che questo indice diventi stale come è successo al campo `Stato` di ADR-015.
