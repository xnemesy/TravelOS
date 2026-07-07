# ENGINE_LIFECYCLE.md

> Il ciclo di vita di un singolo fatto di dominio, dal gesto dell'utente al pixel aggiornato in UI. È il cuore reattivo di Travel OS — se capisci questo diagramma, capisci come funziona l'intera app. Per il meccanismo dell'Event Bus in dettaglio vedi [EVENT_BUS.md](EVENT_BUS.md); per i percorsi dati end-to-end concreti (ricerca luoghi, salvataggio) vedi [DATA_FLOW.md](DATA_FLOW.md).

## Il ciclo

```
1. Azione utente
   (es. "salva questo luogo", "segna come visitato", "riordina la giornata")
        │
        ▼
2. Hook di scrittura — useTravelActions()
   Unico punto UI da cui parte un comando verso il dominio.
        │
        ▼
3. Engine proprietario del dato — PlacesEngine / TimelineEngine
   • esegue eventuale logica di dominio (es. dedup via PlaceMergeEngine)
   • persiste su MMKV (src/core/storage/)
   • pubblica un Domain Fact sull'eventBus (es. PlaceSaved, TimelinePlaceAdded)
        │
        ▼
4. DomainEventBus.publish(event)
   Notifica sincrona: prima gli handler sul type esatto, poi i wildcard '*'.
        │
        ├──────────────────────────────┐
        ▼                               ▼
5a. ContextEngine (wildcard '*')    5b. trip.store.ts (wildcard '*')
    → recompose(tripId)                 → ricalcola progress/stats del trip
        │
        ▼
6. ContextEngine.recompose(tripId)
   • interroga ogni State Publisher registrato (PlacesEngine, TimelineEngine...)
     → pull, non push: ognuno espone `publishStateSlice(tripId)`
   • shallow-merge delle slice in un TravelContext base
   • chiama i Domain Service puri:
     - JourneyScoreCalculator.calculate() → journeyScore
     - JourneyComposer (via TimelineGenerator) → journeyStatus, dailyHealth,
       journeyQuality, currentSuggestion
   • avvia (non bloccante) un arricchimento meteo via SIP se necessario
        │
        ▼
7. TravelContext (nuovo, ricomposto in memoria — mai persistito)
        │
        ▼
8. ContextEngine notifica sincronamente i listener registrati per quel tripId
        │
        ▼
9. Hook di lettura — useTravelContext(tripId) e derivati
   (usePlaces, useTimeline, useNextPlace, useBudget, useWeather)
        │
        ▼
10. UI si ri-renderizza con lo stato aggiornato
```

## Cosa rende questo ciclo "istantaneo"

I passi 3→8 sono interamente sincroni **tranne** la persistenza su MMKV (passo 3, non bloccante per la notifica) e l'eventuale arricchimento meteo (passo 6, esplicitamente asincrono e non bloccante). Questo è il principio ADR-001: composizione reattiva sincrona in memoria, persistenza asincrona disaccoppiata dal percorso critico della UI — mai uno spinner per un check-in o un riordino drag&drop. Vedi [PRODUCT_PRINCIPLES.md](../vision/PRODUCT_PRINCIPLES.md#6-composizione-reattiva-sincrona-persistenza-asincrona-disaccoppiata).

## Cosa NON succede in questo ciclo, e perché

- **Nessun evento viene pubblicato solo per forzare un ricalcolo interno.** Se un Engine ha bisogno che il `ContextEngine` ricomponga dopo aver aggiornato la propria cache ma non c'è un vero fatto nuovo da annunciare a consumer esterni, chiama `contextEngine.recompose()` direttamente — non il bus. Questo è il fix di ADR-015/Sprint 13.1: tre publish fittizi di `TimelineReordered` sono stati sostituiti esattamente con questa chiamata diretta.
- **Nessun motore legge lo storage di un altro motore.** `PlacesEngine` non legge mai `timeline_${tripId}`, e viceversa — l'unico canale di comunicazione cross-engine è il Domain Fact sull'Event Bus (per notifiche) o lo State Publisher (per lettura pull dal `ContextEngine`).
- **Il Traveler DNA (quando esisterà) si inserirà qui senza modificare questo ciclo.** Un futuro `MemoryEngine` si iscriverà a una whitelist di eventi al passo 4/5, esattamente come `ContextEngine`/`trip.store.ts` fanno oggi — zero refactoring del ciclo esistente richiesto. Questo è precisamente il motivo per cui ADR-015 ha investito nella purezza dell'Event Bus prima di costruire ADR-014. Vedi [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md).

## Esempio concreto: check-in di un luogo

```
useTravelActions().markAsVisited(tripId, placeId)
  → PlacesEngine.markVisited()
      → MMKV: aggiorna places_${tripId}
      → eventBus.publish('PlaceVisited', {placeId, isVisited: true, visitedAt})
  → TimelineEngine (sottoscritto a PlaceVisited)
      → aggiorna la propria cache interna (timelineMap)
      → contextEngine.recompose(tripId)  ← chiamata diretta, non un secondo evento
  → ContextEngine (sottoscritto a '*', ha già ricevuto anche il PlaceVisited originale)
      → recompose(tripId) — la chiamata di TimelineEngine garantisce che questa
        ricomposizione veda già la cache aggiornata di TimelineEngine, altrimenti
        ci sarebbe una race (vedi la spiegazione dettagliata in EVENT_BUS.md)
  → useNextPlace(tripId) si aggiorna: il prossimo luogo in timeline cambia
```
