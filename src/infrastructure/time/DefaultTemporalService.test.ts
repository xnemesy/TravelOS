import { IANA } from '../../domain/time/IanaTimeZone';
import { unsafeAsInstantISO } from '../../domain/time/InstantISO';
import { DefaultTemporalService } from './DefaultTemporalService';

/**
 * ============================================================================
 * Test di contratto di DefaultTemporalService (ADR-025 §12, §13)
 * ============================================================================
 * Ogni test inietta un instante FISSO e verifica la proiezione attesa — mai
 * `Date.now()`, mai dipendenza dal fuso del device (§12, "test di contratto").
 * Le fixture coprono: 4 città, cross-fuso, overnight/confini di giornata, DST
 * forward/backward per Roma/NY/LA con Tokyo come controllo senza DST, e la
 * disambiguazione di orari ambigui/inesistenti.
 *
 * Instante di riferimento dell ADR §13: 2026-08-01T18:00:00.000Z.
 */
const svc = new DefaultTemporalService();

const inst = (iso: string) => unsafeAsInstantISO(iso);
const REF = inst('2026-08-01T18:00:00.000Z');

describe('DefaultTemporalService — parsing e validazione instante', () => {
  it('parseInstant canonicalizza a UTC con millisecondi', () => {
    expect(svc.parseInstant('2026-08-01T18:00:00Z')).toBe('2026-08-01T18:00:00.000Z');
    expect(svc.parseInstant('2026-08-01T18:00:00.5Z')).toBe('2026-08-01T18:00:00.500Z');
  });

  it('parseInstant rifiuta date di calendario impossibili (30 febbraio)', () => {
    expect(() => svc.parseInstant('2026-02-30T00:00:00Z')).toThrow(RangeError);
    expect(svc.isValidInstant('2026-02-30T00:00:00Z')).toBe(false);
  });

  it('parseInstant rifiuta formati non UTC o malformati', () => {
    expect(() => svc.parseInstant('2026-08-01T18:00:00+02:00')).toThrow();
    expect(() => svc.parseInstant('non-una-data')).toThrow();
    expect(svc.isValidInstant('2026-13-01T00:00:00Z')).toBe(false);
  });

  it('accetta il 29 febbraio di un anno bisestile (2028)', () => {
    expect(svc.isValidInstant('2028-02-29T12:00:00Z')).toBe(true);
    expect(svc.isValidInstant('2027-02-29T12:00:00Z')).toBe(false);
  });

  it('round-trip epoch millis ↔ instante', () => {
    const ms = svc.epochMillisOf(REF);
    expect(ms).toBe(Date.UTC(2026, 7, 1, 18, 0, 0));
    expect(svc.instantFromEpochMillis(ms)).toBe(REF);
  });
});

describe('DefaultTemporalService — proiezione nelle 4 città (ADR §13)', () => {
  it('Europe/Rome → 20:00 dello stesso giorno (UTC+2, CEST)', () => {
    const z = svc.toZoned(REF, IANA.ROME);
    expect(z.dayString()).toBe('2026-08-01');
    expect(z.hour).toBe(20);
    expect(z.minute).toBe(0);
    expect(z.offsetMinutes).toBe(120);
    expect(z.toLocalHHmm()).toBe('20:00');
  });

  it('America/New_York → 14:00 dello stesso giorno (UTC-4, EDT)', () => {
    const z = svc.toZoned(REF, IANA.NEW_YORK);
    expect(z.dayString()).toBe('2026-08-01');
    expect(z.hour).toBe(14);
    expect(z.offsetMinutes).toBe(-240);
  });

  it('America/Los_Angeles → 11:00 dello stesso giorno (UTC-7, PDT)', () => {
    const z = svc.toZoned(REF, IANA.LOS_ANGELES);
    expect(z.hour).toBe(11);
    expect(z.offsetMinutes).toBe(-420);
  });

  it('Asia/Tokyo → 03:00 del GIORNO SUCCESSIVO (UTC+9, cambio giorno solare)', () => {
    const z = svc.toZoned(REF, IANA.TOKYO);
    expect(z.dayString()).toBe('2026-08-02'); // il dateStr ingenuo UTC sarebbe errato
    expect(z.hour).toBe(3);
    expect(z.offsetMinutes).toBe(540);
    expect(z.minutesSinceMidnight()).toBe(3 * 60);
  });
});

describe('DefaultTemporalService — volo cross-fuso Roma → New York (ADR §13)', () => {
  // Parte Roma 14:00 locale, atterra New York 17:30 locale, stesso giorno.
  const departure = svc.fromLocal({ year: 2026, month: 8, day: 1, hour: 14, minute: 0 }, IANA.ROME);
  const arrival = svc.fromLocal({ year: 2026, month: 8, day: 1, hour: 17, minute: 30 }, IANA.NEW_YORK);

  it('gli instanti assoluti corrispondono agli orari locali dei due aeroporti', () => {
    expect(departure).toBe('2026-08-01T12:00:00.000Z'); // 14:00 CEST − 2h
    expect(arrival).toBe('2026-08-01T21:30:00.000Z'); // 17:30 EDT + 4h
  });

  it('ogni capo si riproietta nell ora locale attesa del proprio aeroporto', () => {
    expect(svc.toZoned(departure, IANA.ROME).toLocalHHmm()).toBe('14:00');
    expect(svc.toZoned(arrival, IANA.NEW_YORK).toLocalHHmm()).toBe('17:30');
  });

  it('la durata di volo (differenza fra Instant) è corretta e indipendente dai fusi', () => {
    expect(svc.minutesBetween(departure, arrival)).toBe(9 * 60 + 30); // 9h30m
  });

  it('compareInstants ordina partenza prima di arrivo', () => {
    expect(svc.compareInstants(departure, arrival)).toBe(-1);
    expect(svc.compareInstants(arrival, departure)).toBe(1);
    expect(svc.compareInstants(departure, departure)).toBe(0);
  });
});

describe('DefaultTemporalService — confini di giornata relativi al fuso (§4.2)', () => {
  it('la giornata di Tokyo inizia/finisce a mezzanotte di Tokyo, non UTC', () => {
    const { startInstant, endInstant } = svc.zonedDayBoundaries('2026-08-02', IANA.TOKYO);
    // Mezzanotte a Tokyo (UTC+9) = 15:00Z del giorno precedente.
    expect(startInstant).toBe('2026-08-01T15:00:00.000Z');
    expect(endInstant).toBe('2026-08-02T15:00:00.000Z');
    // L instante di riferimento (18:00Z = 03:00 Tokyo del 2 ago) cade dentro la giornata.
    expect(svc.compareInstants(startInstant, REF)).toBe(-1);
    expect(svc.compareInstants(REF, endInstant)).toBe(-1);
  });

  it('la giornata di New York inizia a mezzanotte locale (EDT)', () => {
    const { startInstant, endInstant } = svc.zonedDayBoundaries('2026-08-01', IANA.NEW_YORK);
    expect(startInstant).toBe('2026-08-01T04:00:00.000Z'); // 00:00 EDT = 04:00Z
    expect(endInstant).toBe('2026-08-02T04:00:00.000Z');
  });

  it('rifiuta una dayString malformata', () => {
    expect(() => svc.zonedDayBoundaries('2026-8-1', IANA.ROME)).toThrow(RangeError);
  });
});

describe('DefaultTemporalService — attività overnight (attraversa la mezzanotte locale)', () => {
  it('assegna al giorno di calendario corretto un evento poco dopo mezzanotte a Tokyo', () => {
    // 00:30 del 2 agosto a Tokyo = 15:30Z del 1 agosto.
    const local = svc.fromLocal({ year: 2026, month: 8, day: 2, hour: 0, minute: 30 }, IANA.TOKYO);
    expect(local).toBe('2026-08-01T15:30:00.000Z');
    const z = svc.toZoned(local, IANA.TOKYO);
    expect(z.dayString()).toBe('2026-08-02'); // giorno LOCALE, non UTC (1 ago)
    expect(z.minutesSinceMidnight()).toBe(30);
  });
});

describe('DefaultTemporalService — DST forward (ora che SPARISCE)', () => {
  it('Los Angeles 2026-03-08: 02:30 non esiste → compatible passa a 03:30 PDT', () => {
    const i = svc.fromLocal({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }, IANA.LOS_ANGELES);
    expect(i).toBe('2026-03-08T10:30:00.000Z'); // 03:30 PDT (UTC-7)
    expect(svc.toZoned(i, IANA.LOS_ANGELES).toLocalHHmm()).toBe('03:30');
  });

  it('Los Angeles 2026-03-08: earlier resta prima del gap (01:30 PST)', () => {
    const i = svc.fromLocal(
      { year: 2026, month: 3, day: 8, hour: 2, minute: 30 },
      IANA.LOS_ANGELES,
      'earlier'
    );
    expect(i).toBe('2026-03-08T09:30:00.000Z'); // 01:30 PST (UTC-8)
  });

  it('Los Angeles 2026-03-08: reject lancia sull ora inesistente', () => {
    expect(() =>
      svc.fromLocal({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }, IANA.LOS_ANGELES, 'reject')
    ).toThrow(/inesistente/);
  });

  it('Europe/Rome 2026-03-29: 02:30 non esiste → compatible passa a 03:30 CEST', () => {
    const i = svc.fromLocal({ year: 2026, month: 3, day: 29, hour: 2, minute: 30 }, IANA.ROME);
    expect(i).toBe('2026-03-29T01:30:00.000Z'); // 03:30 CEST (UTC+2)
    expect(svc.toZoned(i, IANA.ROME).toLocalHHmm()).toBe('03:30');
  });
});

describe('DefaultTemporalService — DST backward (ora AMBIGUA, esiste due volte)', () => {
  it('Los Angeles 2026-11-01: 01:30 esiste due volte; earlier=PDT, later=PST', () => {
    const earlier = svc.fromLocal(
      { year: 2026, month: 11, day: 1, hour: 1, minute: 30 },
      IANA.LOS_ANGELES,
      'earlier'
    );
    const later = svc.fromLocal(
      { year: 2026, month: 11, day: 1, hour: 1, minute: 30 },
      IANA.LOS_ANGELES,
      'later'
    );
    expect(earlier).toBe('2026-11-01T08:30:00.000Z'); // 01:30 PDT (UTC-7)
    expect(later).toBe('2026-11-01T09:30:00.000Z'); // 01:30 PST (UTC-8)
    expect(svc.minutesBetween(earlier, later)).toBe(60);
  });

  it('default compatible sceglie l occorrenza pre-transizione (earlier, ADR §13)', () => {
    const def = svc.fromLocal({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }, IANA.LOS_ANGELES);
    expect(def).toBe('2026-11-01T08:30:00.000Z');
  });

  it('Europe/Rome 2026-10-25: 02:30 ambiguo; earlier=CEST, later=CET', () => {
    const earlier = svc.fromLocal(
      { year: 2026, month: 10, day: 25, hour: 2, minute: 30 },
      IANA.ROME,
      'earlier'
    );
    const later = svc.fromLocal({ year: 2026, month: 10, day: 25, hour: 2, minute: 30 }, IANA.ROME, 'later');
    expect(earlier).toBe('2026-10-25T00:30:00.000Z'); // 02:30 CEST (UTC+2)
    expect(later).toBe('2026-10-25T01:30:00.000Z'); // 02:30 CET (UTC+1)
  });

  it('reject lancia sull ora ambigua', () => {
    expect(() =>
      svc.fromLocal({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }, IANA.NEW_YORK, 'reject')
    ).toThrow(/ambiguo/);
  });
});

describe('DefaultTemporalService — Tokyo come controllo senza DST', () => {
  it('nessuna ambiguità né gap intorno alle date di transizione altrui', () => {
    // Le stesse date/ore che altrove sono critiche, a Tokyo sono ordinarie.
    const a = svc.fromLocal({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }, IANA.TOKYO);
    const b = svc.fromLocal({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }, IANA.TOKYO);
    expect(svc.toZoned(a, IANA.TOKYO).toLocalHHmm()).toBe('02:30');
    expect(svc.toZoned(b, IANA.TOKYO).toLocalHHmm()).toBe('01:30');
    // Offset costante +540 tutto l anno.
    expect(svc.toZoned(a, IANA.TOKYO).offsetMinutes).toBe(540);
    expect(svc.toZoned(b, IANA.TOKYO).offsetMinutes).toBe(540);
  });
});

describe('DefaultTemporalService — aritmetica plusMinutes DST-consapevole', () => {
  it('somma minuti di tempo trascorso attraversando il gap DST di primavera (Roma)', () => {
    // 01:30 CET del 29/03 (00:30Z). +60 minuti reali → 03:30 CEST (l ora 02:xx non esiste).
    const start = svc.toZoned(inst('2026-03-29T00:30:00.000Z'), IANA.ROME);
    expect(start.toLocalHHmm()).toBe('01:30');
    const plus60 = svc.plusMinutes(start, 60);
    expect(plus60.instant).toBe('2026-03-29T01:30:00.000Z');
    expect(plus60.toLocalHHmm()).toBe('03:30'); // salta le 02:xx, DST-consapevole
  });

  it('plusMinutes su fuso senza DST è aritmetica lineare', () => {
    const start = svc.toZoned(REF, IANA.TOKYO); // 03:00 del 2 ago
    const plus90 = svc.plusMinutes(start, 90);
    expect(plus90.toLocalHHmm()).toBe('04:30');
    expect(plus90.dayString()).toBe('2026-08-02');
  });

  it('plusMinutes con valore negativo torna indietro nel tempo', () => {
    const start = svc.toZoned(REF, IANA.ROME);
    expect(svc.plusMinutes(start, -120).toLocalHHmm()).toBe('18:00');
  });
});

describe('DefaultTemporalService — validazione e risoluzione fuso', () => {
  it('isValidTimeZone distingue fusi reali da forme non risolvibili', () => {
    expect(svc.isValidTimeZone('Europe/Rome')).toBe(true);
    expect(svc.isValidTimeZone('UTC')).toBe(true);
    expect(svc.isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
    expect(svc.isValidTimeZone('+01:00')).toBe(false);
  });

  it('timeZone valida e applica il brand, o lancia', () => {
    expect(svc.timeZone('Asia/Tokyo')).toBe('Asia/Tokyo');
    expect(() => svc.timeZone('Nowhere/Nope')).toThrow(RangeError);
  });

  it('toZoned lancia su un fuso non risolvibile', () => {
    expect(() => svc.toZoned(REF, 'Mars/Olympus' as never)).toThrow(RangeError);
  });

  it('resolveTimeZone delega al resolver iniettato (fuso derivato dal luogo)', () => {
    expect(svc.resolveTimeZone({ iataCode: 'FCO' })).toEqual({
      timeZone: 'Europe/Rome',
      source: 'iata',
    });
    expect(svc.resolveTimeZone({}).source).toBe('fallback');
  });
});

describe('DefaultTemporalService — indipendenza dal device e determinismo (§12)', () => {
  it('now() restituisce un InstantISO valido e canonico', () => {
    const n = svc.now();
    expect(svc.isValidInstant(n)).toBe(true);
    expect(n).toMatch(/Z$/);
  });

  it('la proiezione dipende SOLO da (instant, timeZone), mai da Date.now o dal TZ del device', () => {
    // Ripetibile: nessuno stato interno mutabile influenza il risultato.
    const first = svc.toZoned(REF, IANA.LOS_ANGELES);
    const second = svc.toZoned(REF, IANA.LOS_ANGELES);
    expect(second.instant).toBe(first.instant);
    expect(second.hour).toBe(first.hour);
    expect(second.offsetMinutes).toBe(first.offsetMinutes);
  });
});
