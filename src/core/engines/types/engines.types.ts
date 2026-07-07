import { TravelContext, PlaceRef, TimelineDaySchedule, GeoLocation, TravelStyle } from './context.types';

/**
 * ============================================================================
 * CORE ENGINE INTERFACES (v2.0 - Roadmap Incrementale in 3 Fasi)
 * ============================================================================
 * FASE 1 (OGGI): ContextEngine, PlacesEngine, TimelineEngine
 * FASE 2 (EVOLUZIONE): JourneyEngine, BudgetEngine, MemoriesEngine
 * FASE 3 (MATURITÀ): DocumentsEngine, SyncEngine, NotificationEngine, AIEngine
 */

// ============================================================================
// 1. CONTEXT ENGINE (Il Compositore Reattivo)
// ============================================================================
export interface IContextEngine {
  /** Ritorna lo snapshot corrente composto in tempo reale */
  getContext(tripId: string): TravelContext;
  
  /** Sottoscrive ai cambiamenti di stato per ricalcoli reattivi nella UI */
  subscribe(tripId: string, listener: (context: TravelContext) => void): () => void;
  
  /** Registra una funzione di lettura/pubblicazione di stato da parte di un Engine di dominio */
  registerStatePublisher(engineName: string, publisher: (tripId: string) => Partial<TravelContext>): void;
  
  /** Forza la ricomposizione immediata dello stato per un viaggio */
  recompose(tripId: string): void;
}

// ============================================================================
// 2. PLACES ENGINE (Fase 1 - Catalogo Luoghi e Preferiti)
// ============================================================================
export interface IPlacesEngine {
  getSavedPlaces(tripId: string): Promise<PlaceRef[]>;
  getPlaceDetails(placeId: string): Promise<PlaceRef | null>;
  savePlace(tripId: string, place: PlaceRef): Promise<void>;
  removePlace(tripId: string, placeId: string): Promise<void>;
  markAsVisited(tripId: string, placeId: string, isVisited?: boolean): Promise<void>;
  updatePlaceNotes(tripId: string, placeId: string, notes: string): Promise<void>;
}

// ============================================================================
// 3. TIMELINE ENGINE (Fase 1 - La Spina Dorsale del Viaggio: Ex Planner)
// ============================================================================
export interface ITimelineEngine {
  /** Genera e restituisce la timeline completa suddivisa per giorni */
  getTripTimeline(tripId: string): Promise<TimelineDaySchedule[]>;
  
  /** Restituisce la programmazione per un giorno specifico */
  getDaySchedule(tripId: string, dayNumber: number): Promise<TimelineDaySchedule | null>;
  
  /** Aggiunge una tappa a una giornata della timeline */
  addPlaceToDay(tripId: string, dayNumber: number, place: PlaceRef): Promise<void>;
  
  /** Rimuove una tappa dalla timeline */
  removePlaceFromDay(tripId: string, dayNumber: number, placeId: string): Promise<void>;
  
  /** Assegna un luogo reale a uno slot generico (Smart Slot Filling) */
  assignPlaceToTimelineSlot(tripId: string, dayNumber: number, slotId: string, place: PlaceRef): Promise<void>;
  
  /** Riordina le tappe all'interno di una giornata e ricalcola le distanze/tempi */
  reorderDayTimeline(tripId: string, dayNumber: number, orderedPlaceIds: string[]): Promise<void>;

  /** Ottimizza giornata: distribuisce automaticamente i luoghi non assegnati nella timeline */
  autoScheduleUnassignedPlaces(tripId: string, unassignedPlaces: PlaceRef[], style?: TravelStyle): Promise<void>;

  /** Ottimizza la sequenza delle tappe in una giornata specifica */
  optimizeDayTimeline(tripId: string, dayNumber: number, style?: TravelStyle): Promise<void>;
}

// ============================================================================
// FASE 2 & FASE 3: CONTRACTS PER I FUTURI ENGINE
// ============================================================================

export interface IJourneyEngine {
  startTracking(tripId: string): Promise<void>;
  stopTracking(): void;
  getCurrentLocation(): GeoLocation | null;
}

export interface IBudgetEngine {
  getDailySummary(tripId: string, dayNumber: number): Promise<{ spent: number; remaining: number; currency: string }>;
  recordExpense(tripId: string, expense: Record<string, unknown>): Promise<void>;
}

export interface IMemoriesEngine {
  captureMoment(tripId: string, payload: Record<string, unknown>): Promise<void>;
  generateDailyRecap(tripId: string, dayNumber: number): Promise<unknown>;
}

export interface IDocumentsEngine {
  getUpcomingBookings(tripId: string): Promise<unknown[]>;
}

export interface ISyncEngine {
  syncPendingChanges(): Promise<void>;
  isOnline(): boolean;
}

export interface INotificationEngine {
  scheduleAlert(title: string, message: string, triggerTime: string): Promise<void>;
}

export interface IAIEngine {
  analyzeContextAndSuggest(context: TravelContext): Promise<unknown[]>;
}
