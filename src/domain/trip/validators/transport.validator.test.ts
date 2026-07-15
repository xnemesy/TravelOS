import { validateTransportForm, TransportFormData } from './transport.validator';

describe('validateTransportForm', () => {
  const base: TransportFormData = {
    mode: 'flight',
    origin: 'Milano',
    destination: 'Budapest',
    departureDate: new Date('2026-08-01T10:00:00.000Z'),
    arrivalDate: new Date('2026-08-01T12:00:00.000Z'),
    bookingReference: 'ABC123',
    notes: '',
  };

  it('accetta dati completi e validi', () => {
    expect(validateTransportForm(base)).toEqual({ valid: true, errors: {} });
  });

  it('accetta senza bookingReference/notes (entrambi facoltativi)', () => {
    const { bookingReference, notes, ...rest } = base;
    const result = validateTransportForm(rest as TransportFormData);
    expect(result.valid).toBe(true);
  });

  it('rifiuta mode assente', () => {
    const result = validateTransportForm({ ...base, mode: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.mode).toBeDefined();
  });

  it('rifiuta origin vuoto', () => {
    const result = validateTransportForm({ ...base, origin: '   ' });
    expect(result.valid).toBe(false);
    expect(result.errors.origin).toBeDefined();
  });

  it('rifiuta destination vuota', () => {
    const result = validateTransportForm({ ...base, destination: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.destination).toBeDefined();
  });

  it('rifiuta departureDate assente', () => {
    const result = validateTransportForm({ ...base, departureDate: null });
    expect(result.valid).toBe(false);
    expect(result.errors.departureDate).toBeDefined();
  });

  it('rifiuta arrivalDate assente', () => {
    const result = validateTransportForm({ ...base, arrivalDate: null });
    expect(result.valid).toBe(false);
    expect(result.errors.arrivalDate).toBeDefined();
  });

  it('rifiuta arrivalDate precedente a departureDate', () => {
    const result = validateTransportForm({
      ...base,
      arrivalDate: new Date('2026-08-01T08:00:00.000Z'),
    });
    expect(result.valid).toBe(false);
    expect(result.errors.arrivalDate).toBeDefined();
  });

  it('accetta arrivalDate uguale a departureDate', () => {
    const result = validateTransportForm({ ...base, arrivalDate: base.departureDate });
    expect(result.valid).toBe(true);
  });

  it('accumula più errori contemporaneamente', () => {
    const result = validateTransportForm({ ...base, mode: '', origin: '', destination: '' });
    expect(Object.keys(result.errors)).toEqual(expect.arrayContaining(['mode', 'origin', 'destination']));
  });
});
