import { create } from 'zustand';
import { Trip, TripEvent, TripTravelers } from '../../../domain/trip/models/trip.model';
import { TripRepository } from '../../../domain/trip/repositories/trip.repository';
import { MMKVAdapter } from '../../../core/storage/mmkv.adapter';
import { getAutoCoverForDestination } from '../utils/cover-matcher';
import { eventBus } from '../../../core/events/event-bus';
import { placesEngine, timelineEngine, contextEngine } from '../../../core/engines';
import { TravelServices } from '../../../domain/providers/TravelServices';
import { TripLifecycleWatcher } from '../../../core/engines/lifecycle/trip-lifecycle.watcher';

const USE_REAL_PLACES = process.env.EXPO_PUBLIC_USE_REAL_PLACES === 'true';

// Istanziamo il repository offline-first con MMKV
const storageAdapter = new MMKVAdapter();
const tripRepository = new TripRepository(storageAdapter);

// Sprint 15 (ADR-015 §2.6, Domain Lifecycle) — osserva le transizioni derivate
// di ciascun trip caricato e pubblica TripStarted/TripCompleted sull'Event Bus.
// Fire-and-forget: non altera i tempi/il comportamento di loadTrips() verso la UI.
const tripLifecycleWatcher = new TripLifecycleWatcher(storageAdapter, eventBus);

interface TripState {
  trips: Trip[];
  activeTripId: string | null;
  events: Record<string, TripEvent[]>;
  isLoading: boolean;
  
  // Actions
  setActiveTrip: (id: string) => void;
  loadTrips: () => Promise<void>;
  createTrip: (data: { title: string; destination: string; startDate: Date; endDate: Date; emoji?: string; currency?: string; coverImageUrl?: string; travelers?: TripTravelers; budgetAmount?: number }) => Promise<Trip>;
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

      // Osservazione lifecycle non bloccante: non fa parte del contratto di
      // loadTrips() verso la UI, quindi non viene attesa (fire-and-forget,
      // errori già gestiti internamente dal watcher per singolo trip).
      loadedTrips.forEach((trip) => {
        void tripLifecycleWatcher.checkTransition(trip);
      });
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
      travelers: data.travelers,
      budgetAmount: data.budgetAmount,
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

    eventBus.publish({
      id: `evt-${Date.now()}`,
      type: 'TripCreated',
      timestamp: new Date().toISOString(),
      tripId: newTrip.id,
      payload: newTrip,
    });

    return newTrip;
  },

  updateTrip: async (id: string, updates: Partial<Trip>) => {
    const updated = await tripRepository.updateTrip(id, updates);
    set((state) => ({
      trips: state.trips.map(t => t.id === id ? updated : t)
    }));

    eventBus.publish({
      id: `evt-${Date.now()}`,
      type: 'TripUpdated',
      timestamp: new Date().toISOString(),
      tripId: id,
      payload: updated,
    });

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

    eventBus.publish({
      id: `evt-${Date.now()}`,
      type: 'TripDeleted',
      timestamp: new Date().toISOString(),
      tripId: id,
      payload: { id },
    });
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
  if (event.type === 'TripUpdated' || event.type === 'TripDeleted') return;
  const tripId = event.tripId;
  try {
    const store = useTripStore.getState();
    const trip = store.getTripById(tripId);
    if (!trip) return;

    const places = await placesEngine.getSavedPlaces(tripId);
    const savedPlacesCount = places.length;

    // Attende che il ContextEngine abbia idratato questo trip prima di fidarsi
    // del suo stato (ADR-020): senza questa attesa, un fatto di dominio che
    // arriva mentre il trip non è ancora 'ready' leggerebbe il placeholder
    // onesto (journeyScore/timeline vuoti) come se fosse la verità, rischiando
    // di persistere progress/stats azzerati sopra valori reali. `ensureHydrated`
    // è la stessa barriera già usata da `hydrateContext`/`useTravelContext` —
    // nessun nuovo meccanismo, nessuna attesa arbitraria: si risolve non appena
    // l'idratazione (già in corso o già conclusa) lo è davvero.
    await contextEngine.ensureHydrated(tripId);
    const context = contextEngine.getContext(tripId);
    if (context.hydrationStatus !== 'ready') {
      // Idratazione fallita (vedi ContextEngine.runHydration) o trip nel
      // frattempo eliminato: mai persistere valori derivati da un placeholder.
      return;
    }

    // Progresso allineato al Journey Score 2.0 calcolato dal Context Engine
    const planProgress = context.journeyScore;
    const organizedDaysCount = context.timeline?.days?.filter(d => d.places?.length > 0).length || 0;

    // `stats` è opzionale nello schema Trip (e il repository restituisce comunque
    // trip che falliscono la validazione Zod): un trip legacy/deserializzato può
    // non averlo. Senza il fallback qui, `trip.stats.savedPlaces` lancerebbe e
    // l'errore verrebbe inghiottito dal catch → progress/stats mai aggiornati.
    const currentStats = trip.stats ?? {};
    if (
      trip.progress === planProgress &&
      currentStats.savedPlaces === savedPlacesCount &&
      currentStats.organizedDays === organizedDaysCount
    ) {
      return; // Evita loop infiniti e aggiornamenti circolari se lo stato è invariato
    }

    await store.updateTrip(tripId, {
      progress: planProgress,
      stats: {
        ...trip.stats,
        savedPlaces: savedPlacesCount,
        organizedDays: organizedDaysCount,
      }
    });
  } catch (error) {
    // Ignora errori di aggiornamento su trip mock/non presenti nel repository locale
    if (process.env.NODE_ENV === 'development') {
      // console.debug('[trip.store] Aggiornamento ignorato per trip assente/mock:', tripId);
    }
  }
});

// Registra il provider dinamico nel Context Engine per risolvere le date e info reali del Trip
contextEngine.registerTripProvider((id) => {
  return useTripStore.getState().getTripById(id);
});
