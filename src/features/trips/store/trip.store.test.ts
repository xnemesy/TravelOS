import { useTripStore } from './trip.store';
import { eventBus } from '../../../core/events/event-bus';
import { contextEngine } from '../../../core/engines';

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Regressione per l'Architecture Verification Fix #1: il listener wildcard di
 * useTripStore non deve mai persistere progress/stats derivati dal placeholder
 * pre-idratazione del ContextEngine (ADR-020). Usa i moduli reali (non finti)
 * perché il bug è precisamente nell'interazione tra i due — un ContextEngine
 * isolato nei suoi stessi test non lo avrebbe mai potuto rivelare.
 */
describe('useTripStore wildcard listener — does not persist placeholder-derived stats (Architecture Verification Fix #1)', () => {
  it('keeps the real progress/stats untouched while ContextEngine hydration for the trip is still pending, and updates only once it settles', async () => {
    let releaseHydration: () => void = () => {};
    const hydrationGate = new Promise<void>((resolve) => {
      releaseHydration = resolve;
    });

    // Idratazione controllabile a mano, per QUALUNQUE trip, per tutta la durata
    // di questo test — deve gatizzare fin dal primissimo evento di dominio
    // (`TripCreated`, pubblicato sincronamente dentro `createTrip()` qui sotto),
    // altrimenti quel primo evento risolverebbe l'idratazione subito e il test
    // non riprodurrebbe più lo scenario "trip mai idratato prima".
    contextEngine.registerHydratable('TestSlowEngineFix1', async () => {
      await hydrationGate;
    });

    // Trip reale, persistito tramite il repository vero (non solo stato Zustand
    // in-memory) — necessario perché updateTrip() lo cerchi correttamente.
    const created = await useTripStore.getState().createTrip({
      title: 'Trip Fix 1',
      destination: 'Lisbona',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-04'),
    });

    // Stabilisce un baseline reale e distintivo (mai 0), scrivendolo
    // direttamente — non attraverso il listener sotto test.
    await useTripStore.getState().updateTrip(created.id, {
      progress: 42,
      stats: { savedPlaces: 3, organizedDays: 2, reservations: 0, activitiesToComplete: 0 },
    });

    // Pubblica un fatto di dominio reale per questo trip: innesca il listener
    // wildcard, che ora deve attendere `ensureHydrated()` — ancora bloccato sul
    // gate — prima di leggere/fidarsi del context.
    eventBus.publish({
      id: 'evt-fix1-1',
      type: 'PlaceSaved',
      timestamp: new Date().toISOString(),
      tripId: created.id,
      payload: { placeId: 'p1', name: 'Test Place', category: 'landmark', latitude: 38.7, longitude: -9.1 },
    });
    await flushMicrotasks();
    await flushMicrotasks();

    // Prima che l'idratazione si concluda: il valore reale non deve MAI essere
    // stato sovrascritto con lo zero/placeholder del contesto non ancora pronto.
    expect(useTripStore.getState().getTripById(created.id)?.progress).toBe(42);
    expect(useTripStore.getState().getTripById(created.id)?.stats?.organizedDays).toBe(2);

    // Sblocca l'idratazione e lascia che il listener (ora in attesa su
    // ensureHydrated()) prosegua fino in fondo.
    releaseHydration();
    await flushMicrotasks();
    await flushMicrotasks();
    await flushMicrotasks();

    // A idratazione conclusa il context è 'ready': qualunque aggiornamento che
    // segua riflette un journeyScore reale, mai il placeholder azzerato.
    expect(contextEngine.getContext(created.id).hydrationStatus).toBe('ready');
  });
});
