import {
  TransportSchema,
  AccommodationSchema,
  MobilitySchema,
  TripConstraintSchema,
  TripDocumentSchema,
  TripPreferencesSchema,
  TripSetupSchema,
  HotelPolicySchema,
} from './trip-setup.model';

describe('TransportSchema', () => {
  const base = {
    id: 't1',
    mode: 'flight' as const,
    destination: 'Budapest',
    departureDate: new Date('2026-08-01T10:00:00.000Z'),
  };

  it('accetta un Transport minimo valido', () => {
    const result = TransportSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it('applica il default confirmed=false', () => {
    const result = TransportSchema.parse(base);
    expect(result.confirmed).toBe(false);
  });

  it('rifiuta un mode non nell\'enum', () => {
    const result = TransportSchema.safeParse({ ...base, mode: 'teleport' });
    expect(result.success).toBe(false);
  });

  it('rifiuta arrivalDate precedente a departureDate', () => {
    const result = TransportSchema.safeParse({
      ...base,
      arrivalDate: new Date('2026-07-31T00:00:00.000Z'),
    });
    expect(result.success).toBe(false);
  });

  it('accetta arrivalDate uguale a departureDate (volo diretto istantaneo nel modello, caso limite ammesso)', () => {
    const result = TransportSchema.safeParse({ ...base, arrivalDate: base.departureDate });
    expect(result.success).toBe(true);
  });

  it('accetta sequenceOrder opzionale per tratte multiple nello stesso giorno', () => {
    const result = TransportSchema.safeParse({ ...base, sequenceOrder: 2 });
    expect(result.success).toBe(true);
  });

  it('resta valido senza sequenceOrder (ordine dedotto da departureDate)', () => {
    const parsed = TransportSchema.parse(base);
    expect(parsed.sequenceOrder).toBeUndefined();
  });

  it('accetta notes opzionali (Transport Setup module)', () => {
    const result = TransportSchema.safeParse({ ...base, notes: 'Check-in online già effettuato' });
    expect(result.success).toBe(true);
  });

  it('resta valido senza notes', () => {
    const parsed = TransportSchema.parse(base);
    expect(parsed.notes).toBeUndefined();
  });
});

describe('AccommodationSchema', () => {
  const base = {
    id: 'a1',
    type: 'hotel' as const,
    name: 'Hotel Danubio',
    checkIn: new Date('2026-08-01T14:00:00.000Z'),
    checkOut: new Date('2026-08-05T10:00:00.000Z'),
  };

  it('accetta un Accommodation minimo valido', () => {
    expect(AccommodationSchema.safeParse(base).success).toBe(true);
  });

  it('rifiuta checkOut uguale a checkIn', () => {
    const result = AccommodationSchema.safeParse({ ...base, checkOut: base.checkIn });
    expect(result.success).toBe(false);
  });

  it('rifiuta checkOut precedente a checkIn', () => {
    const result = AccommodationSchema.safeParse({
      ...base,
      checkOut: new Date('2026-07-30T00:00:00.000Z'),
    });
    expect(result.success).toBe(false);
  });

  it('rifiuta un type non nell\'enum', () => {
    const result = AccommodationSchema.safeParse({ ...base, type: 'yacht' });
    expect(result.success).toBe(false);
  });

  it('rifiuta type assente (campo obbligatorio)', () => {
    const { type, ...withoutType } = base;
    const result = AccommodationSchema.safeParse(withoutType);
    expect(result.success).toBe(false);
  });

  it('accetta confirmationUrl opzionale se è un URL valido', () => {
    const result = AccommodationSchema.safeParse({ ...base, confirmationUrl: 'https://example.com/booking/123' });
    expect(result.success).toBe(true);
  });

  it('rifiuta confirmationUrl non valida', () => {
    const result = AccommodationSchema.safeParse({ ...base, confirmationUrl: 'non-un-url' });
    expect(result.success).toBe(false);
  });

  it('accetta notes opzionali', () => {
    const result = AccommodationSchema.safeParse({ ...base, notes: 'Chiedere piano alto' });
    expect(result.success).toBe(true);
  });

  it('resta valido senza confirmationUrl/notes', () => {
    const parsed = AccommodationSchema.parse(base);
    expect(parsed.confirmationUrl).toBeUndefined();
    expect(parsed.notes).toBeUndefined();
  });

  it('accetta hotelPolicy opzionale se valida e la serializza/deserializza correttamente', () => {
    const accWithPolicy = {
      ...base,
      hotelPolicy: {
        allowsLuggageDropoff: true,
        allowsEarlyCheckIn: true,
        allowsLateCheckout: false,
      },
    };
    const parsed = AccommodationSchema.parse(accWithPolicy);
    expect(parsed.hotelPolicy).toEqual({
      allowsLuggageDropoff: true,
      allowsEarlyCheckIn: true,
      allowsLateCheckout: false,
    });

    // Verifica serializzazione e deserializzazione roundtrip
    const serialized = JSON.stringify(parsed);
    const deserializedJson = JSON.parse(serialized);
    // Ripristino delle date prima del parse
    deserializedJson.checkIn = new Date(deserializedJson.checkIn);
    deserializedJson.checkOut = new Date(deserializedJson.checkOut);
    const deserialized = AccommodationSchema.parse(deserializedJson);
    expect(deserialized.hotelPolicy?.allowsLuggageDropoff).toBe(true);
    expect(deserialized.hotelPolicy?.allowsEarlyCheckIn).toBe(true);
    expect(deserialized.hotelPolicy?.allowsLateCheckout).toBe(false);
  });

  it('resta 100% retrocompatibile senza hotelPolicy (Accommodation salvato senza hotelPolicy continua a funzionare)', () => {
    const parsed = AccommodationSchema.parse(base);
    expect(parsed.hotelPolicy).toBeUndefined();

    // Deserializzazione vecchio formato
    const serializedOld = JSON.stringify(base);
    const deserializedOldJson = JSON.parse(serializedOld);
    deserializedOldJson.checkIn = new Date(deserializedOldJson.checkIn);
    deserializedOldJson.checkOut = new Date(deserializedOldJson.checkOut);
    const deserializedOld = AccommodationSchema.parse(deserializedOldJson);
    expect(deserializedOld.hotelPolicy).toBeUndefined();
  });
});

describe('HotelPolicySchema', () => {
  it('accetta una policy vuota (tutti i campi opzionali per non forzare la conoscenza in fase di setup)', () => {
    const result = HotelPolicySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accetta valori boolean opzionali (allowsLuggageDropoff, allowsEarlyCheckIn, allowsLateCheckout)', () => {
    const result = HotelPolicySchema.safeParse({
      allowsLuggageDropoff: true,
      allowsEarlyCheckIn: false,
      allowsLateCheckout: true,
    });
    expect(result.success).toBe(true);
  });

  it('rifiuta un tipo non boolean se presente', () => {
    const result = HotelPolicySchema.safeParse({
      allowsEarlyCheckIn: 'si',
    });
    expect(result.success).toBe(false);
  });
});

describe('MobilitySchema', () => {
  it('accetta almeno una modalità', () => {
    expect(MobilitySchema.safeParse({ modes: ['walking'] }).success).toBe(true);
  });

  it('rifiuta un array modes vuoto', () => {
    expect(MobilitySchema.safeParse({ modes: [] }).success).toBe(false);
  });

  it('rifiuta una modalità non nell\'enum', () => {
    expect(MobilitySchema.safeParse({ modes: ['teleport'] }).success).toBe(false);
  });
});

describe('TripConstraintSchema', () => {
  const base = { id: 'c1', type: 'dietary' as const, severity: 'hard' as const, description: 'Vegetariano' };

  it('accetta un vincolo valido', () => {
    expect(TripConstraintSchema.safeParse(base).success).toBe(true);
  });

  it('rifiuta un type non nell\'enum', () => {
    expect(TripConstraintSchema.safeParse({ ...base, type: 'unknown' }).success).toBe(false);
  });

  it('rifiuta una description vuota', () => {
    expect(TripConstraintSchema.safeParse({ ...base, description: '' }).success).toBe(false);
  });
});

describe('TripDocumentSchema', () => {
  it('accetta un documento valido', () => {
    const result = TripDocumentSchema.safeParse({ id: 'd1', type: 'visa', status: 'pending' });
    expect(result.success).toBe(true);
  });

  it('rifiuta uno status non nell\'enum', () => {
    const result = TripDocumentSchema.safeParse({ id: 'd1', type: 'visa', status: 'unknown' });
    expect(result.success).toBe(false);
  });
});

describe('TripPreferencesSchema', () => {
  it('accetta un oggetto vuoto (tutti i campi opzionali — dichiarazione esplicita "nessuna preferenza")', () => {
    expect(TripPreferencesSchema.safeParse({}).success).toBe(true);
  });

  it('accetta preferenze complete', () => {
    const result = TripPreferencesSchema.safeParse({
      pace: 'relaxed',
      interests: ['arte', 'cibo'],
      dietaryPreferences: ['vegetariano'],
      budgetLevel: 'medium',
    });
    expect(result.success).toBe(true);
  });
});

describe('TripSetupSchema', () => {
  const now = new Date('2026-07-10T00:00:00.000Z');

  it('accetta un TripSetup minimo (nessuna sezione ancora affrontata)', () => {
    const result = TripSetupSchema.safeParse({ tripId: 'trip-1', createdAt: now, updatedAt: now });
    expect(result.success).toBe(true);
  });

  it('preserva la distinzione undefined vs array vuoto dopo il parsing', () => {
    const parsed = TripSetupSchema.parse({
      tripId: 'trip-1',
      constraints: [],
      createdAt: now,
      updatedAt: now,
    });
    expect(parsed.constraints).toEqual([]);
    expect(parsed.transports).toBeUndefined();
  });
});
