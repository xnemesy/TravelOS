import { JourneyAnchor } from '../../core/engines/types/context.types';
import { LuggageStateCalculator } from './LuggageStateCalculator';

describe('LuggageStateCalculator', () => {
  const buildAnchor = (overrides: Partial<JourneyAnchor>): JourneyAnchor => ({
    id: 'anchor-id',
    kind: 'activities',
    label: 'Test Anchor',
    date: '2026-08-01',
    startISO: '2026-08-01T00:00:00.000Z',
    endISO: '2026-08-01T00:00:00.000Z',
    sourceType: 'derived',
    ...overrides,
  });

  it('defaults to NONE when no anchors are provided', () => {
    const query = LuggageStateCalculator.buildLuggageStateQuery([], '2026-08-01');
    expect(query(0)).toBe('NONE');
    expect(query(600)).toBe('NONE');
    expect(query(1440)).toBe('NONE');
  });

  it('calculates states correctly for standard chronological flow (Arrival -> Dropoff -> Check-in)', () => {
    const anchors: JourneyAnchor[] = [
      buildAnchor({
        kind: 'arrival_flight',
        startISO: '2026-08-01T08:00:00.000Z',
        endISO: '2026-08-01T09:00:00.000Z',
      }),
      buildAnchor({
        kind: 'luggage_dropoff',
        startISO: '2026-08-01T10:00:00.000Z',
        endISO: '2026-08-01T10:15:00.000Z',
      }),
      buildAnchor({
        kind: 'check_in',
        startISO: '2026-08-01T15:00:00.000Z',
        endISO: '2026-08-01T15:30:00.000Z',
      }),
    ];

    const query = LuggageStateCalculator.buildLuggageStateQuery(anchors, '2026-08-01');

    // Before flight ends
    expect(query(480)).toBe('NONE'); // 08:00 -> NONE
    expect(query(539)).toBe('NONE'); // 08:59 -> NONE

    // After flight ends but before dropoff
    expect(query(540)).toBe('WITH_LUGGAGE'); // 09:00 -> WITH_LUGGAGE
    expect(query(599)).toBe('WITH_LUGGAGE'); // 09:59 -> WITH_LUGGAGE

    // After dropoff starts but before checkin
    expect(query(600)).toBe('STORED'); // 10:00 -> STORED
    expect(query(899)).toBe('STORED'); // 14:59 -> STORED

    // After checkin starts
    expect(query(900)).toBe('NONE'); // 15:00 -> NONE
    expect(query(1200)).toBe('NONE'); // 20:00 -> NONE
  });

  it('resolves simultaneous anchors using priority rules', () => {
    // Case A: checkout starts and dropoff starts at the exact same time
    const anchorsA: JourneyAnchor[] = [
      buildAnchor({
        kind: 'check_out',
        startISO: '2026-08-01T09:00:00.000Z',
        endISO: '2026-08-01T09:15:00.000Z',
      }),
      buildAnchor({
        kind: 'luggage_dropoff',
        startISO: '2026-08-01T09:00:00.000Z',
        endISO: '2026-08-01T09:15:00.000Z',
      }),
    ];

    const queryA = LuggageStateCalculator.buildLuggageStateQuery(anchorsA, '2026-08-01');
    expect(queryA(539)).toBe('NONE');
    // Dropoff starts (Priority 2) wins over checkout starts (Priority 1) -> STORED
    expect(queryA(540)).toBe('STORED');

    // Case B: flight ends and check_in starts at the exact same time
    const anchorsB: JourneyAnchor[] = [
      buildAnchor({
        kind: 'arrival_flight',
        startISO: '2026-08-01T08:00:00.000Z',
        endISO: '2026-08-01T09:00:00.000Z',
      }),
      buildAnchor({
        kind: 'check_in',
        startISO: '2026-08-01T09:00:00.000Z',
        endISO: '2026-08-01T09:30:00.000Z',
      }),
    ];

    const queryB = LuggageStateCalculator.buildLuggageStateQuery(anchorsB, '2026-08-01');
    // Checkin starts (Priority 3) wins over flight ends (Priority 1) -> NONE
    expect(queryB(540)).toBe('NONE');
  });

  it('guarantees continuity when anchors cross midnight (Day 1 -> Day 2)', () => {
    const anchors: JourneyAnchor[] = [
      buildAnchor({
        kind: 'arrival_flight',
        startISO: '2026-08-01T23:30:00.000Z',
        endISO: '2026-08-01T23:45:00.000Z',
      }),
      buildAnchor({
        kind: 'luggage_dropoff',
        startISO: '2026-08-01T23:50:00.000Z',
        endISO: '2026-08-02T00:05:00.000Z',
      }),
      buildAnchor({
        kind: 'check_in',
        startISO: '2026-08-02T00:10:00.000Z',
        endISO: '2026-08-02T00:30:00.000Z',
      }),
    ];

    // Day 1 Query
    const queryDay1 = LuggageStateCalculator.buildLuggageStateQuery(anchors, '2026-08-01');
    expect(queryDay1(1420)).toBe('NONE'); // 23:40 -> WITH_LUGGAGE (since flight ends at 23:45) is not true yet. At 23:40 flight is running, so it is NONE.
    expect(queryDay1(1426)).toBe('WITH_LUGGAGE'); // 23:46 -> WITH_LUGGAGE
    expect(queryDay1(1430)).toBe('STORED'); // 23:50 -> STORED

    // Day 2 Query
    const queryDay2 = LuggageStateCalculator.buildLuggageStateQuery(anchors, '2026-08-02');
    expect(queryDay2(5)).toBe('STORED'); // 00:05 -> STORED
    expect(queryDay2(10)).toBe('NONE'); // 00:10 -> NONE
  });

  it('supports continuity on middle days of the trip', () => {
    const anchors: JourneyAnchor[] = [
      buildAnchor({
        kind: 'arrival_flight',
        startISO: '2026-08-01T10:00:00.000Z',
        endISO: '2026-08-01T11:00:00.000Z',
      }),
      buildAnchor({
        kind: 'check_in',
        startISO: '2026-08-01T12:00:00.000Z',
        endISO: '2026-08-01T12:30:00.000Z',
      }),
      buildAnchor({
        kind: 'check_out',
        startISO: '2026-08-03T10:00:00.000Z',
        endISO: '2026-08-03T10:15:00.000Z',
      }),
    ];

    // Day 2 has no anchors at all: should remain NONE throughout the day
    const queryDay2 = LuggageStateCalculator.buildLuggageStateQuery(anchors, '2026-08-02');
    expect(queryDay2(0)).toBe('NONE');
    expect(queryDay2(720)).toBe('NONE');
    expect(queryDay2(1440)).toBe('NONE');
  });
});
