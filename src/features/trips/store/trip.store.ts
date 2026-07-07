import { create } from 'zustand';
import { Trip, TripEvent } from '../../../domain/trip/models/trip.model';
import { TripRepository } from '../../../domain/trip/repositories/trip.repository';
import { MMKVAdapter } from '../../../core/storage/mmkv.adapter';
import { getAutoCoverForDestination } from '../utils/cover-matcher';
import { eventBus } from '../../../core/events/event-bus';
import { placesEngine, timelineEngine, contextEngine } from '../../../core/engines';
import { TravelServices } from '../../../domain/providers/TravelServices';

const USE_REAL_PLACES = process.env.EXPO_PUBLIC_USE_REAL_PLACES === 'true';

// Istanziamo il repository offline-first con MMKV
const storageAdapter = new MMKVAdapter();
const tripRepository = new TripRepository(storageAdapter);

interface TripState {
  trips: Trip[];
  activeTripId: string | null;
  events: Record<string, TripEvent[]>;
  isLoading: boolean;
  
  // Actions
  setActiveTrip: (id: string) => void;
  loadTrips: () => Promise<void>;
  createTrip: (data: { title: string; destination: string; startDate: Date; endDate: Date; emoji?: string; currency?: string; coverImageUrl?: string }) => Promise<Trip>;
  updateTrip: (id: string, updates: Partial<Trip>) => Promise<Trip>;
  archiveTrip: (id: string) => Promise<void>;
  deleteTrip: (id: string) => Promise<void>;
  duplicateTrip: (id: string) => Promise<Trip>;
  getTripById: (id: string) => Trip | undefined;
  getEventsByTripId: (id: string) => TripEvent[];
}

export const useTripStore = create<TripState>((set, get) => ({
  trips: [], // Partiamo da array pulito, letto dallo storage locale
  events: {},
  activeTripId: null,
  isLoading: false,

  setActiveTrip: (id: string) => {
    set({ activeTripId: id });
  },

  loadTrips: async () => {
    set({ isLoading: true });
    try {
      const loadedTrips = await tripRepository.getUserTrips('default-user');
      set({ trips: loadedTrips, isLoading: false });
    } catch (error) {
      console.error('Errore nel caricamento dei viaggi:', error);
      set({ isLoading: false });
    }
  },

  createTrip: async (data) => {
    let coverImageUrl = data.coverImageUrl || getAutoCoverForDestination(data.destination);
    
    // Tentiamo di caricare una cover reale tramite Google Places se siamo in modalità reale e non è fornita
    if (USE_REAL_PLACES && !data.coverImageUrl) {
      try {
        const places = await TravelServices.places().searchPlaces(data.destination);
        if (places && places[0] && places[0].coverImageUrl) {
          coverImageUrl = places[0].coverImageUrl;
        }
      } catch (e) {
        console.error('[TripStore] Fallback su cover statica per errore:', e);
      }
    }

    const newTrip = await tripRepository.createTrip({
      userId: 'default-user',
      title: data.title,
      destination: data.destination,
      emoji: data.emoji || '✈️',
      currency: data.currency || 'EUR',
      startDate: data.startDate,
      endDate: data.endDate,
      status: 'planned',
      coverImageUrl,
      stats: {
        savedPlaces: 0,
        reservations: 0,
        activitiesToComplete: 0,
      }
    });

    set((state) => ({
      trips: [...state.trips, newTrip],
      activeTripId: newTrip.id,
    }));

    return newTrip;
  },

  updateTrip: async (id: string, updates: Partial<Trip>) => {
    const updated = await tripRepository.updateTrip(id, updates);
    set((state) => ({
      trips: state.trips.map(t => t.id === id ? updated : t)
    }));
    return updated;
  },

  archiveTrip: async (id: string) => {
    await get().updateTrip(id, { status: 'archived' });
  },

  deleteTrip: async (id: string) => {
    await tripRepository.deleteTrip(id);
    set((state) => ({
      trips: state.trips.filter(t => t.id !== id),
      activeTripId: state.activeTripId === id ? null : state.activeTripId
    }));
  },

  duplicateTrip: async (id: string) => {
    const existing = get().getTripById(id);
    if (!existing) {
      throw new Error(`Viaggio con id ${id} non trovato per la duplicazione.`);
    }

    // Date azzerate / odierne per rifarlo l'anno dopo
    const now = new Date();
    const futureEnd = new Date(now.getTime() + 86400000 * 3); // 3 giorni di default

    const duplicated = await get().createTrip({
      title: `${existing.title} (Copia)`,
      destination: existing.destination,
      emoji: existing.emoji,
      currency: existing.currency,
      startDate: now,
      endDate: futureEnd,
    });

    return duplicated;
  },

  getTripById: (id: string) => {
    return get().trips.find(t => t.id === id);
  },

  getEventsByTripId: (id: string) => {
    return get().events[id] || [];
  }
}));

// Reattività Real-time: Ascolta l'Event Bus di dominio per aggiornare statistiche e progresso viaggio.
// Reagisce a QUALSIASI fatto di dominio associato a un trip, non a una whitelist di nomi:
// altrimenti ogni nuovo DomainFactType richiederebbe di ricordarsi di aggiornare questo filtro.
eventBus.subscribe('*', async (event) => {
  if (!event.tripId) return;
  const tripId = event.tripId;
  try {
    const places = await placesEngine.getSavedPlaces(tripId);
    const savedPlacesCount = places.length;

    // Progresso allineato al Journey Score 2.0 calcolato dal Context Engine
    const context = contextEngine.getContext(tripId);
    const planProgress = context.journeyScore;
    const organizedDaysCount = context.timeline?.days?.filter(d => d.places?.length > 0).length || 0;

    const store = useTripStore.getState();
    const trip = store.getTripById(tripId);
    if (trip) {
      await store.updateTrip(tripId, {
        progress: planProgress,
        stats: {
          ...trip.stats,
          savedPlaces: savedPlacesCount,
          organizedDays: organizedDaysCount,
        }
      });
    }
  } catch (error) {
    // Ignora errori di aggiornamento su trip mock/non presenti nel repository locale
    if (process.env.NODE_ENV === 'development') {
      // console.debug('[trip.store] Aggiornamento ignorato per trip assente/mock:', tripId);
    }
  }
});
