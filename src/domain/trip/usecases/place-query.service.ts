import { IPlaceRepository } from '../repositories/place.repository';
import { PlacesProviderAdapter } from '../../providers/travel-providers.types';
import { ResolvedPlace, ResolvedPlaceSource } from '../../../core/engines/types/context.types';
import { PlaceMergeEngine } from '../engine/PlaceMergeEngine';
import { canonicalPlaceToPlaceRef } from '../../../core/engines/mappers/CanonicalPlaceToPlaceRef';
import { TravelPlace } from '../models/place.model';
import { EDITORIAL_PLACES_CATALOG } from '../../../features/places/catalog/editorial-places.catalog';

/**
 * ============================================================================
 * PLACE QUERY SERVICE (Application / Query Service)
 * ============================================================================
 * ADR-017 / Transient Place Resolver Pattern.
 * Orchestrates reading places by first checking the persisted repository
 * (Source of Truth) and falling back to the configured Place Provider
 * for missing/transient places.
 */
export class PlaceQueryService {
  constructor(
    private readonly repository: IPlaceRepository,
    private readonly provider: PlacesProviderAdapter
  ) {}

  /**
   * Resolves a placeId into a Projected `ResolvedPlace` for the UI.
   *
   * RESOLUTION POLICY:
   * If a persisted TravelPlace exists, it is always considered the source of truth.
   * Provider data must never overwrite or shadow persisted user data during a read-only resolution.
   * External providers are consulted only when no canonical place exists for the requested identifier.
   */
  public async resolvePlace(tripId: string, placeId: string): Promise<ResolvedPlace | null> {
    // 1. Check local repository (Source of Truth)
    const persistedPlaces = await this.repository.getPlacesByTripId(tripId);
    let existing: TravelPlace | undefined | null = persistedPlaces.find(p => p.id === placeId || p.externalProviderId === placeId);

    // Se non lo troviamo tra quelli del trip, cerchiamo per ID globale,
    // ma assicurandoci che non appartenga a un altro trip (isolamento).
    if (!existing) {
      existing = await this.repository.getPlaceById(placeId);
      if (existing && existing.tripId !== tripId) {
        existing = undefined; // Do not leak places across trips
      }
    }

    if (existing) {
      return {
        place: canonicalPlaceToPlaceRef(existing),
        isTransient: false,
        source: 'saved',
      };
    }

    // 1b. Catalogo editoriale (statico, ExternalPlace-shaped — ADR-017 §3.5,
    // "il catalogo editoriale diventa un secondo produttore legittimo...
    // tramite lo stesso PlaceMergeEngine"). Nessuna delle due fonti sopra/sotto
    // conosce questi id (`edit-*`): né il repository persistito né il provider
    // esterno. `mergeFromProvider` accetta `ExternalPlace` direttamente, senza
    // passare per `PlaceMetadata`.
    const catalogItem = EDITORIAL_PLACES_CATALOG.find(item => item.id === placeId);
    if (catalogItem) {
      const transientEditorialPlace = PlaceMergeEngine.mergeFromProvider(catalogItem.baseData, { tripId });
      return {
        place: canonicalPlaceToPlaceRef(transientEditorialPlace, {
          durationMinutes: catalogItem.recommendedDurationMinutes,
        }),
        isTransient: true,
        source: 'editorial',
      };
    }

    // 2. Fetch from Provider (Transient fallback)
    const metadata = await this.provider.getPlaceDetails(placeId);
    if (!metadata) {
      return null;
    }

    // 3. Build transient TravelPlace (In-Memory)
    const transientPlace = PlaceMergeEngine.mergeFromProvider(metadata, { tripId });

    // Derive source type (simple heuristic based on ID or providerName fallback)
    let source: ResolvedPlaceSource = 'mock';
    if (metadata.placeId.startsWith('google') || metadata.googleMapsUrl) source = 'google';
    else if (metadata.placeId.startsWith('osm')) source = 'osm';
    else if (metadata.placeId.startsWith('apple') || metadata.appleMapsUrl) source = 'apple';
    else if (transientPlace.editorial) source = 'editorial';

    // 4. Return projected ResolvedPlace
    return {
      place: canonicalPlaceToPlaceRef(transientPlace, {
        durationMinutes: metadata.durationMinutes,
      }),
      isTransient: true,
      source,
    };
  }
}

import { repository as localPlaceRepository } from '../../../features/places/store/place.store';
import { TravelServices } from '../../providers/TravelServices';

export const placeQueryService = new PlaceQueryService(
  localPlaceRepository,
  TravelServices.places()
);
