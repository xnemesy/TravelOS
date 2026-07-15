import { ContextEngine } from './context/context.engine';
import { PlacesEngine } from './places/places.engine';
import { TimelineEngine } from './timeline/timeline.engine';
import { TripSetupEngine } from './trip-setup/trip-setup.engine';
import { MMKVAdapter } from '../storage/mmkv.adapter';
import { PlacesRepository } from './places/places.repository';
import { TimelineRepository } from './timeline/timeline.repository';
import { TripSetupRepository } from './trip-setup/trip-setup.repository';
import { TripRepository } from '../../domain/trip/repositories/trip.repository';

/**
 * ============================================================================
 * CORE ENGINES REGISTRY & DEPENDENCY INJECTION (FASE 1)
 * ============================================================================
 * Inizializza e collega le singole istanze singleton degli Engine core
 * per la Fase 1 di Travel OS: Context, Places e Timeline.
 *
 * ADR-021 (Repository Abstraction): unico punto in cui gli Engine vengono
 * legati a un'implementazione concreta di persistenza. Gli Engine stessi
 * dipendono solo dalle interfacce (`I*Repository`) — MMKV/AsyncStorage restano
 * un dettaglio noto esclusivamente qui e dentro le implementazioni concrete.
 */
const storageAdapter = new MMKVAdapter();
const placesRepository = new PlacesRepository(storageAdapter);
const tripSetupRepository = new TripSetupRepository(storageAdapter);
// TimelineRepository risolve l'intervallo di date del trip delegando a
// ITripRepository (non conosce la chiave/formato del repository dei Trip).
// Istanza indipendente da quella di `trip.store.ts` (stesso storage
// sottostante, `TripRepository` è stateless — nessuna cache propria, quindi
// due istanze restano sempre coerenti) per evitare un import circolare:
// `trip.store.ts` già importa da questo stesso file (`placesEngine`/
// `timelineEngine`/`contextEngine`).
const tripRepositoryForTimeline = new TripRepository(storageAdapter);
const timelineRepository = new TimelineRepository(storageAdapter, tripRepositoryForTimeline);

// 1. Inizializza il Context Engine (il compositore reattivo)
export const contextEngine = new ContextEngine();

// 2. Inizializza i motori di dominio della Fase 1 iniettando il compositore e il proprio repository
export const placesEngine = new PlacesEngine(contextEngine, placesRepository);
// Transport Setup module (ADR-018 §7, adozione parziale — solo `transports`/
// `accommodations`). Costruito prima di TimelineEngine perché quest'ultimo lo
// riceve in iniezione per derivare i Journey Anchors (redesign JourneyComposer).
export const tripSetupEngine = new TripSetupEngine(contextEngine, tripSetupRepository);
export const timelineEngine = new TimelineEngine(contextEngine, timelineRepository, tripSetupEngine);

// Registry unificato
export const engines = {
  context: contextEngine,
  places: placesEngine,
  timeline: timelineEngine,
  tripSetup: tripSetupEngine,
};

// Forza (e attende) l'idratazione completa del ContextEngine per un trip — utile
// per schermate che vogliono mostrare uno stato di caricamento esplicito prima
// di renderizzare (es. `isHydrating` locale). Non è più l'unico modo in cui
// l'idratazione parte: `useTravelContext`/`ContextEngine.getContext` la
// innescano automaticamente al primo accesso (ADR-020) — questa funzione
// delega allo stesso `ensureHydrated`, quindi è idempotente e mai ridondante
// rispetto a un'idratazione già in corso o già conclusa.
export async function hydrateContext(tripId: string): Promise<void> {
  const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
  await contextEngine.ensureHydrated(cleanTripId);
}

// Re-export dei tipi core
export * from './types/context.types';
export * from './types/engines.types';
export * from './types/events.types';
