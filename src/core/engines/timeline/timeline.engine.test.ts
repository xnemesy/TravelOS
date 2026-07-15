import { TimelineEngine } from './timeline.engine';
import { ITimelineRepository } from './timeline.repository.interface';
import { TripSetupEngine } from '../trip-setup/trip-setup.engine';
import { ITripSetupRepository } from '../trip-setup/trip-setup.repository.interface';
import { IContextEngine, ITripSetupEngine } from '../types/engines.types';
import { TimelineDaySchedule, PlaceRef, TravelContext } from '../types/context.types';
import { eventBus } from '../../events/event-bus';
import { TripSetup, Transport, Accommodation } from '../../../domain/trip/models/trip-setup.model';

/**
 * Repository finto in-memory: sostituisce completamente MMKV e il repository
 * dei Trip. Se TimelineEngine leggesse ancora direttamente MMKV/la chiave
 * grezza `cache_user_trips_*` (come prima di ADR-021), questi test — che non
 * toccano mai MMKV — fallirebbero o produrrebbero le date di default hardcoded
 * invece di quelle fornite da questo finto.
 */
class FakeTimelineRepository implements ITimelineRepository {
  private store: Map<string, TimelineDaySchedule[]> = new Map();
  constructor(private dateRange: { startDate: Date; endDate: Date } | null) {}

  async getTimeline(tripId: string): Promise<TimelineDaySchedule[] | null> {
    return this.store.has(tripId) ? this.store.get(tripId)! : null;
  }
  async saveTimeline(tripId: string, days: TimelineDaySchedule[]): Promise<void> {
    this.store.set(tripId, days);
  }
  async getTripDateRange(): Promise<{ startDate: Date; endDate: Date } | null> {
    return this.dateRange;
  }
}

function createFakeContextEngine(): IContextEngine & {
  publishers: Map<string, (tripId: string) => Partial<TravelContext>>;
  hydratables: Map<string, (tripId: string) => Promise<void>>;
} {
  const publishers = new Map<string, (tripId: string) => Partial<TravelContext>>();
  const hydratables = new Map<string, (tripId: string) => Promise<void>>();
  return {
    publishers,
    hydratables,
    getContext: jest.fn(),
    subscribe: jest.fn(() => () => {}),
    registerStatePublisher: (name, publisher) => publishers.set(name, publisher),
    recompose: jest.fn(),
    registerTripProvider: jest.fn(),
    registerHydratable: (name, hydrate) => hydratables.set(name, hydrate),
    ensureHydrated: jest.fn(async () => {}),
  };
}

function buildPlace(overrides: Partial<PlaceRef> = {}): PlaceRef {
  return {
    id: 'place-1',
    name: 'Colosseo',
    category: 'landmark',
    coordinates: { latitude: 41.89, longitude: 12.49 },
    ...overrides,
  };
}

/**
 * Finto TripSetupEngine: espone solo transports/accommodations preconfigurati
 * dal test, senza toccare MMKV/storage — stesso confine dei fake sopra.
 */
class FakeTripSetupEngine implements ITripSetupEngine {
  constructor(private transports: Transport[] = [], private accommodations: Accommodation[] = []) {}
  async hydrate(): Promise<void> {}
  async getTripSetup(tripId: string): Promise<TripSetup> {
    return {
      tripId,
      transports: this.transports,
      accommodations: this.accommodations,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  async getTransports(): Promise<Transport[]> {
    return this.transports;
  }
  async addTransport(): Promise<Transport> {
    throw new Error('not implemented');
  }
  async updateTransport(): Promise<Transport> {
    throw new Error('not implemented');
  }
  async removeTransport(): Promise<void> {}
  async getAccommodations(): Promise<Accommodation[]> {
    return this.accommodations;
  }
  async addAccommodation(): Promise<Accommodation> {
    throw new Error('not implemented');
  }
  async updateAccommodation(): Promise<Accommodation> {
    throw new Error('not implemented');
  }
  async removeAccommodation(): Promise<void> {}
  async syncTransportsAndAccommodations(tripId: string): Promise<TripSetup> {
    return this.getTripSetup(tripId);
  }
}

describe('TimelineEngine — depends only on ITimelineRepository, not MMKV/raw Trip keys directly', () => {
  beforeEach(() => {
    eventBus.clearAllSubscribers();
  });

  it('registers itself as a state publisher and a hydratable on construction', () => {
    const contextEngine = createFakeContextEngine();
    new TimelineEngine(contextEngine, new FakeTimelineRepository(null));

    expect(contextEngine.publishers.has('TimelineEngine')).toBe(true);
    expect(contextEngine.hydratables.has('TimelineEngine')).toBe(true);
  });

  it('generates default days spanning the date range resolved by the repository, not a hardcoded fallback', async () => {
    const repository = new FakeTimelineRepository({
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2026-09-03T00:00:00.000Z'), // 3 giorni
    });
    const engine = new TimelineEngine(createFakeContextEngine(), repository);

    const days = await engine.getTripTimeline('trip-1');

    expect(days).toHaveLength(3);
    expect(days[0].date).toBe('2026-09-01');
    expect(days[2].date).toBe('2026-09-03');
  });

  it('falls back to the hardcoded default range when the repository cannot resolve trip dates', async () => {
    const engine = new TimelineEngine(createFakeContextEngine(), new FakeTimelineRepository(null));

    const days = await engine.getTripTimeline('trip-unknown');

    expect(days).toHaveLength(4); // 2026-07-10 → 2026-07-13 inclusi, default preesistente
  });

  it('persists timeline mutations through the injected repository — visible to a fresh engine instance', async () => {
    const repository = new FakeTimelineRepository({
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2026-09-01T00:00:00.000Z'),
    });
    const engineA = new TimelineEngine(createFakeContextEngine(), repository);
    await engineA.getTripTimeline('trip-1'); // genera il giorno 1 di default
    await engineA.addPlaceToDay('trip-1', 1, buildPlace());

    const engineB = new TimelineEngine(createFakeContextEngine(), repository);
    const days = await engineB.getTripTimeline('trip-1');

    // TimelineGenerator può inserire blocchi extra (es. hotel-start/end): qui
    // verifichiamo solo che il luogo aggiunto sia stato effettivamente persistito
    // e letto tramite il repository (non che sia l'unico elemento del giorno).
    expect(days[0].places.map(p => p.id)).toContain('place-1');
  });
});

/**
 * Integrazione Journey Anchors (redesign JourneyComposer): quando un
 * TripSetupEngine con transports/accommodations reali è collegato,
 * TimelineEngine deve derivare gli anchor automaticamente e passarli al
 * JourneyComposer — senza che quest'ultimo cambi logica.
 */
describe('TimelineEngine — Journey Anchors wiring (TripSetupEngine → JourneyAnchorEngine → JourneyComposer)', () => {
  beforeEach(() => {
    eventBus.clearAllSubscribers();
  });

  function buildTripSetupEngine() {
    const transports: Transport[] = [
      {
        id: 'in',
        mode: 'flight',
        origin: 'Milano',
        destination: 'Roma',
        departureDate: new Date('2026-09-01T13:00:00.000Z'),
        arrivalDate: new Date('2026-09-01T14:30:00.000Z'),
        confirmed: true,
      } as Transport,
      {
        id: 'out',
        mode: 'flight',
        origin: 'Roma',
        destination: 'Milano',
        departureDate: new Date('2026-09-03T18:00:00.000Z'),
        arrivalDate: new Date('2026-09-03T19:30:00.000Z'),
        confirmed: true,
      } as Transport,
    ];
    const accommodations: Accommodation[] = [
      {
        id: 'hotel-1',
        type: 'hotel',
        name: 'Hotel Roma',
        checkIn: new Date('2026-09-01T16:00:00.000Z'),
        checkOut: new Date('2026-09-03T10:00:00.000Z'),
        confirmed: true,
      } as Accommodation,
    ];
    return new FakeTripSetupEngine(transports, accommodations);
  }

  function buildEngine() {
    const repository = new FakeTimelineRepository({
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2026-09-03T00:00:00.000Z'), // 3 giorni: arrivo, intermedio, partenza
    });
    const tripSetupEngine = buildTripSetupEngine();
    const engine = new TimelineEngine(createFakeContextEngine(), repository, tripSetupEngine);
    return engine;
  }

  it('starts Day 1 (arrival day) at the arrival airport anchor', async () => {
    const engine = buildEngine();
    await engine.composeDayWithAvailablePlaces('trip-1', 1, [], 'culture');

    const day1 = await engine.getDaySchedule('trip-1', 1);
    expect(day1).not.toBeNull();
    expect(day1!.places[0].journeyAnchorKind).toBe('arrival_flight');
    expect(day1!.places.some(p => p.journeyAnchorKind === 'arrival_airport')).toBe(true);
  });

  it('never schedules an activity before the arrival Journey Anchors on the arrival day', async () => {
    const engine = buildEngine();
    const place = buildPlace({ id: 'colosseo', name: 'Colosseo' });

    await engine.composeDayWithAvailablePlaces('trip-1', 1, [place], 'culture');

    const day1 = await engine.getDaySchedule('trip-1', 1);
    const arrivalAnchor = day1!.places.find(p => p.journeyAnchorKind === 'arrival_flight')!;
    const activity = day1!.places.find(p => p.id === 'colosseo');

    expect(arrivalAnchor).toBeDefined();
    if (activity) {
      const [arrH, arrM] = (arrivalAnchor.calculatedStartTime || '00:00').split(':').map(Number);
      const [actH, actM] = (activity.calculatedStartTime || '00:00').split(':').map(Number);
      expect(actH * 60 + actM).toBeGreaterThanOrEqual(arrH * 60 + arrM);
    }
  });

  it('respects the accommodation check-in time on the arrival day', async () => {
    const engine = buildEngine();
    await engine.composeDayWithAvailablePlaces('trip-1', 1, [], 'culture');

    const day1 = await engine.getDaySchedule('trip-1', 1);
    const checkIn = day1!.places.find(p => p.journeyAnchorKind === 'check_in');

    expect(checkIn).toBeDefined();
    // L'orario del blocco deve corrispondere esattamente a Accommodation.checkIn
    // in UTC — stesso riferimento orario usato per bucketizzare `date`
    // (`toISOString().split('T')[0]`) — mai ricalcolato/spostato dal Composer,
    // e mai letto con getter locali (regressione fissata: si veda il describe
    // "Journey Anchor regression: arrival time changed after trip creation").
    const expectedCheckIn = new Date('2026-09-01T16:00:00.000Z');
    const expected = `${expectedCheckIn.getHours().toString().padStart(2, '0')}:${expectedCheckIn.getMinutes().toString().padStart(2, '0')}`;
    expect(checkIn!.calculatedStartTime).toBe(expected);
  });

  it('ends the last day (departure day) at the departure airport anchor', async () => {
    const engine = buildEngine();
    await engine.composeDayWithAvailablePlaces('trip-1', 3, [], 'culture');

    const day3 = await engine.getDaySchedule('trip-1', 3);
    expect(day3).not.toBeNull();
    const lastPlace = day3!.places[day3!.places.length - 1];
    expect(lastPlace.journeyAnchorKind).toBe('departure_flight');
    expect(day3!.places.some(p => p.journeyAnchorKind === 'departure_airport')).toBe(true);
  });

  it('falls back to unconstrained composition when no TripSetupEngine is injected', async () => {
    const repository = new FakeTimelineRepository({
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2026-09-01T00:00:00.000Z'),
    });
    const engine = new TimelineEngine(createFakeContextEngine(), repository); // nessun TripSetupEngine

    const place = buildPlace({ id: 'colosseo' });
    await engine.composeDayWithAvailablePlaces('trip-1', 1, [place], 'culture');

    const day1 = await engine.getDaySchedule('trip-1', 1);
    expect(day1!.places.some(p => p.journeyAnchorKind)).toBe(false);
    expect(day1!.places.some(p => p.id === 'colosseo')).toBe(true);
  });
});

/**
 * Finto ITripSetupRepository in-memory — usato con il vero TripSetupEngine
 * (non il fake sopra) perché questi test devono esercitare il percorso di
 * scrittura reale (`updateTransport`) che ha innescato il bug in produzione:
 * un fake TripSetupEngine "sola lettura" non lo avrebbe intercettato.
 */
class FakeTripSetupRepository implements ITripSetupRepository {
  private store = new Map<string, TripSetup>();
  async getTripSetup(tripId: string): Promise<TripSetup | null> {
    return this.store.get(tripId) || null;
  }
  async saveTripSetup(tripId: string, setup: TripSetup): Promise<void> {
    this.store.set(tripId, setup);
  }
}

/**
 * Regressione: cambiare l'orario di arrivo dopo la creazione del trip deve
 * riflettersi sulla Giornata 1 alla prossima ricomposizione. Root cause del
 * bug osservato in produzione: `minutesOfISO` (JourneyAnchorEngine) e le due
 * conversioni scheduledTime→minuti in JourneyComposer leggevano l'ora con i
 * getter locali (`getHours`/`getMinutes`), mentre la bucketizzazione del
 * giorno (`dateStrOf`, `TimelineDaySchedule.date`) è sempre in UTC
 * (`iso.slice(0, 10)` / `toISOString().split('T')[0]`). In un fuso orario
 * con offset positivo, un arrivo serale in UTC (es. 23:30Z) cade oltre la
 * mezzanotte locale: i getter locali restituivano un "minuti da mezzanotte"
 * più piccolo di quello dell'anchor di partenza dello stesso volo, facendo
 * "retrocedere" l'orologio interno del Composer invece di farlo avanzare —
 * da cui il giorno che ripartiva dallo slot mattutino di default (09:00) e i
 * blocchi anchor mostrati con orari incoerenti/clampati a 23:59.
 */
describe('TimelineEngine — Journey Anchor regression: arrival time changed after trip creation', () => {
  beforeEach(() => {
    eventBus.clearAllSubscribers();
  });

  function buildEngines() {
    const timelineRepository = new FakeTimelineRepository({
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2026-09-01T00:00:00.000Z'),
    });
    const tripSetupEngine = new TripSetupEngine(createFakeContextEngine(), new FakeTripSetupRepository());
    const timelineEngine = new TimelineEngine(createFakeContextEngine(), timelineRepository, tripSetupEngine);
    return { timelineEngine, tripSetupEngine };
  }

  it('reflects a real arrival-time change (11:00 → 23:30) on the next recompose', async () => {
    const { timelineEngine, tripSetupEngine } = buildEngines();

    const transport = await tripSetupEngine.addTransport('trip-1', {
      mode: 'flight',
      origin: 'Milano',
      destination: 'Roma',
      departureDate: new Date(2026, 8, 1, 9, 0),
      arrivalDate: new Date(2026, 8, 1, 11, 0),
      confirmed: true,
    } as Omit<Transport, 'id'>);

    await timelineEngine.composeDayWithAvailablePlaces('trip-1', 1, [], 'culture');
    const beforeArrival = (await timelineEngine.getDaySchedule('trip-1', 1))!.places.find(
      p => p.journeyAnchorKind === 'arrival_flight'
    )!;
    expect(beforeArrival.calculatedEndTime).toBe('11:00'); // sbarco reale, non ricalcolato

    // L'utente cambia l'orario di arrivo dopo la creazione del trip.
    await tripSetupEngine.updateTransport('trip-1', transport.id, {
      arrivalDate: new Date(2026, 8, 1, 23, 30),
    });

    // Ricomposizione ("Compose" premuto di nuovo).
    await timelineEngine.composeDayWithAvailablePlaces('trip-1', 1, [], 'culture');

    const day1 = (await timelineEngine.getDaySchedule('trip-1', 1))!;
    const arrivalFlight = day1.places.find(p => p.journeyAnchorKind === 'arrival_flight')!;
    const arrivalAirport = day1.places.find(p => p.journeyAnchorKind === 'arrival_airport')!;

    // Lo sbarco reale (fine del volo) deve riflettere il nuovo orario, non il vecchio 11:00.
    expect(arrivalFlight.calculatedEndTime).toBe('23:30');
    // L'anchor "sbarco e ritiro bagagli" deve partire allo stesso istante reale,
    // non da un orario "avvolto" all'indietro (es. 01:30) né clampato a 23:59.
    expect(arrivalAirport.calculatedStartTime).toBe('23:30');
  });

  it('never places an activity before the (updated) arrival time on Day 1', async () => {
    const { timelineEngine, tripSetupEngine } = buildEngines();

    const transport = await tripSetupEngine.addTransport('trip-1', {
      mode: 'flight',
      origin: 'Milano',
      destination: 'Roma',
      departureDate: new Date('2026-09-01T09:00:00.000Z'),
      arrivalDate: new Date('2026-09-01T11:00:00.000Z'),
      confirmed: true,
    } as Omit<Transport, 'id'>);

    await tripSetupEngine.updateTransport('trip-1', transport.id, {
      // Un arrivo tardo-serale con un breve volo di rientro impossibile:
      // qualunque attività reale deve comparire dopo le 23:30, mai prima.
      arrivalDate: new Date('2026-09-01T23:30:00.000Z'),
    });

    const shortActivity = buildPlace({ id: 'aperitivo', name: 'Aperitivo veloce', durationMinutes: 15 });
    await timelineEngine.composeDayWithAvailablePlaces('trip-1', 1, [shortActivity], 'culture');

    const day1 = (await timelineEngine.getDaySchedule('trip-1', 1))!;
    const arrivalMinutes = 23 * 60 + 30;

    for (const place of day1.places.filter(p => !p.isBlock)) {
      const [h, m] = (place.calculatedStartTime || '00:00').split(':').map(Number);
      expect(h * 60 + m).toBeGreaterThanOrEqual(arrivalMinutes);
    }

    // Nessun blocco generato automaticamente (colazione/pranzo/cena) può
    // comparire prima dell'arrivo reale.
    for (const place of day1.places.filter(p => p.isBlock && !p.journeyAnchorKind)) {
      const [h, m] = (place.calculatedStartTime || '00:00').split(':').map(Number);
      expect(h * 60 + m).toBeGreaterThanOrEqual(arrivalMinutes);
    }
  });

  it('automatically defers places that cannot fit on Day 1 (late arrival) to Day 2 (DeferredQueue cascade)', async () => {
    const timelineRepository = new FakeTimelineRepository({
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2026-09-02T00:00:00.000Z'),
    });
    const tripSetupEngine = new TripSetupEngine(createFakeContextEngine(), new FakeTripSetupRepository());
    const timelineEngine = new TimelineEngine(createFakeContextEngine(), timelineRepository, tripSetupEngine);

    // Setup an arrival at 23:30 on Day 1
    await tripSetupEngine.addTransport('trip-1', {
      mode: 'flight',
      origin: 'Milano',
      destination: 'Roma',
      departureDate: new Date('2026-09-01T21:30:00.000Z'),
      arrivalDate: new Date('2026-09-01T23:30:00.000Z'),
      confirmed: true,
    } as Omit<Transport, 'id'>);

    const places = [
      buildPlace({ id: 'mus', name: 'Museo Archeologico', durationMinutes: 120 }),
      buildPlace({ id: 'duomo', name: 'Duomo di Milano', durationMinutes: 90 }),
    ];

    // Trigger autoScheduleUnassignedPlaces across the timeline
    await timelineEngine.autoScheduleUnassignedPlaces('trip-1', places, 'culture');

    const day1 = (await timelineEngine.getDaySchedule('trip-1', 1))!;
    const day2 = (await timelineEngine.getDaySchedule('trip-1', 2))!;

    // Day 1 arrives at 23:30, so no attraction should be scheduled on Day 1
    const day1RealVisits = day1.places.filter(p => !p.isBlock && !p.journeyAnchorKind && p.category !== 'hotel' && p.category !== 'transfer');
    expect(day1RealVisits.length).toBe(0);

    // Both Museo and Duomo should have cascaded directly to Day 2 via DeferredQueue
    const day2RealVisits = day2.places.filter(p => !p.isBlock && !p.journeyAnchorKind && p.category !== 'hotel' && p.category !== 'transfer');
    const placedIds = day2RealVisits.map(p => p.id);
    expect(placedIds).toContain('mus');
    expect(placedIds).toContain('duomo');
  });
});
