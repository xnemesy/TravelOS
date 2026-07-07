# EVENT_BUS.md

> Meccanismo di comunicazione reattiva tra motori di dominio. Vedi [ARCHITECTURE.md](ARCHITECTURE.md) per dove si colloca nei livelli, [DOMAIN_TERMS.md](../glossary/DOMAIN_TERMS.md) per la definizione di "Domain Fact".

## Il meccanismo

`DomainEventBus` ([event-bus.ts](../../src/core/events/event-bus.ts)) è un singleton pub/sub sincrono e minimale: nessun replay, nessuna persistenza, nessun ordinamento garantito oltre l'iterazione sincrona di un `Set`. `publish(event)` invoca prima gli handler registrati sul `type` esatto dell'evento, poi separatamente quelli registrati sul wildcard `'*'`. Ogni handler è avvolto in try/catch — un subscriber che lancia un'eccezione non blocca gli altri né il publisher.

```ts
interface DomainEvent<T> {
  id: string;        // `evt-${Date.now()}` — non un UUID, collisioni teoricamente possibili ma innocue
  type: DomainFactType;
  timestamp: string;  // ISO 8601
  tripId: string;
  payload: T;
}
```

## Regola d'oro: solo Domain Fact, mai eventi UI

Dichiarata letteralmente nel codice ([events.types.ts](../../src/core/engines/types/events.types.ts)): *"L'Event Bus accetta ESCLUSIVAMENTE eventi di dominio ad alto impatto (Domain Facts). NON emettere MAI eventi UI."* Un Domain Fact deve significare sempre la stessa cosa — se lo stesso `type` può indicare sia "l'utente ha salvato un luogo" sia "sto forzando un ricalcolo interno", il canale perde significato per ogni consumer futuro che imparerà da quello stream (Traveler DNA, AI Concierge).

**Conseguenza pratica**: se publisher e consumer sono nello stesso modulo, non serve l'Event Bus — è una chiamata diretta a `contextEngine.recompose()`. Questa distinzione ha già causato un refactoring reale (Sprint 13.1, commit `9e06fac`): tre publish fittizi di `TimelineReordered` in `TimelineEngine`, usati solo per forzare un ricalcolo del `ContextEngine`, sono stati sostituiti con chiamate dirette — perché rimuoverli senza sostituzione avrebbe regredito un aggiornamento reattivo che dipendeva da una race condition asincrona ormai risolta esplicitamente (vedi commento in [timeline.engine.ts](../../src/core/engines/timeline/timeline.engine.ts)).

## Taxonomy attuale — cosa è realmente pubblicato

| Evento | Payload | Pubblicato da |
|---|---|---|
| `PlaceSaved` | `{placeId, name, category, latitude, longitude}` | `PlacesEngine` |
| `PlaceRemoved` | `{placeId}` | `PlacesEngine` |
| `PlaceVisited` | `{placeId, isVisited, visitedAt}` | `PlacesEngine` |
| `PlaceNotesUpdated` | `{placeId, notes}` | `PlacesEngine` |
| `TimelinePlaceAdded` | `{dayNumber, orderedPlaceIds}` | `TimelineEngine.addPlaceToDay` |
| `TimelinePlaceRemoved` | idem | `TimelineEngine.removePlaceFromDay` |
| `TimelineSlotFilled` | idem | `TimelineEngine.assignPlaceToTimelineSlot` |
| `TimelineReordered` | idem | `TimelineEngine.reorderDayTimeline` — **solo riordino manuale reale**, non più un evento ombrello |
| `TimelineAutoScheduled` | idem | `TimelineEngine.autoScheduleUnassignedPlaces` |
| `TimelineOptimized` | idem | `TimelineEngine.optimizeDayTimeline` |
| `TimelineGenerated` | idem | `TimelineEngine.composeDayWithAvailablePlaces` |

**Dichiarati ma mai pubblicati né sottoscritti oggi** (placeholder per Fase 2/3): `TripStarted`, `TripCompleted`, `ExpenseAdded`, `BookingImported`, `PhotoAdded`. Non presumere che esistano listener per questi eventi — introdurli richiede prima l'infrastruttura descritta in ADR-015 §2.6 (un watcher fire-once per le transizioni di stato del Trip). Vedi [CURRENT_ROADMAP.md](../context/CURRENT_ROADMAP.md).

## Chi ascolta

- **`ContextEngine`** si iscrive al wildcard `'*'` e chiama `recompose(event.tripId)` per **qualunque** evento con un `tripId` — nessun filtro per nome. Questo è deliberato: aggiungere un nuovo tipo di evento non richiede mai di aggiornare una whitelist altrove.
- **`TimelineEngine`** si iscrive esplicitamente a `PlaceVisited`, `PlaceNotesUpdated`, `PlaceRemoved` (pubblicati da `PlacesEngine`) per tenere sincronizzata la propria cache interna, poi chiama direttamente `contextEngine.recompose()` — non ripubblica un evento derivato.
- **`trip.store.ts`** (Zustand, `useTripStore`) si iscrive anch'esso al wildcard per ricalcolare `progress`/`stats` del trip ad ogni fatto — stesso principio "nessuna whitelist per nome" applicato fuori dal nucleo reattivo.

## Il pattern "state publisher" — non è l'Event Bus

Distinto dall'Event Bus: ogni motore di dominio chiama `contextEngine.registerStatePublisher(engineName, fn)` nel proprio costruttore, dove `fn: (tripId) => Partial<TravelContext>` è una lettura pura del proprio stato interno. Il `ContextEngine` **interroga** (pull) tutti i publisher registrati ad ogni `recompose()`, non riceve push. L'Event Bus serve a notificare "è successo un fatto"; il pattern state-publisher serve a rispondere "qual è il tuo stato adesso" — due meccanismi separati che non vanno confusi.

## Ciclo di ricomposizione (`ContextEngine.recompose`)

1. Costruisce una base con metadati trip (oggi ha ancora una risoluzione hardcoded per 3 trip demo — debito noto, vedi [KNOWN_DEBT.md](../context/KNOWN_DEBT.md)).
2. Interroga ogni publisher registrato e fa shallow-merge della slice ritornata (l'ultimo motore registrato vince in caso di collisione di chiave — non è un deep merge).
3. Chiama `JourneyScoreCalculator.calculate()` (Domain Service puro) per `journeyScore`/`journeyStatusLabel`.
4. Chiama le funzioni di `JourneyComposer` (tramite l'adapter deprecato `TimelineGenerator`) per `journeyStatus`, `dailyHealth`, `journeyQuality`, `currentSuggestion`.
5. Notifica sincronamente tutti i listener registrati per quel `tripId`.
6. Avvia in background (non bloccante) un arricchimento meteo via SIP; se il valore cambia, muta il context in cache e ri-notifica — un secondo canale di notifica che bypassa volutamente l'Event Bus (non è un fatto di dominio, è un arricchimento asincrono di presentazione).

## Stato di implementazione rispetto alle ADR

ADR-015 è marcata `Proposed` ma il suo Sprint 13.1 (pulizia degli eventi fittizi, taxonomy granulare, rimozione della whitelist per nome in `trip.store.ts`) è **già implementato** (commit `9e06fac`). Sprint 13.2 (watcher `TripStarted`/`TripCompleted`) e Sprint 13.3 (`PlaceRated`) restano da fare. Se si consulta ADR-015, verificare lo stato reale nel codice prima di assumere che "Proposed" significhi "non fatto" — vedi [DECISIONS.md](../context/DECISIONS.md).
