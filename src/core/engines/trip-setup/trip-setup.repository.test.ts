import { TripSetupRepository } from './trip-setup.repository';
import { ILocalDatabase } from '../../storage/local-database.interface';
import { TripSetup } from '../../../domain/trip/models/trip-setup.model';

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

describe('TripSetupRepository', () => {
  let db: FakeLocalDatabase;
  let repo: TripSetupRepository;

  beforeEach(() => {
    db = new FakeLocalDatabase();
    repo = new TripSetupRepository(db);
  });

  it('returns null for a trip whose setup was never persisted', async () => {
    await expect(repo.getTripSetup('trip-never-saved')).resolves.toBeNull();
  });

  it('reconstructs Date for createdAt/updatedAt e mantiene InstantISO (stringa) per gli instanti di Transport/Accommodation (ADR-025 §7 n)', async () => {
    const setup: TripSetup = {
      tripId: 'trip-1',
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-02T00:00:00.000Z'),
      transports: [
        {
          id: 't-1',
          mode: 'flight',
          destination: 'Lisbona',
          departureDate: '2026-08-01T10:00:00.000Z',
          arrivalDate: '2026-08-01T12:00:00.000Z',
          confirmed: false,
        } as any,
      ],
      accommodations: [
        {
          id: 'a-1',
          type: 'hotel',
          name: 'Hotel Lisboa',
          checkIn: '2026-08-01T14:00:00.000Z',
          checkOut: '2026-08-04T10:00:00.000Z',
          confirmed: true,
        } as any,
      ],
    };

    // Simula ciò che MMKV restituisce davvero: JSON round-trip, le Date
    // diventano stringhe ISO. `saveTripSetup` scrive l'oggetto as-is (come
    // faceva `localDb.set` prima di ADR-021); il round-trip di serializzazione
    // avviene nella FakeLocalDatabase solo se lo emuliamo esplicitamente qui,
    // perché la Fake non serializza a JSON davvero — lo facciamo a mano per
    // riprodurre fedelmente il comportamento di MMKVAdapter.
    await db.set('trip_setup_trip-1', JSON.parse(JSON.stringify(setup)));

    const loaded = await repo.getTripSetup('trip-1');

    expect(loaded?.createdAt).toBeInstanceOf(Date);
    expect(loaded?.updatedAt).toBeInstanceOf(Date);
    expect(loaded?.createdAt?.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    // Gli instanti migrati restano stringhe ISO (InstantISO), invariati rispetto
    // al formato su disco — nessuna ricostruzione a Date (ADR-025 §7 n).
    expect(loaded?.transports?.[0].departureDate).toBe('2026-08-01T10:00:00.000Z');
    expect(loaded?.transports?.[0].arrivalDate).toBe('2026-08-01T12:00:00.000Z');
    expect(loaded?.accommodations?.[0].checkIn).toBe('2026-08-01T14:00:00.000Z');
    expect(loaded?.accommodations?.[0].checkOut).toBe('2026-08-04T10:00:00.000Z');
  });

  it('leaves arrivalDate undefined when absent, rather than reconstructing an invalid Date', async () => {
    const setup: TripSetup = {
      tripId: 'trip-2',
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-01T00:00:00.000Z'),
      transports: [
        {
          id: 't-1',
          mode: 'train',
          destination: 'Porto',
          departureDate: '2026-08-01T10:00:00.000Z',
          confirmed: false,
        } as any,
      ],
    };
    await db.set('trip_setup_trip-2', JSON.parse(JSON.stringify(setup)));

    const loaded = await repo.getTripSetup('trip-2');

    expect(loaded?.transports?.[0].arrivalDate).toBeUndefined();
  });

  it('round-trips saveTripSetup/getTripSetup for a trip with no transports/accommodations', async () => {
    const setup: TripSetup = {
      tripId: 'trip-3',
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    };
    await repo.saveTripSetup('trip-3', setup);

    const loaded = await repo.getTripSetup('trip-3');
    expect(loaded?.tripId).toBe('trip-3');
    expect(loaded?.transports).toBeUndefined();
    expect(loaded?.accommodations).toBeUndefined();
  });
});
