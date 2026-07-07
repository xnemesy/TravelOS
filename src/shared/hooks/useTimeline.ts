import { useTravelContext } from './useTravelContext';
import { TimelineDaySchedule } from '../../core/engines/types/context.types';

export interface TimelineSlice {
  days: TimelineDaySchedule[];
  totalDays: number;
  currentDay: number | null;
  currentDayNumber: number | null;
  startDate: string;
  endDate: string;
}

/**
 * ============================================================================
 * USE TIMELINE (HOOK GRANULARE SELETTIVO - EX PLANNER)
 * ============================================================================
 * Restituisce la spina dorsale di viaggio (la timeline delle giornate e tappe).
 */
export function useTimeline(tripId: string | string[]): TimelineSlice {
  const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
  const context = useTravelContext(cleanTripId);

  return {
    days: context.timeline.days,
    totalDays: context.totalDays,
    currentDay: context.currentDay,
    currentDayNumber: context.currentDay,
    startDate: context.startDate,
    endDate: context.endDate,
  };
}
