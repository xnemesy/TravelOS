import {
  InstantISO,
  isInstantISOFormat,
  unsafeAsInstantISO,
} from '../../domain/time/InstantISO';
import {
  IanaTimeZone,
  isIanaTimeZoneFormat,
  unsafeAsIanaTimeZone,
} from '../../domain/time/IanaTimeZone';
import { ZonedInstant } from '../../domain/time/ZonedInstant';
import {
  Disambiguation,
  DayBoundaries,
  LocalDateTimeParts,
  TemporalService,
} from './TemporalService';
import {
  PlaceGeography,
  StaticTimeZoneResolver,
  TimeZoneResolution,
  TimeZoneResolver,
} from './TimeZoneResolver';

/**
 * ============================================================================
 * DefaultTemporalService — Implementazione basata su Intl (ADR-025 §14)
 * ============================================================================
 * L'UNICO punto del sistema che costruisce/legge un `Date` reale e chiama
 * `Intl.DateTimeFormat`. `Date` è un dettaglio privato: non attraversa mai il
 * confine pubblico (§4.1). I formatter `Intl` sono memoizzati per fuso, mai
 * istanziati per-place (§11, costo prestazionale).
 *
 * Nessun metodo usa i getter *locali* di `Date` (`getHours`, `getDate`, ...):
 * la proiezione in un fuso passa SEMPRE da `Intl.formatToParts` con
 * `timeZone` esplicito; l'aritmetica assoluta usa solo epoch-ms e `Date.UTC`.
 * Il fuso del device è quindi strutturalmente irrilevante (§14.4) — i test
 * passano identici sotto qualunque `TZ`.
 */

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

const DAY_STRING = /^(\d{4})-(\d{2})-(\d{2})$/;

export class DefaultTemporalService implements TemporalService {
  private readonly resolver: TimeZoneResolver;

  /** Formatter `Intl` memoizzati per identificatore di fuso (§11). */
  private readonly formatterCache = new Map<string, Intl.DateTimeFormat>();

  /** Cache di validità dei fusi, per evitare `try/catch` ripetuti su path caldi. */
  private readonly tzValidityCache = new Map<string, boolean>();

  constructor(resolver: TimeZoneResolver = new StaticTimeZoneResolver()) {
    this.resolver = resolver;
  }

  // --- Costruzione / validazione di un instante ---------------------------

  now(): InstantISO {
    // Unico uso legittimo di `Date` per l'orologio di sistema (§14.4: ammesso
    // per l'infrastruttura, mai per la logica di viaggio).
    return unsafeAsInstantISO(new Date().toISOString());
  }

  parseInstant(iso: string): InstantISO {
    const instant = this.tryParseInstant(iso);
    if (instant === null) {
      throw new RangeError(`InstantISO non valido: "${iso}"`);
    }
    return instant;
  }

  isValidInstant(iso: string): boolean {
    return this.tryParseInstant(iso) !== null;
  }

  instantFromEpochMillis(ms: number): InstantISO {
    if (!Number.isFinite(ms)) {
      throw new RangeError(`epoch millis non finito: ${ms}`);
    }
    return unsafeAsInstantISO(new Date(ms).toISOString());
  }

  epochMillisOf(instant: InstantISO): number {
    return Date.parse(instant);
  }

  // --- Proiezione in un fuso ---------------------------------------------

  toZoned(instant: InstantISO, timeZone: IanaTimeZone): ZonedInstant {
    this.assertTimeZone(timeZone);
    const epochMs = Date.parse(instant);
    const parts = this.partsInZone(epochMs, timeZone);
    const offsetMinutes = this.offsetMinutesAt(epochMs, timeZone);
    return ZonedInstant.of({
      instant,
      timeZone,
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: parts.hour,
      minute: parts.minute,
      second: parts.second,
      offsetMinutes,
    });
  }

  zonedDayBoundaries(dayString: string, timeZone: IanaTimeZone): DayBoundaries {
    const m = DAY_STRING.exec(dayString);
    if (!m) {
      throw new RangeError(`dayString non valido (atteso YYYY-MM-DD): "${dayString}"`);
    }
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);

    const startInstant = this.fromLocal(
      { year, month, day, hour: 0, minute: 0, second: 0 },
      timeZone,
      'compatible'
    );

    // Giorno successivo calcolato in UTC puro (i getter UTC sono ammessi in
    // infrastruttura); poi la sua mezzanotte locale nel fuso dato.
    const nextUtc = new Date(Date.UTC(year, month - 1, day) + MS_PER_DAY);
    const endInstant = this.fromLocal(
      {
        year: nextUtc.getUTCFullYear(),
        month: nextUtc.getUTCMonth() + 1,
        day: nextUtc.getUTCDate(),
        hour: 0,
        minute: 0,
        second: 0,
      },
      timeZone,
      'compatible'
    );

    return { startInstant, endInstant };
  }

  // --- Da orario locale a instante ---------------------------------------

  fromLocal(
    parts: LocalDateTimeParts,
    timeZone: IanaTimeZone,
    disambiguation: Disambiguation = 'compatible'
  ): InstantISO {
    this.assertTimeZone(timeZone);
    const second = parts.second ?? 0;
    // Interpreta i componenti locali "come se fossero UTC": punto di partenza
    // per trovare l'offset reale del fuso (algoritmo standard tz).
    const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, second);

    // Campiona l'offset ±24h attorno all'istante ingenuo: nessun fuso ha più di
    // una transizione DST in 48h, quindi questi due probe catturano sempre gli
    // offset "prima" e "dopo" un'eventuale transizione vicina. Se coincidono,
    // non c'è transizione nell'intorno e l'orario locale è univoco.
    const offBefore = this.offsetMinutesAt(asUTC - MS_PER_DAY, timeZone);
    const offAfter = this.offsetMinutesAt(asUTC + MS_PER_DAY, timeZone);
    const candidateOffsets = offBefore === offAfter ? [offBefore] : [offBefore, offAfter];

    // Un candidato è valido se, ri-proiettato nel fuso, coincide ESATTAMENTE
    // con l'orario locale richiesto (scarta le proiezioni cadute nel "buco" DST).
    const candidates: number[] = [];
    for (const off of candidateOffsets) {
      const inst = asUTC - off * MS_PER_MINUTE;
      if (this.localMatches(inst, parts, second, timeZone) && !candidates.includes(inst)) {
        candidates.push(inst);
      }
    }
    candidates.sort((a, b) => a - b);

    if (candidates.length === 1) {
      // Caso normale (nessuna transizione) oppure orario univoco.
      return this.instantFromEpochMillis(candidates[0]);
    }

    if (candidates.length === 2) {
      // Orario AMBIGUO (DST backward): esiste due volte. `earlier`/`compatible`
      // → occorrenza pre-transizione (istante minore), `later` → successiva.
      if (disambiguation === 'reject') {
        throw new RangeError(
          `Orario locale ambiguo in ${timeZone} (overlap DST): ${this.describe(parts, second)}`
        );
      }
      return this.instantFromEpochMillis(disambiguation === 'later' ? candidates[1] : candidates[0]);
    }

    // Nessun candidato valido → orario INESISTENTE (DST forward, ora saltata).
    if (disambiguation === 'reject') {
      throw new RangeError(
        `Orario locale inesistente in ${timeZone} (gap DST): ${this.describe(parts, second)}`
      );
    }
    // `earlier` → istante subito prima del gap; `later`/`compatible` → subito dopo.
    const gapEarlier = Math.min(asUTC - offBefore * MS_PER_MINUTE, asUTC - offAfter * MS_PER_MINUTE);
    const gapLater = Math.max(asUTC - offBefore * MS_PER_MINUTE, asUTC - offAfter * MS_PER_MINUTE);
    return this.instantFromEpochMillis(disambiguation === 'earlier' ? gapEarlier : gapLater);
  }

  // --- Aritmetica --------------------------------------------------------

  plusMinutes(zoned: ZonedInstant, minutes: number): ZonedInstant {
    const epochMs = Date.parse(zoned.instant);
    const nextInstant = this.instantFromEpochMillis(epochMs + minutes * MS_PER_MINUTE);
    return this.toZoned(nextInstant, zoned.timeZone);
  }

  minutesBetween(a: InstantISO, b: InstantISO): number {
    return (Date.parse(b) - Date.parse(a)) / MS_PER_MINUTE;
  }

  compareInstants(a: InstantISO, b: InstantISO): -1 | 0 | 1 {
    const diff = Date.parse(a) - Date.parse(b);
    if (diff < 0) return -1;
    if (diff > 0) return 1;
    return 0;
  }

  // --- Fuso: validazione e risoluzione ------------------------------------

  isValidTimeZone(tz: string): boolean {
    if (!isIanaTimeZoneFormat(tz)) return false;
    const cached = this.tzValidityCache.get(tz);
    if (cached !== undefined) return cached;
    let valid = true;
    try {
      // Costruire un formatter con il fuso lancia `RangeError` se non esiste
      // nel database tz del runtime (§11: capability check, mai crash cieco).
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
    } catch {
      valid = false;
    }
    this.tzValidityCache.set(tz, valid);
    return valid;
  }

  timeZone(tz: string): IanaTimeZone {
    if (!this.isValidTimeZone(tz)) {
      throw new RangeError(`Fuso IANA non valido o non risolvibile dal runtime: "${tz}"`);
    }
    return unsafeAsIanaTimeZone(tz);
  }

  resolveTimeZone(geo: PlaceGeography): TimeZoneResolution {
    return this.resolver.resolve(geo);
  }

  // === Interni (unico punto di contatto con Date/Intl) ====================

  private tryParseInstant(iso: string): InstantISO | null {
    if (typeof iso !== 'string' || !isInstantISOFormat(iso)) return null;
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return null;
    // Round-trip di calendario: intercetta valori strutturalmente plausibili
    // ma inesistenti (es. 2026-02-30, che `Date` normalizzerebbe a marzo).
    const canonical = new Date(ms).toISOString();
    const reMs = Date.parse(canonical);
    if (reMs !== ms) return null;
    if (!this.sameCalendarFields(iso, canonical)) return null;
    return unsafeAsInstantISO(canonical);
  }

  /** Confronta i campi Y/M/D/h/m/s di due stringhe ISO UTC (ignora i millis). */
  private sameCalendarFields(a: string, b: string): boolean {
    return a.slice(0, 19) === b.slice(0, 19);
  }

  private formatter(timeZone: string): Intl.DateTimeFormat {
    let fmt = this.formatterCache.get(timeZone);
    if (!fmt) {
      fmt = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23', // evita l'ora "24" restituita da alcuni ICU a mezzanotte
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      this.formatterCache.set(timeZone, fmt);
    }
    return fmt;
  }

  /** Proietta un epoch-ms nei campi locali di un fuso via `Intl.formatToParts`. */
  private partsInZone(
    epochMs: number,
    timeZone: string
  ): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
    const parts = this.formatter(timeZone).formatToParts(new Date(epochMs));
    const get = (type: Intl.DateTimeFormatPartTypes): number => {
      const p = parts.find((x) => x.type === type);
      return p ? Number(p.value) : 0;
    };
    let hour = get('hour');
    if (hour === 24) hour = 0; // difesa ulteriore oltre a hourCycle 'h23'
    return {
      year: get('year'),
      month: get('month'),
      day: get('day'),
      hour,
      minute: get('minute'),
      second: get('second'),
    };
  }

  /** Offset del fuso (local − UTC, in minuti) valido in un dato epoch-ms. */
  private offsetMinutesAt(epochMs: number, timeZone: string): number {
    const p = this.partsInZone(epochMs, timeZone);
    const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return Math.round((asUTC - epochMs) / MS_PER_MINUTE);
  }

  /** True se `epochMs`, proiettato nel fuso, coincide con i componenti locali. */
  private localMatches(
    epochMs: number,
    parts: LocalDateTimeParts,
    second: number,
    timeZone: string
  ): boolean {
    const p = this.partsInZone(epochMs, timeZone);
    return (
      p.year === parts.year &&
      p.month === parts.month &&
      p.day === parts.day &&
      p.hour === parts.hour &&
      p.minute === parts.minute &&
      p.second === second
    );
  }

  private assertTimeZone(timeZone: IanaTimeZone): void {
    if (!this.isValidTimeZone(timeZone)) {
      throw new RangeError(`Fuso IANA non valido o non risolvibile dal runtime: "${timeZone}"`);
    }
  }

  private describe(parts: LocalDateTimeParts, second: number): string {
    const p2 = (n: number) => String(n).padStart(2, '0');
    return `${parts.year}-${p2(parts.month)}-${p2(parts.day)}T${p2(parts.hour)}:${p2(parts.minute)}:${p2(second)}`;
  }
}
