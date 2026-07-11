import { TimelineEngine } from './timeline.engine';
import { ITimelineRepository } from './timeline.repository.interface';
import { IContextEngine } from '../types/engines.types';
import { TimelineDaySchedule, PlaceRef, TravelContext } from '../types/context.types';
import { eventBus } from '../../events/event-bus';

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
