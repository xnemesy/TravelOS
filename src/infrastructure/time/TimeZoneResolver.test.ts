import { unsafeAsIanaTimeZone } from '../../domain/time/IanaTimeZone';
import { StaticTimeZoneResolver } from './TimeZoneResolver';

/**
 * Test del TimeZoneResolver (ADR-025 §4.2, §11). Il fuso deriva dal LUOGO
 * (coordinate/codice IATA), mai duplicato per evento; la degradazione quando
 * la geografia è insufficiente deve essere ESPLICITA (source: 'fallback'),
 * mai un crash silenzioso.
 */
describe('StaticTimeZoneResolver', () => {
  const resolver = new StaticTimeZoneResolver();

  describe('priorità delle fonti (override > iata > coordinate > fallback)', () => {
    it('privilegia l override manuale su qualunque altra fonte', () => {
      const r = resolver.resolve({
        manualTimeZone: unsafeAsIanaTimeZone('Pacific/Auckland'),
        iataCode: 'FCO',
        coordinates: { lat: 41.9, lng: 12.5 },
      });
      expect(r).toEqual({ timeZone: 'Pacific/Auckland', source: 'override' });
    });

    it('usa il codice IATA quando non c è override', () => {
      expect(resolver.resolve({ iataCode: 'FCO' })).toEqual({
        timeZone: 'Europe/Rome',
        source: 'iata',
      });
      expect(resolver.resolve({ iataCode: 'JFK' })).toEqual({
        timeZone: 'America/New_York',
        source: 'iata',
      });
      expect(resolver.resolve({ iataCode: 'LAX' })).toEqual({
        timeZone: 'America/Los_Angeles',
        source: 'iata',
      });
      expect(resolver.resolve({ iataCode: 'HND' })).toEqual({
        timeZone: 'Asia/Tokyo',
        source: 'iata',
      });
    });

    it('tratta il codice IATA come case-insensitive', () => {
      expect(resolver.resolve({ iataCode: 'fco' }).timeZone).toBe('Europe/Rome');
    });

    it('cade sulle coordinate se il codice IATA è sconosciuto', () => {
      const r = resolver.resolve({ iataCode: 'ZZZ', coordinates: { lat: 40.71, lng: -74.0 } });
      expect(r).toEqual({ timeZone: 'America/New_York', source: 'coordinates' });
    });
  });

  describe('risoluzione da coordinate (nearest-anchor entro raggio)', () => {
    it('risolve le 4 città di riferimento dell ADR', () => {
      expect(resolver.resolve({ coordinates: { lat: 41.9028, lng: 12.4964 } }).timeZone).toBe(
        'Europe/Rome'
      );
      expect(resolver.resolve({ coordinates: { lat: 40.7128, lng: -74.006 } }).timeZone).toBe(
        'America/New_York'
      );
      expect(resolver.resolve({ coordinates: { lat: 34.0522, lng: -118.2437 } }).timeZone).toBe(
        'America/Los_Angeles'
      );
      expect(resolver.resolve({ coordinates: { lat: 35.6762, lng: 139.6503 } }).timeZone).toBe(
        'Asia/Tokyo'
      );
    });

    it('distingue città vicine dello stesso emisfero (NY vs Chicago)', () => {
      expect(resolver.resolve({ coordinates: { lat: 40.7, lng: -74.0 } }).timeZone).toBe(
        'America/New_York'
      );
      expect(resolver.resolve({ coordinates: { lat: 41.88, lng: -87.63 } }).timeZone).toBe(
        'America/Chicago'
      );
    });

    it('degrada a fallback esplicito quando nessuna ancora è entro il raggio', () => {
      // Oceano Pacifico meridionale: lontano da ogni ancora.
      const r = resolver.resolve({ coordinates: { lat: -40, lng: -140 } });
      expect(r.source).toBe('fallback');
      expect(r.timeZone).toBe('UTC');
    });
  });

  describe('degradazione esplicita', () => {
    it('restituisce fallback UTC quando la geografia è del tutto assente', () => {
      expect(resolver.resolve({})).toEqual({ timeZone: 'UTC', source: 'fallback' });
    });

    it('rispetta un fallback personalizzato iniettato', () => {
      const custom = new StaticTimeZoneResolver({ fallback: unsafeAsIanaTimeZone('Europe/Rome') });
      expect(custom.resolve({})).toEqual({ timeZone: 'Europe/Rome', source: 'fallback' });
    });
  });

  describe('estensibilità', () => {
    it('accetta una tabella IATA aggiuntiva via costruttore', () => {
      const custom = new StaticTimeZoneResolver({
        iataTimeZones: { BCN: 'Europe/Madrid' },
      });
      expect(custom.resolve({ iataCode: 'BCN' })).toEqual({
        timeZone: 'Europe/Madrid',
        source: 'iata',
      });
    });
  });
});
