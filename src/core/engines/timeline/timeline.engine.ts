import { ITimelineEngine, IContextEngine } from '../types/engines.types';
import { TimelineDaySchedule, PlaceRef, TravelContext } from '../types/context.types';
import { TimelineGenerator } from '../../../domain/services/TimelineGenerator';
import { journeyComposer } from '../../../domain/services/JourneyComposer';
import { eventBus } from '../../events/event-bus';
import { MMKVAdapter } from '../../storage/mmkv.adapter';

const localDb = new MMKVAdapter();

/**
 * ============================================================================
 * TIMELINE ENGINE (FASE 1 - LA SPINA DORSALE DI TRAVEL OS)
 * ============================================================================
 * Responsabilità: Genera la timeline da cui derivano Planning -> Journey -> Memories.
 * Regole:
 * - Orchestra le giornate del viaggio.
 * - Delega tutti i calcoli matematici e stime di tempo a TimelineGenerator (Domain Service).
 * - Pubblica lo stato nel Context Engine e notifica tramite Domain Facts.
 */
export class TimelineEngine implements ITimelineEngine {
  private timelineMap: Map<string, TimelineDaySchedule[]> = new Map();
  private contextEngine: IContextEngine;

  constructor(contextEngine: IContextEngine) {
    this.contextEngine = contextEngine;

    // Registra la propria slice di stato nel Context Engine per la composizione reattiva
    contextEngine.registerStatePublisher('TimelineEngine', (tripId: string) =>
      this.publishStateSlice(tripId)
    );

    // Sottoscrive gli eventi di visita per aggiornare reattivamente le tappe della timeline
    eventBus.subscribe('PlaceVisited', async (event) => {
      const payload = event.payload as any;
      if (event.tripId && payload?.placeId) {
        await this.markPlaceAsVisited(event.tripId, payload.placeId, payload.isVisited !== false);
      }
    });

    // Sottoscrive gli eventi di aggiornamento note per sincronizzare le tappe nella timeline
    eventBus.subscribe('PlaceNotesUpdated', async (event) => {
      const payload = event.payload as any;
      if (event.tripId && payload?.placeId && payload?.notes !== undefined) {
        await this.updatePlaceNotes(event.tripId, payload.placeId, payload.notes);
      }
    });

    // Sottoscrive gli eventi di eliminazione luogo per rimuoverlo dalla timeline
    eventBus.subscribe('PlaceRemoved', async (event) => {
      const payload = event.payload as any;
      if (event.tripId && payload?.placeId) {
        await this.removePlaceFromAllDays(event.tripId, payload.placeId);
      }
    });
  }

  public async markPlaceAsVisited(tripId: string, placeId: string, isVisited: boolean = true): Promise<void> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const cleanPlaceId = Array.isArray(placeId) ? placeId[0] : String(placeId || '');
    const timeline = await this.getTripTimeline(cleanTripId);
    let modified = false;
    for (let i = 0; i < timeline.length; i++) {
      const day = timeline[i];
      if (day.places.some((p) => p.id === cleanPlaceId)) {
        const updatedPlaces = day.places.map((p) => (p.id === cleanPlaceId ? { ...p, isVisited } : p));
        const newTimeline = [...timeline];
        newTimeline[i] = TimelineGenerator.generateDaySchedule(day.dayNumber, day.date, updatedPlaces);
        this.timelineMap.set(cleanTripId, newTimeline);
        await localDb.set(`timeline_${cleanTripId}`, newTimeline);
        modified = true;
      }
    }
    // Nessun nuovo Domain Fact: PlacesEngine ha già annunciato PlaceVisited.
    // Qui aggiorniamo solo la nostra cache interna e ricomponiamo direttamente il Context.
    if (modified) {
      this.contextEngine.recompose(cleanTripId);
    }
  }

  public async updatePlaceNotes(tripId: string, placeId: string, notes: string): Promise<void> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const cleanPlaceId = Array.isArray(placeId) ? placeId[0] : String(placeId || '');
    const timeline = await this.getTripTimeline(cleanTripId);
    let modified = false;
    for (let i = 0; i < timeline.length; i++) {
      const day = timeline[i];
      if (day.places.some((p) => p.id === cleanPlaceId)) {
        const updatedPlaces = day.places.map((p) => (p.id === cleanPlaceId ? { ...p, notes } : p));
        const newTimeline = [...timeline];
        newTimeline[i] = TimelineGenerator.generateDaySchedule(day.dayNumber, day.date, updatedPlaces);
        this.timelineMap.set(cleanTripId, newTimeline);
        await localDb.set(`timeline_${cleanTripId}`, newTimeline);
        modified = true;
      }
    }
    // Nessun nuovo Domain Fact: PlacesEngine ha già annunciato PlaceNotesUpdated.
    if (modified) {
      this.contextEngine.recompose(cleanTripId);
    }
  }

  public async getTripTimeline(tripId: string): Promise<TimelineDaySchedule[]> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    if (!this.timelineMap.has(cleanTripId)) {
      const persisted = await localDb.get<TimelineDaySchedule[]>(`timeline_${cleanTripId}`);
      if (persisted && persisted.length > 0) {
        // Deserializza correttamente e carica in cache
        this.timelineMap.set(cleanTripId, persisted);
      } else {
        // Carica i dettagli del viaggio per calcolarne la durata reale
        const tripsKey = 'cache_user_trips_default-user';
        const rawTrips = await localDb.get<any[]>(tripsKey);
        const trip = rawTrips?.find(t => t.id === cleanTripId);
        
        let start = new Date('2026-07-10T00:00:00.000Z');
        let end = new Date('2026-07-13T00:00:00.000Z'); // default 3 giorni
        
        if (trip) {
          start = new Date(trip.startDate);
          end = new Date(trip.endDate);
        }
        
        // Calcola la durata esatta del viaggio in giorni (minimo 1 giorno)
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        
        const defaultDays: TimelineDaySchedule[] = [];
        for (let i = 0; i < diffDays; i++) {
          const currentDate = new Date(start.getTime() + i * 86400000);
          const dateStr = currentDate.toISOString().split('T')[0];
          defaultDays.push(TimelineGenerator.generateDaySchedule(i + 1, dateStr, []));
        }
        
        this.timelineMap.set(cleanTripId, defaultDays);
        await localDb.set(`timeline_${cleanTripId}`, defaultDays);
      }
    }
    return this.timelineMap.get(cleanTripId)!;
  }

  public async getDaySchedule(tripId: string, dayNumber: number): Promise<TimelineDaySchedule | null> {
    const timeline = await this.getTripTimeline(tripId);
    return timeline.find((d) => d.dayNumber === dayNumber) || null;
  }

  public async addPlaceToDay(tripId: string, dayNumber: number, place: PlaceRef): Promise<void> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const timeline = await this.getTripTimeline(cleanTripId);
    const dayIdx = timeline.findIndex((d) => d.dayNumber === dayNumber);

    if (dayIdx !== -1) {
      const currentDay = timeline[dayIdx];
      const updatedPlaces = [...currentDay.places, place];
      
      // Delega a TimelineGenerator il ricalcolo delle distanze e durate
      const newTimeline = [...timeline];
      newTimeline[dayIdx] = TimelineGenerator.generateDaySchedule(
        currentDay.dayNumber,
        currentDay.date,
        updatedPlaces
      );

      this.timelineMap.set(cleanTripId, newTimeline);
      await localDb.set(`timeline_${cleanTripId}`, newTimeline);

      eventBus.publish({
        id: `evt-${Date.now()}`,
        type: 'TimelinePlaceAdded',
        timestamp: new Date().toISOString(),
        tripId: cleanTripId,
        payload: {
          dayNumber,
          orderedPlaceIds: updatedPlaces.map((p) => p.id),
        },
      });
    }
  }

  public async removePlaceFromDay(tripId: string, dayNumber: number, placeId: string): Promise<void> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const cleanPlaceId = Array.isArray(placeId) ? placeId[0] : String(placeId || '');
    const timeline = await this.getTripTimeline(cleanTripId);
    const dayIdx = timeline.findIndex((d) => d.dayNumber === dayNumber);

    if (dayIdx !== -1) {
      const currentDay = timeline[dayIdx];
      const updatedPlaces = currentDay.places.filter((p) => p.id !== cleanPlaceId);

      const newTimeline = [...timeline];
      newTimeline[dayIdx] = TimelineGenerator.generateDaySchedule(
        currentDay.dayNumber,
        currentDay.date,
        updatedPlaces
      );

      this.timelineMap.set(cleanTripId, newTimeline);
      await localDb.set(`timeline_${cleanTripId}`, newTimeline);

      eventBus.publish({
        id: `evt-${Date.now()}`,
        type: 'TimelinePlaceRemoved',
        timestamp: new Date().toISOString(),
        tripId: cleanTripId,
        payload: {
          dayNumber,
          orderedPlaceIds: updatedPlaces.map((p) => p.id),
        },
      });
    }
  }

  public async removePlaceFromAllDays(tripId: string, placeId: string): Promise<void> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const cleanPlaceId = Array.isArray(placeId) ? placeId[0] : String(placeId || '');
    const timeline = await this.getTripTimeline(cleanTripId);

    let modified = false;
    const newTimeline = [...timeline];

    for (let i = 0; i < newTimeline.length; i++) {
      const day = newTimeline[i];
      if (day.places.some(p => p.id === cleanPlaceId)) {
        const updatedPlaces = day.places.filter(p => p.id !== cleanPlaceId);
        newTimeline[i] = TimelineGenerator.generateDaySchedule(
          day.dayNumber,
          day.date,
          updatedPlaces
        );
        modified = true;
      }
    }

    if (modified) {
      this.timelineMap.set(cleanTripId, newTimeline);
      await localDb.set(`timeline_${cleanTripId}`, newTimeline);

      // Nessun nuovo Domain Fact: PlacesEngine ha già annunciato PlaceRemoved.
      this.contextEngine.recompose(cleanTripId);
    }
  }

  public async assignPlaceToTimelineSlot(tripId: string, dayNumber: number, slotId: string, place: PlaceRef): Promise<void> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const timeline = await this.getTripTimeline(cleanTripId);
    const dayIdx = timeline.findIndex((d) => d.dayNumber === dayNumber);

    if (dayIdx !== -1) {
      const currentDay = timeline[dayIdx];
      const updatedPlaces = [...currentDay.places];
      const slotIdx = updatedPlaces.findIndex(p => p.id === slotId);

      if (slotIdx !== -1) {
        // Manteniamo le proprietà che potrebbero essere utili o che il nuovo posto non ha, ma in generale sostituiamo in toto.
        updatedPlaces[slotIdx] = { ...place, isLocked: true }; // Locking the manually assigned place
        
        const newTimeline = [...timeline];
        // Ricalcoliamo la giornata. TimelineGenerator preserva l'ordine e ricalcola orari e distanze.
        newTimeline[dayIdx] = TimelineGenerator.generateDaySchedule(
          currentDay.dayNumber,
          currentDay.date,
          updatedPlaces
        );

        this.timelineMap.set(cleanTripId, newTimeline);
        await localDb.set(`timeline_${cleanTripId}`, newTimeline);

        eventBus.publish({
          id: `evt-${Date.now()}`,
          type: 'TimelineSlotFilled',
          timestamp: new Date().toISOString(),
          tripId: cleanTripId,
          payload: {
            dayNumber,
            orderedPlaceIds: updatedPlaces.map((p) => p.id),
          },
        });
      }
    }
  }

  public async reorderDayTimeline(tripId: string, dayNumber: number, orderedPlaceIds: string[]): Promise<void> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const timeline = await this.getTripTimeline(cleanTripId);
    const dayIdx = timeline.findIndex((d) => d.dayNumber === dayNumber);

    if (dayIdx !== -1) {
      const newTimeline = [...timeline];
      
      // Marca i luoghi come "locked" in modo che l'ottimizzatore non li sposti
      const currentDay = newTimeline[dayIdx];
      currentDay.places = currentDay.places.map(p => ({
        ...p,
        isLocked: orderedPlaceIds.includes(p.id) ? true : p.isLocked
      }));

      newTimeline[dayIdx] = TimelineGenerator.reorderDaySchedule(newTimeline[dayIdx], orderedPlaceIds);
      this.timelineMap.set(cleanTripId, newTimeline);
      await localDb.set(`timeline_${cleanTripId}`, newTimeline);

      eventBus.publish({
        id: `evt-${Date.now()}`,
        type: 'TimelineReordered',
        timestamp: new Date().toISOString(),
        tripId: cleanTripId,
        payload: {
          dayNumber,
          orderedPlaceIds,
        },
      });
    }
  }

  public async autoScheduleUnassignedPlaces(tripId: string, unassignedPlaces: PlaceRef[], profileId: string = 'culture'): Promise<void> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const timeline = await this.getTripTimeline(cleanTripId);
    
    if (unassignedPlaces.length === 0 || timeline.length === 0) return;

    // Semplice logica: distribuisce i luoghi equamente sui giorni disponibili
    const placesPerDay = Math.ceil(unassignedPlaces.length / timeline.length);
    let currentPlaceIndex = 0;

    const newTimeline = [...timeline];
    for (let i = 0; i < newTimeline.length; i++) {
      const day = newTimeline[i];
      const placesToAdd = unassignedPlaces.slice(currentPlaceIndex, currentPlaceIndex + placesPerDay);
      currentPlaceIndex += placesPerDay;

      if (placesToAdd.length > 0) {
        const updatedPlaces = [...day.places, ...placesToAdd];
        newTimeline[i] = TimelineGenerator.generateDaySchedule(day.dayNumber, day.date, updatedPlaces);
      }
    }

    this.timelineMap.set(cleanTripId, newTimeline);
    await localDb.set(`timeline_${cleanTripId}`, newTimeline);

    // Payload reale: gli id dei luoghi effettivamente distribuiti (prima era un placeholder vuoto).
    // dayNumber è il primo giorno della timeline come ancora rappresentativa, perché l'auto-schedule
    // può toccare più giorni contemporaneamente: il payload non descrive un singolo giorno.
    eventBus.publish({
      id: `evt-${Date.now()}`,
      type: 'TimelineAutoScheduled',
      timestamp: new Date().toISOString(),
      tripId: cleanTripId,
      payload: {
        dayNumber: newTimeline[0]?.dayNumber ?? 1,
        orderedPlaceIds: unassignedPlaces.map((p) => p.id),
      },
    });
  }

  public async optimizeDayTimeline(tripId: string, dayNumber: number, profileId: string = 'culture'): Promise<void> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const timeline = await this.getTripTimeline(cleanTripId);
    const dayIdx = timeline.findIndex((d) => d.dayNumber === dayNumber);

    if (dayIdx !== -1) {
      const newTimeline = [...timeline];
      newTimeline[dayIdx] = await TimelineGenerator.optimizeDayRouteWithSIP(newTimeline[dayIdx], profileId);

      this.timelineMap.set(cleanTripId, newTimeline);
      await localDb.set(`timeline_${cleanTripId}`, newTimeline);

      eventBus.publish({
        id: `evt-${Date.now()}`,
        type: 'TimelineOptimized',
        timestamp: new Date().toISOString(),
        tripId: cleanTripId,
        payload: {
          dayNumber,
          orderedPlaceIds: newTimeline[dayIdx].places.map((p) => p.id),
        },
      });
    }
  }

  public async composeDayWithAvailablePlaces(
    tripId: string, 
    dayNumber: number, 
    availablePlaces: PlaceRef[], 
    styleId: string = 'culture'
  ): Promise<void> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const timeline = await this.getTripTimeline(cleanTripId);
    let dayIdx = timeline.findIndex((d) => d.dayNumber === dayNumber);

    if (dayIdx === -1) {
      // Se il giorno non esiste ancora nella timeline, creiamo un nuovo giorno
      const newDaySchedule = TimelineGenerator.generateDaySchedule(dayNumber, new Date().toISOString().split('T')[0], []);
      timeline.push(newDaySchedule);
      dayIdx = timeline.length - 1;
    }

    const currentSchedule = timeline[dayIdx];
    const newSchedule = await journeyComposer.compose({
      availablePlaces,
      travelStyle: styleId,
      targetDay: dayNumber,
      dateStr: currentSchedule.date,
      currentSchedule,
    });

    const newTimeline = [...timeline];
    newTimeline[dayIdx] = newSchedule;

    this.timelineMap.set(cleanTripId, newTimeline);
    await localDb.set(`timeline_${cleanTripId}`, newTimeline);

    eventBus.publish({
      id: `evt-${Date.now()}`,
      type: 'TimelineGenerated',
      timestamp: new Date().toISOString(),
      tripId: cleanTripId,
      payload: {
        dayNumber,
        orderedPlaceIds: newSchedule.places.map((p) => p.id),
      },
    });
  }

  /**
   * Ritorna la slice di stato da pubblicare nel Context Engine.
   */
  private publishStateSlice(tripId: string): Partial<TravelContext> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const days = this.timelineMap.get(cleanTripId) || [];
    // Cerca il primo giorno che ha ancora tappe non visitate, altrimenti prende il giorno 1 o l'ultimo
    const activeDay = days.find((d) => d.places.some((p) => !p.isVisited)) || days[0] || null;
    const upcomingPlaces = activeDay ? activeDay.places.filter((p) => !p.isVisited) : [];
    const currentOrNext = upcomingPlaces[0] || null;

    const totalScheduledMinutes = activeDay ? activeDay.totalEstimatedDurationMinutes : 0;
    const timeAvailable = TimelineGenerator.calculateAvailableMinutes(720, totalScheduledMinutes);

    return {
      timeline: {
        days,
        currentOrNextPlace: currentOrNext,
        upcomingPlacesToday: upcomingPlaces,
        timeAvailableMinutesToday: timeAvailable,
      },
    };
  }
}
