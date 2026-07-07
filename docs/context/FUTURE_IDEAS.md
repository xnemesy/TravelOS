# FUTURE_IDEAS.md

> Idee esplicitamente menzionate nel codice o nelle ADR come direzione futura — non un brainstorming libero. Ogni voce ha una fonte. Per il lavoro già pianificato e sequenziato, vedi [CURRENT_ROADMAP.md](CURRENT_ROADMAP.md); questo documento raccoglie idee più a lungo raggio o meno formalizzate.

## DayNarrator / TasteProfileNarrator — livello di narrazione separato dal calcolo

ADR-014 menziona un `TasteProfileNarrator` "gemello di un `DayNarrator` isolato per il Composer (ADR separato)" — nessuna delle due ADR esiste ancora oggi. L'idea: un livello a valle, sostituibile e isolato, che traduce output numerici deterministici (punteggi, profili) in linguaggio naturale — mai il motore stesso a generare testo. Coerente col principio "i numeri prima delle parole" (vedi [TRAVEL_OS_DNA.md](TRAVEL_OS_DNA.md)).

## Provider Layer — booking, foto, calendario

ADR-001 elenca nel proprio diagramma `IBookingProvider`, `IPhotosProvider`, `ICalendarProvider` accanto a Weather/Places già esistenti — nessuno dei tre esiste nemmeno come interfaccia oggi. Un'estensione naturale del SIP, ma non ancora scoping in alcuna ADR.

## Ottimizzazione del giorno guidata da un motore più sofisticato

`PlannerEngine.optimizeDay`/`optimizeTrip` (percorso legacy, morto) sono stub esplicitamente commentati come "predisposizione per l'ottimizzazione automatica (AI Engine)" — un'idea di ottimizzazione globale (non greedy) del routing multi-giorno, mai formalizzata in un'ADR e legata a un percorso di codice che oggi è morto. Se questa idea viene ripresa, andrebbe ripensata contro il percorso attivo (`JourneyComposer`), non resuscitando `PlannerEngine`.

## `RecommendationAccepted` / `RecommendationIgnored`

Menzionati in ADR-015 come eventi futuri esplicitamente fuori scope oggi — dipendono dall'esistenza di un vero "suggerimento" da accettare o ignorare, che a sua volta dipende dal futuro AI Concierge. Segnali comportamentali di alto valore per il Traveler DNA una volta che entrambi i prerequisiti esisteranno.

## `PlaceSkipped`, `PlaceLeftEarly`, `PlaceStayedLongerThanExpected`

Anch'essi menzionati in ADR-014/015 come whitelist futura di eventi per il Traveler DNA — richiedono che `TimelineEngine` tracci planned-vs-actual in tempo reale (live tracking), funzionalità non ancora costruita. Chi possiede lo stato della timeline dovrà emettere queste primitive; il futuro `MemoryEngine` le consumerà soltanto (mai il contrario — vedi ADR-14 §4 per il perché di questo confine).

## Sincronizzazione cloud (SyncEngine)

Menzionato ripetutamente nei commenti del codice ("Sincronizzazione Cloud: Offline-first (MMKV)... delegato al SyncEngine") come seam futuro, mai formalizzato in un'ADR né come interfaccia. Prerequisito implicito per qualunque futura funzionalità multi-dispositivo o backup cloud dei dati di viaggio.

## MCP come possibile integrazione futura

Un commento in `travel-providers.types.ts` elenca "MCP" tra le integrazioni provider future accanto a OpenAI — nessun dettaglio ulteriore esiste nel codebase. Da trattare come nota, non come piano.
