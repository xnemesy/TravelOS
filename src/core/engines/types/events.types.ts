/**
 * ============================================================================
 * DOMAIN FACTS (EVENTS TYPES)
 * ============================================================================
 * REGOLA ARCHITETTURALE:
 * L'Event Bus accetta ESCLUSIVAMENTE eventi di dominio ad alto impatto (Domain Facts).
 * NON emettere MAI eventi UI (es. TitleChanged, CardOpened, SearchFocused).
 */

export type DomainFactType =
  | 'PlaceSaved'
  | 'PlaceVisited'
  | 'PlaceRemoved'
  | 'PlaceNotesUpdated'
  | 'TimelineReordered'
  | 'TimelinePlaceAdded'
  | 'TimelinePlaceRemoved'
  | 'TimelineSlotFilled'
  | 'TimelineOptimized'
  | 'TimelineGenerated'
  | 'TimelineAutoScheduled'
  | 'TripStarted'
  | 'TripCompleted'
  | 'ExpenseAdded'
  | 'BookingImported'
  | 'PhotoAdded';

export interface DomainEvent<T = Record<string, unknown>> {
  id: string;
  type: DomainFactType;
  timestamp: string; // ISO 8601 string
  tripId: string;
  payload: T;
}

// Payloads specifici per autocompletamento e type-safety
export interface PlaceSavedPayload {
  placeId: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
}

export interface PlaceVisitedPayload {
  placeId: string;
  isVisited: boolean;
  visitedAt: string; // ISO 8601
}

// Payload condiviso da tutti i fatti Timeline* che descrivono lo stato di una giornata
// dopo la modifica (aggiunta, rimozione, riordino, ottimizzazione, generazione, auto-schedule).
export interface TimelineChangePayload {
  dayNumber: number;
  orderedPlaceIds: string[];
}

/** @deprecated Alias di compatibilità: usa TimelineChangePayload. */
export type TimelineReorderedPayload = TimelineChangePayload;

export interface ExpenseAddedPayload {
  expenseId: string;
  amount: number;
  currency: string;
  category: string;
}
