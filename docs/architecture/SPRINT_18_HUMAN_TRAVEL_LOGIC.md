# Sprint 18 — Human Travel Logic (Architecture First)

Stato: **Proposta di design — nessun codice scritto**
Autore: sessione Claude Code, 2026-07-15
Ambito: `JourneyComposer`, `JourneyAnchorEngine`, `TimelineRuleEngine`, `TripSetup` (Accommodation)

---

## 0. Perché questo documento

Dopo Sprint 17 (Zero Regression, 230/230 test verdi) sono emersi in simulatore 7 limiti di
dominio che il planner deterministico non gestisce (arrivo prima del check-in, nessun rientro
in hotel a fine giornata, giorni che attraversano la mezzanotte, stato bagagli, deposito
bagagli, early check-in/late check-out, tempi morti). Nessuno di questi è un bug: sono concetti
di dominio **mancanti**. Il principio guida di Sprint 18 è: **il planner deve ragionare come un
viaggiatore esperto, l'AI arriverà dopo solo per migliorare le decisioni, non per coprirne
l'assenza**.

Questo documento è stato scritto dopo aver riletto il codice esistente (non per congettura):
`JourneyComposer.ts`, `JourneyAnchorEngine.ts`, `TimelineRuleEngine.ts` + le regole in
`src/domain/services/rules/`, `context.types.ts`, `trip-setup.model.ts`, `DistanceCalculator.ts`,
tutti gli ADR in `docs/adr/`. Ogni proposta indica il punto di innesto esatto nel codice attuale.

---

## 1. Principio architetturale: nessuna nuova persistenza per stato derivabile

Decisione cardine, da cui discendono quasi tutte le altre: **lo stato dei bagagli e gli anchor
di logistica bagagli NON sono nuovi Aggregate persistiti**. Sono interamente derivabili da dati
che l'utente già inserisce (transporti + accommodation + policy hotel), esattamente come oggi
`JourneyAnchorEngine.buildTripAnchors()` deriva già `check_in`/`check_out` da `Accommodation`
senza persistere nulla di nuovo.

Motivazione:
- Coerenza con il pattern esistente (anchor = proiezione calcolata, non stato salvato).
- Zero migrazioni sullo storage MMKV cache-based (ADR-022).
- ADR-015 (Domain Events Purity) impone che il bus eventi contenga solo *fatti* persistiti: uno
  stato di bagagli ricalcolato ad ogni composizione non è un fatto, è una proiezione — quindi
  niente nuovi `DomainFactType`.

L'unica estensione persistita è un piccolo value object opzionale (`HotelPolicy`) dentro
`AccommodationSchema`, perché quella è l'unica informazione che nessun calcolo può inferire
(dipende da regole reali dell'hotel).

---

## 1.1 Quattro regole fondamentali del Composer (non negoziabili)

Le sezioni seguenti già toccavano questi punti, ma solo come effetto collaterale di altri
meccanismi. Dopo i test reali in simulatore, il team le ha promosse esplicitamente a **vincoli
non negoziabili del Composer** — vanno trattate come criteri di accettazione a sé stanti, non
come conseguenza implicita di altre feature.

### Regola A — L'hotel come hub logistico della giornata

Se l'arrivo precede il check-in di molte ore **e** esiste un deposito bagagli (hotel o
pubblico, vedi §2.2/§3.1), il planner deve trattare l'hotel come hub logistico della giornata,
non come un evento isolato nel pomeriggio. Catena attesa:

```
aeroporto → hotel (deposito bagagli) → visite → pranzo → visite → check-in
          → eventuali visite serali → rientro in hotel
```

Non è un meccanismo nuovo: è la composizione corretta di §3.1 (`LuggagePlanningService`
posiziona il `luggage_dropoff` **in hotel** quando possibile, non genericamente in città) +
scheduling normale delle attività + §3.3 (`EndOfDayClosureService`). La differenza è che questa
catena deve diventare un **test golden-path esplicito** in Fase 8 (§9), non un effetto
collaterale verificato solo indirettamente. Nessuna finestra di 8-10 ore vuota è accettabile
quando questa condizione si verifica.

### Regola B — Nessun "teletrasporto": continuità geografica della giornata

Ogni giornata deve essere una catena continua di nodi geograficamente coerenti. Non deve mai
esistere una transizione tra due nodi consecutivi (anchor o attività) che salti nel tempo senza
che il salto sia spiegato da tempo di trasferimento reale o da un gap esplicitamente gestito
(Regola D). Esempio del difetto da eliminare:

```
08:15 aeroporto  →  18:00 check-in     ❌ (salto di 10h senza spiegazione)
```

Esempio del comportamento corretto:

```
aeroporto → transfer → deposito bagagli → museo → pranzo → duomo → check-in → cena → hotel
```

Introduce una nuova invariante di validazione, **`ContinuityValidator`**: dopo lo scheduling
iniziale, percorre la timeline finale e per ogni coppia di nodi consecutivi verifica che
`nextNode.calculatedStartTime - prevNode.calculatedEndTime` sia spiegato da
`DistanceCalculator` (tempo di trasferimento reale) più un margine di tolleranza. Se il residuo
supera la soglia, il gap passa alla Regola D invece di essere lasciato come buco silenzioso.
Non è necessariamente un nuovo file/servizio di dominio — può essere una funzione pura interna
a `JourneyComposer` (è una validazione, non uno stato) — ma è un passo esplicito della pipeline,
non un side-effect implicito.

Corollario pratico: quando una transizione è puro movimento senza un'attività che la assorba
(es. aeroporto → centro città), il Composer deve emettere un nodo `transfer` esplicito
(riusando il `JourneyAnchorKind: 'transfer'` già esistente, in modo generico e non solo per il
transfer aeroportuale) così che l'itinerario visualizzato mostri il nodo di collegamento invece
di un salto invisibile.

### Regola C — Rientro obbligatorio all'alloggio

Promossa da "post-processing opzionale" (§3.3 originale) a regola fondamentale: **se la
giornata termina e il viaggiatore dormirà in hotel, l'ultimo nodo della giornata deve essere
`accommodation_return`**, salvo una delle seguenti eccezioni esplicite:

- giornata di partenza (un anchor `departure_*` chiude già la giornata);
- cambio alloggio (check-out di un'accommodation + check-in di un'altra nello stesso giorno —
  l'ultimo nodo è il nuovo check-in, non un "ritorno" al vecchio alloggio);
- pernottamento in treno/aereo (nessuna accommodation fisica quella notte — non c'è nulla a cui
  tornare);
- un altro anchor finale già presente che chiude legittimamente la giornata.

Questa lista di eccezioni sostituisce/precisa il trigger generico descritto in §3.3.

### Regola D — Mai finestre inutilizzate (soglia: gap > 90 minuti)

Regola generale del Composer, non limitata al gap arrivo→check-in della Regola A: **qualunque
gap superiore a 90 minuti** tra due nodi consecutivi, non spiegato da tempo di trasferimento
(Regola B), deve essere sottoposto a un tentativo di riempimento prima di essere accettato come
tempo libero. Nuovo servizio **`GapFillingService`** (§3.4): dato un gap, tenta in ordine:

1. un'attività candidata dal pool già disponibile al Composer (attrazioni, relax, shopping),
   compatibile per durata, distanza raggiungibile e stato bagagli (`LuggageConstraintRule`,
   §5.2);
2. un blocco generico "pausa/relax" se nessuna attrazione specifica è adatta ma il gap è
   percorribile a piedi da entrambi i nodi adiacenti;
3. **solo se davvero impossibile**, il gap resta libero — ma la decisione deve essere
   registrata in `PlanningReport` con la motivazione (nessun candidato adatto, vincoli di
   budget/ritmo, ecc.), mai lasciata silenziosa.

La Regola A è il caso specifico "gap attorno al check-in"; la Regola D generalizza lo stesso
principio a qualsiasi gap della giornata.

---

## 2. Nuovi concetti di dominio

### 2.1 `LuggageState` (value object, non persistito)

```
type LuggageState = 'WITH_LUGGAGE' | 'STORED' | 'NONE'
```

- `NONE`: il viaggiatore non ha bagagli al seguito (prima del volo d'andata, o dopo averli
  lasciati in stanza).
- `WITH_LUGGAGE`: bagagli fisicamente al seguito (appena atterrato, in transito verso il
  deposito/hotel).
- `STORED`: bagagli lasciati in un deposito (hotel o pubblico) ma il viaggiatore è libero di
  girare.

È il risultato di una funzione pura `(anchors ordinati, policy) → timeline di LuggageState`,
non un campo su `Trip` o `TripSetup`.

### 2.2 `HotelPolicy` (value object, persistito dentro `AccommodationSchema`)

Nuovo gruppo di campi **opzionali** (quindi retrocompatibili al 100%, nessuna migrazione
richiesta su dati esistenti):

```
HotelPolicy {
  luggageStorageAvailable?: boolean        // default assunto: true (quasi tutti gli hotel lo offrono)
  earlyCheckIn?: 'yes' | 'no' | 'unknown'  // default: 'unknown' → comportamento conservativo
  lateCheckOut?: 'yes' | 'no' | 'unknown'  // default: 'unknown'
}
```

`'unknown'` esiste esplicitamente per non forzare l'utente a saperlo in fase di setup: il
planner tratta `'unknown'` come `'no'` (conservativo) ma logga la decisione così che l'AI, in
una fase successiva, possa proporre di verificarlo (es. da email di conferma prenotazione).

Punto di innesto: `src/domain/trip/models/trip-setup.model.ts`, dentro `AccommodationSchema`
(oggi ha solo `checkIn`, `checkOut`, nessun campo di policy).

### 2.3 Estensione di `JourneyAnchorKind`

File: `src/core/engines/types/context.types.ts:60`. Oggi:

```
'arrival_flight' | 'arrival_airport' | 'transfer' | 'check_in' | 'activities' |
'check_out' | 'departure_transfer' | 'departure_airport' | 'departure_flight'
```

Aggiunte proposte:

```
| 'luggage_dropoff'          // bagagli lasciati (in hotel o deposito pubblico)
| 'luggage_pickup'           // bagagli ripresi
| 'accommodation_return'     // rientro serale in hotel (chiusura giornata)
```

`luggage_dropoff`/`luggage_pickup` sono **anchor derivati**, generati da
`JourneyAnchorEngine.buildTripAnchors()` insieme agli altri. `accommodation_return` è diverso
per natura: non può essere calcolato al momento della costruzione degli anchor (dipende da dove
finisce l'ultima attività pianificata, che non esiste ancora a quel punto) — vedi §4.2.

### 2.4 "Logical Day" / continuità oltre la mezzanotte

Non un nuovo aggregate, ma un chiarimento semantico: una giornata di viaggio non termina
rigidamente a `24:00`. Se l'ultimo anchor del giorno N è un arrivo (es. volo che atterra
01:30 del giorno N+1) e non c'è ancora stato un pernottamento, quell'arrivo appartiene
logicamente alla chiusura del giorno N. Formalizzato come flag calcolato
(`crossesMidnight`, `extendedEndMinutes`) restituito da `getDayActivityWindow`, non come nuovo
modello dati.

---

## 3. Nuovi Domain Service

Nessuno di questi è un nuovo Aggregate — sono servizi stateless, stesso pattern di
`DistanceCalculator`.

### 3.1 `LuggagePlanningService` (nuovo file)

Responsabilità unica: dati gli anchor "grezzi" (arrivo, check-in, check-out, partenza) e la
`HotelPolicy` dell'accommodation coinvolta, produce gli anchor `luggage_dropoff`/
`luggage_pickup` da inserire nella timeline. Logica (per il gap arrivo→check-in, simmetrica per
check-out→partenza):

1. Calcola `gap = check_in.startISO - arrival.endISO`.
2. Se `gap` è sotto una soglia trascurabile (es. 45 min) → nessun anchor aggiuntivo, il gap è
   assorbito come attesa normale.
3. Se `policy.earlyCheckIn === 'yes'` → il check-in anchor si sposta all'orario di arrivo
   effettivo (early check-in "gratuito" dal punto di vista dello scheduling); niente stato
   bagagli intermedio.
4. Altrimenti, se `policy.luggageStorageAvailable !== false` → genera **un solo**
   `luggage_dropoff` anchor, posizionato in hotel, subito dopo l'anchor di arrivo (il
   viaggiatore passa in hotel, lascia i bagagli anche se la stanza non è pronta). Il pickup
   coincide con il `check_in` anchor stesso — non serve un secondo anchor.
5. Altrimenti (nessun deposito in hotel, `luggageStorageAvailable === false`) → genera
   `luggage_dropoff` presso un deposito pubblico (coordinate: **fallback esplicito** = coordinate
   dell'accommodation o centroide destinazione, finché una ricerca reale del deposito non sarà
   disponibile — limite noto, vedi §7) e un `luggage_pickup` poco prima del `check_in`.

Punto di innesto: chiamato da `JourneyAnchorEngine.buildTripAnchors()` come step aggiuntivo dopo
la costruzione degli anchor base — stesso file, non una nuova pipeline parallela.

### 3.2 `LuggageStateCalculator` (nuovo file, funzione pura)

Input: lista di anchor ordinati cronologicamente (incluso `luggage_dropoff`/`luggage_pickup`).
Output: funzione `minutesSinceMidnight → LuggageState`, usata dal Rule Engine (§5) per sapere,
per ogni candidato in fase di scheduling, se il viaggiatore ha bagagli al seguito in quel
momento. Nessuna dipendenza da `JourneyComposer` — puro, testabile in isolamento con tabelle di
casi (arrivo mattina + check-in pomeriggio + storage, arrivo notte + no storage, ecc.).

### 3.3 `EndOfDayClosureService` (nuovo file)

Responsabilità: dopo che `JourneyComposer` ha riempito la finestra di attività del giorno,
decide se serve un `accommodation_return` leg finale e lo aggiunge. Trigger:

- esiste un'accommodation attiva per la notte di quel giorno (check-in già passato, check-out
  non ancora raggiunto), **e**
- l'ultimo evento pianificato non è già in prossimità dell'accommodation (soglia distanza), **e**
- il giorno non è già chiuso da un anchor `check_out`/`departure_*` (giorno di partenza — in quel
  caso non si torna in hotel, si parte).

Se il trigger scatta, calcola il tempo di rientro con `DistanceCalculator` (stesso servizio già
usato da `TravelTimeRule`) e appende un `PlaceRef` sintetico `anchorType: 'accommodation_return'`.
Se il rientro renderebbe la giornata irrealisticamente lunga, il servizio segnala (via
`PlanningReport`, non via eccezione) che l'ultima attività andrebbe accorciata o rimossa — la
decisione di *quale* attività tagliare resta al Rule Engine/Composer, questo servizio non
riscrive lo scheduling già fatto.

Il trigger implementa esattamente le eccezioni della **Regola C** (§1.1): niente rientro se il
giorno è di partenza, se c'è un cambio alloggio, se il pernottamento è in treno/aereo, o se un
altro anchor finale chiude già la giornata.

Punto di innesto: chiamato da `JourneyComposer.composeDayJourneyWithSIP()` come step
**penultimo** della pipeline (dopo il gap-filling di §3.4, prima di restituire
`TimelineDaySchedule`) — l'ordine conta: prima si riempiono i buchi intra-giornata, solo alla
fine si decide se serve il rientro finale.

### 3.4 `GapFillingService` (nuovo file) — implementa la Regola D

Responsabilità: dopo lo scheduling iniziale e dopo che `ContinuityValidator` (§3.5) ha
individuato i gap non spiegati da trasferimento, tenta di riempire ogni gap > soglia (default
90 min, configurabile — vedi §12) con un candidato dal pool già passato al Composer
(`availablePlaces`), rispettando le stesse regole di `TimelineRuleEngine` (non bypassa
`LuggageConstraintRule`, `EndOfDayRule`, ecc. — riusa `timelineRuleEngine.evaluate()` sui
candidati non ancora piazzati). Se nessun candidato supera una soglia minima di qualità, prova
un blocco generico "pausa/relax"; se anche questo non è sensato (nodi troppo distanti tra loro
per essere collegati a piedi), lascia il gap libero e lo registra in `PlanningReport` con la
motivazione — mai silenziosamente.

Punto di innesto: chiamato da `JourneyComposer.composeDayJourneyWithSIP()` subito dopo lo
scheduling principale, prima di `EndOfDayClosureService`.

### 3.5 `ContinuityValidator` — implementa la Regola B

Non necessariamente un nuovo file di dominio: è una validazione, non uno stato. Può essere una
funzione pura interna a `JourneyComposer` (o un piccolo helper stateless se la logica cresce).
Percorre la timeline finale, confronta ogni transizione con il tempo di trasferimento atteso
(`DistanceCalculator`), e per ogni residuo oltre soglia lo passa a `GapFillingService` (§3.4)
invece di lasciarlo passare inosservato. È il meccanismo che rende impossibile, strutturalmente,
il caso "08:15 aeroporto → 18:00 check-in" senza spiegazione.

---

## 4. Modifiche a `JourneyAnchorEngine`

File: `src/domain/services/JourneyAnchorEngine.ts`.

1. `buildTripAnchors()` (linea 64): dopo aver costruito gli anchor base, invoca
   `LuggagePlanningService` per ogni coppia arrivo→check-in e check-out→partenza, e concatena
   gli anchor risultanti alla lista.
2. `ARRIVAL_KINDS`/`DEPARTURE_KINDS` (linee 29-30): **non** includere `luggage_dropoff`/
   `luggage_pickup` — non sono arrivi/partenze del viaggio, sono vincoli intra-giornata. Vanno
   invece trattati come confini rigidi nella finestra di attività (vedi punto 3).
3. `getDayActivityWindow()` (linea 239): deve considerare anche `luggage_dropoff`/
   `luggage_pickup` come blocchi immutabili all'interno della finestra (stesso trattamento di
   `check_in`/`check_out` oggi), e restituire `{ startMinutes, endMinutes, crossesMidnight,
   extendedEndMinutes }` invece del solo range — estensione additiva della shape di ritorno.
4. `toPlaceRefs()` (linea 276): deve saper proiettare anche i nuovi `JourneyAnchorKind` in
   `PlaceRef` (label, durata, categoria "logistics" così da poter essere riconosciuti dal Rule
   Engine e distinti dalle vere attrazioni).
5. **Non** tocca `accommodation_return`: quell'anchor è calcolato a valle, da
   `EndOfDayClosureService`, non qui (vedi §3.3 sul perché).

---

## 5. Modifiche al Rule Engine

File: `src/domain/services/rules/`.

### 5.1 `TimelineContext` (in `rules.types.ts`) — estensione additiva

```
interface TimelineContext {
  ...
  luggageState?: LuggageState   // nuovo campo opzionale
}
```

Popolato da `JourneyComposer` usando `LuggageStateCalculator` prima di invocare
`timelineRuleEngine.evaluate()` per ogni candidato.

### 5.2 Nuova regola `LuggageConstraintRule`

Implementa `ITimelineRule`. Se `context.luggageState === 'WITH_LUGGAGE'`, penalizza (score
negativo, **non** `reject` hard di default) i candidati con categorie incompatibili con bagagli
al seguito (hike lunghi, tour in barca, musei con policy bag-check rigida). Registrata in
`TimelineRuleEngine` con un nuovo peso in `TIMELINE_RULE_WEIGHTS`
(`src/domain/config/timeline-rule-weights.ts`), **inizializzato basso** — l'obiettivo Sprint 18
è che il vincolo esista e sia osservabile in `PlanningReport`, non che riscriva
aggressivamente gli itinerari esistenti. Il tuning del peso è lavoro successivo basato su
feedback reale (coerente con "l'AI arriverà dopo").

### 5.3 `EndOfDayRule` — aggiornamento, non riscrittura

Deve leggere `extendedEndMinutes`/`crossesMidnight` da `TimelineContext.effectiveDayEnd` (già
presente come campo) invece di assumere `1440` fisso. Se `crossesMidnight` è assente/false, il
comportamento è identico a oggi — nessuna regressione per i viaggi che non attraversano la
mezzanotte.

### 5.4 `SmartMealRule` — nessuna modifica richiesta in Sprint 18

Segnalato come possibile raffinamento futuro (es. evitare pranzi seduti lunghi con bagagli al
seguito) ma fuori perimetro: non è uno dei 7 problemi elencati, e aggiungerlo ora violerebbe il
principio "una modifica, un problema" di Zero Regression.

---

## 6. Modifiche a `JourneyComposer`

File: `src/domain/services/JourneyComposer.ts`.

La pipeline completa di `composeDayJourneyWithSIP()`, con l'ordine dei nuovi step (l'ordine è
significativo — ognuno assume che il precedente sia già stato eseguito):

1. Calcola la timeline di `LuggageState` per il giorno (via `LuggageStateCalculator`) e la
   inietta in ogni `TimelineContext` passato a `timelineRuleEngine`.
2. Scheduling principale delle attività (comportamento esistente, invariato).
3. **`ContinuityValidator`** (§3.5, Regola B): percorre la timeline risultante e individua i gap
   non spiegati da tempo di trasferimento.
4. **`GapFillingService`** (§3.4, Regola D): per ogni gap individuato al punto 3, tenta il
   riempimento con candidati residui, rispettando `timelineRuleEngine`.
5. **`EndOfDayClosureService`** (§3.3, Regola C): solo ora, a schedule ormai stabile, decide se
   serve `accommodation_return`.
6. `generateDaySchedule()` (percorso legacy senza anchor reali, linea ~96): **non toccare**. È
   il fallback per trip senza `TripSetup`/accommodation — deve restare byte-identico per non
   rompere i trip esistenti che non hanno ancora dati di accommodation. I punti 3-5 si applicano
   solo al percorso con anchor reali (`composeDayJourneyWithSIP`).
7. Uso di `extendedEndMinutes`/`crossesMidnight` (da `getDayActivityWindow`) al posto del
   cutoff fisso di fine giornata, ovunque oggi si confronta `currentMinutesSinceMidnight` con un
   limite hardcoded.

La combinazione dei punti 1-5 è ciò che realizza la **Regola A** (hotel come hub): non è un
meccanismo dedicato, ma l'effetto naturale di avere `luggage_dropoff` posizionato in hotel
(§3.1) + gap-filling attorno al check-in (punto 4) + rientro finale (punto 5).

---

## 7. Limiti noti (non risolti in Sprint 18, da documentare esplicitamente)

- **Coordinate del deposito bagagli pubblico**: quando l'hotel non offre storage, l'anchor
  `luggage_dropoff` usa un fallback (coordinate accommodation/centroide destinazione) invece di
  una ricerca reale di un deposito (es. Bounce/Nannybag). Risolvere questo richiede
  un'integrazione con il Places engine — esplicitamente fuori perimetro, proposto come Sprint
  19+ (item "Fase 2" in §9).
- **`canonicalPlaceToPlaceRef` non porta tutti i campi** (`notes`, `isVisited`, `role`,
  `anchorType`, `durationMinutes` — debito noto in `docs/context/KNOWN_DEBT.md` / ADR-017). I
  nuovi `anchorType` (`luggage_dropoff`, `luggage_pickup`, `accommodation_return`) rischiano di
  essere silenziosamente persi nello stesso modo se questo mapper non viene corretto prima. **Va
  verificato/risolto prima della Fase 3** dell'ordine di implementazione sotto, altrimenti i
  nuovi anchor non sopravvivono al round-trip di persistenza.
- **UI**: form di accommodation (`AccommodationForm.tsx`) non espone ancora i campi
  `HotelPolicy` — fuori perimetro di questo documento (è un task di frontend separato,
  successivo all'engine).

---

## 8. ADR consigliate

- **ADR-023 — Luggage Domain Model & Anchor Extension**: `LuggageState`, `HotelPolicy`,
  `LuggagePlanningService`, i nuovi `JourneyAnchorKind` (`luggage_dropoff`/`luggage_pickup`),
  motivazione della scelta "nessuna nuova persistenza" (§1).
- **ADR-024 — End-of-Day & Intra-Day Continuity**: `accommodation_return`,
  `EndOfDayClosureService`, `ContinuityValidator`, `GapFillingService`, semantica "Logical Day"
  e gestione mezzanotte (`crossesMidnight`/`extendedEndMinutes`), modifica a `EndOfDayRule`.
  Copre esplicitamente le quattro regole fondamentali del Composer (§1.1: hotel-hub,
  no-teletrasporto, rientro obbligatorio, no-finestre-vuote) come criteri di accettazione
  dell'ADR.

Due ADR separate perché sono due decisioni indipendentemente reversibili: si potrebbe accettare
ADR-023 (bagagli) senza ADR-024 (continuità giornata), o viceversa, senza che l'una dipenda
dall'implementazione dell'altra.

---

## 9. Ordine di implementazione consigliato

Ogni fase è mergeable e testabile isolatamente; nessuna fase rompe il comportamento delle fasi
precedenti (additivo, campi opzionali, default = comportamento attuale).

| Fase | Contenuto | Rischio se saltata/invertita |
|---|---|---|
| 0 | Scrivere ADR-023 e ADR-024 (solo documentazione) | — |
| 1 | Aggiungere `HotelPolicy` (opzionale) a `AccommodationSchema` + verificare che Zod/MMKV cache (ADR-022) non richiedano migrazione | Bloccante per tutto il resto |
| 2 | Fix/verifica `canonicalPlaceToPlaceRef` per i nuovi campi anchor (debito ADR-017, vedi §7) | I nuovi anchor "spariscono" silenziosamente dopo il primo salvataggio |
| 3 | `LuggageStateCalculator` come funzione pura, testata in isolamento, **non ancora collegata** a nulla | — |
| 4 | Estensione `JourneyAnchorKind` + `LuggagePlanningService` + wiring in `buildTripAnchors()` + `toPlaceRefs()` | Deve precedere Fase 6 (la regola ha bisogno degli anchor per avere senso) |
| 5 | `crossesMidnight`/`extendedEndMinutes` in `getDayActivityWindow()` + `EndOfDayRule` aggiornata | Regressione su trip esistenti se il default non è "comportamento identico" |
| 6 | `TimelineContext.luggageState` + `LuggageConstraintRule` (peso basso) in `TimelineRuleEngine` | — |
| 7 | `ContinuityValidator` (Regola B) — solo individuazione dei gap, nessun riempimento ancora | Deve precedere Fase 8: il gap-filling ha bisogno dei gap già individuati |
| 8 | `GapFillingService` (Regola D), wiring dopo `ContinuityValidator` in `composeDayJourneyWithSIP()` | Rischio over-filling se non rispetta le soglie di qualità — vedi §10 |
| 9 | `EndOfDayClosureService` (Regola C, con le 4 eccezioni esplicite) + wiring come step finale della pipeline | Deve essere l'ultimo step: dipende da scheduling **e** gap-filling già completi |
| 10 | Suite di regressione completa (230+ test esistenti) + un test golden-path per ciascuno dei 7 problemi originali **più** un test dedicato per ciascuna delle 4 regole fondamentali (§1.1), come test di integrazione su `JourneyComposer.compose()` | Gate di merge |
| 11 (backlog, fuori Sprint 18) | Ricerca reale deposito bagagli pubblico (Places engine); UI `HotelPolicy` nel form accommodation | — |

---

## 10. Rischi

1. **Over-triggering del rientro in hotel** su trip senza pernottamento (gita di un giorno) —
   mitigato dal trigger esplicito "accommodation attiva quella notte" in `EndOfDayClosureService`.
2. **`LuggageConstraintRule` troppo aggressiva** → giornate vuote (stesso rischio già osservato
   in ADR-016, "Journey Score NaN edge case"). Mitigazione: penalità soft, mai hard-reject di
   default; peso iniziale basso, osservabile via `PlanningReport`.
3. **Blast radius di `getDayActivityWindow`**: è usata da *ogni* giorno di *ogni* trip. Qualsiasi
   modifica alla sua shape di ritorno ha impatto ampio — mitigato rendendo i nuovi campi
   opzionali con default = comportamento attuale, e richiedendo la Fase 8 (regressione completa)
   come gate obbligatorio prima del merge.
4. **Anchor placeholder senza coordinate reali** (deposito pubblico, §7) possono rompere
   `DistanceCalculator.calculateHaversineDistance` se non viene garantito un fallback valido —
   `LuggagePlanningService` deve sempre fornire una `GeoLocation` valida, mai `undefined`.
5. **Debito ADR-017 non risolto** (mapper `canonicalPlaceToPlaceRef` incompleto) può silenziare
   il lavoro di Sprint 18 dopo il primo salvataggio — per questo la Fase 2 è messa prima delle
   fasi che introducono nuovi `anchorType`.
6. **`GapFillingService` troppo aggressivo** (Regola D): forzare un filler di bassa qualità in
   ogni gap peggiora l'itinerario invece di migliorarlo. Mitigazione: soglia minima di qualità
   (score da `timelineRuleEngine`, non solo "c'è un posto libero nel pool") sotto la quale il
   gap resta intenzionalmente libero, sempre loggato in `PlanningReport`.
7. **`ContinuityValidator` troppo rigido**: se la soglia di tolleranza sul tempo di
   trasferimento è troppo bassa, ogni micro-gap fisiologico (attesa, pausa naturale) viene
   trattato come "teletrasporto" e passato inutilmente a `GapFillingService`, generando
   itinerari sovraffollati. Mitigazione: soglia di tolleranza esplicita e distinta dalla soglia
   di gap-filling (90 min) — la prima decide "cosa è un salto", la seconda "cosa vale la pena
   riempire" (vedi §12 per i valori da validare).

## 11. Regressioni da evitare (checklist di verifica pre-merge)

- [ ] Trip senza `TripSetup`/accommodation: `generateDaySchedule()` (percorso legacy) invariato.
- [ ] Trip con accommodation ma senza `HotelPolicy` compilata: comportamento = `'unknown'` →
      conservativo, ma non deve bloccare/rompere la generazione esistente.
- [ ] Trip senza attraversamento di mezzanotte: `EndOfDayRule` produce lo stesso score di prima
      (nessuna differenza numerica nei test esistenti).
- [ ] Nessun nuovo `DomainFactType` aggiunto a `events.types.ts` (coerenza con ADR-015).
- [ ] `ARRIVAL_KINDS`/`DEPARTURE_KINDS` non riclassificano anchor esistenti.
- [ ] Suite Jest esistente (230/230 all'ultimo handoff) resta verde.
- [ ] **Regola A**: golden-path test con arrivo mattutino + check-in pomeridiano + deposito
      disponibile → nessuna finestra vuota > 90 min, hotel usato come hub.
- [ ] **Regola B**: nessun test esistente né nuovo produce due nodi consecutivi con gap non
      spiegato da `DistanceCalculator` oltre la soglia di tolleranza.
- [ ] **Regola C**: golden-path test per ciascuna delle 4 eccezioni (partenza, cambio hotel,
      pernottamento in transito, altro anchor finale) — in nessuno di questi casi viene
      generato un `accommodation_return` spurio.
- [ ] **Regola D**: golden-path test con gap artificiale > 90 min in mezzo alla giornata (non
      legato al check-in) → riempito se esiste un candidato adatto, lasciato libero e loggato
      se no.

---

## 12. Decisioni aperte (da prendere con il team, non decise unilateralmente qui)

- **Numerazione sprint**: `docs/context/SESSION_HANDOFF.md` ha la roadmap Sprint 17/18 ancora
  intestata a "Traveler DNA / Memory Intelligence" (ADR-014), non a questo lavoro. Va deciso se
  questo lavoro è "Sprint 18" (rinumerando la roadmap Traveler DNA più avanti) o se va chiamato
  Sprint 19 per non creare confusione nella documentazione storica.
- **Soglia di "gap trascurabile"** in `LuggagePlanningService` (proposta: 45 min) e **soglia di
  distanza "già vicino all'accommodation"** in `EndOfDayClosureService`: valori da validare con
  dati reali di viaggio, non solo intuizione architetturale.
- **Peso iniziale di `LuggageConstraintRule`** in `TIMELINE_RULE_WEIGHTS`: proposto basso per
  Sprint 18, ma il valore esatto è una decisione di prodotto/UX, non puramente architetturale.
- **Soglia di gap-filling (Regola D)**: 90 minuti proposto esplicitamente dal team, adottato
  come default in questo documento — ma resta configurabile, non hardcoded, per eventuale
  tuning post-lancio.
- **Soglia di tolleranza di `ContinuityValidator` (Regola B)**: distinta dalla soglia di
  gap-filling — decide cosa conta come "teletrasporto" da correggere strutturalmente, prima
  ancora di decidere se vale la pena riempirlo. Valore da definire (proposta di partenza:
  tempo di trasferimento calcolato + 15 min di margine fisiologico).
- **Soglia minima di qualità per i filler di `GapFillingService`**: sotto quale score
  (`timelineRuleEngine`) un candidato è "meglio di niente" vs "meglio lasciare il gap libero
  e trasparente" — decisione di prodotto, non solo tecnica.
