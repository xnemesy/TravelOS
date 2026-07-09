# ADR-017: Unificazione del Modello di Dominio Place

**Stato**: Proposta — decisione architetturale, nessuna implementazione
**Data**: Luglio 2026
**Autori**: Rocco (owner) + Claude (Principal Software Architect, analisi ed estrazione)
**Riferimenti**: [DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md), [KNOWN_DEBT.md](../context/KNOWN_DEBT.md), [CURRENT_ROADMAP.md](../context/CURRENT_ROADMAP.md), [ARCHITECTURE.md](../architecture/ARCHITECTURE.md)

---

## 0. Premessa — la pipeline proposta in `CURRENT_ROADMAP.md` va corretta

Il lavoro pianificato indica come ipotesi di partenza:

```
Provider → Canonical Place → JourneyPlace → PlaceRef
```

L'analisi diretta del codice (non della documentazione) mostra che questa ipotesi contiene due errori fattuali che, se accettati senza verifica, produrrebbero un'ADR tecnicamente scorretta:

1. **`JourneyPlace` non è una tappa della pipeline: è codice morto.** `mapPlaceToJourneyPlace()` ([PlaceToJourneyPlace.ts](../../src/core/engines/mappers/PlaceToJourneyPlace.ts)) non ha **nessun chiamante** in tutto il repository. Il tipo `JourneyPlace` ([JourneyPlace.ts](../../src/core/engines/models/JourneyPlace.ts)) non è importato da nessun file oltre alla propria definizione e al mapper stesso. `JourneyComposer` e `TimelineRuleEngine` — i due componenti per cui `JourneyPlace` dichiara di esistere ("ottimizzato per l'engine del Composer") — operano **esclusivamente** su `PlaceRef`, mai su `JourneyPlace`. Includerlo come tappa obbligatoria della pipeline significherebbe formalizzare in un'ADR una tappa che oggi non ha alcun consumer reale — esattamente il tipo di debito speculativo che questo documento ha il mandato di eliminare, non di certificare.

2. **"Provider" non è una sorgente singola: sono due sorgenti indipendenti, mai riconciliate.** Esistono oggi due percorsi paralleli e non coordinati per ottenere dati di un luogo dall'esterno:
   - `TravelServices.places()` (SIP) → sempre `RealPlacesAdapter` (dataset curato offline) → tipo `PlaceMetadata`. `registerRealAdapters()` esiste ma **non viene mai chiamato per il dominio Places** — il backend reale non è collegato a questo percorso, nonostante `DATA_FLOW.md` lo lasci intendere.
   - `placeRepository` (singleton esportato da `TravelServices.ts`, commentato nel codice come *"Nuovo entry point architetturale per i luoghi (Sprint 12)"*) → `TravelBackendRepository` o `MockPlaceRepository` in base a `EXPO_PUBLIC_USE_REAL_PLACES` → tipo `Place` (`core/domain`). Questo è l'**unico** punto in cui l'app parla realmente con il backend Cloud Run per la ricerca luoghi, ed è raggiunto da un solo file: [`app/trip/[id]/places/[placeId].tsx`](../../app/trip/%5Bid%5D/places/%5BplaceId%5D.tsx), come fallback esplicitamente commentato *"bypass della regola solo-hook"*.

   Questi due percorsi hanno **contratti di campo incompatibili** (`lat`/`lon` vs `coordinates.{latitude,longitude}`, `placeId` vs `providerPlaceId`, `category: string` vs `categories: PlaceCategory[]`, `openingHours: string` vs `string[]`) e nessuno dei due sa dell'esistenza dell'altro. "Provider" nella pipeline proposta è quindi già, oggi, un problema di frammentazione — non un punto di partenza pulito.

La sequenza corretta da decidere in questa ADR non è dunque una correzione cosmetica dell'ipotesi iniziale: è un'unificazione a monte (un solo Provider Model) e una potatura a valle (nessuna tappa `JourneyPlace`), motivate dalle prove nel codice riportate in dettaglio alla sezione 2.

---

## 1. Problema

Il problema non è che esistono più rappresentazioni di "un luogo" — `DOMAIN_MODEL.md` lo dichiara già come trade-off deliberato, e per tre di queste rappresentazioni (dato di provider, entità di dominio arricchita, proiezione di pianificazione) il trade-off è legittimo: ogni confine architetturale ha esigenze realmente diverse.

Il problema reale è che **queste rappresentazioni non hanno mai avuto una pipeline dichiarata**. In assenza di una pipeline con frecce esplicite e un mapper per freccia, ogni punto di contatto tra due rappresentazioni è stato risolto localmente, nel punto in cui il bisogno si è presentato:

- La UI costruisce `PlaceRef` a mano, con object literal inline, in almeno quattro punti distinti (`places/index.tsx` due volte, `itinerary.tsx`, e implicitamente `[placeId].tsx`), ogni volta con un set leggermente diverso di campi copiati da sorgenti diverse (`EditorialPlaceItem`, `PlaceMetadata`, un `PlaceRef` preesistente).
- Un motore di dominio (`PlacesEngine`) accetta come proprio contratto di scrittura (`savePlace(tripId, place: PlaceRef)`) esattamente il tipo che dovrebbe essere un'proiezione derivata a valle, non un input.
- Lo stesso oggetto `PlaceRef` viene sia **persistito come record di libreria** (identità, nome, categoria, indirizzo: dati che non cambiano da un giorno all'altro) sia usato come **stato di pianificazione effimero** (`scheduledTime`, `calculatedStartTime`, `isLocked`, `decision`: dati che hanno senso solo nel contesto di una specifica composizione di giornata). Un solo tipo con due responsabilità di ciclo di vita incompatibili.
- Un secondo percorso di accesso ai dati esterni (`placeRepository`) è stato introdotto in un secondo momento ("Sprint 12") senza essere riconciliato con il primo, ed è oggi raggiunto solo come bypass di emergenza in un punto della UI — la causa diretta, verificata dal compilatore, di 24 dei 26 errori TypeScript odierni.

La conseguenza di dominio, non di tipo: **oggi non esiste un solo posto nel codice a cui chiedere "cos'è, davvero, questo luogo?"**. La risposta dipende da quale schermo, quale hook, quale motore lo sta osservando in quel momento — e nessuna delle risposte concorda sui campi con le altre. Questo è precisamente ciò che rende fragile ogni nuovo motore che deve leggere lo stato di un luogo (Traveler DNA, un futuro Budget Engine, un futuro Sync Engine): non hanno una sorgente di verità a cui abbonarsi.

---

## 2. Analisi

Mappa completa, verificata nel codice il 2026-07-08, di tutte le rappresentazioni di "luogo" oggi esistenti. Non sono quattro: sono sei rappresentazioni distinte più due paia di alias duplicati interni a una di esse.

### 2.1 `Place` — backend ([`backend/src/models/Place.ts`](../../backend/src/models/Place.ts))

- **Responsabilità**: contratto interno del servizio Fastify — la forma in cui `GooglePlacesProvider.mapGooglePlaceToDomain()` normalizza la risposta grezza dell'API Google Places prima di esporla via HTTP.
- **Owner**: backend (`PlacesService`/`PlacesController`), deploy separato su Cloud Run.
- **Ciclo di vita**: costruito ad ogni richiesta HTTP in entrata (`/places/search`, `/places/:id/details`), mai persistito (backend stateless, nessun DB).
- **Creato in**: [`GooglePlacesProvider.ts:106`](../../backend/src/providers/google/GooglePlacesProvider.ts) (`mapGooglePlaceToDomain`).
- **Consumato da**: serializzato direttamente come corpo della risposta HTTP (`PlacesController` ritorna l'oggetto senza ulteriore mapping — verificato: nessuna trasformazione tra `PlacesService` e `reply.send`).

### 2.2 `Place` — frontend, `core/domain` ([`src/core/domain/models/Place.ts`](../../src/core/domain/models/Place.ts))

- **Responsabilità dichiarata**: "modello universale" lato app. **Responsabilità reale verificata**: duplicato quasi campo-per-campo dello schema Zod backend (stesso nome dei campi, stessa struttura), usato per validare (`PlaceSchema.parse`) la risposta HTTP di `/places/search` e `/places/:id/details`.
- **Owner**: `src/core/domain/` — albero esplicitamente segnalato in `ARCHITECTURE.md` come "più vecchio, in gran parte superato".
- **Ciclo di vita**: costruito da `TravelBackendService.searchPlaces/autocomplete/getPlaceDetails` ([`TravelBackendService.ts`](../../src/core/infrastructure/services/TravelBackendService.ts)) ad ogni chiamata HTTP riuscita; mai persistito.
- **Creato in**: `TravelBackendService.ts:43,55` (`PlaceSchema.parse(sanitizePlace(item))`).
- **Consumato da**: `TravelBackendRepository`/`MockPlaceRepository` (implementazioni di `PlaceRepository`, [`core/domain/repositories/PlaceRepository.ts`](../../src/core/domain/repositories/PlaceRepository.ts)) → il singleton `placeRepository` esportato da `TravelServices.ts:34` → **un solo punto di consumo reale**: `app/trip/[id]/places/[placeId].tsx:79`, come fallback quando il luogo non è tra quelli già salvati in `PlacesEngine`. Questo singolo punto di contatto, dove un `Place` viene trattato come se fosse un `PlaceRef` senza mapper, produce 24 dei 26 errori `tsc` odierni (proprietà mancanti: `category`, `isVisited`, `notes`, `coverImageUrl`, `durationMinutes`, `address`).

### 2.3 `PlaceMetadata` ([`src/domain/providers/travel-providers.types.ts:88`](../../src/domain/providers/travel-providers.types.ts))

- **Responsabilità reale**: il vero DTO "provider" lato app in uso attivo — la forma con cui il SIP (`TravelServices`) espone i risultati di ricerca/dettaglio luogo, indipendentemente dalla fonte (dataset curato offline oggi, un futuro adapter Google/Apple reale domani).
- **Owner**: `src/domain/providers/` (SIP).
- **Ciclo di vita**: costruito da `RealPlacesAdapter` (dataset statico curato, [`real-places.adapter.ts`](../../src/core/infrastructure/repositories/real-places.adapter.ts)) o dal catalogo mock (`mock-travel.providers.ts`); mai persistito direttamente — cache TTL 7 giorni via `CachedProvider` all'interno del SIP.
- **Creato in**: `real-places.adapter.ts` (dataset hardcoded), `mock-travel.providers.ts`.
- **Consumato da**: `TravelServices.places().searchPlaces()`/`searchNearby()`/`getCuratedCatalog()`, chiamato da `app/trip/[id]/places/index.tsx` (`handleExternalSearch`) — il cui risultato viene poi copiato a mano, campo per campo, in un `PlaceRef` costruito inline (§2.5).

### 2.4 `TravelPlace` (+ tre sotto-schemi) ([`src/domain/trip/models/place.model.ts`](../../src/domain/trip/models/place.model.ts))

- **Responsabilità dichiarata e reale**: l'unico modello che rappresenta correttamente "un luogo" come concetto di dominio ricco — tre livelli espliciti, ciascuno con owner e regole di scrittura diverse:
  - **`ExternalPlaceSchema`** (righe 24-49): dato di sola lettura da provider, sostituibile ad ogni sync.
  - **`EditorialPlaceSchema`** (righe 52-62): contenuto curato da Travel OS, indipendente dal provider.
  - **`PlaceMemoriesSchema`** (righe 65-77): diario personale del viaggiatore.
  - `PlaceMergeEngine` ([`PlaceMergeEngine.ts`](../../src/domain/trip/engine/PlaceMergeEngine.ts)) garantisce strutturalmente che un aggiornamento provider tocchi **solo** il livello External, preservando Editorial/Personal — questa è, ad oggi, l'unica vera garanzia architetturale a tre livelli presente nel codebase.
  - **Debito interno verificato**: lo schema stesso duplica due dei tre livelli con alias espliciti mai risolti — `baseData`/`external` (riga 92-93, stesso `ExternalPlaceSchema`, commento "Alias esplicito per 3-layer architecture") e `memories`/`personal` (riga 100-101, stesso `PlaceMemoriesSchema`, stesso commento). Non è un problema TypeScript: è un modello che non si è mai deciso quale nome sia quello canonico.
- **Owner**: `src/domain/trip/` (percorso di pianificazione legacy).
- **Ciclo di vita**: costruito da `InMemoryPlaceRepository`/`PlannerEngine`, mai persistito su MMKV in modo reale (il percorso che lo alimenta è irraggiungibile da schermo).
- **Creato in**: `src/domain/trip/repositories/place.repository.ts` (mock in-memory).
- **Consumato da**: **9 file in tutto il repository**, tutti interni al percorso di pianificazione legacy (`PlannerEngine.ts`, `planner.types.ts`, `place.store.ts`, `planner.store.ts`) o codice morto già segnalato (`PlacesCarousel.tsx` in `trip-experience/`) o dati mock (`budapest.mock.ts`). **Zero file del percorso di pianificazione attivo (`TimelineEngine`, `JourneyComposer`, `PlacesEngine`, qualunque schermata reale) importano `TravelPlace`.**

### 2.5 `PlaceRef` ([`src/core/engines/types/context.types.ts:194`](../../src/core/engines/types/context.types.ts))

- **Responsabilità reale**: doppia, e questa duplicità è essa stessa parte del problema:
  1. **Proiezione di pianificazione** (uso legittimo): campi come `scheduledTime`, `calculatedStartTime`/`calculatedEndTime`, `isLocked`, `decision`, `warnings` hanno senso solo nel contesto di una specifica composizione di giornata — questo è il ruolo per cui il tipo è nato ed è descritto in `DOMAIN_MODEL.md`.
  2. **Record di libreria persistito** (uso non dichiarato, ma reale): `PlacesEngine.savedPlacesMap` ([`places.engine.ts:21`](../../src/core/engines/places/places.engine.ts)) persiste `PlaceRef[]` su MMKV sotto `places_${tripId}` come **collezione permanente dei luoghi salvati dell'utente** — cioè esattamente il ruolo che dovrebbe appartenere a un'entità di dominio persistita e validata (Zod), non a una proiezione plain-TS ricalcolata.
- **Owner**: nessuno strutturalmente — costruito ad-hoc ovunque serva.
- **Ciclo di vita**: persistito (MMKV, `places_${tripId}` e `timeline_${tripId}`) **e** ricreato ex-novo ad ogni salvataggio UI. Non esiste un solo punto di costruzione: è costruito per literal object in almeno 5 punti verificati:
  - [`places/index.tsx:228`](../../app/trip/%5Bid%5D/places/index.tsx) (`handleAddPlace`, da `EditorialPlaceItem.baseData`)
  - [`places/index.tsx:302`](../../app/trip/%5Bid%5D/places/index.tsx) (da `PlaceMetadata` via ricerca live, o da un `PlaceRef` preesistente se già salvato)
  - [`places.engine.ts:67`](../../src/core/engines/places/places.engine.ts) (merge conservativo interno)
  - [`JourneyComposer.ts:98,108,187`](../../src/domain/services/JourneyComposer.ts) (blocchi sintetici: hotel, pasti)
  - [`SmartSlotFillingModal.tsx:69`](../../src/features/itinerary/components/SmartSlotFillingModal.tsx)
- **Consumato da**: `TimelineEngine`, `JourneyComposer`, `TimelineRuleEngine` (le 6 regole), tutti gli hook del View Layer (`usePlaces`, `useNextPlace`, `useTravelActions`), tutte le schermate reali. **23 file** in tutto — è, di fatto, la valuta dominante del sistema oggi, nonostante non abbia mai ricevuto lo status di modello canonico.

### 2.6 `JourneyPlace` ([`src/core/engines/models/JourneyPlace.ts`](../../src/core/engines/models/JourneyPlace.ts)) — codice morto confermato

- **Responsabilità dichiarata**: proiezione snella di `Place` per "algoritmi di routing/ottimizzazione".
- **Verificato**: **zero import** in tutto il repository oltre alla propria definizione e a `mapPlaceToJourneyPlace()` ([`PlaceToJourneyPlace.ts`](../../src/core/engines/mappers/PlaceToJourneyPlace.ts)), che a sua volta ha **zero chiamanti**. `JourneyComposer`/`TimelineRuleEngine` — i presunti consumer — non lo referenziano mai, operano su `PlaceRef`.

### 2.7 Una settima superficie non contata nell'ipotesi iniziale: `EditorialPlaceItem.baseData`

`EditorialPlaceItem` ([`editorial-places.catalog.ts:38-46`](../../src/features/places/catalog/editorial-places.catalog.ts)) riusa `ExternalPlace` (lo stesso tipo del livello 1 di `TravelPlace`) come proprio campo `baseData`, ma **fuori** dal grafo di `TravelPlace` — il catalogo editoriale non produce mai un `TravelPlace` completo, produce un oggetto ibrido (`ExternalPlace` + metadati di collezione) che la UI poi smonta a mano in un `PlaceRef` (§2.5, primo punto). È una terza fonte di dati "provider-shaped" mai riconciliata con le altre due (§2.2, §2.3).

### 2.8 Riconciliazioni parziali già tentate — da correggere, non da ignorare

Il codice mostra almeno tre tentativi indipendenti, non coordinati tra loro, di colmare esattamente il divario che questa ADR formalizza — prova diretta che il bisogno è già stato percepito localmente più volte senza mai diventare una decisione:

- **`PlaceMergeEngine.mergePlace()`** ([`PlaceMergeEngine.ts:134-193`](../../src/domain/trip/engine/PlaceMergeEngine.ts)) esiste già e accetta un'unione `ExternalPlace | PlaceMetadata`, disambiguata a runtime con un type-guard (`'placeId' in providerData && !('providerId' in providerData)`, riga 135) seguito da nove cast `as PlaceMetadata` per leggere campi già noti dal guard. **Non va scritta da zero**: va standardizzata su un solo input (`PlaceMetadata`, eliminando il ramo `ExternalPlace` — superfluo una volta che il Provider Model è unico) e rinominata `mergeFromProvider` per riflettere il nuovo status di punto di ingresso canonico.
- **`mapPlaceToMetadata`** ([`TravelServices.ts:179-202`](../../src/domain/providers/TravelServices.ts), parametro tipizzato `p: any`) converte già oggi `Place` (`core/domain`) in `PlaceMetadata` per uso interno al SIP — la prova che anche dentro `TravelServices.ts` qualcuno ha già riconosciuto `PlaceMetadata` come la forma di destinazione corretta. Diventa superfluo quando `Place` (`core/domain`) viene ritirato (§3.5).
- **`TravelServices.editorial().getCuratedCatalog()`** ([`TravelServices.ts:254-303`](../../src/domain/providers/TravelServices.ts)) produce un **quarto** oggetto ad-hoc, non tipizzato (`Promise<any[]>`), con campi che assomigliano ma non coincidono con `PlaceRef` (es. `heroImage`, `source: {...}` assenti da `PlaceRef`) — un'ulteriore superficie di mapping informale da ricondurre alla pipeline dichiarata in §4, non un quarto percorso da mantenere.

### Tabella riassuntiva

| Tipo | File | Owner reale | Persistito? | # file consumer | Percorso |
|---|---|---|---|---|---|
| `Place` (backend) | `backend/src/models/Place.ts` | Backend | No (stateless) | 1 (serializzazione HTTP) | — |
| `Place` (frontend) | `src/core/domain/models/Place.ts` | `core/domain` (superato) | No | 1 (`[placeId].tsx` bypass) | Morto in pratica, causa 24/26 errori tsc |
| `PlaceMetadata` | `src/domain/providers/travel-providers.types.ts` | SIP | Cache TTL, non persistito | 2 | Attivo, ma isolato dal backend reale |
| `TravelPlace` (+3 layer) | `src/domain/trip/models/place.model.ts` | `domain/trip` (legacy) | Mai (percorso morto) | 9 | Morto (irraggiungibile da UI) |
| `PlaceRef` | `src/core/engines/types/context.types.ts` | Nessuno (ad-hoc) | Sì (MMKV, doppio ruolo) | 23 | **Attivo, dominante, doppia responsabilità** |
| `JourneyPlace` | `src/core/engines/models/JourneyPlace.ts` | Nessuno | No | 0 | **Morto, mai stato vivo** |
| `EditorialPlaceItem.baseData` | `src/features/places/catalog/editorial-places.catalog.ts` | `features/places` | No (dati statici) | 1 | Fonte provider-shaped isolata |

---

## 3. Decisione

Il modello definitivo è a **tre stadi**, non quattro. `TravelPlace` viene **eletto a Canonical Place** (non deprecato): è l'unica rappresentazione oggi esistente con una vera separazione di responsabilità a tre livelli e garanzie strutturali (`PlaceMergeEngine`). `JourneyPlace` viene **eliminato**, non deprecato silenziosamente: è debito morto, la sua rimozione è a rischio zero (zero consumer verificati) e la sua permanenza come tappa "ufficiale" della pipeline istituzionalizzerebbe uno stadio fantasma.

### 3.1 Provider Model — `PlaceMetadata`

- **Responsabilità**: rappresentazione grezza, di sola lettura, di un risultato riportato da un fornitore esterno specifico (oggi: dataset curato; domani: Google Places reale, Apple Maps, OSM). Non contiene alcun concetto specifico di Travel OS (nessun `priority`, `role`, `isFavorite`, `personalRating`).
- **Proprietà consentite**: esattamente quelle già definite in `PlaceMetadata` (`travel-providers.types.ts:88-107`) — identità del provider, geolocalizzazione, contatti, rating aggregato, orari come stringa libera, `matchScore`.
- **Proprietà vietate**: qualunque campo di pianificazione (`scheduledTime`, `isLocked`, `role`), qualunque campo editoriale/curato (`whyVisit`, `goldenHourTip`), qualunque campo personale (`personalRating`, `diaryEntry`).
- **Chi può crearlo**: esclusivamente le implementazioni di `PlacesProviderAdapter` dentro `src/domain/providers/` (oggi `RealPlacesAdapter`; in futuro un vero `GooglePlacesAdapter` registrato via `travelServices.registerRealAdapters()`).
- **Chi può modificarlo**: nessuno — è un value object immutabile, sostituito integralmente ad ogni fetch, mai patchato.
- **Chi può leggerlo**: esclusivamente il mapper `providerToCanonicalPlace` (§4). **Nessun componente UI, hook o Engine può importare `PlaceMetadata` al di fuori del SIP e di questo mapper** — oggi `places/index.tsx` lo importa direttamente in uno stato React (`externalResults: PlaceMetadata[]`), violazione da correggere nella migrazione.

### 3.2 Canonical Place — `TravelPlace` (rivisto)

- **Responsabilità**: l'unica entità di dominio persistita, validata (Zod), che rappresenta "questo luogo, per questo trip, con tutto ciò che Travel OS sa di lui" — dato provider, contenuto curato, memoria personale, sempre distinti ma sempre uniti sotto un solo `id`.
- **Correzione rispetto allo stato attuale — aggiornata durante l'implementazione di Fase 1 (Sprint 14)**: eliminare la coppia di alias duplicati. Un solo nome canonico per livello. **Nome scelto: `baseData` (non `external`) e `memories` (non `personal`)** — questa ADR originariamente proponeva il contrario (`external`/`personal`); la scelta è stata corretta durante l'implementazione dopo aver verificato l'uso reale in tutto il repository: `.baseData` è letto/scritto in 5 file, `.external` non è letto da nessuno; nessuno dei due nomi del secondo livello (`.memories`/`.personal`) è mai letto né scritto, ma `memories` corrisponde al nome del tipo (`PlaceMemoriesSchema`), più autodescrittivo. La decisione di fondo — un solo nome canonico, niente alias — non cambia; solo il nome specifico è stato rivisto sulla base di dati che questa ADR non aveva ancora raccolto al momento della stesura.
- **Rimozione fisica immediata, non differita**: la strategia originariamente pianificata per Fase 1 prevedeva una deprecazione in due passi (`@deprecated` prima, rimozione fisica in uno sprint successivo). Durante l'implementazione, una review indipendente ha verificato che questo approccio lascia una via di mezzo pericolosa: se `mergePlace` smette di sincronizzare `external` ma il campo resta nello schema, un ipotetico luogo con `external` già valorizzato da un percorso dimenticato finirebbe con `baseData` aggiornato ed `external` stantio, due fonti discordanti sullo stesso dato. Verificato (due volte, in due sessioni indipendenti) che zero file in tutto il repository leggono o scrivono `external`/`personal`: la rimozione fisica immediata non costa nulla in più della deprecazione, elimina la finestra di stato incoerente, e il compilatore protegge comunque da una reintroduzione accidentale (un errore di tipo, non solo un avviso IDE) più efficacemente di un semplice `@deprecated`. Vedi Piano di Migrazione, passo 1.
- **Proprietà consentite**: i tre livelli (`baseData: ExternalPlace`, `editorial?: EditorialPlace`, `memories?: PlaceMemories`), più metadati di identità/provenienza (`id`, `tripId`, `externalProviderId`, `source`), più i campi di pianificazione **dichiarativi** (non calcolati) che sopravvivono a una sessione di planning: `priority`, `status`, `assignedDay`. **Non** i campi calcolati a runtime (`calculatedStartTime`/`calculatedEndTime`, `distanceMeters`, `warnings`) — quelli appartengono solo a `PlaceRef`.
- **Proprietà vietate**: nessun campo che dipenda dal contesto di una specifica composizione di giornata (nessun `decision: JourneyDecision`, nessun `calculatedStartTime`).
- **Chi può crearlo**: esclusivamente `PlaceMergeEngine.mergeFromProvider(incoming: PlaceMetadata, options: { tripId: string; existing?: TravelPlace | null; editorial?: EditorialPlace }): TravelPlace` — punto di ingresso unico, sia per un nuovo salvataggio sia per un aggiornamento del livello External di un luogo già salvato. Nessun altro modulo costruisce un `TravelPlace` per object literal a partire da dati provider (verificato: l'unico altro punto di creazione di `TravelPlace` in tutto il repository è `budapest.mock.ts`, che costruisce dati mock statici scritti a mano, non trasformati da un vero payload provider — fuori scope, tracciato come debito noto). Questo metodo **non è nuovo nella sua metà "update"**: delega a `PlaceMergeEngine.mergePlace()` (già esistente, §2.8) quando `existing` è presente; la metà "create" (nessun luogo preesistente) è invece logica nuova, introdotta in Fase 1, perché prima non esisteva alcuna funzione per costruire un `TravelPlace` da zero a partire da dati provider.
- **Chi può modificarlo**:
  - Livello `baseData`: solo `PlaceMergeEngine.mergeFromProvider`, mai altrove.
  - Livello `editorial`: solo il processo di curazione del catalogo editoriale (oggi dati statici in `editorial-places.catalog.ts`; in futuro un eventuale strumento di content management) — mai un'azione utente a runtime.
  - Livello `memories`: solo azioni utente esplicite instradate attraverso `PlacesEngine` (diario, rating personale, check-in, preferiti) — mai un motore di pianificazione.
- **Chi può leggerlo**: `PlacesEngine` (proprietario della persistenza), il mapper `canonicalPlaceToPlaceRef` (§4), un futuro `MemoryEngine`/Traveler DNA in sola lettura. **La UI non legge mai `TravelPlace` direttamente** — nessuna schermata deve importare `place.model.ts`.

### 3.3 PlaceRef — Timeline/Planning Projection

- **Responsabilità**: unica — proiezione effimera, ricalcolata ad ogni lettura, di un `TravelPlace` decorato con lo stato di una specifica composizione di giornata. **Non è più, in nessuna circostanza, la fonte di verità per l'identità o la libreria di un luogo.**
- **Proprietà consentite**: sottoinsieme read-oriented di `TravelPlace` (id, name, category, coordinates, coverImageUrl, address, rating, priority — copiati dal livello External/Editorial al momento della proiezione) più i campi calcolati di pianificazione (`scheduledTime`, `calculatedStartTime`/`calculatedEndTime`, `isLocked`, `isBlock`, `decision`, `warnings`, `distanceMeters`, `estimatedWalkMinutes`).
- **Proprietà vietate**: nessun campo che richieda scrittura persistente indipendente da `TravelPlace` — se un valore deve sopravvivere oltre la sessione di composizione corrente, appartiene a `TravelPlace`, non a `PlaceRef`.
- **Chi può crearlo**: esclusivamente il mapper `canonicalPlaceToPlaceRef(place: TravelPlace, schedulingContext?) => PlaceRef` (§4), invocato da `TimelineEngine`/`JourneyComposer` al momento della lettura o della composizione — mai da una schermata, mai da un modal.
- **Chi può modificarlo**: nessuno, dopo la creazione, nel senso di persistenza — è un value object di sola lettura per il chiamante. Una modifica logica (es. l'utente blocca un luogo con drag&drop) si traduce in una scrittura sul `TimelineSlot` sottostante (§4), non in una mutazione dell'oggetto `PlaceRef` in memoria.
- **Chi può leggerlo**: qualunque componente UI, tramite gli hook del View Layer (`usePlaces`, `useNextPlace`, `useTimeline`) — questo resta, come oggi, l'unico tipo che la UI conosce per la pianificazione.

### 3.4 `JourneyPlace` — rimosso

Nessuna responsabilità: il tipo e il suo mapper vengono eliminati. Se in futuro un vero algoritmo di routing globale (non il greedy locale odierno) avrà bisogno di una proiezione più snella di `PlaceRef` per motivi di performance, quella proiezione va derivata puntualmente al suo interno con una funzione locale, non reintrodotta come quinta rappresentazione di dominio permanente.

### 3.5 `Place` (backend), `Place` (frontend `core/domain`), `EditorialPlaceItem.baseData`

Tutte e tre confluiscono nel Provider Model. In particolare:
- `Place` (frontend, `core/domain`) e l'intera catena che lo produce (`PlaceRepository`, `TravelBackendRepository`, `MockPlaceRepository`, `TravelBackendService`, il singleton `placeRepository`) vengono **ritirati**. La loro unica funzione reale — parlare con il backend Cloud Run — viene assorbita da un nuovo, unico adapter reale (`GooglePlacesAdapter implements PlacesProviderAdapter`) che produce `PlaceMetadata`, registrato nel SIP esistente.
- Il contratto HTTP del backend (`Place` lato backend) deve essere normalizzato per emettere direttamente la forma `PlaceMetadata` (o un adapter di traduzione esplicito lato SIP) — decisione di interfaccia, non di dominio, demandata all'implementazione.
- `EditorialPlaceItem.baseData` smette di essere smontato a mano in UI: il catalogo editoriale diventa un secondo produttore legittimo di `TravelPlace` (con livello Editorial pre-popolato), tramite lo stesso `PlaceMergeEngine`, non un percorso parallelo verso `PlaceRef`.

### 3.6 Architectural Invariants — tabella di sintesi

Le proprietà consentite/vietate di §3.1-§3.4 sono la fonte di verità; questa tabella è la loro sintesi a colpo d'occhio, da consultare prima di aggiungere codice che tocca uno di questi tipi — se una riga di codice contraddice una cella qui sotto, è la riga di codice ad essere sbagliata, non la tabella.

| Tipo | Mutabile | Persistito | Consumer legittimo |
|---|---|---|---|
| **Provider** (payload grezzo del fornitore esterno) | No | No | Solo `PlacesProviderAdapter` (`RealPlacesAdapter` oggi, `GooglePlacesAdapter` da collegare) |
| **`PlaceMetadata`** | No — value object, sostituito integralmente ad ogni fetch, mai patchato | No — cache TTL 7gg nel SIP, mai fonte di verità | Solo `PlaceMergeEngine.mergeFromProvider` |
| **`TravelPlace`** | Sì — `baseData` da `mergeFromProvider`, `editorial` da curazione, `memories` da azione utente, mai da un motore di pianificazione (§5.6, §5.7) | Sì — MMKV, unica fonte di verità sull'identità del luogo | `PlacesEngine` (owner); in sola lettura: `canonicalPlaceToPlaceRef`, Memory Engine/Traveler DNA (futuro), AI Concierge (futuro) |
| **`PlaceRef`** | No — proiezione pura, mai mutata dopo la creazione (una scrittura utente torna sempre a `TravelPlace`/`TimelineSlot`, mai al `PlaceRef` in memoria) | No — mai l'oggetto intero; `TimelineEngine` persiste solo `TimelineSlot` leggero | `TimelineEngine`, `JourneyComposer`/Rule Engine, View Layer Hooks (Timeline/UI) |

Nota di lettura: `JourneyPlace` non ha una riga perché non sopravvive alla decisione (§3.4) — una tabella di invarianti per un tipo rimosso non avrebbe senso da mantenere.

---

## 4. Pipeline

Le tre tappe di trasformazione (Provider → Canonical → PlaceRef), più il ventaglio di consumer a valle di `TravelPlace` già descritto a parole in §8 — qui reso esplicito come grafo, perché è il punto che un futuro team deve poter vedere in un colpo d'occhio senza ricostruirlo dalla prosa:

```
                          Google Places API (oggi) / Apple Maps, OSM (domani)
                                          │
                                          ▼
                          PlacesProviderAdapter (SIP, src/domain/providers/)
                          RealPlacesAdapter (oggi) → GooglePlacesAdapter (da collegare)
                                          │
                                          ▼
        EditorialPlaceItem ────────►  PlaceMetadata  ◄──── Provider Model, UNICO
   (catalogo curato, statico,             │                (sostituisce Place+PlaceMetadata duplicati, §3.5)
    livello Editorial pre-popolato)       │
                                          ▼
                          PlaceMergeEngine.mergeFromProvider()
                          tocca SOLO il livello `baseData` — Editorial/Personal preservati
                                          │
                                          ▼
        ┌─────────────────────────────────────────────────────────────┐
        │                          TravelPlace                          │
        │                 Canonical Place — persistito (MMKV), Zod        │
        │                                                                 │
        │   baseData          editorial            memories                │
        │  (dato provider)   (curato, statico)    (diario, rating utente)   │
        └───────────┬─────────────────────────────────────┬───────────────┘
                    │                                       │
                    │ canonicalPlaceToPlaceRef()             │  lettura diretta,
                    │ proiezione, sola lettura,               │  sola lettura,
                    │ mai scrittura all'indietro              │  MAI pianificazione
                    ▼                                       │
              ┌───────────┐                                 │
              │  PlaceRef   │                                 │
              │ (proiezione │                                 │
              │  effimera)  │                                 │
              └─────┬─────┘                                 │
                    │                                       ├──────────────► Memory Engine /
        ┌───────────┼────────────┐                          │                Traveler DNA (ADR-014, futuro)
        ▼           ▼             ▼                          │
 TimelineEngine  JourneyComposer  View Layer Hooks            └──────────────► AI Concierge (futuro)
  (+ TimelineSlot) (+ Rule Engine) (usePlaces, useTimeline,
        │              │            useNextPlace...)
        └──────┬───────┴────────────────┘
               ▼
        Context Engine (recompose)
               │
               ▼
          UI / Screens
```

**Perché il ramo verso Memory Engine/AI Concierge parte da `TravelPlace` e non da `PlaceRef`**: sono consumer di osservazione cross-trip, non di pianificazione — hanno bisogno del dato dichiarato/curato/personale così com'è persistito, non di una proiezione decorata con stato di scheduling effimero che cambierebbe ad ogni ricomposizione della giornata. Leggerlo da `PlaceRef` li accoppierebbe implicitamente al percorso di pianificazione attivo, violando la regola §5.2 nella direzione opposta.

**Perché `JourneyComposer` e `Context Engine` non compaiono come rami diretti di `TravelPlace`**: è la regola §5.2 applicata alla lettera — nessun motore di pianificazione o UI legge Canonical Place direttamente, solo `PlaceRef`. Questo è anche il punto in cui questo diagramma corregge un errore facile da fare leggendo solo la sezione 8 in prosa: non è "`TravelPlace` alimenta tutto", è "`TravelPlace` alimenta `PlaceRef`, e *anche*, in parallelo e in sola lettura, i consumer cross-trip che non fanno pianificazione".

Nota sul verso inverso — l'unico consentito: quando l'utente scrive qualcosa che deve sopravvivere (nota, rating personale, check-in, blocco manuale con drag&drop), la scrittura **non modifica il `PlaceRef` in memoria**: invoca un comando su `PlacesEngine` (per il livello Personal di `TravelPlace`) o su `TimelineEngine` (per un `TimelineSlot` — id, giorno, ordine, lock — non un `PlaceRef` completo). Alla lettura successiva, `canonicalPlaceToPlaceRef` produce un `PlaceRef` aggiornato che riflette la scrittura. Non esiste mai un mapper che vada da `PlaceRef` a `TravelPlace`, né da `PlaceRef` a `Memory Engine`/`AI Concierge` — quei due leggono solo `TravelPlace`.

---

## 5. Regole Architetturali

Non negoziabili, in aggiunta agli esempi già forniti nel mandato:

1. **Un solo punto di creazione per tipo.** `TravelPlace` si crea solo in `PlaceMergeEngine.mergeFromProvider`. `PlaceRef` si crea solo in `canonicalPlaceToPlaceRef`. Nessun object literal `{ id, name, category, ... }` tipizzato `PlaceRef` o `TravelPlace` è ammesso fuori da quei due moduli — questo è precisamente il pattern che ha causato la frammentazione odierna (§2.5).
2. **Nessuna UI può importare `TravelPlace` o `PlaceMetadata`.** La UI conosce solo `PlaceRef`, ottenuto tramite hook. Se una schermata ha bisogno di un dato del livello Editorial o Personal, quel dato deve essere aggiunto alla proiezione `PlaceRef` dal mapper — non letto aggirando la proiezione.
3. **Conversioni solo in avanti.** Provider → Canonical → PlaceRef è l'unica direzione di mapping automatico. Ogni scrittura utente torna alla fonte (Canonical Place o TimelineSlot) tramite un comando esplicito, mai tramite una mutazione del `PlaceRef` seguita da un'ipotetica ri-sincronizzazione.
4. **`PlaceRef` non può essere persistito come collezione di libreria.** `PlacesEngine` persiste `TravelPlace[]`, non `PlaceRef[]`. Se una funzione ha bisogno di iterare "i luoghi salvati", deve chiamare `getSavedPlaces(): Promise<TravelPlace[]>` e proiettare solo dove serve la vista di pianificazione.
5. **`TimelineEngine` non persiste `PlaceRef` interi.** Persiste `TimelineSlot { placeId, dayNumber, order, isLocked, scheduledTime? }` — un riferimento leggero, non uno snapshot completo del luogo. Lo snapshot si ricalcola sempre dalla Canonical Place al momento della lettura.
6. **Il livello Editorial di `TravelPlace` non è mai scritto da un'azione utente runtime.** Solo da un processo di curazione dei contenuti, oggi rappresentato dal catalogo statico.
7. **Il livello Personal di `TravelPlace` non è mai scritto da un motore di pianificazione.** Solo da un comando esplicito dell'utente instradato tramite `PlacesEngine`.
8. **Nessun mapper fuori dal proprio layer dedicato.** `providerToCanonicalPlace` vive in `src/domain/trip/engine/`; `canonicalPlaceToPlaceRef` vive in `src/core/engines/mappers/`. Nessun hook, nessuna schermata, nessun modal implementa una propria versione locale di uno di questi due mapping — la ricorrenza di questo pattern è la causa diretta del problema descritto in §1.
9. **`JourneyPlace` non va reintrodotto come tipo di dominio permanente.** Un futuro bisogno di una proiezione più snella per un algoritmo di routing va risolto con una funzione locale a quell'algoritmo, non con un quarto tipo condiviso.
10. **Un solo Provider Model per l'intera app.** Non è ammesso un secondo adapter/repository che parli con una fonte esterna di luoghi restituendo una forma diversa da `PlaceMetadata` — la ricorrenza di questo pattern (`placeRepository` introdotto senza riconciliare `TravelServices.places()`) è la causa diretta dei 24 errori `tsc` odierni.

---

## 6. Piano di Migrazione

Ordinato per mantenere il progetto compilabile ad ogni passo. Ogni voce è una modifica di modello o di collegamento, non un'implementazione — l'ordine stesso è la parte architetturalmente rilevante di questa sezione.

| # | File | Modifica | Rischio | Dipendenze |
|---|---|---|---|---|
| 1 | `src/domain/trip/models/place.model.ts` | ✅ **Fatto (Sprint 14, Fase 1)** — `external`/`personal` rimossi fisicamente dallo schema (non solo deprecati, vedi §3.2); `baseData`/`memories` confermati canonici (nomi corretti rispetto alla proposta iniziale di questa ADR) | Basso — tipo isolato, nessun consumer attivo lo usa oggi, verificato due volte | Nessuna |
| 2 | `src/domain/trip/engine/PlaceMergeEngine.ts` | 🟡 **Parzialmente fatto (Sprint 14, Fase 1)**, esteso in Fase 2 — aggiunto `mergeFromProvider` come nuovo metodo, senza rimuovere il ramo union `ExternalPlace`/i cast/il type-guard di `mergePlace`: quel refactor avrebbe richiesto toccare il suo unico chiamante (`place.repository.ts`, percorso legacy), fuori scope per una fase esplicitamente vincolata a "nessun cambiamento funzionale". `mergeFromProvider` delega a `mergePlace` invariato quando `existing` è presente; la normalizzazione `PlaceMetadata→ExternalPlace` è stata estratta in un metodo privato condiviso (`externalFromMetadata`) per evitare una nuova duplicazione. La union/i cast restano per una fase successiva, quando si deciderà se migrare anche `place.repository.ts` o eliminarlo (piano di migrazione, passi #13). Aggiunta copertura test per `mergePlace` (assente) e `mergeFromProvider` (nuovo) — `isSamePlace`/`calculateDistanceMeters`/`calculateNameSimilarity` invariate. **Fase 2 (2026-07-09)**: il ramo "create" di `mergeFromProvider` (assenza di `existing`) accetta ora anche `ExternalPlace` oltre a `PlaceMetadata` (stesso type-guard già usato da `mergePlace`) — chiude il limite noto documentato in Fase 2 iniziale, per permettere a `EditorialPlaceItem.baseData` di attraversare la pipeline senza un adattatore separato. Non è un'estensione di scope: era già anticipato da questa stessa ADR (§3.5) come "secondo produttore legittimo... tramite lo stesso `PlaceMergeEngine`". | Medio — è il cuore della nuova pipeline, ora coperto da test | #1 |
| 3 | `src/core/engines/mappers/CanonicalPlaceToPlaceRef.ts` (nuovo) | Creare `canonicalPlaceToPlaceRef(place, ctx?)`, unica factory di `PlaceRef` | Basso — modulo nuovo, non ancora collegato | #1 |
| 4 | `src/domain/providers/` | Introdurre un adapter reale `PlacesProviderAdapter` (es. `GooglePlacesAdapter`) che parla col backend Cloud Run e produce `PlaceMetadata`; registrarlo con `travelServices.registerRealAdapters({ places: ... })` | Medio — tocca la copertura reale del SIP, oggi mai attivata per Places | Nessuna (parallelo a #1-3) |
| 5 | `app/trip/[id]/places/[placeId].tsx` | ✅ **Fatto (Sprint 14, Fase 2)** — rimosso il fallback `placeRepository.getPlaceDetails()`. **Correzione rispetto al testo originale di questa riga**: lo stato vuoto "sostituisce il fallback" solo per luoghi genuinamente inesistenti — verificato in review indipendente che almeno due percorsi UI reali (`places/index.tsx`: catalogo editoriale, ricerca live) aprono questo schermo con un luogo *non ancora salvato ma reale*, non un caso raro. Introdotto `usePlaceDetails` (hook, `src/shared/hooks/`) come unico punto della pipeline transiente Provider/Editorial → `mergeFromProvider` → `canonicalPlaceToPlaceRef` → `PlaceRef` **mai persistito**, dietro cui lo schermo continua a leggere solo `PlaceRef` (nessun import `PlaceMetadata`/`TravelPlace`/`ExternalPlace` in UI, ADR-017 §5 regola 2 intatta) | Basso — elimina 24/26 errori tsc odierni | #2, #3 |
| 6 | `app/trip/[id]/places/index.tsx` | Sostituire entrambe le costruzioni inline di `PlaceRef` (`handleAddPlace`, ricerca live) con `PlaceMergeEngine.mergeFromProvider()` + `actions.savePlace(tripId, travelPlace)` | Medio — due punti di scrittura utente reali, verificare che priorità/note/durata sopravvivano al passaggio | #2, #3 |
| 7 | `app/trip/[id]/itinerary.tsx` | Stesso trattamento per i luoghi selezionati da `SmartSlotFillingModal`/`InspirationWizardModal` | Medio — tocca il percorso di composizione attiva | #2, #3, #6 |
| 8 | `src/core/engines/places/places.engine.ts` | `savedPlacesMap: Map<string, TravelPlace[]>`; `savePlace(tripId, place: TravelPlace)`; `getSavedPlaces(): Promise<TravelPlace[]>`; nuova `getSavedPlacesAsPlaceRefs(tripId, ctx?)` per i chiamanti che necessitano la proiezione | Alto — cambia il contratto di persistenza MMKV; i dati già salvati in `places_${tripId}` sotto il vecchio formato `PlaceRef[]` vanno letti con un path di migrazione una-tantum, non scartati | #2, #3, #6, #7 |
| 9 | `src/core/engines/timeline/timeline.engine.ts` | Persistere `TimelineSlot[]` invece di `PlaceRef[]` sotto `timeline_${tripId}`; risolvere `PlaceRef` pieni a runtime componendo `TimelineSlot` + `PlacesEngine.getSavedPlaces()` | Alto — stesso problema di migrazione dati MMKV di #8; inoltre `markAsVisited`/`updatePlaceNotes` in `PlacesEngine` oggi mutano `PlaceRef` persistiti direttamente e vanno riscritti per scrivere sul livello Personal di `TravelPlace` | #8 |
| 10 | `src/shared/hooks/usePlaces.ts`, `useTravelActions.ts`, `useNextPlace.ts` | Adeguare le firme: le funzioni di scrittura (`savePlace`) accettano/producono `TravelPlace`; le funzioni di lettura per la UI continuano a esporre `PlaceRef`, proiettato internamente all'hook | Medio — è la porta unica View Layer, ogni schermata dipende da questi hook | #8, #9 |
| 11 | `src/features/places/catalog/editorial-places.catalog.ts` | 🟡 **Parzialmente sbloccato (Sprint 14, Fase 2)** — `mergeFromProvider` ora accetta `EditorialPlaceItem.baseData` (passo #2 aggiornato), usato oggi solo dal percorso di **sola lettura, transiente** in `usePlaceDetails` (passo #5). L'adozione vera e propria — sostituire lo smontaggio a mano in `PlaceRef` dentro `places/index.tsx` (`handleAddPlace`) con una scrittura reale tramite `mergeFromProvider` + persistenza — resta da fare | Basso — dati statici, nessuna scrittura utente coinvolta | #2, #6 |
| 12 | Eliminazione codice morto: `src/core/engines/models/JourneyPlace.ts`, `src/core/engines/mappers/PlaceToJourneyPlace.ts` | Rimozione — zero riferimenti verificati | Zero (verificato: zero import) | Nessuna |
| 13 | Eliminazione percorso legacy: `src/domain/trip/engine/PlannerEngine.ts`, `planner.types.ts`, `src/domain/trip/providers/PlaceProvider.ts`, `src/domain/trip/repositories/place.repository.ts`, `src/features/itinerary/store/planner.store.ts`, `src/features/places/store/place.store.ts`, `src/features/trip-experience/*` | Rimozione — già segnalato come codice morto in `KNOWN_DEBT.md`, questa ADR è la decisione esplicita che quel documento richiedeva prima di procedere | Basso (verificato zero import esterni), ma irreversibile — conferma esplicita richiesta comunque | #1 (rende `TravelPlace` incompatibile con la firma legacy) |
| 14 | Eliminazione percorso duplicato provider: `src/core/domain/models/Place.ts`, `src/core/domain/repositories/PlaceRepository.ts`, `src/core/infrastructure/repositories/{TravelBackendRepository,MockPlaceRepository}.ts`, `src/core/infrastructure/services/TravelBackendService.ts`, l'export `placeRepository` in `TravelServices.ts`, il mapper interno `mapPlaceToMetadata` (righe 179-202, diventa superfluo perché la sua sorgente `Place` sparisce) | Rimozione, sostituiti da #4 | Medio — è l'unico percorso reale verso il backend oggi; #4 deve essere verificato funzionante prima di rimuovere questo | #4, #5 |
| 15 | `TravelServices.editorial().getCuratedCatalog()` (`TravelServices.ts:254-303`) | Far confluire nella pipeline dichiarata: input `PlaceMetadata`/dataset curato → `PlaceMergeEngine.mergeFromProvider` (livello Editorial pre-popolato) → `canonicalPlaceToPlaceRef`, invece del quarto oggetto ad-hoc non tipizzato (`Promise<any[]>`) prodotto oggi | Basso — nessun consumer reale verificato oltre al proprio modulo; verificare comunque prima di rimuovere il tipo `any[]` | #2, #3 |
| 16 | `src/features/trips/mock/budapest.mock.ts` | Aggiornare eventuali literal `TravelPlace` hardcoded al nuovo schema de-aliasato (#1) | Basso | #1 |
| 17 (backend, fuori scope di modifica diretta ma dipendenza dichiarata) | `backend/src/models/Place.ts`, `PlacesController` | Normalizzare il contratto HTTP emesso alla forma `PlaceMetadata`, o introdurre un mapper esplicito lato `GooglePlacesAdapter` (#4) che assorba la differenza | Medio — deploy separato, richiede coordinamento di rilascio indipendente dall'app mobile | #4 |
---

## 7. Rischi

- **Regressioni sulla deduplicazione**: `PlaceMergeEngine.isSamePlace` (distanza <30m, similarità nome >90%) è oggi testata in isolamento (`PlaceMergeEngine.test.ts`) ma solo per il confronto `{name, lat, lon}` semplice usato da `PlacesEngine`. Ripormarla a punto di ingresso canonico (`mergeFromProvider`) richiede di verificare che il comportamento di merge dei tre livelli, oggi solo teorico in `DOMAIN_MODEL.md`, sia realmente coperto da test prima di collegarla a scritture utente reali.
- **Perdita di dati persistiti nel cambio di formato MMKV**: `places_${tripId}` e `timeline_${tripId}` oggi contengono `PlaceRef[]` serializzati. Il passaggio a `TravelPlace[]`/`TimelineSlot[]` (piano #8-#9) non può limitarsi a cambiare il tipo TypeScript: serve un path di lettura che riconosca il formato legacy già presente su dispositivo e lo converta, o i trip già pianificati da utenti esistenti perdono i luoghi salvati al primo avvio post-migrazione. Questo rischio non esiste per un progetto mai rilasciato pubblicamente, ma va verificato esplicitamente contro lo stato reale di distribuzione prima di procedere.
- **Impatto sul Context Engine**: `ContextEngine.recompose()` fa uno shallow-merge delle slice pubblicate da ogni motore (`EVENT_BUS.md`) — cambiare cosa `PlacesEngine.publishStateSlice`/`TimelineEngine` restituiscono (proiezioni fresche invece di dati grezzi persistiti) non cambia la forma esterna di `TravelContext` (resta `PlaceRef[]`), ma cambia **quando** viene calcolato: oggi è un semplice `.get()` da mappa in memoria, dopo la migrazione ogni `recompose()` invoca la proiezione per ogni luogo salvato/pianificato. Va verificato che questo non introduca un costo percepibile su trip con molti luoghi (`recompose()` è sincrono e blocca la UI, per design).
- **Impatto sul Journey Composer**: nessuno strutturale — continua a ricevere `PlaceRef`. Il rischio reale è puntuale: ogni punto che oggi muta un `PlaceRef` sperando che la mutazione persista (`markAsVisited`, `updatePlaceNotes` in `PlacesEngine`, righe 133-180) deve essere riscritto per scrivere sul livello Personal di `TravelPlace` — un audit riga per riga di questi metodi è obbligatorio, non opzionale, prima di considerare la migrazione completa.
- **Impatto sul Rule Engine**: nullo — le 6 regole ricevono `TimelineContext` derivato, non toccano mai la persistenza.
- **Impatto sull'Event Bus**: i payload di `PlaceSaved`/`PlaceVisited`/`PlaceNotesUpdated` copiano oggi `category`/`name`/`placeId` direttamente dall'oggetto passato a `PlacesEngine`. Dopo la migrazione questi campi vengono letti dal livello External di `TravelPlace` invece che da `PlaceRef` — i nomi coincidono, ma va verificato campo per campo che nessun consumer del bus (oggi: `ContextEngine`, `trip.store.ts`) dipenda implicitamente dalla presenza di un campo che in `TravelPlace` non esiste allo stesso livello di annidamento.
- **Impatto sul backend Places**: se si sceglie di normalizzare il contratto HTTP (piano #17) invece di assorbire la differenza in un mapper lato SIP, è una modifica breaking per qualunque altro consumer del backend — oggi non ne esistono (deploy dedicato a quest'app), ma va dichiarato esplicitamente come vincolo di rilascio, non assunto.

---

## 8. Decisioni Future

- **Traveler DNA / Memory Engine (ADR-014)**: il `SignalExtractor` previsto in Fase 0 osserva variazioni sul livello `memories` di `TravelPlace` (`personalRating`, `isFavorite`, `checkInStatus`) — con la canonicalizzazione, questo diventa l'unico punto di osservazione possibile, eliminando l'ambiguità odierna su se un segnale utente vada cercato in `PlaceRef`, `TravelPlace` o altrove. La distinzione già non negoziabile in `DOMAIN_TERMS.md` (`PlaceMemories` = memoria dichiarata, Traveler DNA = memoria osservata) trova qui la sua controparte strutturale stabile.
- **AI Concierge**: quando esisterà, interrogherà `TravelPlace` come fonte di verità per "cosa sa Travel OS di questo luogo" — un solo oggetto da passare a qualunque futura costruzione di prompt, invece di dover riconciliare fino a sei rappresentazioni diverse come oggi.
- **Offline Sync (futuro `ISyncEngine`)**: `TravelPlace` è l'unità di sincronizzazione naturale — ha già `source.lastSyncAt`/`source.provider`, è Zod-validato, è l'unico livello persistito con identità stabile. `PlaceRef`, essendo una proiezione ricalcolata, **non deve mai** essere trasmesso da un futuro Sync Engine: sincronizzare stato calcolato invece che stato sorgente è una categoria di bug che questa decisione previene strutturalmente, non solo per il presente.
- **Collaborative Trips**: se in futuro due utenti modificano lo stesso luogo, la risoluzione dei conflitti ha un solo record per luogo su cui ragionare (`TravelPlace`), non `N` copie parziali di `PlaceRef` ciascuna con una vista diversa — questa decisione riduce la superficie di conflitto futura a un problema singolo (merge dei tre livelli), non a un problema combinatorio (riconciliare `N` rappresentazioni indipendenti).

---

## Alternative considerate

**A. Adottare la pipeline originale (`Provider → TravelPlace → JourneyPlace → PlaceRef`) senza modifiche.** Scartata: avrebbe formalizzato `JourneyPlace` come tappa obbligatoria nonostante zero consumer verificati, e non avrebbe risolto la frammentazione a monte (due Provider Model indipendenti), lasciando l'origine dei 24 errori `tsc` (`placeRepository`) fuori scope.

**B. Eleggere `PlaceRef` a modello canonico persistito, invece di `TravelPlace`.** Scartata: `PlaceRef` non ha mai avuto validazione (non è Zod), non ha una separazione a livelli (External/Editorial/Personal sono oggi appiattiti in un solo oggetto), e la sua stessa doppia responsabilità (libreria + pianificazione, §2.5) è parte del problema da risolvere, non una base su cui costruire la soluzione.

**C. Introdurre un settimo tipo "PlaceDTO" neutro tra backend e frontend, invece di riusare `PlaceMetadata`.** Scartata: `PlaceMetadata` esiste già, è già la valuta reale del SIP, è già usata da un percorso live (`places/index.tsx`); introdurre un ottavo tipo per risolvere la proliferazione di tipi sarebbe contraddittorio con l'obiettivo della decisione.
