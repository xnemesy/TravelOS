import { IPlacesEngine, IContextEngine } from '../types/engines.types';
import { PlaceRef, TravelContext } from '../types/context.types';
import { eventBus } from '../../events/event-bus';
import { MMKVAdapter } from '../../storage/mmkv.adapter';
import { PlaceMergeEngine } from '../../../domain/trip/engine/PlaceMergeEngine';

const localDb = new MMKVAdapter();

/**
 * ============================================================================
 * PLACES ENGINE (FASE 1)
 * ============================================================================
 * Responsabilità: Gestione catalogo luoghi, preferiti, salvati e visitati.
 * Regole:
 * - Orchestra i flussi e lo storage (MMKV -> Repository -> Engine).
 * - Pubblica il proprio stato nel Context Engine senza interrogazioni continue.
 * - Emette Domain Facts sull'Event Bus in caso di modifiche.
 */
export class PlacesEngine implements IPlacesEngine {
  // In-memory store locale per la Fase 1, predisposto per essere sostituito da un Repository MMKV/SQLite
  private savedPlacesMap: Map<string, PlaceRef[]> = new Map();
  private visitedPlacesSet: Set<string> = new Set();

  constructor(contextEngine: IContextEngine) {
    // Registra la propria slice di stato nel Context Engine per la composizione reattiva
    contextEngine.registerStatePublisher('PlacesEngine', (tripId: string) =>
      this.publishStateSlice(tripId)
    );
  }

  public async getSavedPlaces(tripId: string): Promise<PlaceRef[]> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    if (!this.savedPlacesMap.has(cleanTripId)) {
      const persisted = await localDb.get<PlaceRef[]>(`places_${cleanTripId}`);
      if (persisted) {
        this.savedPlacesMap.set(cleanTripId, persisted);
      } else {
        this.savedPlacesMap.set(cleanTripId, []);
      }
    }
    return this.savedPlacesMap.get(cleanTripId) || [];
  }

  public async getPlaceDetails(placeId: string): Promise<PlaceRef | null> {
    const cleanPlaceId = Array.isArray(placeId) ? placeId[0] : String(placeId || '');
    for (const [_, places] of this.savedPlacesMap) {
      const found = places.find((p) => p.id === cleanPlaceId);
      if (found) return found;
    }
    return null;
  }

  public async savePlace(tripId: string, place: PlaceRef): Promise<void> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const current = await this.getSavedPlaces(cleanTripId);
    if (!current.some((p) => p.id === place.id)) {
      // Controllo deduplicazione conservativa (distanza < 30m e similarità nome > 90%)
      const existingDuplicate = current.find((p) =>
        PlaceMergeEngine.isSamePlace(
          { name: p.name, lat: p.coordinates?.latitude, lon: p.coordinates?.longitude },
          { name: place.name, lat: place.coordinates?.latitude, lon: place.coordinates?.longitude }
        )
      );

      if (existingDuplicate) {
        // Unifichiamo i dati invece di aggiungere un duplicato
        const merged: PlaceRef = {
          ...existingDuplicate,
          name: place.name || existingDuplicate.name,
          coverImageUrl: place.coverImageUrl || existingDuplicate.coverImageUrl,
          address: place.address || existingDuplicate.address,
          rating: place.rating || existingDuplicate.rating,
        };
        const updated = current.map((p) => (p.id === existingDuplicate.id ? merged : p));
        this.savedPlacesMap.set(cleanTripId, updated);
        await localDb.set(`places_${cleanTripId}`, updated);
        
        // Emette il Domain Fact per forzare l'aggiornamento delle statistiche nello store
        eventBus.publish({
          id: `evt-${Date.now()}`,
          type: 'PlaceSaved',
          timestamp: new Date().toISOString(),
          tripId: cleanTripId,
          payload: {
            placeId: existingDuplicate.id,
            name: merged.name,
            category: merged.category,
            latitude: merged.coordinates.latitude,
            longitude: merged.coordinates.longitude,
          },
        });
        return;
      }

      const updated = [...current, place];
      this.savedPlacesMap.set(cleanTripId, updated);
      await localDb.set(`places_${cleanTripId}`, updated);

      // Emette il Domain Fact
      eventBus.publish({
        id: `evt-${Date.now()}`,
        type: 'PlaceSaved',
        timestamp: new Date().toISOString(),
        tripId: cleanTripId,
        payload: {
          placeId: place.id,
          name: place.name,
          category: place.category,
          latitude: place.coordinates.latitude,
          longitude: place.coordinates.longitude,
        },
      });
    }
  }

  public async removePlace(tripId: string, placeId: string): Promise<void> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const cleanPlaceId = Array.isArray(placeId) ? placeId[0] : String(placeId || '');
    const current = await this.getSavedPlaces(cleanTripId);
    const filtered = current.filter((p) => p.id !== cleanPlaceId);
      this.savedPlacesMap.set(cleanTripId, filtered);
      await localDb.set(`places_${cleanTripId}`, filtered);

    eventBus.publish({
      id: `evt-${Date.now()}`,
      type: 'PlaceRemoved',
      timestamp: new Date().toISOString(),
      tripId: cleanTripId,
      payload: { placeId: cleanPlaceId },
    });
  }

  public async markAsVisited(tripId: string, placeId: string, isVisited: boolean = true): Promise<void> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const cleanPlaceId = Array.isArray(placeId) ? placeId[0] : String(placeId || '');
    if (isVisited) {
      this.visitedPlacesSet.add(`${cleanTripId}:${cleanPlaceId}`);
    } else {
      this.visitedPlacesSet.delete(`${cleanTripId}:${cleanPlaceId}`);
    }

    // Aggiorna lo stato nel luogo salvato se presente
    const current = await this.getSavedPlaces(cleanTripId);
    const updated = current.map((p) => (p.id === cleanPlaceId ? { ...p, isVisited } : p));
    this.savedPlacesMap.set(cleanTripId, updated);
    await localDb.set(`places_${cleanTripId}`, updated);

    eventBus.publish({
      id: `evt-${Date.now()}`,
      type: 'PlaceVisited',
      timestamp: new Date().toISOString(),
      tripId: cleanTripId,
      payload: {
        placeId: cleanPlaceId,
        isVisited,
        visitedAt: new Date().toISOString(),
      },
    });
  }

  public async updatePlaceNotes(tripId: string, placeId: string, notes: string): Promise<void> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const cleanPlaceId = Array.isArray(placeId) ? placeId[0] : String(placeId || '');
    const current = await this.getSavedPlaces(cleanTripId);
    const updated = current.map((p) => (p.id === cleanPlaceId ? { ...p, notes } : p));
    this.savedPlacesMap.set(cleanTripId, updated);
    await localDb.set(`places_${cleanTripId}`, updated);

    // Emette Domain Fact per ricomporre reattivamente lo stato nel ContextEngine e nella Timeline
    eventBus.publish({
      id: `evt-${Date.now()}`,
      type: 'PlaceNotesUpdated',
      timestamp: new Date().toISOString(),
      tripId: cleanTripId,
      payload: {
        placeId: cleanPlaceId,
        notes,
      },
    });
  }

  /**
   * Ritorna la slice di stato da pubblicare nel Context Engine.
   */
  private publishStateSlice(tripId: string): Partial<TravelContext> {
    const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
    const places = this.savedPlacesMap.get(cleanTripId) || [];
    const visitedPlaces = places.filter((p) => p.isVisited || this.visitedPlacesSet.has(`${cleanTripId}:${p.id}`));

    return {
      savedPlaces: places,
      visitedPlaces,
      savedPlacesCount: places.length,
      visitedPlacesCount: visitedPlaces.length,
      nearbyPlacesOfInterest: places.slice(0, 5), // Slice reattiva dei luoghi di interesse vicini
    };
  }
}
