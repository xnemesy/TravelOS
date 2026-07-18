import { InstantISO } from '../../domain/time/InstantISO';
import { IanaTimeZone } from '../../domain/time/IanaTimeZone';
import { ZonedInstant } from '../../domain/time/ZonedInstant';
import { PlaceGeography, TimeZoneResolution } from './TimeZoneResolver';

/**
 * ============================================================================
 * TemporalService — Unico varco verso Date/Intl (ADR-025 §4.2, §14)
 * ============================================================================
 * Servizio di INFRASTRUTTURA (non di dominio): l'unico modulo autorizzato a
 * costruire/leggere un `Date` reale, chiamare `Intl.DateTimeFormat` o
 * manipolare offset. Tutti i servizi di dominio dipendono da questa
 * interfaccia, mai direttamente da `Date` (§14.1).
 *
 * L'API è dichiarativa e progettata per convergere su TC39 Temporal: ogni
 * metodo annota la controparte `Temporal.*` corrispondente, così che una
 * futura migrazione al built-in sia una sostituzione dell'implementazione,
 * non del contratto.
 *
 * INVARIANTE: nessun `Date` attraversa questo confine. Gli input/output sono
 * `InstantISO` (branded string), `ZonedInstant` (value object immutabile),
 * `IanaTimeZone` o primitivi numerici. Un `Date` non "esce" mai.
 */

/**
 * Strategia di disambiguazione quando un orario locale è ambiguo (ripetuto,
 * DST backward) o inesistente (saltato, DST forward). Semantica allineata a
 * `Temporal.ZonedDateTime` `disambiguation`.
 * - `earlier`  → occorrenza pre-transizione (ADR §13, default per l'ambiguo).
 * - `later`    → occorrenza post-transizione.
 * - `compatible` → `earlier` per l'ambiguo, `later` per il gap (default TC39).
 * - `reject`   → lancia un errore su ambiguità/gap.
 */
export type Disambiguation = 'earlier' | 'later' | 'compatible' | 'reject';

/** Componenti di un orario LOCALE (wall-clock) da convertire in instante. */
export interface LocalDateTimeParts {
  readonly year: number;
  /** 1–12 (NON 0-based). */
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second?: number;
}

/** Confini di una giornata di calendario, relativi a un fuso (§4.2). */
export interface DayBoundaries {
  /** Mezzanotte locale del giorno (inclusiva). */
  readonly startInstant: InstantISO;
  /** Mezzanotte locale del giorno successivo (esclusiva). */
  readonly endInstant: InstantISO;
}

export interface TemporalService {
  // --- Costruzione / validazione di un instante ---------------------------

  /** Instante corrente. ~ `Temporal.Now.instant()`. */
  now(): InstantISO;

  /**
   * Valida e canonicalizza una stringa ISO in `InstantISO` (UTC, `.sssZ`).
   * Lancia su formato non valido o data di calendario impossibile
   * (es. `2026-02-30`). ~ `Temporal.Instant.from(iso)`.
   */
  parseInstant(iso: string): InstantISO;

  /** Come `parseInstant` ma booleana, senza lanciare. */
  isValidInstant(iso: string): boolean;

  /** Instante da epoch in millisecondi UTC. ~ `Temporal.Instant.fromEpochMilliseconds`. */
  instantFromEpochMillis(ms: number): InstantISO;

  /** Epoch in millisecondi UTC di un instante. ~ `instant.epochMilliseconds`. */
  epochMillisOf(instant: InstantISO): number;

  // --- Proiezione in un fuso ---------------------------------------------

  /**
   * Proietta un instante in un fuso esplicito, producendo un `ZonedInstant`
   * immutabile con la proiezione locale pre-calcolata.
   * ~ `instant.toZonedDateTimeISO(timeZone)`.
   */
  toZoned(instant: InstantISO, timeZone: IanaTimeZone): ZonedInstant;

  /**
   * Confini della giornata di calendario `dayString` ("YYYY-MM-DD") nel fuso
   * dato: [mezzanotte locale, mezzanotte locale successiva).
   * ~ `zonedDateTime.startOfDay()` + il giorno dopo.
   */
  zonedDayBoundaries(dayString: string, timeZone: IanaTimeZone): DayBoundaries;

  // --- Da orario locale a instante (input utente, §5.2) -------------------

  /**
   * Converte una terna (data di calendario, ora locale, fuso) in instante,
   * gestendo DST via `disambiguation` (default `compatible`).
   * ~ `Temporal.PlainDateTime.from(parts).toZonedDateTime(tz).toInstant()`.
   */
  fromLocal(
    parts: LocalDateTimeParts,
    timeZone: IanaTimeZone,
    disambiguation?: Disambiguation
  ): InstantISO;

  // --- Aritmetica --------------------------------------------------------

  /**
   * Aggiunge minuti di TEMPO TRASCORSO a un `ZonedInstant`, ri-derivando la
   * proiezione locale (DST-consapevole: la parete oraria riflette eventuali
   * transizioni attraversate). ~ `zonedDateTime.add({ minutes })` in esatto.
   */
  plusMinutes(zoned: ZonedInstant, minutes: number): ZonedInstant;

  /**
   * Minuti trascorsi da `a` a `b` (positivo se `b` è dopo `a`). Indipendente
   * dai fusi (§5.4). ~ `a.until(b, { largestUnit: 'minute' }).minutes`.
   */
  minutesBetween(a: InstantISO, b: InstantISO): number;

  /** Ordinamento di due instanti: -1 / 0 / 1. ~ `Temporal.Instant.compare`. */
  compareInstants(a: InstantISO, b: InstantISO): -1 | 0 | 1;

  // --- Fuso: validazione e risoluzione dal luogo (§4.2) -------------------

  /** True se `tz` è un fuso IANA realmente risolvibile dal runtime. */
  isValidTimeZone(tz: string): boolean;

  /** Valida e applica il brand `IanaTimeZone`; lancia se non risolvibile. */
  timeZone(tz: string): IanaTimeZone;

  /**
   * Risolve il fuso dalla geografia del luogo (delegando al `TimeZoneResolver`
   * iniettato). Il fuso NON è mai duplicato per evento: si risolve qui (§4.2).
   */
  resolveTimeZone(geo: PlaceGeography): TimeZoneResolution;
}
