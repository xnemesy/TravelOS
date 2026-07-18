import { unsafeAsInstantISO } from '../time';
import { Accommodation, Transport } from '../trip/models/trip-setup.model';
import { EndOfDayClosureService, EndOfDayClosureQuery } from './EndOfDayClosureService';

/**
 * Test dell'EndOfDayClosureService (ADR-024, Sprint 18 — Fase 6, Regola C).
 * Tutti i timestamp sono in UTC per rendere i test indipendenti dal fuso
 * orario della macchina, coerentemente con la valutazione UTC del servizio.
 */
describe('EndOfDayClosureService', () => {
  const buildAccommodation = (overrides: Partial<Accommodation>): Accommodation => ({
    id: 'acc-1',
    type: 'hotel',
    name: 'Hotel Central',
    checkIn: unsafeAsInstantISO('2026-08-01T15:00:00.000Z'),
    checkOut: unsafeAsInstantISO('2026-08-05T10:00:00.000Z'),
    confirmed: false,
    coordinates: { lat: 38.72, lng: -9.14 },
    ...overrides,
  });

  const buildTransport = (overrides: Partial<Transport>): Transport => ({
    id: 'transport-1',
    mode: 'flight',
    destination: 'Lisbona',
    departureDate: unsafeAsInstantISO('2026-08-01T08:00:00.000Z'),
    confirmed: false,
    ...overrides,
  });

  // Base: giornata centrale del viaggio, ultimo nodo = attività, tempo abbondante.
  const baseQuery = (overrides: Partial<EndOfDayClosureQuery>): EndOfDayClosureQuery => ({
    dateStr: '2026-08-03',
    lastNodeAnchorKind: undefined,
    accommodations: [buildAccommodation({})],
    transports: [buildTransport({})],
    lastActivityEndMinutes: 19 * 60, // 19:00
    ...overrides,
  });

  // ------------------------------------------------------------------
  // Giornata normale di sightseeing → rientro richiesto (Regola B).
  // ------------------------------------------------------------------
  it('richiede il rientro in una normale giornata di sightseeing con pernottamento in hotel', () => {
    const decision = EndOfDayClosureService.evaluate(baseQuery({}));

    expect(decision.shouldReturn).toBe(true);
    expect(decision.reasonCode).toBe('RETURN_REQUIRED');
    // API booleana headline coerente con la decisione completa.
    expect(EndOfDayClosureService.shouldReturnToAccommodation(baseQuery({}))).toBe(true);
  });

  // ------------------------------------------------------------------
  // Giorno di arrivo → rientro richiesto a fine serata (dorme in hotel).
  // ------------------------------------------------------------------
  it('richiede il rientro nel giorno di arrivo quando resta tempo per attività serali', () => {
    const decision = EndOfDayClosureService.evaluate(
      baseQuery({
        dateStr: '2026-08-01', // check-in questo giorno, check-out il 5
        lastNodeAnchorKind: undefined, // ultima tappa è un'attività, non il check-in
        lastActivityEndMinutes: 18 * 60, // 18:00
      })
    );

    expect(decision.shouldReturn).toBe(true);
    expect(decision.reasonCode).toBe('RETURN_REQUIRED');
  });

  // ------------------------------------------------------------------
  // Giorno di partenza → nessun rientro (Regola C).
  // ------------------------------------------------------------------
  it('non richiede il rientro nel giorno di partenza (check-out, nessuna copertura notturna)', () => {
    const decision = EndOfDayClosureService.evaluate(
      baseQuery({
        dateStr: '2026-08-05', // check-out questo giorno
        accommodations: [buildAccommodation({ checkOut: unsafeAsInstantISO('2026-08-05T10:00:00.000Z') })],
        transports: [
          buildTransport({ id: 't-arrival', arrivalDate: unsafeAsInstantISO('2026-08-01T09:00:00.000Z') }),
          buildTransport({
            id: 't-departure',
            origin: 'Lisbona',
            destination: 'Roma',
            departureDate: unsafeAsInstantISO('2026-08-05T20:00:00.000Z'),
          }),
        ],
        lastActivityEndMinutes: 12 * 60,
      })
    );

    expect(decision.shouldReturn).toBe(false);
    expect(decision.reasonCode).toBe('DEPARTURE_DAY');
  });

  // ------------------------------------------------------------------
  // Cambio hotel → nessun rientro al vecchio alloggio (Regola C).
  // ------------------------------------------------------------------
  it('non richiede il rientro in un giorno di cambio alloggio', () => {
    const decision = EndOfDayClosureService.evaluate(
      baseQuery({
        dateStr: '2026-08-03',
        accommodations: [
          buildAccommodation({
            id: 'acc-a',
            name: 'Hotel A',
            checkIn: unsafeAsInstantISO('2026-08-01T15:00:00.000Z'),
            checkOut: unsafeAsInstantISO('2026-08-03T10:00:00.000Z'), // esce oggi
          }),
          buildAccommodation({
            id: 'acc-b',
            name: 'Hotel B',
            checkIn: unsafeAsInstantISO('2026-08-03T16:00:00.000Z'), // entra oggi
            checkOut: unsafeAsInstantISO('2026-08-06T10:00:00.000Z'),
          }),
        ],
        lastActivityEndMinutes: 18 * 60,
      })
    );

    expect(decision.shouldReturn).toBe(false);
    expect(decision.reasonCode).toBe('HOTEL_CHANGE');
  });

  // ------------------------------------------------------------------
  // Pernottamento in transito (trasporto notturno) → nessun rientro (Regola C).
  // ------------------------------------------------------------------
  it('non richiede il rientro quando la notte è coperta da un trasporto notturno', () => {
    const decision = EndOfDayClosureService.evaluate(
      baseQuery({
        dateStr: '2026-08-03',
        // Nessun alloggio copre la notte del 3 (esce la mattina del 3).
        accommodations: [
          buildAccommodation({
            checkIn: unsafeAsInstantISO('2026-08-01T15:00:00.000Z'),
            checkOut: unsafeAsInstantISO('2026-08-03T10:00:00.000Z'),
          }),
        ],
        transports: [
          buildTransport({
            id: 't-overnight',
            mode: 'train',
            destination: 'Madrid',
            // Treno notturno: parte il 3 sera, arriva il 4 mattina.
            departureDate: unsafeAsInstantISO('2026-08-03T22:00:00.000Z'),
            arrivalDate: unsafeAsInstantISO('2026-08-04T07:00:00.000Z'),
          }),
        ],
        lastActivityEndMinutes: 20 * 60,
      })
    );

    expect(decision.shouldReturn).toBe(false);
    expect(decision.reasonCode).toBe('OVERNIGHT_TRANSPORT');
  });

  // ------------------------------------------------------------------
  // Sleeping elsewhere: nessun alloggio copre la notte, nessuna partenza.
  // ------------------------------------------------------------------
  it('non richiede il rientro quando nessun alloggio copre la notte e non c\'è partenza', () => {
    const decision = EndOfDayClosureService.evaluate(
      baseQuery({
        dateStr: '2026-08-10', // fuori da qualsiasi soggiorno
        accommodations: [buildAccommodation({})],
        transports: [], // nessuna partenza registrata
        lastActivityEndMinutes: 18 * 60,
      })
    );

    expect(decision.shouldReturn).toBe(false);
    expect(decision.reasonCode).toBe('SLEEPING_ELSEWHERE');
  });

  // ------------------------------------------------------------------
  // Rientro esplicito già presente → nessun rientro aggiuntivo (Regola A).
  // ------------------------------------------------------------------
  it('non richiede il rientro quando l\'ultimo nodo è già un accommodation_return', () => {
    const decision = EndOfDayClosureService.evaluate(
      baseQuery({ lastNodeAnchorKind: 'accommodation_return' })
    );

    expect(decision.shouldReturn).toBe(false);
    expect(decision.reasonCode).toBe('DAY_ALREADY_CLOSED');
  });

  it.each<[string]>([
    ['check_in'],
    ['check_out'],
    ['departure_transfer'],
    ['departure_airport'],
    ['departure_flight'],
    ['accommodation_return'],
  ])('non richiede il rientro quando la giornata termina già con %s (Regola A)', (kind) => {
    const decision = EndOfDayClosureService.evaluate(
      baseQuery({ lastNodeAnchorKind: kind as EndOfDayClosureQuery['lastNodeAnchorKind'] })
    );
    expect(decision.shouldReturn).toBe(false);
    expect(decision.reasonCode).toBe('DAY_ALREADY_CLOSED');
  });

  it('un arrival/transfer come ultimo nodo NON chiude la giornata (Regola A non scatta)', () => {
    // Arrivo mattutino: la giornata resta aperta ad attività e a un rientro serale.
    const decision = EndOfDayClosureService.evaluate(
      baseQuery({ dateStr: '2026-08-01', lastNodeAnchorKind: 'transfer', lastActivityEndMinutes: 12 * 60 })
    );
    expect(decision.shouldReturn).toBe(true);
    expect(decision.reasonCode).toBe('RETURN_REQUIRED');
  });

  // ------------------------------------------------------------------
  // Regola D — tempo residuo.
  // ------------------------------------------------------------------
  it('non richiede il rientro quando il tempo residuo è insufficiente (sotto la soglia)', () => {
    const decision = EndOfDayClosureService.evaluate(
      baseQuery({
        lastActivityEndMinutes: 23 * 60 + 50, // 23:50 → restano 10 min a fine giornata
      })
    );

    expect(decision.shouldReturn).toBe(false);
    expect(decision.reasonCode).toBe('INSUFFICIENT_TIME');
  });

  it('richiede il rientro quando il tempo residuo è sufficiente (sopra la soglia)', () => {
    const decision = EndOfDayClosureService.evaluate(
      baseQuery({
        lastActivityEndMinutes: 23 * 60, // 23:00 → restano 60 min ≥ 30
      })
    );

    expect(decision.shouldReturn).toBe(true);
    expect(decision.reasonCode).toBe('RETURN_REQUIRED');
  });

  it('rispetta una soglia minima configurabile diversa dal default', () => {
    // 45 min residui: sufficiente col default 30, insufficiente con soglia 90.
    const q = baseQuery({ lastActivityEndMinutes: 23 * 60 + 15 }); // 23:15 → 45 min

    expect(EndOfDayClosureService.shouldReturnToAccommodation(q)).toBe(true);
    expect(
      EndOfDayClosureService.shouldReturnToAccommodation({ ...q, minimumRemainingMinutes: 90 })
    ).toBe(false);
  });

  it('non forza un rientro impossibile quando il tragitto di rientro supera il tempo residuo', () => {
    // 40 min residui ma 50 min di tragitto stimato → impossibile.
    const decision = EndOfDayClosureService.evaluate(
      baseQuery({ lastActivityEndMinutes: 23 * 60 + 20, returnTravelMinutes: 50 })
    );

    expect(decision.shouldReturn).toBe(false);
    expect(decision.reasonCode).toBe('INSUFFICIENT_TIME');
  });

  it('rispetta un dayEndMinutes esteso (Logical Day oltre la mezzanotte)', () => {
    // Ultima attività a 23:40, ma la giornata logica si estende all'01:00 (1500).
    const decision = EndOfDayClosureService.evaluate(
      baseQuery({ lastActivityEndMinutes: 23 * 60 + 40, dayEndMinutes: 25 * 60 })
    );

    expect(decision.shouldReturn).toBe(true);
    expect(decision.reasonCode).toBe('RETURN_REQUIRED');
  });

  // ------------------------------------------------------------------
  // Output deterministico.
  // ------------------------------------------------------------------
  it('produce un output deterministico su invocazioni ripetute con lo stesso input', () => {
    const q = baseQuery({});
    const first = EndOfDayClosureService.evaluate(q);
    const second = EndOfDayClosureService.evaluate(q);
    const third = EndOfDayClosureService.evaluate(q);

    expect(second).toEqual(first);
    expect(third).toEqual(first);
    // Nessuna mutazione degli input (servizio puro).
    expect(q.accommodations).toHaveLength(1);
    expect(q.transports).toHaveLength(1);
  });

  it('non muta gli array di input', () => {
    const accommodations = [buildAccommodation({})];
    const transports = [buildTransport({})];
    const accSnapshot = [...accommodations];
    const trSnapshot = [...transports];

    EndOfDayClosureService.evaluate(baseQuery({ accommodations, transports }));

    expect(accommodations).toEqual(accSnapshot);
    expect(transports).toEqual(trSnapshot);
  });

  it('gestisce accommodations vuote senza errori (nessun rientro)', () => {
    const decision = EndOfDayClosureService.evaluate(
      baseQuery({ accommodations: [], transports: [] })
    );
    expect(decision.shouldReturn).toBe(false);
    expect(decision.reasonCode).toBe('SLEEPING_ELSEWHERE');
  });
});
