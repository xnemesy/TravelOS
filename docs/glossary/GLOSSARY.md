# GLOSSARY.md

> Indice rapido dei termini di Travel OS. Definizioni estese in [DOMAIN_TERMS.md](DOMAIN_TERMS.md); convenzioni di codice in [NAMING_CONVENTIONS.md](NAMING_CONVENTIONS.md).

| Termine | In una frase | Approfondimento |
|---|---|---|
| **Journey Composer** | Il motore che compone una giornata realistica a partire da luoghi disponibili | [DOMAIN_TERMS.md](DOMAIN_TERMS.md#journey-composer) |
| **Rule Engine** (`TimelineRuleEngine`) | Pipeline di 6 regole pesate che valutano ogni candidato durante la composizione | [RULE_ENGINE.md](../architecture/RULE_ENGINE.md) |
| **Context Engine** | Compositore reattivo che ricompone `TravelContext` ad ogni fatto di dominio | [EVENT_BUS.md](../architecture/EVENT_BUS.md) |
| **Domain Fact** | Evento passato realmente accaduto, l'unico tipo ammesso sull'Event Bus | [DOMAIN_TERMS.md](DOMAIN_TERMS.md#domain-fact) |
| **TravelContext** | Il read-model unico che la UI consuma, mai persistito | [DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md#travelcontext--il-read-model-composto) |
| **PlaceRef** | Rappresentazione di un luogo usata dal percorso di pianificazione attivo | [DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md#placeref--la-rappresentazione-realmente-in-uso-dal-motore-attivo) |
| **TravelPlace** | Rappresentazione Zod a 3 livelli (External/Editorial/Personal) di un luogo | [DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md#place--tre-livelli-mai-fusi) |
| **SIP (Service Integration Platform)** | Facade (`TravelServices`) che disaccoppia i motori dai provider esterni concreti | [DATA_FLOW.md](../architecture/DATA_FLOW.md#sip--service-integration-platform-travelservices) |
| **Traveler DNA** | Profilo comportamentale osservato, cross-trip, derivato da eventi (ADR-014, non implementato) | [AI_ARCHITECTURE.md](../architecture/AI_ARCHITECTURE.md) |
| **PlaceMemories** | Memoria dichiarata dall'utente (diario, rating), scoped a un luogo in un trip | [DOMAIN_TERMS.md](DOMAIN_TERMS.md#placememories-vs-traveler-dna) |
| **AI Concierge** | Futuro consumer del Traveler DNA — non esiste ancora nessuna implementazione AI | [AI_ARCHITECTURE.md](../architecture/AI_ARCHITECTURE.md) |
| **View Layer Hooks** | `useTravelContext`/`usePlaces`/`useTimeline`/`useNextPlace`/`useTravelActions` — unica porta UI↔dominio | [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) |
| **State Publisher** | Funzione che un Engine registra sul Context Engine per esporre il proprio stato (pull, non push) | [EVENT_BUS.md](../architecture/EVENT_BUS.md#il-pattern-state-publisher--non-è-levent-bus) |
| **Anchor (HARD/SOFT)** | Vincolo di posizionamento: HARD = orario fissato, SOFT = pin utente flessibile | [DOMAIN_TERMS.md](DOMAIN_TERMS.md#anchor-hardsoft) |
| **Journey Score** | Punteggio 0-100 di qualità del piano, calcolato da `JourneyScoreCalculator` | [RULE_ENGINE.md](../architecture/RULE_ENGINE.md#punteggio-e-qualità--dove-finiscono-i-risultati) |
| **Journey Decision** | Motivazione tracciabile (`reason`+`confidence`) di ogni posizionamento del composer | [DIFFERENTIATORS.md](../vision/DIFFERENTIATORS.md) |

Per lo stato di implementazione di ciascun concetto (reale / stub / morto), vedi sempre [PROJECT_STATE.md](../context/PROJECT_STATE.md) — un termine in questo glossario non implica che esista codice funzionante dietro.
