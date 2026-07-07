# DIFFERENTIATORS.md

> Cosa rende Travel OS diverso da un trip planner qualsiasi — ancorato a decisioni architetturali reali, non a promesse di marketing.

## 1. Tre livelli di conoscenza per ogni luogo, mai fusi tra loro

`TravelPlace` non è un record piatto: separa esplicitamente **External** (dati grezzi da provider — Google/curated dataset), **Editorial** (contenuto curato da Travel OS: perché visitarlo, quando, consigli fotografici, errori da evitare) ed **Personal/Memories** (diario, rating personale, check-in, spese collegate) — vedi [DOMAIN_MODEL.md](../architecture/DOMAIN_MODEL.md). Il `PlaceMergeEngine` è progettato apposta per non mescolare mai questi livelli: quando arriva un dato provider aggiornato, si fonde **solo** il livello External — Editorial e Personal restano intoccati. Un trip planner generico ha un solo record "posto"; Travel OS ne ha tre, con una regola di fusione esplicita che protegge il contenuto curato e personale dal rumore dei dati esterni.

## 2. Un Rule Engine dichiarativo, non un algoritmo monolitico

La composizione della giornata non è un'unica funzione che decide tutto: è una pipeline di 6 regole indipendenti e pesate (`OpeningHoursRule`, `EndOfDayRule`, `WeatherRule`, `SmartMealRule`, `VisitDurationRule`, `TravelTimeRule`), ciascuna con la propria responsabilità, il proprio peso, la propria spiegazione testuale. Questo significa che il comportamento del composer è **ispezionabile regola per regola** e **estendibile aggiungendo una regola**, non riscrivendo un algoritmo. Vedi [RULE_ENGINE.md](../architecture/RULE_ENGINE.md).

## 3. Ogni decisione dell'algoritmo porta la propria motivazione

Ogni luogo posizionato in una giornata porta una `JourneyDecision` con `confidence` e `reason` — la concatenazione delle spiegazioni di tutte le regole che hanno votato quel posizionamento. Non è un "black box scheduling": è tracciabile.

## 4. Punteggio di qualità del viaggio come segnale di prodotto, non vanity metric

Il `journeyScore` (calcolato da `JourneyScoreCalculator`, pesato su pianificazione/bilanciamento/conflitti/pasti/camminata) e il `journeyQuality`/`dailyHealth` (calcolati da `JourneyComposer`) non sono un badge estetico: guidano `generateSmartSuggestions`, che propone azioni concrete ("hai una giornata senza pause", "hai 12km da camminare oggi") in tempo reale. Il punteggio è un diagnostico, non una decorazione.

## 5. Architettura reattiva pensata per il Traveler DNA fin dall'inizio

L'Event Bus non è un dettaglio implementativo per disaccoppiare store: è progettato per un futuro in cui un `MemoryEngine` osserverà lo stream di fatti di dominio e ne deriverà un profilo comportamentale persistente per-utente (ADR-014). Questo è il motivo per cui ADR-015 ha investito tempo a "purificare" l'Event Bus — rimuovere eventi fittizi usati solo per forzare ricalcoli — invece di lasciarlo "abbastanza buono per la UI di oggi". Un evento finto oggi sarebbe rumore che il futuro Traveler DNA imparerebbe come comportamento reale.

## 6. Memoria osservata, non solo dichiarata — e le due non si confondono mai

`PlaceMemories` (diario, rating, foto) è memoria **dichiarata** dall'utente, scoped a un singolo luogo in un singolo viaggio. Il Traveler DNA (ADR-014, non ancora implementato) sarà memoria **osservata** dal comportamento (eventi), cross-trip, user-level. ADR-014 è esplicito: i due livelli si alimentano a vicenda ma non vanno mai uniti in un unico modello. Nessun trip planner generico fa questa distinzione — la maggior parte confonde "quello che l'utente scrive" con "quello che l'utente effettivamente fa".

## 7. Resilienza ai dati esterni come principio architetturale, non gestione errori ad-hoc

Il SIP (`TravelServices`) esiste per fare in modo che ogni motore di dominio dipenda solo da interfacce astratte (`WeatherProviderAdapter`, `PlacesProviderAdapter`, ecc.), non da un provider concreto — con cache, TTL, e fallback automatico a dati mock quando un provider reale fallisce o è assente. Questo è già vero oggi per luoghi/meteo/orari, non solo un piano futuro. Vedi [DATA_FLOW.md](../architecture/DATA_FLOW.md).

## Cosa NON è (ancora, e per design)

- **Non è un aggregatore di prenotazioni.** Non ci sono `IBookingProvider`/integrazioni voli-hotel oggi, e non è nel percorso critico del prodotto — vedi [PROJECT_STATE.md](../context/PROJECT_STATE.md).
- **Non è un assistente AI conversazionale.** Non esiste alcuna integrazione LLM nel codice. L'"AI Concierge" è un consumer futuro esplicitamente progettato per leggere un Traveler DNA già maturo, non per sostituirlo con un prompt generico — vedi [AI_ARCHITECTURE.md](../architecture/AI_ARCHITECTURE.md) e [TRAVEL_OS_DNA.md](../context/TRAVEL_OS_DNA.md).
- **Non è un social network di viaggio.** Nessuna feature di condivisione/community esiste o è pianificata nelle ADR attuali.
