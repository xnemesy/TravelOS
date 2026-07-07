# ADR-014: Traveler DNA / Memory Engine

**Stato**: Proposed — Solo design, nessuna implementazione
**Data**: Luglio 2026
**Autori**: Rocco (owner) + Claude (design review)

---

## 1. Contesto e Problema

Travel OS oggi **pianifica**. La sua IP è il motore (`JourneyComposer`, `TimelineRuleEngine`). Manca il ramo di ritorno del ciclo di prodotto — il *Travel Intelligence Loop*:

```
Pianifico → Vivo → Registro → Imparo → Pianifico meglio
                                  ↑__________________|
```

Serve un componente che trasformi il **comportamento osservato** (non dichiarato) in un profilo matematico persistente, user-level — il **Traveler DNA** — riutilizzabile dal Composer e, in futuro, dall'AI Concierge, senza che nessuno dei due dipenda dall'altro.

### Vincoli architetturali dati
1. Integrarsi con l'`eventBus` esistente ([event-bus.ts](../../src/core/events/event-bus.ts)), **consumando** eventi — mai leggendo il DB o chiamando altri engine.
2. **Non toccare** `JourneyComposer`.
3. Pubblicare una slice nel Context Engine via `registerStatePublisher` (stesso pattern di `PlacesEngine`/`TimelineEngine`).
4. Essere **completamente indipendente dall'AI**: output esclusivamente numerico, nessuna frase persistita.
5. Distinguere tre livelli: **Episodic**, **Semantic (TasteProfile)**, **Procedural (abitudini)**.
6. Rispettare la regola d'oro di [ADR-001](./001-reactive-state-composition-vs-async-storage.md): l'Event Bus accetta solo Domain Facts; nessun engine legge lo storage di un altro engine.

### Distinzione chiave: memoria osservata vs memoria dichiarata

`TravelPlace.memories` (schema esistente in [place.model.ts](../../src/domain/trip/models/place.model.ts)) è già un livello di memoria — ma è **dichiarato dall'utente** (diario, rating personale, foto) e **scoped al singolo place dentro un singolo trip**.

Il Traveler DNA è diverso su entrambi gli assi:
- **Osservato**, non dichiarato: deriva dal comportamento (eventi), non da ciò che l'utente scrive.
- **User-level, cross-trip**: sopravvive al singolo viaggio ed è la base per il viaggio successivo.

Questi due livelli **coesistono e si alimentano a vicenda** (un `PlaceRated` a 5 stelle nel diario è anche un segnale per il DNA), ma non vanno confusi né uniti in un unico modello.

---

## 2. Decisione Architetturale

Introdurre un **`MemoryEngine`** (produttore tecnico, Fase 2 al pari di `PlacesEngine`/`TimelineEngine`) che materializza il **`TravelerDNA`** (artefatto di prodotto): consuma Domain Facts, mantiene aggregati incrementali, deriva il profilo con funzioni pure, e pubblica una slice `travelerDNA` nel `TravelContext`.

**Principio guida**: il DNA è **derivato, mai scritto direttamente**. Nessun setter pubblico. L'unico input è lo stream di eventi → il profilo è ricostruibile per replay, quindi deterministico e testabile.

> **Nota di naming**: esiste già uno stub `IMemoriesEngine` (`captureMoment`/`generateDailyRecap`) in [engines.types.ts](../../src/core/engines/types/engines.types.ts). È un concetto diverso (recap/momenti del viaggio). Decisione: questo componente è `ITravelerDnaEngine`; lo stub esistente va rinominato `IRecapEngine` per evitare collisione semantica quando entrambi esisteranno.

### 2.1 Componenti & Responsabilità

| Componente | Responsabilità | Cosa NON fa |
|---|---|---|
| **`MemoryEngine`** | Orchestratore. Sottoscrive una whitelist di eventi, estrae segnali, aggiorna aggregati, deriva il DNA, persiste, pubblica la slice, emette `TasteProfileUpdated`. | Non chiama altri engine. Non genera testo. Non conosce l'AI. |
| **`SignalExtractor`** (funzione pura) | `DomainEvent → BehavioralSignals` (numeri). | Nessuno stato, nessun I/O. |
| **`DnaAggregator`** (funzione pura) | `Aggregates + Signals → Aggregates` incrementale, con decay temporale. | Non ricalcola dall'intero log ad ogni evento. |
| **`ProfileDeriver`** (funzione pura) | `Aggregates → TasteProfile + ProceduralProfile`. | Niente `Date.now()` / `Math.random()`. |
| **`ITravelerDnaRepository`** | Persistenza su `ILocalDatabase`: log episodico + aggregati + snapshot. | Nessuna logica di business. |
| **`useTravelerDnaStore`** (Zustand) | Espone il DNA alla UI reattivamente, mirror dell'evento `TasteProfileUpdated`. | Nessun calcolo; solo mirror. |
| **`UserContext`** (prerequisito cross-cutting) | Risolve `tripId → userId`. | — |

Le tre funzioni pure (Extractor / Aggregator / Deriver) sono il cuore testabile: input → output, zero side-effect. Il `MemoryEngine` è solo la colla I/O attorno a esse.

### 2.2 I tre livelli di memoria (solo matematica, come da vincolo #4)

**Livello 1 — Episodic** (log comportamentale grezzo, append-only, fonte di verità replay-abile):

```ts
interface EpisodicMemoryEntry {
  id: string;
  userId: string;
  tripId: string;
  placeId?: string;
  factType: DomainFactType;
  category?: string;          // categoria del luogo al momento del fatto
  timestamp: string;          // ISO 8601
  signals: BehavioralSignals; // delta numerici estratti dall'evento
}

interface BehavioralSignals {
  visited?: 0 | 1;
  skipped?: 0 | 1;
  favorited?: 0 | 1;
  rating?: number;             // 1..5
  plannedDurationMin?: number;
  actualDurationMin?: number;
  dwellRatio?: number;         // actual/planned → sovra/sotto-permanenza
  startHourLocal?: number;     // 0..23.99
  photoTaken?: 0 | 1;
  recommendationAccepted?: 0 | 1;
}
```

**Livello 2 — Semantic / TasteProfile** (*cosa* ama; ogni score porta confidence + sampleSize come anti cold-start):

```ts
interface CategoryAffinity {
  score: number;       // 0..1
  confidence: number;  // 0..1, cresce con sampleSize
  sampleSize: number;
}

interface TasteProfile {
  version: number;
  categoryAffinity: Record<string, CategoryAffinity>; // museum, coffee, viewpoint, shopping...
  photographyInterest: number;              // 0..1
  nightlifeInterest: number;                // 0..1
  shoppingInterest: number;                 // 0..1
  averageVisitDurationMultiplier: number;   // EWMA di dwellRatio, baseline ~1.0
}
```

**Livello 3 — Procedural** (*come* viaggia; osservato, non dichiarato):

```ts
interface NumericHabit {
  value: number;
  confidence: number;
  sampleSize: number;
}

interface ProceduralProfile {
  preferredStartHour: NumericHabit;    // mediana ora prima attività su giorni completati
  preferredDinnerHour: NumericHabit;   // mediana orario cena osservato
  maxComfortWalkingKm: NumericHabit;   // p90 km/giorno prima di skip/reorder
  breakCadenceMinutes: NumericHabit;   // intervallo medio tra pause
  planAdherence: number;               // 0..1: segue il piano vs improvvisa
}
```

**Radice** — il DNA evolve, pesa il recente più del vecchio (`decayHalfLifeTrips`):

```ts
interface TravelerDNA {
  userId: string;
  taste: TasteProfile;
  procedural: ProceduralProfile;
  tripsAnalyzed: number;
  decayHalfLifeTrips: number; // knob di recency
  updatedAt: string;
}
```

Vincolo rispettato letteralmente: si salva `museum_score = 0.81`, mai "ama i musei". La frase la genererà un futuro `TasteProfileNarrator` — gemello del `DayNarrator` isolato per il Composer (ADR separato). Il motore produce numeri; un narratore a valle, mai il motore stesso, produce parole.

---

## 3. Eventi consumati

Whitelist esplicita, **non `'*'`** — per intento leggibile e per non aggravare il costo di ricomposizione già presente nel Context Engine attuale.

| Evento (esistente) | Segnali estratti |
|---|---|
| `PlaceVisited` | `visited=1`, `startHourLocal`, `category` |
| `PlaceSaved` | `favorited=1`, contributo ad affinità categoria |
| `PlaceRemoved` | segnale negativo debole sulla categoria |
| `PhotoAdded` | `photoTaken=1` → `photographyInterest` |
| `TimelineReordered` | segnale debole su `planAdherence` |
| `TripCompleted` | trigger di **consolidamento**: chiude il trip, applica il decay, incrementa `tripsAnalyzed` |

Eventi **da introdurre** (dettaglio completo nel Task 2 — audit dell'Event Bus) per alimentare segnali oggi non catturabili: `PlaceSkipped`, `PlaceLeftEarly`, `PlaceStayedLongerThanExpected`, `RecommendationAccepted`, `RecommendationIgnored`.

---

## 4. Eventi prodotti — e una divergenza deliberata

Le primitive comportamentali (`PlaceLeftEarly`, `PlaceSkipped`, `RecommendationIgnored`...) **non** vengono emesse dal `MemoryEngine`. Motivo: per sapere che l'utente "è uscito prima" servono sia lo stato pianificato sia quello reale — quella conoscenza appartiene a chi possiede la timeline (Timeline/JourneyEngine live-tracking), non alla memoria. Se il `MemoryEngine` le emettesse, dovrebbe leggere lo stato della timeline, violando la regola di non-coupling orizzontale.

Quindi:
- **Le primitive** le emette l'engine che possiede il dato. Il `MemoryEngine` le **consuma** (§3).
- **Il `MemoryEngine` emette solo fatti derivati/semantici**, di livello superiore:

```ts
// nuovi DomainFactType prodotti dal MemoryEngine
'TasteProfileUpdated'     // payload: { userId, changedDimensions[], version } — debounced
'TravelerInsightDetected' // payload: { userId, dimension, score, confidence } — solo sopra soglia
```

`TravelerInsightDetected` scatta solo quando un pattern diventa statisticamente affidabile (es. `coffee_score 0.93` con `confidence 0.8`). Non è un suggerimento — è un fatto derivato che l'AI Concierge potrà consumare in futuro.

---

## 5. Interfacce

```ts
interface ITravelerDnaEngine {
  getDNA(userId: string): TravelerDNA;                // snapshot sincrono
  getTasteProfile(userId: string): TasteProfile;
  subscribe(userId: string, cb: (dna: TravelerDNA) => void): () => void;
  reset(userId: string): Promise<void>;                // GDPR: right to erasure
  export(userId: string): Promise<TravelerDNA>;        // portabilità dati
  // Nessun setter: il DNA è derivato, mai scritto direttamente.
}

interface ITravelerDnaRepository {
  appendEpisodic(entry: EpisodicMemoryEntry): Promise<void>;
  getEpisodic(userId: string, opts?: { sinceTripId?: string; limit?: number }): Promise<EpisodicMemoryEntry[]>;
  getAggregates(userId: string): Promise<DnaAggregates | null>;
  saveAggregates(userId: string, agg: DnaAggregates): Promise<void>;
  getProfileSnapshot(userId: string): Promise<TravelerDNA | null>;
  saveProfileSnapshot(userId: string, dna: TravelerDNA): Promise<void>;
  clear(userId: string): Promise<void>;
}
```

`DnaAggregates` è il pezzo che rende il tutto O(1) e deterministico: conteggi/somme pesate correnti (per categoria: visite, favorite, somma rating, somma dwellRatio; per procedural: quantili di start-hour, km/giorno...). Il profilo è funzione pura degli aggregati. Il log episodico serve per audit/replay/export — **l'hot path non lo riscorre mai**.

---

## 6. Repository & Store

- **Persistenza**: `ITravelerDnaRepository` su `ILocalDatabase` esistente ([local-database.interface.ts](../../src/core/storage/local-database.interface.ts)), riusa `MMKVAdapter`. Tre chiavi per utente: `dna_episodic_{userId}` (log, rolling/bounded), `dna_agg_{userId}` (aggregati, hot path), `dna_profile_{userId}` (snapshot leggibile).
- **Offline-first**: tutto locale, per natura. La sincronizzazione cloud resta un seam futuro delegato al SyncEngine (fuori scope di questo ADR), coerente col trattamento di `TripRepository` oggi.
- **Privacy (non opzionale)**: è il dato più sensibile dell'app (profilazione comportamentale). Requisiti di design, non aggiungibili dopo: consenso esplicito all'attivazione, `reset()` per cancellazione totale, `export()` per portabilità, on-device di default.
- **Store UI**: `useTravelerDnaStore` (Zustand) sottoscrive `TasteProfileUpdated` sull'`eventBus` e mirror-a lo snapshot — stesso pattern già in uso in [trip.store.ts](../../src/features/trips/store/trip.store.ts). Nessun calcolo nello store.

---

## 7. Flusso dati

```
1. Utente agisce
        ↓
2. Engine PROPRIETARIO del dato emette DomainEvent (eventBus.publish)
        ↓
3. MemoryEngine (iscritto alla whitelist §3) riceve l'evento
        ↓
4. UserContext risolve tripId → userId
        ↓
5. SignalExtractor:  DomainEvent → BehavioralSignals        (puro)
        ↓
6. repo.appendEpisodic(entry)                                (I/O, audit)
        ↓
7. DnaAggregator: Aggregates + Signals + decay → Aggregates  (puro)
        ↓
8. ProfileDeriver: Aggregates → TasteProfile + Procedural    (puro)
        ↓
9. repo.saveAggregates + saveProfileSnapshot                 (I/O)
        ↓
10. eventBus.publish('TasteProfileUpdated')  (debounced)
        ↓
11. registerStatePublisher → slice { travelerDNA } nel Context Engine
        ↓
12. JourneyComposer / AI Concierge LEGGONO context.travelerDNA  (pull, mai push)
```

Il passo 12 è la chiave dell'indipendenza: il Composer **non sa** che il `MemoryEngine` esiste. Legge un campo del `TravelContext`. Se il DNA è vuoto (utente nuovo), legge default neutri e si comporta come oggi — zero regressioni, zero coupling, `JourneyComposer` non viene toccato.

**Punto di attrito da gestire onestamente**: la slice del Context Engine è composta per-trip, il DNA è per-user. Il publisher registrato riceve `tripId`, risolve `userId` via `UserContext` e ritorna lo stesso profilo per tutti i trip di quell'utente. Funziona, ma richiede che `UserContext` esista — conferma che l'eliminazione di `default-user` è un prerequisito reale di questo ADR, non un miglioramento cosmetico indipendente.

---

## 8. Come evitare tight coupling (riepilogo dei meccanismi)

1. **Solo eventi in ingresso**: nessuna import né chiamata diretta a Places/Timeline/Journey. Rispetta la regola dell'Event Bus.
2. **Whitelist, non `'*'`**: intento esplicito, nessuna ricomposizione superflua.
3. **Unidirezionale**: nessuno scrive nel `MemoryEngine` se non lo stream di eventi. Nessun setter pubblico.
4. **Solo `TravelContext` in uscita**: i consumatori fanno pull di un campo, non conoscono il produttore.
5. **AI isolata dietro un Narrator separato**: il motore emette numeri; le frasi sono un layer a valle — l'AI non è mai dentro il `MemoryEngine`.
6. **Funzioni pure** per estrazione/aggregazione/derivazione: testabili senza mock, deterministiche, ricostruibili per replay.

---

## 9. Conseguenze

**Positive**
- Sblocca il Travel Intelligence Loop; dà al futuro AI Concierge un contesto reale invece che generico.
- Cattura da subito (Fase 0 del rollout) risolve il problema di cold-start / data-gravity.
- Interamente testabile: funzioni pure + replay del log episodico.
- Zero impatto su `JourneyComposer` e UI esistenti.

**Negative / Rischi**
- Dipende da `UserContext` — prerequisito reale, non cosmetico.
- Aggiunge superficie di persistenza da sincronizzare in futuro (SyncEngine).
- I parametri di decay e le soglie di confidence sono knob di prodotto: vanno tarati su dati reali, non stimati a tavolino.
- Dato sensibile per natura → consenso/erasure/export vanno nel design ora, non dopo.

---

## 10. Alternative considerate

- **A. Batch recompute notturno sul DB** — Rifiutata: non reattiva, non offline-first, non testabile per-evento.
- **B. Salvare memorie in linguaggio naturale, letta poi dall'AI** — Rifiutata: viola il vincolo #4, non deterministica, non interrogabile numericamente, costosa a runtime.
- **C. DNA dentro `PlaceMemories` / scoped al trip** — Rifiutata: il DNA è cross-trip e user-level; nel trip resta la memoria episodica dichiarata (diario).
- **D. Il `MemoryEngine` emette anche le primitive comportamentali** — Rifiutata: accoppierebbe il motore allo stato della timeline (§4).

---

## 11. Rollout proposto (fasato — la cattura parte per prima)

- **Fase 0 — Solo cattura**: `SignalExtractor` + `appendEpisodic` + aggregati. Nessun profilo esposto, nessuna UI. Riempie il serbatoio mentre il resto della roadmap procede — è l'unica parte che ha senso avviare subito, per la ragione di data-gravity (non si può creare retroattivamente la storia di un viaggiatore).
- **Fase 1 — TasteProfile** derivato + slice nel Context Engine.
- **Fase 2 — ProceduralProfile** + evento `TravelerInsightDetected`.
- **Fase 3 — Consumo**: il Composer legge il DNA come segnale opzionale; un `TasteProfileNarrator` + AI Concierge lo verbalizzano.

---

## 12. Prerequisiti da altri ADR / debito tecnico

Questo ADR **non è eseguibile in isolamento**. Dipende da:
- Introduzione di `UserContext` (rimozione di `default-user` hardcoded) — senza risoluzione `tripId → userId`, il DNA non ha un soggetto a cui attaccarsi (§7).
- Nessuna dipendenza da refactoring di `JourneyComposer`: per design, questo ADR è ortogonale a quel lavoro e non lo richiede né lo blocca.
