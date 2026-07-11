import { TripRepository } from './trip.repository';
import { ILocalDatabase } from '../../../core/storage/local-database.interface';

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

describe('TripRepository — write paths do not seed the dev mock trip', () => {
  let db: FakeLocalDatabase;
  let repo: TripRepository;

  beforeEach(() => {
    db = new FakeLocalDatabase();
    repo = new TripRepository(db);
  });

  it('createTrip on a never-initialized DB persists only the real trip, not [mockTrip, newTrip]', async () => {
    // Db vergine: nessuna getUserTrips() è mai stata chiamata prima, come accade
    // se il primo passo dell'utente in DEV è direttamente la creazione di un viaggio
    // (es. onboarding) invece del caricamento della lista.
    const created = await repo.createTrip({
      userId: 'default-user',
      title: 'Viaggio Reale',
      destination: 'Lisbona',
      status: 'planned',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-05'),
      stats: { savedPlaces: 0, reservations: 0, activitiesToComplete: 0 },
    } as any);

    const trips = await repo.getUserTrips('default-user');

    expect(trips).toHaveLength(1);
    expect(trips[0].id).toBe(created.id);
    expect(trips.some(t => t.id === 'trip-budapest-2026')).toBe(false);
  });

  it('deleteTrip on a never-initialized DB does not resurrect the mock trip', async () => {
    await repo.deleteTrip('some-id-that-never-existed');

    const trips = await repo.getUserTrips('default-user');
    // getUserTrips vede rawCache === [] (esplicito, scritto da deleteTrip) e
    // deve rispettare l'array vuoto, non ripopolare il mock.
    expect(trips).toEqual([]);
  });
});
