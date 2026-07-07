# AGENTS.md — Regole per agenti AI su Travel OS

> Questo documento è la sintesi operativa per qualunque agente AI (Claude, Gemini, Codex, ChatGPT o altro) che lavora su questo codebase. Le guide specifiche per singolo agente ([CLAUDE.md](CLAUDE.md), [GEMINI.md](GEMINI.md), [CODEX.md](CODEX.md), [CHATGPT.md](CHATGPT.md)) rimandano tutte qui come fonte comune.
>
> Nota: esiste anche un `/AGENTS.md` alla radice del repo — riguarda una nota tecnica su Expo v56 ed è ortogonale a questo documento. Questo file (`docs/agents/AGENTS.md`) è la Knowledge Base di dominio; quello alla radice è una nota di compatibilità libreria.

## Prima di scrivere una riga di codice

Leggi, in ordine:
1. [`/docs/context/SESSION_HANDOFF.md`](../context/SESSION_HANDOFF.md) — dove si è fermata l'ultima sessione, cosa è già stato deciso, qual è il prossimo task.
2. [`/docs/vision/VISION.md`](../vision/VISION.md) — cosa stai costruendo e perché.
3. [`/docs/architecture/ARCHITECTURE.md`](../architecture/ARCHITECTURE.md) — dove si colloca il tuo cambiamento. Se hai già chiaro cosa vuoi fare ma non dove va, usa direttamente [`DECISION_TREE.md`](../architecture/DECISION_TREE.md).
4. [`/docs/context/PROJECT_STATE.md`](../context/PROJECT_STATE.md) (o la vista tabellare [`ENGINE_MAP.md`](../architecture/ENGINE_MAP.md)) — cosa è realmente implementato, cosa è stub, cosa è morto. **Questo è il documento che previene di più gli errori**: il codebase contiene percorsi paralleli vivi/morti (vedi sotto) e presumere che "esista perché c'è un file" è la causa più comune di lavoro sprecato.
5. [`/docs/context/KNOWN_DEBT.md`](../context/KNOWN_DEBT.md) — debito noto, per non "risolverlo" per errore come se fosse un requisito.

## Le 5 regole che non si negoziano

1. **La UI legge e scrive solo tramite `src/shared/hooks/`** (`useTravelContext`, `usePlaces`, `useTimeline`, `useNextPlace`, `useTravelActions`). Mai importare `contextEngine`/`placesEngine`/`timelineEngine`/repository direttamente in un componente. Dettaglio: [ARCHITECTURE.md](../architecture/ARCHITECTURE.md).
2. **L'Event Bus accetta solo Domain Fact** (fatti passati, realmente accaduti). Se ti serve solo forzare un ricalcolo interno nello stesso modulo, chiama `contextEngine.recompose()` direttamente — non pubblicare un evento fittizio. Dettaglio: [EVENT_BUS.md](../architecture/EVENT_BUS.md).
3. **Gli Engine orchestrano, i Domain Service calcolano.** Nuova logica di calcolo puro va in `src/domain/services/` (stateless, testabile senza mock); nuova logica con stato/side-effect va in un Engine. Dettaglio: [PRODUCT_PRINCIPLES.md](../vision/PRODUCT_PRINCIPLES.md).
4. **Un bug preesistente scoperto durante un refactoring si documenta, non si corregge silenziosamente.** Segui il pattern ADR-016: preserva il comportamento, blocca con un test esplicito, apri (o aggiorna) un ADR con le opzioni di fix. Dettaglio: [TESTING_STRATEGY.md](../architecture/TESTING_STRATEGY.md).
5. **Non fondere mai i tre livelli di un luogo** (External/Editorial/Personal). Un aggiornamento da provider tocca solo External. Dettaglio: [DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md).

## Percorsi paralleli — verifica sempre quale stai toccando

Il codebase contiene più di un caso di "due implementazioni per lo stesso concetto, una viva e una morta". Prima di estendere qualcosa, verifica in [PROJECT_STATE.md](../context/PROJECT_STATE.md) se è raggiungibile da uno screen reale:

- Pianificazione: **attivo** = `TimelineEngine`/`JourneyComposer`/`PlaceRef`. **Morto** = `PlannerEngine`/`usePlannerStore`/`TravelPlace`.
- Luoghi: **attivo** = `PlacesEngine`/MMKV/`PlaceRef`. **Morto** = `usePlaceStore`/`InMemoryPlaceRepository`/`TravelPlace`.
- Repository luoghi: due `PlaceRepository` con lo stesso nome, contratti diversi — vedi [DATA_FLOW.md](../architecture/DATA_FLOW.md).

Se un file non è importato da nessuno screen sotto `app/`, non estenderlo assumendo che sia la base corretta — verifica prima con una ricerca (`grep`) di chi lo importa realmente.

## Cosa NON esiste, non presumerlo

- Nessuna integrazione AI/LLM di alcun tipo (vedi [AI_ARCHITECTURE.md](../architecture/AI_ARCHITECTURE.md)).
- Nessuna sincronizzazione cloud dei dati di viaggio (Firebase è inizializzato ma inutilizzato per trip/luoghi).
- Nessuna autenticazione realmente collegata alla navigazione (`app/login.tsx` è disconnesso).
- Nessun motore Fase 2/3 (`Journey`, `Budget`, `Memories`, `Documents`, `Sync`, `Notification`, `AI`) — solo interfacce, zero implementazioni.
- Meteo/orari/routing/valuta/traduzione sono sempre dati mock oggi (solo i luoghi hanno un percorso dati reale).

## Prima di consultare un ADR

Gli ADR in `docs/adr/` hanno un campo `Stato` che può essere **stale rispetto al codice**: ADR-015 è marcato `Proposed` ma il suo Sprint 13.1 è già implementato (verificato in `git log`). Verifica sempre nel codice, non fidarti solo dell'etichetta di stato — vedi [DECISIONS.md](../context/DECISIONS.md) per lo stato aggiornato di ciascuna decisione.

## Mantenere questa Knowledge Base

Se il tuo lavoro cambia un fatto documentato qui (un motore Fase 2 viene implementato, un pezzo di codice morto viene rimosso, un ADR viene chiuso), aggiorna il documento pertinente nella stessa sessione — non lasciare che la documentazione diverga dal codice come già accaduto ad alcuni ADR. Non aggiungere qui dettagli implementativi che il codice sorgente già spiega meglio (nomi di variabili, firme di funzione): questa è documentazione di **decisioni e architettura**, non un doppione dei commenti nel codice.

Prima di chiudere la sessione, aggiorna anche [`SESSION_HANDOFF.md`](../context/SESSION_HANDOFF.md) — è il documento che permette alla prossima sessione (tua o di un altro agente) di ripartire senza dover ricostruire il contesto da `git log`.
