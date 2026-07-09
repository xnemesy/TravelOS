import { TripLifecycleWatcher, toWatchedStage } from './trip-lifecycle.watcher';
import { Trip, TripStatus } from '../../../domain/trip/models/trip.model';
import { ILocalDatabase } from '../../storage/local-database.interface';
import { DomainEvent } from '../types/events.types';

class FakeLocalDatabase implements ILocalDatabase {
  private store: Map<string, unknown> = new Map();

  async get<T>(key: string): Promise<T | null> {
    return (this.store.has(key) ? (this.store.get(key) as T) : null);
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

class FakeEventBus {
  public published: DomainEvent[] = [];
  publish<T>(event: DomainEvent<T>): void {
    this.published.push(event as DomainEvent);
  }
}

function buildTrip(overrides: Partial<Trip> = {}): Trip {
  const now = new Date('2026-06-01T00:00:00.000Z');
  return {
    id: 'trip-1',
    userId: 'user-1',
    title: 'Weekend a Budapest',
    destination: 'Budapest',
    startDate: new Date('2026-07-10T00:00:00.000Z'),
    endDate: new Date('2026-07-15T00:00:00.000Z'),
    status: 'planned',
    currency: 'EUR',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Trip;
}

describe('TripLifecycleWatcher.checkTransition', () => {
  let storage: FakeLocalDatabase;
  let bus: FakeEventBus;
  let watcher: TripLifecycleWatcher;

  beforeEach(() => {
    storage = new FakeLocalDatabase();
    bus = new FakeEventBus();
    watcher = new TripLifecycleWatcher(storage, bus);
  });

  it('non pubblica nulla mentre il trip è ancora "planned" (nessuna transizione)', async () => {
    const trip = buildTrip();
    const beforeStart = new Date('2026-06-01T00:00:00.000Z');

    await watcher.checkTransition(trip, beforeStart);

    expect(bus.published).toHaveLength(0);
  });

  it('pubblica TripStarted esattamente una volta quando planned → ongoing', async () => {
    const trip = buildTrip();
    const duringTrip = new Date('2026-07-12T00:00:00.000Z');

    await watcher.checkTransition(trip, duringTrip);

    expect(bus.published).toHaveLength(1);
    expect(bus.published[0]).toMatchObject({
      type: 'TripStarted',
      tripId: 'trip-1',
      payload: { startedAt: duringTrip.toISOString() },
    });
  });

  it('collassa "ready" nello stesso bucket pre_start di "planned" (ADR-015 §2.6: planned/ready → ongoing)', async () => {
    const trip = buildTrip({ status: 'ready' });
    const duringTrip = new Date('2026-07-12T00:00:00.000Z');

    await watcher.checkTransition(trip, duringTrip);

    expect(bus.published).toHaveLength(1);
    expect(bus.published[0].type).toBe('TripStarted');
  });

  it('pubblica TripCompleted esattamente una volta quando ongoing → completed, dopo aver già osservato ongoing', async () => {
    const trip = buildTrip();
    const duringTrip = new Date('2026-07-12T00:00:00.000Z');
    const afterTrip = new Date('2026-07-20T00:00:00.000Z');

    await watcher.checkTransition(trip, duringTrip); // osserva planned → ongoing
    bus.published.length = 0; // reset per isolare la seconda osservazione

    await watcher.checkTransition(trip, afterTrip); // osserva ongoing → completed

    expect(bus.published).toHaveLength(1);
    expect(bus.published[0]).toMatchObject({
      type: 'TripCompleted',
      tripId: 'trip-1',
      payload: { completedAt: afterTrip.toISOString() },
    });
  });

  it('pubblica TripStarted e poi TripCompleted in sequenza se il trip non è mai stato osservato durante ongoing (finestra saltata)', async () => {
    const trip = buildTrip();
    const afterTrip = new Date('2026-07-20T00:00:00.000Z');

    await watcher.checkTransition(trip, afterTrip); // prima osservazione assoluta, già a trip concluso

    expect(bus.published).toHaveLength(2);
    expect(bus.published[0].type).toBe('TripStarted');
    expect(bus.published[1].type).toBe('TripCompleted');
  });

  it('è idempotente: due chiamate consecutive con lo stesso "now" pubblicano il fatto una sola volta', async () => {
    const trip = buildTrip();
    const duringTrip = new Date('2026-07-12T00:00:00.000Z');

    await watcher.checkTransition(trip, duringTrip);
    await watcher.checkTransition(trip, duringTrip);

    expect(bus.published).toHaveLength(1);
  });

  it('è deterministico e sicuro sotto chiamate concorrenti sullo stesso trip (nessun doppio publish)', async () => {
    const trip = buildTrip();
    const duringTrip = new Date('2026-07-12T00:00:00.000Z');

    await Promise.all([
      watcher.checkTransition(trip, duringTrip),
      watcher.checkTransition(trip, duringTrip),
      watcher.checkTransition(trip, duringTrip),
    ]);

    expect(bus.published).toHaveLength(1);
  });

  it('non pubblica nulla per una transizione all\'indietro (es. endDate estesa dopo il completamento) e resincronizza la baseline', async () => {
    const trip = buildTrip();
    const afterTrip = new Date('2026-07-20T00:00:00.000Z');
    await watcher.checkTransition(trip, afterTrip); // planned → ongoing → completed
    bus.published.length = 0;

    // L'utente estende endDate: lo stesso "now" ora deriva 'ongoing' invece di 'completed'.
    const extendedTrip = buildTrip({ endDate: new Date('2026-07-25T00:00:00.000Z') });
    await watcher.checkTransition(extendedTrip, afterTrip);

    expect(bus.published).toHaveLength(0);

    // Una successiva ri-transizione in avanti verso completed deve tornare a scattare.
    const wayAfter = new Date('2026-07-30T00:00:00.000Z');
    await watcher.checkTransition(extendedTrip, wayAfter);
    expect(bus.published).toHaveLength(1);
    expect(bus.published[0].type).toBe('TripCompleted');
  });

  it('ignora un trip con stato derivato "cancelled": nessun evento, nessuna scrittura', async () => {
    const trip = buildTrip({ status: 'cancelled' });
    const duringTrip = new Date('2026-07-12T00:00:00.000Z');

    await watcher.checkTransition(trip, duringTrip);

    expect(bus.published).toHaveLength(0);
    const stored = await storage.get(`trip_lifecycle_${trip.id}`);
    expect(stored).toBeNull();
  });

  it('un trip "archived" con date nella finestra ongoing pubblica comunque TripStarted — TripCalculator non ha un corto circuito per "archived" come lo ha per "cancelled" (quirk preesistente, non corretto qui)', async () => {
    const trip = buildTrip({ status: 'archived' });
    const duringTrip = new Date('2026-07-12T00:00:00.000Z');

    await watcher.checkTransition(trip, duringTrip);

    expect(bus.published).toHaveLength(1);
    expect(bus.published[0].type).toBe('TripStarted');
  });

  it('bootstrap: usa trip.status persistito come baseline quando non esiste ancora uno stato osservato', async () => {
    // trip.status è 'planned' anche se, per dati preesistenti, viene osservato per la prima volta a viaggio concluso.
    const trip = buildTrip({ status: 'planned' });
    const afterTrip = new Date('2026-07-20T00:00:00.000Z');

    await watcher.checkTransition(trip, afterTrip);

    expect(bus.published.map((e) => e.type)).toEqual(['TripStarted', 'TripCompleted']);
  });

  it('non emette eventi duplicati tra due trip diversi osservati nello stesso batch', async () => {
    const tripA = buildTrip({ id: 'trip-a' });
    const tripB = buildTrip({ id: 'trip-b' });
    const duringTrip = new Date('2026-07-12T00:00:00.000Z');

    await Promise.all([
      watcher.checkTransition(tripA, duringTrip),
      watcher.checkTransition(tripB, duringTrip),
    ]);

    expect(bus.published.filter((e) => e.tripId === 'trip-a')).toHaveLength(1);
    expect(bus.published.filter((e) => e.tripId === 'trip-b')).toHaveLength(1);
  });
});

describe('toWatchedStage', () => {
  it('collassa planned/ready in pre_start', () => {
    expect(toWatchedStage('planned')).toBe('pre_start');
    expect(toWatchedStage('ready')).toBe('pre_start');
  });

  it('mappa ongoing e completed 1:1', () => {
    expect(toWatchedStage('ongoing')).toBe('ongoing');
    expect(toWatchedStage('completed')).toBe('completed');
  });

  it('ritorna null per cancelled e archived — fuori scope per questo sprint', () => {
    expect(toWatchedStage('cancelled')).toBeNull();
    expect(toWatchedStage('archived')).toBeNull();
  });
});
