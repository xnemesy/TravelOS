# DATA_FLOW.md

> Come i dati si muovono ed dove vivono. Vedi [BACKEND.md](BACKEND.md) per il servizio esterno, [EVENT_BUS.md](EVENT_BUS.md) per il flusso reattivo interno.

## Persistenza locale — offline-first è l'unica modalità reale oggi

`ILocalDatabase` ([local-database.interface.ts](../../src/core/storage/local-database.interface.ts)) è l'unica interfaccia di storage: `get/set/remove/clearAll`. L'unica implementazione è `MMKVAdapter` ([mmkv.adapter.ts](../../src/core/storage/mmkv.adapter.ts)), che tenta `react-native-mmkv` e, se non disponibile (es. Expo Go senza codice nativo), **fallisce silenziosamente su `AsyncStorage`** con un warning in console. Tutti i valori sono serializzati JSON.

Chi persiste cosa, con quali chiavi:
- `TripRepository` → `cache_user_trips_${userId}` (array JSON di tutti i trip dell'utente)
- `PlacesEngine` → `places_${tripId}`
- `TimelineEngine` → `timeline_${tripId}`
- `usePlannerStore` → `planner_advanced_mode` (un flag booleano)

Non esiste SQLite né Isar nonostante alcuni commenti nel codice li citino come opzione futura — **MMKV/AsyncStorage è l'unico backing store reale oggi.**

## Firebase — inizializzato, non usato per dati di viaggio

`firebase.config.ts` inizializza `auth`, `db` (Firestore), `storage` per il progetto `travel-os-28bb9`. **Firestore e Storage non sono importati da nessun'altra parte del codebase** — infrastruttura morta. `auth` è realmente collegato a `AuthService` ([auth.service.ts](../../src/services/auth/auth.service.ts): sign-in/sign-up/sign-out via email-password), ma questo servizio è raggiungibile solo da `app/login.tsx`, che è esplicitamente commentato come disconnesso dalla navigazione principale. **Nessun trip o luogo viene sincronizzato su cloud oggi**: tutto è locale, per design (i commenti nel codice lo dichiarano: "Sincronizzazione Cloud: Offline-first (MMKV)"), in attesa di un futuro `SyncEngine` non ancora nemmeno abbozzato come interfaccia.

## SIP — Service Integration Platform (`TravelServices`)

Il livello che disaccoppia i motori di dominio dai provider esterni concreti, esattamente lo spirito del "Provider Layer" descritto in ADR-001 — implementato già oggi, sotto il nome `TravelServices`, non sotto quel nome letterale. Espone `.weather()`, `.routing()`, `.openingHours()`, `.places()`, `.editorial()`, `.currency()`, `.translation()`.

Meccanismo per ogni dominio: cache TTL (`CachedProvider`, es. 30min meteo / 7 giorni luoghi / 24h orari / 12h valuta / 30 giorni traduzione) → se online e un adapter reale è registrato, prova quello con try/catch → in caso di fallimento o assenza di adapter reale, **fallback silenzioso a un adapter mock deterministico** (`mock-travel.providers.ts`). Lo stato "online" è oggi simulato (`_isOnline`), non ancora collegato a `NetInfo`/rete reale — commento esplicito nel codice lo conferma.

### Copertura reale per dominio (verificata nel codice, non presunta)

| Dominio | Adapter reale registrato? | Cosa succede oggi |
|---|---|---|
| **Places** | Sì, doppio percorso | `RealPlacesAdapter` (dataset curato offline, ~100 luoghi) **oppure** `TravelBackendRepository` (chiamata HTTP reale al backend Cloud Run), scelto via `EXPO_PUBLIC_USE_REAL_PLACES`. Oggi in `.env` è `true` → luoghi reali via backend. |
| Weather | No — `registerRealAdapters()` esiste ma non viene mai chiamato | Sempre mock (`MockWeatherAdapter`, dati fissi) |
| Routing | No | Sempre mock |
| Opening Hours | No | Sempre mock |
| Currency | No | Sempre mock (es. EUR→HUF fissato a 395.5) |
| Translation | No | Sempre mock |

**Non presumere che meteo/orari/routing/valuta siano dati reali in nessuna schermata** — sono deterministici ma non veri, anche se il codice che li consuma (es. `OpeningHoursRule`, `JourneyComposer.composeDayJourneyWithSIP`) è scritto per funzionare in modo identico quando in futuro un adapter reale verrà registrato.

## Repository — attenzione alla collisione di nomi

Esistono **due astrazioni `PlaceRepository` indipendenti**, da non confondere:

1. `src/domain/trip/repositories/place.repository.ts` (`IPlaceRepository`/`TravelPlace`) — `InMemoryPlaceRepository`, puramente in-memory, **codice morto**: alimenta solo `usePlaceStore`, mai raggiunto da uno screen reale.
2. `src/core/domain/repositories/PlaceRepository.ts` (`PlaceRepository`/`Place`) — quello realmente usato da `TravelServices.places()`, risolto a `MockPlaceRepository` o `TravelBackendRepository` in base a `EXPO_PUBLIC_USE_REAL_PLACES`.

`TripRepository` ([trip.repository.ts](../../src/domain/trip/repositories/trip.repository.ts)) è invece univoco e attivo: MMKV-backed, valida con Zod ma non rifiuta mai un trip invalido (logga un warning e lo ritorna comunque, "per non perdere dati" — commento nel codice).

## Percorso end-to-end di una ricerca luoghi (oggi, configurazione reale)

```
Utente cerca un luogo (places/index.tsx)
  → TravelServices.places().searchPlaces()
    → placeRepository (= TravelBackendRepository, EXPO_PUBLIC_USE_REAL_PLACES=true)
      → TravelBackendService.fetch(`${API_URL}/places/search`)
        → backend Cloud Run → GooglePlacesProvider → Google Places API
      ← Place[] validato con Zod
  ← in caso di errore di rete: fallback a mockPlaces (mai un errore bloccante in UI)
```

## Percorso end-to-end di un salvataggio luogo

```
Utente salva un luogo (useTravelActions().savePlace)
  → PlacesEngine.savePlace()
    → PlaceMergeEngine.isSamePlace() contro i luoghi già salvati (dedup conservativa)
    → MMKVAdapter.set(`places_${tripId}`, ...)
    → eventBus.publish('PlaceSaved', {...})
      → ContextEngine.recompose(tripId) (wildcard subscribe)
      → trip.store.ts ricalcola stats/progress (wildcard subscribe)
  → useTravelContext(tripId) notifica la UI, subito, senza attendere I/O
```
