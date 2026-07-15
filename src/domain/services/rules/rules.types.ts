import { PlaceRef, MealTimeWindow, MealWindowsConfig } from '../../../core/engines/types/context.types';
import { DailyWeatherSummary } from '../../providers/travel-providers.types';

export { MealTimeWindow, MealWindowsConfig };

export const DEFAULT_MEAL_WINDOWS: MealWindowsConfig = {
  breakfast: { startMinutes: 6 * 60, endMinutes: 10 * 60 + 30 }, // 06:00 - 10:30
  lunch: { startMinutes: 11 * 60 + 30, endMinutes: 15 * 60 },     // 11:30 - 15:00
  dinner: { startMinutes: 18 * 60, endMinutes: 22 * 60 },          // 18:00 - 22:00
};

export interface TimelineContext {
  currentTimeMinutes: number;
  effectiveDayEnd?: number;
  mealWindows?: MealWindowsConfig;
  currentPlace: PlaceRef | null;
  weather: DailyWeatherSummary | null;
  energyLevel: 'low' | 'medium' | 'high';
  transportationMode: 'walking' | 'driving';
  date: string;
  tripId: string;
  userPreferences?: {
    pace?: 'relaxed' | 'normal' | 'intense';
    preferredStartTime?: string;
    preferredEndTime?: string;
    customDurations?: Record<string, number>; // User Override
  };
  placedIds: Set<string>;
}

export interface RuleResult {
  scoreDelta: number;
  reject: boolean;
  delayMinutes?: number;
  overrideVisitDuration?: number;
  insertEvent?: {
    type: 'breakfast' | 'lunch' | 'dinner' | 'coffee' | 'free_time';
    durationMinutes: number;
    name: string;
  };
  explanation?: string;
}

export interface ITimelineRule {
  name: string;
  evaluate(candidate: PlaceRef, context: TimelineContext): Promise<RuleResult> | RuleResult;
}

export interface PlanningReport {
  totalScore: number;
  rejectedBy: string[];
  explanations: string[];
  insertedEvents: string[];
  warnings: string[];
}
