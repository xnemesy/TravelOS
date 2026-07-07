import { create } from 'zustand';
import { usePlaceStore } from '../../places/store/place.store';
import { PlannerEngine } from '../../../domain/trip/engine/PlannerEngine';
import { DayTimelineSummary } from '../../../domain/trip/engine/planner.types';
import { TravelPlace } from '../../../domain/trip/models/place.model';
import { MMKVAdapter } from '../../../core/storage/mmkv.adapter';

const localDb = new MMKVAdapter();
const PREF_KEY = 'planner_advanced_mode';

interface PlannerState {
  selectedDay: number;
  activeTab: 'library' | 'planner';
  isAdvancedMode: boolean;
  
  // Actions
  setSelectedDay: (day: number) => void;
  setActiveTab: (tab: 'library' | 'planner') => void;
  setAdvancedMode: (advanced: boolean) => void;
  assignPlaceToDay: (placeId: string, tripId: string, dayNumber?: number) => Promise<void>;
  movePlaceUp: (placeId: string, tripId: string, dayNumber: number) => Promise<void>;
  movePlaceDown: (placeId: string, tripId: string, dayNumber: number) => Promise<void>;
  
  // Helpers
  getDayTimeline: (tripId: string, dayNumber: number) => DayTimelineSummary;
  getUnassignedPlaces: (tripId: string) => TravelPlace[];
}

export const usePlannerStore = create<PlannerState>((set, get) => {
  // Leggi preferenza iniziale in modo sincrono se possibile, altrimenti usa false
  let initialMode = false;
  localDb.get(PREF_KEY).then(res => {
    if (res && typeof res === 'object' && 'data' in res) {
      set({ isAdvancedMode: (res as any).data === 'true' });
    } else if (typeof res === 'string') {
      set({ isAdvancedMode: res === 'true' });
    }
  });

  return {
    selectedDay: 1,
    activeTab: 'planner',
    isAdvancedMode: false, // fallback iniziale prima del reidratazione

    setSelectedDay: (day: number) => set({ selectedDay: day }),
    setActiveTab: (tab: 'library' | 'planner') => set({ activeTab: tab }),
    setAdvancedMode: (advanced: boolean) => {
      localDb.set(PREF_KEY, advanced ? 'true' : 'false');
      set({ isAdvancedMode: advanced });
    },

  assignPlaceToDay: async (placeId: string, tripId: string, dayNumber?: number) => {
    await usePlaceStore.getState().updatePlace(placeId, tripId, { assignedDay: dayNumber });
  },

  movePlaceUp: async (placeId: string, tripId: string, dayNumber: number) => {
    const places = usePlaceStore.getState().places[tripId] || [];
    const dayPlaces = places.filter((p) => p.assignedDay === dayNumber);
    const index = dayPlaces.findIndex((p) => p.id === placeId);
    
    if (index > 0) {
      // Scambia con l'elemento precedente
      const newOrderIds = [...dayPlaces.map((p) => p.id)];
      const temp = newOrderIds[index - 1];
      newOrderIds[index - 1] = newOrderIds[index];
      newOrderIds[index] = temp;

      const reordered = PlannerEngine.reorderPlacesInDay(dayPlaces, newOrderIds);
      
      // Aggiorna in sequenza o assegna orari progressivi se necessario
      for (let i = 0; i < reordered.length; i++) {
        // Possiamo semplicemente fare updatePlace ma per mantenere l'ordine nell'array locale ricreiamo l'array
      }
      // Poiché l'array nello store `places[tripId]` ordina semplicemente per array index o data,
      // per riordinare concretamente possiamo riassegnare l'intero array del trip nello store:
      const otherPlaces = places.filter((p) => p.assignedDay !== dayNumber);
      const finalTripPlaces = [...otherPlaces, ...reordered];
      usePlaceStore.setState((state) => ({
        places: {
          ...state.places,
          [tripId]: finalTripPlaces,
        },
      }));
    }
  },

  movePlaceDown: async (placeId: string, tripId: string, dayNumber: number) => {
    const places = usePlaceStore.getState().places[tripId] || [];
    const dayPlaces = places.filter((p) => p.assignedDay === dayNumber);
    const index = dayPlaces.findIndex((p) => p.id === placeId);
    
    if (index !== -1 && index < dayPlaces.length - 1) {
      // Scambia con l'elemento successivo
      const newOrderIds = [...dayPlaces.map((p) => p.id)];
      const temp = newOrderIds[index + 1];
      newOrderIds[index + 1] = newOrderIds[index];
      newOrderIds[index] = temp;

      const reordered = PlannerEngine.reorderPlacesInDay(dayPlaces, newOrderIds);
      
      const otherPlaces = places.filter((p) => p.assignedDay !== dayNumber);
      const finalTripPlaces = [...otherPlaces, ...reordered];
      usePlaceStore.setState((state) => ({
        places: {
          ...state.places,
          [tripId]: finalTripPlaces,
        },
      }));
    }
  },

  getDayTimeline: (tripId: string, dayNumber: number): DayTimelineSummary => {
    const places = usePlaceStore.getState().places[tripId] || [];
    const dayPlaces = places.filter((p) => p.assignedDay === dayNumber);
    return PlannerEngine.generateDayTimeline(dayPlaces, dayNumber, 9); // Parte alle 09:00 del mattino
  },

  getUnassignedPlaces: (tripId: string): TravelPlace[] => {
    const places = usePlaceStore.getState().places[tripId] || [];
    return places.filter((p) => p.assignedDay === undefined || p.assignedDay === null);
  },
  };
});
