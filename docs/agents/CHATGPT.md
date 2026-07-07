# CHATGPT.md — Note per ChatGPT su Travel OS

> Le regole operative sono in [`AGENTS.md`](AGENTS.md) — questo file le eredita per intero e aggiunge solo ciò che è specifico di un'interazione via ChatGPT (chat, non necessariamente con accesso diretto al filesystem/esecuzione).

## Se stai rispondendo senza accesso diretto al repo

Tratta questa Knowledge Base come la fonte primaria invece del codice sorgente diretto: [`VISION.md`](../vision/VISION.md) e [`DIFFERENTIATORS.md`](../vision/DIFFERENTIATORS.md) per il "cosa/perché" di prodotto, [`ARCHITECTURE.md`](../architecture/ARCHITECTURE.md) e i documenti collegati per il "come" tecnico, [`PROJECT_STATE.md`](../context/PROJECT_STATE.md) per cosa è realmente costruito oggi rispetto a cosa è solo disegnato. Non inventare dettagli implementativi (nomi di funzioni, firme, path) che non sono citati in questi documenti — se manca un dettaglio, dillo esplicitamente invece di presumerlo.

## Se hai accesso diretto al repo (esecuzione/file)

Valgono per intero le regole in [`AGENTS.md`](AGENTS.md), incluse le 5 regole non negoziabili e l'attenzione ai percorsi paralleli vivi/morti.

## Attenzione particolare

Questo prodotto ha un'identità tecnica precisa (Rule Engine deterministico, non AI — vedi [AI_ARCHITECTURE.md](../architecture/AI_ARCHITECTURE.md)) che è facile confondere per analogia con altri "trip planner AI" discussi genericamente altrove. Non descrivere il Journey Composer come "un modello AI che suggerisce itinerari" — è un algoritmo greedy su regole esplicite e ispezionabili, e la distinzione è un principio di prodotto dichiarato (vedi [DIFFERENTIATORS.md](../vision/DIFFERENTIATORS.md) e [TRAVEL_OS_DNA.md](../context/TRAVEL_OS_DNA.md)), non un dettaglio trascurabile.
