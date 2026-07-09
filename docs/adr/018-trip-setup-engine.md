# ADR-018: Trip Setup Domain & SetupCompletionEngine

**Stato**: Proposta — decisione architetturale, dominio e engine implementati nella stessa sessione (non un'attivazione differita, vedi §0)
**Data**: Luglio 2026
**Autori**: Rocco (owner) + Claude (analisi ed estrazione)
**Riferimenti**: [PRODUCT_PRINCIPLES.md](../vision/PRODUCT_PRINCIPLES.md), [CURRENT_ROADMAP.md](../context/CURRENT_ROADMAP.md), [ADR-015](015-domain-events-purity.md), [ADR-017](017-unificazione-modello-place.md)

---

## 0. Perché un'ADR nuova, e perché scritta insieme all'implementazione

`CURRENT_ROADMAP.md` ("Motori Fase 2/3 — solo interfacce oggi") stabilisce la regola: *"Prima di implementarne uno, va scritta un'ADR che ne descriva scope e vincoli, seguendo lo stile di ADR-014 — non partire direttamente dall'interfaccia esistente assumendo che sia già una specifica sufficiente."* Verificato prima di scrivere qualunque riga di codice: **zero menzioni** di "Trip Setup"/"SetupCompletion" in tutto il repository (grep su `docs/`, `src/`, `app/`). Non esiste quindi una decisione pregressa da attivare (a differenza di ADR-015/ADR-017, dove il lavoro di sprint esegue un documento già scritto in una sessione precedente, per principio "decisione ≠ attivazione", PRODUCT_PRINCIPLES.md §9) — questa è la prima volta che il dominio Trip Setup viene definito. Scrivere l'ADR e l'implementazione nella stessa sessione è quindi coerente con lo stesso principio, non un'eccezione: non c'è nulla da "non riscrivere" perché non esisteva ancora nulla.

**Nota terminologica**: il numero "18" non collide con alcuna sequenza esistente. `PRODUCT_PRINCIPLES.md` §9 cita "un'ADR-018 ridondante" come esempio ipotetico di cosa *evitare* (un'ADR per l'implementazione di ADR-014, già decisa) — non è una prenotazione del numero. Questo documento è una decisione diversa e genuina, non quella ipotesi.

## 1. Contesto

Il dominio Trip oggi copre identità/date/status (`trip.model.ts`) e una timeline di eventi leggeri (`TripEventSchema`: `type: 'flight'|'accommodation'|'activity'|'transport'`, `startTime`/`endTime`, pensato per il calendario/timeline di viaggio). Non esiste alcuna rappresentazione strutturata delle informazioni di **logistica pre-viaggio** che un Planner (`JourneyComposer`, oggi operante solo su `PlaceRef` e date del trip) dovrebbe idealmente conoscere prima di comporre un itinerario sensato: come il viaggiatore arriva a destinazione, dove alloggia ogni notte, come si sposta localmente, quali vincoli hard/soft esistono (budget, dieta, accessibilità), quali documenti servono, quali preferenze guidano lo stile del viaggio.

**Verificato, non assunto**: `IDocumentsEngine.getUpcomingBookings(tripId): Promise<unknown[]>` esiste come contratto placeholder in `engines.types.ts` ma non ha alcuna implementazione né tipo di ritorno concreto — una sovrapposizione concettuale superficiale con `TripDocument` (§3.5), non un'implementazione da cui questa ADR debba dipendere o che debba estendere.

## 2. Cosa NON decide questa ADR

Per costruzione (vincolo esplicito della sessione): nessun Wizard UI, nessuno screen, nessun componente React, nessuna integrazione con `JourneyComposer`/Planner, nessuna persistenza (repository/store/MMKV), nessuna azione di scrittura. Questa ADR decide **solo** la forma del dominio e il calcolo di completezza — la stessa disciplina già applicata in ADR-017 Fase 1 ("solo dominio, zero adozione"). L'adozione (persistenza, wizard, collegamento al Planner) è lavoro di uno sprint futuro, non decisa qui.

## 3. Decisione — Modelli di Dominio

Tutti definiti come schemi Zod in [`trip-setup.model.ts`](../../src/domain/trip/models/trip-setup.model.ts), stesso stile di `place.model.ts` (schemi Zod + `z.infer` per i tipi TS, un solo file per un gruppo di modelli affini).

### 3.1 `Transport`

Come il viaggiatore raggiunge/lascia la destinazione (o si sposta tra città in un multi-tratta). **Distinto da `TripEvent` type `'transport'`/`'flight'`**: `TripEvent` è un'entrata di calendario generica (già esistente, non toccata da questa ADR); `Transport` è il record strutturato di setup da cui, in un futuro sprint di adozione, un `TripEvent` potrebbe essere derivato — non il contrario. Nessuna delle due sostituisce l'altra oggi.

Campi: `id`, `mode` (`flight|train|bus|car|ferry|other`), `provider?`, `origin?`, `destination`, `departureDate`, `arrivalDate?`, `bookingReference?`, `confirmed` (default `false`), `cost?`, `currency?`, `sequenceOrder?` (`number`). Invariante: se `arrivalDate` è presente, deve essere ≥ `departureDate`.

**`sequenceOrder?` — aggiunto in review indipendente (Sprint 20, revisione consenso)**: per tratte multiple nello stesso giorno (es. Volo A → Treno → Volo B), l'ordinamento implicito per `departureDate` è fragile in casi limite (stesso orario, fusi orari diversi, orari non ancora noti). Campo opzionale: se assente, l'ordine si deduce da `departureDate` (comportamento invariato, nessuna migrazione richiesta per i dati esistenti). Deliberatamente **non** introdotto un link esplicito tra segmenti (grafo/catena) — nessun consumer reale lo richiede oggi (zero adozione, per costruzione), e ADR-018 §6 applica la stessa disciplina ad altri casi (nessuna dedup/merge "non necessaria oggi"). Se un futuro sprint di adozione mostra un bisogno concreto di modellare dipendenze tra segmenti, sarà una decisione esplicita separata.

### 3.2 `Accommodation`

Dove il viaggiatore alloggia. Campi: `id`, `name`, `address?`, `checkIn`, `checkOut`, `bookingReference?`, `confirmed` (default `false`), `cost?`, `currency?`, `coordinates?`. Invariante: `checkOut` > `checkIn`.

### 3.3 `Mobility`

Come il viaggiatore si sposta **all'interno** della destinazione (distinto da `Transport`, che riguarda l'arrivo/partenza). Campi: `modes` (array non vuoto di `walking|public_transit|rental_car|rideshare|bike|other`), `hasLocalTransportPass?`, `notes?`.

### 3.4 `TripConstraint`

Vincolo che il Planner dovrebbe rispettare. Campi: `id`, `type` (`budget|dietary|accessibility|medical|pace|other`), `severity` (`hard|soft`), `description`. La distinzione `hard`/`soft` è dichiarativa qui — nessuna logica di enforcement è decisa da questa ADR (appartiene al futuro Planner).

### 3.5 `TripDocument`

Documento di viaggio necessario/posseduto. Campi: `id`, `type` (`passport|visa|insurance|vaccination|other`), `status` (`missing|pending|obtained|not_required`), `expiryDate?`, `notes?`.

### 3.6 `TripPreferences`

Preferenze morbide che orientano lo stile di pianificazione — **non** vincoli. Campi, tutti opzionali: `pace` (`relaxed|balanced|intense`), `interests?` (array libero di stringhe), `dietaryPreferences?` (array libero), `budgetLevel?` (`low|medium|high`).

**Deliberatamente non riusati/collegati**: `TravelStyle` (`context.types.ts`, oggi `type TravelStyle = string`, nessun vincolo reale), `OptimizationProfile.travelStyle`, e i 6 valori di stile del wizard di ispirazione (`culture|food|relax|photography|family|express`, in `TravelServices.editorial().getCuratedCatalog`) sono concetti di **composizione di una singola giornata** (JourneyComposer), non di preferenza dell'intero viaggio — accoppiarli ora introdurrebbe una dipendenza che il dominio Setup non richiede. Se in un futuro sprint di adozione emergerà un bisogno reale di riconciliarli, sarà una decisione esplicita, non un riuso implicito deciso qui.

### 3.7 `TripSetup` — aggregato radice

```
TripSetup {
  tripId: string
  transports?: Transport[]
  accommodations?: Accommodation[]
  mobility?: Mobility
  constraints?: TripConstraint[]
  documents?: TripDocument[]
  preferences?: TripPreferences
  createdAt: Date
  updatedAt: Date
}
```

**Regola di dominio non negoziabile — `undefined` ≠ `[]`/oggetto vuoto**: un campo `undefined` significa "l'utente non ha ancora affrontato questa sezione"; un array vuoto (`[]`) o un oggetto presente significa "l'utente l'ha affrontata ed esplicitamente non ha nulla da dichiarare" (es. nessun vincolo, nessun documento necessario). Questa distinzione è ciò che rende onesto il calcolo di completezza (§4) invece di forzare l'utente a inserire un placeholder — coerente con PRODUCT_PRINCIPLES.md §1 ("meglio un compromesso onesto che un errore silenzioso"): un array vuoto dichiarato esplicitamente non è un errore, è un fatto.

## 4. Decisione — `SetupCompletionEngine`

[`SetupCompletionEngine.ts`](../../src/domain/trip/engine/SetupCompletionEngine.ts), Domain Service puro e stateless — nessun I/O, nessuna dipendenza da `Date.now()`/`Math.random()` (PRODUCT_PRINCIPLES.md §8, determinismo), stesso pattern di `PlaceMergeEngine`/`TripCalculator` (metodi statici, testabili senza mock). Il nome "Engine" segue la stessa convenzione lessicale già usata in questo repository per calcolatori puri (`PlaceMergeEngine`, `TripCalculator`), non implica orchestrazione/side-effect (PRODUCT_PRINCIPLES.md §3).

`SetupCompletionEngine.evaluate(setup: TripSetup, tripDurationNights: number): SetupCompletionReport` — un solo metodo pubblico, deterministico rispetto ai suoi soli argomenti. `tripDurationNights` è un numero esplicito passato dal chiamante (es. `TripCalculator.getDuration(trip)`, invariato) — **non** un `Trip` intero: il Domain Service resta puro e senza dipendenza strutturale da altri aggregati (vedi §5, §6 per la motivazione di questa scelta rispetto all'alternativa scartata di accettare `Trip`).

**Sezione "completa" quando**: il campo corrispondente è definito (`!== undefined`), indipendentemente dal contenuto — un array vuoto dichiarato conta come completo (§3.7). Sei sezioni, peso uguale: `transports`, `accommodations`, `mobility`, `constraints`, `documents`, `preferences`.

`SetupCompletionReport`:
```
{
  percentage: number          // 0-100, arrotondato, sezioni complete / 6
  completedSections: SetupSectionName[]
  missingSections: SetupSectionName[]
  plannerReadiness: {
    unlocked: boolean
    missingPrerequisites: SetupSectionName[]
  }
}
```

## 5. Decisione — regole minime che sbloccano il Planner

**Verificato nel codice**: `JourneyComposer` oggi non legge alcun dato di Setup — opera solo su `PlaceRef[]` salvati e sulle date del `Trip`. Non esiste quindi un vincolo *tecnico* che leghi il Planner al Setup. Questa è perciò una decisione di **prodotto**, non una necessità scoperta nel codice — dichiarata esplicitamente come tale, non presentata come se fosse un requisito tecnico preesistente.

**Decisione**: il Planner si sblocca quando `transports` contiene **almeno un elemento**, **e** — solo se il trip copre almeno una notte (`tripDurationNights >= 1`) — anche `accommodations` contiene **almeno un elemento** (non basta che la sezione sia "toccata" con un array vuoto, a differenza della regola di completezza generale in §4). Motivazione: sono le sezioni che ancorano il Planner a un "dove" e "quando" fisico — senza almeno un trasporto noto, non esiste alcun punto di partenza temporale da cui comporre un itinerario. `mobility`, `constraints`, `documents`, `preferences` migliorano la qualità della pianificazione ma non sono prerequisiti bloccanti: un Planner può ragionevolmente proporre un itinerario senza sapere ancora se il viaggiatore preferisce i mezzi pubblici o l'auto a noleggio.

**Correzione emersa in review indipendente (Sprint 20, revisione consenso)**: la versione originale di questa sezione richiedeva sempre `accommodations` non vuoto, indipendentemente dalla durata del trip. Verificato che `Trip` supporta già trip a 0 notti (`TripCalculator.getDuration()` gestisce esplicitamente `Math.max(0, nights)`) — un viaggio in giornata (*day-trip*) è uno scenario legittimo del modello esistente, non ipotetico. La regola originale lo avrebbe bloccato ingiustamente, spingendo verso un alloggio fittizio — l'anti-pattern che PRODUCT_PRINCIPLES.md §1 ("meglio un compromesso onesto che un errore silenzioso") esiste per evitare. Corretto: `accommodations` è un prerequisito **condizionale** alla durata, non sempre obbligatorio.

Questa soglia resta deliberatamente più stretta della regola di completezza generale (§4) per le stesse sezioni — un array vuoto in `accommodations`/`transports` conta come sezione "completa" per la percentuale (l'utente ha dichiarato "nessuno"), ma **non** soddisfa da solo il prerequisito Planner (non c'è un'ancora fisica). Le due metriche possono quindi divergere legittimamente: un setup al 100% con `accommodations: []` e un trip di più notti non sblocca il Planner; un setup con solo `transports` compilato per un day-trip (0 notti) lo sblocca.

## 6. Rischi e limiti dichiarati

- **Nessuna validazione incrociata tra `Transport`/`Accommodation` e le date del `Trip`** (es. un `Accommodation.checkIn` fuori dall'intervallo `Trip.startDate`/`endDate`): fuori scope, richiederebbe accesso al `Trip` stesso, non solo al `TripSetup` — il Domain Service resta puro e non dipendente da altri aggregati.
- **Nessuna deduplica/merge** tra `Transport`/`Accommodation` multipli (a differenza di `PlaceMergeEngine`): non necessaria oggi, questi record non arrivano da un provider esterno soggetto a duplicazione.
- **La soglia di sblocco Planner (§5) è una scelta di prodotto, non tecnica** — va rivista se un futuro sprint di adozione mostra che è troppo/poco restrittiva in pratica.

**Future Work — chiusura del primo limite, non decisa/implementata ora (review indipendente, Sprint 20)**: quando la persistenza reale esisterà (§7), il limite sulla validazione incrociata data-range va chiuso con una funzione dedicata, non fondendo `TripSetup` dentro `Trip` (scartato esplicitamente — romperebbe il pattern già stabilito da ADR-017 per `TravelPlace`: aggregato satellite separato, referenziato via `tripId`, mai embedded):

```
validateSetupAgainstTrip(
  trip: Trip,
  setup: TripSetup
): DateRangeViolation[]
```

Resterebbe un Domain Service puro (riceve `Trip` come parametro esplicito, non ne dipende strutturalmente — stesso principio già applicato a `evaluate(setup, tripDurationNights)` in §4), controllando che `Transport.departureDate`/`arrivalDate` e `Accommodation.checkIn`/`checkOut` cadano entro `Trip.startDate`/`endDate`. **Solo documentazione in questa ADR**: nessuna implementazione, nessuna modifica a `Trip`, nessun cambio di persistenza in questa sessione.

## 7. Prossimo passo (non deciso qui)

Adozione: persistenza (`TripSetupRepository`/engine con storage MMKV, stesso pattern di `PlacesEngine`), wizard UI, collegamento opzionale del Planner alla soglia di sblocco. Nessuno di questi è deciso da questa ADR — richiederà una propria fase di sprint, esplicitamente fuori scope oggi.
