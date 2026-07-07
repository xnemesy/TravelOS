# DESIGN_PHILOSOPHY.md

> Non è una guida di stile visivo — è la filosofia con cui Travel OS decide come dovrebbe "sentirsi" una giornata di viaggio. La UI (colori, componenti, spaziature) è dettaglio implementativo; questo documento riguarda le decisioni che restano vere qualunque sia il design system.

## "Realistico, umano, bilanciato" — il mandato del Journey Composer

Il commento header di [JourneyComposer.ts](../../src/domain/services/JourneyComposer.ts) lo dichiara esplicitamente: il motore progetta giornate "realistiche, umane, bilanciate". Questo si traduce in scelte concrete già implementate, non in intenzioni:

- **Le pause non sono opzionali.** `SmartMealRule` inserisce automaticamente pranzo (12:30-14:00) e cena (18:30-21:30) se non già pianificati; `calculateRuntimeHealth` penalizza esplicitamente una giornata senza pause (`missingBreaksCount`) quando supera 3-5 ore pianificate.
- **La densità non è un numero solo, è un giudizio a più assi.** `calculateExperienceDensity` classifica una giornata come `intense` se **anche solo una** tra km camminati, ore pianificate o numero di luoghi supera la soglia — non una media. Una giornata con 0km e 0 ore ma 9 luoghi è comunque `intense`: il sovraccarico cognitivo conta quanto quello fisico.
- **Non più di 1-2 esperienze "must-see" al giorno.** `composeDayJourney` limita esplicitamente le esperienze `hero_experience` (`maxHeroes`) e retrocede le eccedenti a `secondary` — commento nel codice: *"Esperienze Must-See distribuite per non affaticare il ritmo"*. Un giorno pieno di capolavori è, per Travel OS, un giorno progettato male.
- **Il tempo di viaggio ha un costo, non solo una durata.** `TravelTimeRule` non si limita a calcolare i minuti di spostamento: aggiunge un "overhead di arrivo" per categoria (un museo costa 20 minuti di ambientamento, un punto panoramico 10) — riconoscendo che arrivare da qualche parte non significa essere pronti a viverla.

## Il motore non inventa, orchestra

Principio ripetuto in più punti del codice e delle ADR: il Journey Composer "non inventa mai luoghi esterni: lavora esclusivamente sui luoghi resi disponibili" dall'utente (catalogo → libreria → composer → itinerario). La UI riflette questo: ogni azione dell'algoritmo (`JourneyDecision`, con `reason` e `confidence`) è tracciabile a una motivazione leggibile, non una black box. Questo è il seme di quello che diventerà il `DayNarrator` (menzionato in ADR-014 come componente gemello, non ancora costruito) — un livello che *spiega* le decisioni in linguaggio naturale, separato dal motore che le prende.

## Controllo umano sempre disponibile, mai forzato

`isLocked` su un `PlaceRef` ("pin" utente via drag&drop) è un vincolo che l'algoritmo non può mai ignorare — commento nel codice: *"non va rimosso dall'algoritmo"*. Gli `anchorType` (`HARD` per orari fissati, `SOFT` per pin utente) esistono per la stessa ragione: l'automazione compone intorno alle decisioni dell'utente, non le sovrascrive mai silenziosamente.

## I numeri prima delle parole

Principio esplicito di ADR-014 per il Traveler DNA: *"si salva `museum_score = 0.81`, mai 'ama i musei'"*. Il motore produce dati strutturati e deterministici; un livello a valle (un futuro `Narrator`), separato e sostituibile, li trasforma in linguaggio naturale. Questo vale oggi anche per `generateDayTheme`/`generateJourneyMood` in `JourneyComposer`: sono generatori di stringhe isolati, chiaramente separati dal calcolo (e per questo l'unico punto del composer che usa `Math.random()`, deliberatamente non testato — vedi [TESTING_STRATEGY.md](../architecture/TESTING_STRATEGY.md)).

## Degradare con grazia, mai bloccare

`composeDayJourneyWithSIP` arricchisce con dati provider live (meteo, orari reali) ma se il provider fallisce, ritorna silenziosamente la versione offline-composta — mai un errore bloccante per l'utente. Lo stesso principio guida tutto il SIP (vedi [DATA_FLOW.md](../architecture/DATA_FLOW.md)): un fallimento di rete è un evento normale da assorbire, non un'eccezione da propagare fino alla UI.

## Riferimenti

Per il "perché" strategico dietro queste scelte tecniche, vedi [DIFFERENTIATORS.md](DIFFERENTIATORS.md) e [TRAVEL_OS_DNA.md](../context/TRAVEL_OS_DNA.md). Per il meccanismo tecnico del Rule Engine che implementa questi principi, vedi [RULE_ENGINE.md](../architecture/RULE_ENGINE.md).
