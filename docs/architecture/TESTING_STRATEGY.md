# TESTING_STRATEGY.md

> La strategia di test di Travel OS è piccola, deliberata, e concentrata dove conta: la logica di dominio pura. Vedi [PRODUCT_PRINCIPLES.md](../vision/PRODUCT_PRINCIPLES.md#8-il-determinismo-è-un-requisito-di-dominio-non-un-dettaglio-di-test).

## Cosa esiste oggi

Quattro file di test, tutti co-locati accanto al file sorgente che testano (mai in una cartella `__tests__/` separata), tutti dentro `src/domain/`:

- `src/domain/services/JourneyComposer.test.ts`
- `src/domain/services/JourneyScoreCalculator.test.ts`
- `src/domain/services/DistanceCalculator.test.ts`
- `src/domain/trip/engine/PlaceMergeEngine.test.ts`

40 test totali, zero mock (`jest.mock`/`jest.fn`/`jest.spyOn` non compaiono in nessun file), zero snapshot, zero rendering di componenti React. Configurazione minima: `"jest": {"preset": "jest-expo"}` in `package.json`, nessun `jest.config.js` custom.

## Il principio: testa il calcolo puro, non l'orchestrazione

Ogni file testato è (o espone) una funzione/classe stateless senza `Date.now()`/`Math.random()`/dipendenze da Store, EventBus o ContextEngine — dichiarato esplicitamente nei commenti header di `DistanceCalculator.ts` e `JourneyScoreCalculator.ts`. La prova più diretta di questo principio è dentro lo stesso file: `JourneyComposer.ts` contiene sia codice puro (`calculateExperienceDensity`, tre numeri → un enum — **testato**) sia codice impuro (`compose()`, che usa `Date.now()` per ID sintetici e `Math.random()` per la scelta del tema — **non testato**, per scelta, non per omissione). Chi aggiunge una funzione a un Domain Service dovrebbe chiedersi: è pura? Se sì, va testata con lo stesso rigore. Se no, la sua parte non-deterministica va isolata (es. in un generatore di stringhe separato) piuttosto che innaffiare l'intera funzione di `Date.now()`.

## Il pattern "documenta il bug, non correggerlo silenziosamente"

`JourneyScoreCalculator.test.ts` contiene un `describe` esplicitamente chiamato `"preexisting edge case (documented, not fixed)"`, che asserisce `Number.isNaN(result.score) === true` quando `savedPlacesCount > 0` e `days.length === 0`. Questo comportamento è discusso in dettaglio in ADR-016 (vedi [DECISIONS.md](../context/DECISIONS.md#adr-016)): non è un bug ignorato, è un bug **bloccato da un test** per impedire regressioni accidentali del comportamento attuale finché una decisione di fix esplicita non viene presa. **Quando il fix verrà implementato, questo test va aggiornato per asserire il nuovo comportamento — non va semplicemente rimosso**, per restare documentazione vivente della decisione presa. Questo è il pattern di riferimento per qualunque futuro bug preesistente scoperto durante un refactoring: preservalo, testalo, documentalo in un ADR, non correggerlo come effetto collaterale.

## Stile dei test esistenti

- **`DistanceCalculator.test.ts`** — asserzioni per proprietà (simmetria: `dist(a,b) === dist(b,a)`), non solo valori golden.
- **`PlaceMergeEngine.test.ts`** — verifica esplicitamente il rifiuto conservativo (coordinate mancanti → mai fondere, nomi non correlati → mai fondere), coerente col principio "meglio un duplicato innocuo" (vedi [PRODUCT_PRINCIPLES.md](../vision/PRODUCT_PRINCIPLES.md#1-meglio-un-compromesso-onesto-che-un-errore-silenzioso)).
- **`JourneyScoreCalculator.test.ts`** — un helper locale `day()` costruisce input di default con override, l'unico pattern di fixture riutilizzato in tutta la suite (nessun file di fixture condiviso).

## Cosa non c'è, e perché non presumerlo

- **Nessun test di integrazione o event-replay**, nonostante l'architettura sia interamente basata su un Event Bus — i test chiamano direttamente i metodi dei Domain Service con input costruiti a mano, non simulano una sequenza di `DomainEvent` attraverso il bus. Un agente che vuole testare un flusso end-to-end (es. "salva un luogo → verifica che il context si ricomponga") non troverà un precedente da copiare: andrebbe costruito da zero.
- **Nessun test per gli Engine** (`ContextEngine`, `PlacesEngine`, `TimelineEngine`) — solo per i Domain Service che orchestrano.
- **Nessun test per componenti React o hook.**
- **Nessuna infrastruttura di mock** (`__mocks__/`, `test-utils/`) esiste — se servisse mockare un provider SIP per un test futuro, andrebbe introdotta da zero, non riusata da un precedente.

## Backend

`backend/` non ha alcun file di test — è fuori dalla superficie coperta da `jest-expo` ed è un progetto Node separato con proprio `package.json`.

## Convenzione per nuovo codice

Un nuovo Domain Service puro va accompagnato da un file `NomeClasse.test.ts` co-locato, senza mock, con asserzioni sia su valori esatti sia (dove sensato) su proprietà strutturali dell'output (simmetria, monotonicità, soglie). Un nuovo Engine con side-effect non ha un precedente di test diretto nel repo — la scelta se e come testarlo va presa esplicitamente, non per convenzione ereditata.
