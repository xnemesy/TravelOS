import { PlaceMergeEngine } from './PlaceMergeEngine';
import { TravelPlace } from '../models/place.model';
import { PlaceMetadata } from '../../providers/travel-providers.types';

describe('PlaceMergeEngine.calculateDistanceMeters', () => {
  it('returns 0 for identical coordinates', () => {
    expect(PlaceMergeEngine.calculateDistanceMeters(41.8902, 12.4922, 41.8902, 12.4922)).toBe(0);
  });

  it('increases as coordinates diverge', () => {
    const near = PlaceMergeEngine.calculateDistanceMeters(41.8902, 12.4922, 41.89029, 12.4922);
    const far = PlaceMergeEngine.calculateDistanceMeters(41.8902, 12.4922, 41.8907, 12.4922);
    expect(far).toBeGreaterThan(near);
  });
});

describe('PlaceMergeEngine.calculateNameSimilarity', () => {
  it('returns 100 for identical names regardless of case/accents', () => {
    expect(PlaceMergeEngine.calculateNameSimilarity('Colosseo', 'colosseo')).toBe(100);
    expect(PlaceMergeEngine.calculateNameSimilarity('Café Budapest', 'Cafe Budapest')).toBe(100);
  });

  it('returns 0 when either name is empty after normalization', () => {
    expect(PlaceMergeEngine.calculateNameSimilarity('', 'Colosseo')).toBe(0);
    expect(PlaceMergeEngine.calculateNameSimilarity('!!!', 'Colosseo')).toBe(0);
  });

  it('scores a substring match at least 92 (inclusion rule)', () => {
    const similarity = PlaceMergeEngine.calculateNameSimilarity('New York Cafe', 'New York Cafe Budapest');
    expect(similarity).toBeGreaterThanOrEqual(92);
  });

  it('scores unrelated names low', () => {
    const similarity = PlaceMergeEngine.calculateNameSimilarity('Pantheon', 'Colosseo');
    expect(similarity).toBeLessThan(50);
  });
});

describe('PlaceMergeEngine.isSamePlace', () => {
  const base = { name: 'Colosseo', lat: 41.8902, lon: 12.4922 };

  it('merges when close in distance (~10m) and name matches', () => {
    const candidate = { name: 'Colosseo', lat: 41.89029, lon: 12.4922 };
    expect(PlaceMergeEngine.isSamePlace(base, candidate)).toBe(true);
  });

  it('does NOT merge when far apart (~55m) even with identical name', () => {
    const candidate = { name: 'Colosseo', lat: 41.8907, lon: 12.4922 };
    expect(PlaceMergeEngine.isSamePlace(base, candidate)).toBe(false);
  });

  it('does NOT merge when close in distance but names are unrelated', () => {
    const candidate = { name: 'Pantheon', lat: 41.89029, lon: 12.4922 };
    expect(PlaceMergeEngine.isSamePlace(base, candidate)).toBe(false);
  });

  it('is conservative: refuses to merge when coordinates are missing', () => {
    const candidate = { name: 'Colosseo' };
    expect(PlaceMergeEngine.isSamePlace(base, candidate)).toBe(false);
  });

  it('accepts the nested coordinates.lat/lng shape too', () => {
    const a = { name: 'Colosseo', coordinates: { lat: 41.8902, lng: 12.4922 } };
    const b = { name: 'Colosseo', coordinates: { lat: 41.89029, lng: 12.4922 } };
    expect(PlaceMergeEngine.isSamePlace(a, b)).toBe(true);
  });
});

// ADR-017 Fase 1: test di regressione per mergePlace (assenti prima di questa sessione,
// scritti per pinnare il comportamento prima dell'estrazione di externalFromMetadata)
// e test per il nuovo punto unico di conversione mergeFromProvider.
describe('PlaceMergeEngine.mergePlace', () => {
  const existing: TravelPlace = {
    id: 'place-1',
    tripId: 'trip-1',
    externalProviderId: 'ext-1',
    baseData: {
      providerId: 'ext-1',
      name: 'Colosseo',
      category: 'landmark',
      rating: 4.5,
    },
    editorial: { whyVisit: 'Storia millenaria' },
    memories: { personalRating: 5, isFavorite: true },
    priority: 'must_see',
    status: 'to_visit',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const incomingMetadata: PlaceMetadata = {
    placeId: 'ext-1',
    name: 'Colosseo (aggiornato)',
    category: 'landmark',
    lat: 41.8902,
    lon: 12.4922,
    rating: 4.8,
    formattedAddress: 'Piazza del Colosseo, Roma',
  };

  it('aggiorna solo il livello External, preservando Editorial e Personal intatti', () => {
    const merged = PlaceMergeEngine.mergePlace(existing, incomingMetadata);

    expect(merged.baseData.name).toBe('Colosseo (aggiornato)');
    expect(merged.baseData.rating).toBe(4.8);
    expect(merged.baseData.location?.coordinates).toEqual({ lat: 41.8902, lng: 12.4922 });
    expect(merged.editorial).toEqual(existing.editorial);
    expect(merged.memories).toEqual(existing.memories);
  });

  it('non scrive più il campo deprecato `external` (regressione dopo il refactor di ADR-017 Fase 1)', () => {
    const merged = PlaceMergeEngine.mergePlace(existing, incomingMetadata);
    expect((merged as Record<string, unknown>).external).toBeUndefined();
  });

  it('accetta anche un ExternalPlace diretto, non solo PlaceMetadata', () => {
    const merged = PlaceMergeEngine.mergePlace(existing, {
      ...existing.baseData,
      name: 'Colosseo (via ExternalPlace)',
    });
    expect(merged.baseData.name).toBe('Colosseo (via ExternalPlace)');
  });
});

describe('PlaceMergeEngine.mergeFromProvider', () => {
  const incomingMetadata: PlaceMetadata = {
    placeId: 'ext-42',
    name: 'Fontana di Trevi',
    category: 'landmark',
    lat: 41.9009,
    lon: 12.4833,
    rating: 4.7,
  };

  it('crea un nuovo TravelPlace valido quando non esiste un luogo preesistente', () => {
    const place = PlaceMergeEngine.mergeFromProvider(incomingMetadata, { tripId: 'trip-9' });

    expect(place.tripId).toBe('trip-9');
    expect(place.baseData.name).toBe('Fontana di Trevi');
    expect(place.editorial).toBeUndefined();
    expect(place.memories).toBeUndefined();
    expect(place.priority).toBe('recommended'); // default dello schema
    expect(place.status).toBe('to_visit'); // default dello schema
  });

  it('genera un id interno indipendente da externalProviderId (regressione: le due identità non devono mai coincidere)', () => {
    const place = PlaceMergeEngine.mergeFromProvider(incomingMetadata, { tripId: 'trip-9' });

    expect(place.externalProviderId).toBe('ext-42');
    expect(place.id).not.toBe('ext-42');
    expect(place.id).not.toBe(place.externalProviderId);
  });

  it('genera id distinti per due creazioni successive dello stesso luogo provider (niente collisione tra trip diversi)', () => {
    const placeInTripA = PlaceMergeEngine.mergeFromProvider(incomingMetadata, { tripId: 'trip-a' });
    const placeInTripB = PlaceMergeEngine.mergeFromProvider(incomingMetadata, { tripId: 'trip-b' });

    expect(placeInTripA.id).not.toBe(placeInTripB.id);
    expect(placeInTripA.externalProviderId).toBe(placeInTripB.externalProviderId); // stesso luogo fisico
  });

  it('delega a mergePlace quando un luogo esistente viene passato in options.existing', () => {
    const existing = PlaceMergeEngine.mergeFromProvider(incomingMetadata, { tripId: 'trip-9' });
    const updated = PlaceMergeEngine.mergeFromProvider(
      { ...incomingMetadata, name: 'Fontana di Trevi (rinnovata)' },
      { tripId: 'trip-9', existing }
    );

    expect(updated.id).toBe(existing.id);
    expect(updated.baseData.name).toBe('Fontana di Trevi (rinnovata)');
  });

  it('rifiuta un existing il cui tripId non corrisponde a options.tripId', () => {
    const existing = PlaceMergeEngine.mergeFromProvider(incomingMetadata, { tripId: 'trip-9' });

    expect(() =>
      PlaceMergeEngine.mergeFromProvider(incomingMetadata, { tripId: 'trip-diverso', existing })
    ).toThrow(/tripId incoerente/);
  });

  it('popola il livello Editorial solo se esplicitamente fornito nelle options', () => {
    const place = PlaceMergeEngine.mergeFromProvider(incomingMetadata, {
      tripId: 'trip-9',
      editorial: { whyVisit: 'Getta una moneta per tornare a Roma' },
    });
    expect(place.editorial?.whyVisit).toBe('Getta una moneta per tornare a Roma');
  });
});
