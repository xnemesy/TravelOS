import { TimelineRepository } from './timeline.repository';
import { ILocalDatabase } from '../../storage/local-database.interface';
import { ITripRepository } from '../../../domain/trip/repositories/trip.repository.interface';
import { Trip } from '../../../domain/trip/models/trip.model';
import { TimelineDaySchedule } from '../types/context.types';

class FakeLocalDatabase implements ILocalDatabase {
  private store: Map<string, unknown> = new Map();

  async get<T>(key: string): Promise<T | null> {
    return this.store.has(key) ? (this.store.get(key) as T) : null;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }
  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }
  async clearAll(): Promise<void> {
    this.store.clear();
  }
}

class FakeTripRepository implements ITripRepository {
  constructor(private trips: Map<string, Trip> = new Map()) {}

  async getTripById(id: string): Promise<Trip | null> {
    return this.trips.get(id) ?? null;
  }
  async getUserTrips(): Promise<Trip[]> {
    return Array.from(this.trips.values());
  }
  async createTrip(): Promise<Trip> {
    throw new Error('not needed for these tests');
  }
  async updateTrip(): Promise<Trip> {
    throw new Error('not needed for these tests');
  }
  async deleteTrip(): Promise<void> {}
}

function buildDay(overrides: Partial<TimelineDaySchedule> = {}): TimelineDaySchedule {
  return {
    dayNumber: 1,
    date: '2026-08-01',
    places: [],
    totalWalkDistanceMeters: 0,
    totalEstimatedDurationMinutes: 0,
    overview: { experiencesCount: 0, startTime: '09:00', endTime: '18:00', foodStopsCount: 0 },
    ...overrides,
  };
}

describe('TimelineRepository', () => {
  let db: FakeLocalDatabase;
  let tripRepository: FakeTripRepository;
  let repo: TimelineRepository;

  beforeEach(() => {
    db = new FakeLocalDatabase();
    tripRepository = new FakeTripRepository();
    repo = new TimelineRepository(db, tripRepository);
  });

  it('returns null for a trip whose timeline was never persisted', async () => {
    await expect(repo.getTimeline('trip-never-saved')).resolves.toBeNull();
  });

  it('round-trips saveTimeline/getTimeline for a trip', async () => {
    const days = [buildDay(), buildDay({ dayNumber: 2, date: '2026-08-02' })];
    await repo.saveTimeline('trip-1', days);

    await expect(repo.getTimeline('trip-1')).resolves.toEqual(days);
  });

  it('resolves the trip date range by delegating to ITripRepository, not a raw storage key', async () => {
    const trip: Trip = {
      id: 'trip-1',
      userId: 'default-user',
      title: 'Weekend a Lisbona',
      destination: 'Lisbona',
      status: 'planned',
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2026-09-04T00:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Trip;
    tripRepository = new FakeTripRepository(new Map([['trip-1', trip]]));
    repo = new TimelineRepository(db, tripRepository);

    const range = await repo.getTripDateRange('trip-1');

    expect(range).toEqual({ startDate: trip.startDate, endDate: trip.endDate });
  });

  it('returns null date range for a trip the ITripRepository does not know', async () => {
    await expect(repo.getTripDateRange('trip-unknown')).resolves.toBeNull();
  });
});
