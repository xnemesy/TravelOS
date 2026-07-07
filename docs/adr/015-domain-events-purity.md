# ADR-015: Domain Events Purity — Scope Sprint 13.1 / 13.2 / 13.3

**Stato**: Proposed — Solo design, nessuna implementazione
**Data**: Luglio 2026
**Autori**: Rocco (owner) + Claude (design review)
**Dipende da**: [ADR-014 — Traveler DNA / Memory Engine](./014-traveler-dna-memory-engine.md)

---

## 1. Contesto

L'audit dell'Event Bus condotto per preparare il Memory Engine (ADR-014) ha trovato pubblicazioni di eventi che non rappresentano fatti realmente accaduti, ma trigger tecnici travestiti da Domain Fact. Questo viola la regola già scritta nel codice stesso:

> "L'Event Bus accetta ESCLUSIVAMENTE eventi di dominio ad alto impatto (Domain Facts). NON emettere MAI eventi UI." — [events.types.ts](../../src/core/engines/types/events.types.ts)

Un Domain Event deve significare **sempre** la stessa cosa. Se `PlaceSaved` può significare sia "l'utente ha salvato un luogo" sia "sto forzando un ricalcolo interno", il canale perde significato — e qualunque consumer futuro (Memory Engine, AI Concierge) imparerà da rumore, non da fatti.

Questo ADR fissa il fix, verificato riga per riga contro il codice reale (non contro l'intento dichiarato), e separa cosa è pulizia pura da cosa richiede costruire una feature che oggi non esiste.

---

## 2. Decisioni

### 2.1 `hydrateContext` — nessun evento, chiamata diretta

`hydrateContext` in [core/engines/index.ts](../../src/core/engines/index.ts) pubblica un `PlaceSaved` con `payload: { placeId: 'hydrate' }` solo per forzare `ContextEngine.recompose`. Ma `contextEngine.recompose(tripId)` è già un metodo pubblico dell'interfaccia `IContextEngine`, ed è già importato nello stesso file.

**Decisione**: sostituire il publish finto con una chiamata diretta a `contextEngine.recompose(cleanTripId)`. Non serve l'Event Bus quando chiamante e consumer sono nello stesso modulo — l'Event Bus serve a comunicare un fatto a consumer che non si conoscono, non a questo caso.

### 2.2 I 3 `TimelineReordered` finti in `TimelineEngine` — sostituire con recompose diretto

`markPlaceAsVisited`, `updatePlaceNotes`, `removePlaceFromAllDays` in [timeline.engine.ts](../../src/core/engines/timeline/timeline.engine.ts) sono già handler registrati sui fatti reali `PlaceVisited`, `PlaceNotesUpdated`, `PlaceRemoved` pubblicati da `PlacesEngine`. Dopo aver aggiornato la propria cache interna, ripubblicano un `TimelineReordered` fittizio (`{ dayNumber: 1, orderedPlaceIds: [] }`) con un nome che non descrive quello che è successo.

**Correzione rispetto alla prima stesura di questo ADR**: la prima versione diceva "rimuovere, nessuna sostituzione", assumendo che `ContextEngine` reagisse già al fatto originale. La verifica dell'ordine di esecuzione (Sprint 13.1 planning) ha dimostrato che l'assunzione è falsa a causa di una race asincrona:

1. `PlacesEngine` pubblica `PlaceVisited`.
2. `publish()` invoca prima l'handler specifico di `TimelineEngine`, che è `async` e si **sospende** al primo `await this.getTripTimeline()` — la `timelineMap` non è ancora aggiornata.
3. `publish()` invoca poi l'handler wildcard: `ContextEngine.recompose()` gira **sincrono**, legge la slice del `TimelineEngine` con lo stato **ancora stale**.
4. Solo dopo i microtask, `TimelineEngine` completa l'update — e il `TimelineReordered` finto è ciò che oggi innesca il secondo recompose con i dati freschi.

Il fatto finto è quindi **load-bearing**: rimuoverlo senza sostituzione regredisce l'avanzamento reattivo del "prossimo posto" dopo un check-in.

**Decisione**: sostituire i 3 publish finti con una chiamata diretta `this.contextEngine.recompose(cleanTripId)` dopo l'update di cache. È lo stesso pattern del §2.1 (`hydrateContext`): "ho aggiornato la mia cache, ricomponi" è una chiamata in-process, non un fatto di dominio. `TimelineEngine` riceve già `contextEngine` nel costruttore ma non lo memorizza — va salvato in un campo privato.

### 2.3 Taxonomy granulare per gli eventi Timeline realmente primari

Il quarto caso (`autoScheduleUnassignedPlaces`) e le emissioni "vere" già esistenti vanno mappate su una taxonomy specifica invece di un unico tipo ombrello, per restituire significato univoco a ogni evento:

| Call site (`TimelineEngine`) | Evento proposto | Nota |
|---|---|---|
| `addPlaceToDay` | `TimelinePlaceAdded` | |
| `removePlaceFromDay` | `TimelinePlaceRemoved` | |
| `reorderDayTimeline` | `TimelineReordered` | Torna al significato originale: solo riordino manuale reale |
| `assignPlaceToTimelineSlot` | `TimelineSlotFilled` | Nome coerente con "Smart Slot Filling", terminologia già usata nel codebase ([engines.types.ts:57](../../src/core/engines/types/engines.types.ts:57)) |
| `optimizeDayTimeline` | `TimelineOptimized` | Segnale utile anche per il futuro Memory Engine: se l'utente non modifica manualmente dopo un'optimize, è un implicito "accettato" |
| `composeDayWithAvailablePlaces` | `TimelineGenerated` | Prima generazione di una giornata, distinta da una modifica |
| `autoScheduleUnassignedPlaces` | `TimelineAutoScheduled` | Il solo caso genuinamente nuovo — non esisteva un fatto reale da cui derivarlo |

### 2.4 Conseguenza obbligata: `trip.store.ts` non deve più filtrare per nome

[trip.store.ts:148](../../src/features/trips/store/trip.store.ts:148) oggi ricalcola le statistiche del trip solo se `event.type === 'PlaceSaved' || 'PlaceRemoved' || 'TimelineReordered'`. Dopo l'introduzione della taxonomy granulare, `TimelineReordered` non scatta più per add/remove/optimize/generate/autoschedule — quel filtro smetterebbe silenziosamente di aggiornare le statistiche per tutto tranne il riordino manuale. È una regressione nascosta introdotta dalla pulizia stessa, non un rischio ipotetico.

**Decisione**: rimuovere la whitelist per nome nel listener di `trip.store.ts` e ricalcolare su qualunque evento con `tripId` presente, esattamente come fa già `ContextEngine` col proprio wildcard subscribe. Elimina anche la necessità di aggiornare questa lista ogni volta che si introduce un nuovo tipo di evento in futuro.

### 2.5 Allineamento tipo/payload di `PlaceVisited`

`PlaceVisitedPayload` dichiara `{ placeId, visitedAt }` ma ogni `publish` reale invia anche `isVisited: boolean` — il campo che distingue un check-in da un suo annullamento. **Decisione**: aggiornare l'interfaccia dichiarata per includere `isVisited`, così il tipo smette di mentire su cosa viene effettivamente trasmesso.

### 2.6 `TripCompleted` — non è un publish da aggiungere, serve un watcher fire-once

Verifica sul codice: `trip.status === 'completed'` non è mai persistito né transizionato esplicitamente. `TripCalculator.getTripStatus()` ([trip-calculator.ts:14-22](../../src/core/travel-engine/trip-calculator.ts:14)) lo **deriva** confrontando `now` con `trip.endDate` a ogni chiamata — è una funzione pura di lettura, ricalcolata a ogni render. `trip.store.ts` espone solo `archiveTrip()` (→ status `'archived'`); nessuna azione porta mai lo status a `'completed'` nello storage.

Non esiste quindi una transizione esistente a cui agganciare un `publish('TripCompleted')`. Serve un meccanismo nuovo, minimo ma reale: un watcher che confronti lo stato derivato corrente con l'ultimo stato persistito conosciuto, e pubblichi `TripCompleted` solo alla prima transizione rilevata — poi persista il flip per non ripubblicare a ogni render successivo (il calcolo è chiamato in continuazione dalla UI).

**Decisione**: questo esce dallo scope di "pulizia" e va trattato come infrastruttura di dominio separata (§3, Sprint 13.2 — Domain Lifecycle), non come una feature utente. È un'infrastruttura, non una feature, perché è vera indipendentemente da qualunque azione dell'utente: il trip "diventa completato" per il solo passare del tempo, non perché qualcuno lo richiede. È comunque un prerequisito reale per il consolidamento del Traveler DNA descritto in ADR-014 — senza un momento discreto "il viaggio è finito", il DNA non ha mai un punto in cui applicare il decay.

Lo stesso identico problema affligge `TripStarted` (mai emesso, verificato nell'audit): anche `planned → ongoing` è oggi derivato da `now >= trip.startDate` in `TripCalculator`, non persistito, nessuna transizione osservabile. Costruire il watcher fire-once solo per `completed` e non per `ongoing` sarebbe una mezza misura — stesso meccanismo, due transizioni. **Decisione**: Sprint 13.2 (Domain Lifecycle) include entrambe le transizioni.

**Nota di design da risolvere dentro lo sprint, non qui**: se l'app non viene aperta durante l'intero arco del viaggio e viene riaperta dopo `endDate`, il watcher deve decidere se emettere `TripStarted` seguito da `TripCompleted` in sequenza, o saltare direttamente a `completed` senza mai annunciare l'inizio. È una scelta di semantica del lifecycle (il DNA/Memory Engine si aspetta comunque entrambi i fatti, o accetta che alcuni trip non abbiano mai un `TripStarted`?), non un dettaglio implementativo.

### 2.7 `PlaceRated` — accoppiato a una feature che non esiste ancora

Verifica sul codice: `personalRating` esiste **solo nello schema Zod** ([place.model.ts:67](../../src/domain/trip/models/place.model.ts:67)). Zero write path: nessuna UI, nessuna azione nello store che lo scriva. L'evento non ha nulla da annunciare perché il comportamento che dovrebbe generarlo non è stato costruito.

**Decisione**: `PlaceRated` esce da Sprint 13.1. Va costruito insieme alla feature di voto stessa (azione di scrittura + UI minima), non aggiunto isolatamente a un flusso che non esiste. A differenza di `TripCompleted`, questo è un vero segnale utente — esiste solo perché una persona compie un'azione esplicita — quindi appartiene a un sprint distinto (13.3 — User Signals), non alla stessa categoria di `TripCompleted`/`TripStarted`.

---

## 3. Scope proposto

### Sprint 13.1 — Pulizia pura (~1 giorno, zero nuova superficie funzionale)
- [ ] Sostituire i 3 publish finti in `TimelineEngine` con `contextEngine.recompose()` diretto (§2.2) — memorizzando il ref a `contextEngine` nel costruttore
- [ ] Sostituire il publish finto in `hydrateContext` con `contextEngine.recompose()` diretto (§2.1)
- [ ] Introdurre la taxonomy granulare `TimelinePlaceAdded` / `TimelinePlaceRemoved` / `TimelineSlotFilled` / `TimelineOptimized` / `TimelineGenerated` / `TimelineAutoScheduled` (§2.3)
- [ ] Aggiornare `trip.store.ts` per non filtrare più per nome evento (§2.4)
- [ ] Allineare `PlaceVisitedPayload` al payload reale (§2.5)

### Sprint 13.2 — Domain Lifecycle (infrastruttura di dominio, non feature utente)
- [ ] Watcher fire-once per le transizioni di stato del Trip: `TripStarted` (`planned/ready → ongoing`) e `TripCompleted` (`ongoing → completed`) (§2.6)
- [ ] Decisione di design sulla sequenza mancata (app non apre durante il viaggio: emettere entrambi i fatti o solo `TripCompleted`?)
- [ ] Prerequisito reale per il consolidamento del Traveler DNA (ADR-014) — senza un momento discreto "il viaggio è finito", il DNA non ha mai un punto in cui applicare il decay

### Sprint 13.3 — User Signals (segnali comportamentali espliciti)
- [ ] Azione di scrittura + UI minima per il rating personale → evento `PlaceRated` (§2.7)
- [ ] Estensioni naturali della stessa categoria: preferiti, feedback espliciti

### Fuori scope (dipendenze non ancora pronte)
- `RecommendationAccepted` / `RecommendationIgnored` — richiedono che esista un suggerimento reale da accettare o ignorare; dipendono dal futuro AI Concierge, non prima.
- `PlaceSkipped`, `PlaceLeftEarly`, `PlaceStayedLongerThanExpected` — richiedono che `TimelineEngine` tracci planned vs actual in tempo reale (live tracking), non ancora costruito.

---

## 4. Perché la separazione in tre sprint non è pignoleria

Sprint 13.1 promette "un giorno, solo pulizia" — rifattorizzare codice che esiste già, rischio basso e ben compreso. Se ci si infila un watcher con stato persistito (`TripCompleted`/`TripStarted`) e una feature di scrittura UI (`PlaceRated`), lo sprint sfora la stima e mischia tre categorie di rischio diverse.

La distinzione tra 13.2 e 13.3 non è solo di dimensione, è di **natura**: un test utile per il futuro è chiedersi se il fatto sarebbe vero anche in assenza di qualunque azione dell'utente.
- **Domain Lifecycle (13.2)**: `TripCompleted`/`TripStarted` sono veri per il solo passare del tempo — sono proprietà dell'aggregato Trip rispetto al calendario, non richieste da nessuno. È infrastruttura: il modello di dominio resta incoerente senza di essa, indipendentemente da cosa fa l'utente.
- **User Signals (13.3)**: `PlaceRated` esiste solo perché una persona compie un'azione esplicita. Senza quel tocco sullo schermo, il fatto non è mai vero.

Questa distinzione rispecchia i due assi già tracciati in ADR-014 (episodic/procedural vs il trigger di consolidamento tra livelli): il lifecycle del trip decide *quando* consolidare la memoria, i segnali utente decidono *cosa* consolidare. Tenerli in sprint separati rende visibile nel backlog che il Traveler DNA ha un prerequisito infrastrutturale (13.2) distinto dai segnali che lo alimenteranno (13.3).

---

## 5. Riferimenti

- [ADR-014 — Traveler DNA / Memory Engine](./014-traveler-dna-memory-engine.md)
- Event Bus audit (conversazione — Task 2, Luglio 2026)
