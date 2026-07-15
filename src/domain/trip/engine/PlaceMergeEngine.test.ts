import { PlaceMergeEngine } from './PlaceMergeEngine';

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

