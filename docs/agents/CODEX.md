# CODEX.md — Note per Codex su Travel OS

> Le regole operative sono in [`AGENTS.md`](AGENTS.md) — questo file le eredita per intero e aggiunge solo ciò che è specifico di Codex.

## Priorità di lettura

Codex tipicamente opera con meno contesto conversazionale pregresso rispetto ad altri agenti: è particolarmente importante partire sempre da [`/docs/context/PROJECT_STATE.md`](../context/PROJECT_STATE.md) prima di modificare codice in aree con percorsi paralleli (pianificazione, luoghi — vedi [AGENTS.md](AGENTS.md#percorsi-paralleli--verifica-sempre-quale-stai-toccando)), per non estendere per errore il ramo morto invece di quello attivo.

## Verifica automatica

Prima di considerare concluso un cambiamento:
- `npm test` (root) — suite Jest su Domain Service puri.
- `npx tsc --noEmit` (root) e nel backend, se il cambiamento tocca `backend/` — non esiste una pipeline CI configurata nel repo da cui dedurre altri controlli automatici.

## Attenzione particolare per Codex su questo repo

- Non fidarti del nome di un file per dedurne il ruolo architetturale: `.engine.ts` minuscolo (`context.engine.ts`) e `Engine.ts` PascalCase (`PlaceMergeEngine.ts`) sono due convenzioni distinte usate in punti diversi del repo — vedi [NAMING_CONVENTIONS.md](../glossary/NAMING_CONVENTIONS.md).
- Il repo ha una storia git molto corta (un commit di import iniziale massiccio, poi pochi commit incrementali recenti) — non presumere che l'assenza di storia su un file significhi che sia recente o poco importante; molta della logica di dominio più densa (Journey Composer, Rule Engine, SIP) è arrivata nel commit di import iniziale.

## Cosa evitare

Non generare test con mock per gli Engine (`ContextEngine`/`PlacesEngine`/`TimelineEngine`) copiando pattern comuni in altri progetti Node/Jest — questo repo non ha infrastruttura di mock (nessun `jest.mock`, nessun `__mocks__/`) e la convenzione qui è testare solo i Domain Service puri, senza mock. Vedi [TESTING_STRATEGY.md](../architecture/TESTING_STRATEGY.md).
