import { TravelPlace } from '../models/place.model';

export type ValidationWarningType = 'closing_time' | 'long_distance' | 'overstuffed_day';

export interface PlannerValidationWarning {
  id: string;
  type: ValidationWarningType;
  placeId?: string;
  placeName?: string;
  title: string;
  message: string;
  suggestion?: string;
}

export interface TimelineItem {
  id: string;
  place: TravelPlace;
  orderIndex: number;
  estimatedStartTime: Date;
  estimatedEndTime: Date;
  // Tragitto verso la tappa successiva (se esiste)
  nextTravelMinutes?: number;
  nextDistanceKm?: number;
}

export interface DayTimelineSummary {
  dayNumber: number;
  items: TimelineItem[];
  totalPlacesCount: number;
  totalVisitDurationMinutes: number;
  totalTravelMinutes: number;
  totalDistanceKm: number;
  warnings: PlannerValidationWarning[];
}
