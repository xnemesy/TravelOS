import { TravelContext, HydrationStatus } from '../types/context.types';
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
 *
 * BARRIERA DI IDRATAZIONE (ADR-020): gli Engine di dominio idratano il proprio
 * stato per-trip da MMKV in modo pigro e asincrono (vedi IHydratable). Comporre
 * PRIMA che tutti abbiano finito significherebbe presentare come "verità" uno
 * stato in realtà ancora vuoto/parziale — questo è esattamente il difetto
 * risolto qui: `recompose()`/`getContext()`/`subscribe()` non compongono mai
 * da cache Engine parziali; finché un trip non è 'ready', pubblicano solo un
 * placeholder onesto (`hydrationStatus` riflette lo stato reale) e assicurano
 * che l'idratazione sia in corso. La composizione reale avviene esattamente
 * una volta, al termine dell'idratazione — vedi `ensureHydrated`/`runHydration`.
 */
export class ContextEngine implements IContextEngine {
  private publishers: Map<string, (tripId: string) => Partial<TravelContext>> = new Map();
  private subscribers: Map<string, Set<(context: TravelContext) => void>> = new Map();
  private cachedContexts: Map<string, TravelContext> = new Map();
  // Ultima chiave meteo (lat|lon|date) per cui è già stato lanciato un fetch,
  // per trip. Evita di rifare la chiamata di rete a ogni recompose (che scatta
  // su OGNI fatto di dominio via wildcard): il meteo dipende solo da posizione
  // e data, non dal resto delle mutazioni del viaggio.
  private lastWeatherKey: Map<string, string> = new Map();

  // --- Idratazione (ADR-020) ---
  private hydratables: Map<string, (tripId: string) => Promise<void>> = new Map();
  private hydrationStatus: Map<string, HydrationStatus> = new Map();
  private hydrationPromises: Map<string, Promise<void>> = new Map();
  // Incrementato a ogni nuova idratazione avviata e a ogni TripDeleted: permette
  // a un'idratazione in corso di riconoscere di essere stata superata (trip
  // eliminato nel frattempo) e di non resuscitarne lo stato al termine.
  private hydrationEpoch: Map<string, number> = new Map();

  constructor() {
    // Sottoscrizione al Domain Event Bus per ricomporre reattivamente lo stato
    // quando accade un fatto di dominio rilevante
    eventBus.subscribe('*', (event) => {
      if (!event.tripId) return;
      if (event.type === 'TripDeleted') {
        this.cachedContexts.delete(event.tripId);
        this.subscribers.delete(event.tripId);
        this.lastWeatherKey.delete(event.tripId);
        this.hydrationStatus.delete(event.tripId);
        this.hydrationEpoch.set(event.tripId, (this.hydrationEpoch.get(event.tripId) ?? 0) + 1);
        return;
      }
      this.recompose(event.tripId);
    });
  }

  private tripProvider?: (tripId: string) => any;

  public registerTripProvider(provider: (tripId: string) => any): void {
    this.tripProvider = provider;
  }

  /**
   * Registra un publisher di stato da parte di un Engine di dominio.
   */
  public registerStatePublisher(engineName: string, publisher: (tripId: string) => Partial<TravelContext>): void {
    this.publishers.set(engineName, publisher);
  }

  /**
   * Registra il metodo di idratazione di un Engine di dominio (ADR-020).
   */
  public registerHydratable(engineName: string, hydrate: (tripId: string) => Promise<void>): void {
    this.hydratables.set(engineName, hydrate);
  }

  /**
   * Garantisce che tutti gli Engine registrati abbiano idratato il proprio stato
   * per questo trip almeno una volta. Idempotente: una chiamata concorrente o
   * ripetuta mentre un'idratazione è già in corso (o già conclusa) condivide lo
   * stesso risultato, senza rilanciare la lettura da storage né duplicare la
   * notifica finale ai subscriber.
   */
  public async ensureHydrated(tripId: string): Promise<void> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');

    const existing = this.hydrationPromises.get(cleanTripId);
    if (existing) return existing;
    if (this.hydrationStatus.get(cleanTripId) === 'ready') return;

    if (this.hydratables.size === 0) {
      // Nessun Engine di dominio registrato come idratabile: non c'è alcun I/O
      // asincrono reale da attendere, comporre subito è corretto — non un bypass
      // della barriera, è l'assenza di lavoro da idratare (es. un ContextEngine
      // usato isolatamente nei test, senza i 3 Engine reali collegati).
      this.hydrationStatus.set(cleanTripId, 'ready');
      this.safeComposeNow(cleanTripId);
      return;
    }

    const epoch = (this.hydrationEpoch.get(cleanTripId) ?? 0) + 1;
    this.hydrationEpoch.set(cleanTripId, epoch);
    this.hydrationStatus.set(cleanTripId, 'hydrating');

    const promise = this.runHydration(cleanTripId, epoch);
    this.hydrationPromises.set(cleanTripId, promise);

    try {
      await promise;
    } finally {
      this.hydrationPromises.delete(cleanTripId);
    }
  }

  /**
   * Esegue l'idratazione di tutti gli Engine registrati per un trip e, se non
   * superata nel frattempo (vedi `hydrationEpoch`), compone lo stato reale
   * esattamente una volta al termine.
   */
  private async runHydration(tripId: string, epoch: number): Promise<void> {
    try {
      await Promise.all(
        Array.from(this.hydratables.values()).map((hydrate) => hydrate(tripId))
      );
    } catch (error) {
      console.error(`[ContextEngine] Idratazione fallita per il trip ${tripId}:`, error);
      if (this.hydrationEpoch.get(tripId) === epoch) {
        // Permette un nuovo tentativo al prossimo recompose()/ensureHydrated():
        // un errore transitorio non deve bloccare per sempre il trip in 'hydrating'.
        this.hydrationStatus.set(tripId, 'idle');
      }
      return;
    }

    if (this.hydrationEpoch.get(tripId) !== epoch) {
      // Superata da un TripDeleted (o una nuova idratazione) nel frattempo: non
      // resuscitare uno stato composto per un trip che potrebbe non esistere più.
      return;
    }
    this.hydrationStatus.set(tripId, 'ready');
    this.safeComposeNow(tripId); // Notifica i subscriber esattamente una volta, qui, a idratazione conclusa.
  }

  /**
   * Invoca `composeNow()` proteggendo dall'eccezione: se la composizione
   * fallisce (es. dati di una giornata malformati che mandano in errore
   * JourneyScoreCalculator/TimelineGenerator), l'errore viene loggato invece
   * di propagarsi come rigetto non gestito della Promise restituita da
   * `ensureHydrated()`. Usata dagli unici due punti in cui `composeNow()` è
   * invocato da un continuation asincrono — il ramo "0 hydratables" qui sopra
   * e la fine di `runHydration()` — che a differenza della chiamata sincrona
   * in `recompose()` non sono già protetti dal try/catch per-handler
   * dell'eventBus.
   */
  private safeComposeNow(tripId: string): void {
    try {
      this.composeNow(tripId);
    } catch (error) {
      console.error(`[ContextEngine] composeNow ha lanciato un'eccezione dopo l'idratazione del trip ${tripId}:`, error);
    }
  }

  /**
   * Restituisce lo snapshot reattivo corrente per un viaggio.
   * Se non è nella cache, lo compone istantaneamente (soggetto alla barriera
   * di idratazione — vedi `recompose`).
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

    // Calcola prima lo snapshot iniziale (può innescare l'idratazione, che per un
    // Engine senza dipendenze registrate può risolversi in modo sincrono qui
    // sotto): aggiungere il listener all'insieme SOLO dopo evita di notificarlo
    // due volte per la stessa sottoscrizione iniziale (vedi ADR-020 §3).
    const initialContext = this.getContext(cleanTripId);

    if (!this.subscribers.has(cleanTripId)) {
      this.subscribers.set(cleanTripId, new Set());
    }
    const tripSubscribers = this.subscribers.get(cleanTripId)!;
    tripSubscribers.add(listener);

    listener(initialContext);

    return () => {
      tripSubscribers.delete(listener);
      if (tripSubscribers.size === 0) {
        this.subscribers.delete(cleanTripId);
      }
    };
  }

  /**
   * Forza la ricomposizione reattiva per un trip — ma solo se già 'ready'.
   * Se il trip non è ancora stato idratato (o lo è parzialmente), NON compone
   * da cache Engine incomplete: pubblica un placeholder onesto (se non già
   * presente in cache) e assicura che l'idratazione sia in corso. La
   * composizione reale avviene automaticamente al termine (vedi `runHydration`).
   */
  public recompose(tripId: string): void {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const status = this.hydrationStatus.get(cleanTripId) ?? 'idle';

    if (status === 'ready') {
      this.composeNow(cleanTripId);
      return;
    }

    if (!this.cachedContexts.has(cleanTripId)) {
      this.cachedContexts.set(cleanTripId, this.buildBaseContext(cleanTripId));
    }
    void this.ensureHydrated(cleanTripId);
  }

  /**
   * Costruisce lo scheletro di un TravelContext: metadati del trip (risolti via
   * tripProvider, sincrono) + default onesti per tutti i campi derivati dagli
   * Engine. Usato sia come placeholder pre-idratazione sia come punto di
   * partenza di `composeNow` (che poi unisce le slice pubblicate dagli Engine).
   */
  private buildBaseContext(tripId: string): TravelContext {
    let tripTitle = 'Viaggio in programma';
    let destination = 'Destinazione';
    let startDate = new Date().toISOString().split('T')[0];
    let endDate = new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0];

    const trip = this.tripProvider ? this.tripProvider(tripId) : null;
    if (trip) {
      tripTitle = trip.title;
      destination = trip.destination;
      startDate = typeof trip.startDate === 'string' ? trip.startDate : (trip.startDate instanceof Date ? trip.startDate.toISOString().split('T')[0] : String(trip.startDate));
      endDate = typeof trip.endDate === 'string' ? trip.endDate : (trip.endDate instanceof Date ? trip.endDate.toISOString().split('T')[0] : String(trip.endDate));
    } else {
      if (tripId === 'trip-budapest-2026') {
        tripTitle = 'Weekend a Budapest';
        destination = 'Budapest, Ungheria';
      } else if (tripId === 'trip-kyoto-2026') {
        tripTitle = 'Autunno in Giappone';
        destination = 'Kyoto, Giappone';
      } else if (tripId === 'trip-amalfi-2027') {
        tripTitle = 'Primavera in Costiera';
        destination = 'Costiera Amalfitana';
      }
    }

    return {
      tripId,
      userId: 'user-default-123',
      tripTitle,
      destination,
      tripPhase: trip?.status || 'planned',
      currentDay: 1,
      totalDays: 5,
      startDate,
      endDate,
      journeyScore: 0,
      journeyStatusLabel: 'Planning...',
      hydrationStatus: this.hydrationStatus.get(tripId) ?? 'idle',
      timeline: {
        days: [],
        currentOrNextPlace: null,
        upcomingPlacesToday: [],
        timeAvailableMinutesToday: 720,
      },
      savedPlaces: [],
      visitedPlaces: [],
      transports: [],
      transportsCount: 0,
      accommodations: [],
      accommodationsCount: 0,
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
  }

  /**
   * Compone lo stato interrogando i publisher registrati dagli Engine e notifica
   * la UI. Presuppone che il trip sia già 'ready' (idratato) — unico chiamante
   * legittimo di questa garanzia è `recompose`/`runHydration`/`ensureHydrated`.
   */
  private composeNow(tripId: string): void {
    let composed: TravelContext = this.buildBaseContext(tripId);
    composed.hydrationStatus = 'ready';

    // Compone unendo le slice di stato pubblicate dai motori (Places, Timeline, ecc.)
    for (const [_, publisher] of this.publishers) {
      try {
        const slice = publisher(tripId);
        composed = { ...composed, ...slice };
      } catch (error) {
        console.error(`[ContextEngine] Error composing slice for trip ${tripId}:`, error);
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
    this.cachedContexts.set(tripId, composed);

    // Innesco asincrono in background del bollettino meteo tramite SIP (non blocca la UI)
    const activeDayScheduleForWeather = composed.timeline.days.find(d => d.dayNumber === (composed.currentDay || 1)) || composed.timeline.days[0];
    const refPlace = activeDayScheduleForWeather?.places[0] || composed.savedPlaces[0];
    if (refPlace && refPlace.coordinates) {
      // Deduplica: rilancia il fetch solo se posizione/data sono cambiate rispetto
      // all'ultimo fetch per questo trip. Senza questo, ogni PlaceSaved/Timeline*/
      // Trip* farebbe una chiamata di rete meteo ridondante.
      const weatherKey = `${refPlace.coordinates.latitude}|${refPlace.coordinates.longitude}|${composed.startDate}`;
      if (this.lastWeatherKey.get(tripId) !== weatherKey) {
        this.lastWeatherKey.set(tripId, weatherKey);
        this.enrichWeatherAsync(tripId, refPlace.coordinates.latitude, refPlace.coordinates.longitude, composed.startDate);
      }
    }

    // Notifica istantaneamente tutti gli Hook iscritti per questo viaggio
    const tripSubscribers = this.subscribers.get(tripId);
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
      // Libera la chiave così un recompose successivo può ritentare il fetch
      // (senza questo, un errore transitorio bloccherebbe il meteo finché
      // posizione/data non cambiano).
      this.lastWeatherKey.delete(tripId);
    }
  }
}
