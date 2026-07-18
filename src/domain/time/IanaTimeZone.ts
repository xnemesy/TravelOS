/**
 * ============================================================================
 * IanaTimeZone — Identificatore di fuso orario IANA (ADR-025 §3, §4.2)
 * ============================================================================
 * Una stringa come `"Europe/Rome"`, `"America/New_York"`, `"Asia/Tokyo"` — MAI
 * un offset numerico fisso (`+01:00`), perché l'offset di un fuso IANA cambia
 * nel tempo (DST) mentre l'identificativo no (§3).
 *
 * È un tipo *branded*: a runtime una stringa, a compile-time non
 * intercambiabile con `string`. La costruzione autorevole (che verifica che
 * il fuso esista realmente nel database tz del runtime) passa da
 * `TemporalService.timeZone()` / `isValidTimeZone()`, che possono usare
 * `Intl` (§14). Questo modulo di dominio si limita alla validazione
 * *strutturale* della forma dell'identificatore, senza toccare `Intl`.
 *
 * Corrispondenza TC39 Temporal: il parametro `timeZone` di
 * `Temporal.Instant.prototype.toZonedDateTimeISO(timeZone)`.
 */

/** Tipo di dominio branded per un identificatore di fuso orario IANA. */
export type IanaTimeZone = string & { readonly __brand: 'IanaTimeZone' };

/**
 * Forma di un identificatore IANA: uno o più segmenti separati da `/`
 * (es. `Europe/Rome`, `America/Argentina/Buenos_Aires`), oppure il caso
 * speciale `UTC`. Ammette lettere, cifre, `_`, `+` e `-` nei segmenti
 * (es. `Etc/GMT+2`). Validazione *strutturale* soltanto: NON garantisce che
 * il fuso esista nel runtime — quella verifica è di `TemporalService`.
 */
const IANA_FORMAT = /^(?:UTC|[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)+)$/;

/** Guardia strutturale (nessun `Intl`). Vedi header. */
export function isIanaTimeZoneFormat(value: string): boolean {
  return IANA_FORMAT.test(value);
}

/**
 * Applica il brand `IanaTimeZone`. `unsafe*` NON verifica l'esistenza del
 * fuso nel runtime: dettaglio interno da invocare SOLO da
 * `TemporalService`/`TimeZoneResolver` dopo la validazione. Vedi header.
 */
export function unsafeAsIanaTimeZone(value: string): IanaTimeZone {
  return value as IanaTimeZone;
}

/**
 * Fusi di riferimento dell'ADR-025 (§13), utili come costanti tipizzate per
 * codice applicativo e test. Sono forme strutturalmente valide; la loro
 * effettiva risolvibilità nel runtime resta verificata da `TemporalService`.
 */
export const IANA = {
  UTC: 'UTC' as IanaTimeZone,
  ROME: 'Europe/Rome' as IanaTimeZone,
  NEW_YORK: 'America/New_York' as IanaTimeZone,
  LOS_ANGELES: 'America/Los_Angeles' as IanaTimeZone,
  TOKYO: 'Asia/Tokyo' as IanaTimeZone,
} as const;
