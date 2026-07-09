import { SetupCompletionEngine } from './SetupCompletionEngine';
import { TripSetup } from '../models/trip-setup.model';

function buildSetup(overrides: Partial<TripSetup> = {}): TripSetup {
  const now = new Date('2026-07-10T00:00:00.000Z');
  return {
    tripId: 'trip-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const oneTransport = [
  {
    id: 't1',
    mode: 'flight' as const,
    destination: 'Budapest',
    departureDate: new Date('2026-08-01T00:00:00.000Z'),
    confirmed: false,
  },
];

const oneAccommodation = [
  {
    id: 'a1',
    name: 'Hotel Danubio',
    checkIn: new Date('2026-08-01T14:00:00.000Z'),
    checkOut: new Date('2026-08-05T10:00:00.000Z'),
    confirmed: false,
  },
];

const MULTI_NIGHT_TRIP = 4; // trip di più notti: accommodations è un prerequisito
const DAY_TRIP = 0; // trip in giornata: accommodations NON è un prerequisito

describe('SetupCompletionEngine.evaluate — trip di più notti', () => {
  it('setup vuoto: 0%, tutte le sezioni mancanti, Planner non sbloccato', () => {
    const report = SetupCompletionEngine.evaluate(buildSetup(), MULTI_NIGHT_TRIP);

    expect(report.percentage).toBe(0);
    expect(report.completedSections).toEqual([]);
    expect(report.missingSections).toEqual([
      'transports',
      'accommodations',
      'mobility',
      'constraints',
      'documents',
      'preferences',
    ]);
    expect(report.plannerReadiness.unlocked).toBe(false);
    expect(report.plannerReadiness.missingPrerequisites).toEqual(['accommodations', 'transports']);
  });

  it('un array vuoto dichiarato esplicitamente conta come sezione completa per la percentuale', () => {
    const report = SetupCompletionEngine.evaluate(
      buildSetup({ constraints: [], documents: [] }),
      MULTI_NIGHT_TRIP
    );

    expect(report.completedSections).toEqual(expect.arrayContaining(['constraints', 'documents']));
    expect(report.percentage).toBe(Math.round((2 / 6) * 100));
  });

  it('transports/accommodations con array vuoto contano come sezione "completa" ma NON sbloccano il Planner', () => {
    const report = SetupCompletionEngine.evaluate(
      buildSetup({ transports: [], accommodations: [] }),
      MULTI_NIGHT_TRIP
    );

    expect(report.completedSections).toEqual(expect.arrayContaining(['transports', 'accommodations']));
    expect(report.plannerReadiness.unlocked).toBe(false);
    expect(report.plannerReadiness.missingPrerequisites).toEqual(['accommodations', 'transports']);
  });

  it('sblocca il Planner con solo transports+accommodations popolati, anche se il resto è mancante (33%)', () => {
    const report = SetupCompletionEngine.evaluate(
      buildSetup({ transports: oneTransport, accommodations: oneAccommodation }),
      MULTI_NIGHT_TRIP
    );

    expect(report.percentage).toBe(Math.round((2 / 6) * 100));
    expect(report.plannerReadiness.unlocked).toBe(true);
    expect(report.plannerReadiness.missingPrerequisites).toEqual([]);
  });

  it('missingPrerequisites riporta solo la sezione realmente mancante quando transports è popolato ma accommodations no', () => {
    const report = SetupCompletionEngine.evaluate(buildSetup({ transports: oneTransport }), MULTI_NIGHT_TRIP);

    expect(report.plannerReadiness.unlocked).toBe(false);
    expect(report.plannerReadiness.missingPrerequisites).toEqual(['accommodations']);
  });

  it('setup completo al 100%: tutte le sezioni affrontate, Planner sbloccato', () => {
    const report = SetupCompletionEngine.evaluate(
      buildSetup({
        transports: oneTransport,
        accommodations: oneAccommodation,
        mobility: { modes: ['walking'] },
        constraints: [],
        documents: [],
        preferences: {},
      }),
      MULTI_NIGHT_TRIP
    );

    expect(report.percentage).toBe(100);
    expect(report.completedSections).toHaveLength(6);
    expect(report.missingSections).toEqual([]);
    expect(report.plannerReadiness.unlocked).toBe(true);
  });

  it('è deterministico: stesso input produce lo stesso report ad ogni chiamata', () => {
    const setup = buildSetup({ transports: oneTransport, accommodations: oneAccommodation });

    const first = SetupCompletionEngine.evaluate(setup, MULTI_NIGHT_TRIP);
    const second = SetupCompletionEngine.evaluate(setup, MULTI_NIGHT_TRIP);

    expect(second).toEqual(first);
  });

  it('non muta l\'oggetto TripSetup passato in input', () => {
    const setup = buildSetup({ transports: oneTransport });
    const snapshot = JSON.parse(JSON.stringify(setup));

    SetupCompletionEngine.evaluate(setup, MULTI_NIGHT_TRIP);

    expect(JSON.parse(JSON.stringify(setup))).toEqual(snapshot);
  });
});

// Review indipendente (Sprint 20, revisione consenso ADR-018 §5): accommodations
// è un prerequisito Planner condizionale alla durata del trip, non sempre
// obbligatorio — un day-trip (0 notti) non richiede alcun alloggio.
describe('SetupCompletionEngine.evaluate — day-trip (0 notti)', () => {
  it('sblocca il Planner con solo transports, senza accommodations', () => {
    const report = SetupCompletionEngine.evaluate(buildSetup({ transports: oneTransport }), DAY_TRIP);

    expect(report.plannerReadiness.unlocked).toBe(true);
    expect(report.plannerReadiness.missingPrerequisites).toEqual([]);
  });

  it('resta bloccato se manca anche transports per un day-trip', () => {
    const report = SetupCompletionEngine.evaluate(buildSetup(), DAY_TRIP);

    expect(report.plannerReadiness.unlocked).toBe(false);
    expect(report.plannerReadiness.missingPrerequisites).toEqual(['transports']);
  });

  it('la percentuale non cambia in base alla durata: accommodations resta una sezione "toccabile" normalmente', () => {
    const report = SetupCompletionEngine.evaluate(
      buildSetup({ transports: oneTransport, accommodations: [] }),
      DAY_TRIP
    );

    expect(report.completedSections).toEqual(expect.arrayContaining(['transports', 'accommodations']));
    expect(report.percentage).toBe(Math.round((2 / 6) * 100));
    expect(report.plannerReadiness.unlocked).toBe(true);
  });

  it('se accommodations è comunque popolato per un day-trip, il Planner resta sbloccato (nessuna penalizzazione)', () => {
    const report = SetupCompletionEngine.evaluate(
      buildSetup({ transports: oneTransport, accommodations: oneAccommodation }),
      DAY_TRIP
    );

    expect(report.plannerReadiness.unlocked).toBe(true);
  });
});
