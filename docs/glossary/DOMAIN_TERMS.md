# DOMAIN_TERMS.md

> Definizioni estese dei concetti di dominio, con riferimento al codice reale che le implementa (o alla loro assenza).

## Journey Composer

Il "cervello" di Travel OS (commento letterale nel codice: *"IL CERVELLO ISTANZIABILE DI TRAVEL OS"*), `JourneyComposerService` ([JourneyComposer.ts](../../src/domain/services/JourneyComposer.ts)). Prende luoghi disponibili e produce una `TimelineDaySchedule` con orari, distanze, avvisi, tema e mood — mai inventando luoghi, solo orchestrando quelli forniti. Usa il Rule Engine come motore di valutazione per ogni candidato durante la composizione greedy. Vedi [RULE_ENGINE.md](../architecture/RULE_ENGINE.md).

## Rule Engine

`TimelineRuleEngine` ([TimelineRuleEngine.ts](../../src/domain/services/rules/TimelineRuleEngine.ts)) — pipeline fissa e pesata di 6 regole indipendenti (`ITimelineRule`) che valutano un singolo luogo candidato contro un contesto temporale. Non è un solver globale, è un valutatore di candidati usato dal Journey Composer dentro un ciclo greedy. Dettaglio completo in [RULE_ENGINE.md](../architecture/RULE_ENGINE.md).

## Context Engine

`ContextEngine` ([context.engine.ts](../../src/core/engines/context/context.engine.ts)) — compositore reattivo sincrono. Ricompone `TravelContext` in memoria ad ogni Domain Fact ricevuto (wildcard subscribe), interrogando gli State Publisher registrati da ciascun motore. Non persiste nulla di suo — è puro stato derivato, ricalcolato ad ogni evento.

## Domain Fact

Un evento passato, realmente accaduto, pubblicato sull'`eventBus` con un tipo in tempo passato (`PlaceSaved`, `TimelinePlaceAdded`...). Regola non negoziabile: **mai** un evento UI o un trigger tecnico travestito da fatto. Se un modulo pubblica e consuma lo stesso evento solo per forzare un ricalcolo interno, quella non è la funzione dell'Event Bus — è una chiamata diretta (`contextEngine.recompose()`). Vedi [EVENT_BUS.md](../architecture/EVENT_BUS.md).

## TravelContext

Il read-model unico e completo che la UI consuma tramite `useTravelContext`. Include punteggi (`journeyScore`), timeline del giorno, luoghi salvati/visitati, meteo, e slice segnaposto (`budgetStatus`, `nextBooking`) per motori Fase 2/3 non ancora costruiti — sempre `null` oggi, non un bug. Non è mai persistito: esiste solo come oggetto in memoria, ricostruito ad ogni `recompose()`.

## PlaceRef

L'interfaccia plain-TS (non Zod) che rappresenta un luogo nel percorso di pianificazione **attivo** (`TimelineEngine`/`JourneyComposer`/Rule Engine). Porta campi orientati alla pianificazione: `scheduledTime`, `calculatedStartTime`/`calculatedEndTime`, `isLocked`, `role`, `anchorType`, `decision`. Da non confondere con `TravelPlace` (vedi sotto) né con `JourneyPlace` (proiezione ancora più snella usata solo per routing).

## TravelPlace

Il modello Zod a 3 livelli (`External`/`Editorial`/`Personal`) usato per la validazione e la persistenza del "posto" come concetto ricco. È la valuta del percorso di pianificazione **legacy/morto** (`PlannerEngine`/`usePlannerStore`), non del percorso attivo. Vedi [DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md).

## SIP (Service Integration Platform)

Nome informale (non letterale nel codice, ma consolidato in questa documentazione per chiarezza) del livello di adapter astratti verso provider esterni — facade `TravelServices` ([TravelServices.ts](../../src/domain/providers/TravelServices.ts)). Equivalente concettuale al "Provider Layer" descritto in ADR-001, implementato in anticipo rispetto alla timeline dichiarata in quell'ADR. Copertura reale disuguale tra i domini (Places ha un percorso reale, Weather/Routing/OpeningHours/Currency/Translation sono mock oggi) — vedi [DATA_FLOW.md](../architecture/DATA_FLOW.md).

## Traveler DNA

Profilo comportamentale **osservato** (non dichiarato), **cross-trip** e **user-level**, disegnato in ADR-014 e non ancora implementato. Tre livelli: Episodic (log grezzo), Semantic/TasteProfile (affinità per categoria), Procedural (abitudini di viaggio). Prodotto esclusivamente numerico — nessuna frase persistita, mai `IAEngine`-generated testo dentro il motore stesso. Vedi [AI_ARCHITECTURE.md](../architecture/AI_ARCHITECTURE.md) e [TRAVEL_OS_DNA.md](../context/TRAVEL_OS_DNA.md).

## PlaceMemories vs. Traveler DNA

`PlaceMemories` (livello Personal di `TravelPlace`: diario, rating personale, foto) è memoria **dichiarata** dall'utente, scoped a un singolo luogo in un singolo viaggio. Il Traveler DNA è memoria **osservata** dal comportamento, sopravvive al singolo viaggio. I due livelli si alimentano a vicenda (un rating a 5 stelle nel diario è anche un segnale per il DNA) ma **non vanno mai uniti in un unico modello** — distinzione esplicita in ADR-014, non negoziabile.

## AI Concierge

Componente futuro, puramente aspirazionale oggi (zero codice, zero interfaccia con un'implementazione). Consumer previsto del Traveler DNA, non un sostituto di esso. Vedi [AI_ARCHITECTURE.md](../architecture/AI_ARCHITECTURE.md) per perché l'ordine (DNA prima, Concierge dopo) è strutturale, non arbitrario.

## Anchor (HARD/SOFT)

Vincolo di posizionamento su un `PlaceRef` durante la composizione: `anchorType: 'HARD'` significa orario fissato (`scheduledTime` esplicito, es. una prenotazione) — il composer non lo sposta mai nel tempo. `anchorType: 'SOFT'` significa che l'utente ha "pinnato" il luogo (`isLocked`, via drag&drop) senza un orario fisso — il composer rispetta la sua presenza ma può ancora decidere quando collocarlo.

## Engine vs. Domain Service

Un **Engine** ha stato, persistenza, side-effect, e conosce l'Event Bus (`ContextEngine`, `PlacesEngine`, `TimelineEngine`). Un **Domain Service** è una funzione o classe stateless, calcola senza I/O, non conosce Store/EventBus/ContextEngine (`DistanceCalculator`, `JourneyScoreCalculator`, le regole del Rule Engine). La distinzione è architetturale, non stilistica — vedi [PRODUCT_PRINCIPLES.md](../vision/PRODUCT_PRINCIPLES.md#3-gli-engine-orchestrano-i-domain-service-calcolano).

## SmartMealRule / SmartSlotFilling / Smart Validation

Prefisso "Smart" usato nel codice per indicare euristiche automatiche (non AI): `SmartMealRule` (auto-inserimento pasti), Smart Slot Filling (assegnazione automatica di un luogo a uno slot orario libero, terminologia in `engines.types.ts`), Smart Validation (avvisi generati da `PlannerEngine.validateDaySchedule` nel percorso legacy). "Smart" in questo codebase significa sempre "euristica deterministica", mai "basato su modello AI".
