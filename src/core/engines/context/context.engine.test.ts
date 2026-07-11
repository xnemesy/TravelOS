import { ContextEngine } from './context.engine';
import { eventBus } from '../../events/event-bus';
import { TravelServices } from '../../../domain/providers/TravelServices';

const getWeatherForLocation = jest.fn().mockResolvedValue({ temp: 25, condition: 'Sunny' });
jest.spyOn(TravelServices, 'weather').mockReturnValue({ getWeatherForLocation } as any);

describe('ContextEngine - Dynamic tripProvider resolution and reactivity', () => {
  let contextEngine: ContextEngine;
  let mockTrip: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Ogni `new ContextEngine()` sottoscrive un listener wildcard sull'eventBus
    // singleton condiviso da tutto il file di test. Senza questa pulizia, i
    // listener delle istanze dei test precedenti restano attivi e accumulano
    // lavoro sprecato ad ogni publish successivo (stale listener leak).
    eventBus.clearAllSubscribers();
    contextEngine = new ContextEngine();
    mockTrip = {
      id: 'trip-abc-123',
      title: 'Amazing Roma Trip',
      destination: 'Rome, Italy',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-10'),
      status: 'ongoing',
    };
  });

  it('correctly recomposes context with default values when tripProvider is not registered', () => {
    const context = contextEngine.getContext('trip-abc-123');
    expect(context.tripTitle).toBe('Viaggio in programma');
    expect(context.destination).toBe('Destinazione');
  });

  it('correctly resolves and recomposes context with real trip data when tripProvider is registered', () => {
    contextEngine.registerTripProvider((id) => {
      if (id === 'trip-abc-123') return mockTrip;
      return null;
    });

    const context = contextEngine.getContext('trip-abc-123');
    expect(context.tripTitle).toBe('Amazing Roma Trip');
    expect(context.destination).toBe('Rome, Italy');
    expect(context.startDate).toBe('2026-09-01');
    expect(context.endDate).toBe('2026-09-10');
    expect(context.tripPhase).toBe('ongoing');
  });

  it('automatically triggers recompose when a TripUpdated event is published on the eventBus', () => {
    const listener = jest.fn();
    contextEngine.subscribe('trip-abc-123', listener);

    contextEngine.registerTripProvider((id) => {
      if (id === 'trip-abc-123') return mockTrip;
      return null;
    });

    // Modifiche al trip
    mockTrip.title = 'Updated Rome Tour';
    mockTrip.destination = 'Colosseum, Rome';

    // Pubblica il fatto di dominio
    eventBus.publish({
      id: 'evt-test-1',
      type: 'TripUpdated',
      timestamp: new Date().toISOString(),
      tripId: 'trip-abc-123',
      payload: mockTrip,
    });

    // L'ultimo callback inviato deve contenere i dati aggiornati
    expect(listener).toHaveBeenCalled();
    const lastCallArg = listener.mock.calls[listener.mock.calls.length - 1][0];
    expect(lastCallArg.tripTitle).toBe('Updated Rome Tour');
    expect(lastCallArg.destination).toBe('Colosseum, Rome');
  });

  it('does not re-fetch weather on repeated recomposes when location and date are unchanged', () => {
    // Un place georeferenziato è necessario perché scatti l'arricchimento meteo.
    contextEngine.registerStatePublisher('TestPlaces', () => ({
      savedPlaces: [{ coordinates: { latitude: 41.9, longitude: 12.5 } }] as any,
    }));

    // Tre recomposte consecutive (simulano tre fatti di dominio sullo stesso trip
    // che non toccano posizione/data di riferimento).
    contextEngine.recompose('trip-weather-1');
    contextEngine.recompose('trip-weather-1');
    contextEngine.recompose('trip-weather-1');

    // Il fetch di rete deve partire una sola volta grazie al dedup su lat|lon|date.
    expect(getWeatherForLocation).toHaveBeenCalledTimes(1);
  });
});

/**
 * ADR-020 — Barriera di idratazione. Un Engine finto con un'idratazione
 * controllabile a mano (Promise risolta manualmente dal test) simula la
 * natura realmente asincrona di MMKV: questi test verificano che il
 * ContextEngine non componga MAI dati parziali prima che l'idratazione sia
 * conclusa, e che la notifica finale ai subscriber avvenga esattamente una
 * volta, senza idratazioni duplicate.
 */
describe('ContextEngine - Hydration barrier (ADR-020)', () => {
  let contextEngine: ContextEngine;

  const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    jest.clearAllMocks();
    eventBus.clearAllSubscribers();
    contextEngine = new ContextEngine();
  });

  it('never composes partial data before hydration completes, then composes exactly once when it does', async () => {
    let resolveHydrate: () => void = () => {};
    const hydratePromise = new Promise<void>((resolve) => {
      resolveHydrate = resolve;
    });
    let publisherCalls = 0;

    contextEngine.registerHydratable('FakePlacesEngine', async () => {
      await hydratePromise;
    });
    contextEngine.registerStatePublisher('FakePlacesEngine', () => {
      publisherCalls++;
      return { savedPlaces: [{ id: 'p1' } as any], savedPlacesCount: 1 };
    });

    // Prima che l'idratazione sia conclusa: placeholder onesto, MAI il publisher interrogato.
    const pending = contextEngine.getContext('trip-hydrating-1');
    expect(pending.hydrationStatus).not.toBe('ready');
    expect(pending.savedPlaces).toEqual([]);
    expect(pending.savedPlacesCount).toBe(0);
    expect(publisherCalls).toBe(0);

    resolveHydrate();
    await flushMicrotasks();

    const ready = contextEngine.getContext('trip-hydrating-1');
    expect(ready.hydrationStatus).toBe('ready');
    expect(ready.savedPlacesCount).toBe(1);
    expect(publisherCalls).toBe(1); // il publisher è stato interrogato una sola volta, non ripetutamente
  });

  it('notifies a fresh subscriber with the pending state once, then with the ready state exactly once more', async () => {
    let resolveHydrate: () => void = () => {};
    const hydratePromise = new Promise<void>((resolve) => {
      resolveHydrate = resolve;
    });
    contextEngine.registerHydratable('FakeEngine', async () => {
      await hydratePromise;
    });

    const listener = jest.fn();
    contextEngine.subscribe('trip-hydrating-2', listener);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].hydrationStatus).not.toBe('ready');

    resolveHydrate();
    await flushMicrotasks();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1][0].hydrationStatus).toBe('ready');
  });

  it('deduplicates concurrent hydration attempts — the hydratable runs exactly once', async () => {
    let hydrateCallCount = 0;
    let resolveHydrate: () => void = () => {};
    const hydratePromise = new Promise<void>((resolve) => {
      resolveHydrate = resolve;
    });

    contextEngine.registerHydratable('FakeEngine', async () => {
      hydrateCallCount++;
      await hydratePromise;
    });

    // Chiamate concorrenti/ripetute mentre l'idratazione è in corso: nessuna deve
    // rilanciare una nuova lettura dell'Engine finto.
    contextEngine.recompose('trip-dedup-1');
    contextEngine.recompose('trip-dedup-1');
    const ensurePromise = contextEngine.ensureHydrated('trip-dedup-1');
    contextEngine.recompose('trip-dedup-1');

    resolveHydrate();
    await ensurePromise;
    await flushMicrotasks();

    expect(hydrateCallCount).toBe(1);
    expect(contextEngine.getContext('trip-dedup-1').hydrationStatus).toBe('ready');
  });

  it('does not resurrect a composed context if the trip is deleted while its hydration is in flight', async () => {
    let resolveHydrate: () => void = () => {};
    const hydratePromise = new Promise<void>((resolve) => {
      resolveHydrate = resolve;
    });
    contextEngine.registerHydratable('FakeEngine', async () => {
      await hydratePromise;
    });

    const listener = jest.fn();
    contextEngine.subscribe('trip-race-1', listener); // avvia l'idratazione

    eventBus.publish({
      id: 'evt-del-1',
      type: 'TripDeleted',
      timestamp: new Date().toISOString(),
      tripId: 'trip-race-1',
      payload: { id: 'trip-race-1' },
    });

    resolveHydrate();
    await flushMicrotasks();

    // L'idratazione in corso al momento del delete è stata superata (epoch):
    // non deve mai notificare uno stato 'ready' per un trip ormai eliminato.
    const everNotifiedReady = listener.mock.calls.some(([ctx]) => ctx.hydrationStatus === 'ready');
    expect(everNotifiedReady).toBe(false);
  });
});

/**
 * Regressione per l'Architecture Verification Fix #3: `composeNow()` invocato
 * al termine dell'idratazione (da `runHydration()` o dal ramo "0 hydratables"
 * di `ensureHydrated()`) non è mai protetto dal try/catch per-handler
 * dell'eventBus — a differenza della chiamata sincrona equivalente in
 * `recompose()`. Un publisher che fa fallire il calcolo del Journey Score (o
 * qualunque codice tra la fine del ciclo publisher e la notifica ai
 * subscriber) faceva rigettare la Promise restituita da `ensureHydrated()`
 * senza che nessuno la intercettasse — un rigetto non gestito.
 */
describe('ContextEngine - composeNow failures do not produce unhandled rejections (Architecture Verification Fix #3)', () => {
  let contextEngine: ContextEngine;

  const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

  // Publisher che fa fallire deliberatamente il calcolo interno di composeNow
  // (subito dopo il ciclo sui publisher, che è l'unico tratto già protetto).
  const registerBrokenPublisher = (engine: ContextEngine) => {
    engine.registerStatePublisher('BrokenPublisher', () => ({
      timeline: {
        days: {
          map() {
            throw new Error('boom: composeNow ha incontrato dati di giornata malformati');
          },
        } as any,
        currentOrNextPlace: null,
        upcomingPlacesToday: [],
        timeAvailableMinutesToday: 0,
      },
    }));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    eventBus.clearAllSubscribers();
    contextEngine = new ContextEngine();
  });

  it('ensureHydrated() resolves (does not reject) when composeNow throws at the end of runHydration()', async () => {
    contextEngine.registerHydratable('FakeEngine', async () => {});
    registerBrokenPublisher(contextEngine);

    await expect(contextEngine.ensureHydrated('trip-broken-1')).resolves.toBeUndefined();
  });

  it('ensureHydrated() resolves (does not reject) when composeNow throws with zero registered hydratables', async () => {
    // Nessun registerHydratable: prende il ramo "0 hydratables" di ensureHydrated,
    // l'altro punto in cui composeNow() viene invocato da un contesto asincrono.
    registerBrokenPublisher(contextEngine);

    await expect(contextEngine.ensureHydrated('trip-broken-2')).resolves.toBeUndefined();
  });

  it('recompose() — il vero percorso di produzione via eventBus — non lascia un unhandled rejection quando composeNow fallisce a idratazione conclusa', async () => {
    contextEngine.registerHydratable('FakeEngine', async () => {});
    registerBrokenPublisher(contextEngine);

    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    try {
      // Stesso identico percorso dell'eventBus wildcard listener: chiamata
      // sincrona e fire-and-forget, mai un `.catch()` da parte del chiamante.
      contextEngine.recompose('trip-broken-3');
      await flushMicrotasks();
      await flushMicrotasks();
      await flushMicrotasks();

      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});
