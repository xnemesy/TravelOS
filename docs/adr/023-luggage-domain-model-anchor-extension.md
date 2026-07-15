# ADR-023: Luggage Domain Model & Anchor Extension (No New Persistence)

**Stato**: Accettata / In Implementazione (Sprint 18)
**Data**: Luglio 2026
**Ambito**: `TripSetup` (Accommodation), `JourneyAnchorEngine`, `LuggagePlanningService`, `LuggageStateCalculator`
**Riferimenti**: [SPRINT_18_HUMAN_TRAVEL_LOGIC](../architecture/SPRINT_18_HUMAN_TRAVEL_LOGIC.md), [ADR-015](015-domain-events-purity.md), [ADR-022](022-cached-provider-persistence.md)

---

## 1. Contesto e Problema

Durante i test in simulatore successivi allo Sprint 17 sono emersi limiti del planner deterministico nella gestione della logistica dei bagagli:
1. Arrivo del volo la mattina presto e check-in in hotel nel pomeriggio: il planner pianificava attività senza tenere conto che il viaggiatore ha i bagagli al seguito.
2. Assenza di un deposito bagagli esplicito o gestione del dropoff/pickup bagagli tra arrivo/partenza e check-in/check-out.
3. Necessità di supportare early check-in o late check-out offerti dall'hotel.

La domanda architetturale chiave era: lo stato dei bagagli (`WITH_LUGGAGE`, `STORED`, `NONE`) e i punti di deposito/ritiro devono essere salvati come nuovi entità/aggregati persistiti nel database MMKV/Isar e generare nuovi eventi di dominio?

## 2. Decisione

### 2.1 Nessuna nuova persistenza per stato derivabile
Lo stato dei bagagli e gli anchor di logistica bagagli **NON** saranno nuovi Aggregate persistiti. Sono interamente derivabili da dati già inseriti dall'utente (trasporti, alloggio e policy hotel), coerentemente con come `JourneyAnchorEngine.buildTripAnchors()` deriva oggi `check_in` e `check_out` da `Accommodation`.

Motivazioni:
- **Coerenza**: Gli anchor in TravelOS sono proiezioni calcolate, non stato persistito.
- **Zero Migrazioni**: Nessuna migrazione dello storage cache-based MMKV (ADR-022).
- **Purezza degli Eventi di Dominio (ADR-015)**: Il bus eventi deve contenere solo *fatti* persistiti. Uno stato bagagli ricalcolato ad ogni composizione è una proiezione derivata, non un fatto storico. Pertanto, nessun nuovo `DomainFactType` verrà introdotto per lo stato bagagli.

### 2.2 Estensione minima di `AccommodationSchema` (HotelPolicy)
L'unica estensione persistita è un piccolo value object opzionale (`HotelPolicy`) all'interno di `AccommodationSchema` in `trip-setup.model.ts`:
```typescript
interface HotelPolicy {
  luggageStorageAvailable?: boolean;       // default assunto: true
  earlyCheckIn?: 'yes' | 'no' | 'unknown'; // default: 'unknown' (trattato conservativamente come 'no')
  lateCheckOut?: 'yes' | 'no' | 'unknown'; // default: 'unknown'
}
```
Essendo i campi opzionali, la retrocompatibilità con i trip esistenti è del 100% senza alcuna migrazione dati.

### 2.3 Estensione di `JourneyAnchorKind`
Aggiunta di due nuovi anchor derivati a `JourneyAnchorKind`:
- `luggage_dropoff`: bagagli lasciati in hotel o deposito pubblico.
- `luggage_pickup`: bagagli ripresi.

Questi anchor saranno generati dinamicamente dal nuovo servizio stateless `LuggagePlanningService` all'interno di `JourneyAnchorEngine.buildTripAnchors()`. Non faranno parte di `ARRIVAL_KINDS` o `DEPARTURE_KINDS`, ma saranno trattati come confini temporali interni nella finestra di attività di `getDayActivityWindow()`.

### 2.4 Value Object `LuggageState` e `LuggageStateCalculator`
Introduzione del tipo:
```typescript
type LuggageState = 'WITH_LUGGAGE' | 'STORED' | 'NONE';
```
Calcolato dinamicamente da `LuggageStateCalculator` (funzione pura `(anchors, policy) => (minutesSinceMidnight => LuggageState)`), che permette a `TimelineRuleEngine` (tramite `LuggageConstraintRule`) di valutare la compatibilità di un'attività in base allo stato bagagli in quel preciso minuto.

## 3. Conseguenze e Criteri di Accettazione

- [ ] I trip senza dati di accommodation o con `HotelPolicy` assente non subiscono variazioni di comportamento.
- [ ] Nessuna modifica agli schemi di persistenza o migrazione richiesta.
- [ ] Quando un arrivo precede di molto il check-in e il deposito è disponibile, viene generato un anchor `luggage_dropoff` in hotel, consentendo di girare senza bagagli (`NONE` / `STORED`).
- [ ] `LuggageConstraintRule` applica una penalità soft (peso iniziale basso) alle attività incompatibili con bagagli (`WITH_LUGGAGE`).
