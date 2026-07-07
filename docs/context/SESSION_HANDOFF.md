# SESSION_HANDOFF.md

> Documento vivo — da aggiornare a fine di ogni sessione di lavoro significativa (umana o con agente AI), non solo periodicamente. Obiettivo: chiunque riprenda il progetto dopo giorni o settimane deve poter leggere solo questo file e sapere esattamente dove riprendere, senza dover ricostruire il contesto da `git log`. Se questo file non viene aggiornato, il primo segnale è che la sessione successiva lo scoprirà disallineato — trattalo con la stessa disciplina di [DECISIONS.md](DECISIONS.md) rispetto allo stato reale delle ADR.

---

## Ultimo aggiornamento: 2026-07-07 (fine sessione)

## Ultimo sprint

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
- **Frammentazione del modello Place (Place/TravelPlace/JourneyPlace/PlaceRef)** — ora priorità immediata, 26 errori `tsc` verificati, concentrati in `app/trip/[id]/places/[placeId].tsx`. Vedi [KNOWN_DEBT.md](KNOWN_DEBT.md#frammentazione-del-modello-place--ora-verificata-a-livello-di-compilatore-priorità-alta).
- History git non ancora riorganizzata: il commit `41bdfea` è un unico blob di 131 file, non split per feature — pulizia rimandata a dopo la risoluzione del modello Place.
- Due percorsi di pianificazione paralleli (uno morto) — decisione di rimozione/migrazione non ancora presa.
- `IMemoriesEngine` ha un naming ambiguo rispetto al futuro Traveler DNA (ADR-014 raccomanda rename a `IRecapEngine`, non ancora fatto).
- `UserContext` (risoluzione reale `tripId → userId`) è un prerequisito bloccante per il Traveler DNA, non ancora costruito.
- Auth Firebase reale ma disconnessa dalla navigazione (`app/login.tsx`).

## Prossimo task

Ordine concordato a fine sessione (sostituisce l'ordine precedente basato solo su [CURRENT_ROADMAP.md](CURRENT_ROADMAP.md)):
1. **Unificazione del modello Place** — formalizzare in un'ADR la pipeline `Provider → Canonical Place → JourneyPlace → PlaceRef` con mapper espliciti, poi implementarla. I 26 errori `tsc` sono il criterio di completamento oggettivo (tornano a 0 senza fix puntuali).
2. **Sprint 13.2 — Domain Lifecycle** (ADR-015): watcher fire-once per `TripStarted`/`TripCompleted`, prerequisito reale per il consolidamento del Traveler DNA.
3. **Sprint 13.3 — User Signals** (ADR-015): write path per `personalRating` → evento `PlaceRated`.
4. **Traveler DNA Fase 0** (ADR-014): sola cattura (`SignalExtractor` + log episodico), bloccata da `UserContext`.
5. **Pulizia della history git**: split del checkpoint `41bdfea` in commit logici, solo dopo i punti precedenti — non è più urgente, il lavoro è al sicuro su `origin/main`.

## Ultimo commit di questa sessione

`41bdfea` — "checkpoint: commit full working implementation (backend, engines, providers, hooks, UI)" — pushato su `origin/main`, nessuna divergenza residua.

## ADR attive

Vedi indice completo con stato verificato in [DECISIONS.md](DECISIONS.md). In sintesi: ADR-001 (accettata, Provider Layer già implementato), ADR-014 (proposta, design-only), ADR-015 (proposta ma Sprint 13.1 già fatto), ADR-016 (documentata, fix non implementato). **Manca ancora** un'ADR per l'unificazione del modello Place — è il prossimo documento di decisione da scrivere, prima del codice.
