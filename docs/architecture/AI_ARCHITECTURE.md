# AI_ARCHITECTURE.md

> Cosa esiste, cosa è disegnato ma non costruito, e perché l'ordine tra le due cose non è negoziabile. Vedi [TRAVEL_OS_DNA.md](../context/TRAVEL_OS_DNA.md) per la filosofia, [CURRENT_ROADMAP.md](../context/CURRENT_ROADMAP.md) per lo stato di avanzamento.

## Stato reale oggi: nessuna AI implementata

Verificato per l'intero albero `src/`: **nessuna integrazione LLM esiste** — zero chiamate a OpenAI/Anthropic/Claude/GPT o qualunque provider AI, zero SDK installati per questo scopo. Le uniche tracce sono:

- `IAIEngine` ([engines.types.ts](../../src/core/engines/types/engines.types.ts)) — un'interfaccia di una riga (`analyzeContextAndSuggest(context): Promise<unknown[]>`), zero classi che la implementano, zero riferimenti fuori dalla propria dichiarazione.
- Un commento in [travel-providers.types.ts](../../src/domain/providers/travel-providers.types.ts) che elenca "OpenAI, MCP" tra le integrazioni future accanto a Google Places/Apple Maps/Mapbox — puro elenco aspirazionale, non un piano concreto.

Chi legge il codice aspettandosi un "motore AI" da qualche parte non lo troverà: quello che oggi sembra intelligenza (composizione delle giornate, suggerimenti, punteggi di qualità) è interamente **Rule Engine deterministico** — vedi [RULE_ENGINE.md](RULE_ENGINE.md). Non è AI, è euristica esplicita, ispezionabile riga per riga.

## Il prerequisito: Traveler DNA prima, AI Concierge dopo

ADR-014 disegna un `MemoryEngine` che osserva lo stream di Domain Fact sull'Event Bus e ne deriva un profilo comportamentale persistente per-utente — il **Traveler DNA** — attraverso tre funzioni pure (`SignalExtractor`, `DnaAggregator`, `ProfileDeriver`). È esplicitamente **solo design, zero implementazione** (stato ADR: `Proposed`).

Punto architetturale non negoziabile, dichiarato in ADR-014 stessa: il DNA è **numerico**, mai testuale — *"si salva `museum_score = 0.81`, mai 'ama i musei'"*. Un futuro `TasteProfileNarrator` (anch'esso non costruito) tradurrà i numeri in linguaggio naturale, **separato** dal motore che li calcola. L'AI Concierge, quando esisterà, leggerà il Traveler DNA già maturo (pull, mai push) esattamente come oggi `JourneyComposer` legge `context.travelerDNA` con default neutri se vuoto — zero regressioni per un utente nuovo, zero accoppiamento tra i due sistemi.

**Perché questo ordine conta**: costruire un "AI Concierge" oggi, senza il Traveler DNA, significherebbe alimentarlo con un contesto generico — esattamente il rischio che [TRAVEL_OS_DNA.md](../context/TRAVEL_OS_DNA.md) elenca come "cosa Travel OS non deve mai diventare". L'AI Concierge non è un chatbot sopra un prompt; è un consumer di un profilo comportamentale osservato, derivato deterministicamente da fatti reali.

## Vincoli architetturali già fissati per quando il MemoryEngine verrà costruito

- Consuma **solo** eventi dall'Event Bus (whitelist esplicita, mai `'*'`) — non legge mai lo storage di un altro motore, non chiama altri Engine.
- Pubblica una slice `travelerDNA` in `TravelContext` tramite `registerStatePublisher`, stesso pattern già in uso da `PlacesEngine`/`TimelineEngine`.
- Zero setter pubblici: il DNA è derivato, mai scritto direttamente — ricostruibile per replay dal solo log episodico.
- Distingue tre livelli — **Episodic** (log comportamentale grezzo), **Semantic/TasteProfile** (affinità di categoria con confidence + sampleSize anti cold-start), **Procedural** (abitudini: orario preferito, km di comfort camminati, aderenza al piano).
- **Non tocca `JourneyComposer`**: per design è ortogonale, non lo richiede né lo blocca.
- Privacy non negoziabile fin dal design: consenso esplicito, `reset()` per cancellazione totale (GDPR), `export()` per portabilità, on-device di default.

Rispetta letteralmente il naming stub esistente `IMemoriesEngine` ([engines.types.ts](../../src/core/engines/types/engines.types.ts)) descrive un concetto **diverso** (recap/momenti del viaggio) — ADR-014 raccomanda di rinominarlo `IRecapEngine` per evitare collisione semantica con `ITravelerDnaEngine`. **Questo rename non è ancora stato fatto nel codice** — un agente che lavora su questa area deve saperlo prima di assumere che `IMemoriesEngine` sia il posto giusto per il DNA.

## Prerequisito bloccante non ovvio: `UserContext`

ADR-014 lo dichiara esplicitamente: il Traveler DNA è per-utente, ma il `ContextEngine` compone oggi per-trip con un `userId` di default hardcoded (`default-user`). Senza una risoluzione reale `tripId → userId`, il DNA non ha un soggetto a cui attaccarsi. Questo prerequisito **non è cosmetico**: è un blocco reale all'implementazione, non un miglioramento parallelo rimandabile.

## Rollout proposto (da ADR-014, non ancora iniziato)

Fase 0 (sola cattura, nessuna UI) → Fase 1 (TasteProfile derivato) → Fase 2 (ProceduralProfile + evento `TravelerInsightDetected`) → Fase 3 (consumo: Composer legge il DNA come segnale opzionale, `TasteProfileNarrator` + AI Concierge lo verbalizzano). La cattura (Fase 0) è la parte che ha senso avviare per prima indipendentemente dal resto della roadmap, perché la storia comportamentale di un viaggiatore non si può ricostruire retroattivamente.
