# PRODUCT_PRINCIPLES.md

> Principi di prodotto derivati da decisioni architetturali reali (vedi [DECISIONS.md](../context/DECISIONS.md)), non aspirazioni astratte. Ogni principio qui elencato è già incarnato in codice esistente, citato come prova.

## 1. Meglio un compromesso onesto che un errore silenzioso

Il `PlaceMergeEngine` fonde due luoghi solo se distanza < 30m **E** somiglianza nome > 90%; se manca anche un solo segnale, non fonde — principio dichiarato letteralmente nel codice: *"Meglio avere un duplicato innocuo che fondere per errore due posti diversi"* ([PlaceMergeEngine.ts](../../src/domain/trip/engine/PlaceMergeEngine.ts)). Lo stesso vale per il `SIP` (Service Integration Platform): se un provider reale fallisce o è offline, si degrada al mock invece di rompere l'esperienza (vedi [DATA_FLOW.md](../architecture/DATA_FLOW.md)).

**Come si applica**: qualunque nuova logica di fusione, deduplica o fallback deve preferire il "non fare nulla" osservabile al "fare la cosa sbagliata" silenziosa.

## 2. I bug si documentano, non si nascondono

Il caso limite NaN nel `JourneyScoreCalculator` (ADR-016) non è stato corretto silenziosamente durante l'estrazione in Domain Service: è stato preservato, bloccato da un test dedicato (`describe('...preexisting edge case (documented, not fixed)')`), e discusso in un ADR con opzioni di fix esplicite. Lo stesso vale per debito architetturale come i due `PlaceRepository` paralleli o il codice morto in `trip-experience/` (vedi [KNOWN_DEBT.md](../context/KNOWN_DEBT.md)) — sono documentati, non rimossi in silenzio né ignorati.

**Come si applica**: quando un refactoring incontra un comportamento preesistente sospetto, il default è "preserva e documenta", non "correggi silenziosamente" — un fix di comportamento è una decisione di prodotto separata, non un side-effect di un refactoring.

## 3. Gli Engine orchestrano, i Domain Service calcolano

Regola architetturale scritta esplicitamente nei commenti header di `DistanceCalculator.ts` e `JourneyScoreCalculator.ts`. Gli Engine (`ContextEngine`, `PlacesEngine`, `TimelineEngine`) gestiscono stato, persistenza e I/O; i Domain Service (`DistanceCalculator`, `JourneyScoreCalculator`, le regole del Rule Engine) sono funzioni pure, stateless, testabili senza mock. Vedi [ARCHITECTURE.md](../architecture/ARCHITECTURE.md#livelli).

**Come si applica**: prima di aggiungere logica a un Engine, chiedersi se è calcolo puro (→ Domain Service, testabile in isolamento) o orchestrazione con side-effect (→ Engine).

## 4. L'Event Bus trasporta fatti, mai eventi UI

*"L'Event Bus accetta ESCLUSIVAMENTE eventi di dominio ad alto impatto (Domain Facts). NON emettere MAI eventi UI"* ([events.types.ts](../../src/core/engines/types/events.types.ts)). ADR-015 ha rimosso pubblicazioni fittizie (`PlaceSaved` con `placeId: 'hydrate'` usato solo per forzare un ricalcolo) proprio perché inquinavano un canale che in futuro alimenterà motori che imparano dai fatti (Traveler DNA, AI Concierge) — un fatto finto insegna rumore, non comportamento reale. Vedi [EVENT_BUS.md](../architecture/EVENT_BUS.md).

**Come si applica**: se il publisher e il consumer sono nello stesso modulo, non serve l'Event Bus — è una chiamata diretta ("ho aggiornato la mia cache, ricomponi"), non un fatto di dominio.

## 5. Offline-first non è una feature, è la baseline

Ogni engine di dominio persiste localmente (MMKV, con fallback ad AsyncStorage) prima di qualunque sincronizzazione cloud, che oggi non esiste ancora (Firebase è inizializzato ma non usato per dati di viaggio — vedi [PROJECT_STATE.md](../context/PROJECT_STATE.md)). Il SIP (`TravelServices`) tratta la connettività come uno stato da gestire, non da assumere: cache con TTL, fallback a mock quando offline o quando un provider reale fallisce.

**Come si applica**: nessuna feature nuova può assumere una connessione sempre presente come precondizione per funzionare.

## 6. Composizione reattiva sincrona, persistenza asincrona disaccoppiata

Il `ContextEngine` ricompone `TravelContext` interamente in memoria e in modo sincrono ad ogni fatto di dominio; la persistenza su disco resta nei singoli motori, mai sul percorso critico della UI (ADR-001). Questo è ciò che permette transizioni istantanee (check-in, riordino drag&drop) senza spinner.

**Come si applica**: nessuna scrittura I/O asincrona deve mai bloccare la ricomposizione del `TravelContext` o la notifica ai listener della UI.

## 7. La UI legge e scrive solo attraverso gli Hook, mai direttamente

*"Regola d'Oro del View Layer"* (ADR-001): `useTravelContext`, `usePlaces`, `useTimeline`, `useNextPlace`, `useTravelActions` sono l'unica barriera tra componenti React e dominio. Import diretti di store, repository o provider nei componenti UI sono vietati — con una sola eccezione nota e tracciata (`app/trip/[id]/places/[placeId].tsx`, vedi [KNOWN_DEBT.md](../context/KNOWN_DEBT.md)).

**Come si applica**: ogni nuovo screen deve consumare stato tramite un hook esistente o un nuovo hook granulare in `src/shared/hooks/`, mai importando `contextEngine`/`placesEngine`/repository direttamente.

## 8. Il determinismo è un requisito di dominio, non un dettaglio di test

I Domain Service non chiamano `Date.now()` o `Math.random()` (eccetto nell'orchestrazione esplicitamente non testata, come la scelta random del `theme` in `JourneyComposer.generateDayTheme` — un'eccezione nota, non un principio violato). Il Traveler DNA (ADR-014) è vincolato a essere ricostruibile per replay dal solo log di eventi. Vedi [TESTING_STRATEGY.md](../architecture/TESTING_STRATEGY.md).

**Come si applica**: se una funzione deve essere testata con input→output esatto, non deve dipendere dall'orologio di sistema o da un generatore casuale.

## 9. Decisione ≠ attivazione

Un'ADR già accettata nel merito non si riscrive quando arriva il momento di implementarla — si attiva. ADR-015 lo dimostra già: il suo Sprint 13.1 (pulizia Event Bus) è stato implementato nel commit `9e06fac` senza mai riaprire il documento, e `DECISIONS.md` lo registra come "parzialmente eseguito", non come una nuova decisione. Lo stesso principio, reso esplicito per la prima volta il 2026-07-08 in [CURRENT_ROADMAP.md](../context/CURRENT_ROADMAP.md), evita un'ADR-018 ridondante per l'implementazione di ADR-014 (Traveler DNA): il design resta quello già scritto, gli sprint 16-19 lo eseguono in fasi, senza ridiscuterlo.

Corollario: quando un'ADR contiene attività di natura diversa sotto lo stesso documento (es. ADR-014 mescola "registrare fatti" e "interpretarli"), la roadmap può sequenziarle in sprint separati — anche a distanza — senza che questo implichi scindere l'ADR in due decisioni. Vale in particolare per la cattura di dati comportamentali: la storia di un utente non è ricostruibile retroattivamente, quindi la cattura (Sprint 16) va anticipata rispetto all'intelligenza che la userà (Sprint 17), anche se l'intelligenza resta lontana nel tempo.

**Come si applica**: prima di aprire una nuova ADR, verificare se la decisione è già coperta da un documento esistente ancora valido nel merito — se lo è, il lavoro che segue è uno sprint di attivazione, non un nuovo numero ADR. Una nuova ADR si apre solo per una decisione non ancora presa, non per la sua implementazione differita.
