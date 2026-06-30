import { create } from 'zustand';
import { Trip, TripEvent } from '../../../domain/trip/models/trip.model';
import { mockBudapestTrip, mockBudapestEvents } from '../mock/budapest.mock';

interface TripState {
  trips: Trip[];
  activeTripId: string | null;
  events: Record<string, TripEvent[]>; // mappa tripId -> eventi
  isLoading: boolean;
  
  // Actions
  setActiveTrip: (id: string) => void;
  loadTrips: () => Promise<void>;
  getTripById: (id: string) => Trip | undefined;
  getEventsByTripId: (id: string) => TripEvent[];
}

export const useTripStore = create<TripState>((set, get) => ({
  trips: [mockBudapestTrip], // Inizializziamo con il mock per ora
  events: { [mockBudapestTrip.id]: mockBudapestEvents },
  activeTripId: null,
  isLoading: false,

  setActiveTrip: (id: string) => {
    set({ activeTripId: id });
  },

  loadTrips: async () => {
    // Simuliamo un fetch asincrono
    set({ isLoading: true });
    await new Promise((resolve) => setTimeout(resolve, 500));
    set({ isLoading: false });
    // I dati sono già nello store, in futuro qui chiameremo il GetUserTripsUseCase
  },

  getTripById: (id: string) => {
    return get().trips.find(t => t.id === id);
  },

  getEventsByTripId: (id: string) => {
    return get().events[id] || [];
  }
}));
