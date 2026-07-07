# NAMING_CONVENTIONS.md

> Convenzioni realmente osservate nel codice esistente — non un ideale dichiarato altrove. Ogni regola qui ha almeno un'eccezione nota, elencata esplicitamente per evitare che un agente la applichi ciecamente.

## Prefisso `I` — riservato ai contratti comportamentali

Usato per interfacce con un'implementazione di classe concreta dietro: `IContextEngine`, `IPlacesEngine`, `ITimelineEngine`, `ILocalDatabase`, `ITimelineRule`, `ITripRepository`. **Non** usato per shape di dati puri (`JourneyScoreInput`, `JourneyScoreResult`, `PlaceRef` non hanno il prefisso). Regola pratica: se un'interfaccia è implementata da una classe con `implements`, prende `I`; se è solo una forma di dato, no.

Eccezione da conoscere: `IJourneyEngine`, `IBudgetEngine`, `IMemoriesEngine`, `IDocumentsEngine`, `ISyncEngine`, `INotificationEngine`, `IAIEngine` seguono la convenzione ma **non hanno alcuna classe implementante** — sono contratti Fase 2/3 dichiarati in anticipo. Il prefisso `I` da solo non garantisce che il motore esista.

## Suffisso `Engine`

Segnala "un'unità dedicata a una responsabilità di orchestrazione" — non garantisce side-effect I/O. `ContextEngine`/`PlacesEngine`/`TimelineEngine` (core, con persistenza) seguono il pattern atteso. `PlaceMergeEngine` è nominato "Engine" ma è in realtà una classe di soli metodi `static`, stateless — il nome segnala "motore di deduplica dedicato", non "ha stato interno". `PlannerEngine` (percorso legacy) è anch'esso statico. Non assumere I/O dal solo nome.

## Eventi — sempre tempo passato

`DomainFactType` ([events.types.ts](../../src/core/engines/types/events.types.ts)): `PlaceSaved`, `PlaceVisited`, `TimelinePlaceAdded`, `TripCompleted`... Un nuovo evento deve descrivere un fatto già accaduto, mai un comando o un'intenzione (`PlaceSave` o `SaveTimelineReorder` sarebbero nomi sbagliati). Vedi [EVENT_BUS.md](../architecture/EVENT_BUS.md#regola-doro-solo-domain-fact-mai-eventi-ui) per la regola completa e il caso reale in cui è stata applicata (Sprint 13.1).

## File — due pattern coesistenti, non intercambiabili

1. **PascalCase.ts, nessun suffisso** — per classi/servizi/regole/value-object: `DistanceCalculator.ts`, `JourneyComposer.ts`, `PlaceMergeEngine.ts`, `OpeningHoursRule.ts`. Usato in tutto `src/domain/services/` e `src/domain/trip/engine/`.
2. **kebab-case con suffisso `.ruolo.ts`** — per artefatti infrastrutturali: `.model.ts` (`place.model.ts`), `.repository.ts`/`.repository.interface.ts` (`trip.repository.ts`), `.engine.ts` (`context.engine.ts` — nota: minuscolo, diverso da `PlaceMergeEngine.ts` in PascalCase; il suffisso `.engine.ts` minuscolo è specifico di `src/core/engines/`), `.types.ts` (`context.types.ts`), `.adapter.ts` (`real-places.adapter.ts`), `.interface.ts` (`local-database.interface.ts`), `.usecase.ts`.
3. **`.store.ts`** — sempre per store Zustand, sempre dentro `src/features/*/store/`: `trip.store.ts`, `auth.store.ts`, `planner.store.ts`.
4. **Test co-locati** — `NomeClasse.test.ts` accanto al file sorgente, mai in una cartella `__tests__/` separata. Il nome del test file rispecchia sempre il PascalCase della classe testata, anche se il sorgente usa kebab-case altrove nello stesso modulo.

## Cartelle — regola non scritta, ma osservabile

Nessun CONTRIBUTING.md esiste — questa è la regola inferita dall'uso consistente, non una policy dichiarata altrove:

- `src/core/` → infrastruttura trasversale e motori reattivi (nessuna logica di business specifica)
- `src/domain/` → logica di business reale, zero dipendenze React (dove vivono tutti i 4 file di test esistenti)
- `src/features/` → slice UI verticali, consumano il dominio solo tramite `src/shared/hooks/`
- `src/shared/` → primitive davvero trasversali (componenti generici, hook del View Layer)
- `src/services/` → wrapper di integrazioni esterne per capacità (per lo più scaffolding vuoto oggi)

Vedi [ARCHITECTURE.md](../architecture/ARCHITECTURE.md#cartelle--cosa-significano) per il dettaglio completo, incluso l'albero `src/core/domain/` superato ma ancora presente.

## Lingua

Messaggi di validazione, commenti architetturali e le ADR sono scritti in italiano in tutto il codebase — coerenza da mantenere in nuovo codice nello stesso stile, non un dettaglio da "normalizzare" in inglese silenziosamente.

## Idioma ricorrente da riconoscere, non reintrodurre come astrazione

Il pattern `Array.isArray(tripId) ? tripId[0] : String(tripId || '')` (difesa contro i parametri di route array-typed di Expo Router) è duplicato decine di volte tra hook ed Engine invece di essere centralizzato in una utility condivisa. È debito noto (vedi [KNOWN_DEBT.md](../context/KNOWN_DEBT.md)), non un pattern da imitare cercando di essere coerenti — se lo si tocca, vale la pena estrarlo, non copiarlo di nuovo.
