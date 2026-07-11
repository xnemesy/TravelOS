import { TravelContext, PlaceRef, TimelineDaySchedule, GeoLocation, TravelStyle } from './context.types';
import { TripSetup, Transport, Accommodation } from '../../../domain/trip/models/trip-setup.model';

/**
 * ============================================================================
 * CORE ENGINE INTERFACES (v2.0 - Roadmap Incrementale in 3 Fasi)
 * ============================================================================
 * FASE 1 (OGGI): ContextEngine, PlacesEngine, TimelineEngine
 * FASE 2 (EVOLUZIONE): JourneyEngine, BudgetEngine, MemoriesEngine
 * FASE 3 (MATURITÀ): DocumentsEngine, SyncEngine, NotificationEngine, AIEngine
 */

// ============================================================================
// 0. HYDRATABLE (ADR-020 — lifecycle di idratazione esplicito per Engine)
// ============================================================================
// Ogni Engine di dominio che possiede uno stato per-trip letto pigramente da
// storage persistente (MMKV) espone questo contratto. `hydrate()` garantisce
// che quella lettura sia avvenuta almeno una volta per il trip indicato —
// tipicamente delega al proprio getter pigro esistente (es. `getSavedPlaces`),
// senza introdurre un secondo percorso di caricamento. Il ContextEngine usa
// questo contratto come barriera: non compone uno stato per un trip finché
// ogni Engine registrato non ha confermato la propria idratazione.
export interface IHydratable {
  hydrate(tripId: string): Promise<void>;
}

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

  /** Forza la ricomposizione immediata dello stato per un viaggio (soggetta alla
   *  barriera di idratazione — vedi ADR-020: se il trip non è ancora 'ready',
   *  pubblica solo un placeholder e assicura che l'idratazione sia in corso). */
  recompose(tripId: string): void;

  /** Registra un provider esterno di informazioni del trip (es. dal TripStore) per evitare dipendenze circolari */
  registerTripProvider(provider: (tripId: string) => any): void;

  /** Registra il metodo di idratazione di un Engine di dominio (ADR-020). Chiamato
   *  tipicamente dal costruttore dell'Engine, stesso momento di registerStatePublisher. */
  registerHydratable(engineName: string, hydrate: (tripId: string) => Promise<void>): void;

  /** Garantisce che tutti gli Engine registrati abbiano terminato l'idratazione da
   *  storage persistente per questo trip almeno una volta. Idempotente: chiamate
   *  concorrenti/ripetute condividono la stessa idratazione in corso, nessuna
   *  doppia lettura da storage né doppia notifica ai subscriber. */
  ensureHydrated(tripId: string): Promise<void>;
}

// ============================================================================
// 2. PLACES ENGINE (Fase 1 - Catalogo Luoghi e Preferiti)
// ============================================================================
export interface IPlacesEngine extends IHydratable {
  getSavedPlaces(tripId: string): Promise<PlaceRef[]>;
  getPlaceDetails(placeId: string): Promise<PlaceRef | null>;
  savePlace(tripId: string, place: PlaceRef): Promise<void>;
  removePlace(tripId: string, placeId: string): Promise<void>;
  markAsVisited(tripId: string, placeId: string, isVisited?: boolean): Promise<void>;
  updatePlaceNotes(tripId: string, placeId: string, notes: string): Promise<void>;
}

// ============================================================================
// 2.1 TRIP SETUP ENGINE (Transport + Accommodation Setup modules — ADR-018 §7,
// adozione parziale)
// ============================================================================
// Persiste TripSetup (aggregato satellite, tripId), stesso pattern di
// IPlacesEngine (MMKV + cache in-memory + publisher reattivo verso il
// ContextEngine). Espone oggi solo le operazioni sulle sezioni `transports`
// e `accommodations` — le altre sezioni di TripSetup (mobility/constraints/
// documents/preferences) restano non adottate, per costruzione di questi
// moduli. Nessun collegamento a SetupCompletionEngine o al Planner qui.
export interface ITripSetupEngine extends IHydratable {
  getTripSetup(tripId: string): Promise<TripSetup>;
  getTransports(tripId: string): Promise<Transport[]>;
  addTransport(tripId: string, transport: Omit<Transport, 'id'>): Promise<Transport>;
  updateTransport(tripId: string, transportId: string, updates: Partial<Omit<Transport, 'id'>>): Promise<Transport>;
  removeTransport(tripId: string, transportId: string): Promise<void>;
  getAccommodations(tripId: string): Promise<Accommodation[]>;
  addAccommodation(tripId: string, accommodation: Omit<Accommodation, 'id'>): Promise<Accommodation>;
  updateAccommodation(
    tripId: string,
    accommodationId: string,
    updates: Partial<Omit<Accommodation, 'id'>>
  ): Promise<Accommodation>;
  removeAccommodation(tripId: string, accommodationId: string): Promise<void>;
}

// ============================================================================
// 3. TIMELINE ENGINE (Fase 1 - La Spina Dorsale del Viaggio: Ex Planner)
// ============================================================================
export interface ITimelineEngine extends IHydratable {
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
