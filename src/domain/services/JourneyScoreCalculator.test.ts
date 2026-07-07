import { JourneyScoreCalculator, JourneyScoreDayInput } from './JourneyScoreCalculator';

function day(overrides: Partial<JourneyScoreDayInput> = {}): JourneyScoreDayInput {
  return {
    nonBlockPlacesCount: 0,
    totalPlacesCount: 0,
    conflictsCount: 0,
    foodStopsCount: 0,
    totalWalkDistanceMeters: 0,
    ...overrides,
  };
}

describe('JourneyScoreCalculator.calculate — baseline', () => {
  it('scores 0 with no saved places and no days', () => {
    const result = JourneyScoreCalculator.calculate({ savedPlacesCount: 0, days: [] });
    expect(result.score).toBe(0);
    expect(result.statusLabel).toBe('Pronto al 0%');
  });

  it('caps the score at 100 for a fully-optimized single day', () => {
    const result = JourneyScoreCalculator.calculate({
      savedPlacesCount: 2,
      days: [
        day({
          nonBlockPlacesCount: 2,
          totalPlacesCount: 2,
          conflictsCount: 0,
          foodStopsCount: 2,
          totalWalkDistanceMeters: 1000,
        }),
      ],
    });
    expect(result.score).toBe(100);
    expect(result.statusLabel).toBe('Pronto al 100%');
  });
});

describe('JourneyScoreCalculator.calculate — preexisting edge case (documented, not fixed)', () => {
  it('produces NaN when there are saved places but zero days (0/0 division), matching current app behavior', () => {
    const result = JourneyScoreCalculator.calculate({ savedPlacesCount: 1, days: [] });
    expect(Number.isNaN(result.score)).toBe(true);
    expect(result.statusLabel).toBe('Pronto al NaN%');
  });
});

describe('JourneyScoreCalculator.calculate — planning ratio', () => {
  it('scores partial planning ratio and rounds the sub-score', () => {
    // 2 of 4 saved places scheduled -> ratio 0.5 -> planningScore 20+10=30
    const result = JourneyScoreCalculator.calculate({
      savedPlacesCount: 4,
      days: [day({ nonBlockPlacesCount: 2, totalPlacesCount: 2 })],
    });
    // planning 30 + balance 20 + conflict 20 (0 conflicts, places scheduled) + food 0 + walking 20 (0m) = 90
    expect(result.score).toBe(90);
  });

  it('aggregates nonBlockPlacesCount and conflicts/meals/walk across multiple days', () => {
    const result = JourneyScoreCalculator.calculate({
      savedPlacesCount: 6,
      days: [
        day({ nonBlockPlacesCount: 2, totalPlacesCount: 3, conflictsCount: 1, foodStopsCount: 1, totalWalkDistanceMeters: 2000 }),
        day({ nonBlockPlacesCount: 1, totalPlacesCount: 2, conflictsCount: 0, foodStopsCount: 1, totalWalkDistanceMeters: 3000 }),
      ],
    });
    // planning 20+10=30, balance 20 (2/2 days organized), conflict 10 (1 conflict, <3),
    // food 10 (2 meals >= 2 days, but < 4), walking 20 (5000m < 2*5000)
    expect(result.score).toBe(90);
  });
});

describe('JourneyScoreCalculator.calculate — conflict thresholds', () => {
  const baseline = {
    savedPlacesCount: 10,
    dayOverrides: { nonBlockPlacesCount: 1, totalPlacesCount: 1, foodStopsCount: 0, totalWalkDistanceMeters: 999999 },
  };

  it('awards 20 when there are zero conflicts', () => {
    const result = JourneyScoreCalculator.calculate({
      savedPlacesCount: baseline.savedPlacesCount,
      days: [day({ ...baseline.dayOverrides, conflictsCount: 0 })],
    });
    expect(result.score).toBe(62);
  });

  it('awards 10 when conflicts are below 3', () => {
    const one = JourneyScoreCalculator.calculate({
      savedPlacesCount: baseline.savedPlacesCount,
      days: [day({ ...baseline.dayOverrides, conflictsCount: 1 })],
    });
    const two = JourneyScoreCalculator.calculate({
      savedPlacesCount: baseline.savedPlacesCount,
      days: [day({ ...baseline.dayOverrides, conflictsCount: 2 })],
    });
    expect(one.score).toBe(52);
    expect(two.score).toBe(52);
  });

  it('awards 0 once conflicts reach 3 or more', () => {
    const result = JourneyScoreCalculator.calculate({
      savedPlacesCount: baseline.savedPlacesCount,
      days: [day({ ...baseline.dayOverrides, conflictsCount: 3 })],
    });
    expect(result.score).toBe(42);
  });
});

describe('JourneyScoreCalculator.calculate — food stop thresholds', () => {
  const dayOverrides = { nonBlockPlacesCount: 1, totalPlacesCount: 1, conflictsCount: 0, totalWalkDistanceMeters: 999999 };

  it('awards 0 with no meal stops', () => {
    const result = JourneyScoreCalculator.calculate({
      savedPlacesCount: 10,
      days: [day({ ...dayOverrides, foodStopsCount: 0 })],
    });
    expect(result.score).toBe(62);
  });

  it('awards 10 with at least one meal stop per organized day', () => {
    const result = JourneyScoreCalculator.calculate({
      savedPlacesCount: 10,
      days: [day({ ...dayOverrides, foodStopsCount: 1 })],
    });
    expect(result.score).toBe(72);
  });

  it('awards 20 with at least two meal stops per organized day', () => {
    const result = JourneyScoreCalculator.calculate({
      savedPlacesCount: 10,
      days: [day({ ...dayOverrides, foodStopsCount: 2 })],
    });
    expect(result.score).toBe(82);
  });
});

describe('JourneyScoreCalculator.calculate — walking distance thresholds', () => {
  const dayOverrides = { nonBlockPlacesCount: 1, totalPlacesCount: 1, conflictsCount: 0, foodStopsCount: 0 };

  it('awards 20 under 5km/day', () => {
    const result = JourneyScoreCalculator.calculate({
      savedPlacesCount: 10,
      days: [day({ ...dayOverrides, totalWalkDistanceMeters: 4999 })],
    });
    expect(result.score).toBe(82);
  });

  it('awards 10 between 5km and 10km/day (5000 itself is NOT under threshold)', () => {
    const result = JourneyScoreCalculator.calculate({
      savedPlacesCount: 10,
      days: [day({ ...dayOverrides, totalWalkDistanceMeters: 5000 })],
    });
    expect(result.score).toBe(72);
  });

  it('awards 0 at or above 10km/day', () => {
    const result = JourneyScoreCalculator.calculate({
      savedPlacesCount: 10,
      days: [day({ ...dayOverrides, totalWalkDistanceMeters: 10000 })],
    });
    expect(result.score).toBe(62);
  });
});
