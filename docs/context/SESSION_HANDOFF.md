# SESSION_HANDOFF.md

> Documento vivo — da aggiornare a fine di ogni sessione di lavoro significativa (umana o con agente AI), non solo periodicamente. Obiettivo: chiunque riprenda il progetto dopo giorni o settimane deve poter leggere solo questo file e sapere esattamente dove riprendere, senza dover ricostruire il contesto da `git log`. Se questo file non viene aggiornato, il primo segnale è che la sessione successiva lo scoprirà disallineato — trattalo con la stessa disciplina di [DECISIONS.md](DECISIONS.md) rispetto allo stato reale delle ADR.

---

## Ultimo aggiornamento: 2026-07-07

## Ultimo sprint

Sessione di consolidamento architetturale, in tre passi consecutivi:
1. **Sprint 13.1 — purificazione dell'Event Bus** (commit `9e06fac`): rimossi publish fittizi usati solo per forzare ricalcoli, introdotta la taxonomy granulare degli eventi Timeline (`TimelinePlaceAdded`/`Removed`/`SlotFilled`/`Optimized`/`Generated`/`AutoScheduled`), rimossa la whitelist per nome evento in `trip.store.ts`.
2. **Suite di test deterministica** (commit `747547b`): estratto `JourneyScoreCalculator` da `ContextEngine.recompose()` come Domain Service puro, aggiunti test per esso, `DistanceCalculator`, `PlaceMergeEngine`; documentato (non corretto) il caso limite NaN in ADR-016.
3. **Knowledge Base permanente** (questa sessione, non ancora committata al momento della stesura): creati 26 documenti in `/docs` (vision, architecture, glossary, agents, context) basati su ispezione diretta del codice tramite 6 agenti di ricerca paralleli, più 4 documenti di supporto operativo (`ENGINE_MAP.md`, `DECISION_TREE.md`, `ENGINE_LIFECYCLE.md`, questo file), più `.claude/context/` con collegamenti ai documenti chiave.

## Decisioni prese

- Il "Provider Layer" di ADR-001 è considerato implementato (sotto il nome SIP/`TravelServices`), non più lavoro futuro — vedi [DECISIONS.md](DECISIONS.md#adr-001).
- I bug preesistenti scoperti durante un refactoring si documentano e si bloccano con un test, non si correggono silenziosamente (pattern ADR-016, ora eletto a principio di prodotto in [PRODUCT_PRINCIPLES.md](../vision/PRODUCT_PRINCIPLES.md#2-i-bug-si-documentano-non-si-nascondono)).
- Il percorso di pianificazione legacy (`PlannerEngine`/`usePlannerStore`) resta esplicitamente non esteso, in attesa di una decisione su rimozione o migrazione — vedi [KNOWN_DEBT.md](KNOWN_DEBT.md).
- La documentazione (`/docs`) è ora la fonte di verità per architettura/vision/decisioni; il codice resta fonte di verità per il comportamento effettivo — in caso di conflitto, verificare sempre nel codice (vedi [DECISIONS.md](DECISIONS.md#perché-lo-stato-dichiarato-in-unadr-può-non-bastare)).

## Problemi aperti

Vedi il dettaglio completo in [KNOWN_DEBT.md](KNOWN_DEBT.md). I più rilevanti per chi riprende il lavoro:
- Due percorsi di pianificazione paralleli (uno morto) — decisione di rimozione/migrazione non ancora presa.
- `IMemoriesEngine` ha un naming ambiguo rispetto al futuro Traveler DNA (ADR-014 raccomanda rename a `IRecapEngine`, non ancora fatto).
- `UserContext` (risoluzione reale `tripId → userId`) è un prerequisito bloccante per il Traveler DNA, non ancora costruito.
- Auth Firebase reale ma disconnessa dalla navigazione (`app/login.tsx`).

## Prossimo task

Per priorità, secondo [CURRENT_ROADMAP.md](CURRENT_ROADMAP.md):
1. **Sprint 13.2 — Domain Lifecycle** (ADR-015): watcher fire-once per `TripStarted`/`TripCompleted`, prerequisito reale per il consolidamento del Traveler DNA.
2. **Sprint 13.3 — User Signals** (ADR-015): write path per `personalRating` → evento `PlaceRated`.
3. **Traveler DNA Fase 0** (ADR-014): sola cattura (`SignalExtractor` + log episodico), bloccata da `UserContext`.

## Ultimo commit prima di questa sessione

`747547b` — "test(core): introduce deterministic domain test suite"

## ADR attive

Vedi indice completo con stato verificato in [DECISIONS.md](DECISIONS.md). In sintesi: ADR-001 (accettata, Provider Layer già implementato), ADR-014 (proposta, design-only), ADR-015 (proposta ma Sprint 13.1 già fatto), ADR-016 (documentata, fix non implementato).
