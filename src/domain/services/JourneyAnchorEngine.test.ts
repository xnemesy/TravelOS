import { JourneyAnchorEngine } from './JourneyAnchorEngine';
import { Transport, Accommodation } from '../trip/models/trip-setup.model';

function makeTransport(overrides: Partial<Transport>): Transport {
  return {
    id: 'transport-1',
    mode: 'flight',
    destination: 'Roma',
    departureDate: new Date('2026-08-01T13:00:00.000Z'),
    confirmed: true,
    ...overrides,
  } as Transport;
}

function makeAccommodation(overrides: Partial<Accommodation>): Accommodation {
  return {
    id: 'accommodation-1',
    type: 'hotel',
    name: 'Hotel Roma',
    checkIn: new Date('2026-08-01T15:00:00.000Z'),
    checkOut: new Date('2026-08-05T10:00:00.000Z'),
    confirmed: true,
    ...overrides,
  } as Accommodation;
}

describe('JourneyAnchorEngine.buildTripAnchors', () => {
  it('derives arrival and departure anchors from a round-trip transport + accommodation', () => {
    const transports: Transport[] = [
      makeTransport({
        id: 'in',
        arrivalDate: new Date('2026-08-01T15:30:00.000Z'),
        departureDate: new Date('2026-08-01T13:00:00.000Z'),
        origin: 'Milano',
        destination: 'Roma',
      }),
      makeTransport({
        id: 'out',
        departureDate: new Date('2026-08-05T18:00:00.000Z'),
        arrivalDate: new Date('2026-08-05T19:30:00.000Z'),
        origin: 'Roma',
        destination: 'Milano',
      }),
    ];
    const accommodations: Accommodation[] = [makeAccommodation({})];

    const anchors = JourneyAnchorEngine.buildTripAnchors(transports, accommodations);
    const kinds = anchors.map((a) => a.kind);

    expect(kinds).toEqual(
      expect.arrayContaining([
        'arrival_flight',
        'arrival_airport',
        'transfer',
        'check_in',
        'check_out',
        'departure_transfer',
        'departure_airport',
        'departure_flight',
      ])
    );
  });

  it('never lets the arrival-day activity window start before the traveler has checked in', () => {
    const transports: Transport[] = [
      makeTransport({
        id: 'in',
        arrivalDate: new Date('2026-08-01T15:30:00.000Z'),
        departureDate: new Date('2026-08-01T13:00:00.000Z'),
      }),
    ];
    const accommodations: Accommodation[] = [makeAccommodation({})];

    const anchors = JourneyAnchorEngine.buildTripAnchors(transports, accommodations);
    const window = JourneyAnchorEngine.getDayActivityWindow(anchors, '2026-08-01');

    expect(window).not.toBeNull();
    // checkIn è alle 15:00 UTC → 900 minuti da mezzanotte
    expect(window!.startMinutes).toBeGreaterThanOrEqual(15 * 60);
  });

  it('never lets the departure-day activity window end after the departure transfer must begin', () => {
    const transports: Transport[] = [
      makeTransport({
        id: 'out',
        departureDate: new Date('2026-08-05T18:00:00.000Z'),
        arrivalDate: new Date('2026-08-05T19:30:00.000Z'),
      }),
    ];
    const accommodations: Accommodation[] = [makeAccommodation({})];

    const anchors = JourneyAnchorEngine.buildTripAnchors(transports, accommodations);
    const window = JourneyAnchorEngine.getDayActivityWindow(anchors, '2026-08-05');

    expect(window).not.toBeNull();
    // Volo alle 18:00 UTC (1080 min), buffer aeroporto 120' + transfer 45' → tetto <= 915 min
    expect(window!.endMinutes).toBeLessThanOrEqual(18 * 60 - 120);
  });

  it('returns no window constraint for a day with no arrival/departure anchors', () => {
    const anchors = JourneyAnchorEngine.buildTripAnchors([], []);
    expect(JourneyAnchorEngine.getDayActivityWindow(anchors, '2026-08-03')).toBeNull();
  });
});
