import { TravelContext } from '../types/context.types';
import { IContextEngine } from '../types/engines.types';
import { eventBus } from '../../events/event-bus';
import { TimelineGenerator } from '../../../domain/services/TimelineGenerator';
import { TravelServices } from '../../../domain/providers/TravelServices';
import { JourneyScoreCalculator } from '../../../domain/services/JourneyScoreCalculator';


/**
 * ============================================================================
 * CONTEXT ENGINE (COMPOSITORE REATTIVO)
 * ============================================================================
 * REGOLA ARCHITETTURALE:
 * Il Context Engine NON deve conoscere i dettagli interni né interrogare di continuo
 * gli altri motori. Ogni Engine pubblica il proprio stato; il Context Engine compone.
 * Mai interrogazioni continue o polling!
 */
export class ContextEngine implements IContextEngine {
  private publishers: Map<string, (tripId: string) => Partial<TravelContext>> = new Map();
  private subscribers: Map<string, Set<(context: TravelContext) => void>> = new Map();
  private cachedContexts: Map<string, TravelContext> = new Map();

  constructor() {
    // Sottoscrizione al Domain Event Bus per ricomporre reattivamente lo stato
    // quando accade un fatto di dominio rilevante
    eventBus.subscribe('*', (event) => {
      if (event.tripId) {
        this.recompose(event.tripId);
      }
    });
  }

  /**
   * Registra un publisher di stato da parte di un Engine di dominio.
   */
  public registerStatePublisher(engineName: string, publisher: (tripId: string) => Partial<TravelContext>): void {
    this.publishers.set(engineName, publisher);
  }

  /**
   * Restituisce lo snapshot reattivo corrente per un viaggio.
   * Se non è nella cache, lo compone istantaneamente.
   */
  public getContext(tripId: string): TravelContext {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    if (!this.cachedContexts.has(cleanTripId)) {
      this.recompose(cleanTripId);
    }
    return this.cachedContexts.get(cleanTripId)!;
  }

  /**
   * Sottoscrive un listener per aggiornamenti reattivi (utilizzato dagli Hook del View Layer).
   */
  public subscribe(tripId: string, listener: (context: TravelContext) => void): () => void {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    if (!this.subscribers.has(cleanTripId)) {
      this.subscribers.set(cleanTripId, new Set());
    }

    const tripSubscribers = this.subscribers.get(cleanTripId)!;
    tripSubscribers.add(listener);

    // Invia immediatamente lo stato corrente alla sottoscrizione
    listener(this.getContext(cleanTripId));

    return () => {
      tripSubscribers.delete(listener);
      if (tripSubscribers.size === 0) {
        this.subscribers.delete(cleanTripId);
      }
    };
  }

  /**
   * Compone lo stato interrogando i publisher registrati dagli Engine e notifica la UI.
   */
  public recompose(tripId: string): void {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    // Oggetto di base con valori di default puliti
    let tripTitle = 'Viaggio in programma';
    let destination = 'Destinazione';
    if (cleanTripId === 'trip-budapest-2026') {
      tripTitle = 'Weekend a Budapest';
      destination = 'Budapest, Ungheria';
    } else if (cleanTripId === 'trip-kyoto-2026') {
      tripTitle = 'Autunno in Giappone';
      destination = 'Kyoto, Giappone';
    } else if (cleanTripId === 'trip-amalfi-2027') {
      tripTitle = 'Primavera in Costiera';
      destination = 'Costiera Amalfitana';
    }

    let composed: TravelContext = {
      tripId: cleanTripId,
      userId: 'user-default-123',
      tripTitle,
      destination,
      tripPhase: 'planned',
      currentDay: 1,
      totalDays: 5,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
      journeyScore: 0,
      journeyStatusLabel: 'Planning...',
      timeline: {
        days: [],
        currentOrNextPlace: null,
        upcomingPlacesToday: [],
        timeAvailableMinutesToday: 720,
      },
      savedPlaces: [],
      visitedPlaces: [],
      savedPlacesCount: 0,
      visitedPlacesCount: 0,
      nearbyPlacesOfInterest: [],
      weather: null,
      budgetStatus: null,
      nextBooking: null,
      alerts: [],
      suggestedActions: [],
      isOffline: false,
      lastUpdated: new Date().toISOString(),
    };

    // Compone unendo le slice di stato pubblicate dai motori (Places, Timeline, ecc.)
    for (const [_, publisher] of this.publishers) {
      try {
        const slice = publisher(cleanTripId);
        composed = { ...composed, ...slice };
      } catch (error) {
        console.error(`[ContextEngine] Error composing slice for trip ${cleanTripId}:`, error);
      }
    }

    // Calcolo del Journey Score 2.0 (Normalizzato 0-100) — delegato al Domain Service puro
    const journeyScoreResult = JourneyScoreCalculator.calculate({
      savedPlacesCount: composed.savedPlaces.length,
      days: composed.timeline.days.map((day) => ({
        nonBlockPlacesCount: day.places.filter((p) => !p.isBlock).length,
        totalPlacesCount: day.places.length,
        conflictsCount: day.conflicts?.length || 0,
        foodStopsCount: day.overview.foodStopsCount,
        totalWalkDistanceMeters: day.totalWalkDistanceMeters,
      })),
    });
    composed.journeyScore = journeyScoreResult.score;
    composed.journeyStatusLabel = journeyScoreResult.statusLabel;

    // Journey Quality & Runtime Derived Data (Sprint 6)
    const activeDaySchedule = composed.timeline.days.find(d => d.dayNumber === (composed.currentDay || 1)) || composed.timeline.days[0];
    if (activeDaySchedule) {
      const journeyStatus = TimelineGenerator.calculateRuntimeStatus(activeDaySchedule);
      const dailyHealth = TimelineGenerator.calculateRuntimeHealth(activeDaySchedule);
      const journeyQuality = TimelineGenerator.calculateJourneyQuality(activeDaySchedule);
      const suggestions = TimelineGenerator.generateSmartSuggestions(activeDaySchedule, dailyHealth, journeyStatus);
      const currentSuggestion = suggestions.length > 0 ? suggestions[0] : undefined;

      composed.journeyStatus = journeyStatus;
      composed.dailyHealth = dailyHealth;
      composed.journeyQuality = journeyQuality;
      composed.currentSuggestion = currentSuggestion;
      composed.journeyQualityLabel = `${'★'.repeat(journeyQuality.stars)}${'☆'.repeat(5 - journeyQuality.stars)} ${journeyQuality.label}`;
    } else {
      if (composed.journeyScore >= 90) {
        composed.journeyQualityLabel = '★★★★★ Ottimamente bilanciato';
      } else if (composed.journeyScore >= 70) {
        composed.journeyQualityLabel = '★★★★☆ Buona pianificazione';
      } else if (composed.journeyScore >= 50) {
        composed.journeyQualityLabel = '★★★☆☆ Intenso o incompleto';
      } else if (composed.journeyScore > 0) {
        composed.journeyQualityLabel = '★★☆☆☆ Da rivedere';
      } else {
        composed.journeyQualityLabel = '★☆☆☆☆ Inizia a pianificare';
      }
    }

    composed.lastUpdated = new Date().toISOString();
    this.cachedContexts.set(cleanTripId, composed);

    // Innesco asincrono in background del bollettino meteo tramite SIP (non blocca la UI)
    const activeDayScheduleForWeather = composed.timeline.days.find(d => d.dayNumber === (composed.currentDay || 1)) || composed.timeline.days[0];
    const refPlace = activeDayScheduleForWeather?.places[0] || composed.savedPlaces[0];
    if (refPlace && refPlace.coordinates) {
      this.enrichWeatherAsync(cleanTripId, refPlace.coordinates.latitude, refPlace.coordinates.longitude, composed.startDate);
    }

    // Notifica istantaneamente tutti gli Hook iscritti per questo viaggio
    const tripSubscribers = this.subscribers.get(cleanTripId);
    if (tripSubscribers) {
      tripSubscribers.forEach((listener) => {
        try {
          listener(composed);
        } catch (error) {
          console.error(`[ContextEngine] Error notifying subscriber:`, error);
        }
      });
    }
  }

  /**
   * Arricchimento asincrono del meteo e notifica reattiva degli hook iscritti in caso di variazione.
   */
  private async enrichWeatherAsync(tripId: string, lat: number, lon: number, date: string): Promise<void> {
    try {
      const weather = await TravelServices.weather().getWeatherForLocation(lat, lon, date);
      const cached = this.cachedContexts.get(tripId);
      if (cached && JSON.stringify(cached.weather) !== JSON.stringify(weather)) {
        cached.weather = weather;
        this.cachedContexts.set(tripId, cached);
        
        // Notifica reattivamente i subscriber al completamento del fetch
        const tripSubscribers = this.subscribers.get(tripId);
        if (tripSubscribers) {
          tripSubscribers.forEach((listener) => {
            try { listener(cached); } catch (e) { /* ignore */ }
          });
        }
      }
    } catch (e) {
      console.warn('[ContextEngine] Weather SIP enrichment failed:', e);
    }
  }
}
