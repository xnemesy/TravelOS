import { Transport, Accommodation } from '../../../domain/trip/models/trip-setup.model';

/**
 * ============================================================================
 * CONTEXT TYPES & TRAVEL CONTEXT (v2.0)
 * ============================================================================
 * Il TravelContext rappresenta la singola fonte di verità reattiva composta
 * dal Context Engine unendo gli stati pubblicati dai singoli Engine.
 */

export type TripPhase = 'inspiration' | 'planning' | 'planned' | 'ongoing' | 'completed';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type EngineSource = 'timeline' | 'places' | 'journey' | 'budget' | 'documents' | 'memories' | 'sync';
export type TravelStyle = string;

/**
 * Stato di idratazione da storage persistente (MMKV) per un trip (ADR-020).
 * 'idle': nessuna idratazione mai iniziata per questo trip in questa sessione.
 * 'hydrating': idratazione in corso — il ContextEngine non ha ancora composto
 * uno stato completo, i campi derivati dagli Engine (savedPlaces/timeline/
 * transports/accommodations) sono ai loro default onesti, non dati reali.
 * 'ready': tutti gli Engine registrati hanno terminato la lettura da storage
 * persistente almeno una volta — lo stato composto riflette la verità.
 */
export type HydrationStatus = 'idle' | 'hydrating' | 'ready';


export interface OptimizationProfile {
  travelStyle: string;
  weights: Record<string, number>;
  preferredStartTime: string;
  preferredEndTime?: string;
  mealStrategy: string;
  walkingTolerance: number; // in meters
}

export type PlaceRole = 
  | 'hero_experience' 
  | 'secondary'       
  | 'quick_stop'      
  | 'food'            
  | 'coffee'          
  | 'viewpoint'       
  | 'relax'           
  | 'shopping'        
  | 'transfer'        
  | 'anchor'          
  | 'free_time';

export type AnchorType = 'HARD' | 'SOFT';

/**
 * JOURNEY ANCHORS — punti strutturali immutabili del viaggio (redesign
 * JourneyComposer). Derivati da Transport/Accommodation (TripSetup, ADR-018),
 * mai dal Planner: delimitano i confini reali di arrivo/partenza che nessuna
 * attività può attraversare. 'activities' non genera mai un proprio blocco:
 * rappresenta lo spazio libero tra gli anchor, riempito dal loop esistente
 * del JourneyComposer.
 */
export type JourneyAnchorKind =
  | 'arrival_flight'
  | 'arrival_airport'
  | 'transfer'
  | 'check_in'
  | 'activities'
  | 'check_out'
  | 'departure_transfer'
  | 'departure_airport'
  | 'departure_flight';

export interface JourneyAnchor {
  id: string;
  kind: JourneyAnchorKind;
  label: string;
  date: string; // YYYY-MM-DD — giorno della timeline su cui ricade l'istante
  startISO: string; // Istante reale di inizio (ISO 8601), mai ricalcolato dal Composer
  endISO: string; // Istante reale di fine (ISO 8601), mai ricalcolato dal Composer
  coordinates?: GeoLocation;
  sourceType: 'transport' | 'accommodation' | 'derived';
  sourceId?: string; // Transport.id o Accommodation.id di provenienza, se applicabile
}

export type ExperienceDensity = 'very_relaxed' | 'relaxed' | 'balanced' | 'busy' | 'intense';

export interface MealTimeWindow {
  startMinutes: number;
  endMinutes: number;
}

export interface MealWindowsConfig {
  breakfast: MealTimeWindow;
  lunch: MealTimeWindow;
  dinner: MealTimeWindow;
}

export interface JourneyConstraints {
  maxWalkingKm: number;
  maxExperiences: number;
  targetOccupancy: number; // es. 0.75 (75% del tempo sveglio)
  lunchRequired: boolean;
  dinnerRequired: boolean;
  freeTimeRequired: boolean;
  preferredEndTime?: string;
  mealWindows?: MealWindowsConfig;
}

export interface JourneyDecision {
  placeId: string;
  placeName: string;
  reason: string;
  confidence: number; // 0.0 - 1.0
  alternatives?: string[];
}

export interface JourneyReport {
  statusLabel: string; // es. "La giornata è equilibrata"
  stars: number; // 1-5
  walkingKm: number;
  freeTimeMinutes: number;
  heroPlaceName?: string;
  bestMoment?: string;
  criticalPoint?: string;
  density: ExperienceDensity;
  decisions: JourneyDecision[];
  beforeDistance: number;
  afterDistance: number;
  savedDistanceKm: number;
}

export type JourneyStatusType = 'ahead' | 'on_time' | 'slight_delay' | 'heavy_delay';

export interface JourneyStatus {
  status: JourneyStatusType;
  label: string;
  differenceMinutes: number;
  color: string;
  icon: string;
}

export interface DailyHealth {
  status: 'balanced' | 'intense' | 'tiring' | 'relaxing';
  label: string;
  score: number;
  plannedHours: number;
  walkingKm: number;
  breaksCount: number;
  missingBreaksCount: number;
  outdoorCount: number;
  indoorCount: number;
  insights: string[];
}

export interface JourneyQuality {
  score: number;
  label: string;
  stars: number;
  reasons: string[];
}

export interface FreeTimeSlot {
  id: string;
  afterPlaceId: string;
  beforePlaceId: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  coordinates?: GeoLocation;
  context?: string;
}

export interface JourneySuggestion {
  id: string;
  type: string;
  severity: 'info' | 'suggestion' | 'important' | 'critical' | 'success';
  title: string;
  description: string;
  reason?: string;
  relatedPlaceId?: string;
  action?: {
    type: 'add_break' | 'move_place' | 'remove_place' | 'open_map' | 'mark_completed';
    label: string;
    payload?: Record<string, unknown>;
  };
}

export interface JourneyConflict {
  id: string;
  type: string;
  severity: 'warning' | 'error';
  message: string;
  placeId?: string;
}

export type OptimizationEventType = 
  | 'REDUCED_WALKING' 
  | 'INSERTED_LUNCH' 
  | 'INSERTED_DINNER' 
  | 'MOVED_SUNSET' 
  | 'BALANCED_ENERGY' 
  | 'REORDERED_LOGICALLY' 
  | 'RESOLVED_CONFLICTS';

export interface OptimizationEvent {
  type: OptimizationEventType;
  delta?: number;
  placeId?: string;
}

export interface OptimizationReport {
  beforeDistance: number;
  afterDistance: number;
  savedWalkingMinutes: number;
  savedDistanceKm: number;
  reorderedStops: number;
  insertedMeals: number;
  conflictsSolved: number;
  quality: JourneyQuality;
  events: OptimizationEvent[];
}

export interface TravelAlert {
  id: string;
  engineSource: EngineSource;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: string; // ISO 8601
  actionableUrl?: string; // Deep link es. "/trip/123/wallet"
  metadata?: Record<string, unknown>;
}

export interface SuggestedAction {
  id: string;
  type: 'reorder_timeline' | 'book_restaurant' | 'reduce_spending' | 'add_rain_backup' | 'leave_now';
  title: string;
  reasoning: string;
  impactRating: number; // 1-10
  autoApplyPayload?: {
    targetEngine: string;
    actionName: string;
    parameters: Record<string, unknown>;
  };
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracyMeters?: number;
}

export interface PlaceRef {
  id: string;
  name: string;
  category: string; // 'breakfast' | 'lunch' | 'dinner' | 'sunset' | 'drinks' | 'walk' | 'visit' | 'landmark' | 'museum' | 'hotel' | 'restaurant'
  coordinates?: GeoLocation;
  phone?: string;
  website?: string;
  bookingUrl?: string;
  ticketUrl?: string;
  coverImageUrl?: string;
  address?: string;
  rating?: number;
  priority?: 'must_see' | 'recommended' | 'optional';
  scheduledTime?: string; // ISO 8601, Orario fisso se prenotato
  calculatedStartTime?: string; // Es. "09:00"
  calculatedEndTime?: string; // Es. "10:30"
  durationMinutes?: number;
  recommendedTime?: 'morning' | 'afternoon' | 'evening' | 'any'; // Metadato per Journey Composer
  energyLevel?: 'low' | 'medium' | 'high'; // Livello di energia richiesto
  idealTimeWindows?: {start: string, end: string}[]; // Finestre orarie preferite
  weatherPreference?: 'outdoor' | 'indoor' | 'rain_friendly' | 'sunny' | 'golden_hour';
  distanceMeters?: number;
  estimatedWalkMinutes?: number;
  isBlock?: boolean; // Se true, è un blocco generato (es. Colazione) e non un luogo salvato
  isVisited?: boolean;
  isLocked?: boolean; // Se true, l'utente l'ha posizionato manualmente via Drag & Drop, non va rimosso dall'algoritmo
  notes?: string;
  warnings?: string[]; // Avvisi o allerte generate dai provider SIP (es. Chiuso, Allerta meteo)
  role?: PlaceRole;
  anchorType?: AnchorType;
  journeyAnchorKind?: JourneyAnchorKind; // Presente solo sui blocchi generati da JourneyAnchorEngine
  decision?: JourneyDecision;
  freeTimePurpose?: string; // Scopo contestuale per gli slot di tempo libero
}

export type ResolvedPlaceSource = 
  | "saved" 
  | "google" 
  | "editorial" 
  | "osm" 
  | "apple" 
  | "mock";

export interface ResolvedPlace {
  place: PlaceRef;        // The canonical projection for the UI
  isTransient: boolean;   // True if it hasn't been saved to the trip
  source: ResolvedPlaceSource; 
}

export interface TimelineDaySchedule {
  dayNumber: number;
  date: string; // YYYY-MM-DD
  places: PlaceRef[];
  totalWalkDistanceMeters: number;
  totalEstimatedDurationMinutes: number;
  suggestions?: JourneySuggestion[];
  conflicts?: JourneyConflict[];
  optimizationReport?: OptimizationReport;
  journeyReport?: JourneyReport;
  density?: ExperienceDensity;
  theme?: string; // Titolo generato (Identità della Giornata)
  mood?: 'relaxed' | 'balanced' | 'intense' | 'photography' | 'gastronomic' | 'culture' | 'express' | 'family';
  anchors?: JourneyAnchor[]; // Journey Anchors del viaggio rilevanti per questa giornata (arrivo/partenza)
  overview: {
    experiencesCount: number;
    startTime: string;
    endTime: string;
    foodStopsCount: number;
  };
}

/**
 * TRAVEL CONTEXT (Lo snapshot reattivo composto dal Context Engine)
 */
export interface TravelContext {
  // Metadati di Viaggio
  tripId: string;
  userId: string;
  tripTitle?: string;
  destination?: string;
  tripPhase: TripPhase;
  // Stato di idratazione da MMKV (ADR-020) — 'ready' garantisce che savedPlaces/
  // timeline/transports/accommodations riflettano storage persistente, non i
  // default vuoti mostrati durante 'idle'/'hydrating'.
  hydrationStatus: HydrationStatus;
  currentDay: number | null; // es. 2 per "Giorno 2"
  totalDays: number;
  startDate: string; // ISO Date
  endDate: string; // ISO Date
  journeyScore: number; // 0-100
  journeyStatusLabel: string; // es. "Pronto al 72%"
  journeyQualityLabel?: string; // es. "★★★★★ Ottimamente bilanciato"
  journeyStatus?: JourneyStatus;
  dailyHealth?: DailyHealth;
  journeyQuality?: JourneyQuality;
  currentSuggestion?: JourneySuggestion;

  // Timeline & Programmazione (da TimelineEngine e PlacesEngine)
  timeline: {
    days: TimelineDaySchedule[];
    currentOrNextPlace: PlaceRef | null;
    upcomingPlacesToday: PlaceRef[];
    timeAvailableMinutesToday: number;
  };

  // Luoghi e Prossimità (da PlacesEngine)
  savedPlaces: PlaceRef[];
  visitedPlaces: PlaceRef[];
  savedPlacesCount: number;
  visitedPlacesCount: number;
  nearbyPlacesOfInterest: PlaceRef[];

  // Trasporti e alloggi di setup (da TripSetupEngine, Transport/Accommodation
  // Setup module) — slice dei soli sotto-insiemi `transports`/`accommodations`
  // di TripSetup (ADR-018 §3.7); le altre sezioni (mobility/constraints/
  // documents/preferences) non sono ancora adottate.
  transports: Transport[];
  transportsCount: number;
  accommodations: Accommodation[];
  accommodationsCount: number;

  // Meteo e Ambiente (da JourneyEngine - Fase 2)
  weather: {
    condition: 'sunny' | 'rainy' | 'cloudy' | 'stormy' | 'snowy';
    temperatureCelsius: number;
    rainProbabilityPercent: number;
    alertMessage?: string;
  } | null;

  // Finanza (da BudgetEngine - Fase 2)
  budgetStatus: {
    totalBudget: number;
    spentTotal: number;
    spentToday: number;
    remainingToday: number;
    currency: string;
    isOverBudget: boolean;
  } | null;

  // Scadenze e Prenotazioni (da DocumentsEngine - Fase 3)
  nextBooking: {
    documentId: string;
    title: string;
    type: 'flight' | 'hotel' | 'train' | 'activity' | 'rental';
    startTime: string; // ISO Date
    confirmationCode?: string;
  } | null;

  // Sintesi e Notifiche (da tutti gli Engine)
  alerts: TravelAlert[];
  suggestedActions: SuggestedAction[];
  
  // Sincronizzazione e Stato Rete
  isOffline: boolean;
  lastUpdated: string; // ISO Date
}
