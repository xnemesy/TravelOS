import { PlaceRef } from '../../../core/engines/types/context.types';
import { DailyWeatherSummary } from '../../providers/travel-providers.types';

export interface TimelineContext {
  currentTimeMinutes: number;
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
