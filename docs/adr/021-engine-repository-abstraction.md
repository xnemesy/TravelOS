# ADR-021: Repository Abstraction per gli Engine di dominio

**Stato**: Implementata
**Data**: Luglio 2026
**Autori**: Rocco (owner) + Claude (analisi, design, implementazione)
**Riferimenti**: [ADR-020](020-context-engine-hydration-barrier.md) (barriera di idratazione, stesso sottosistema), [trip.repository.ts](../../src/domain/trip/repositories/trip.repository.ts) (pattern di riferimento preesistente)

---

## 1. Contesto

Review architetturale (Task 2 — Architecture Hardening): `PlacesEngine`, `TimelineEngine` e `TripSetupEngine` istanziavano `MMKVAdapter` direttamente a livello di modulo e manipolavano le proprie chiavi di storage (`places_${tripId}`, `timeline_${tripId}`, `trip_setup_${tripId}`) inline nei propri metodi — una violazione diretta della regola "gli Engine orchestrano il dominio, non conoscono i dettagli di persistenza" già rispettata altrove nel codebase (`TripRepository`, `src/domain/trip/repositories/trip.repository.ts`, esiste esattamente per questo dal Fase 1).

**Violazione aggiuntiva scoperta durante l'analisi**: `TimelineEngine.getTripTimeline()` leggeva direttamente la chiave grezza `cache_user_trips_default-user` — la stessa chiave usata da `TripRepository` per l'aggregato `Trip`, un aggregato di dominio DIVERSO — per risolvere le date del trip quando doveva generare i giorni di default. Questo non era solo "conoscenza di MMKV": era una dipendenza non dichiarata e non tipizzata su un formato di dati appartenente a un altro sottoinsieme del sistema, bypassando completamente `TripSchema`/la validazione Zod che `TripRepository` applica normalmente.

**`ContextEngine` verificato pulito prima di agire**: non istanzia mai `MMKVAdapter` né legge/scrive MMKV — il suo stato è interamente composto in-memory dai publisher registrati dagli altri Engine (per design, vedi ADR-015/ADR-020). Nessuna modifica necessaria lì.

## 2. Decisione

### 2.1 Un'interfaccia di repository per Engine, stesso pattern di `ITripRepository`

Tre nuove coppie interfaccia/implementazione, colocate con il proprio Engine:
- `IPlacesRepository`/`PlacesRepository` (`src/core/engines/places/`)
- `ITimelineRepository`/`TimelineRepository` (`src/core/engines/timeline/`)
- `ITripSetupRepository`/`TripSetupRepository` (`src/core/engines/trip-setup/`)

Ogni implementazione concreta dipende da `ILocalDatabase` (iniettata via costruttore, stesso contratto già usato da `TripRepository`) ed è l'**unico** punto del proprio sottosistema a conoscere la chiave di storage — invariata rispetto a prima di questa ADR, per compatibilità con i dati già persistiti su dispositivo.

Ogni Engine (`PlacesEngine`, `TimelineEngine`, `TripSetupEngine`) ora riceve il proprio repository via costruttore (`constructor(contextEngine, repository: IXRepository)`) e non importa più `MMKVAdapter` in alcun modo — verificato con una ricerca a tappeto (`grep -rn "MMKVAdapter\|localDb"` sui 4 file) che restituisce zero occorrenze.

### 2.2 `TripSetupRepository` assorbe anche la (de)serializzazione

Il task elenca esplicitamente "serialization" e "cache format" tra le cose che un Engine non deve conoscere. `TripSetupEngine.deserialize()` (ricostruzione delle `Date` da stringhe ISO per `createdAt`/`updatedAt`/`Transport.departureDate`/`arrivalDate`/`Accommodation.checkIn`/`checkOut`) è stata spostata **verbatim** in `TripSetupRepository`, che ora restituisce un `TripSetup | null` già completamente deserializzato — l'Engine non vede mai il payload grezzo.

### 2.3 `TimelineRepository` risolve le date del trip delegando a `ITripRepository`, non a una chiave grezza

`getTripDateRange(tripId)` sostituisce la lettura diretta di `cache_user_trips_default-user` + il parsing manuale (`new Date(trip.startDate)`) con una chiamata a `ITripRepository.getTripById(tripId)` — lo stesso repository già usato da `useTripStore`, che applica la validazione Zod e restituisce `Date` già istanziate. `TimelineEngine` non sa più che questa informazione esiste in un aggregato diverso, né come vi si accede.

**Scelta deliberata — istanza `TripRepository` indipendente**, non condivisa con quella di `trip.store.ts`: `trip.store.ts` importa già `placesEngine`/`timelineEngine`/`contextEngine` da `core/engines/index.ts` — importare da lì l'istanza di `TripRepository` di `trip.store.ts` avrebbe creato un import circolare tra i due moduli, rotto a runtime per uno dei due lati del ciclo (a seconda dell'ordine di valutazione dei moduli). `TripRepository` è stateless (nessuna cache in-memory propria, ogni chiamata legge da `ILocalDatabase`) — due istanze indipendenti sullo stesso storage sottostante restano sempre coerenti tra loro, quindi la duplicazione è sicura e deliberatamente preferita al rischio di un ciclo.

**Scelta deliberata — non usare `ContextEngine.registerTripProvider`** (il meccanismo già esistente per leggere i metadati del trip da `useTripStore` senza dipendenza circolare, usato da `ContextEngine.buildBaseContext`): quel provider è sincrono e legge lo stato **in-memory** di Zustand, popolato da `useTripStore.loadTrips()`. Usarlo per `TimelineEngine` avrebbe introdotto una NUOVA dipendenza temporale dalla idratazione dello store Zustand che il comportamento pre-ADR-021 non aveva (la lettura diretta di MMKV funzionava indipendentemente da quando/se lo store si era caricato) — un rischio di regressione rispetto al vincolo esplicito "maintain backward compatibility". `ITripRepository.getTripById` legge sempre da storage persistente, preservando esattamente lo stesso timing del codice precedente.

### 2.4 Composizione delle dipendenze centralizzata in `core/engines/index.ts`

Unico punto in cui gli Engine vengono legati a un'implementazione concreta di persistenza: un solo `MMKVAdapter` condiviso (stateless, sicuro da condividere — stesso pattern di `trip.store.ts`) costruisce i tre repository, iniettati nei rispettivi Engine. Nessun altro file istanzia `PlacesEngine`/`TimelineEngine`/`TripSetupEngine` (verificato via ricerca a tappeto) — la superficie di retrocompatibilità da preservare era quindi solo questo unico call site, aggiornato in questa stessa sessione.

## 3. Conseguenze

**Positive**: `PlacesEngine`/`TimelineEngine`/`TripSetupEngine` sono ora testabili in isolamento con repository finti in-memory, senza toccare MMKV/AsyncStorage — dimostrato dai nuovi test engine-level (`*.engine.test.ts`), che prima di questa sessione **non esistevano affatto** per questi tre Engine. Nessuna chiave di storage è cambiata: i dati già persistiti su dispositivo restano leggibili identicamente (`places_${tripId}`, `timeline_${tripId}`, `trip_setup_${tripId}` invariate). Nessuna firma di metodo pubblico degli Engine è cambiata — solo i costruttori (unico chiamante: `core/engines/index.ts`, aggiornato). Il bug latente di `TimelineEngine` che bypassava la validazione Zod dei Trip è risolto come effetto collaterale della correzione architetturale, non come fix mirato a parte.

**Non toccato, deliberatamente**:
- `src/features/itinerary/store/planner.store.ts` usa ancora `MMKVAdapter` direttamente — fuori scope: non è uno dei 4 Engine elencati nel task, e non è stato toccato codice non correlato.
- `src/domain/trip/repositories/place.repository.ts` (`IPlaceRepository`/`InMemoryPlaceRepository`) è un repository preesistente e diverso, usato da `TravelServices.places()` per l'integrazione col backend reale — non correlato a `PlacesEngine`/`IPlacesRepository` di questa ADR nonostante la somiglianza del nome.
- Nessuna migrazione di chiavi di storage: chi ha già dati persistiti li ritrova invariati.

## 4. Verificato

`tsc --noEmit`: 0 errori. `jest`: 201/201 (20 suite, +21 test nuovi: 3 file di repository × get/save/isolamento, 3 file di engine × wiring DI/roundtrip attraverso il repository iniettato/hydrate). Nessun test preesistente modificato.
