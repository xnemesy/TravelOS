import { Accommodation, HotelPolicy, Transport } from '../trip/models/trip-setup.model';
import { JourneyAnchor } from '../../core/engines/types/context.types';
import { LuggagePlanningService } from './LuggagePlanningService';

/**
 * Test del LuggagePlanningService (ADR-023, Sprint 18 — Fase 4).
 * Tutti i timestamp sono in UTC per rendere i test indipendenti dal fuso
 * orario della macchina, coerentemente con la derivazione UTC del servizio.
 */
describe('LuggagePlanningService', () => {
  const buildTransport = (overrides: Partial<Transport>): Transport => ({
    id: 'transport-1',
    mode: 'flight',
    destination: 'Lisbona',
    departureDate: new Date('2026-08-01T08:00:00.000Z'),
    confirmed: false,
    ...overrides,
  });

  const buildAccommodation = (overrides: Partial<Accommodation>): Accommodation => ({
    id: 'acc-1',
    type: 'hotel',
    name: 'Hotel Central',
    checkIn: new Date('2026-08-01T15:00:00.000Z'),
    checkOut: new Date('2026-08-05T10:00:00.000Z'),
    confirmed: false,
    coordinates: { lat: 38.72, lng: -9.14 },
    ...overrides,
  });

  const kinds = (anchors: JourneyAnchor[]) => anchors.map((a) => a.kind);

  // ------------------------------------------------------------------
  // Regola 2 — hotel senza deposito bagagli
  // ------------------------------------------------------------------
  it('non genera alcun anchor quando allowsLuggageDropoff è false', () => {
    const transports = [buildTransport({})];
    const accommodations = [buildAccommodation({})];
    const policy: HotelPolicy = { allowsLuggageDropoff: false };

    const anchors = LuggagePlanningService.buildLuggageAnchors(transports, accommodations, policy);

    expect(anchors).toEqual([]);
  });

  it('non genera alcun anchor quando la policy è assente (undefined trattato come non consentito)', () => {
    const transports = [buildTransport({})];
    const accommodations = [buildAccommodation({})];

    const anchors = LuggagePlanningService.buildLuggageAnchors(transports, accommodations, undefined);

    expect(anchors).toEqual([]);
  });

  it('non genera dropoff quando allowsLuggageDropoff è undefined ma altri campi policy sono presenti', () => {
    const transports = [buildTransport({})];
    const accommodations = [buildAccommodation({})];
    const policy: HotelPolicy = { allowsEarlyCheckIn: true };

    const anchors = LuggagePlanningService.buildLuggageAnchors(transports, accommodations, policy);

    expect(anchors).toEqual([]);
  });

  // ------------------------------------------------------------------
  // Regola 1 — hotel con deposito bagagli, arrivo prima del check-in
  // ------------------------------------------------------------------
  it('genera un solo luggage_dropoff quando arrivo precede check-in e il deposito è consentito', () => {
    const transports = [
      buildTransport({
        arrivalDate: new Date('2026-08-01T09:00:00.000Z'),
      }),
    ];
    const accommodations = [
      buildAccommodation({
        checkIn: new Date('2026-08-01T15:00:00.000Z'),
      }),
    ];
    const policy: HotelPolicy = { allowsLuggageDropoff: true };

    const anchors = LuggagePlanningService.buildLuggageAnchors(transports, accommodations, policy);

    expect(kinds(anchors)).toEqual(['luggage_dropoff']);
    const dropoff = anchors[0];
    expect(dropoff.kind).toBe('luggage_dropoff');
    // Deposito appena arrivati: parte all'istante di arrivo (09:00).
    expect(dropoff.startISO).toBe('2026-08-01T09:00:00.000Z');
    // Durata forfettaria 15 min, comunque prima del check-in.
    expect(dropoff.endISO).toBe('2026-08-01T09:15:00.000Z');
    expect(dropoff.sourceType).toBe('derived');
    expect(dropoff.sourceId).toBe('acc-1');
    expect(dropoff.coordinates).toEqual({ latitude: 38.72, longitude: -9.14 });
  });

  it('usa departureDate come istante di arrivo quando arrivalDate è assente', () => {
    const transports = [
      buildTransport({
        departureDate: new Date('2026-08-01T09:00:00.000Z'),
        arrivalDate: undefined,
      }),
    ];
    const accommodations = [
      buildAccommodation({ checkIn: new Date('2026-08-01T15:00:00.000Z') }),
    ];
    const policy: HotelPolicy = { allowsLuggageDropoff: true };

    const anchors = LuggagePlanningService.buildLuggageAnchors(transports, accommodations, policy);

    expect(kinds(anchors)).toEqual(['luggage_dropoff']);
    expect(anchors[0].startISO).toBe('2026-08-01T09:00:00.000Z');
  });

  it('limita la fine del dropoff al check-in quando la finestra è più corta della durata forfettaria', () => {
    const transports = [
      buildTransport({ arrivalDate: new Date('2026-08-01T14:55:00.000Z') }),
    ];
    const accommodations = [
      buildAccommodation({ checkIn: new Date('2026-08-01T15:00:00.000Z') }),
    ];
    const policy: HotelPolicy = { allowsLuggageDropoff: true };

    const anchors = LuggagePlanningService.buildLuggageAnchors(transports, accommodations, policy);

    expect(anchors[0].startISO).toBe('2026-08-01T14:55:00.000Z');
    // Fine limitata al check-in (Regola 4: nessuna sovrapposizione).
    expect(anchors[0].endISO).toBe('2026-08-01T15:00:00.000Z');
  });

  it('non genera dropoff di arrivo quando arrivo coincide o segue il check-in', () => {
    const transports = [
      buildTransport({ arrivalDate: new Date('2026-08-01T15:00:00.000Z') }),
    ];
    const accommodations = [
      buildAccommodation({ checkIn: new Date('2026-08-01T15:00:00.000Z') }),
    ];
    const policy: HotelPolicy = { allowsLuggageDropoff: true };

    const anchors = LuggagePlanningService.buildLuggageAnchors(transports, accommodations, policy);

    expect(anchors).toEqual([]);
  });

  // ------------------------------------------------------------------
  // Regola 3 — check-out molte ore prima del volo
  // ------------------------------------------------------------------
  it('genera dropoff, accommodation_return e pickup quando il check-out precede di molto la partenza', () => {
    const transports = [
      // Arrivo (tratta 1) — nessuna finestra di deposito all'arrivo qui.
      buildTransport({
        id: 't-arrival',
        // Arrivo all'orario di check-in: nessuna finestra di deposito all'arrivo,
        // così il test isola lo scenario di partenza.
        arrivalDate: new Date('2026-08-01T15:00:00.000Z'),
        departureDate: new Date('2026-08-01T12:00:00.000Z'),
      }),
      // Partenza (tratta 2) — volo serale.
      buildTransport({
        id: 't-departure',
        origin: 'Lisbona',
        destination: 'Roma',
        departureDate: new Date('2026-08-05T20:00:00.000Z'),
      }),
    ];
    const accommodations = [
      buildAccommodation({
        checkIn: new Date('2026-08-01T15:00:00.000Z'),
        checkOut: new Date('2026-08-05T10:00:00.000Z'),
      }),
    ];
    const policy: HotelPolicy = { allowsLuggageDropoff: true };

    const anchors = LuggagePlanningService.buildLuggageAnchors(transports, accommodations, policy);

    // check-out 10:00, volo 20:00 → finestra ampia: tutti e tre gli anchor.
    expect(kinds(anchors)).toEqual(['luggage_dropoff', 'accommodation_return', 'luggage_pickup']);

    const [dropoff, ret, pickup] = anchors;
    // Deposito subito dopo il check-out.
    expect(dropoff.startISO).toBe('2026-08-05T10:00:00.000Z');
    expect(dropoff.endISO).toBe('2026-08-05T10:15:00.000Z');
    // Ritiro appena prima della partenza.
    expect(pickup.startISO).toBe('2026-08-05T19:45:00.000Z');
    expect(pickup.endISO).toBe('2026-08-05T20:00:00.000Z');
    // Rientro in struttura subito prima del ritiro.
    expect(ret.startISO).toBe('2026-08-05T19:30:00.000Z');
    expect(ret.endISO).toBe('2026-08-05T19:45:00.000Z');
    expect(ret.kind).toBe('accommodation_return');
  });

  it('genera solo dropoff e pickup (senza accommodation_return) quando la finestra è stretta', () => {
    const transports = [
      buildTransport({ id: 't-arrival', arrivalDate: new Date('2026-08-01T15:00:00.000Z') }),
      buildTransport({
        id: 't-departure',
        destination: 'Roma',
        // check-out 10:00, volo 10:35 → finestra 35 min: entra solo dropoff+pickup
        // (2×15 = 30 ≤ 35 < 45 = 3×15).
        departureDate: new Date('2026-08-05T10:35:00.000Z'),
      }),
    ];
    const accommodations = [
      buildAccommodation({ checkOut: new Date('2026-08-05T10:00:00.000Z') }),
    ];
    const policy: HotelPolicy = { allowsLuggageDropoff: true };

    const anchors = LuggagePlanningService.buildLuggageAnchors(transports, accommodations, policy);

    expect(kinds(anchors)).toEqual(['luggage_dropoff', 'luggage_pickup']);
  });

  it('non genera anchor di partenza quando la finestra check-out→volo è troppo stretta', () => {
    const transports = [
      buildTransport({ id: 't-arrival', arrivalDate: new Date('2026-08-01T15:00:00.000Z') }),
      buildTransport({
        id: 't-departure',
        destination: 'Roma',
        // Finestra 20 min < 2×15: nessun anchor per non sovrapporre.
        departureDate: new Date('2026-08-05T10:20:00.000Z'),
      }),
    ];
    const accommodations = [
      buildAccommodation({ checkOut: new Date('2026-08-05T10:00:00.000Z') }),
    ];
    const policy: HotelPolicy = { allowsLuggageDropoff: true };

    const anchors = LuggagePlanningService.buildLuggageAnchors(transports, accommodations, policy);

    expect(anchors).toEqual([]);
  });

  it('omette accommodation_return quando la struttura non ha coordinate note', () => {
    const transports = [
      buildTransport({ id: 't-arrival', arrivalDate: new Date('2026-08-01T15:00:00.000Z') }),
      buildTransport({
        id: 't-departure',
        destination: 'Roma',
        departureDate: new Date('2026-08-05T20:00:00.000Z'),
      }),
    ];
    const accommodations = [
      buildAccommodation({
        checkOut: new Date('2026-08-05T10:00:00.000Z'),
        coordinates: undefined,
      }),
    ];
    const policy: HotelPolicy = { allowsLuggageDropoff: true };

    const anchors = LuggagePlanningService.buildLuggageAnchors(transports, accommodations, policy);

    expect(kinds(anchors)).toEqual(['luggage_dropoff', 'luggage_pickup']);
    expect(anchors.every((a) => a.coordinates === undefined)).toBe(true);
  });

  it('non genera anchor di partenza con una sola tratta (viaggio di sola andata)', () => {
    const transports = [
      buildTransport({ arrivalDate: new Date('2026-08-01T14:00:00.000Z') }),
    ];
    const accommodations = [
      buildAccommodation({ checkOut: new Date('2026-08-05T10:00:00.000Z') }),
    ];
    const policy: HotelPolicy = { allowsLuggageDropoff: true };

    const anchors = LuggagePlanningService.buildLuggageAnchors(transports, accommodations, policy);

    // Solo l'eventuale dropoff di arrivo, mai un pickup di partenza.
    expect(anchors.every((a) => a.kind !== 'luggage_pickup')).toBe(true);
    expect(anchors.every((a) => a.kind !== 'accommodation_return')).toBe(true);
  });

  // ------------------------------------------------------------------
  // Nessun accommodation
  // ------------------------------------------------------------------
  it('non genera alcun anchor quando non ci sono accommodation', () => {
    const transports = [
      buildTransport({ id: 't-arrival', arrivalDate: new Date('2026-08-01T15:00:00.000Z') }),
      buildTransport({ id: 't-departure', departureDate: new Date('2026-08-05T20:00:00.000Z') }),
    ];
    const policy: HotelPolicy = { allowsLuggageDropoff: true };

    const anchors = LuggagePlanningService.buildLuggageAnchors(transports, [], policy);

    expect(anchors).toEqual([]);
  });

  it('non genera alcun anchor quando non ci sono transports', () => {
    const accommodations = [buildAccommodation({})];
    const policy: HotelPolicy = { allowsLuggageDropoff: true };

    const anchors = LuggagePlanningService.buildLuggageAnchors([], accommodations, policy);

    expect(anchors).toEqual([]);
  });

  it('gestisce input completamente vuoti senza errori', () => {
    const policy: HotelPolicy = { allowsLuggageDropoff: true };
    expect(LuggagePlanningService.buildLuggageAnchors([], [], policy)).toEqual([]);
  });

  // ------------------------------------------------------------------
  // Più accommodation
  // ------------------------------------------------------------------
  it('usa la prima accommodation per l\'arrivo e l\'ultima per la partenza', () => {
    const transports = [
      buildTransport({ id: 't-arrival', arrivalDate: new Date('2026-08-01T09:00:00.000Z') }),
      buildTransport({ id: 't-departure', destination: 'Roma', departureDate: new Date('2026-08-06T20:00:00.000Z') }),
    ];
    const accommodations = [
      buildAccommodation({
        id: 'acc-first',
        name: 'Hotel Uno',
        checkIn: new Date('2026-08-01T15:00:00.000Z'),
        checkOut: new Date('2026-08-03T10:00:00.000Z'),
        coordinates: { lat: 1, lng: 1 },
      }),
      buildAccommodation({
        id: 'acc-last',
        name: 'Hotel Due',
        checkIn: new Date('2026-08-03T16:00:00.000Z'),
        checkOut: new Date('2026-08-06T10:00:00.000Z'),
        coordinates: { lat: 2, lng: 2 },
      }),
    ];
    const policy: HotelPolicy = { allowsLuggageDropoff: true };

    const anchors = LuggagePlanningService.buildLuggageAnchors(transports, accommodations, policy);

    const arrivalDropoff = anchors.find((a) => a.id === 'anchor-luggage-dropoff-arrival-acc-first');
    const departureDropoff = anchors.find((a) => a.id === 'anchor-luggage-dropoff-departure-acc-last');
    const pickup = anchors.find((a) => a.kind === 'luggage_pickup');

    expect(arrivalDropoff).toBeDefined();
    expect(arrivalDropoff?.sourceId).toBe('acc-first');
    expect(departureDropoff).toBeDefined();
    expect(departureDropoff?.sourceId).toBe('acc-last');
    expect(pickup?.sourceId).toBe('acc-last');
    // Ritiro basato sul check-out dell'ultima struttura (2026-08-06 10:00).
    expect(departureDropoff?.startISO).toBe('2026-08-06T10:00:00.000Z');
  });

  // ------------------------------------------------------------------
  // Attraversamento mezzanotte
  // ------------------------------------------------------------------
  it('gestisce anchor di partenza che attraversano la mezzanotte con date UTC corrette', () => {
    const transports = [
      buildTransport({ id: 't-arrival', arrivalDate: new Date('2026-08-01T15:00:00.000Z') }),
      buildTransport({
        id: 't-departure',
        destination: 'Roma',
        // Volo alle 00:10 del giorno dopo il check-out serale.
        departureDate: new Date('2026-08-06T00:10:00.000Z'),
      }),
    ];
    const accommodations = [
      buildAccommodation({ checkOut: new Date('2026-08-05T23:00:00.000Z') }),
    ];
    const policy: HotelPolicy = { allowsLuggageDropoff: true };

    const anchors = LuggagePlanningService.buildLuggageAnchors(transports, accommodations, policy);

    const dropoff = anchors.find((a) => a.kind === 'luggage_dropoff');
    const pickup = anchors.find((a) => a.kind === 'luggage_pickup');

    // Deposito il 5, ritiro a cavallo della mezzanotte (parte 5, finisce 6).
    expect(dropoff?.date).toBe('2026-08-05');
    expect(dropoff?.startISO).toBe('2026-08-05T23:00:00.000Z');
    expect(pickup?.startISO).toBe('2026-08-05T23:55:00.000Z');
    expect(pickup?.endISO).toBe('2026-08-06T00:10:00.000Z');
    // La `date` del ritiro riflette l'istante di inizio in UTC (giorno 5).
    expect(pickup?.date).toBe('2026-08-05');
  });

  // ------------------------------------------------------------------
  // Ordine cronologico garantito (Regola 8)
  // ------------------------------------------------------------------
  it('restituisce sempre gli anchor ordinati cronologicamente su tutto il viaggio', () => {
    const transports = [
      buildTransport({ id: 't-arrival', arrivalDate: new Date('2026-08-01T09:00:00.000Z') }),
      buildTransport({ id: 't-departure', destination: 'Roma', departureDate: new Date('2026-08-05T20:00:00.000Z') }),
    ];
    const accommodations = [
      buildAccommodation({
        checkIn: new Date('2026-08-01T15:00:00.000Z'),
        checkOut: new Date('2026-08-05T10:00:00.000Z'),
      }),
    ];
    const policy: HotelPolicy = { allowsLuggageDropoff: true };

    const anchors = LuggagePlanningService.buildLuggageAnchors(transports, accommodations, policy);

    // Arrivo dropoff + i tre di partenza = 4 anchor.
    expect(kinds(anchors)).toEqual([
      'luggage_dropoff',
      'luggage_dropoff',
      'accommodation_return',
      'luggage_pickup',
    ]);

    // Monotonicità stretta di startISO.
    for (let i = 1; i < anchors.length; i++) {
      const prev = new Date(anchors[i - 1].startISO).getTime();
      const curr = new Date(anchors[i].startISO).getTime();
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });

  it('non genera mai anchor sovrapposti tra loro (Regola 4)', () => {
    const transports = [
      buildTransport({ id: 't-arrival', arrivalDate: new Date('2026-08-01T09:00:00.000Z') }),
      buildTransport({ id: 't-departure', destination: 'Roma', departureDate: new Date('2026-08-05T20:00:00.000Z') }),
    ];
    const accommodations = [
      buildAccommodation({
        checkIn: new Date('2026-08-01T15:00:00.000Z'),
        checkOut: new Date('2026-08-05T10:00:00.000Z'),
      }),
    ];
    const policy: HotelPolicy = { allowsLuggageDropoff: true };

    const anchors = LuggagePlanningService.buildLuggageAnchors(transports, accommodations, policy);

    for (let i = 1; i < anchors.length; i++) {
      const prevEnd = new Date(anchors[i - 1].endISO).getTime();
      const currStart = new Date(anchors[i].startISO).getTime();
      // L'inizio di ogni anchor non precede la fine del precedente.
      expect(currStart).toBeGreaterThanOrEqual(prevEnd);
    }
  });

  // ------------------------------------------------------------------
  // Policy per singola struttura (`accommodation.hotelPolicy`)
  // ------------------------------------------------------------------
  it('rispetta la policy della singola struttura quando Hotel A ammette il deposito e Hotel B no', () => {
    const transports = [
      buildTransport({ id: 't-arrival', arrivalDate: new Date('2026-08-01T09:00:00.000Z') }),
      buildTransport({ id: 't-departure', destination: 'Roma', departureDate: new Date('2026-08-05T20:00:00.000Z') }),
    ];
    const accommodations = [
      buildAccommodation({
        id: 'acc-hotel-a',
        name: 'Hotel A (consente deposito)',
        checkIn: new Date('2026-08-01T15:00:00.000Z'),
        checkOut: new Date('2026-08-03T10:00:00.000Z'),
        hotelPolicy: { allowsLuggageDropoff: true },
      }),
      buildAccommodation({
        id: 'acc-hotel-b',
        name: 'Hotel B (non consente deposito)',
        checkIn: new Date('2026-08-03T16:00:00.000Z'),
        checkOut: new Date('2026-08-05T10:00:00.000Z'),
        hotelPolicy: { allowsLuggageDropoff: false },
      }),
    ];

    // Anche passando un policy globale fallback undefined, ogni struttura risponde per sé.
    const anchors = LuggagePlanningService.buildLuggageAnchors(transports, accommodations, undefined);

    // Deve generare solo il dropoff di arrivo per Hotel A, e nulla alla partenza per Hotel B.
    expect(kinds(anchors)).toEqual(['luggage_dropoff']);
    expect(anchors[0].sourceId).toBe('acc-hotel-a');
  });
});

