/**
 * ============================================================================
 * InstantISO — Il tipo di dominio per un instante (ADR-025 §4.1)
 * ============================================================================
 * Un punto assoluto e univoco sulla linea del tempo universale, indipendente
 * da qualunque fuso orario, rappresentato come stringa ISO-8601 in UTC con
 * `Z` esplicito. È l'UNICA rappresentazione legittima di un instante che
 * attraversa un confine di modulo, uno schema Zod o la persistenza.
 *
 * `InstantISO` è un tipo *branded* (nominal typing su base strutturale): a
 * runtime è una normale stringa, ma a compile-time NON è intercambiabile con
 * `string`. Non può essere costruito con un cast libero dal codice di dominio:
 * l'unico varco autorizzato è `TemporalService` (§4.1, §14).
 *
 * Corrispondenza TC39 Temporal: equivale a `Temporal.Instant` serializzato
 * (`instant.toString()`), su cui questo modulo è progettato per convergere.
 *
 * NOTA ARCHITETTURALE: questo modulo NON tocca `Date` né `Intl` (§14). La
 * validazione qui è puramente *strutturale* (forma della stringa). La
 * validazione autorevole di calendario (es. rifiutare "2026-02-30") richiede
 * un `Date` e vive quindi in `DefaultTemporalService.parseInstant`.
 */

/** Tipo di dominio branded per un instante ISO-8601 UTC. Vedi header. */
export type InstantISO = string & { readonly __brand: 'InstantISO' };

/**
 * Forma canonica accettata: `YYYY-MM-DDTHH:mm:ss(.sss)?Z`.
 * I millisecondi sono opzionali in ingresso (verranno canonicalizzati a
 * `.sss` da `TemporalService.parseInstant`); il suffisso `Z` (UTC) è
 * obbligatorio — un instante di dominio è sempre e solo UTC (§3).
 */
const INSTANT_ISO_FORMAT =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;

/**
 * Guardia *strutturale* (nessun `Date`): verifica forma e range dei campi
 * senza garantire la validità di calendario (es. non intercetta 30 febbraio).
 * La validazione completa è responsabilità di `TemporalService`.
 */
export function isInstantISOFormat(value: string): boolean {
  const m = INSTANT_ISO_FORMAT.exec(value);
  if (!m) return false;
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6]);
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= 31 &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    // 60 ammesso per i leap second, che `Date` normalizza comunque a valori validi.
    second >= 0 &&
    second <= 60
  );
}

/**
 * Applica il brand `InstantISO` a una stringa. `unsafe*` NON valida: è un
 * dettaglio interno pensato per essere invocato SOLO da `TemporalService`
 * dopo che la validazione (strutturale + di calendario) è già avvenuta.
 * Il codice di dominio non deve mai chiamarlo direttamente (§4.1).
 */
export function unsafeAsInstantISO(value: string): InstantISO {
  return value as InstantISO;
}
