import { validateBasicInfoStep, validateTravelersStep, validateBudgetStep } from './trip-wizard.validator';

describe('validateBasicInfoStep', () => {
  const base = {
    title: 'Fuga a Budapest',
    destination: 'Budapest',
    startDate: new Date('2026-08-01'),
    endDate: new Date('2026-08-05'),
  };

  it('accetta dati validi', () => {
    expect(validateBasicInfoStep(base)).toEqual({ valid: true, errors: {} });
  });

  it('rifiuta un titolo vuoto o solo spazi', () => {
    const result = validateBasicInfoStep({ ...base, title: '   ' });
    expect(result.valid).toBe(false);
    expect(result.errors.title).toBeDefined();
  });

  it('rifiuta una destinazione vuota', () => {
    const result = validateBasicInfoStep({ ...base, destination: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.destination).toBeDefined();
  });

  it('rifiuta endDate precedente a startDate', () => {
    const result = validateBasicInfoStep({ ...base, endDate: new Date('2026-07-30') });
    expect(result.valid).toBe(false);
    expect(result.errors.endDate).toBeDefined();
  });

  it('accumula più errori contemporaneamente', () => {
    const result = validateBasicInfoStep({ ...base, title: '', destination: '' });
    expect(Object.keys(result.errors)).toEqual(expect.arrayContaining(['title', 'destination']));
  });
});

describe('validateTravelersStep', () => {
  it('accetta almeno un adulto, zero bambini e zero animali', () => {
    expect(validateTravelersStep({ adults: 1, children: 0, pets: 0 })).toEqual({ valid: true, errors: {} });
  });

  it('rifiuta zero adulti', () => {
    const result = validateTravelersStep({ adults: 0, children: 0, pets: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors.adults).toBeDefined();
  });

  it('rifiuta bambini negativi', () => {
    const result = validateTravelersStep({ adults: 1, children: -1, pets: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors.children).toBeDefined();
  });

  it('rifiuta animali negativi', () => {
    const result = validateTravelersStep({ adults: 1, children: 0, pets: -2 });
    expect(result.valid).toBe(false);
    expect(result.errors.pets).toBeDefined();
  });
});

describe('validateBudgetStep', () => {
  it('accetta budget assente (sezione opzionale)', () => {
    expect(validateBudgetStep({})).toEqual({ valid: true, errors: {} });
  });

  it('accetta un budget non negativo', () => {
    expect(validateBudgetStep({ budgetAmount: 1500 })).toEqual({ valid: true, errors: {} });
  });

  it('rifiuta un budget negativo', () => {
    const result = validateBudgetStep({ budgetAmount: -100 });
    expect(result.valid).toBe(false);
    expect(result.errors.budgetAmount).toBeDefined();
  });
});

describe('validateFlightsStep', () => {
  it('accetta array vuoto o assente (sezione opzionale)', () => {
    expect(require('./trip-wizard.validator').validateFlightsStep({})).toEqual({ valid: true, errors: {} });
    expect(require('./trip-wizard.validator').validateFlightsStep({ transports: [] })).toEqual({ valid: true, errors: {} });
  });

  it('accetta volo valido', () => {
    const t = [{
      id: 't1',
      mode: 'flight' as const,
      destination: 'Budapest',
      departureDate: new Date('2026-08-01T10:00:00.000Z'),
      arrivalDate: new Date('2026-08-01T12:00:00.000Z'),
    }];
    expect(require('./trip-wizard.validator').validateFlightsStep({ transports: t })).toEqual({ valid: true, errors: {} });
  });

  it('rifiuta arrivo precedente alla partenza', () => {
    const t = [{
      id: 't1',
      mode: 'flight' as const,
      destination: 'Budapest',
      departureDate: new Date('2026-08-01T14:00:00.000Z'),
      arrivalDate: new Date('2026-08-01T10:00:00.000Z'),
    }];
    const result = require('./trip-wizard.validator').validateFlightsStep({ transports: t });
    expect(result.valid).toBe(false);
    expect(result.errors.transport_0).toBeDefined();
  });
});

describe('validateAccommodationStep', () => {
  it('accetta array vuoto o assente (sezione opzionale)', () => {
    expect(require('./trip-wizard.validator').validateAccommodationStep({})).toEqual({ valid: true, errors: {} });
    expect(require('./trip-wizard.validator').validateAccommodationStep({ accommodations: [] })).toEqual({ valid: true, errors: {} });
  });

  it('accetta alloggio valido', () => {
    const a = [{
      id: 'a1',
      type: 'hotel' as const,
      name: 'Hotel Danubio',
      checkIn: new Date('2026-08-01T14:00:00.000Z'),
      checkOut: new Date('2026-08-05T10:00:00.000Z'),
    }];
    expect(require('./trip-wizard.validator').validateAccommodationStep({ accommodations: a })).toEqual({ valid: true, errors: {} });
  });

  it('rifiuta check-out precedente o uguale a check-in', () => {
    const a = [{
      id: 'a1',
      type: 'hotel' as const,
      name: 'Hotel Danubio',
      checkIn: new Date('2026-08-03T14:00:00.000Z'),
      checkOut: new Date('2026-08-03T10:00:00.000Z'),
    }];
    const result = require('./trip-wizard.validator').validateAccommodationStep({ accommodations: a });
    expect(result.valid).toBe(false);
    expect(result.errors.accommodation_0).toBeDefined();
  });
});

