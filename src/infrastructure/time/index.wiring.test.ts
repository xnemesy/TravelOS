/**
 * Smoke test del composition root temporale (Sprint 18.5).
 *
 * Scopo ESCLUSIVO: rilevare wiring rotto o regressioni di export dei singleton
 * esposti da `./index`. NON duplica i test comportamentali già coperti da
 * `DefaultTemporalService.test.ts` / `TimeZoneResolver.test.ts` — verifica solo
 * che i singleton siano composti e usabili.
 */
import { temporalService, timeZoneResolver } from './index';

describe('temporal composition root (index barrel)', () => {
  it('espone un temporalService composto e usabile', () => {
    expect(temporalService).toBeDefined();

    const now = temporalService.now();
    // now() deve produrre un InstantISO valido secondo il servizio stesso.
    expect(temporalService.isValidInstant(now)).toBe(true);
  });

  it('espone un timeZoneResolver composto e usabile', () => {
    expect(timeZoneResolver).toBeDefined();

    const resolution = timeZoneResolver.resolve({ iataCode: 'FCO' });
    expect(String(resolution.timeZone)).toBe('Europe/Rome');
    expect(resolution.source).toBe('iata');
  });

  it('condivide la stessa istanza di resolver iniettata nel servizio', () => {
    // Il fuso risolto via il servizio deve coincidere con quello del resolver
    // esportato: unica fonte di verità, nessuna divergenza (ADR-025 §4.2/§6.8).
    const viaResolver = timeZoneResolver.resolve({ iataCode: 'FCO' }).timeZone;
    const viaService = temporalService.resolveTimeZone({ iataCode: 'FCO' }).timeZone;
    expect(String(viaService)).toBe(String(viaResolver));
  });
});
