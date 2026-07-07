# GEMINI.md — Note per Gemini su Travel OS

> Le regole operative sono in [`AGENTS.md`](AGENTS.md) — questo file le eredita per intero e aggiunge solo ciò che è specifico di Gemini.

## Priorità di lettura

Se il tuo harness supporta un file di contesto tipo `GEMINI.md` alla radice del repo non ancora presente, tratta comunque [`/docs/agents/AGENTS.md`](AGENTS.md) come la fonte di verità operativa e [`/docs/context/PROJECT_STATE.md`](../context/PROJECT_STATE.md) come il primo documento da consultare prima di qualunque modifica non banale.

## Attenzione particolare per Gemini su questo repo

- Il codebase è scritto quasi interamente in italiano (commenti, messaggi di validazione, ADR). Mantieni la stessa lingua in nuovo codice e commenti nello stesso stile — non normalizzare silenziosamente in inglese.
- Le ADR in `docs/adr/` hanno un campo `Stato` che può essere disallineato dal codice reale (vedi [DECISIONS.md](../context/DECISIONS.md)) — verifica sempre nel codice sorgente prima di trattare un'ADR "Proposed" come non implementata.
- Prima di generare codice per una nuova regola del Rule Engine o un nuovo Domain Service, leggi [RULE_ENGINE.md](../architecture/RULE_ENGINE.md) e [TESTING_STRATEGY.md](../architecture/TESTING_STRATEGY.md) per lo stile esatto già in uso (funzioni pure, niente mock, test co-locati).

## Cosa evitare

Non introdurre dipendenze o pattern che presuppongono un backend generico dietro `backend/` — è un proxy stateless verso Google Places, non un'API applicativa estendibile a piacere (vedi [BACKEND.md](../architecture/BACKEND.md)). Qualunque nuova funzionalità server-side va valutata rispetto al suo scopo dichiarato (nascondere chiavi di provider esterni), non aggiunta per comodità.
