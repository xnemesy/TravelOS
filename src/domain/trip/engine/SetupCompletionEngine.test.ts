import { unsafeAsInstantISO } from '../../time';
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
    departureDate: unsafeAsInstantISO('2026-08-01T00:00:00.000Z'),
    confirmed: false,
  },
];

const oneAccommodation = [
  {
    id: 'a1',
    type: 'hotel' as const,
    name: 'Hotel Danubio',
    checkIn: unsafeAsInstantISO('2026-08-01T14:00:00.000Z'),
    checkOut: unsafeAsInstantISO('2026-08-05T10:00:00.000Z'),
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
    expect(report.plannerReadiness.unlocked).toBe(true);
    expect(report.plannerReadiness.missingPrerequisites).toEqual([]);
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
    expect(report.plannerReadiness.unlocked).toBe(true);
    expect(report.plannerReadiness.missingPrerequisites).toEqual([]);
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

    expect(report.plannerReadiness.unlocked).toBe(true);
    expect(report.plannerReadiness.missingPrerequisites).toEqual([]);
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

    expect(report.plannerReadiness.unlocked).toBe(true);
    expect(report.plannerReadiness.missingPrerequisites).toEqual([]);
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

describe('SetupCompletionEngine.evaluateSetup — completezza e pesi (30/20/20/15/15)', () => {
  const baseTripInfo = {
    title: 'Viaggio a Roma',
    destination: 'Roma',
    startDate: new Date('2026-08-01T00:00:00.000Z'),
    endDate: new Date('2026-08-05T00:00:00.000Z'), // 4 notti
  };

  const dayTripInfo = {
    title: 'Gita a Tivoli',
    destination: 'Tivoli',
    startDate: new Date('2026-08-01T08:00:00.000Z'),
    endDate: new Date('2026-08-01T20:00:00.000Z'), // 0 notti
  };

  it('input vuoto: 0%, tutte le 5 sezioni mancanti, Planner non sbloccato', () => {
    const progress = SetupCompletionEngine.evaluateSetup({});

    expect(progress.percentage).toBe(0);
    expect(progress.completedSections).toEqual([]);
    expect(progress.missingSections).toEqual([
      'basic_info',
      'transport',
      'accommodation',
      'travellers',
      'budget',
    ]);
    expect(progress.plannerUnlocked).toBe(false);
    expect(progress.warnings).toContain('Titolo del viaggio mancante o vuoto');
    expect(progress.warnings).toContain('Destinazione del viaggio mancante o vuota');
    expect(progress.warnings).toContain('Date del viaggio mancanti o non valide');
  });

  it('solo Basic Info valido (30%): planner bloccato per assenza trasporti', () => {
    const progress = SetupCompletionEngine.evaluateSetup(baseTripInfo);

    expect(progress.percentage).toBe(30);
    expect(progress.completedSections).toEqual(['basic_info']);
    expect(progress.missingSections).toEqual([
      'transport',
      'accommodation',
      'travellers',
      'budget',
    ]);
    expect(progress.plannerUnlocked).toBe(true);
    expect(progress.warnings).toContain('Nessun volo o trasporto configurato (Opzionale)');
  });

  it('Basic Info + Transport su day-trip (30 + 20 = 50%): sblocca il Planner senza Accommodation', () => {
    const progress = SetupCompletionEngine.evaluateSetup({
      ...dayTripInfo,
      transports: oneTransport,
    });

    expect(progress.percentage).toBe(50);
    expect(progress.completedSections).toEqual(['basic_info', 'transport']);
    expect(progress.plannerUnlocked).toBe(true);
  });

  it('Basic Info + Transport su viaggio multi-notte (50%): planner bloccato per assenza alloggio', () => {
    const progress = SetupCompletionEngine.evaluateSetup({
      ...baseTripInfo,
      transports: oneTransport,
    });

    expect(progress.percentage).toBe(50);
    expect(progress.completedSections).toEqual(['basic_info', 'transport']);
    expect(progress.plannerUnlocked).toBe(true);
    expect(progress.warnings).toContain('Nessun alloggio configurato per un viaggio di più notti (Opzionale)');
  });

  it('Basic Info + Transport + Accommodation su multi-notte (30 + 20 + 20 = 70%): sblocca il Planner', () => {
    const progress = SetupCompletionEngine.evaluateSetup({
      ...baseTripInfo,
      transports: oneTransport,
      accommodations: oneAccommodation,
    });

    expect(progress.percentage).toBe(70);
    expect(progress.completedSections).toEqual(['basic_info', 'transport', 'accommodation']);
    expect(progress.plannerUnlocked).toBe(true);
  });

  it('setup completo al 100%: tutte le 5 sezioni popolate, 0 warnings', () => {
    const progress = SetupCompletionEngine.evaluateSetup({
      ...baseTripInfo,
      transports: oneTransport,
      accommodations: oneAccommodation,
      travelers: { adults: 2, children: 1, pets: 0 },
      budgetAmount: 1200,
    });

    expect(progress.percentage).toBe(100);
    expect(progress.completedSections).toHaveLength(5);
    expect(progress.completedSections).toEqual([
      'basic_info',
      'transport',
      'accommodation',
      'travellers',
      'budget',
    ]);
    expect(progress.missingSections).toEqual([]);
    expect(progress.plannerUnlocked).toBe(true);
    expect(progress.warnings).toEqual([]);
  });

  it('supporta sia spelling travelers (US) che travellers (UK) per la sezione 15%', () => {
    const progressUS = SetupCompletionEngine.evaluateSetup({ ...baseTripInfo, travelers: { adults: 1 } });
    const progressUK = SetupCompletionEngine.evaluateSetup({ ...baseTripInfo, travellers: { adults: 1 } });

    expect(progressUS.completedSections).toContain('travellers');
    expect(progressUS.percentage).toBe(45); // 30 + 15
    expect(progressUK).toEqual(progressUS);
  });

  it('supporta sia budgetAmount che preferences.budgetLevel per la sezione budget 15%', () => {
    const progressAmount = SetupCompletionEngine.evaluateSetup({ ...baseTripInfo, budgetAmount: 500 });
    const progressLevel = SetupCompletionEngine.evaluateSetup({
      ...baseTripInfo,
      setup: buildSetup({ preferences: { budgetLevel: 'medium' } }),
    });

    expect(progressAmount.completedSections).toContain('budget');
    expect(progressAmount.percentage).toBe(45); // 30 + 15
    expect(progressLevel.completedSections).toContain('budget');
    expect(progressLevel.percentage).toBe(45);
  });

  it('genera warnings su date non valide (endDate < startDate)', () => {
    const progress = SetupCompletionEngine.evaluateSetup({
      ...baseTripInfo,
      startDate: new Date('2026-08-10'),
      endDate: new Date('2026-08-01'),
    });

    expect(progress.completedSections).not.toContain('basic_info');
    expect(progress.warnings).toContain('La data di fine viaggio precede la data di inizio');
    expect(progress.plannerUnlocked).toBe(false);
  });

  it('genera warnings su trasporti con orari coerenti o fuori date del viaggio', () => {
    const progress = SetupCompletionEngine.evaluateSetup({
      ...baseTripInfo,
      transports: [
        {
          ...oneTransport[0],
          departureDate: unsafeAsInstantISO('2026-08-02T18:00:00.000Z'),
          arrivalDate: unsafeAsInstantISO('2026-08-02T10:00:00.000Z'), // arrivo prima della partenza
        },
      ],
    });

    expect(progress.warnings).toContain('Il trasporto verso Budapest ha data di arrivo precedente alla partenza');
  });

  it('genera warnings su alloggi con checkOut <= checkIn', () => {
    const progress = SetupCompletionEngine.evaluateSetup({
      ...baseTripInfo,
      transports: oneTransport,
      accommodations: [
        {
          ...oneAccommodation[0],
          checkIn: unsafeAsInstantISO('2026-08-03T14:00:00.000Z'),
          checkOut: unsafeAsInstantISO('2026-08-03T10:00:00.000Z'), // check-out prima del check-in
        },
      ],
    });

    expect(progress.warnings).toContain("L'alloggio Hotel Danubio ha data di check-out non successiva al check-in");
  });

  it('genera warnings se adulti < 1 o budget negativo', () => {
    const progress = SetupCompletionEngine.evaluateSetup({
      ...baseTripInfo,
      travelers: { adults: 0, children: 0, pets: 0 },
      budgetAmount: -100,
    });

    expect(progress.warnings).toContain('Il viaggio deve includere almeno un adulto tra i viaggiatori');
    expect(progress.warnings).toContain('Il budget del viaggio non può essere negativo');
  });

  it('è deterministico: chiamate successive producono lo stesso identico progress', () => {
    const input = {
      ...baseTripInfo,
      transports: oneTransport,
      accommodations: oneAccommodation,
      travelers: { adults: 2 },
      budgetAmount: 1000,
    };

    const first = SetupCompletionEngine.evaluateSetup(input);
    const second = SetupCompletionEngine.evaluateSetup(input);

    expect(second).toEqual(first);
  });

  it('non muta l\'oggetto passato in input', () => {
    const input = {
      ...baseTripInfo,
      transports: oneTransport,
      travelers: { adults: 2 },
    };
    const snapshot = JSON.parse(JSON.stringify(input));

    SetupCompletionEngine.evaluateSetup(input);

    expect(JSON.parse(JSON.stringify(input))).toEqual(snapshot);
  });

  it('il metodo di istanza evaluateSetup è equivalente a quello statico', () => {
    const input = {
      ...baseTripInfo,
      transports: oneTransport,
      accommodations: oneAccommodation,
    };

    const engineInstance = new SetupCompletionEngine();
    expect(engineInstance.evaluateSetup(input)).toEqual(SetupCompletionEngine.evaluateSetup(input));
  });
});

