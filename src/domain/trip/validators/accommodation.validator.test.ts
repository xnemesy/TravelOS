import { validateAccommodationForm, AccommodationFormData } from './accommodation.validator';

describe('validateAccommodationForm', () => {
  const base: AccommodationFormData = {
    type: 'hotel',
    name: 'Hotel Danubio',
    address: 'Via del Danubio 12, Budapest',
    checkIn: new Date('2026-08-01T14:00:00.000Z'),
    checkOut: new Date('2026-08-05T10:00:00.000Z'),
    bookingReference: 'RES-987',
    confirmationUrl: 'https://booking.example.com/res-987',
    notes: '',
  };

  it('accetta dati completi e validi', () => {
    expect(validateAccommodationForm(base)).toEqual({ valid: true, errors: {} });
  });

  it('accetta senza bookingReference/confirmationUrl/notes (tutti facoltativi)', () => {
    const { bookingReference, confirmationUrl, notes, ...rest } = base;
    const result = validateAccommodationForm(rest as AccommodationFormData);
    expect(result.valid).toBe(true);
  });

  it('rifiuta type assente', () => {
    const result = validateAccommodationForm({ ...base, type: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.type).toBeDefined();
  });

  it('rifiuta name vuoto', () => {
    const result = validateAccommodationForm({ ...base, name: '   ' });
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  it('rifiuta address vuoto', () => {
    const result = validateAccommodationForm({ ...base, address: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.address).toBeDefined();
  });

  it('rifiuta checkIn assente', () => {
    const result = validateAccommodationForm({ ...base, checkIn: null });
    expect(result.valid).toBe(false);
    expect(result.errors.checkIn).toBeDefined();
  });

  it('rifiuta checkOut assente', () => {
    const result = validateAccommodationForm({ ...base, checkOut: null });
    expect(result.valid).toBe(false);
    expect(result.errors.checkOut).toBeDefined();
  });

  it('rifiuta checkOut uguale a checkIn', () => {
    const result = validateAccommodationForm({ ...base, checkOut: base.checkIn });
    expect(result.valid).toBe(false);
    expect(result.errors.checkOut).toBeDefined();
  });

  it('rifiuta checkOut precedente a checkIn', () => {
    const result = validateAccommodationForm({ ...base, checkOut: new Date('2026-07-30T00:00:00.000Z') });
    expect(result.valid).toBe(false);
    expect(result.errors.checkOut).toBeDefined();
  });

  it('rifiuta una confirmationUrl non valida', () => {
    const result = validateAccommodationForm({ ...base, confirmationUrl: 'non-un-link' });
    expect(result.valid).toBe(false);
    expect(result.errors.confirmationUrl).toBeDefined();
  });

  it('accumula più errori contemporaneamente', () => {
    const result = validateAccommodationForm({ ...base, type: '', name: '', address: '' });
    expect(Object.keys(result.errors)).toEqual(expect.arrayContaining(['type', 'name', 'address']));
  });
});
