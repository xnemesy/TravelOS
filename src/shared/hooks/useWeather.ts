import { useTravelContext } from './useTravelContext';
import { TravelContext } from '../../core/engines/types/context.types';

/**
 * ============================================================================
 * USE WEATHER (HOOK GRANULARE SELETTIVO)
 * ============================================================================
 * Fornisce le condizioni meteo e alert ambientali in tempo reale (Fase 2).
 */
export function useWeather(tripId: string): TravelContext['weather'] {
  const context = useTravelContext(tripId);
  return context.weather;
}
