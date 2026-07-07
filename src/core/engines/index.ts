import { ContextEngine } from './context/context.engine';
import { PlacesEngine } from './places/places.engine';
import { TimelineEngine } from './timeline/timeline.engine';
import { eventBus } from '../events/event-bus';

/**
 * ============================================================================
 * CORE ENGINES REGISTRY & DEPENDENCY INJECTION (FASE 1)
 * ============================================================================
 * Inizializza e collega le singole istanze singleton degli Engine core
 * per la Fase 1 di Travel OS: Context, Places e Timeline.
 */

// 1. Inizializza il Context Engine (il compositore reattivo)
export const contextEngine = new ContextEngine();

// 2. Inizializza i motori di dominio della Fase 1 iniettando il compositore
export const placesEngine = new PlacesEngine(contextEngine);
export const timelineEngine = new TimelineEngine(contextEngine);

import { allMockPlaces } from '../../features/trips/mock/budapest.mock';
import { PlaceRef } from './types/context.types';

// Registry unificato
export const engines = {
  context: contextEngine,
  places: placesEngine,
  timeline: timelineEngine,
};

// Metodo per forzare il caricamento asincrono e sincronizzare il ContextEngine
export async function hydrateContext(tripId: string) {
  const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
  await placesEngine.getSavedPlaces(cleanTripId);
  await timelineEngine.getTripTimeline(cleanTripId);

  // Emette un evento fittizio per forzare il ricalcolo del ContextEngine
  eventBus.publish({
    id: `evt-hydrate-${Date.now()}`,
    type: 'PlaceSaved', // Evento valido per triggerare il ricalcolo
    timestamp: new Date().toISOString(),
    tripId: cleanTripId,
    payload: { placeId: 'hydrate' } as any,
  });
}

// Re-export dei tipi core
export * from './types/context.types';
export * from './types/engines.types';
export * from './types/events.types';
