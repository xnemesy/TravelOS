# ADR-024: End-of-Day & Intra-Day Continuity (Quattro Regole Fondamentali del Composer)

**Stato**: Accettata / In Implementazione (Sprint 18)
**Data**: Luglio 2026
**Ambito**: `JourneyComposer`, `EndOfDayClosureService`, `ContinuityValidator`, `GapFillingService`, `TimelineRuleEngine`
**Riferimenti**: [SPRINT_18_HUMAN_TRAVEL_LOGIC](../architecture/SPRINT_18_HUMAN_TRAVEL_LOGIC.md), [ADR-016](016-journey-score-nan-edge-case.md)

---

## 1. Contesto e Problema

Dopo Sprint 17 e i test in simulatore, sono state identificate lacune nella composizione delle giornate da parte di `JourneyComposer`:
- Transizioni temporali inverosimili tra nodi senza spiegazione geografica (es. aeroporto 08:15 -> check-in 18:00 senza tappe intermedie né transfer espliciti).
- Nessun rientro automatico in hotel a fine giornata per pernottare.
- Finestre vuote (gap > 90 minuti) lasciate inosservate nel mezzo della giornata.
- Gestione rigida della mezzanotte che spezza voli in arrivo notturni o attività serali estese.

Per risolvere questi problemi mantenendo l'architettura deterministica e "AI-ready" (dove il planner ragiona prima come un viaggiatore esperto, e l'AI interviene a valle solo per perfezionare le scelte), sono state definite le **Quattro Regole Fondamentali del Composer**.

## 2. Decisione

### 2.1 Regola A — L'hotel come hub logistico della giornata
Quando l'arrivo precede il check-in di molte ore ed esiste un deposito bagagli (in hotel o pubblico), l'hotel viene trattato come hub logistico. Il flusso di composizione deve produrre la catena:
`aeroporto -> hotel (deposito bagagli) -> visite -> pranzo -> visite -> check-in -> visite serali -> rientro in hotel`
Questo si ottiene combinando `LuggagePlanningService` (`luggage_dropoff` in hotel) con `GapFillingService` e `EndOfDayClosureService`.

### 2.2 Regola B — Nessun "teletrasporto": continuità geografica della giornata
Ogni giornata deve essere una sequenza di nodi geograficamente coerenti. Viene introdotto `ContinuityValidator`: dopo lo scheduling, verifica per ogni coppia di nodi consecutivi che il gap temporale (`calculatedStartTime - prevNode.calculatedEndTime`) sia coerente con il tempo di trasferimento `DistanceCalculator` più una tolleranza.
Se un movimento non è assorbito da un'attività, il Composer emette un nodo esplicito di tipo `transfer` (`JourneyAnchorKind: 'transfer'`).

### 2.3 Regola C — Rientro obbligatorio all'alloggio
Se la giornata termina e il viaggiatore dormirà in hotel quella notte, l'ultimo nodo deve essere di tipo `accommodation_return`.
Viene introdotto `EndOfDayClosureService` come penultimo step della pipeline. Eccezioni esplicite in cui non si aggiunge il ritorno in hotel:
1. Giornata di partenza (`departure_*` chiude già la giornata).
2. Cambio alloggio (check-out di un hotel e check-in in un altro nello stesso giorno).
3. Pernottamento in treno/aereo (nessuna accommodation fisica quella notte).
4. Un altro anchor finale legittimo chiude già la giornata.

### 2.4 Regola D — Mai finestre inutilizzate (Gap > 90 minuti)
Qualunque gap temporale > 90 minuti tra due nodi consecutivi che non sia spiegato da tempo di trasferimento viene processato da `GapFillingService`:
1. Tenta di inserire un'attività candidata dal pool (`availablePlaces`), compatibile per durata, distanza e `LuggageConstraintRule`.
2. In assenza di candidati specifici adatti, tenta un blocco generico "pausa/relax" se percorribile a piedi dai nodi adiacenti.
3. Se impossibile, lascia il gap libero ma registra esplicitamente la motivazione nel `PlanningReport`.

### 2.5 Semantica "Logical Day" e flessibilità mezzanotte
Una giornata di viaggio (`getDayActivityWindow()`) non termina rigidamente alle 24:00. Se l'ultimo anchor del giorno N è un arrivo dopo mezzanotte (es. 01:30) prima di un pernottamento, appartiene logicamente alla chiusura del giorno N. `getDayActivityWindow()` restituisce campi calcolati `crossesMidnight` e `extendedEndMinutes`, letti da `EndOfDayRule`.

## 3. Conseguenze e Criteri di Accettazione

- [ ] L'ordine della pipeline in `JourneyComposer.composeDayJourneyWithSIP()` è rigoroso: 1. `LuggageStateCalculator` injection -> 2. Scheduling principale -> 3. `ContinuityValidator` -> 4. `GapFillingService` -> 5. `EndOfDayClosureService`.
- [ ] Il percorso legacy `generateDaySchedule()` (trip senza `TripSetup`) rimane invariato al 100% per garantire Zero Regression.
- [ ] I gap inspiegati sono coperti da attività o transfer espliciti, eliminando i "teletrasporti".
- [ ] Le giornate con pernottamento in hotel terminano con un nodo `accommodation_return`.
