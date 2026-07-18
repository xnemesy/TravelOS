# Sprint 18.5 — Wiring della temporal infrastructure nel composition root

**Data**: 2026-07-18
**Ambito**: ADR-025 (Modello Temporale Canonico) — attivazione delle fondamenta già costruite
**Tipo**: sprint brevissimo, additivo, **zero cambi di comportamento**
**Stato**: design approvato → implementazione

---

## 1. Obiettivo

Rendere disponibili all'intero progetto i servizi temporali già costruiti
(`TemporalService` + `TimeZoneResolver`) attraverso la convenzione di
composizione già in uso nel codebase, **senza migrare alcun consumatore e senza
introdurre logica nuova**. Così, quando inizierà la migrazione di
`JourneyAnchorEngine` (ADR-025 §7 Fase 2), non ci si dovrà fermare per
introdurre la dependency injection.

## 2. Stato di partenza (verificato)

- `src/domain/time/` (`InstantISO`, `IanaTimeZone`, `ZonedInstant`) e
  `src/infrastructure/time/` (`TemporalService`, `DefaultTemporalService`,
  `TimeZoneResolver`/`StaticTimeZoneResolver`) **esistono, sono testati, e non
  sono importati da nessun modulo esterno al proprio**. È lo stato ADR-025 §7
  "Fase 0 + risoluzione fuso (Fase 1) costruite, integrazione non iniziata".
- Il progetto **non ha un container DI formale**. La "dependency injection /
  service locator" è, in questo codebase, un **composition root a singleton di
  modulo**: `TravelServices.ts` termina con
  `export const TravelServices = new TravelServicesPlatform()` e
  `export const placeRepository = …`; i consumatori fanno
  `import { TravelServices }` e chiamano `TravelServices.weather()`.
- `DefaultTemporalService` si auto-costruisce
  (`constructor(resolver: TimeZoneResolver = new StaticTimeZoneResolver())`):
  nessun bootstrap a runtime è necessario. Entrambi i costruttori sono **puri e
  a basso costo** (solo assegnazione di tabelle statiche; nessun
  `Date`/`Intl`/rete/storage), quindi istanziarli all'import del barrel è
  privo di side effect.

## 3. Decisione

**Approccio scelto: singolo export di singleton dal barrel del modulo** (il
barrel come composition root), scartando (a) un metodo su `TravelServices` —
`TravelServices` è la SIP per provider esterni con rete/cache, il temporal è
infrastruttura pura senza rete né cache, mescolarli confonde il confine — e (b)
l'introduzione di un container DI, non necessaria e aliena al codebase per uno
sprint additivo.

`src/infrastructure/time/index.ts` (barrel già esistente) diventa il
composition root. Si aggiungono due singleton alle re-export attuali:

```ts
// Un'unica istanza condivisa del resolver, iniettata nel servizio: nessuna
// seconda fonte di fuso che possa divergere (ADR-025 §4.2 / §6.8).
export const timeZoneResolver: TimeZoneResolver = new StaticTimeZoneResolver();
export const temporalService: TemporalService = new DefaultTemporalService(timeZoneResolver);
```

Due scelte deliberate:

1. **Tipizzati sulle interfacce** (`TemporalService`, `TimeZoneResolver`), mai
   sulle classi concrete → i consumatori dipendono dal contratto, non
   dall'implementazione (ADR-025 §14.1). Sostituire `DefaultTemporalService` in
   futuro tocca solo questo file.
2. **Istanza del resolver unica e condivisa**, iniettata *e* esportata → il
   servizio e qualunque consumatore diretto del resolver usano lo stesso
   oggetto: strutturalmente impossibile far divergere due fonti di fuso.

## 4. Invarianza del comportamento

- **Puramente additivo**: verificato che nulla fuori da `src/*/time/` importa
  questi simboli oggi. Nessun call site esistente cambia.
- Il barrel esisteva già con sole re-export di tipi/classi; l'aggiunta dei
  singleton introduce solo costruzione pura e a basso costo al primo import.
  Nessun bootstrap in `app/_layout.tsx`: i singleton di modulo si istanziano
  all'import, esattamente come `TravelServices`.

## 5. Non-obiettivi (YAGNI)

- **Nessun seam di test-injection** (nessun override stile `registerRealAdapters`)
  — rimandato a quando un consumatore ne avrà davvero bisogno durante la
  migrazione di `JourneyAnchorEngine`; i test possono costruire
  `new DefaultTemporalService()` direttamente.
- **Nessuna migrazione di consumatori, nessuna logica nuova.**

## 6. Verifica

- `tsc --noEmit` pulito; suite Jest esistenti (in particolare i moduli
  temporali) verdi.
- **Smoke test di wiring** minimo (`src/infrastructure/time/index.wiring.test.ts`):
  asserisce solo che i singleton esportati siano composti e usabili
  (`temporalService.now()` → `InstantISO` valido; `timeZoneResolver.resolve({
  iataCode: 'FCO' })` → `Europe/Rome`). **Non** duplica i test comportamentali
  già coperti da `DefaultTemporalService`/`TimeZoneResolver`: serve solo a
  rilevare wiring rotto o regressioni di export.

## 7. Consegna

1. Modifica `src/infrastructure/time/index.ts` (+2 export).
2. `src/infrastructure/time/index.wiring.test.ts` (smoke test di composizione).
3. Aggiornamento `docs/context/SESSION_HANDOFF.md`.
4. Nota di completamento fondamenta/wiring ADR-025 (§7 Fase 0/1) nell'ADR.

Scope strettamente limitato a questi quattro punti.
