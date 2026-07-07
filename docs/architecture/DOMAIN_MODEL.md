# DOMAIN_MODEL.md

> Il modello dati di Travel OS non è un singolo schema: sono più rappresentazioni parallele, ciascuna ottimizzata per un confine architetturale diverso. Questo documento le mappa tutte e spiega perché coesistono, così che un agente AI non ne "unifichi" per errore due che devono restare separate.

## Trip

`Trip` ([trip.model.ts](../../src/domain/trip/models/trip.model.ts), schema Zod) — l'aggregato radice di un viaggio: `id`, `userId`, `title`, `destination`, `currency`, `startDate`/`endDate`, `status`, `progress`, `stats` (contatori: luoghi salvati, prenotazioni, foto...), `weather`.

`status` è un enum (`planned|ready|ongoing|completed|cancelled|archived`) ma **oggi solo `archived` è raggiungibile tramite un'azione utente esplicita** (`archiveTrip`). Gli altri stati sono derivati a runtime da `TripCalculator.getTripStatus` confrontando `now` con le date — non sono mai persistiti come transizione. Questo è rilevante: non esiste ancora un momento discreto "il viaggio è iniziato/finito" osservabile dal resto del sistema (prerequisito mancante per il Traveler DNA, vedi ADR-015 §2.6 e [CURRENT_ROADMAP.md](../context/CURRENT_ROADMAP.md)).

`TripEvent` — voci di calendario associate a un trip (`flight|accommodation|activity|transport`), usate solo da `event/[eventId].tsx` e dal calcolo `TripCalculator.getNextEvent`.

## Place — tre livelli, mai fusi

`TravelPlace` ([place.model.ts](../../src/domain/trip/models/place.model.ts), schema Zod) unifica esplicitamente tre livelli distinti, documentati nel codice stesso:

1. **External** (`ExternalPlaceSchema`) — dati grezzi da provider: nome, categoria, coordinate, orari (stringa libera), rating, foto. Read-only, sostituibile ad ogni sync.
2. **Editorial** (`EditorialPlaceSchema`) — contenuto curato da Travel OS, indipendente dal provider: perché visitarlo, durata consigliata, consigli su golden hour, curiosità, errori da evitare.
3. **Personal / Memories** (`PlaceMemoriesSchema`) — il diario del viaggiatore: rating personale, tempo/spesa effettivi, foto collegate, stato check-in.

Il `PlaceMergeEngine` ([PlaceMergeEngine.ts](../../src/domain/trip/engine/PlaceMergeEngine.ts)) è la garanzia strutturale che questi livelli non si mescolino mai: quando arriva un dato provider aggiornato, viene fuso **solo** il livello External — Editorial e Personal sono sempre preservati intatti dallo spread dell'oggetto esistente. Nessun'altra parte del codice deve scrivere su Editorial/Personal a partire da dati provider.

## PlaceRef — la rappresentazione realmente in uso dal motore attivo

`PlaceRef` ([context.types.ts](../../src/core/engines/types/context.types.ts)) è un'interfaccia plain-TS, **strutturalmente diversa** da `TravelPlace`: niente Zod, niente distinzione a tre livelli esplicita, ma campi orientati alla pianificazione — `scheduledTime`, `calculatedStartTime`/`calculatedEndTime`, `isLocked` (pin utente), `isBlock` (blocco sintetico, es. pasto), `role`, `anchorType`, `decision` (la `JourneyDecision` che spiega perché è stato posizionato lì), `warnings` (generati dai provider SIP).

`PlaceRef` è la valuta del percorso di pianificazione attivo (`TimelineEngine` → `JourneyComposer` → Rule Engine). `TravelPlace` è la valuta del percorso legacy/morto (`PlannerEngine`). **Non convertire automaticamente tra i due senza verificare quale percorso si sta effettivamente toccando** — vedi [KNOWN_DEBT.md](../context/KNOWN_DEBT.md) per il dettaglio dei due sistemi paralleli.

Una terza forma, `JourneyPlace` ([JourneyPlace.ts](../../src/core/engines/models/JourneyPlace.ts)), è una proiezione ancora più snella di `Place` (il modello "universale" in `src/core/domain/models/Place.ts`) usata solo per algoritmi di routing/ottimizzazione — mappata da `PlaceToJourneyPlace.ts`. Non è la stessa cosa di `PlaceRef`: sono due riduzioni indipendenti dello stesso concetto, con confini di scopo diversi (routing puro vs. stato di timeline completo).

## TravelContext — il read-model composto

`TravelContext` ([context.types.ts](../../src/core/engines/types/context.types.ts)) è l'unico oggetto che la UI legge (tramite `useTravelContext`). Non è persistito: è ricomposto in memoria ad ogni fatto di dominio da `ContextEngine.recompose()`. Contiene: metadati trip, `journeyScore`/`journeyStatusLabel`/`journeyQuality`, `timeline` (i `TimelineDaySchedule` per giorno), `savedPlaces`/`visitedPlaces`, `weather`, `budgetStatus` (sempre `null` oggi — nessun `BudgetEngine` esiste), `nextBooking` (sempre `null` — nessun `DocumentsEngine`), `alerts`/`suggestedActions` (dichiarati ma mai popolati). Vedi [EVENT_BUS.md](EVENT_BUS.md) per il meccanismo di composizione.

## Rule Engine — tipi di supporto

`TimelineContext`, `RuleResult`, `PlanningReport` ([rules.types.ts](../../src/domain/services/rules/rules.types.ts)) — i tipi con cui il Rule Engine valuta ogni candidato durante la composizione di una giornata. Dettagliati in [RULE_ENGINE.md](RULE_ENGINE.md).

## Perché non esiste un modello unico

Ogni rappresentazione è ottimizzata per il confine che serve: `TravelPlace` per la persistenza/validazione utente (Zod), `PlaceRef` per la pianificazione stateful, `JourneyPlace` per gli algoritmi puri di routing, `Place` (backend) per il contratto HTTP col provider Google Places. Unificarle in un solo modello accoppierebbe strettamente livelli che oggi possono evolvere indipendentemente — è un trade-off deliberato, non un difetto da correggere con un refactoring generico. Un tentativo di unificazione va valutato con un ADR dedicato, non introdotto incidentalmente in una feature.
