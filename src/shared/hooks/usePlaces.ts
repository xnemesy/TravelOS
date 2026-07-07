import { useTravelContext } from './useTravelContext';
import { PlaceRef } from '../../core/engines/types/context.types';

export interface PlacesSlice {
  savedPlaces: PlaceRef[];
  visitedPlaces: PlaceRef[];
  savedPlacesCount: number;
  visitedPlacesCount: number;
  nearbyPlacesOfInterest: PlaceRef[];
  unassignedPlaces: PlaceRef[];
}

/**
 * ============================================================================
 * USE PLACES (HOOK GRANULARE SELETTIVO - EX PLACE STORE)
 * ============================================================================
 * Fornisce accesso al catalogo luoghi del viaggio, luoghi salvati, visitati e
 * luoghi non ancora assegnati alla timeline (per la Libreria del viaggio).
 */
export function usePlaces(tripId: string | string[]): PlacesSlice {
  const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
  const context = useTravelContext(cleanTripId);

  // Trova i luoghi già assegnati a una giornata della timeline
  const assignedPlaceIds = new Set(
    context.timeline.days.flatMap((day) => day.places.map((p) => p.id))
  );

  const savedPlaces = context.savedPlaces || [];
  const visitedPlaces = context.visitedPlaces || [];
  
  const unassignedPlaces = savedPlaces.filter(
    (p) => !assignedPlaceIds.has(p.id)
  );

  return {
    savedPlaces,
    visitedPlaces,
    savedPlacesCount: context.savedPlacesCount || savedPlaces.length,
    visitedPlacesCount: context.visitedPlacesCount || visitedPlaces.length,
    nearbyPlacesOfInterest: context.nearbyPlacesOfInterest || [],
    unassignedPlaces,
  };
}
