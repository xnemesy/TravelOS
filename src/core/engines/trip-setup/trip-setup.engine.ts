import { ITripSetupEngine, IContextEngine } from '../types/engines.types';
import { TravelContext } from '../types/context.types';
import { eventBus } from '../../events/event-bus';
import { ITripSetupRepository } from './trip-setup.repository.interface';
import {
  TripSetup,
  Transport,
  TransportSchema,
  Accommodation,
  AccommodationSchema,
} from '../../../domain/trip/models/trip-setup.model';

function generateTransportId(): string {
  return `transport-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

function generateAccommodationId(): string {
  return `accommodation-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * ============================================================================
 * TRIP SETUP ENGINE — Transport + Accommodation Setup modules (ADR-018 §7,
 * adozione parziale)
 * ============================================================================
 * Persiste l'aggregato satellite `TripSetup` (chiave `tripId`, mai embedded
 * in `Trip` — stesso pattern satellite di `TravelPlace`/ADR-017). Stessa
 * struttura di `PlacesEngine`: cache in-memory + publisher reattivo verso il
 * `ContextEngine`; ogni persistenza passa da `ITripSetupRepository` (ADR-021)
 * — l'Engine non conosce MMKV, chiavi di storage, formato cache né la
 * ricostruzione delle Date dai valori serializzati.
 *
 * Scope di questo modulo: solo le sezioni `transports`/`accommodations` di
 * TripSetup sono lette/scritte. Le altre sezioni (mobility/constraints/
 * documents/preferences) restano non toccate — un `TripSetup` con solo
 * queste due sezioni valorizzate e le altre `undefined` è uno stato
 * legittimo secondo ADR-018 §3.7 ("sezione non ancora affrontata"). Nessun
 * collegamento a `SetupCompletionEngine` o al Planner: esplicitamente fuori
 * scope qui.
 */
export class TripSetupEngine implements ITripSetupEngine {
  private cache: Map<string, TripSetup> = new Map();

  constructor(contextEngine: IContextEngine, private repository: ITripSetupRepository) {
    contextEngine.registerStatePublisher('TripSetupEngine', (tripId: string) =>
      this.publishStateSlice(tripId)
    );

    // Registra il proprio lifecycle di idratazione (ADR-020): il ContextEngine lo
    // attende prima di comporre uno stato per un trip.
    contextEngine.registerHydratable('TripSetupEngine', (tripId: string) =>
      this.hydrate(tripId)
    );
  }

  /**
   * Idrata da storage persistente lo stato di questo Engine per il trip indicato
   * (ADR-020). Delega al getter pigro esistente — nessun nuovo percorso di
   * caricamento, solo un nome esplicito per il contratto di idratazione.
   */
  public async hydrate(tripId: string): Promise<void> {
    await this.getTripSetup(tripId);
  }

  public async getTripSetup(tripId: string): Promise<TripSetup> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    if (!this.cache.has(cleanTripId)) {
      const persisted = await this.repository.getTripSetup(cleanTripId);
      if (persisted) {
        this.cache.set(cleanTripId, persisted);
      } else {
        const now = new Date();
        this.cache.set(cleanTripId, { tripId: cleanTripId, createdAt: now, updatedAt: now });
      }
    }
    return this.cache.get(cleanTripId)!;
  }

  public async getTransports(tripId: string): Promise<Transport[]> {
    const setup = await this.getTripSetup(tripId);
    return setup.transports || [];
  }

  public async addTransport(tripId: string, transport: Omit<Transport, 'id'>): Promise<Transport> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const setup = await this.getTripSetup(cleanTripId);

    // Convalida/normalizza tramite lo schema di dominio (default confirmed=false,
    // invariante arrivalDate >= departureDate) indipendentemente da qualunque
    // validazione già fatta a monte nella UI — difesa in profondità.
    const created: Transport = TransportSchema.parse({ ...transport, id: generateTransportId() });

    const updated: TripSetup = {
      ...setup,
      transports: [...(setup.transports || []), created],
      updatedAt: new Date(),
    };
    this.cache.set(cleanTripId, updated);
    await this.repository.saveTripSetup(cleanTripId, updated);

    eventBus.publish({
      id: `evt-${Date.now()}`,
      type: 'TransportAdded',
      timestamp: new Date().toISOString(),
      tripId: cleanTripId,
      payload: { transportId: created.id, mode: created.mode, destination: created.destination },
    });

    return created;
  }

  public async updateTransport(
    tripId: string,
    transportId: string,
    updates: Partial<Omit<Transport, 'id'>>
  ): Promise<Transport> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const setup = await this.getTripSetup(cleanTripId);
    const current = (setup.transports || []).find((t) => t.id === transportId);
    if (!current) {
      throw new Error(`Transport con id ${transportId} non trovato per il trip ${cleanTripId}.`);
    }

    const merged: Transport = TransportSchema.parse({ ...current, ...updates, id: current.id });

    const updatedSetup: TripSetup = {
      ...setup,
      transports: (setup.transports || []).map((t) => (t.id === transportId ? merged : t)),
      updatedAt: new Date(),
    };
    this.cache.set(cleanTripId, updatedSetup);
    await this.repository.saveTripSetup(cleanTripId, updatedSetup);

    eventBus.publish({
      id: `evt-${Date.now()}`,
      type: 'TransportUpdated',
      timestamp: new Date().toISOString(),
      tripId: cleanTripId,
      payload: { transportId: merged.id, mode: merged.mode, destination: merged.destination },
    });

    return merged;
  }

  public async removeTransport(tripId: string, transportId: string): Promise<void> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const setup = await this.getTripSetup(cleanTripId);
    const removed = (setup.transports || []).find((t) => t.id === transportId);

    const updatedSetup: TripSetup = {
      ...setup,
      transports: (setup.transports || []).filter((t) => t.id !== transportId),
      updatedAt: new Date(),
    };
    this.cache.set(cleanTripId, updatedSetup);
    await this.repository.saveTripSetup(cleanTripId, updatedSetup);

    eventBus.publish({
      id: `evt-${Date.now()}`,
      type: 'TransportRemoved',
      timestamp: new Date().toISOString(),
      tripId: cleanTripId,
      payload: { transportId, mode: removed?.mode || 'other', destination: removed?.destination || '' },
    });
  }

  public async getAccommodations(tripId: string): Promise<Accommodation[]> {
    const setup = await this.getTripSetup(tripId);
    return setup.accommodations || [];
  }

  public async addAccommodation(tripId: string, accommodation: Omit<Accommodation, 'id'>): Promise<Accommodation> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const setup = await this.getTripSetup(cleanTripId);

    // Difesa in profondità: normalizza tramite lo schema di dominio (default
    // confirmed=false, invariante checkOut > checkIn) indipendentemente dalla
    // validazione già fatta a monte nella UI.
    const created: Accommodation = AccommodationSchema.parse({ ...accommodation, id: generateAccommodationId() });

    const updated: TripSetup = {
      ...setup,
      accommodations: [...(setup.accommodations || []), created],
      updatedAt: new Date(),
    };
    this.cache.set(cleanTripId, updated);
    await this.repository.saveTripSetup(cleanTripId, updated);

    eventBus.publish({
      id: `evt-${Date.now()}`,
      type: 'AccommodationAdded',
      timestamp: new Date().toISOString(),
      tripId: cleanTripId,
      payload: { accommodationId: created.id, type: created.type, name: created.name },
    });

    return created;
  }

  public async updateAccommodation(
    tripId: string,
    accommodationId: string,
    updates: Partial<Omit<Accommodation, 'id'>>
  ): Promise<Accommodation> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const setup = await this.getTripSetup(cleanTripId);
    const current = (setup.accommodations || []).find((a) => a.id === accommodationId);
    if (!current) {
      throw new Error(`Accommodation con id ${accommodationId} non trovato per il trip ${cleanTripId}.`);
    }

    const merged: Accommodation = AccommodationSchema.parse({ ...current, ...updates, id: current.id });

    const updatedSetup: TripSetup = {
      ...setup,
      accommodations: (setup.accommodations || []).map((a) => (a.id === accommodationId ? merged : a)),
      updatedAt: new Date(),
    };
    this.cache.set(cleanTripId, updatedSetup);
    await this.repository.saveTripSetup(cleanTripId, updatedSetup);

    eventBus.publish({
      id: `evt-${Date.now()}`,
      type: 'AccommodationUpdated',
      timestamp: new Date().toISOString(),
      tripId: cleanTripId,
      payload: { accommodationId: merged.id, type: merged.type, name: merged.name },
    });

    return merged;
  }

  public async removeAccommodation(tripId: string, accommodationId: string): Promise<void> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const setup = await this.getTripSetup(cleanTripId);
    const removed = (setup.accommodations || []).find((a) => a.id === accommodationId);

    const updatedSetup: TripSetup = {
      ...setup,
      accommodations: (setup.accommodations || []).filter((a) => a.id !== accommodationId),
      updatedAt: new Date(),
    };
    this.cache.set(cleanTripId, updatedSetup);
    await this.repository.saveTripSetup(cleanTripId, updatedSetup);

    eventBus.publish({
      id: `evt-${Date.now()}`,
      type: 'AccommodationRemoved',
      timestamp: new Date().toISOString(),
      tripId: cleanTripId,
      payload: { accommodationId, type: removed?.type || 'other', name: removed?.name || '' },
    });
  }

  public async syncTransportsAndAccommodations(
    tripId: string,
    transports: Transport[],
    accommodations: Accommodation[]
  ): Promise<TripSetup> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const setup = await this.getTripSetup(cleanTripId);

    const updatedSetup: TripSetup = {
      ...setup,
      tripId: cleanTripId,
      transports,
      accommodations,
      updatedAt: new Date(),
    };
    this.cache.set(cleanTripId, updatedSetup);
    await this.repository.saveTripSetup(cleanTripId, updatedSetup);
    return updatedSetup;
  }

  private publishStateSlice(tripId: string): Partial<TravelContext> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const setup = this.cache.get(cleanTripId);
    const transports = setup?.transports || [];
    const accommodations = setup?.accommodations || [];
    return {
      transports,
      transportsCount: transports.length,
      accommodations,
      accommodationsCount: accommodations.length,
    };
  }
}
