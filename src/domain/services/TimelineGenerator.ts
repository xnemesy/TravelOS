import { 
  PlaceRef, 
  TimelineDaySchedule, 
  JourneySuggestion, 
  JourneyStatus, 
  DailyHealth, 
  JourneyQuality, 
  FreeTimeSlot 
} from '../../core/engines/types/context.types';
import { journeyComposer } from './JourneyComposer';

/**
 * @deprecated Sostituito da JourneyComposerService (v2.1). 
 * Mantenuto per retrocompatibilità come adapter verso l'istanza singleton journeyComposer.
 */
export class TimelineGenerator {
  /**
   * @deprecated Usa journeyComposer.generateDaySchedule
   */
  public static generateDaySchedule(
    dayNumber: number,
    dateStr: string,
    places: PlaceRef[]
  ): TimelineDaySchedule {
    return journeyComposer.generateDaySchedule(dayNumber, dateStr, places);
  }

  /**
   * @deprecated Usa journeyComposer.reorderDaySchedule
   */
  public static reorderDaySchedule(
    currentSchedule: TimelineDaySchedule,
    orderedPlaceIds: string[]
  ): TimelineDaySchedule {
    return journeyComposer.reorderDaySchedule(currentSchedule, orderedPlaceIds);
  }

  /**
   * @deprecated Usa journeyComposer.composeDayJourney
   */
  public static async optimizeDayRoute(currentSchedule: TimelineDaySchedule, profileId: string = 'culture'): Promise<TimelineDaySchedule> {
    return await journeyComposer.composeDayJourney(currentSchedule, profileId);
  }

  /**
   * @deprecated Usa journeyComposer.composeDayJourneyWithSIP
   */
  public static async optimizeDayRouteWithSIP(
    currentSchedule: TimelineDaySchedule,
    profileId: string = 'culture'
  ): Promise<TimelineDaySchedule> {
    return journeyComposer.composeDayJourneyWithSIP(currentSchedule, profileId);
  }

  /**
   * @deprecated Usa journeyComposer.calculateRuntimeStatus
   */
  public static calculateRuntimeStatus(
    schedule: TimelineDaySchedule,
    currentTimeMinutes?: number
  ): JourneyStatus {
    return journeyComposer.calculateRuntimeStatus(schedule, currentTimeMinutes);
  }

  /**
   * @deprecated Usa journeyComposer.calculateRuntimeHealth
   */
  public static calculateRuntimeHealth(schedule: TimelineDaySchedule): DailyHealth {
    return journeyComposer.calculateRuntimeHealth(schedule);
  }

  /**
   * @deprecated Usa journeyComposer.calculateJourneyQuality
   */
  public static calculateJourneyQuality(schedule: TimelineDaySchedule): JourneyQuality {
    return journeyComposer.calculateJourneyQuality(schedule);
  }

  /**
   * @deprecated Usa journeyComposer.detectFreeTimeSlots
   */
  public static detectFreeTimeSlots(places: PlaceRef[]): FreeTimeSlot[] {
    return journeyComposer.detectFreeTimeSlots(places);
  }

  /**
   * @deprecated Usa journeyComposer.generateSmartSuggestions
   */
  public static generateSmartSuggestions(
    schedule: TimelineDaySchedule,
    health: DailyHealth,
    status?: JourneyStatus
  ): JourneySuggestion[] {
    return journeyComposer.generateSmartSuggestions(schedule, health, status);
  }

  /**
   * @deprecated Usa journeyComposer.calculateAvailableMinutes
   */
  public static calculateAvailableMinutes(totalAwakeMinutes = 720, scheduledMinutes: number): number {
    return journeyComposer.calculateAvailableMinutes(totalAwakeMinutes, scheduledMinutes);
  }
}

