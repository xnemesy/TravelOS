# CURRENT_ROADMAP.md

> Lavoro pianificato secondo le ADR esistenti, con stato di avanzamento verificato — non un piano inventato. Vedi [DECISIONS.md](DECISIONS.md) per il dettaglio di ciascuna ADR.

## Roadmap di sprint — decisioni vs. attivazione

Principio guida (dal 2026-07-08): una decisione già presa in un'ADR **non si riscrive** al momento dell'implementazione — si **attiva**. Questo tiene pulita la storia delle decisioni: un'ADR resta la registrazione di un momento di scelta, uno sprint è l'esecuzione di quella scelta. Non si apre una nuova ADR solo perché un'ADR esistente, già accettata nel merito, sta per essere finalmente implementata (vedi anche come `DECISIONS.md` tratta ADR-015/Sprint 13.1: implementato senza riaprire il documento).

| Sprint | Cosa | ADR di riferimento | Stato |
|---|---|---|---|
| 13.1 | Pulizia Event Bus (eventi fittizi, taxonomy granulare) | ADR-015 | ✅ Fatto (commit `9e06fac`) |
| **14** | **Implementare ADR-017** — pipeline `PlaceMetadata → TravelPlace → PlaceRef`, piano di migrazione a 17 passi | ADR-017 | 🟡 Fase 1 fatta e revisionata (punto unico di conversione, de-duplicazione fisica dello schema, 2 difetti di design corretti in review) — adozione in un percorso live non ancora iniziata |
| 15 | Domain Lifecycle (13.2) + User Signals (13.3) — dettaglio sotto | ADR-015 | Non iniziato — dopo Sprint 14 |
| 16 | **Attivare ADR-014, Fase A — Memory Capture**. Event Bus → log episodico, zero interpretazione | ADR-014 | Non iniziato — dopo Sprint 15 |
| 17 | **Attivare ADR-014, Fase B — Memory Intelligence**. Decay, TasteProfile, clustering, Traveler DNA | ADR-014 | Non iniziato — dopo Sprint 16 |
| 18 | Context Assembly — il DNA entra in `TravelContext` come segnale che `JourneyComposer` può leggere | ADR-014 (Fase 3, parziale) | Non iniziato — dopo Sprint 17 |
| 19 | AI Concierge — verbalizza il DNA/contesto assemblato | **Nessuna ADR ancora** — territorio scoperto, vedi nota sotto | Non iniziato — richiede un'ADR dedicata prima di partire |

**Perché Sprint 15 sta prima di Sprint 16/17, e non dopo**: Sprint 13.2 (Domain Lifecycle) non blocca la Fase A (sola cattura, nessuna interpretazione), ma blocca la Fase B — senza un momento discreto "il viaggio è finito" il DNA non ha mai un punto in cui applicare il decay temporale. Tenerlo prima invece che dopo evita di dover riaprire la sequenza quando si arriverà a quella fase.

**Perché Fase A (cattura) è separata da Fase B (intelligenza) invece di restare un blocco unico**: ADR-014 descrive due attività di natura diversa sotto lo stesso documento — registrare fatti (Event Bus → log episodico, zero interpretazione) e interpretarli (decay, clustering, TasteProfile). Solo la seconda dipende da Sprint 15. Anticipare la cattura (Sprint 16) indipendentemente dall'intelligenza (Sprint 17) ha un motivo che non è di sequencing tecnico ma di dominio: **la storia comportamentale di un viaggiatore non è ricostruibile retroattivamente** — chi inizia a registrare eventi oggi ha sei mesi di storia tra sei mesi; chi aspetta l'intelligenza pronta prima di iniziare a registrare parte da zero quel giorno. Questa separazione non riscrive ADR-014 (che resta un solo documento di decisione): è solo come la roadmap sequenzia la sua esecuzione.

## Sprint 14 — Implementare ADR-017 (Unified Place Model)

Deciso in [ADR-017](../adr/017-unificazione-modello-place.md) (2026-07-08), dopo che il checkpoint di sicurezza aveva reso misurabile (26 errori `tsc`, vedi [KNOWN_DEBT.md](KNOWN_DEBT.md#frammentazione-del-modello-place--ora-verificata-a-livello-di-compilatore-priorità-alta)) un costo finora solo descritto come trade-off in [DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md). La decisione è chiusa: pipeline a tre stadi `PlaceMetadata → TravelPlace → PlaceRef` (non quattro — `JourneyPlace` eliminato, confermato codice morto), `TravelPlace` eletto Canonical Place, piano di migrazione a 17 passi ordinato per mantenere il progetto compilabile. Questo sprint esegue quel piano — non ridiscute la pipeline.

**Fase 1 (2026-07-08) — ✅ completata e revisionata, solo dominio, zero adozione**: scope volutamente ristretto a lavoro additivo e di de-duplicazione dentro `src/domain/trip/`, senza toccare UI, `JourneyComposer`, `TimelineRuleEngine`, né adottare nulla in un percorso live (nessun cambiamento funzionale, per costruzione). Consegnata, poi passata attraverso una review indipendente (stesso giorno) che ha trovato due difetti di design bloccanti, entrambi corretti prima del commit — dettaglio sotto. Consegnato (stato finale, post-review):
- `PlaceMergeEngine.mergeFromProvider(incoming: PlaceMetadata, options: { tripId, existing?, editorial? }): TravelPlace` — il punto unico di conversione Provider→Canonical Place richiesto dal piano di migrazione passo #2. Delega a `mergePlace()` (invariato) quando esiste già un luogo, dopo aver validato `existing.tripId === options.tripId` (throw se incoerente — corretto in review, prima veniva ignorato silenziosamente). Costruisce un `TravelPlace` nuovo quando non esiste, con un `id` generato indipendentemente da `externalProviderId` (`place-${Date.now()}-${random}`, stessa convenzione di `TripRepository.createTrip`) — **corretto in review**: la prima versione faceva coincidere `id` con `incoming.placeId`, che avrebbe causato una collisione silenziosa in `InMemoryPlaceRepository` (Map globale chiavata su `id` tra tutti i trip) se lo stesso luogo fisico fosse stato salvato in due trip diversi. **Non ancora adottato da alcun chiamante reale** — verificato: compare solo nella propria definizione e nel proprio test.
- Duplicazione di scrittura **e di schema** `baseData`/`external` e `memories`/`personal` eliminata: `external`/`personal` sono stati **rimossi fisicamente** dallo schema (non solo deprecati — la strategia in due fasi pianificata inizialmente è stata scartata in review perché lasciava una finestra di stato incoerente; vedi ADR-017 §3.2 per il dettaglio, inclusa la verifica empirica — non assunta — che `@deprecated` sopravvive a `z.infer<>`).
- Copertura test aggiunta per `mergePlace` (assente prima) e `mergeFromProvider` (nuovo, incluse le due regressioni trovate in review) — 9 nuovi test, 49/49 totali verdi. `tsc --noEmit`: 26 errori preesistenti invariati, zero nuovi.
- **Debito scoperto, fuori scope**: `budapest.mock.ts` è un secondo punto di creazione di `TravelPlace` (dati mock statici, non da provider) — non conta come duplicazione del mapper (non trasforma dati provider), ma resta l'unico altro costruttore diretto del tipo nel repository. Il doc-comment di `mergeFromProvider` segnala esplicitamente anche un secondo limite noto: non è ancora compatibile con l'ingresso del catalogo editoriale (`ExternalPlace`-shaped, non `PlaceMetadata`-shaped) nonostante ADR-017 §3.5 lo preveda come "secondo produttore legittimo" — richiederà un passaggio di conversione non ancora scritto.
- **Prossimo passo naturale**: Fase 2 — adottare `mergeFromProvider` in un percorso reale (richiede toccare `PlacesEngine`/UI, esplicitamente fuori scope per Fase 1).

## Sprint 15 — ADR-015, Domain Lifecycle e User Signals

**Sprint 13.2 — Domain Lifecycle** (non iniziato): un watcher fire-once che confronti lo stato derivato del Trip (`TripCalculator.getTripStatus`, oggi puramente calcolato ad ogni render) con l'ultimo stato persistito noto, e pubblichi `TripStarted`/`TripCompleted` solo alla prima transizione osservata. Decisione di design ancora aperta: se l'app non viene aperta durante l'intero arco del viaggio, il watcher deve emettere entrambi i fatti in sequenza o saltare direttamente a `completed`?

**Sprint 13.3 — User Signals** (non iniziato): azione di scrittura + UI minima per il rating personale (`personalRating`, oggi solo schema Zod senza write path) → evento `PlaceRated`. Estensioni naturali della stessa categoria: preferiti, feedback espliciti. Con ADR-017 implementato, questo write path scrive sul livello `personal` di `TravelPlace` (§3.2/§5.7 di ADR-017), non più su un `PlaceRef` mutato in memoria.

## Sprint 16 — Attivare ADR-014, Fase A: Memory Capture

Corrisponde alla "Fase 0 — Sola cattura" già descritta in ADR-014: `SignalExtractor` + log episodico append-only, alimentato dall'Event Bus (`PlaceVisited`, `PlaceRated`, `PlaceNotesUpdated`, `TripStarted`/`TripCompleted` da Sprint 15, `TimeSpent`, ecc.). **Zero interpretazione**: nessun profilo esposto, nessuna UI, nessun calcolo derivato. Con ADR-017 implementato, la fonte di osservazione per i segnali legati a un luogo è `TravelPlace` (letto in sola lettura, vedi ADR-017 §3.6/§4/§8) — prima di ADR-017 questa fonte non era univoca.

Non ridiscute il design di ADR-014 — lo esegue, e solo per la sua metà "cattura".

## Sprint 17 — Attivare ADR-014, Fase B: Memory Intelligence

Corrisponde a "Fase 1 — TasteProfile" e "Fase 2 — ProceduralProfile" di ADR-014: qui nasce il Traveler DNA vero e proprio.
- **TasteProfile** derivato dal log episodico (Sprint 16) + slice `travelerDNA` in `TravelContext`.
- **ProceduralProfile** (abitudini di viaggio) + evento `TravelerInsightDetected`.
- Decay temporale, clustering di preferenze — dipende da Sprint 15 (Domain Lifecycle) per il momento discreto "il viaggio è finito" su cui applicare il decay.

Non può iniziare prima che Sprint 16 abbia accumulato storia reale da interpretare — è la ragione stessa per cui le due fasi sono sprint separati e non un blocco unico.

## Sprint 18 — Context Assembly

Prima metà di "Fase 3 — Consumo" di ADR-014: il Traveler DNA (Sprint 17) entra in `TravelContext` come segnale che `JourneyComposer` può leggere opzionalmente durante la composizione greedy di una giornata. Nessuna verbalizzazione ancora — solo assemblaggio strutturato del contesto.

## Sprint 19 — AI Concierge

Seconda metà di "Fase 3 — Consumo" di ADR-014: un `TasteProfileNarrator` + un AI Concierge verbalizzano il contesto assemblato in Sprint 18. **A differenza degli sprint precedenti, questo non è la semplice attivazione di una decisione già presa**: nessuna ADR oggi descrive scope, vincoli, o design dell'AI Concierge — solo menzioni aspirazionali in `DOMAIN_TERMS.md`/`AI_ARCHITECTURE.md`. Prima di questo sprint serve un'ADR dedicata (stile ADR-014), non un'estensione implicita di ADR-014 — l'AI Concierge è un consumer del Traveler DNA, non parte della sua decisione di modello.

## Prerequisito trasversale — `UserContext`

`UserContext` (risoluzione reale `tripId → userId`, oggi hardcoded su un utente di default) blocca Sprint 16 in avanti — vedi [KNOWN_DEBT.md](KNOWN_DEBT.md#resolver-userid-hardcoded). Indipendente da Sprint 14/15.

## Motori Fase 2/3 — solo interfacce oggi

`IJourneyEngine`, `IBudgetEngine`, `IDocumentsEngine`, `ISyncEngine`, `INotificationEngine` esistono come contratti dichiarati in `engines.types.ts` ma senza alcuna roadmap dettagliata in un'ADR dedicata (a differenza di Memory/Traveler DNA, che ha ADR-014). Prima di implementarne uno, va scritta un'ADR che ne descriva scope e vincoli, seguendo lo stile di ADR-014 — non partire direttamente dall'interfaccia esistente assumendo che sia già una specifica sufficiente.

## Provider Layer — completare la copertura reale

Weather/Routing/OpeningHours/Currency/Translation hanno oggi solo adapter mock (`registerRealAdapters()` mai chiamato). Non è un lavoro coperto da un'ADR dedicata — collegare un provider reale per uno di questi domini è un'estensione naturale del SIP esistente (vedi [DATA_FLOW.md](../architecture/DATA_FLOW.md)), ma richiede comunque una decisione su quale provider concreto usare (nessuno è stato scelto nel codice, solo elencato in commenti come "Google Places, Apple Maps, OpenMeteo, Mapbox...").

## Debito noto che non è nella roadmap di nessuna ADR

I due percorsi di pianificazione paralleli, i due `PlaceRepository`, il codice morto in `trip-experience/`, e l'auth disconnessa non sono oggetto di alcuna ADR — restano debito silenzioso. Vedi [KNOWN_DEBT.md](KNOWN_DEBT.md). Chi decide di affrontarli dovrebbe considerare di aprire un'ADR prima, non limitarsi a una PR di pulizia silenziosa, dato il pattern di prodotto osservato (vedi [PRODUCT_PRINCIPLES.md](../vision/PRODUCT_PRINCIPLES.md#2-i-bug-si-documentano-non-si-nascondono)).
