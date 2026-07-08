# SESSION_HANDOFF.md

> Documento vivo — da aggiornare a fine di ogni sessione di lavoro significativa (umana o con agente AI), non solo periodicamente. Obiettivo: chiunque riprenda il progetto dopo giorni o settimane deve poter leggere solo questo file e sapere esattamente dove riprendere, senza dover ricostruire il contesto da `git log`. Se questo file non viene aggiornato, il primo segnale è che la sessione successiva lo scoprirà disallineato — trattalo con la stessa disciplina di [DECISIONS.md](DECISIONS.md) rispetto allo stato reale delle ADR.

---

## Ultimo aggiornamento: 2026-07-08 (fine sessione)

## Ultimo sprint (2026-07-08) — Sprint 14, Fase 1: primo codice reale su ADR-017, con review indipendente

Prima sessione con modifiche di codice da quando ADR-017 è stata decisa (sessione precedente, stesso giorno — vedi sotto). Scope deliberatamente ristretto, concordato in un piano approvato prima di toccare qualunque file (vedi `/Users/roccosantonastasio/.claude/plans/zazzy-kindling-wozniak.md`): solo dominio Place (`src/domain/trip/`), zero UI, zero `JourneyComposer`, zero `TimelineRuleEngine`, zero adozione in un percorso live — nessun cambiamento funzionale per costruzione. Consegna iniziale seguita, nella stessa sessione, da una review indipendente ("dimentica il piano, valuta solo il codice risultante") che ha trovato 2 difetti bloccanti e 5 osservazioni minori — tutti risolti prima del commit.

**Consegnato (stato finale)**:
- `PlaceMergeEngine.mergeFromProvider()` — punto unico di conversione Provider→Canonical Place (piano di migrazione ADR-017, passo #2). Delega a `mergePlace()` invariato per l'aggiornamento (dopo validazione `existing.tripId === options.tripId`, throw se incoerente); logica nuova per la creazione (prima assente), con un `id` generato indipendentemente da `externalProviderId` (convenzione già in uso in `TripRepository.createTrip`). Zero adozione verificata — solo la propria definizione e il proprio test lo referenziano.
- `external`/`personal` (gli alias duplicati di `baseData`/`memories` in `TravelPlaceSchema`) **rimossi fisicamente** dallo schema — non solo deprecati: la deprecazione in due passi pianificata inizialmente è stata scartata in review perché lasciava una finestra di stato incoerente (`baseData` aggiornato, `external` stantio, se un percorso dimenticato lo avesse mai valorizzato). Verificato zero uso in tutto il repository prima di rimuovere.
- **Correzione a ADR-017** (non una nuova decisione, una correzione di dettaglio verificato durante l'implementazione): i nomi canonici sono `baseData`/`memories`, non `external`/`personal` come scritto originariamente — l'uso reale nel repository (5 file su `baseData`, zero su `external`; zero su entrambi `memories`/`personal`) rende la scelta opposta a costo di migrazione molto più basso, a parità di decisione di fondo (un solo nome canonico per livello).
- **Due difetti bloccanti trovati e corretti dalla review**: (1) la prima versione faceva coincidere `id` con `incoming.placeId` (l'id del provider), contraddicendo la separazione `id`/`externalProviderId` già presente nel repository (`budapest.mock.ts`) e rischiando una collisione silenziosa in `InMemoryPlaceRepository` (Map globale chiavata su `id` tra tutti i trip) se lo stesso luogo fisico fosse salvato in due trip diversi; (2) il doc-comment della funzione dichiarava che la firma sarebbe rimasta stabile per adottare in futuro il catalogo editoriale come "secondo produttore" — falso, verificato: il catalogo produce dati `ExternalPlace`-shaped, non `PlaceMetadata`-shaped come richiesto dalla firma. Corretto il commento per dichiarare onestamente il limite invece di un contratto non mantenuto.
- 9 nuovi test (`PlaceMergeEngine.test.ts`, inclusi quelli che pinnano le due correzioni sopra), 49/49 verdi. `tsc --noEmit`: 26 errori preesistenti invariati (nessuno in scope), zero nuovi.
- **Debito scoperto**: `budapest.mock.ts` è un secondo punto di creazione di `TravelPlace` (dati mock statici scritti a mano), non riconciliato col nuovo punto unico — non è duplicazione di mapper (non trasforma dati provider), ma resta un punto di creazione parallelo, tracciato per una fase successiva. `mergeFromProvider` non è ancora compatibile con l'ingresso del catalogo editoriale (vedi difetto (2) sopra) — limite noto, non risolto in Fase 1.

## Sessione precedente, stesso giorno (2026-07-08) — decisione ADR-017

Sessione di sola analisi/decisione architetturale, come richiesto esplicitamente: nessuna riga di codice modificata. Prodotta [ADR-017](../adr/017-unificazione-modello-place.md) — la decisione che [CURRENT_ROADMAP.md](CURRENT_ROADMAP.md) indicava come prerequisito prima di toccare il modello Place.

**Correzioni rispetto all'ipotesi di partenza** (`Provider → Canonical Place → JourneyPlace → PlaceRef`), verificate direttamente nel codice, non assunte:
- `JourneyPlace` e il suo mapper (`mapPlaceToJourneyPlace`) sono **codice morto confermato** — zero chiamanti in tutto il repository. Rimossi dalla pipeline, non portati avanti come quarta tappa.
- "Provider" non è una sorgente singola: esistono **due percorsi indipendenti e mai riconciliati** per i dati esterni (`TravelServices.places()` → `PlaceMetadata`, sempre mock/curato; `placeRepository` singleton, Sprint 12, → `Place` core/domain, unico punto di contatto reale col backend, raggiunto solo come bypass in `[placeId].tsx`). Questo bypass è la causa diretta di 24 dei 26 errori `tsc` odierni (verificato con una run diretta di `npx tsc --noEmit`).
- `TravelPlace` (rivisto, senza gli alias duplicati `baseData`/`external` e `memories`/`personal`) è stato eletto **Canonical Place** — non deprecato. È l'unica rappresentazione con una vera separazione a tre livelli (External/Editorial/Personal) e garanzie strutturali reali (`PlaceMergeEngine`).

**Pipeline decisa**: `PlaceMetadata → TravelPlace → PlaceRef`, tre stadi, due mapper (`PlaceMergeEngine.mergeFromProvider` — standardizzazione di `mergePlace()` già esistente, non scritta da zero — e il nuovo `canonicalPlaceToPlaceRef`). `PlaceRef` smette di essere sia record di libreria persistito sia stato di pianificazione effimero (doppio ruolo verificato oggi in `PlacesEngine`): diventa solo proiezione, mai persistita per intero.

## Sprint precedente (2026-07-07)

Sessione in due parti nettamente distinte — prima documentazione, poi messa in sicurezza:

1. **Knowledge Base permanente** (commit `d77c0a7`): creati 26 documenti in `/docs` (vision, architecture, glossary, agents, context) basati su ispezione diretta del codice tramite 6 agenti di ricerca paralleli, più 4 documenti operativi (`ENGINE_MAP.md`, `DECISION_TREE.md`, `ENGINE_LIFECYCLE.md`, questo file), più `.claude/context/` con symlink ai documenti chiave.
2. **`.gitignore` — `.env` root non era ignorato** (commit `72bf7e7`): solo `.env*.local` era coperto; aggiunto `.env`/`.env.*`/`!.env.example`, a specchio del pattern già esistente per `backend/.env`.
3. **Scoperta critica durante la review della working tree**: quasi l'intero nucleo reattivo Fase 1 — l'intero `backend/`, `PlacesEngine`, il `DomainEventBus` stesso, `JourneyComposer`/Rule Engine, l'intero SIP (`TravelServices`), tutti i View Layer hook — **non era mai stato committato in nessun commit della storia del repo**. Alcuni test già committati (`PlaceMergeEngine.test.ts`, `DistanceCalculator.test.ts`) referenziavano sorgenti mai versionate: un fresh clone avrebbe fallito la build.
4. **Checkpoint di sicurezza** (commit `41bdfea`, pushato su `origin/main`): tutta l'implementazione reale (131 file: backend, engine, provider, hook, UI) committata in un unico commit non ancora suddiviso per storia pulita — deliberatamente, per azzerare subito il rischio di perdita prima di qualunque riorganizzazione. Verificato prima del push: backend `tsc --noEmit` → 0 errori; `npx jest` → 40/40 test passati, 4/4 suite verdi. App `tsc --noEmit` → **26 errori preesistenti**, non introdotti dal checkpoint (vedi sotto).

## Decisioni prese

- **La sicurezza del lavoro viene prima della pulizia della history.** Un unico commit checkpoint non suddiviso è stato scelto deliberatamente sopra uno split "pulito" in 9 commit logici (pianificato ma poi accantonato) perché il rischio di perdita era reale e immediato — la riorganizzazione della history resta un passo successivo, non urgente ora che il codice è al sicuro su `origin/main`.
- **I 26 errori TypeScript non vanno corretti riga per riga.** Sono la conferma misurata (compilatore, non solo lettura del codice) della frammentazione del modello Place già descritta come trade-off in [DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md) — vanno risolti ragionando sulla pipeline del modello, non patchando i 26 punti singolarmente. Vedi la nuova sezione "Priorità immediata" in [CURRENT_ROADMAP.md](CURRENT_ROADMAP.md).
- **Riprioritizzazione**: la risoluzione del modello Place precede Sprint 13.2 — un modello frammentato rende più fragile qualunque nuovo motore costruito sopra (incluso il Domain Lifecycle watcher).
- Il "Provider Layer" di ADR-001 è considerato implementato (sotto il nome SIP/`TravelServices`), non più lavoro futuro — vedi [DECISIONS.md](DECISIONS.md#adr-001).
- I bug preesistenti scoperti durante un refactoring si documentano e si bloccano con un test, non si correggono silenziosamente (pattern ADR-016, ora eletto a principio di prodotto in [PRODUCT_PRINCIPLES.md](../vision/PRODUCT_PRINCIPLES.md#2-i-bug-si-documentano-non-si-nascondono)) — applicato oggi anche ai 26 errori tsc.
- Il percorso di pianificazione legacy (`PlannerEngine`/`usePlannerStore`) resta esplicitamente non esteso, in attesa di una decisione su rimozione o migrazione — vedi [KNOWN_DEBT.md](KNOWN_DEBT.md).
- La documentazione (`/docs`) è ora la fonte di verità per architettura/vision/decisioni; il codice resta fonte di verità per il comportamento effettivo — in caso di conflitto, verificare sempre nel codice (vedi [DECISIONS.md](DECISIONS.md#perché-lo-stato-dichiarato-in-unadr-può-non-bastare)).

## Problemi aperti

Vedi il dettaglio completo in [KNOWN_DEBT.md](KNOWN_DEBT.md). I più rilevanti per chi riprende il lavoro:
- **Frammentazione del modello Place** — la decisione è presa ([ADR-017](../adr/017-unificazione-modello-place.md)), **Fase 1 dell'implementazione fatta** (punto unico di conversione Provider→Canonical Place, de-duplicazione di scrittura — solo dominio, zero adozione). 26 errori `tsc` verificati (24 in `app/trip/[id]/places/[placeId].tsx`) restano invariati e sono ancora il criterio oggettivo di completamento — non toccati in Fase 1 per costruzione (sono nel percorso legacy/bypass UI, fuori scope). Prossimo passo: Fase 2, adozione in un percorso reale. Vedi [KNOWN_DEBT.md](KNOWN_DEBT.md#frammentazione-del-modello-place--ora-verificata-a-livello-di-compilatore-priorità-alta) (da aggiornare quando l'adozione parte).
- History git non ancora riorganizzata: il commit `41bdfea` è un unico blob di 131 file, non split per feature — pulizia rimandata a dopo l'implementazione di ADR-017.
- Due percorsi di pianificazione paralleli (uno morto) — ADR-017 decide esplicitamente la rimozione del percorso legacy (`PlannerEngine`/`usePlannerStore`), non ancora eseguita.
- `IMemoriesEngine` ha un naming ambiguo rispetto al futuro Traveler DNA (ADR-014 raccomanda rename a `IRecapEngine`, non ancora fatto).
- `UserContext` (risoluzione reale `tripId → userId`) è un prerequisito bloccante per il Traveler DNA, non ancora costruito.
- Auth Firebase reale ma disconnessa dalla navigazione (`app/login.tsx`).

## Prossimo task

Roadmap di sprint aggiornata in [CURRENT_ROADMAP.md](CURRENT_ROADMAP.md) col principio "decisione ≠ attivazione" — ora [PRODUCT_PRINCIPLES.md §9](../vision/PRODUCT_PRINCIPLES.md#9-decisione--attivazione) — che evita di aprire ADR ridondanti solo per eseguire una decisione già presa:
1. **Sprint 14 — Implementare ADR-017** — 🟡 Fase 1 fatta (dominio, zero adozione). **Fase 2 (prossima)**: adottare `PlaceMergeEngine.mergeFromProvider()` in un percorso reale — richiede toccare `PlacesEngine`/UI, esplicitamente fuori scope per Fase 1. I 26 errori `tsc` restano il criterio di completamento oggettivo dell'intero Sprint 14, non ancora toccati.
2. **Sprint 15 — ADR-015**: Domain Lifecycle (13.2, watcher `TripStarted`/`TripCompleted`) + User Signals (13.3, write path per `personalRating` → evento `PlaceRated`, ora sul livello `personal` di `TravelPlace`).
3. **Sprint 16 — Attivare ADR-014, Fase A (Memory Capture)**: Event Bus → log episodico append-only, zero interpretazione. Bloccata da `UserContext`.
4. **Sprint 17 — Attivare ADR-014, Fase B (Memory Intelligence)**: TasteProfile, ProceduralProfile, decay temporale — dipende da Sprint 15 e da una storia reale accumulata in Sprint 16.
5. **Sprint 18 — Context Assembly**: il Traveler DNA entra in `TravelContext` come segnale opzionale per `JourneyComposer`.
6. **Sprint 19 — AI Concierge**: verbalizza il contesto assemblato. **Richiede una nuova ADR dedicata** prima di partire — a differenza degli sprint 14-18, non è l'attivazione di una decisione già presa.
7. **Pulizia della history git**: split del checkpoint `41bdfea` in commit logici, solo dopo i punti precedenti — non è più urgente, il lavoro è al sicuro su `origin/main`.

## Ultimo commit di questa sessione

Le modifiche di questa sessione (Fase 1 di ADR-017, codice + documentazione: `PlaceMergeEngine.ts`, `place.model.ts`, `PlaceMergeEngine.test.ts`, `ADR-017`, `CURRENT_ROADMAP.md`, questo file) vengono committate in un unico commit sopra `0b3fc76` ("docs: ADR-017 unifica il modello Place, roadmap di sprint 14-19"), a sua volta sopra `41bdfea` (checkpoint). Verificato prima del commit: `tsc --noEmit` → 26 errori preesistenti invariati, zero nuovi; `jest` → 49/49 test verdi. Consulta `git log --oneline -1` per l'hash esatto — non riportato qui per evitare un riferimento che il commit stesso non potrebbe contenere in modo consistente.

## ADR attive

Vedi indice completo con stato verificato in [DECISIONS.md](DECISIONS.md). In sintesi: ADR-001 (accettata, Provider Layer già implementato), ADR-014 (proposta, design-only), ADR-015 (proposta ma Sprint 13.1 già fatto), ADR-016 (documentata, fix non implementato), **ADR-017 (proposta, decisione presa, Fase 1 dell'implementazione fatta — solo dominio, zero adozione)** — la pipeline `PlaceMetadata → TravelPlace → PlaceRef` è la fonte di verità per qualunque lavoro sul modello Place; nomi canonici corretti durante l'implementazione da `external`/`personal` a `baseData`/`memories` (vedi ADR-017 §3.2).
