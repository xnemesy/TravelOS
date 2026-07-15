import { canonicalPlaceToPlaceRef } from './CanonicalPlaceToPlaceRef';
import { TravelPlaceSchema, TravelPlace } from '../../../domain/trip/models/place.model';

function buildTravelPlace(overrides: Partial<TravelPlace> = {}): TravelPlace {
  const now = new Date();
  const defaultBaseData = {
    providerId: 'provider-place-1',
    name: 'Colosseo',
    category: 'landmark' as const,
    coverImageUrl: 'https://example.com/colosseo.jpg',
    rating: 4.7,
    location: {
      address: 'Piazza del Colosseo, 1, Roma',
      coordinates: { lat: 41.8902, lng: 12.4922 },
    },
  };

  const baseData = overrides.baseData
    ? {
        ...defaultBaseData,
        ...overrides.baseData,
        location: 'location' in overrides.baseData ? overrides.baseData.location : defaultBaseData.location,
      }
    : defaultBaseData;

  return TravelPlaceSchema.parse({
    id: 'place-1',
    tripId: 'trip-1',
    externalProviderId: 'provider-place-1',
    priority: 'must_see',
    createdAt: now,
    updatedAt: now,
    ...overrides,
    baseData,
  });
}

describe('canonicalPlaceToPlaceRef', () => {
  it('maps the read-oriented subset from baseData/priority', () => {
    const place = buildTravelPlace();
    const ref = canonicalPlaceToPlaceRef(place);

    expect(ref).toEqual({
      id: 'place-1',
      name: 'Colosseo',
      category: 'landmark',
      coordinates: { latitude: 41.8902, longitude: 12.4922 },
      coverImageUrl: 'https://example.com/colosseo.jpg',
      address: 'Piazza del Colosseo, 1, Roma',
      rating: 4.7,
      priority: 'must_see',
      durationMinutes: 60,
      isVisited: false,
      notes: undefined,
    });
  });

  it('derives durationMinutes/isVisited/notes from TravelPlace when present', () => {
    const place = buildTravelPlace({
      averageVisitDurationMinutes: 45,
      memories: { checkInStatus: 'completed', isFavorite: false },
      notes: [
        { id: '1', source: 'personal', content: 'Prima nota', createdAt: new Date() },
        { id: '2', source: 'personal', content: 'Seconda nota', createdAt: new Date() },
      ],
    });

    const ref = canonicalPlaceToPlaceRef(place);
    expect(ref.durationMinutes).toBe(45);
    expect(ref.isVisited).toBe(true);
    expect(ref.notes).toBe('Prima nota\nSeconda nota');
  });

  it('throws when baseData has no coordinates (invariant violation)', () => {
    const place = buildTravelPlace({
      baseData: {
        providerId: 'provider-place-1',
        name: 'Colosseo',
        category: 'landmark',
        location: undefined,
      } as unknown as TravelPlace['baseData'],
    });

    expect(() => canonicalPlaceToPlaceRef(place)).toThrow(/non ha coordinate/);
  });

  it('merges schedulingContext fields without touching the canonical subset', () => {
    const place = buildTravelPlace();
    const ref = canonicalPlaceToPlaceRef(place, {
      scheduledTime: '2026-08-01T09:00:00.000Z',
      calculatedStartTime: '09:00',
      calculatedEndTime: '10:30',
      isLocked: true,
      distanceMeters: 120,
    });

    expect(ref.scheduledTime).toBe('2026-08-01T09:00:00.000Z');
    expect(ref.calculatedStartTime).toBe('09:00');
    expect(ref.calculatedEndTime).toBe('10:30');
    expect(ref.isLocked).toBe(true);
    expect(ref.distanceMeters).toBe(120);
    // il sottoinsieme canonico non cambia in presenza di scheduling context
    expect(ref.id).toBe('place-1');
    expect(ref.name).toBe('Colosseo');
  });

  it('defaults to an empty schedulingContext when omitted', () => {
    const place = buildTravelPlace();
    const ref = canonicalPlaceToPlaceRef(place);

    expect(ref.scheduledTime).toBeUndefined();
    expect(ref.isLocked).toBeUndefined();
  });

  it('preserves role, anchorType, scheduledTime, and contact info from TravelPlace when present', () => {
    const scheduledDate = new Date('2026-08-01T14:30:00.000Z');
    const place = buildTravelPlace({
      role: 'hero_experience',
      anchorType: 'HARD',
      scheduledTime: scheduledDate,
      baseData: {
        providerId: 'provider-place-1',
        name: 'Colosseo',
        category: 'landmark',
        contact: {
          phone: '+39 06 3996 7700',
          website: 'https://colosseo.it',
        },
      },
      bookingUrl: 'https://tickets.colosseo.it',
    });

    const ref = canonicalPlaceToPlaceRef(place);
    expect(ref.role).toBe('hero_experience');
    expect(ref.anchorType).toBe('HARD');
    expect(ref.scheduledTime).toBe('2026-08-01T14:30:00.000Z');
    expect(ref.phone).toBe('+39 06 3996 7700');
    expect(ref.website).toBe('https://colosseo.it');
    expect(ref.bookingUrl).toBe('https://tickets.colosseo.it');
  });
});
