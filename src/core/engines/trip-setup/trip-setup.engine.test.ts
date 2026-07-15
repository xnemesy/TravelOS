import { TripSetupEngine } from './trip-setup.engine';
import { ITripSetupRepository } from './trip-setup.repository.interface';
import { IContextEngine } from '../types/engines.types';
import { TravelContext } from '../types/context.types';
import { TripSetup } from '../../../domain/trip/models/trip-setup.model';

/**
 * Repository finto in-memory: sostituisce completamente MMKV. Se
 * TripSetupEngine conservasse ancora un riferimento a un `MMKVAdapter`
 * module-level e la propria logica di deserializzazione (come prima di
 * ADR-021), i dati scritti da un'istanza dell'Engine non sarebbero mai
 * visibili a una SECONDA istanza costruita con questo stesso repository finto.
 */
class FakeTripSetupRepository implements ITripSetupRepository {
  private store: Map<string, TripSetup> = new Map();

  async getTripSetup(tripId: string): Promise<TripSetup | null> {
    return this.store.has(tripId) ? this.store.get(tripId)! : null;
  }
  async saveTripSetup(tripId: string, setup: TripSetup): Promise<void> {
    this.store.set(tripId, setup);
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

describe('TripSetupEngine — depends only on ITripSetupRepository, not MMKV/deserialization directly', () => {
  it('registers itself as a state publisher and a hydratable on construction', () => {
    const contextEngine = createFakeContextEngine();
    new TripSetupEngine(contextEngine, new FakeTripSetupRepository());

    expect(contextEngine.publishers.has('TripSetupEngine')).toBe(true);
    expect(contextEngine.hydratables.has('TripSetupEngine')).toBe(true);
  });

  it('persists an added transport through the injected repository — visible to a fresh engine instance', async () => {
    const repository = new FakeTripSetupRepository();
    const engineA = new TripSetupEngine(createFakeContextEngine(), repository);

    await engineA.addTransport('trip-1', {
      mode: 'flight',
      destination: 'Lisbona',
      departureDate: new Date('2026-09-01T10:00:00.000Z'),
    } as any);

    const engineB = new TripSetupEngine(createFakeContextEngine(), repository);
    const transports = await engineB.getTransports('trip-1');

    expect(transports).toHaveLength(1);
    expect(transports[0].destination).toBe('Lisbona');
  });

  it('hydrate() populates the in-memory cache from the repository', async () => {
    const repository = new FakeTripSetupRepository();
    await repository.saveTripSetup('trip-2', {
      tripId: 'trip-2',
      createdAt: new Date(),
      updatedAt: new Date(),
      accommodations: [
        {
          id: 'a-1',
          type: 'hotel',
          name: 'Hotel Test',
          checkIn: new Date('2026-09-01T14:00:00.000Z'),
          checkOut: new Date('2026-09-03T10:00:00.000Z'),
          confirmed: false,
        } as any,
      ],
    });

    const engine = new TripSetupEngine(createFakeContextEngine(), repository);
    await engine.hydrate('trip-2');

    const accommodations = await engine.getAccommodations('trip-2');
    expect(accommodations).toHaveLength(1);
    expect(accommodations[0].name).toBe('Hotel Test');
  });

  it('addAccommodation gestisce correttamente e persiste Accommodation con HotelPolicy (nuovo formato Sprint 18)', async () => {
    const repository = new FakeTripSetupRepository();
    const engine = new TripSetupEngine(createFakeContextEngine(), repository);

    const added = await engine.addAccommodation('trip-3', {
      type: 'hotel',
      name: 'Hotel Con Policy',
      checkIn: new Date('2026-10-01T14:00:00.000Z'),
      checkOut: new Date('2026-10-05T10:00:00.000Z'),
      hotelPolicy: {
        allowsLuggageDropoff: true,
        allowsEarlyCheckIn: false,
        allowsLateCheckout: true,
      },
    } as any);

    expect(added.hotelPolicy?.allowsLuggageDropoff).toBe(true);
    expect(added.hotelPolicy?.allowsEarlyCheckIn).toBe(false);
    expect(added.hotelPolicy?.allowsLateCheckout).toBe(true);

    const freshEngine = new TripSetupEngine(createFakeContextEngine(), repository);
    const accommodations = await freshEngine.getAccommodations('trip-3');
    expect(accommodations).toHaveLength(1);
    expect(accommodations[0].hotelPolicy?.allowsLuggageDropoff).toBe(true);
  });

  it('addAccommodation e getAccommodations gestiscono alloggi con e senza HotelPolicy nello stesso trip senza regressioni', async () => {
    const repository = new FakeTripSetupRepository();
    const engine = new TripSetupEngine(createFakeContextEngine(), repository);

    // Alloggio 1: senza hotelPolicy (formato legacy)
    await engine.addAccommodation('trip-multi', {
      type: 'apartment',
      name: 'Appartamento Legacy',
      checkIn: new Date('2026-10-01T14:00:00.000Z'),
      checkOut: new Date('2026-10-03T10:00:00.000Z'),
    } as any);

    // Alloggio 2: con hotelPolicy (formato Sprint 18)
    await engine.addAccommodation('trip-multi', {
      type: 'hotel',
      name: 'Hotel Moderno',
      checkIn: new Date('2026-10-03T14:00:00.000Z'),
      checkOut: new Date('2026-10-06T10:00:00.000Z'),
      hotelPolicy: {
        allowsLuggageDropoff: true,
      },
    } as any);

    const list = await engine.getAccommodations('trip-multi');
    expect(list).toHaveLength(2);
    expect(list[0].hotelPolicy).toBeUndefined();
    expect(list[1].hotelPolicy?.allowsLuggageDropoff).toBe(true);
  });
});
