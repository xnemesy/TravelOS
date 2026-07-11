import { PlaceRef } from '../types/context.types';

/**
 * Persistenza dei luoghi salvati per trip (ADR-021 — Repository Abstraction).
 * `PlacesEngine` dipende solo da questo contratto: non conosce MMKV, chiavi di
 * storage o formato di cache.
 */
export interface IPlacesRepository {
  /** Luoghi salvati persistiti per il trip, o `null` se non è mai stato scritto nulla. */
  getPlaces(tripId: string): Promise<PlaceRef[] | null>;

  /** Sostituisce integralmente i luoghi salvati persistiti per il trip. */
  savePlaces(tripId: string, places: PlaceRef[]): Promise<void>;
}
