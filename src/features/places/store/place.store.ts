import { create } from 'zustand';
import { TravelPlace } from '../../../domain/trip/models/place.model';
import { InMemoryPlaceRepository } from '../../../domain/trip/repositories/place.repository';
import { allMockPlaces } from '../../trips/mock/budapest.mock';

interface PlaceState {
  places: Record<string, TravelPlace[]>; // Key: tripId
  activePlace: TravelPlace | null;
  isLoading: boolean;
  error: string | null;
  
  // Ricerca Persistente
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeFilters: string[];
  setActiveFilters: (filters: string[]) => void;
  
  // Azioni
  loadPlacesForTrip: (tripId: string) => Promise<void>;
  setActivePlace: (placeId: string, tripId?: string) => void;
  addPlace: (tripId: string, place: TravelPlace) => Promise<void>;
  addOrMergePlace: (tripId: string, place: TravelPlace) => Promise<{ place: TravelPlace; merged: boolean }>;
  updatePlace: (placeId: string, tripId: string, updates: Partial<TravelPlace>) => Promise<void>;
  removePlace: (placeId: string, tripId: string) => Promise<void>;
}

// Inizializza il repository con i mock globali
export const repository = new InMemoryPlaceRepository(allMockPlaces);

export const usePlaceStore = create<PlaceState>((set, get) => ({
  places: {},
  activePlace: null,
  isLoading: false,
  error: null,
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  activeFilters: [],
  setActiveFilters: (filters) => set({ activeFilters: filters }),

  loadPlacesForTrip: async (tripId: string) => {
    set({ isLoading: true, error: null });
    try {
      const tripPlaces = await repository.getPlacesByTripId(tripId);
      set((state) => ({
        places: { ...state.places, [tripId]: tripPlaces },
        isLoading: false
      }));
    } catch (err) {
      set({ error: 'Errore nel caricamento dei luoghi', isLoading: false });
    }
  },

  setActivePlace: (placeId: string, tripId?: string) => {
    if (tripId) {
      const place = get().places[tripId]?.find(p => p.id === placeId) || null;
      set({ activePlace: place });
    } else {
      // Cerca in tutti i viaggi caricati se tripId non è fornito
      for (const tId in get().places) {
        const place = get().places[tId].find(p => p.id === placeId);
        if (place) {
          set({ activePlace: place });
          return;
        }
      }
      set({ activePlace: null });
    }
  },

  addPlace: async (tripId: string, place: TravelPlace) => {
    await repository.addOrMergePlace(place);
    const updatedPlaces = await repository.getPlacesByTripId(tripId);
    set((state) => ({
      places: { ...state.places, [tripId]: updatedPlaces }
    }));
  },

  addOrMergePlace: async (tripId: string, place: TravelPlace) => {
    const result = await repository.addOrMergePlace(place);
    const updatedPlaces = await repository.getPlacesByTripId(tripId);
    set((state) => ({
      places: { ...state.places, [tripId]: updatedPlaces }
    }));
    return result;
  },

  updatePlace: async (placeId: string, tripId: string, updates: Partial<TravelPlace>) => {
    await repository.updatePlace(placeId, updates);
    const updatedPlaces = await repository.getPlacesByTripId(tripId);
    set((state) => ({
      places: { ...state.places, [tripId]: updatedPlaces },
      activePlace: state.activePlace?.id === placeId ? { ...state.activePlace, ...updates } as TravelPlace : state.activePlace
    }));
  },

  removePlace: async (placeId: string, tripId: string) => {
    await repository.deletePlace(placeId);
    const updatedPlaces = await repository.getPlacesByTripId(tripId);
    set((state) => ({
      places: { ...state.places, [tripId]: updatedPlaces },
      activePlace: state.activePlace?.id === placeId ? null : state.activePlace
    }));
  }
}));
