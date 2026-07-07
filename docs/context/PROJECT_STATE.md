# PROJECT_STATE.md

> Fotografia dello stato reale del codice, verificata direttamente nel repo. Aggiornare questo documento ogni volta che uno stub diventa implementazione reale o che codice morto viene rimosso — è il documento con la scadenza più breve di tutta la Knowledge Base.

## Legenda

🟢 Implementato e raggiungibile da uno screen reale · 🟡 Implementato ma parziale/mock/non raggiungibile dalla UI · 🔴 Solo interfaccia o stub, zero implementazione · ⚫ Codice morto (esiste, non è raggiunto da nulla)

## Nucleo reattivo (Fase 1)

| Componente | Stato | Note |
|---|---|---|
| `ContextEngine` | 🟢 | Compositore reattivo, wildcard subscribe, ricomposizione sincrona |
| `PlacesEngine` | 🟢 | MMKV, dedup via `PlaceMergeEngine`, pubblica Domain Fact |
| `TimelineEngine` | 🟢 | MMKV, delega calcolo a `JourneyComposer` |
| `DomainEventBus` | 🟢 | Pub/sub sincrono, wildcard, nessun replay |
| `JourneyComposer` / Rule Engine (6 regole) | 🟢 | Percorso di pianificazione attivo, usato da `itinerary.tsx` |
| `JourneyScoreCalculator` | 🟢 | Estratto come Domain Service puro, testato — include bug NaN documentato (ADR-016) |

## Motori Fase 2/3

| Componente | Stato | Note |
|---|---|---|
| `IJourneyEngine`, `IBudgetEngine`, `IMemoriesEngine`, `IDocumentsEngine`, `ISyncEngine`, `INotificationEngine`, `IAIEngine` | 🔴 | Solo interfacce in `engines.types.ts`, zero classi implementanti, non nel registro `src/core/engines/index.ts` |
| Traveler DNA / `MemoryEngine` (ADR-014) | 🔴 | Solo design (`Stato: Proposed`), nessuna riga di codice |
| `TripStarted`/`TripCompleted` watcher (ADR-015 Sprint 13.2) | 🔴 | Non costruito — `status` del Trip resta derivato a runtime, mai transizionato |
| `PlaceRated` (ADR-015 Sprint 13.3) | 🔴 | `personalRating` esiste solo nello schema Zod, zero write path/UI |

## Provider esterni (SIP / `TravelServices`)

| Dominio | Stato | Note |
|---|---|---|
| Places | 🟢 | Doppio percorso reale: dataset curato offline (`RealPlacesAdapter`) o backend Cloud Run reale (`TravelBackendRepository`, attivo oggi via `.env`) |
| Weather | 🟡 | Interfaccia e cache reali, adapter reale mai registrato → sempre mock |
| Routing | 🟡 | Idem — sempre mock |
| Opening Hours | 🟡 | Idem — sempre mock, ma consumato realmente da `OpeningHoursRule` |
| Currency | 🟡 | Idem — sempre mock (tasso fisso hardcoded) |
| Translation | 🟡 | Idem — sempre mock |
| Booking / Photos / Calendar (da ADR-001) | 🔴 | Non esistono nemmeno come interfacce |

## Backend (`backend/`)

🟢 Servizio Fastify realmente deployato su Cloud Run, con integrazione Google Places reale (circuit breaker, retry, mapping). Stateless per design (nessun DB), nessuna autenticazione. Vedi [BACKEND.md](../architecture/BACKEND.md).

## Persistenza e sync

| Componente | Stato | Note |
|---|---|---|
| MMKV / AsyncStorage fallback | 🟢 | Unico backing store reale |
| Firebase Auth | 🟡 | Reale ma raggiungibile solo da `app/login.tsx`, esplicitamente disconnesso dalla navigazione |
| Firestore / Storage (Firebase) | ⚫ | Inizializzati, mai importati altrove |
| Sincronizzazione cloud (SyncEngine) | 🔴 | Non esiste nemmeno come interfaccia |

## Screen / feature per dominio prodotto

| Area | Stato | Note |
|---|---|---|
| Trip list, creazione, archiviazione | 🟢 | `useTripStore` + `TripRepository`, completo |
| Luoghi (catalogo, ricerca, libreria) | 🟢 | 3 tab funzionanti, dedup attiva |
| Itinerario / pianificazione | 🟢 | Schermata più complessa, usa il motore attivo per intero |
| Today (tracking in tempo reale) | 🟢 | Solo `useNextPlace`/`useTravelActions`, minimale per design |
| Budget | 🟡 | Legge solo da dati mock hardcoded (`budapest.mock.ts`), nessuno store/engine dietro |
| Notes | 🟡 | Vista aggregata reattiva su `usePlaces`, nessuno store dedicato (per design: deriva, non duplica stato) |
| Wallet | 🔴 | `EmptyState` statico, nessuna logica |
| Documents | 🔴 | `EmptyState` statico ("Travel Vault"), nessuna logica |
| Auth | 🟡 | Firebase reale ma UI disconnessa dalla navigazione |
| Packing, Photos, Maps, Weather (come feature UI), Settings, Profile-detail, Today-avanzato | 🔴 | Cartelle `src/features/*` vuote, nessun codice |

## Codice morto noto (esiste, non raggiunto da nulla)

Vedi il dettaglio completo con motivazione in [KNOWN_DEBT.md](KNOWN_DEBT.md). Elenco sintetico: `usePlaceStore`/`InMemoryPlaceRepository`/`PlannerEngine` (percorso di pianificazione legacy), `src/features/trip-experience/*` (4 componenti), `TripCard.tsx`, `SmartValidationBanner.tsx`, `src/domain/trip/providers/PlaceProvider.ts`.

## Testing

🟢 4 file di test, 40 test, tutti su Domain Service puri sotto `src/domain/`. 🔴 Zero test su Engine, hook, componenti, backend. Vedi [TESTING_STRATEGY.md](../architecture/TESTING_STRATEGY.md).
