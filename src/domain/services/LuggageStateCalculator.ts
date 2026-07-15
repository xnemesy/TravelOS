import { JourneyAnchor, JourneyAnchorKind, LuggageState } from '../../core/engines/types/context.types';

export interface LuggageTransition {
  anchorKind: JourneyAnchorKind;
  phase: 'start' | 'end';
  nextState: LuggageState;
  priority: number; // Order when timestamps are identical (1 = lowest/first, 3 = highest/last)
}

// Declarative transition table
export const LUGGAGE_TRANSITIONS: LuggageTransition[] = [
  // Gaining luggage (Priority 1)
  { anchorKind: 'arrival_flight', phase: 'end', nextState: 'WITH_LUGGAGE', priority: 1 },
  { anchorKind: 'arrival_airport', phase: 'end', nextState: 'WITH_LUGGAGE', priority: 1 },
  { anchorKind: 'check_out', phase: 'start', nextState: 'WITH_LUGGAGE', priority: 1 },
  { anchorKind: 'luggage_pickup', phase: 'end', nextState: 'WITH_LUGGAGE', priority: 1 },

  // Storing luggage (Priority 2)
  { anchorKind: 'luggage_dropoff', phase: 'start', nextState: 'STORED', priority: 2 },

  // Disposing / checking-in luggage (Priority 3)
  { anchorKind: 'check_in', phase: 'start', nextState: 'NONE', priority: 3 },
  { anchorKind: 'departure_airport', phase: 'start', nextState: 'NONE', priority: 3 },
  { anchorKind: 'departure_flight', phase: 'start', nextState: 'NONE', priority: 3 },
];

interface TimelineEvent {
  timestampMs: number;
  nextState: LuggageState;
  priority: number;
}

export class LuggageStateCalculator {
  /**
   * Builds a query function to determine the traveler's luggage state at any
   * given minutesSinceMidnight on the specified dateStr (YYYY-MM-DD).
   */
  public static buildLuggageStateQuery(
    anchors: JourneyAnchor[],
    dateStr: string
  ): (minutesSinceMidnight: number) => LuggageState {
    const dayStartMs = new Date(`${dateStr}T00:00:00.000Z`).getTime();

    // 1. Generate transition events from anchors
    const events: TimelineEvent[] = [];

    for (const anchor of anchors) {
      // Find matches in the transition table
      const startMatches = LUGGAGE_TRANSITIONS.filter(
        (t) => t.anchorKind === anchor.kind && t.phase === 'start'
      );
      const endMatches = LUGGAGE_TRANSITIONS.filter(
        (t) => t.anchorKind === anchor.kind && t.phase === 'end'
      );

      const startMs = new Date(anchor.startISO).getTime();
      const endMs = new Date(anchor.endISO).getTime();

      for (const match of startMatches) {
        events.push({
          timestampMs: startMs,
          nextState: match.nextState,
          priority: match.priority,
        });
      }

      for (const match of endMatches) {
        events.push({
          timestampMs: endMs,
          nextState: match.nextState,
          priority: match.priority,
        });
      }
    }

    // 2. Sort events chronologically, resolving simultaneous events using transition priority
    events.sort((a, b) => {
      if (a.timestampMs !== b.timestampMs) {
        return a.timestampMs - b.timestampMs;
      }
      return a.priority - b.priority;
    });

    // 3. Return the query function
    return (minutesSinceMidnight: number): LuggageState => {
      const targetTimeMs = dayStartMs + minutesSinceMidnight * 60000;

      // Find the last event that occurred before or exactly at the target time
      let activeState: LuggageState = 'NONE';
      for (const event of events) {
        if (event.timestampMs <= targetTimeMs) {
          activeState = event.nextState;
        } else {
          break;
        }
      }

      return activeState;
    };
  }
}
