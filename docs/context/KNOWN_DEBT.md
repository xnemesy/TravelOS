# KNOWN_DEBT.md

> Debito tecnico reale, verificato nel codice — non congetture. Ogni voce include perché esiste e cosa NON fare al riguardo senza una decisione esplicita.

## Due percorsi di pianificazione paralleli — uno vivo, uno morto

Il percorso legacy (`PlannerEngine`, `TravelPlace`, `usePlannerStore` per le sue funzioni di assegnazione/riordino, `usePlaceStore`, `InMemoryPlaceRepository`) è completo e testato in isolamento ma **irraggiungibile da qualunque schermata reale**. Il percorso attivo (`TimelineEngine`, `PlaceRef`, `JourneyComposer`) è quello usato da `itinerary.tsx` e da tutte le altre schermate. **Non aggiungere feature al percorso legacy.** Non è ancora stato deciso se rimuoverlo o migrarlo — è debito tracciato, non un errore da correggere autonomamente in una sessione non dedicata a questo. Vedi [ARCHITECTURE.md](../architecture/ARCHITECTURE.md#due-percorsi-di-pianificazione-paralleli--solo-uno-è-vivo).

## Due `PlaceRepository` con lo stesso nome, contratti diversi

`src/domain/trip/repositories/place.repository.ts` (`IPlaceRepository`/`TravelPlace`, morto) e `src/core/domain/repositories/PlaceRepository.ts` (`PlaceRepository`/`Place`, vivo — dietro `TravelServices.places()`). La collisione di nomi è una trappola per ricerche testuali imprecise: verificare sempre il path completo, non solo il nome del file, prima di modificare "il" `PlaceRepository`.

## Codice morto confermato (zero import esterni)

- `src/features/trip-experience/` — 4 componenti (`TripHeroHeader`, `ItinerarySummary`, `PlacesCarousel`, `TripInfoList`), nessuno importato da alcuno screen. `app/trip/[id]/index.tsx` implementa la propria UI inline invece di usarli — sembra un design precedente superato.
- `src/features/trips/components/TripCard.tsx` — soppiantato da `HeroTripCard`/`CompactTripRow`.
- `src/features/itinerary/components/SmartValidationBanner.tsx` — mai importato.
- `src/domain/trip/providers/PlaceProvider.ts` (`IPlaceProvider`/`MockPlaceProvider`) — un tentativo precedente di astrazione provider, superato dal SIP (`domain/providers/`). Zero import altrove.

Rimuovere questi file è a basso rischio (verificato zero riferimenti), ma non è stato fatto: farlo richiede comunque conferma esplicita, non un'iniziativa autonoma silenziosa in una sessione con scopo diverso.

## `IMemoriesEngine` — naming ambiguo, non ancora risolto

ADR-014 identifica che lo stub esistente `IMemoriesEngine` (`captureMoment`/`generateDailyRecap`) descrive un concetto diverso (recap/momenti del viaggio) da quello che l'ADR chiama `ITravelerDnaEngine`, e raccomanda di rinominare lo stub in `IRecapEngine` per evitare collisione semantica futura. **Questo rename non è stato ancora fatto.** Non implementare il Traveler DNA dentro `IMemoriesEngine` assumendo che sia il posto giusto solo perché il nome sembra plausibile.

## Firebase Firestore/Storage inizializzati, mai usati

`firebase.config.ts` crea istanze `db`/`storage` che nessun altro file importa. Non è un bug — è infrastruttura preparata per una sincronizzazione cloud non ancora progettata (nessuna interfaccia `ISyncEngine` esiste nemmeno). Non iniziare a usarle per una feature isolata senza una decisione architetturale su come la sincronizzazione dovrebbe funzionare nel suo complesso.

## Auth scaffolded, mai collegata

`app/login.tsx` è esplicitamente commentato come "disconnesso dalla navigazione principale". `useAuthStore` non è letto da nessun'altra parte del codice. Nessuno screen verifica lo stato di autenticazione o reindirizza un utente non autenticato. Collegare l'auth reale alla navigazione è un lavoro di prodotto/UX (flusso di onboarding, gestione sessione), non una semplice rimozione di un flag.

## Duplicazione di formule di velocità/tempo di percorrenza

`PlannerEngine` (legacy) usa un'euristica inline (~12 min/km, velocità implicita ~5km/h); `DistanceCalculator` (Domain Service attivo) usa una costante esplicita di 4.8 km/h. Due modelli indipendenti per lo stesso concetto fisico, mai riconciliati — ulteriore conseguenza della biforcazione tra i due percorsi di pianificazione, non un errore isolato da correggere in `PlannerEngine` (che resta comunque codice morto).

## Idioma difensivo duplicato invece di centralizzato

`Array.isArray(tripId) ? tripId[0] : String(tripId || '')` (difesa contro parametri di route array-typed di Expo Router) è ripetuto identico decine di volte tra hook ed Engine invece di essere in una utility condivisa in `src/shared/utils/` (cartella oggi vuota). Basso rischio, alto numero di occorrenze — un buon candidato per un refactoring mirato quando si tocca comunque uno di quei file, non un'iniziativa a sé stante.

## Resolver `userId` hardcoded

`ContextEngine.recompose()` risolve ancora oggi i metadati di 3 trip demo con un `if/else` su ID hardcoded (`trip-budapest-2026`, `trip-kyoto-2026`, `trip-amalfi-2027`), e il concetto di `userId` è un default hardcoded (`default-user`) in più punti. Questo è il prerequisito bloccante esplicito per il Traveler DNA (ADR-014) — non un dettaglio isolato, vedi [AI_ARCHITECTURE.md](../architecture/AI_ARCHITECTURE.md).

## Backend: `CacheRepository` scritto ma non collegato

`backend/src/repositories/CacheRepository.ts` è una cache TTL in-memory funzionante ma **non importata** da `PlacesService`. Scaffolding pronto per un'ottimizzazione futura, non ancora attivato.
