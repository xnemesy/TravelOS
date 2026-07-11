import { PlacesEngine } from './places.engine';
import { IPlacesRepository } from './places.repository.interface';
import { IContextEngine } from '../types/engines.types';
import { PlaceRef, TravelContext } from '../types/context.types';

/**
 * Repository finto in-memory: sostituisce completamente MMKV. Se PlacesEngine
 * conservasse ancora un riferimento a un `MMKVAdapter` module-level (come
 * prima di ADR-021), i dati scritti da un'istanza dell'Engine non sarebbero
 * mai visibili a una SECONDA istanza costruita con questo stesso repository
 * finto — è esattamente il comportamento che questi test verificano.
 */
class FakePlacesRepository implements IPlacesRepository {
  private store: Map<string, PlaceRef[]> = new Map();

  async getPlaces(tripId: string): Promise<PlaceRef[] | null> {
    return this.store.has(tripId) ? this.store.get(tripId)! : null;
  }
  async savePlaces(tripId: string, places: PlaceRef[]): Promise<void> {
    this.store.set(tripId, places);
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

describe('PlacesEngine — depends only on IPlacesRepository, not MMKV directly', () => {
  it('registers itself as a state publisher and a hydratable on construction', () => {
    const contextEngine = createFakeContextEngine();
    new PlacesEngine(contextEngine, new FakePlacesRepository());

    expect(contextEngine.publishers.has('PlacesEngine')).toBe(true);
    expect(contextEngine.hydratables.has('PlacesEngine')).toBe(true);
  });

  it('persists saved places through the injected repository — visible to a fresh engine instance', async () => {
    const repository = new FakePlacesRepository();
    const engineA = new PlacesEngine(createFakeContextEngine(), repository);

    await engineA.savePlace('trip-1', buildPlace());

    // Istanza completamente nuova, nessuna cache in-memory condivisa con engineA:
    // se PlacesEngine leggesse ancora da un MMKVAdapter proprio, questa non
    // vedrebbe nulla scritto tramite un repository finto disconnesso da MMKV.
    const engineB = new PlacesEngine(createFakeContextEngine(), repository);
    const places = await engineB.getSavedPlaces('trip-1');

    expect(places).toHaveLength(1);
    expect(places[0].id).toBe('place-1');
  });

  it('hydrate() populates the in-memory cache from the repository', async () => {
    const repository = new FakePlacesRepository();
    await repository.savePlaces('trip-2', [buildPlace({ id: 'place-2' })]);

    const engine = new PlacesEngine(createFakeContextEngine(), repository);
    await engine.hydrate('trip-2');

    const details = await engine.getPlaceDetails('place-2');
    expect(details?.id).toBe('place-2');
  });
});
