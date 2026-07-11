# ADR-020: ContextEngine — Barriera di Idratazione Esplicita

**Stato**: Implementata
**Data**: Luglio 2026
**Autori**: Rocco (owner) + Claude (analisi, design, implementazione)
**Riferimenti**: [ADR-019](019-context-engine-stability-fixes.md) (fix di stabilità precedenti sullo stesso sottosistema), [ADR-015](015-domain-events-purity.md) (Domain Events Purity), [context.engine.ts](../../src/core/engines/context/context.engine.ts), [engines.types.ts](../../src/core/engines/types/engines.types.ts)

---

## 1. Contesto

Review architetturale (Task 1 — Architecture Hardening): `ContextEngine` compone il proprio stato sincronamente interrogando i publisher registrati dagli Engine di dominio (`PlacesEngine`/`TimelineEngine`/`TripSetupEngine`), ma ciascuno di questi Engine idrata il proprio stato per-trip da MMKV in modo **pigro e asincrono** — solo alla prima chiamata di un metodo come `getSavedPlaces`/`getTripTimeline`/`getTripSetup` per quel trip, mai prima.

Verificato nel codice prima di agire: 4 delle 7 schermate che leggono `useTravelContext(tripId)` (`itinerary.tsx`, `notes.tsx`, `places/[placeId].tsx`, `InspirationWizardModal.tsx`) non chiamavano mai `hydrateContext(tripId)` — l'unica funzione che forzava l'idratazione degli Engine prima di comporre. Le altre 3 (`app/trip/[id]/index.tsx`, `accommodation/index.tsx`, `transport/index.tsx`) la chiamavano, ma solo dentro un `useEffect` — **dopo** che `useTravelContext` aveva già montato il componente con lo stato del primo render, calcolato da `ContextEngine.getContext()` prima che qualunque idratazione fosse anche solo iniziata.

**Risultato**: `ContextEngine.recompose()` interrogava i publisher degli Engine quando le loro mappe in-memory (`savedPlacesMap`, `timelineMap`, cache di `TripSetupEngine`) erano ancora vuote — non perché il trip non avesse dati, ma perché nessuno aveva ancora letto quei dati da MMKV. Lo stato composto risultante (`savedPlaces: []`, `timeline.days: []`, ecc.) veniva cacheato e considerato "la verità" fino al prossimo fatto di dominio che avesse innescato un nuovo `recompose()` — che nella pratica, per le 4 schermate senza `hydrateContext()`, poteva non accadere mai in quella sessione. Questo produce esattamente i sintomi segnalati: **UI permanentemente stale** all'avvio dell'app, su deep link, al resume da background, o su navigazione diretta a una schermata che nessun'altra schermata ha "riscaldato" prima.

## 2. Decisione

### 2.1 Contratto `IHydratable` — lifecycle di idratazione esplicito per Engine

Nuova interfaccia in [`engines.types.ts`](../../src/core/engines/types/engines.types.ts):
```ts
export interface IHydratable {
  hydrate(tripId: string): Promise<void>;
}
```
`IPlacesEngine`, `ITimelineEngine`, `ITripSetupEngine` la estendono. Ogni implementazione (`PlacesEngine.hydrate`, `TimelineEngine.hydrate`, `TripSetupEngine.hydrate`) **delega al proprio getter pigro già esistente** (`getSavedPlaces`/`getTripTimeline`/`getTripSetup`), scartandone il valore di ritorno — nessun nuovo percorso di lettura da storage, solo un nome esplicito e uniforme con cui il `ContextEngine` può orchestrare l'attesa. Ogni Engine si auto-registra nel proprio costruttore (`contextEngine.registerHydratable(nome, (tripId) => this.hydrate(tripId))`), stesso momento e stesso pattern di `registerStatePublisher`.

### 2.2 `ContextEngine` come barriera — mai composizione da stato parziale

`ContextEngine` traccia uno stato di idratazione per trip (`HydrationStatus = 'idle' | 'hydrating' | 'ready'`, esposto sul `TravelContext` composto come `hydrationStatus`). `recompose(tripId)` — chiamato sia dal listener wildcard sull'`eventBus` sia direttamente da `TimelineEngine` dopo le proprie mutazioni interne — ora si biforca:
- **`status === 'ready'`**: comporta come prima, sincrono, immediato (`composeNow`) — zero regressione di reattività per un trip già idratato.
- **altrimenti**: NON interroga i publisher. Pubblica (se non già presente in cache) un placeholder onesto — stessi default puliti di sempre, ma con `hydrationStatus` che riflette lo stato reale — e assicura che l'idratazione sia in corso (`ensureHydrated`, fire-and-forget).

`ensureHydrated(tripId)` è il metodo pubblico che `getContext`/`recompose` innescano automaticamente (nessuna schermata deve più ricordarsi di chiamarlo esplicitamente) e che `hydrateContext()` (l'export storico di `core/engines/index.ts`, usato esplicitamente da 3 schermate per un `isHydrating` locale) ora delega interamente: attende `Promise.all(...)` su tutti gli `hydratable` registrati, poi chiama `composeNow(tripId)` **esattamente una volta**, che notifica tutti i subscriber con lo stato finale (`hydrationStatus: 'ready'`).

### 2.3 Deduplicazione — nessuna doppia idratazione, nessuna doppia notifica

- **In-flight dedupe**: `ensureHydrated` cachea la Promise di un'idratazione in corso (`hydrationPromises`); chiamate concorrenti/ripetute (dallo stesso `useEffect`, da un evento di dominio che arriva mentre l'idratazione è già partita, dalla chiamata esplicita `hydrateContext()` mentre `useTravelContext` l'ha già innescata implicitamente) condividono la stessa Promise — l'Engine viene idratato una sola volta.
- **Subscribe senza doppia notifica**: `subscribe()` ora calcola lo snapshot iniziale (`getContext`, che può innescare l'idratazione) **prima** di aggiungere il listener all'insieme dei subscriber, non dopo. Questo evita che un'idratazione risolta sincronamente (caso limite: nessun Engine registrato, vedi §2.4) notifichi lo stesso listener due volte per la stessa sottoscrizione iniziale.
- **Epoch anti-resurrezione**: un contatore per-trip (`hydrationEpoch`) permette a un'idratazione in corso di riconoscere di essere stata superata da un evento `TripDeleted` nel frattempo (che incrementa l'epoch e pulisce `hydrationStatus`) — l'idratazione superata termina senza chiamare `composeNow`, non resuscitando uno stato composto per un trip che nel frattempo potrebbe non esistere più.

### 2.4 Caso limite — zero Engine registrati

Se `ContextEngine` non ha alcun `hydratable` registrato (unico caso reale: un'istanza usata isolatamente nei test unitari, senza i 3 Engine reali collegati), `ensureHydrated` compone immediatamente in modo sincrono. Non è un bypass della barriera: è la corretta assenza di lavoro asincrono da attendere. In produzione `core/engines/index.ts` registra sempre i 3 Engine nel proprio costruttore prima che qualunque schermata possa chiamare `getContext`/`subscribe`, quindi questo ramo non viene mai eseguito nell'app reale — verificato mantenendo invariati i 4 test preesistenti di `context.engine.test.ts` (che costruiscono un `ContextEngine` isolato) senza modificarne le assertion.

## 3. Conseguenze

**Positive**: elimina la classe di bug "UI permanentemente stale" per tutte le schermate che leggono `useTravelContext`, incluse le 4 che non chiamavano mai `hydrateContext()` esplicitamente — **nessuna schermata è stata modificata**, il fix vive interamente in `core/engines/`. Offline-first preservato (nessuna nuova dipendenza di rete, l'idratazione legge sempre e solo da MMKV). Architettura event-driven preservata (`recompose()` resta il punto d'ingresso reattivo dell'`eventBus`, invariato nei call site). I 176 test preesistenti passano senza modifiche.

**Nuova capacità, non ancora sfruttata dalla UI**: `TravelContext.hydrationStatus` è ora disponibile per mostrare uno stato di caricamento esplicito (spinner) invece dei default vuoti durante l'idratazione — nessuna schermata lo consulta oggi (fuori scope per questo task, "non toccare schermate"), lavoro futuro naturale.

**Non toccato, deliberatamente**:
- **`registerTripProvider` (metadati trip da `useTripStore`) resta fuori dalla barriera**: la risoluzione di `tripTitle`/`destination`/date è sincrona (legge dallo stato Zustand già in memoria), non da MMKV direttamente — un gap analogo esiste comunque se una schermata è raggiunta via deep link prima che `useTripStore.loadTrips()` abbia mai risolto, ma è un sottosistema diverso (Zustand store, non un "Engine" nel vocabolario di questo codebase) e non è stato incluso nello scope esplicito ("ogni Engine espone un lifecycle di idratazione"). Tracciato per una sessione futura se il sintomo si ripresenta specificamente sui metadati del trip.
- **Idratazione degli Engine non pulita alla cancellazione del trip** (debito già noto, segnalato nella review indipendente di ADR-018 come sistemico e trasversale a `PlacesEngine`/`TimelineEngine`/`TripLifecycleWatcher`): questo task non lo risolve, ma l'epoch anti-resurrezione (§2.3) impedisce che la barriera stessa introduca una NUOVA variante del problema specifica all'idratazione.
- **Le 3 schermate che chiamano `hydrateContext()` esplicitamente** (`app/trip/[id]/index.tsx`, `accommodation/index.tsx`, `transport/index.tsx`) non sono state semplificate per rimuovere quella chiamata ora ridondante — sono ancora corrette (deduplicata, non dannosa), semplificarle è cosmetico e fuori scope ("non toccare codice non correlato").

## 4. Verificato

`tsc --noEmit`: 0 errori. `jest`: 180/180 (14 suite, +4 test di regressione dedicati alla barriera di idratazione in `context.engine.test.ts`: nessuna composizione da stato parziale, notifica esattamente una volta dopo l'idratazione, deduplicazione di idratazioni concorrenti, non-resurrezione su `TripDeleted` in-flight).

## 5. Addendum (Architecture Verification Pass — Luglio 2026): due difetti chiusi

Una pass di verifica architetturale su ADR-020/021/022 ha trovato due difetti reali in questo stesso sottosistema, entrambi corretti nella stessa sessione:

**5.1 — `useTripStore` poteva persistere progress/stats derivati dal placeholder pre-idratazione.** Il listener wildcard di `useTripStore` ([trip.store.ts](../../src/features/trips/store/trip.store.ts)) leggeva `contextEngine.getContext(tripId)` senza mai controllare il nuovo campo `hydrationStatus`. Per un trip il cui `ContextEngine` non aveva ancora completato l'idratazione (tipicamente: il primissimo fatto di dominio mai arrivato per quel trip), `getContext()` restituisce deterministicamente il placeholder onesto introdotto da questa ADR (`journeyScore: 0`, `timeline.days: []`) — e il listener, non sapendo che si trattava di un placeholder, lo trattava come stato reale, arrivando a chiamare `store.updateTrip(tripId, { progress: 0, stats: {...} })` e sovrascrivere valori reali con zeri. **Corretto**: il listener ora chiama `await contextEngine.ensureHydrated(tripId)` (la stessa barriera già pubblica, nessun nuovo meccanismo, nessuna attesa arbitraria) prima di leggere il context, e verifica esplicitamente `context.hydrationStatus === 'ready'` prima di fidarsene — se non lo è (idratazione fallita o trip eliminato nel frattempo), l'aggiornamento viene saltato invece di persistere un placeholder. Regressione bloccata da un nuovo test in [trip.store.test.ts](../../src/features/trips/store/trip.store.test.ts) (verificato fallire senza la correzione, con `progress` che tornava a `0` invece di restare al valore reale `42`).

**5.2 — `ensureHydrated()` poteva produrre un rigetto di Promise non gestito.** `composeNow()`, invocato al termine di `runHydration()` e nel ramo "0 hydratables" di `ensureHydrated()`, non era mai protetto da un try/catch proprio (a differenza della stessa chiamata sincrona in `recompose()`, già coperta dal try/catch per-handler dell'`eventBus`). Un'eccezione nel calcolo del Journey Score o della Journey Quality — dati di una giornata malformati, per esempio — si propagava come rigetto non gestito della Promise restituita da `ensureHydrated()`, dato che il chiamante fire-and-forget in `recompose()` (`void this.ensureHydrated(...)`) non ha mai un `.catch()`. **Corretto**: entrambi i punti ora chiamano un nuovo metodo privato `safeComposeNow()`, che logga l'errore invece di propagarlo. Nessun cambio di firma pubblica, nessuna modifica al percorso senza errori. Regressione bloccata da 3 nuovi test (verificati fallire senza la correzione — uno dei quali, senza il fix, faceva letteralmente crashare la suite di test con un'eccezione non catturata).

**Verificato**: `tsc --noEmit` 0 → 0 errori; `jest` 223 → 230/230 (23 suite complessive nel repository — includendo anche il fix ADR-022 §addendum sotto — di cui +4 test di regressione per questi due difetti).
