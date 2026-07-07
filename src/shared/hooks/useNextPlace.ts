import { useTravelContext } from './useTravelContext';
import { PlaceRef } from '../../core/engines/types/context.types';

export interface NextPlaceSlice {
  currentOrNextPlace: PlaceRef | null;
  upcomingPlacesToday: PlaceRef[];
  timeAvailableMinutesToday: number;
}

/**
 * ============================================================================
 * USE NEXT PLACE (HOOK GRANULARE SELETTIVO)
 * ============================================================================
 * Seleziona unicamente le informazioni relative alla prossima tappa e tempo
 * disponibile, evitando re-render inutili quando cambiano altre parti del contesto.
 */
export function useNextPlace(tripId: string | string[]): NextPlaceSlice {
  const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
  const context = useTravelContext(cleanTripId);

  return {
    currentOrNextPlace: context.timeline.currentOrNextPlace,
    upcomingPlacesToday: context.timeline.upcomingPlacesToday,
    timeAvailableMinutesToday: context.timeline.timeAvailableMinutesToday,
  };
}
