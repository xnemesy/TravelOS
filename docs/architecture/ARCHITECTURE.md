# ARCHITECTURE.md

> Mappa strutturale di Travel OS. Per il modello dati vedi [DOMAIN_MODEL.md](DOMAIN_MODEL.md); per il meccanismo reattivo vedi [EVENT_BUS.md](EVENT_BUS.md) e, in forma di diagramma passo-passo, [ENGINE_LIFECYCLE.md](ENGINE_LIFECYCLE.md); per il motore di composizione vedi [RULE_ENGINE.md](RULE_ENGINE.md). Per un colpo d'occhio sullo stato di ogni motore vedi [ENGINE_MAP.md](ENGINE_MAP.md); per capire dove va un nuovo pezzo di codice vedi [DECISION_TREE.md](DECISION_TREE.md).

## Vista d'insieme

Travel OS è composto da due codebase indipendenti nello stesso repository:

1. **App mobile** (Expo Router / React Native, root del repo) — dove vive tutto il dominio, i motori reattivi, e la UI.
2. **Backend** (`backend/`, Fastify/TypeScript, deploy separato su Google Cloud Run) — un proxy stateless verso Google Places, non un backend applicativo generico. Vedi [BACKEND.md](BACKEND.md).

Le due comunicano tramite HTTP; l'app mobile può funzionare offline anche senza il backend (fallback a dati mock, vedi [DATA_FLOW.md](DATA_FLOW.md)).

## Livelli dell'app mobile

```
app/                    Routing (Expo Router, file-based)
  │  legge/scrive SOLO tramite:
  ▼
src/shared/hooks/       View Layer Hooks — l'unica porta tra UI e dominio
  │  useTravelContext, usePlaces, useTimeline, useNextPlace, useTravelActions
  ▼
src/core/engines/       Context Engine, Places Engine, Timeline Engine
  │  orchestrano stato, persistenza, pubblicano fatti sull'Event Bus
  ▼
src/domain/services/    Domain Service — funzioni pure (calcolo, non I/O)
  │  JourneyComposer, DistanceCalculator, JourneyScoreCalculator, Rule Engine
  ▼
src/domain/providers/   SIP (Service Integration Platform) — TravelServices
  │  adapter astratti verso provider esterni, con cache e fallback mock
  ▼
src/core/storage/       MMKV (fallback AsyncStorage) — persistenza locale
```

Regola strutturale (dichiarata nei commenti sorgente): **"Gli Engine orchestrano. I Domain Service calcolano."** Un Engine ha stato, side-effect, e conosce l'Event Bus; un Domain Service è stateless, deterministico dove possibile, e non conosce Store/EventBus/ContextEngine — riceve uno snapshot esplicito, mai l'intero `TravelContext`.

## Il nucleo reattivo (Fase 1, oggi)

Tre motori singleton, istanziati una sola volta in [`src/core/engines/index.ts`](../../src/core/engines/index.ts):

- **`ContextEngine`** — compositore reattivo. Ricompone `TravelContext` in memoria e in modo sincrono ad ogni fatto di dominio, interrogando i publisher registrati da ciascun motore.
- **`PlacesEngine`** — proprietario dei luoghi salvati/visitati per trip (persistenza MMKV, dedup via `PlaceMergeEngine`).
- **`TimelineEngine`** — proprietario della timeline giorno-per-giorno per trip (persistenza MMKV), delega ogni calcolo a `JourneyComposer`/Domain Service.

Il meccanismo di composizione è descritto in dettaglio in [EVENT_BUS.md](EVENT_BUS.md). In sintesi: i motori pubblicano **Domain Fact** (fatti passati, es. `PlaceSaved`) su un `DomainEventBus` singleton; il `ContextEngine` si iscrive a wildcard (`'*'`) e ricompone ad ogni fatto con `tripId`; i motori registrano anche una funzione "state publisher" che il `ContextEngine` interroga (pull, non push) per assemblare la slice di stato di ciascun motore in `TravelContext`.

## Motori pianificati, non ancora costruiti (Fase 2/3)

`IJourneyEngine`, `IBudgetEngine`, `IMemoriesEngine`, `IDocumentsEngine`, `ISyncEngine`, `INotificationEngine`, `IAIEngine` esistono **solo come interfacce** in [`engines.types.ts`](../../src/core/engines/types/engines.types.ts) — zero classi implementano, zero istanze nel registro. Non aggiungerli al registro finché non esiste un'implementazione reale: un'interfaccia senza motore non deve mai generare uno slice fittizio in `TravelContext`. Vedi [PROJECT_STATE.md](../context/PROJECT_STATE.md) e [CURRENT_ROADMAP.md](../context/CURRENT_ROADMAP.md).

## Due percorsi di pianificazione paralleli — solo uno è vivo

Esistono oggi **due sistemi di pianificazione indipendenti** nel codice, e la documentazione deve trattarli in modo asimmetrico:

- **Percorso attivo** (`PlaceRef`, interfacce plain-TS): `TimelineEngine` → `JourneyComposer`/`TimelineRuleEngine` → `ContextEngine`. È il percorso raggiungibile da ogni schermata reale (`itinerary.tsx`, `index.tsx`). Descritto in [RULE_ENGINE.md](RULE_ENGINE.md).
- **Percorso legacy** (`TravelPlace`, modello Zod): `usePlannerStore` → `PlannerEngine`. Implementato e testato in isolamento, ma **non raggiungibile da nessuna schermata utente** — `usePlaceStore`/`InMemoryPlaceRepository` che lo alimenta è codice morto. Non estendere questo percorso: ogni nuova feature di pianificazione va nel percorso attivo. Vedi [KNOWN_DEBT.md](../context/KNOWN_DEBT.md).

## Cartelle — cosa significano

| Cartella | Contenuto | Regola |
|---|---|---|
| `src/core/` | Infrastruttura trasversale: motori reattivi, storage, eventi, Firebase, navigazione | Nessuna logica di business specifica di un dominio |
| `src/domain/` | Logica di business reale: modelli Zod, Domain Service, Rule Engine, provider (SIP), repository | Zero dipendenze da React/UI |
| `src/features/` | Slice UI verticali (store Zustand, componenti, cataloghi) | Consuma il dominio solo tramite `src/shared/hooks/` |
| `src/shared/` | Primitive davvero trasversali: componenti generici, hook del View Layer | Nessuna logica di dominio, solo bridging/presentazione |
| `src/services/` | Wrapper di integrazioni esterne per capacità (auth, camera, pdf...) | La maggior parte è ancora scaffolding vuoto — vedi [PROJECT_STATE.md](../context/PROJECT_STATE.md) |

Nota: esiste anche un `src/core/domain/` — un albero di value object (`Coordinates`, `Money`, `Distance`...) più vecchio e in gran parte superato dal `src/domain/` corrente. Non è la fonte di verità per nuovo codice: vedi [KNOWN_DEBT.md](../context/KNOWN_DEBT.md).

## Convenzioni di naming

Vedi [NAMING_CONVENTIONS.md](../glossary/NAMING_CONVENTIONS.md) per il dettaglio (prefisso `I` per contratti comportamentali, suffisso `Engine`, suffisso `.store.ts`, taxonomy degli eventi in tempo passato).
