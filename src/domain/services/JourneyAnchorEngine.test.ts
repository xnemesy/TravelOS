import { unsafeAsInstantISO } from '../time';
import { JourneyAnchorEngine } from './JourneyAnchorEngine';
import { Transport, Accommodation } from '../trip/models/trip-setup.model';

function makeTransport(overrides: Partial<Transport>): Transport {
  return {
    id: 'transport-1',
    mode: 'flight',
    destination: 'Roma',
    departureDate: unsafeAsInstantISO('2026-08-01T13:00:00.000Z'),
    confirmed: true,
    ...overrides,
  } as Transport;
}

function makeAccommodation(overrides: Partial<Accommodation>): Accommodation {
  return {
    id: 'accommodation-1',
    type: 'hotel',
    name: 'Hotel Roma',
    checkIn: unsafeAsInstantISO('2026-08-01T15:00:00.000Z'),
    checkOut: unsafeAsInstantISO('2026-08-05T10:00:00.000Z'),
    confirmed: true,
    ...overrides,
  } as Accommodation;
}

describe('JourneyAnchorEngine.buildTripAnchors', () => {
  it('derives arrival and departure anchors from a round-trip transport + accommodation', () => {
    const transports: Transport[] = [
      makeTransport({
        id: 'in',
        arrivalDate: unsafeAsInstantISO('2026-08-01T15:30:00.000Z'),
        departureDate: unsafeAsInstantISO('2026-08-01T13:00:00.000Z'),
        origin: 'Milano',
        destination: 'Roma',
      }),
      makeTransport({
        id: 'out',
        departureDate: unsafeAsInstantISO('2026-08-05T18:00:00.000Z'),
        arrivalDate: unsafeAsInstantISO('2026-08-05T19:30:00.000Z'),
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
        arrivalDate: unsafeAsInstantISO('2026-08-01T15:30:00.000Z'),
        departureDate: unsafeAsInstantISO('2026-08-01T13:00:00.000Z'),
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
        departureDate: unsafeAsInstantISO('2026-08-05T18:00:00.000Z'),
        arrivalDate: unsafeAsInstantISO('2026-08-05T19:30:00.000Z'),
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

describe('JourneyAnchorEngine.buildTripAnchors — luggage integration (Sprint 18 Fase 5)', () => {
  const DROPOFF_POLICY = { allowsLuggageDropoff: true };
  const HOTEL_COORDS = { lat: 41.9, lng: 12.5 };

  // Round-trip: arrivo mattutino (dropoff d'arrivo) + check-out molto prima del
  // volo serale (dropoff/return/pickup di partenza). Deposito consentito.
  const roundTrip = () => ({
    transports: [
      makeTransport({
        id: 'in',
        departureDate: unsafeAsInstantISO('2026-08-01T07:00:00.000Z'),
        arrivalDate: unsafeAsInstantISO('2026-08-01T09:00:00.000Z'),
        origin: 'Milano',
        destination: 'Roma',
      }),
      makeTransport({
        id: 'out',
        departureDate: unsafeAsInstantISO('2026-08-05T20:00:00.000Z'),
        arrivalDate: unsafeAsInstantISO('2026-08-05T22:00:00.000Z'),
        origin: 'Roma',
        destination: 'Milano',
      }),
    ] as Transport[],
    accommodations: [
      makeAccommodation({
        checkIn: unsafeAsInstantISO('2026-08-01T15:00:00.000Z'),
        checkOut: unsafeAsInstantISO('2026-08-05T10:00:00.000Z'),
        coordinates: HOTEL_COORDS,
        hotelPolicy: DROPOFF_POLICY,
      }),
    ] as Accommodation[],
  });

  const LUGGAGE_KINDS = new Set(['luggage_dropoff', 'luggage_pickup', 'accommodation_return']);

  it('merges luggage anchors into the unified timeline when the hotel allows dropoff', () => {
    const { transports, accommodations } = roundTrip();
    const anchors = JourneyAnchorEngine.buildTripAnchors(transports, accommodations);
    const ids = anchors.map((a) => a.id);

    // Dropoff d'arrivo + dropoff/return/pickup di partenza, tutti presenti.
    expect(ids).toContain('anchor-luggage-dropoff-arrival-accommodation-1');
    expect(ids).toContain('anchor-luggage-dropoff-departure-accommodation-1');
    expect(ids).toContain('anchor-accommodation-return-accommodation-1');
    expect(ids).toContain('anchor-luggage-pickup-departure-accommodation-1');
    // Gli anchor strutturali restano tutti presenti (regression free).
    expect(anchors.map((a) => a.kind)).toEqual(
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

  it('leaves the base anchors unchanged (no luggage kinds) when no HotelPolicy is set', () => {
    const transports: Transport[] = [
      makeTransport({ id: 'in', arrivalDate: unsafeAsInstantISO('2026-08-01T09:00:00.000Z') }),
      makeTransport({ id: 'out', departureDate: unsafeAsInstantISO('2026-08-05T20:00:00.000Z') }),
    ];
    // makeAccommodation di default NON ha hotelPolicy → nessun anchor bagagli.
    const anchors = JourneyAnchorEngine.buildTripAnchors(transports, [makeAccommodation({})]);

    expect(anchors.some((a) => LUGGAGE_KINDS.has(a.kind))).toBe(false);
  });

  it('returns the merged timeline sorted chronologically by startISO', () => {
    const { transports, accommodations } = roundTrip();
    const anchors = JourneyAnchorEngine.buildTripAnchors(transports, accommodations);

    for (let i = 1; i < anchors.length; i++) {
      const prev = new Date(anchors[i - 1].startISO).getTime();
      const curr = new Date(anchors[i].startISO).getTime();
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });

  it('breaks startISO ties deterministically: base anchors precede luggage anchors', () => {
    const { transports, accommodations } = roundTrip();
    const anchors = JourneyAnchorEngine.buildTripAnchors(transports, accommodations);

    // arrival_airport, transfer e il dropoff d'arrivo condividono le 09:00 UTC.
    const airportIdx = anchors.findIndex((a) => a.kind === 'arrival_airport');
    const transferIdx = anchors.findIndex((a) => a.kind === 'transfer');
    const dropoffIdx = anchors.findIndex((a) => a.id === 'anchor-luggage-dropoff-arrival-accommodation-1');

    expect(anchors[airportIdx].startISO).toBe('2026-08-01T09:00:00.000Z');
    expect(anchors[dropoffIdx].startISO).toBe('2026-08-01T09:00:00.000Z');
    // Gli anchor base (origin prioritario) precedono sempre quello bagagli a parità di istante.
    expect(airportIdx).toBeLessThan(dropoffIdx);
    expect(transferIdx).toBeLessThan(dropoffIdx);
  });

  it('keeps getDayActivityWindow identical whether or not luggage anchors are present', () => {
    const { transports, accommodations } = roundTrip();
    const withLuggage = JourneyAnchorEngine.buildTripAnchors(transports, accommodations);

    // Stesso identico input senza hotelPolicy → nessun anchor bagagli generato.
    const noPolicyAccommodations: Accommodation[] = [
      makeAccommodation({
        checkIn: unsafeAsInstantISO('2026-08-01T15:00:00.000Z'),
        checkOut: unsafeAsInstantISO('2026-08-05T10:00:00.000Z'),
        coordinates: HOTEL_COORDS,
      }),
    ];
    const withoutLuggage = JourneyAnchorEngine.buildTripAnchors(transports, noPolicyAccommodations);

    for (const date of ['2026-08-01', '2026-08-05']) {
      expect(JourneyAnchorEngine.getDayActivityWindow(withLuggage, date)).toEqual(
        JourneyAnchorEngine.getDayActivityWindow(withoutLuggage, date)
      );
    }
  });

  it('projects luggage anchors into locked PlaceRefs, exactly like structural anchors', () => {
    const { transports, accommodations } = roundTrip();
    const anchors = JourneyAnchorEngine.buildTripAnchors(transports, accommodations);
    const refs = JourneyAnchorEngine.toPlaceRefs(anchors, '2026-08-01');

    const dropoffRef = refs.find((r) => r.id === 'anchor-luggage-dropoff-arrival-accommodation-1');
    expect(dropoffRef).toBeDefined();
    expect(dropoffRef!.isBlock).toBe(true);
    expect(dropoffRef!.isLocked).toBe(true);
    expect(dropoffRef!.anchorType).toBe('HARD');
    expect(dropoffRef!.role).toBe('anchor');
    expect(dropoffRef!.journeyAnchorKind).toBe('luggage_dropoff');
    expect(typeof dropoffRef!.scheduledTime).toBe('string');
    expect(dropoffRef!.name.length).toBeGreaterThan(0);
    expect(dropoffRef!.coordinates).toEqual({ latitude: HOTEL_COORDS.lat, longitude: HOTEL_COORDS.lng });
  });

  it('produces no duplicate anchor ids across the merged timeline', () => {
    const { transports, accommodations } = roundTrip();
    const anchors = JourneyAnchorEngine.buildTripAnchors(transports, accommodations);
    const ids = anchors.map((a) => a.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('arrival-only trip: emits only the arrival luggage_dropoff, no departure luggage anchors', () => {
    // Una sola tratta → viaggio di sola andata, nessun anchor di partenza.
    const transports: Transport[] = [
      makeTransport({ id: 'in', arrivalDate: unsafeAsInstantISO('2026-08-01T09:00:00.000Z'), destination: 'Roma' }),
    ];
    const accommodations: Accommodation[] = [
      makeAccommodation({ checkIn: unsafeAsInstantISO('2026-08-01T15:00:00.000Z'), hotelPolicy: DROPOFF_POLICY, coordinates: HOTEL_COORDS }),
    ];
    const anchors = JourneyAnchorEngine.buildTripAnchors(transports, accommodations);
    const luggage = anchors.filter((a) => LUGGAGE_KINDS.has(a.kind));

    expect(luggage.map((a) => a.kind)).toEqual(['luggage_dropoff']);
    expect(anchors.some((a) => a.kind === 'departure_flight')).toBe(false);
  });

  it('departure-only trip: emits only the departure luggage anchors, no arrival dropoff', () => {
    // Round-trip ma arrivo all'orario di check-in → nessun dropoff d'arrivo.
    const transports: Transport[] = [
      makeTransport({ id: 'in', arrivalDate: unsafeAsInstantISO('2026-08-01T15:00:00.000Z'), destination: 'Roma' }),
      makeTransport({ id: 'out', departureDate: unsafeAsInstantISO('2026-08-05T20:00:00.000Z'), destination: 'Milano' }),
    ];
    const accommodations: Accommodation[] = [
      makeAccommodation({
        checkIn: unsafeAsInstantISO('2026-08-01T15:00:00.000Z'),
        checkOut: unsafeAsInstantISO('2026-08-05T10:00:00.000Z'),
        hotelPolicy: DROPOFF_POLICY,
        coordinates: HOTEL_COORDS,
      }),
    ];
    const anchors = JourneyAnchorEngine.buildTripAnchors(transports, accommodations);

    expect(anchors.some((a) => a.id === 'anchor-luggage-dropoff-arrival-accommodation-1')).toBe(false);
    expect(anchors.some((a) => a.kind === 'luggage_pickup')).toBe(true);
    expect(anchors.some((a) => a.kind === 'accommodation_return')).toBe(true);
  });

  it('multi-hotel trip: arrival dropoff on first hotel, departure anchors on last hotel', () => {
    const transports: Transport[] = [
      makeTransport({ id: 'in', arrivalDate: unsafeAsInstantISO('2026-08-01T09:00:00.000Z'), destination: 'Roma' }),
      makeTransport({ id: 'out', departureDate: unsafeAsInstantISO('2026-08-06T20:00:00.000Z'), destination: 'Milano' }),
    ];
    const accommodations: Accommodation[] = [
      makeAccommodation({
        id: 'hotel-first',
        name: 'Hotel Uno',
        checkIn: unsafeAsInstantISO('2026-08-01T15:00:00.000Z'),
        checkOut: unsafeAsInstantISO('2026-08-03T10:00:00.000Z'),
        hotelPolicy: DROPOFF_POLICY,
        coordinates: { lat: 1, lng: 1 },
      }),
      makeAccommodation({
        id: 'hotel-last',
        name: 'Hotel Due',
        checkIn: unsafeAsInstantISO('2026-08-03T16:00:00.000Z'),
        checkOut: unsafeAsInstantISO('2026-08-06T10:00:00.000Z'),
        hotelPolicy: DROPOFF_POLICY,
        coordinates: { lat: 2, lng: 2 },
      }),
    ];
    const anchors = JourneyAnchorEngine.buildTripAnchors(transports, accommodations);

    const arrivalDropoff = anchors.find((a) => a.id === 'anchor-luggage-dropoff-arrival-hotel-first');
    const departureDropoff = anchors.find((a) => a.id === 'anchor-luggage-dropoff-departure-hotel-last');
    const pickup = anchors.find((a) => a.kind === 'luggage_pickup');

    expect(arrivalDropoff?.sourceId).toBe('hotel-first');
    expect(departureDropoff?.sourceId).toBe('hotel-last');
    expect(pickup?.sourceId).toBe('hotel-last');
    // Ordine cronologico complessivo garantito anche con più hotel.
    for (let i = 1; i < anchors.length; i++) {
      expect(new Date(anchors[i].startISO).getTime()).toBeGreaterThanOrEqual(
        new Date(anchors[i - 1].startISO).getTime()
      );
    }
  });
});
