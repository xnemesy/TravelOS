# ADR-025: Modello Temporale Canonico (Instant + Fuso Orario Esplicito)

**Stato**: Accettata (revisione 2 — vedi Changelog)
**Data**: Luglio 2026
**Ambito**: `JourneyAnchorEngine`, `JourneyComposer`, `EndOfDayClosureService`, `LuggagePlanningService`, `GapFillingService`, `TimelineRuleEngine` e regole, `DistanceCalculator`, `trip-setup.model.ts` (Transport/Accommodation), livello UI di formattazione orari
**Riferimenti**: [ADR-023](023-luggage-domain-model-anchor-extension.md), [ADR-024](024-end-of-day-intraday-continuity.md), [SPRINT_18_HUMAN_TRAVEL_LOGIC](../architecture/SPRINT_18_HUMAN_TRAVEL_LOGIC.md)

> Questo documento resta una **proposta architetturale** ai fini implementativi: nessun codice di dominio esistente è stato migrato sulla base di questo ADR finché non viene pianificato in sprint dedicati (vedi §10). Lo stato "Accettata" si riferisce alla decisione architetturale in sé, incorporate le revisioni richieste in fase di review (vedi Changelog).

> **Stato di implementazione** (aggiornato 2026-07-18):
> - **Fase 0 (fondamenta isolate)** — ✅ costruita: `src/domain/time/` (`InstantISO`, `IanaTimeZone`, `ZonedInstant`) e `src/infrastructure/time/` (`TemporalService`, `DefaultTemporalService`), con test esaustivi.
> - **Fase 1 (`TimeZoneResolver` + `PlaceGeography`)** — ✅ costruita: `StaticTimeZoneResolver` (tabella IATA + ancore città + fallback esplicito).
> - **Sprint 18.5 (wiring DI)** — ✅ fatto: i servizi sono esposti come singleton di modulo dal composition root `src/infrastructure/time/index.ts` (`temporalService`, `timeZoneResolver`), stessa convenzione di `TravelServices`. Puramente additivo, zero cambi di comportamento, **nessun consumatore di dominio ancora migrato**. Design: [2026-07-18-temporal-infra-di-wiring-design.md](../superpowers/specs/2026-07-18-temporal-infra-di-wiring-design.md).
> - **Fase 2+ (migrazione `JourneyAnchorEngine`, `GapFillingService`, `JourneyComposer`, …)** — ⬜ non iniziata.

## Changelog

- **Revisione 2** (review architetturale): accolte due richieste di modifica prima del merge:
  1. Bandito `Date` come tipo di dominio; introdotto `InstantISO` (tipo branded su stringa ISO-8601 UTC) come unica rappresentazione di dominio di un instante — vedi §3, §4, §6.
  2. Ridefinito il fuso orario come dato **derivato dall'entità geografica** (aeroporto, hotel, stazione, POI) tramite un `TimeZoneResolver` dedicato, anziché duplicato indipendentemente su ogni `JourneyAnchor` — vedi §4, §6, §9.
- **Revisione 1**: bozza iniziale (§1-14 come da task originale).

---

## 1. Problemi attuali

Un'analisi puntuale del codice ha confermato che Travel OS non ha oggi un modello temporale unico, ma quattro convenzioni diverse e incompatibili, ciascuna introdotta indipendentemente dal servizio che l'ha scritta:

| Servizio | Convenzione usata | Evidenza |
|---|---|---|
| `JourneyAnchorEngine.dateStrOf()` / `minutesOfISO()` | Metodi **locali** di `Date` (`getFullYear()`, `getMonth()`, `getDate()`, `getHours()`, `getMinutes()`) | righe 42-53 |
| `JourneyComposer.composeDayJourneyWithSIP()` | Lettura **UTC** (`getUTCHours()`/`getUTCMinutes()`) di un `scheduledTime`, ma scrittura tramite costruzione **locale** (`new Date(year, month, day, ...)`) seguita da `toISOString()` | riga 690 (lettura UTC), righe 756-760 (scrittura locale) |
| `EndOfDayClosureService` / `LuggagePlanningService` | Utility esplicite **UTC** (`toDateStrUTC`/`dateStrOfUTC`), dichiaratamente per essere indipendenti dal fuso del device | commenti in testa ai file |
| `GapFillingService` (nuovo, Sprint 18 Fase 8) | Fallback **UTC** (`getUTCHours()`/`getUTCMinutes()`) su `scheduledTime`, scelto per coerenza con `JourneyComposer` riga 690 | `placeInterval()` |

Conseguenze concrete già identificate:

1. **Bug di rientro in hotel**: `JourneyComposer` costruisce `accommodation_return.scheduledTime` con `new Date(anno, mese, giorno, ...)` — che usa il fuso **del device che esegue il codice** — e lo serializza con `toISOString()`. Qualunque lettore a valle che usi `getUTCHours()` (incluso lo stesso Composer, `GapFillingService`, e potenzialmente altri) recupera l'ora corretta **solo se il device ha offset UTC 0** nel momento dell'esecuzione. Vero quasi sempre in CI/Jest (default `TZ=UTC`), falso su un telefono fisico con fuso non-UTC.
2. **Incoerenza intra-pipeline**: nella stessa composizione di una giornata, `JourneyAnchorEngine` (locale) alimenta `JourneyComposer` (UTC in lettura, locale in scrittura) che alimenta `EndOfDayClosureService`/`LuggagePlanningService` (UTC esplicito) — tre sistemi di riferimento diversi attraversati nella stessa richiesta.
3. **Nessun fuso orario nel modello dati**: `trip-setup.model.ts` definisce `Transport.departureDate`/`arrivalDate` e `Accommodation.checkIn`/`checkOut` come semplici `z.date()`, senza alcun campo che indichi *in quale fuso orario* quell'istante rappresenta un orario locale significativo. Non esiste modo, oggi, di rispondere alla domanda "che ore sono a destinazione quando parte questo volo?" — il dato per farlo non è mai stato catturato.
4. **"HH:mm" come valuta di scambio tra servizi**: `PlaceRef.calculatedStartTime`/`calculatedEndTime` sono stringhe `"HH:mm"` prive di data e di fuso, usate non solo per la UI ma come input di logica di dominio (`GapFillingService.placeInterval`, `JourneyComposer.parseTime`, `detectFreeTimeSlots`). Una stringa "14:00" non è un instante: senza fuso è **priva di significato univoco**.
5. **Nessuna gestione DST esplicita**: l'aritmetica su minuti-da-mezzanotte (`addMinutesISO`, accumulo di `currentMinutesSinceMidnight`) attraversa il cambio ora legale senza alcuna consapevolezza del fenomeno: un'ora può sparire (marzo) o ripetersi (novembre) a seconda del fuso, e nessun codice attuale se ne accorge.
6. **Il problema è invisibile nei test attuali**: nessuna suite (`JourneyComposer.test.ts`, `JourneyAnchorEngine.test.ts`, `EndOfDayClosureService.test.ts`, `GapFillingService.test.ts`) usa fusi diversi da UTC o esegue con `TZ` diverso da quello di CI. I test verificano quindi la coerenza **interna** delle funzioni, non la loro correttezza rispetto a un fuso di destinazione reale — motivo per cui il problema non è mai emerso in pipeline.

## 2. Causa radice

Non è un singolo bug: è l'**assenza di una decisione architetturale esplicita** su cosa rappresenti "un momento" in Travel OS. Ogni servizio, introdotto in fasi diverse dello Sprint 18 da autori/contesti diversi, ha risolto localmente il problema minimo che aveva davanti (es. "confrontare due date senza rompersi in CI" → UTC; "leggere un orario già presente su un oggetto" → il metodo `Date` più comodo sottomano), senza un contratto condiviso.

La causa radice più profonda è al livello del **modello dati**: senza un campo di fuso orario esplicito su `Transport`/`Accommodation`/`JourneyAnchor`, nessuna implementazione — per quanto tecnicamente corretta — può recuperare "l'ora locale a destinazione" da un `Date`/ISO instant da solo. Un `Date` JavaScript è sempre e solo un instante assoluto (epoch); il fuso è un dato *aggiuntivo*, legato al luogo dell'evento, non al momento in sé, e oggi quel dato non viene mai catturato né trasportato.

Finché questo secondo problema (dato mancante) non viene risolto, qualunque fix del primo problema (codice inconsistente) sarebbe correzione di sintomi: si potrebbe rendere tutto il codice internamente coerente (es. "tutto UTC") e il bug di fondo — mostrare l'ora sbagliata a un viaggiatore a New York — rimarrebbe intatto, perché UTC non è l'ora locale di nessuna destinazione reale.

## 3. Modello temporale canonico

Si adotta il modello standard dell'industria per software che ragiona su eventi geolocalizzati nel tempo (lo stesso di `java.time`, della TC39 Temporal API, di Luxon/date-fns-tz): **Instant + Fuso Orario Esplicito**.

- **Instant**: un punto assoluto e univoco sulla linea del tempo universale, indipendente da qualunque fuso, rappresentabile come epoch/UTC. È l'unica rappresentazione legittima per: identità, ordinamento, confronto, durata tra due eventi, persistenza.
- **Fuso Orario (IANA Time Zone Identifier)**: una stringa come `"Europe/Rome"`, `"America/New_York"`, `"America/Los_Angeles"`, `"Asia/Tokyo"` — mai un offset numerico fisso (`+01:00`), perché l'offset di un fuso IANA *cambia nel tempo* (DST) mentre l'identificativo no.
- **ZonedInstant** (nome proposto per il value object): la coppia `{ instant: Instant, timeZone: IanaTimeZone }`. È l'unica rappresentazione legittima per: mostrare/inserire un orario "locale" comprensibile a un umano, calcolare il giorno di calendario, calcolare minuti-da-mezzanotte, valutare finestre pasto/orari apertura, decidere confini di giornata.

Principio guida: **un `Date`/instante senza un fuso esplicito non ha un'"ora locale"**. Non esiste "l'ora" di un volo o di un check-in senza specificare *dove*. Il fuso non è un dettaglio di formattazione: è parte del significato del dato.

Corollario architetturale: il fuso di un evento è determinato dal **luogo dell'evento**, mai dal device che esegue il codice o dal fuso dell'utente che sta pianificando. Un utente a Roma che pianifica un viaggio a Tokyo deve vedere gli orari di Tokyo in ora di Tokyo, anche se il suo telefono è impostato su `Europe/Rome`.

**Secondo corollario, aggiunto in revisione — `Date` non è mai un tipo di dominio.** L'oggetto `Date` di JavaScript è mutabile, espone di default gli stessi metodi "locali" che questo ADR vieta (§6), e non sopravvive alla persistenza: `MMKVAdapter` (`get()`/`set()`, [mmkv.adapter.ts:45,54](../../src/core/storage/mmkv.adapter.ts)) esegue `JSON.stringify`/`JSON.parse` senza alcun reviver — un campo oggi tipizzato `z.date()` che attraversa un ciclo di persistenza torna una stringa nuda, non un `Date`, silenziosamente. Il modello dei tipi deve riflettere questa realtà anziché fingerla: nessuna interfaccia di dominio (`Transport`, `Accommodation`, `JourneyAnchor`, `PlaceRef`) espone `Date` come tipo di un campo temporale. Il tipo di dominio è `InstantISO` (§4): un instante è, a tutti gli effetti nel dominio, una stringa ISO-8601 UTC con un vincolo di tipo che ne impedisce la confusione con una stringa qualunque.

## 4. Rappresentazione interna raccomandata

### 4.1 `InstantISO` — il tipo di dominio per un instante

Non `Date`, non una stringa qualunque: un tipo *branded* (nominal typing su base strutturale, pattern standard in TypeScript strict) che a runtime è una stringa ISO-8601 UTC con `Z` esplicito, ma a compile-time non è intercambiabile con `string`:

```ts
type InstantISO = string & { readonly __brand: 'InstantISO' };
```

Costruibile solo tramite `TemporalService.now(): InstantISO` o `TemporalService.parseInstant(iso: string): InstantISO` (che valida il formato), mai con un cast libero. Questo è il **solo** tipo con cui un instante attraversa un confine di modulo, uno schema Zod, o la persistenza — sostituisce `z.date()` ovunque nel dominio (`Transport.departureDate`, `Accommodation.checkIn`/`checkOut`, `JourneyAnchor.startISO`/`endISO`, `PlaceRef.scheduledTime`).

`Date` resta legittimo **solo** in due punti, entrambi ai margini del sistema, mai nel dominio: (a) dentro l'implementazione di `TemporalService`, come dettaglio privato mai esposto; (b) nei componenti UI di input (date/time picker nativi), che convertono immediatamente il valore scelto in `InstantISO` tramite `TemporalService` prima che tocchi qualunque livello di dominio.

Nota di migrazione: poiché la persistenza attuale (§3, secondo corollario) già degrada silenziosamente `Date` a stringa dopo un ciclo MMKV, la migrazione a `InstantISO` **corregge** un comportamento oggi solo accidentalmente non distruttivo, non introduce un rischio nuovo — vedi §7 Fase 1bis.

### 4.2 Il fuso orario è derivato dal luogo, non duplicato per evento

**Revisione della bozza iniziale**: la prima stesura di questo ADR proponeva un campo `timeZone` scritto indipendentemente su `Transport` (per-endpoint), `Accommodation` e ripetuto su `JourneyAnchor`. In revisione, questo è stato corretto: un fuso orario è una proprietà del **luogo**, non dell'evento — duplicarlo su ogni entità che se ne serve introduce esattamente il rischio che questo ADR combatte altrove (due fonti che possono divergere silenziosamente). Il modello corretto ha un'unica fonte di verità geografica e un solo punto di risoluzione:

```
PlaceGeography {                    // NUOVO — concetto condiviso, non un'entità a sé nel DB
  coordinates?: { lat: number; lng: number }
  iataCode?: string                 // aeroporto/stazione, se applicabile
}

TimeZoneResolver {                   // NUOVO — parte di/adiacente a TemporalService
  resolve(geo: PlaceGeography): IanaTimeZone
}

Transport {
  departureDate: InstantISO
  arrivalDate?: InstantISO
  origin: PlaceGeography             // già in gran parte presente come coordinate/nome
  destination: PlaceGeography
  // NIENTE campo timeZone proprio: si risolve on-demand da origin/destination
  // tramite TimeZoneResolver, con cache/denormalizzazione a livello di storage
  // per performance, mai come dato autorevole scritto due volte.
}

Accommodation {
  checkIn: InstantISO
  checkOut: InstantISO
  coordinates: GeoLocation           // già esistente nel modello attuale
  // idem: fuso risolto da `coordinates`, non un campo timeZone indipendente
}

JourneyAnchor {
  startISO: InstantISO
  endISO: InstantISO
  timeZone: IanaTimeZone             // presente, ma DERIVATO — mai autorevole
}
```

Su `JourneyAnchor` il campo `timeZone` **resta**, per convenienza di lettura (i consumatori di un anchor — `GapFillingService`, `EndOfDayClosureService` — non devono ogni volta risalire al `Transport`/`Accommodation` di origine per sapere in che fuso ragionare), ma è esplicitamente documentato come **cache derivata**, mai come input scritto autonomamente: `JourneyAnchorEngine`, nel momento in cui deriva un anchor da un `Transport`/`Accommodation` (come già fa oggi per gli altri campi), copia il fuso risolto da `TimeZoneResolver` sulla fonte geografica — non lo re-inventa, non lo chiede all'utente una seconda volta. Se la fonte cambia (es. l'utente corregge le coordinate di un hotel), l'anchor derivato è ricalcolato da zero, non patchato in place: coerente con il resto del modello di `JourneyAnchorEngine`, già puro e senza stato.

L'unico caso in cui un fuso è realmente un dato di input primario (non derivabile) è quando `PlaceGeography` è incompleta (né coordinate né codice IATA/stazione noti) — allora, e solo allora, un fuso inserito manualmente dall'utente è l'input legittimo, esplicitamente marcato come override manuale (per audit/UX, es. "fuso confermato manualmente" vs "fuso dedotto"), mai confuso con una risoluzione automatica.

**Value object di dominio — `ZonedInstant`**: un piccolo oggetto immutabile `{ instant: InstantISO, timeZone: IanaTimeZone }` con metodi derivati (`.dayString()`, `.minutesSinceMidnight()`, `.hour()`, `.plusMinutes(n)` → nuovo `ZonedInstant` DST-consapevole). Nessun altro punto del codice calcola queste proiezioni autonomamente.

**`TemporalService` — unico varco verso `Date`/`Intl`**: un servizio di infrastruttura (non di dominio) che è l'**unico** modulo autorizzato a costruire/leggere un `Date` reale, chiamare `Intl.DateTimeFormat`, o manipolare offset. Include (o espone tramite un sotto-modulo) il `TimeZoneResolver` di §4.2. API dichiarativa (es. `TemporalService.toZoned(instant: InstantISO, timeZone: IanaTimeZone): ZonedInstant`, `TemporalService.zonedDayBoundaries(dateStr, timeZone): { startInstant, endInstant }`), nasconde ogni dettaglio ICU/`Intl`. Tutti i servizi di dominio (`JourneyAnchorEngine`, `GapFillingService`, ecc.) dipendono da questo servizio, mai direttamente da `Date`.

**Ridefinizione di "giorno di calendario"**: oggi `dateStr` ("YYYY-MM-DD") è usato pervasivamente (`JourneyAnchor.date`, `GapFillingContext.dateStr`, `TimelineDaySchedule.date`) ma calcolato in modo incoerente (UTC in alcuni file, locale in altri). Nel modello canonico, un "giorno di calendario" è **sempre relativo a un fuso esplicito**: il giorno N del viaggio a Tokyo inizia/finisce a mezzanotte di Tokyo, non a mezzanotte UTC né a mezzanotte del device.

## 5. Conversioni permesse

1. **Instant → ZonedInstant**, sempre e solo tramite `TemporalService`, con fuso esplicito passato dal chiamante (mai implicito, mai "quello del device").
2. **Input utente locale → Instant**: quando l'utente digita "14:30" per un evento a una destinazione nota, la conversione a Instant richiede sempre `(data di calendario, ora locale, fuso IANA della destinazione)` come terna — mai solo l'ora.
3. **Confronto/ordinamento fra due Instant**, indipendentemente dai rispettivi fusi — è l'unica operazione intrinsecamente sicura senza fuso, perché un Instant è già univoco. (Il merge cronologico esistente in `JourneyAnchorEngine.mergeChronologically`, basato su `new Date(x).getTime()`, è già corretto sotto questo profilo e non necessita modifiche concettuali.)
4. **Aritmetica di durata in minuti fra due Instant** (es. "quanto dura il transfer") — sempre corretta, perché la differenza fra due Instant non dipende da alcun fuso.
5. **Aritmetica di orario locale entro lo stesso `ZonedInstant`/stesso fuso e stesso giorno solare** (es. "aggiungi 90 minuti alla visita al museo di Roma"), a condizione che il risultato sia ri-derivato come nuovo Instant tramite `TemporalService.plusMinutes()` DST-consapevole, mai sommando minuti su una stringa "HH:mm" nuda.

## 6. Conversioni vietate

1. **Qualunque getter locale di `Date`** (`getHours`, `getMinutes`, `getDate`, `getMonth`, `getFullYear`, `getDay`) in codice di dominio — legge silenziosamente il fuso del device in esecuzione, mai un dato legittimo per la logica di viaggio. Uso attuale: `JourneyAnchorEngine.dateStrOf()`/`minutesOfISO()`.
2. **`getUTCHours()`/`getUTCMinutes()` trattati come "l'ora locale"** senza abbinamento esplicito a un fuso di destinazione — sono l'ora UTC, non l'ora di Roma/New York/Los Angeles/Tokyo. Uso attuale: `JourneyComposer` riga 690, `GapFillingService.placeInterval()`.
3. **Costruzione di un `Date` da componenti locali** (`new Date(year, month, day, hour, minute)`) seguita da `.toISOString()` per ottenere un instante — il fuso implicitamente preso in prestito è quello del device, mai dichiarato, mai controllabile. Uso attuale: costruzione di `accommodation_return.scheduledTime` in `JourneyComposer` (righe 756-760) — è esattamente il meccanismo del bug del rientro in hotel.
4. **Stringhe "HH:mm" come formato di scambio fra servizi di dominio** — ammesse *solo* come proiezione di visualizzazione, mai come parametro/valore di ritorno che attraversa un confine di servizio. Uso attuale: `PlaceRef.calculatedStartTime`/`calculatedEndTime` letti da `GapFillingService`, `JourneyComposer.parseTime/formatTime`, `detectFreeTimeSlots`.
5. **Somma di minuti su un valore "minuti da mezzanotte" attraverso un confine di mezzanotte o di cambio DST** senza passare per `TemporalService` — la nozione stessa di "mezzanotte" è relativa a un fuso, e un'ora può non esistere (marzo, DST forward) o esistere due volte (novembre, DST backward).
6. **Un fuso orario derivato dal device dell'utente o dalla sua posizione attuale** applicato a un evento che si svolge altrove — è l'errore concettuale che genera esattamente lo scenario descritto dall'utente (pianificare da Roma un viaggio a New York, o essere fisicamente a New York mentre si consulta il giorno 5 del viaggio già a Tokyo).
7. **`Date` come tipo di un campo in un'interfaccia o schema Zod di dominio** (`z.date()` su `Transport`/`Accommodation`/`JourneyAnchor`/`PlaceRef`) — vietato (§3, §4.1); il tipo di dominio è sempre `InstantISO`. `Date` è ammesso solo internamente a `TemporalService` e nei componenti di input UI, mai come tipo di un campo che attraversa un confine di servizio o la persistenza.
8. **Un fuso orario scritto/duplicato indipendentemente su più entità che condividono lo stesso luogo** (es. un `timeZone` inserito a mano sia su `Transport` sia ri-derivato diversamente su `JourneyAnchor`) — vietato (§4.2); l'unica fonte di verità è la `PlaceGeography` (coordinate/codice IATA) risolta tramite `TimeZoneResolver`; ogni altro campo `timeZone` è una cache derivata, mai un secondo input indipendente.

## 7. Strategia di migrazione

Approccio *strangler fig*, additivo, mai big-bang:

**Fase 0 — Fondamenta isolate.** Si introduce `ZonedInstant` + `TemporalService` come nuovo modulo autonomo, con test esaustivi (§12), senza toccare alcun call site esistente. Nessun rischio di regressione: codice non ancora collegato a nulla.

**Fase 1 — `TimeZoneResolver` e `PlaceGeography`.** Si introduce `TimeZoneResolver` (coordinate/codice IATA → fuso IANA, tramite tabella statica o libreria dedicata) come sotto-modulo di `TemporalService`, riusando i campi geografici già presenti oggi su `Transport`/`Accommodation` (`coordinates`, nomi di origine/destinazione) — nessun nuovo campo `timeZone` manuale da mantenere in sincronia; il fuso è sempre risolto, mai duplicato (§4.2). Per i luoghi privi di coordinate/codice risolvibile, un campo di override manuale opzionale e esplicitamente marcato come tale.

**Fase 1bis — Migrazione dello schema `Date` → `InstantISO`.** In parallelo, i campi Zod `z.date()` su `Transport`/`Accommodation` (`departureDate`, `arrivalDate`, `checkIn`, `checkOut`) migrano a uno schema `InstantISO` (stringa ISO-8601 validata, con brand a livello di tipo TypeScript). Questa migrazione **corregge** un comportamento già oggi silenzioso e non dichiarato: `MMKVAdapter` (§3) serializza/deserializza con `JSON.stringify`/`JSON.parse` puro, senza reviver — un `Date` persistito torna già oggi una stringa nuda alla rilettura. Passare esplicitamente a `InstantISO` rende tipizzato ciò che di fatto accade già, senza cambiare il formato realmente presente su disco (nessuna migrazione dati distruttiva richiesta, solo un aggiornamento dello schema di validazione e dei tipi TypeScript a valle).

**Fase 2 — Migrazione dei servizi più puri e isolati.** `JourneyAnchorEngine` e `GapFillingService` sono i candidati migliori per primi: sono già stateless, senza side effect, con suite di test dedicate che possono essere riscritte *prima* del cambiamento per fissare il comportamento atteso nei quattro fusi di riferimento (§12), poi fatte passare da rosso a verde con l'implementazione basata su `TemporalService`.

**Fase 3 — Migrazione di `JourneyComposer`.** Rimozione del pattern "costruzione locale + `toISOString()`" per `accommodation_return` e sostituzione con `TemporalService`; migrazione del calcolo di `lastActivityEndMinutes` e affini.

**Fase 4 — Enforcement strutturale.** Regola ESLint custom che vieta `getHours|getMinutes|getDate|getMonth|getFullYear|getUTCHours|getUTCMinutes` ovunque fuori dal modulo `TemporalService`, per impedire regressioni future indipendentemente dalla review umana.

**Fase 5 — Consolidamento del livello di visualizzazione.** Le stringhe "HH:mm" (`calculatedStartTime`/`calculatedEndTime`) restano sui `PlaceRef` per compatibilità UI, ma diventano **sempre** una proiezione calcolata a valle da `(instant, timeZone)` tramite `TemporalService`, mai un valore trasportato o riletto come input di logica di dominio.

Ogni fase è validata dalla suite Jest esistente (invariata al 100% per i casi già UTC-equivalenti) più le nuove fixture multi-fuso, prima di passare alla fase successiva.

## 8. Retrocompatibilità

- Nessun campo esistente viene rimosso o rinominato: `scheduledTime`, `calculatedStartTime`, `calculatedEndTime`, `departureDate`, `arrivalDate`, `checkIn`, `checkOut` restano tutti presenti con lo stesso significato di instante (solo il tipo del valore migra da `Date` a `InstantISO`, §4.1/§7 Fase 1bis — nessun cambio di formato su disco).
- Il fuso orario **non richiede un nuovo campo obbligatorio da popolare in migrazione** (§4.2): si risolve da `coordinates`/codice IATA già presenti su `Transport`/`Accommodation`. Il solo campo realmente nuovo è l'override manuale opzionale per i luoghi senza geografia risolvibile; la sua assenza attiva il fallback via `TimeZoneResolver`, mai un crash né un comportamento silenzioso divergente.
- Per i trip già persistiti: nessuna migrazione distruttiva del dato. Il fuso viene *risolto a runtime* dalla geografia già presente (derivato, non riscritto) finché l'utente non lo conferma o corregge esplicitamente le coordinate del trasporto/alloggio.
- Il comportamento odierno, per il sotto-insieme di trip in cui la destinazione è realmente UTC (o dove il device esegue in UTC, come oggi in CI), deve rimanere bit-per-bit identico dopo la migrazione — è il criterio con cui si verifica che il fix non introduca regressioni sul path già coperto dai test esistenti.
- Il percorso legacy `generateDaySchedule()` senza `TripSetup` (già protetto da "Zero Regression" in ADR-024 §3) resta esplicitamente fuori scope: non ha dati di trasporto/alloggio con cui derivare un fuso, quindi continua a operare nel suo modello attuale finché non verrà eventualmente esteso.

## 9. Servizi impattati

| Servizio/file | Impatto |
|---|---|
| `trip-setup.model.ts` (Transport/Accommodation) | Campi `z.date()` → schema `InstantISO`; nessun nuovo campo `timeZone` manuale — il fuso si risolve da `coordinates`/codice IATA già presenti, via `TimeZoneResolver` |
| `TemporalService` / `TimeZoneResolver` (nuovi, infrastruttura) | Unico punto di accesso a `Date`/`Intl`; unico punto di risoluzione fuso da `PlaceGeography` |
| `JourneyAnchorEngine.ts` | Sostituzione di `dateStrOf`/`minutesOfISO` locali con `TemporalService`; il campo `JourneyAnchor.timeZone` diventa una copia derivata (mai inventata) dal fuso risolto per il `Transport`/`Accommodation` di origine |
| `JourneyComposer.ts` (`JourneyComposerService`) | Rimozione del pattern costruzione-locale/`toISOString()`; sostituzione di `getUTCHours()`; `parseTime`/`formatTime` ridefiniti come proiezioni via `TemporalService` |
| `EndOfDayClosureService.ts` | Le utility `toDateStrUTC` già isolate diventano wrapper (o vengono sostituite) da `TemporalService`, senza cambio di contratto pubblico |
| `LuggagePlanningService.ts` | Idem, `dateStrOfUTC` |
| `GapFillingService.ts` + `gap/*Strategy.ts` | `placeInterval()` migra da `getUTCHours()` a `TemporalService`; `GapFillingContext`/`GapWindow` acquisiscono un campo `timeZone` |
| `TimelineRuleEngine.ts` + regole (`OpeningHoursRule`, `TravelTimeRule`, `SmartMealRule`, `EndOfDayRule`, `WeatherRule`) | `TimelineContext.currentTimeMinutes`/`mealWindows` da ridefinire come proiezioni fuso-consapevoli |
| `DistanceCalculator.ts` | Stime di durata per tratte notturne/multi-fuso (bus/treno overnight) devono ragionare in Instant, non in minuti locali ingenui |
| Livello UI (`TimelinePreview.tsx` e simili) | Consumano solo le proiezioni "HH:mm" finali; nessun impatto di logica, ma da verificare che non ricalcolino autonomamente orari da `Date` |

## 10. Fasi di implementazione (piano di delivery)

1. **Sprint N** — `ZonedInstant` + `TemporalService`, test esaustivi 4 città + DST, nessuna integrazione.
2. **Sprint N+1** — Estensione schema (campi fuso opzionali) + tabella di risoluzione fuso per aeroporti/città + fallback documentato.
3. **Sprint N+2** — Migrazione `JourneyAnchorEngine` + `GapFillingService` dietro riscrittura preventiva dei test esistenti nei 4 fusi di riferimento; confronto vecchio/nuovo output su corpus di trip reali.
4. **Sprint N+3** — Migrazione `JourneyComposer` (rimozione pattern locale/`toISOString()`), `EndOfDayClosureService`, `LuggagePlanningService`.
5. **Sprint N+4** — Regola ESLint di enforcement, sweep repo-wide, aggiornamento documentazione architetturale, rimozione delle utility UTC/locali duplicate ormai ridondanti rispetto a `TemporalService`.

## 11. Analisi dei rischi

| Rischio | Mitigazione |
|---|---|
| Il fix cambia gli orari calcolati per viaggi reali fuori UTC (comportamento diverso, non solo codice diverso) | Rollout progressivo per servizio (§10), confronto vecchio/nuovo su corpus di trip reali prima del rilascio, feature flag se necessario |
| Edge case DST (ora che sparisce a marzo, ora che si ripete a novembre) | Fixture di test dedicate sulle date di transizione DST 2026 per ogni fuso non-Tokyo (§12); Tokyo come caso di controllo senza DST |
| Dati di fuso mancanti o errati per un aeroporto/città non presente nella tabella di risoluzione | La risoluzione deve degradare in modo esplicito e loggato (mai un crash silenzioso), con possibilità per l'utente di correggere manualmente |
| Costo prestazionale di `Intl.DateTimeFormat` su percorsi caldi (generazione schedule con molti `PlaceRef`) | Memoizzazione/pooling dei formatter dentro `TemporalService`, mai istanziati per-place |
| Incompletezza del database IANA su runtime Hermes/React Native più datati | Verifica di capability a startup + polyfill/tabella tz imbarcata, non assumere `Intl` completo per default |
| Regressione silenziosa nel tempo (qualcuno reintroduce `getHours()`) senza enforcement automatico | Regola ESLint obbligatoria da Sprint N+4, non opzionale, in CI bloccante |

## 12. Strategia di test

- **Fixture per città** (Roma, New York, Los Angeles, Tokyo): per ciascuna, un itinerario di giornata interamente nello stesso fuso, verificando che finestre pasto/orari apertura/gap siano calcolati sull'ora locale corretta.
- **Fixture multi-fuso**: almeno un volo Roma → New York e uno Los Angeles → Tokyo, verificando che partenza e arrivo siano mostrati nell'ora locale del rispettivo aeroporto e che la durata di volo (differenza fra Instant) resti corretta indipendentemente dai fusi.
- **Fixture overnight**: una tratta o un'attività che attraversa la mezzanotte locale di destinazione, verificando l'assegnazione al giorno di calendario corretto.
- **Fixture DST**: date di transizione 2026 per Roma (CET↔CEST), New York e Los Angeles (EST/PST↔EDT/PDT); Tokyo come caso di controllo (nessuna DST) per isolare eventuali regressioni non legate al DST.
- **Matrice combinatoria** (fuso origine × fuso destinazione × stagione) sui casi critici (calcolo gap, chiusura di giornata, deposito bagagli) per evitare bug asimmetrici (es. "funziona andando verso ovest ma non verso est").
- **Test di non-regressione**: l'intera suite Jest esistente deve continuare a passare invariata per i casi equivalenti a UTC (il criterio di accettazione di zero regressioni si verifica qui).
- **Test di contratto su `TemporalService` isolato**: nessuna dipendenza dal device in esecuzione — ogni test inietta un Instant fisso e verifica la proiezione attesa, mai `Date.now()`.
- **Test statico**: una regola di lint (o un test che esegue grep sul sorgente) che fallisce la build se `getHours|getMinutes|getUTCHours|getUTCMinutes|getDate|getMonth|getFullYear` compare fuori da `TemporalService`.

## 13. Esempi — Roma, New York, Los Angeles, Tokyo

Instant di riferimento: **1 agosto 2026, 18:00:00 UTC** (`2026-08-01T18:00:00.000Z`).

| Fuso IANA | Ora locale proiettata | Offset in quel momento | Note |
|---|---|---|---|
| `Europe/Rome` | **20:00**, 1 agosto 2026 | UTC+2 (CEST, ora legale attiva) | |
| `America/New_York` | **14:00**, 1 agosto 2026 | UTC−4 (EDT, ora legale attiva) | |
| `America/Los_Angeles` | **11:00**, 1 agosto 2026 | UTC−7 (PDT, ora legale attiva) | |
| `Asia/Tokyo` | **03:00**, 2 agosto 2026 (giorno successivo) | UTC+9 (nessuna DST in Giappone) | Il giorno di calendario cambia: un `dateStr` calcolato ingenuamente in UTC ("2026-08-01") sarebbe sbagliato per un evento reale a Tokyo in questo istante |

**Esempio cross-fuso — volo Roma → New York:**
Volo che parte da Roma Fiumicino alle **14:00 ora locale di Roma** (`Europe/Rome`) del 1 agosto 2026 e atterra a New York JFK alle **17:30 ora locale di New York** (`America/New_York`) lo stesso giorno.
- Instant di partenza: `2026-08-01T12:00:00.000Z` (14:00 CEST − 2h)
- Instant di arrivo: `2026-08-01T21:30:00.000Z` (17:30 EDT + 4h)
- Durata di volo reale: 9h30m (differenza fra i due Instant — corretta indipendentemente dai fusi, per §5.4)
- Con il modello attuale (nessun fuso salvato, lettura con `getUTCHours()`/`getHours()` locale a seconda del file), la UI rischia di mostrare "14:00 → 21:30" (i due orari UTC crudi) o "16:00 → 19:30" (se un device impostato su un terzo fuso qualunque legge con metodi locali) — in nessun caso i veri orari locali (14:00 Roma / 17:30 New York) che il viaggiatore si aspetta di leggere sul proprio itinerario.

**Esempio DST — Los Angeles:**
Il cambio ora legale USA 2026 è la prima domenica di novembre (1° novembre 2026, ore 02:00 locali tornano all'01:00): un `ZonedInstant` per un evento delle 01:30 di quel giorno a Los Angeles è **ambiguo** (esiste due volte) e deve essere risolto esplicitamente da `TemporalService` (convenzione: preferire l'occorrenza pre-transizione, documentata come default), mai lasciato a un'aritmetica ingenua su minuti.

## 14. Come evitare bug di fuso orario per sempre

1. **Unico varco**: solo `TemporalService` tocca `Date`/`Intl`/offset. Nessun altro modulo — di dominio o UI — costruisce o legge un `Date` direttamente.
2. **Il fuso è un valore di prima classe**: ovunque esista un instante rilevante per l'utente, il fuso lo accompagna esplicitamente nel tipo (`ZonedInstant`), mai implicito o "quello del device".
3. **Divieto strutturale, non solo culturale**: la regola ESLint di §7 Fase 4 rende impossibile — non solo sconsigliato — reintrodurre `getHours()`/`getUTCHours()` fuori da `TemporalService`; l'enforcement è nella pipeline CI, non nella sola code review.
4. **Il fuso del device è irrilevante alla logica di viaggio**: è legittimo solo per funzionalità di piattaforma (es. programmare una notifica locale del telefono), mai per calcolare cosa succede a una destinazione. Va bandito concettualmente dal layer di dominio.
5. **Ogni PR che tocca codice temporale richiede le fixture dei 4 fusi + un caso DST**: da codificare nel template di PR / linee guida di contribuzione, così la copertura non dipende dalla memoria di chi scrive il test.
6. **Revisione periodica**: questo ADR va rivisitato ogni volta che si aggiunge un nuovo tipo di trasporto (es. treni con fusi multipli in un singolo tragitto, crociere) per verificare che il modello Instant + Fuso resti sufficiente.
