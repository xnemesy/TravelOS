# RULE_ENGINE.md

> Il motore che decide come si compone una giornata di viaggio. Vedi [DESIGN_PHILOSOPHY.md](../vision/DESIGN_PHILOSOPHY.md) per il "perché" prodotto, [DOMAIN_MODEL.md](DOMAIN_MODEL.md) per i tipi coinvolti.

## Due componenti distinti, spesso confusi

1. **`TimelineRuleEngine`** ([TimelineRuleEngine.ts](../../src/domain/services/rules/TimelineRuleEngine.ts)) — valuta un singolo luogo candidato contro un contesto temporale, restituendo un punteggio e un'eventuale rifiuto. È il "motore di regole" in senso stretto.
2. **`JourneyComposer`** ([JourneyComposer.ts](../../src/domain/services/JourneyComposer.ts)) — l'algoritmo greedy che usa il Rule Engine per costruire l'intera giornata, luogo dopo luogo. È l'orchestratore, non è esso stesso una regola.

Non esiste un motore di regole separato per la validazione "smart" (avviso "giornata troppo piena", "distanza irrealistica"): quella logica vive ancora nel percorso legacy (`PlannerEngine.validateDaySchedule`), strutturalmente distinta e non collegata al Rule Engine attivo. Vedi [ARCHITECTURE.md](ARCHITECTURE.md#due-percorsi-di-pianificazione-paralleli--solo-uno-è-vivo).

## Le sei regole, in ordine di valutazione

Pipeline fissa e pesata, definita in [`timeline-rule-weights.ts`](../../src/domain/config/timeline-rule-weights.ts). Ogni regola implementa `ITimelineRule.evaluate(candidate, context)` e ritorna `RuleResult` (`scoreDelta`, `reject?`, `delayMinutes?`, `overrideVisitDuration?`, `insertEvent?`, `explanation`). **Tutte le regole vengono sempre eseguite**, anche dopo un `reject` — non c'è short-circuit, perché ogni regola contribuisce comunque a punteggio e spiegazioni.

| # | Regola | Peso | Cosa fa |
|---|---|---|---|
| 1 | `OpeningHoursRule` | 100 | Verifica orari via SIP. Se chiuso ma apre entro 60 min → penalità lieve + attesa. Se non apre entro 60 min o provider fallisce senza risposta → **rifiuto duro** (`-1000`). Su errore provider, fallisce aperto (non blocca). |
| 2 | `EndOfDayRule` | 90 | Rifiuta candidati che inizierebbero dopo l'orario di fine preferito (default 22:00, +30 min di tolleranza). |
| 3 | `WeatherRule` | 80 | **Placeholder — no-op oggi.** Ritorna sempre punteggio neutro. Il peso esiste, il comportamento no: non presumere che il meteo influenzi già le scelte del composer. |
| 4 | `SmartMealRule` | 70 | Se il candidato è un blocco pasto → priorità alta. Altrimenti, se pranzo/cena non ancora piazzati e siamo nella finestra oraria giusta (12:30-14:00 / 18:30-21:30), penalizza il candidato e **inietta** un blocco pasto sintetico. |
| 5 | `VisitDurationRule` | 60 | Sceglie la durata di visita: override utente > catalogo editoriale > dato provider > default di categoria — punteggio più alto quanto più la fonte è affidabile. |
| 6 | `TravelTimeRule` | 50 | Calcola tempo di spostamento + overhead di arrivo per categoria, li sottrae dal punteggio. Penalizza (ma non rifiuta mai) distanze >15km/>50km. |

## Come `JourneyComposer.composeDayJourney` usa il Rule Engine

Algoritmo greedy, non un solver globale:

1. Separa i luoghi in **hard anchor** (orario fissato), **soft anchor** (pin utente `isLocked`, orario flessibile) e **flessibili**.
2. Tra i flessibili, limita le esperienze `hero_experience` a 1-2 al giorno (le eccedenti diventano `secondary`) — vedi [DESIGN_PHILOSOPHY.md](../vision/DESIGN_PHILOSOPHY.md).
3. **Ciclo greedy**: ad ogni iterazione valuta *ogni* candidato rimasto nel pool tramite `timelineRuleEngine.evaluate()`, somma un punteggio di prossimità geografica (più vicino al luogo corrente = punteggio più alto), sceglie il singolo candidato con punteggio migliore. Se nessun candidato è valido, **il ciclo si interrompe** — i luoghi rimasti nel pool vengono scartati dalla giornata, non spostati al giorno successivo (il composer opera un giorno alla volta).
4. Se la regola vincente porta un `insertEvent` (es. pranzo auto-inserito), viene aggiunto un blocco sintetico senza consumare un elemento del pool.
5. Gli hard anchor vengono accodati alla fine della sequenza composta; è `generateDaySchedule` (passo successivo) a ricalcolare la cronologia finale reale.
6. `generateDaySchedule` cammina la sequenza risultante in ordine, calcola orari (`calculatedStartTime`/`calculatedEndTime`), applica lo snap dei pasti (mai anticipa, solo posticipa se troppo presto), genera avvisi (distanza irrealistica >50km, orario dopo le 22:30), calcola densità/tema/mood del giorno.

## Perché non è un solver ottimale

È un algoritmo greedy locale, non un TSP risolto globalmente: ad ogni passo sceglie il miglior candidato *disponibile ora*, senza backtracking. Questo è un compromesso deliberato tra qualità della soluzione e prevedibilità/velocità — coerente col principio "realistico, umano" più che "matematicamente ottimo" (vedi [DESIGN_PHILOSOPHY.md](../vision/DESIGN_PHILOSOPHY.md)). `optimizeDay`/`optimizeTrip` nel percorso legacy (`PlannerEngine`) sono stub esplicitamente etichettati come predisposizione per un futuro motore AI — non implementati.

## Punteggio e qualità — dove finiscono i risultati

- **`JourneyScoreCalculator`** (Domain Service puro, estratto da `ContextEngine.recompose()`) calcola `journeyScore` (0-100) da cinque sotto-punteggi: pianificazione, bilanciamento, conflitti, pasti, camminata. Contiene un caso limite noto e documentato (NaN quando ci sono luoghi salvati ma zero giorni generati) — vedi [DECISIONS.md](../context/DECISIONS.md#adr-016).
- **`calculateJourneyQuality`**, **`calculateRuntimeHealth`**, **`calculateRuntimeStatus`**, **`generateSmartSuggestions`** (tutti in `JourneyComposer`, esposti anche tramite l'adapter deprecato `TimelineGenerator`) traducono lo stato della timeline in giudizi leggibili (stelle, etichette, suggerimenti azionabili) consumati direttamente da `ContextEngine.recompose()`.

## Estendere il Rule Engine

Aggiungere una regola richiede: un file in `src/domain/services/rules/` che implementa `ITimelineRule`, un peso in `timeline-rule-weights.ts`, e l'inserimento nella lista ordinata dentro `TimelineRuleEngine.evaluate()` (l'ordine determina quale `overrideVisitDuration`/`insertEvent` vince in caso di conflitto — l'ultima regola che lo imposta vince). Una nuova regola non deve mai chiamare altri Engine direttamente né importare stato React — riceve solo `TimelineContext`, coerente con [PRODUCT_PRINCIPLES.md](../vision/PRODUCT_PRINCIPLES.md#3-gli-engine-orchestrano-i-domain-service-calcolano).
