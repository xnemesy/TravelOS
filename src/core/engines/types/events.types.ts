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
  | 'TripCreated'
  | 'TripUpdated'
  | 'TripDeleted'
  | 'ExpenseAdded'
  | 'BookingImported'
  | 'PhotoAdded'
  | 'TransportAdded'
  | 'TransportUpdated'
  | 'TransportRemoved'
  | 'AccommodationAdded'
  | 'AccommodationUpdated'
  | 'AccommodationRemoved';

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
  latitude?: number;
  longitude?: number;
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

// Transport Setup module — pubblicati da TripSetupEngine ad ogni mutazione.
// Consumer noto oggi: il listener wildcard di useTripStore (ricalcolo stats);
// consumer futuro possibile: soglia di sblocco Planner (ADR-018 §5), non
// ancora collegata (per costruzione, "no planner logic yet" in questo modulo).
export interface TransportChangedPayload {
  transportId: string;
  mode: string;
  destination: string;
}

// Accommodation Setup module — stesso ragionamento di TransportChangedPayload:
// consumer noto oggi è il listener wildcard di useTripStore.
export interface AccommodationChangedPayload {
  accommodationId: string;
  type: string;
  name: string;
}

// Sprint 15 (ADR-015 §2.6, Domain Lifecycle): pubblicati esclusivamente da
// TripLifecycleWatcher — mai da un'azione utente diretta. Vero per il solo
// passare del tempo rispetto alle date del trip, non richiesto da nessuno.
export interface TripStartedPayload {
  startedAt: string; // ISO 8601 — istante in cui la transizione è stata osservata
}

export interface TripCompletedPayload {
  completedAt: string; // ISO 8601 — istante in cui la transizione è stata osservata
}

// Pubblicato da useTripStore.deleteTrip su eliminazione esplicita dell'utente.
// Consumer noti: ContextEngine (invalida cache + subscribers del trip) e il
// listener wildcard di useTripStore (che lo ignora per evitare ricalcoli su un
// trip ormai rimosso).
export interface TripDeletedPayload {
  id: string;
}
