# ADR-019: Context Engine — fix di stabilità (loop EventBus, dedup meteo, mock trip)

**Stato**: Implementata
**Data**: Luglio 2026
**Autori**: Rocco (owner) + Gemini (diagnosi indipendente) + Claude (fix, verifica, hardening)
**Riferimenti**: [ADR-015](015-domain-events-purity.md) (Domain Events Purity), [context.engine.ts](../../src/core/engines/context/context.engine.ts), [trip.store.ts](../../src/features/trips/store/trip.store.ts), [trip.repository.ts](../../src/domain/trip/repositories/trip.repository.ts)

---

## 1. Contesto

Segnalazione utente da build TestFlight: l'app diventava progressivamente lenta fino a surriscaldare il dispositivo, la creazione di un nuovo viaggio si bloccava a metà wizard, e un viaggio eliminato ("uccidendo" l'app e riaprendola) ricompariva sempre in Home.

Una review indipendente (Gemini) ha diagnosticato la causa radice: `useTripStore` sottoscriveva l'`eventBus` in wildcard (`'*'`) e, per **qualunque** fatto di dominio con `tripId`, ricalcolava `progress`/`stats` e chiamava `updateTrip()` — che pubblica a sua volta un evento `TripUpdated`. Quell'evento rientrava nello stesso listener wildcard, richiamando `updateTrip()` di nuovo: **loop infinito** ad alta frequenza sul thread JS. `ContextEngine` aveva lo stesso pattern (`eventBus.subscribe('*', ...)` → `recompose()`), amplificando il problema.

Verificato indipendentemente durante il fix: il loop non era l'unico problema — tre difetti correlati ma distinti convivevano nello stesso sottosistema reattivo.

## 2. Decisioni

### 2.1 Interruzione del loop EventBus (bloccante)

`useTripStore`'s listener wildcard ignora esplicitamente `TripUpdated`/`TripDeleted` (non sono fatti che richiedono un ricalcolo di stats — sono l'*effetto* di un ricalcolo, non la causa), e confronta `progress`/`stats` correnti con quelli calcolati prima di chiamare `updateTrip()`: nessuna variazione → nessuna scrittura, nessun nuovo evento.

### 2.2 `TripDeleted` promosso a Domain Fact tipizzato

Era pubblicato con `type: 'TripDeleted' as any` — bypassava silenziosamente `DomainFactType`, la garanzia esplicita di ADR-015 ("l'Event Bus accetta esclusivamente Domain Facts rigorosi"). Aggiunto alla union in [`events.types.ts`](../../src/core/engines/types/events.types.ts) con `TripDeletedPayload` dedicato; `ContextEngine` lo consuma per invalidare `cachedContexts`/`subscribers` del trip eliminato (evita di ricomporre reattivamente uno stato per un trip che non esiste più).

### 2.3 `trip.stats` opzionale — guardia mancante

`stats` è `.optional()` in `TripSchema`, e il repository restituisce comunque trip che falliscono la validazione Zod (per non perdere dati, vedi §2.4 sotto). Il guard di idempotenza (2.1) leggeva `trip.stats.savedPlaces` senza controllare l'esistenza: per un trip legacy/deserializzato senza `stats`, l'accesso lanciava un `TypeError` **inghiottito dal `catch` vuoto** del listener — quel trip non aggiornava mai più `progress`/`stats`, silenziosamente. Corretto con `trip.stats ?? {}`.

### 2.4 Dedup del fetch meteo per trip (root cause delle performance)

Anche dopo aver rotto il loop, `ContextEngine.recompose()` continuava a girare a ogni singolo fatto di dominio (wildcard by design — è il compositore reattivo centrale, ADR-015), e ogni `recompose()` lanciava incondizionatamente `enrichWeatherAsync()`, una chiamata di rete. Durante il loop questo martellava l'endpoint meteo all'infinito (causa diretta del surriscaldamento riportato); ma anche a loop chiuso, *ogni* `PlaceSaved`/`TimelineReordered`/ecc. sullo stesso trip rifaceva comunque un fetch meteo ridondante, perché il meteo dipende solo da coordinate+data, non dal resto delle mutazioni.

**Decisione**: `ContextEngine` mantiene `lastWeatherKey: Map<tripId, string>` — chiave `"lat|lon|date"` dell'ultimo fetch lanciato per quel trip. Il fetch riparte solo se la chiave cambia. Libera la chiave su errore (permette retry al prossimo `recompose`) e su `TripDeleted` (cleanup, §2.2).

### 2.5 Mock trip "Budapest" — non più generato come effetto collaterale di una scrittura

Il mock di sviluppo veniva rigenerato da `getUserTrips()` ogni volta che lo storage risultava non ancora inizializzato (`rawCache === null`, distinto dall'array vuoto esplicito già gestito). Problema: `createTrip`/`updateTrip`/`deleteTrip` chiamavano tutti `getUserTrips()` internamente per leggere lo stato corrente — se il *primissimo* utilizzo dell'app in sviluppo era direttamente una scrittura (non un caricamento lista), lo storage veniva popolato con `[mockTrip, newTrip]` invece del solo viaggio reale appena creato, confondendo l'esperienza di sviluppo.

**Decisione**: introdotto `getRawTrips()` (privato, nessun seeding del mock) usato esclusivamente dai path di scrittura; `getUserTrips()` (pubblico, con seeding del mock) resta riservato al path di lettura verso la UI (`store.loadTrips()`). Il mock in produzione (`!__DEV__`) resta comunque disabilitato, invariato da questa sessione.

### 2.6 Igiene dei test — subscriber wildcard non ripuliti tra test

`context.engine.test.ts` istanzia un nuovo `ContextEngine()` in ogni `beforeEach`, ciascuno sottoscritto in wildcard sull'`eventBus` singleton condiviso dall'intero file — senza mai chiamare `eventBus.clearAllSubscribers()`, il metodo esistente esplicitamente "utile nei test o re-init del sistema" ma mai invocato. I listener delle istanze dei test precedenti restavano attivi, accumulando ricalcoli sprecati (non un errore di assertion — ogni test verifica solo la propria istanza — ma un vero leak di sottoscrizioni, individuato durante una review mirata dell'Event Bus per memory leak/listener stantii/problemi di lifecycle). Corretto aggiungendo `eventBus.clearAllSubscribers()` in `beforeEach`.

## 3. Conseguenze

**Positive**: elimina il loop che causava surriscaldamento/blocco wizard; elimina la resurrezione del mock all'eliminazione dell'ultimo viaggio; riduce le chiamate di rete meteo da "una per ogni fatto di dominio" a "una per cambio reale di posizione/data"; chiude 4 errori `tsc` (`TripDeleted as any`, `trip.stats` possibly undefined); aggiunge copertura di regressione dedicata (dedup meteo, mock trip su DB vergine).

**Non toccato, deliberatamente** (rischio/impatto basso, tracciato per una sessione futura):
- **ID evento non garantito univoco** (`evt-${Date.now()}`): collisione teorica se due eventi sono pubblicati nello stesso millisecondo. Da sostituire con `crypto.randomUUID()` quando si tocca di nuovo quel codice — non urgente isolatamente.
- **Race condition sul listener async di `trip.store.ts`**: eventi concorrenti sullo stesso trip possono leggere lo stesso snapshot pre-aggiornamento e produrre una scrittura ridondante (non un loop, solo un aggiornamento sprecato). Diventa rilevante quando più sottosistemi asincroni (sync cloud, agente AI, tracking voli) pubblicheranno eventi sullo stesso trip in rapida successione — da rivalutare in quel momento, non oggi.
- **Coesistenza mock/viaggio reale in `ContextEngine.recompose()` fallback** (righe con `if (cleanTripId === 'trip-budapest-2026') ...`): logica di fallback per-id hardcoded, preesistente, ridondante col mock del repository ma non causa un bug funzionale — solo debito cosmetico.

## 4. Verificato

`tsc --noEmit`: 0 errori. `jest`: 176/176 (13→14 suite, +3 test di regressione: dedup meteo in `context.engine.test.ts`, mock trip su DB vergine in nuovo `trip.repository.test.ts`).
