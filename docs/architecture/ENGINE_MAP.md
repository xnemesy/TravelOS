# ENGINE_MAP.md

> Punto di ingresso rapido: un colpo d'occhio su ogni motore/componente di dominio, il suo stato reale, la copertura di test, l'ADR di riferimento e chi possiede la decisione. Per il dettaglio narrativo vedi [ARCHITECTURE.md](ARCHITECTURE.md); per lo stato prodotto per-feature vedi [PROJECT_STATE.md](../context/PROJECT_STATE.md).

## Legenda stato

🟢 Implementato e attivo · 🟡 Implementato parziale/mock · 🔴 Solo interfaccia, zero implementazione · ⚫ Codice morto (esiste, non raggiunto da nulla)

## Nucleo reattivo (Fase 1)

| Engine / Componente | Stato | Test | ADR | Owner |
|---|---|---|---|---|
| `ContextEngine` | 🟢 | Nessuno diretto | ADR-001 | Rocco |
| `PlacesEngine` | 🟢 | Nessuno diretto | ADR-001, ADR-015 | Rocco |
| `TimelineEngine` | 🟢 | Nessuno diretto | ADR-001, ADR-015 | Rocco |
| `DomainEventBus` | 🟢 | Nessuno diretto | ADR-015 | Rocco |

## Domain Service (calcolo puro)

| Componente | Stato | Test | ADR | Owner |
|---|---|---|---|---|
| `JourneyComposer` | 🟢 | `JourneyComposer.test.ts` (solo `calculateExperienceDensity` — il resto è orchestrazione non testata by design, vedi [TESTING_STRATEGY.md](TESTING_STRATEGY.md)) | — | Rocco |
| `TimelineRuleEngine` (Rule Engine, 6 regole) | 🟢 | Nessuno diretto | — | Rocco |
| `JourneyScoreCalculator` | 🟢 | `JourneyScoreCalculator.test.ts` | ADR-016 (bug NaN documentato, non corretto) | Rocco |
| `DistanceCalculator` | 🟢 | `DistanceCalculator.test.ts` | — | Rocco |
| `PlaceMergeEngine` | 🟢 | `PlaceMergeEngine.test.ts` | — | Rocco |

## Percorso legacy — non estendere (vedi [KNOWN_DEBT.md](../context/KNOWN_DEBT.md))

| Componente | Stato | Test | ADR | Owner |
|---|---|---|---|---|
| `PlannerEngine` | ⚫ | Nessuno | — | Rocco — non toccare senza decisione esplicita |

## Fase 2/3 — solo contratti, zero implementazione

| Componente | Stato | Test | ADR | Owner |
|---|---|---|---|---|
| `MemoryEngine` / `ITravelerDnaEngine` (Traveler DNA) | 🔴 design-only | — | ADR-014 | Rocco (design) |
| `IJourneyEngine` | 🔴 | — | — | Non assegnato |
| `IBudgetEngine` | 🔴 | — | — | Non assegnato |
| `IMemoriesEngine` (da rinominare `IRecapEngine` per ADR-014 §naming — rename non ancora fatto) | 🔴 | — | ADR-014 | Non assegnato |
| `IDocumentsEngine` | 🔴 | — | — | Non assegnato |
| `ISyncEngine` | 🔴 | — | — | Non assegnato |
| `INotificationEngine` | 🔴 | — | — | Non assegnato |
| `IAIEngine` | 🔴 | — | — | Non assegnato |

## Regola per aggiornare questa tabella

Ogni volta che un componente cambia stato (uno stub diventa implementazione, un test viene aggiunto, un'ADR viene chiusa), aggiorna la riga corrispondente qui **nella stessa sessione** — è il documento con il ciclo di vita più breve insieme a [PROJECT_STATE.md](../context/PROJECT_STATE.md) e [SESSION_HANDOFF.md](../context/SESSION_HANDOFF.md).
