# CURRENT_ROADMAP.md

> Lavoro pianificato secondo le ADR esistenti, con stato di avanzamento verificato — non un piano inventato. Vedi [DECISIONS.md](DECISIONS.md) per il dettaglio di ciascuna ADR.

## In corso / prossimo — ADR-015, Domain Lifecycle

**Sprint 13.1 (pulizia Event Bus)** — ✅ Fatto (commit `9e06fac`).

**Sprint 13.2 — Domain Lifecycle** (non iniziato): un watcher fire-once che confronti lo stato derivato del Trip (`TripCalculator.getTripStatus`, oggi puramente calcolato ad ogni render) con l'ultimo stato persistito noto, e pubblichi `TripStarted`/`TripCompleted` solo alla prima transizione osservata. Decisione di design ancora aperta: se l'app non viene aperta durante l'intero arco del viaggio, il watcher deve emettere entrambi i fatti in sequenza o saltare direttamente a `completed`? Questo sprint è un **prerequisito reale** per il consolidamento del Traveler DNA (ADR-014) — senza un momento discreto "il viaggio è finito", il DNA non ha mai un punto in cui applicare il decay temporale.

**Sprint 13.3 — User Signals** (non iniziato): azione di scrittura + UI minima per il rating personale (`personalRating`, oggi solo schema Zod senza write path) → evento `PlaceRated`. Estensioni naturali della stessa categoria: preferiti, feedback espliciti.

## Traveler DNA — ADR-014, fasato

Non iniziato. Rollout proposto, in ordine:
- **Fase 0 — Sola cattura**: `SignalExtractor` + log episodico append-only. Nessun profilo esposto, nessuna UI. È la parte con senso di avviare per prima indipendentemente dal resto, perché la storia comportamentale di un viaggiatore non è ricostruibile retroattivamente.
- **Fase 1 — TasteProfile** derivato + slice `travelerDNA` in `TravelContext`.
- **Fase 2 — ProceduralProfile** + evento `TravelerInsightDetected`.
- **Fase 3 — Consumo**: `JourneyComposer` legge il DNA come segnale opzionale; un `TasteProfileNarrator` + AI Concierge lo verbalizzano.

**Prerequisito bloccante non ancora risolto**: `UserContext` (risoluzione reale `tripId → userId`) — vedi [KNOWN_DEBT.md](KNOWN_DEBT.md#resolver-userid-hardcoded).

## Motori Fase 2/3 — solo interfacce oggi

`IJourneyEngine`, `IBudgetEngine`, `IDocumentsEngine`, `ISyncEngine`, `INotificationEngine` esistono come contratti dichiarati in `engines.types.ts` ma senza alcuna roadmap dettagliata in un'ADR dedicata (a differenza di Memory/Traveler DNA, che ha ADR-014). Prima di implementarne uno, va scritta un'ADR che ne descriva scope e vincoli, seguendo lo stile di ADR-014 — non partire direttamente dall'interfaccia esistente assumendo che sia già una specifica sufficiente.

## Provider Layer — completare la copertura reale

Weather/Routing/OpeningHours/Currency/Translation hanno oggi solo adapter mock (`registerRealAdapters()` mai chiamato). Non è un lavoro coperto da un'ADR dedicata — collegare un provider reale per uno di questi domini è un'estensione naturale del SIP esistente (vedi [DATA_FLOW.md](../architecture/DATA_FLOW.md)), ma richiede comunque una decisione su quale provider concreto usare (nessuno è stato scelto nel codice, solo elencato in commenti come "Google Places, Apple Maps, OpenMeteo, Mapbox...").

## Debito noto che non è nella roadmap di nessuna ADR

I due percorsi di pianificazione paralleli, i due `PlaceRepository`, il codice morto in `trip-experience/`, e l'auth disconnessa non sono oggetto di alcuna ADR — restano debito silenzioso. Vedi [KNOWN_DEBT.md](KNOWN_DEBT.md). Chi decide di affrontarli dovrebbe considerare di aprire un'ADR prima, non limitarsi a una PR di pulizia silenziosa, dato il pattern di prodotto osservato (vedi [PRODUCT_PRINCIPLES.md](../vision/PRODUCT_PRINCIPLES.md#2-i-bug-si-documentano-non-si-nascondono)).
