import { DistanceCalculator } from './DistanceCalculator';

describe('DistanceCalculator.calculateHaversineDistance', () => {
  it('returns 0 for identical coordinates', () => {
    const point = { latitude: 41.8902, longitude: 12.4922 };
    expect(DistanceCalculator.calculateHaversineDistance(point, point)).toBe(0);
  });

  it('is symmetric regardless of argument order', () => {
    const a = { latitude: 41.8902, longitude: 12.4922 };
    const b = { latitude: 48.8606, longitude: 2.3376 };
    expect(DistanceCalculator.calculateHaversineDistance(a, b)).toBe(
      DistanceCalculator.calculateHaversineDistance(b, a)
    );
  });

  it('computes ~111.2km for one degree of latitude at the equator', () => {
    const a = { latitude: 0, longitude: 0 };
    const b = { latitude: 1, longitude: 0 };
    const distance = DistanceCalculator.calculateHaversineDistance(a, b);
    expect(distance).toBeGreaterThan(111000);
    expect(distance).toBeLessThan(111400);
  });
});

describe('DistanceCalculator.estimateWalkingDurationMinutes', () => {
  it('returns 0 for zero or negative distance', () => {
    expect(DistanceCalculator.estimateWalkingDurationMinutes(0)).toBe(0);
    expect(DistanceCalculator.estimateWalkingDurationMinutes(-50)).toBe(0);
  });

  it('scales with distance at the default walking speed', () => {
    const shorter = DistanceCalculator.estimateWalkingDurationMinutes(500);
    const longer = DistanceCalculator.estimateWalkingDurationMinutes(2000);
    expect(longer).toBeGreaterThan(shorter);
  });
});

describe('DistanceCalculator.estimateDrivingDurationMinutes', () => {
  it('returns 0 for zero or negative distance', () => {
    expect(DistanceCalculator.estimateDrivingDurationMinutes(0)).toBe(0);
  });

  it('is faster than walking for the same distance', () => {
    const distanceMeters = 5000;
    const walking = DistanceCalculator.estimateWalkingDurationMinutes(distanceMeters);
    const driving = DistanceCalculator.estimateDrivingDurationMinutes(distanceMeters);
    expect(driving).toBeLessThan(walking);
  });
});

describe('DistanceCalculator.calculateRouteMetrics', () => {
  it('returns zero for an empty or single-point route', () => {
    expect(DistanceCalculator.calculateRouteMetrics([]).totalDistanceMeters).toBe(0);
    expect(
      DistanceCalculator.calculateRouteMetrics([{ latitude: 0, longitude: 0 }]).totalDistanceMeters
    ).toBe(0);
  });

  it('sums the haversine distance across sequential legs', () => {
    const a = { latitude: 41.8902, longitude: 12.4922 }; // Colosseo
    const b = { latitude: 41.8986, longitude: 12.4769 }; // Pantheon (approx)
    const c = { latitude: 41.9028, longitude: 12.4964 }; // Piazza del Popolo (approx)

    const legAB = DistanceCalculator.calculateHaversineDistance(a, b);
    const legBC = DistanceCalculator.calculateHaversineDistance(b, c);

    const result = DistanceCalculator.calculateRouteMetrics([a, b, c]);
    expect(result.totalDistanceMeters).toBe(legAB + legBC);
    expect(result.totalWalkMinutes).toBe(
      DistanceCalculator.estimateWalkingDurationMinutes(legAB + legBC)
    );
  });
});
