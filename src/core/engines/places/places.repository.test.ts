import { PlacesRepository } from './places.repository';
import { ILocalDatabase } from '../../storage/local-database.interface';
import { PlaceRef } from '../types/context.types';

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

function buildPlace(overrides: Partial<PlaceRef> = {}): PlaceRef {
  return {
    id: 'place-1',
    name: 'Colosseo',
    category: 'landmark',
    coordinates: { latitude: 41.89, longitude: 12.49 },
    ...overrides,
  };
}

describe('PlacesRepository', () => {
  let db: FakeLocalDatabase;
  let repo: PlacesRepository;

  beforeEach(() => {
    db = new FakeLocalDatabase();
    repo = new PlacesRepository(db);
  });

  it('returns null for a trip whose places were never persisted', async () => {
    await expect(repo.getPlaces('trip-never-saved')).resolves.toBeNull();
  });

  it('round-trips savePlaces/getPlaces for a trip', async () => {
    const places = [buildPlace(), buildPlace({ id: 'place-2', name: 'Fontana di Trevi' })];
    await repo.savePlaces('trip-1', places);

    await expect(repo.getPlaces('trip-1')).resolves.toEqual(places);
  });

  it('keeps places for different trips isolated under distinct keys', async () => {
    await repo.savePlaces('trip-1', [buildPlace({ id: 'p-a' })]);
    await repo.savePlaces('trip-2', [buildPlace({ id: 'p-b' })]);

    const tripOnePlaces = await repo.getPlaces('trip-1');
    const tripTwoPlaces = await repo.getPlaces('trip-2');

    expect(tripOnePlaces?.map(p => p.id)).toEqual(['p-a']);
    expect(tripTwoPlaces?.map(p => p.id)).toEqual(['p-b']);
  });
});
