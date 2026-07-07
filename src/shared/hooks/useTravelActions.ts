import { placesEngine, timelineEngine } from '../../core/engines';
import { PlaceRef } from '../../core/engines/types/context.types';

export interface TravelActions {
  savePlace: (tripId: string, place: PlaceRef) => Promise<void>;
  removePlace: (tripId: string, placeId: string) => Promise<void>;
  markAsVisited: (tripId: string, placeId: string, isVisited?: boolean) => Promise<void>;
  updatePlaceNotes: (tripId: string, placeId: string, notes: string) => Promise<void>;
  assignPlaceToDay: (tripId: string, dayNumber: number | undefined, place: PlaceRef) => Promise<void>;
  removePlaceFromDay: (tripId: string, dayNumber: number, placeId: string) => Promise<void>;
  movePlaceUp: (placeId: string, tripId: string, dayNumber: number) => Promise<void>;
  movePlaceDown: (placeId: string, tripId: string, dayNumber: number) => Promise<void>;
}

/**
 * ============================================================================
 * USE TRAVEL ACTIONS (HOOK COMANDI DI DOMINIO)
 * ============================================================================
 * Incapsula l'invio dei comandi verso i motori della Fase 1 (Places & Timeline).
 * Garantisce il totale disaccoppiamento del View Layer da Store e Repository.
 */
export function useTravelActions(): TravelActions {
  const savePlace = async (tripId: string | string[], place: PlaceRef) => {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    await placesEngine.savePlace(cleanTripId, place);
  };

  const removePlace = async (tripId: string | string[], placeId: string | string[]) => {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const cleanPlaceId = Array.isArray(placeId) ? placeId[0] : String(placeId || '');
    
    // Rimuovi esplicitamente il luogo da qualsiasi giorno della timeline prima di eliminarlo
    const timeline = await timelineEngine.getTripTimeline(cleanTripId);
    for (const day of timeline) {
      if (day.places.some((p) => p.id === cleanPlaceId)) {
        await timelineEngine.removePlaceFromDay(cleanTripId, day.dayNumber, cleanPlaceId);
      }
    }

    await placesEngine.removePlace(cleanTripId, cleanPlaceId);
  };

  const markAsVisited = async (tripId: string | string[], placeId: string | string[], isVisited: boolean = true) => {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const cleanPlaceId = Array.isArray(placeId) ? placeId[0] : String(placeId || '');
    await placesEngine.markAsVisited(cleanTripId, cleanPlaceId, isVisited);
  };

  const updatePlaceNotes = async (tripId: string | string[], placeId: string | string[], notes: string) => {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const cleanPlaceId = Array.isArray(placeId) ? placeId[0] : String(placeId || '');
    await placesEngine.updatePlaceNotes(cleanTripId, cleanPlaceId, notes);
  };

  const assignPlaceToDay = async (tripId: string | string[], dayNumber: number | undefined, place: PlaceRef) => {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    
    // Rimuovi sempre il luogo da qualsiasi giorno in cui si trova attualmente
    const timeline = await timelineEngine.getTripTimeline(cleanTripId);
    for (const day of timeline) {
      if (day.places.some((p) => p.id === place.id)) {
        await timelineEngine.removePlaceFromDay(cleanTripId, day.dayNumber, place.id);
      }
    }

    if (dayNumber !== undefined) {
      await timelineEngine.addPlaceToDay(cleanTripId, dayNumber, place);
    }
  };

  const removePlaceFromDay = async (tripId: string | string[], dayNumber: number, placeId: string | string[]) => {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const cleanPlaceId = Array.isArray(placeId) ? placeId[0] : String(placeId || '');
    await timelineEngine.removePlaceFromDay(cleanTripId, dayNumber, cleanPlaceId);
    await placesEngine.removePlace(cleanTripId, cleanPlaceId);
  };

  const movePlaceUp = async (placeId: string | string[], tripId: string | string[], dayNumber: number) => {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const cleanPlaceId = Array.isArray(placeId) ? placeId[0] : String(placeId || '');
    const day = await timelineEngine.getDaySchedule(cleanTripId, dayNumber);
    if (!day) return;
    const idx = day.places.findIndex((p) => p.id === cleanPlaceId);
    if (idx > 0) {
      const newOrder = [...day.places];
      const temp = newOrder[idx - 1];
      newOrder[idx - 1] = newOrder[idx];
      newOrder[idx] = temp;
      await timelineEngine.reorderDayTimeline(
        cleanTripId,
        dayNumber,
        newOrder.map((p) => p.id)
      );
    }
  };

  const movePlaceDown = async (placeId: string | string[], tripId: string | string[], dayNumber: number) => {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const cleanPlaceId = Array.isArray(placeId) ? placeId[0] : String(placeId || '');
    const day = await timelineEngine.getDaySchedule(cleanTripId, dayNumber);
    if (!day) return;
    const idx = day.places.findIndex((p) => p.id === cleanPlaceId);
    if (idx !== -1 && idx < day.places.length - 1) {
      const newOrder = [...day.places];
      const temp = newOrder[idx + 1];
      newOrder[idx + 1] = newOrder[idx];
      newOrder[idx] = temp;
      await timelineEngine.reorderDayTimeline(
        cleanTripId,
        dayNumber,
        newOrder.map((p) => p.id)
      );
    }
  };

  return {
    savePlace,
    removePlace,
    markAsVisited,
    updatePlaceNotes,
    assignPlaceToDay,
    removePlaceFromDay,
    movePlaceUp,
    movePlaceDown,
  };
}
