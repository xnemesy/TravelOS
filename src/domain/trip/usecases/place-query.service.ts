import { PlacesProviderAdapter } from '../../providers/travel-providers.types';
import { ResolvedPlace, ResolvedPlaceSource } from '../../../core/engines/types/context.types';
import { EDITORIAL_PLACES_CATALOG } from '../../../features/places/catalog/editorial-places.catalog';
import { placesEngine } from '../../../core/engines';
import { TravelServices } from '../../providers/TravelServices';

/**
 * ============================================================================
 * PLACE QUERY SERVICE (Application / Query Service)
 * ============================================================================
 * ADR-017 / Transient Place Resolver Pattern.
 * Orchestrates reading places by first checking the active PlacesEngine
 * (Source of Truth) and falling back to the configured Place Provider
 * for missing/transient places.
 */
export class PlaceQueryService {
  constructor(
    private readonly provider: PlacesProviderAdapter = TravelServices.places()
  ) {}

  /**
   * Resolves a placeId into a Projected `ResolvedPlace` for the UI.
   *
   * RESOLUTION POLICY:
   * If a persisted place exists in PlacesEngine, it is always considered the source of truth.
   * Provider data must never overwrite or shadow persisted user data during a read-only resolution.
   * External providers are consulted only when no place exists for the requested identifier.
   */
  public async resolvePlace(tripId: string, placeId: string): Promise<ResolvedPlace | null> {
    // 1. Check active PlacesEngine (Source of Truth)
    const savedPlaces = await placesEngine.getSavedPlaces(tripId);
    let existing = savedPlaces.find(p => p.id === placeId);

    if (!existing) {
      const placeDetails = await placesEngine.getPlaceDetails(placeId);
      if (placeDetails) {
        existing = placeDetails;
      }
    }

    if (existing) {
      return {
        place: existing,
        isTransient: false,
        source: 'saved',
      };
    }

    // 1b. Catalogo editoriale (statico)
    const catalogItem = EDITORIAL_PLACES_CATALOG.find(item => item.id === placeId);
    if (catalogItem) {
      const coords = catalogItem.baseData.location?.coordinates;
      return {
        place: {
          id: catalogItem.id,
          name: catalogItem.baseData.name,
          category: catalogItem.baseData.category as any,
          coordinates: coords ? {
            latitude: coords.lat,
            longitude: coords.lng,
          } : undefined,
          coverImageUrl: catalogItem.baseData.coverImageUrl,
          address: catalogItem.baseData.location?.address,
          rating: catalogItem.baseData.rating,
          durationMinutes: catalogItem.recommendedDurationMinutes || 60,
          isVisited: false,
        },
        isTransient: true,
        source: 'editorial',
      };
    }

    // 2. Fetch from Provider (Transient fallback)
    const metadata = await this.provider.getPlaceDetails(placeId);
    if (!metadata) {
      return null;
    }

    // Derive source type
    let source: ResolvedPlaceSource = 'mock';
    if (metadata.placeId.startsWith('google') || metadata.googleMapsUrl) source = 'google';
    else if (metadata.placeId.startsWith('osm')) source = 'osm';
    else if (metadata.placeId.startsWith('apple') || metadata.appleMapsUrl) source = 'apple';

    return {
      place: {
        id: metadata.placeId,
        name: metadata.name,
        category: (metadata.category || 'other') as any,
        coordinates: {
          latitude: metadata.lat,
          longitude: metadata.lon,
        },
        coverImageUrl: metadata.coverImageUrl || metadata.photoUrls?.[0],
        address: metadata.formattedAddress,
        rating: metadata.rating,
        durationMinutes: metadata.durationMinutes || 60,
        isVisited: false,
      },
      isTransient: true,
      source,
    };
  }
}

export const placeQueryService = new PlaceQueryService(
  TravelServices.places()
);
