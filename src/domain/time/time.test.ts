import {
  InstantISO,
  isInstantISOFormat,
  unsafeAsInstantISO,
} from './InstantISO';
import {
  IANA,
  IanaTimeZone,
  isIanaTimeZoneFormat,
  unsafeAsIanaTimeZone,
} from './IanaTimeZone';
import { ZonedInstant } from './ZonedInstant';

/**
 * Test dei value object di dominio del modello temporale (ADR-025 §4).
 * Questi tipi NON toccano Date/Intl: qui si verificano solo la validazione
 * strutturale e il comportamento immutabile/derivato, indipendentemente dal
 * fuso del device che esegue i test.
 */
describe('InstantISO (dominio)', () => {
  describe('isInstantISOFormat', () => {
    it('accetta ISO-8601 UTC con Z, con e senza millisecondi', () => {
      expect(isInstantISOFormat('2026-08-01T18:00:00.000Z')).toBe(true);
      expect(isInstantISOFormat('2026-08-01T18:00:00Z')).toBe(true);
      expect(isInstantISOFormat('2026-12-31T23:59:59.999Z')).toBe(true);
    });

    it('rifiuta stringhe senza Z (non UTC) od offset numerici', () => {
      expect(isInstantISOFormat('2026-08-01T18:00:00.000')).toBe(false);
      expect(isInstantISOFormat('2026-08-01T18:00:00+02:00')).toBe(false);
      expect(isInstantISOFormat('2026-08-01T20:00:00.000+02:00')).toBe(false);
    });

    it('rifiuta forme non temporali o campi fuori range', () => {
      expect(isInstantISOFormat('')).toBe(false);
      expect(isInstantISOFormat('non-una-data')).toBe(false);
      expect(isInstantISOFormat('2026-13-01T00:00:00Z')).toBe(false); // mese 13
      expect(isInstantISOFormat('2026-08-01T24:00:00Z')).toBe(false); // ora 24
      expect(isInstantISOFormat('2026-08-01T18:60:00Z')).toBe(false); // minuto 60
      expect(isInstantISOFormat('2026-08-01')).toBe(false); // solo data
    });
  });

  it('unsafeAsInstantISO applica il brand senza alterare il valore runtime', () => {
    const raw = '2026-08-01T18:00:00.000Z';
    const branded: InstantISO = unsafeAsInstantISO(raw);
    expect(branded).toBe(raw);
    expect(typeof branded).toBe('string');
  });
});

describe('IanaTimeZone (dominio)', () => {
  describe('isIanaTimeZoneFormat', () => {
    it('accetta identificatori IANA ben formati e UTC', () => {
      expect(isIanaTimeZoneFormat('Europe/Rome')).toBe(true);
      expect(isIanaTimeZoneFormat('America/New_York')).toBe(true);
      expect(isIanaTimeZoneFormat('America/Argentina/Buenos_Aires')).toBe(true);
      expect(isIanaTimeZoneFormat('Etc/GMT+2')).toBe(true);
      expect(isIanaTimeZoneFormat('UTC')).toBe(true);
    });

    it('rifiuta offset numerici e forme non IANA', () => {
      expect(isIanaTimeZoneFormat('+01:00')).toBe(false);
      expect(isIanaTimeZoneFormat('Rome')).toBe(false); // manca la regione
      expect(isIanaTimeZoneFormat('')).toBe(false);
      expect(isIanaTimeZoneFormat('Europe/')).toBe(false);
    });
  });

  it('espone le costanti di riferimento dell ADR come IanaTimeZone', () => {
    const zones: IanaTimeZone[] = [IANA.ROME, IANA.NEW_YORK, IANA.LOS_ANGELES, IANA.TOKYO, IANA.UTC];
    for (const z of zones) {
      expect(isIanaTimeZoneFormat(z)).toBe(true);
    }
  });

  it('unsafeAsIanaTimeZone applica il brand senza alterare il valore runtime', () => {
    expect(unsafeAsIanaTimeZone('Asia/Tokyo')).toBe('Asia/Tokyo');
  });
});

describe('ZonedInstant (value object)', () => {
  const build = () =>
    ZonedInstant.of({
      instant: unsafeAsInstantISO('2026-08-01T18:00:00.000Z'),
      timeZone: IANA.ROME,
      year: 2026,
      month: 8,
      day: 1,
      hour: 20,
      minute: 0,
      second: 0,
      offsetMinutes: 120,
    });

  it('deriva dayString, minutesSinceMidnight e HH:mm dalla proiezione locale', () => {
    const z = build();
    expect(z.dayString()).toBe('2026-08-01');
    expect(z.minutesSinceMidnight()).toBe(20 * 60);
    expect(z.toLocalHHmm()).toBe('20:00');
  });

  it('è immutabile (congelato): un tentativo di riscrittura non ha effetto', () => {
    const z = build();
    expect(Object.isFrozen(z)).toBe(true);
    // In codice strict l assegnazione lancerebbe; qui basta verificare che il
    // congelamento impedisca comunque la mutazione (value object immutabile).
    try {
      (z as unknown as { hour: number }).hour = 5;
    } catch {
      // ignorato: in strict mode l assegnazione a proprietà congelata lancia
    }
    expect(z.hour).toBe(20);
  });

  it('equals confronta instante E fuso (stesso momento, fusi diversi ≠ uguali)', () => {
    const a = build();
    const b = build();
    expect(a.equals(b)).toBe(true);

    const sameInstantOtherZone = ZonedInstant.of({
      instant: unsafeAsInstantISO('2026-08-01T18:00:00.000Z'),
      timeZone: IANA.TOKYO,
      year: 2026,
      month: 8,
      day: 2,
      hour: 3,
      minute: 0,
      second: 0,
      offsetMinutes: 540,
    });
    expect(a.equals(sameInstantOtherZone)).toBe(false);
  });

  it('toString rende instante e fuso in forma leggibile', () => {
    expect(build().toString()).toBe('2026-08-01T18:00:00.000Z[Europe/Rome]');
  });

  it('padda correttamente mesi/giorni/ore a una cifra in dayString e HH:mm', () => {
    const z = ZonedInstant.of({
      instant: unsafeAsInstantISO('2026-03-01T07:05:00.000Z'),
      timeZone: IANA.ROME,
      year: 2026,
      month: 3,
      day: 1,
      hour: 8,
      minute: 5,
      second: 0,
      offsetMinutes: 60,
    });
    expect(z.dayString()).toBe('2026-03-01');
    expect(z.toLocalHHmm()).toBe('08:05');
  });
});
