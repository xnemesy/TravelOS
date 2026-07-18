import { InstantISO } from './InstantISO';
import { IanaTimeZone } from './IanaTimeZone';

/**
 * ============================================================================
 * ZonedInstant — Value object di dominio (ADR-025 §3, §4.2)
 * ============================================================================
 * La coppia `{ instant, timeZone }`: l'unica rappresentazione legittima per
 * mostrare/inserire un orario "locale" comprensibile a un umano, calcolare il
 * giorno di calendario, i minuti-da-mezzanotte, valutare finestre pasto/orari
 * apertura, decidere confini di giornata (§3).
 *
 * Immutabile. Costruito ESCLUSIVAMENTE da `TemporalService.toZoned()` (o altri
 * metodi del servizio), che calcola la proiezione locale via `Intl` e la
 * fissa qui una volta sola. Per questo il value object espone i campi locali
 * (`year`, `hour`, ...) come *snapshot pre-calcolato*: gli accessor leggono
 * dati già pronti e NON toccano mai `Date`/`Intl` (§14) — l'invariante "solo
 * TemporalService accede a Date/Intl" resta intatta.
 *
 * ARITMETICA: `plusMinutes` NON vive qui (richiederebbe ri-proiezione via
 * `Intl`, vietata nel dominio): sta su `TemporalService.plusMinutes(zoned, n)`
 * e restituisce un nuovo `ZonedInstant` DST-consapevole (§4.2, §5.5).
 *
 * Corrispondenza TC39 Temporal: sottoinsieme di `Temporal.ZonedDateTime`.
 * `dayString()` ~ `.toPlainDate().toString()`; `minutesSinceMidnight()` ~
 * `.hour*60 + .minute`; `offsetMinutes` ~ `.offsetNanoseconds/60e9`.
 */

/** Campi con cui `TemporalService` costruisce un `ZonedInstant`. */
export interface ZonedInstantParts {
  /** Instante assoluto proiettato (invariante rispetto al fuso). */
  readonly instant: InstantISO;
  /** Fuso in cui l'instante è proiettato. */
  readonly timeZone: IanaTimeZone;
  /** Anno di calendario locale (es. 2026). */
  readonly year: number;
  /** Mese locale, 1–12 (NON 0-based come `Date.getMonth`). */
  readonly month: number;
  /** Giorno del mese locale, 1–31. */
  readonly day: number;
  /** Ora locale, 0–23. */
  readonly hour: number;
  /** Minuto locale, 0–59. */
  readonly minute: number;
  /** Secondo locale, 0–59. */
  readonly second: number;
  /**
   * Offset del fuso rispetto a UTC in minuti, in QUESTO instante (DST incluso):
   * `local - UTC`. Es. Roma d'estate = +120, New York d'estate = -240.
   */
  readonly offsetMinutes: number;
}

export class ZonedInstant {
  readonly instant: InstantISO;
  readonly timeZone: IanaTimeZone;
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly offsetMinutes: number;

  private constructor(parts: ZonedInstantParts) {
    this.instant = parts.instant;
    this.timeZone = parts.timeZone;
    this.year = parts.year;
    this.month = parts.month;
    this.day = parts.day;
    this.hour = parts.hour;
    this.minute = parts.minute;
    this.second = parts.second;
    this.offsetMinutes = parts.offsetMinutes;
    Object.freeze(this);
  }

  /**
   * Factory riservata a `TemporalService`: assume che i campi siano già una
   * proiezione corretta dell'`instant` nel `timeZone` (calcolata via `Intl`).
   * Il codice di dominio ottiene un `ZonedInstant` solo dal servizio, mai
   * costruendone uno a mano.
   */
  static of(parts: ZonedInstantParts): ZonedInstant {
    return new ZonedInstant(parts);
  }

  /** Giorno di calendario locale come `"YYYY-MM-DD"` (relativo al fuso, §4.2). */
  dayString(): string {
    const mm = String(this.month).padStart(2, '0');
    const dd = String(this.day).padStart(2, '0');
    return `${this.year}-${mm}-${dd}`;
  }

  /** Minuti trascorsi dalla mezzanotte locale (0–1439). */
  minutesSinceMidnight(): number {
    return this.hour * 60 + this.minute;
  }

  /** Orario locale come `"HH:mm"` — proiezione di sola VISUALIZZAZIONE (§6.4). */
  toLocalHHmm(): string {
    const hh = String(this.hour).padStart(2, '0');
    const mm = String(this.minute).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  /**
   * Uguaglianza di value object: stesso instante assoluto E stesso fuso.
   * (Due `ZonedInstant` con lo stesso instant ma fusi diversi rappresentano
   * lo stesso momento visto da luoghi diversi: non sono uguali come value.)
   */
  equals(other: ZonedInstant): boolean {
    return this.instant === other.instant && this.timeZone === other.timeZone;
  }

  toString(): string {
    return `${this.instant}[${this.timeZone}]`;
  }
}
