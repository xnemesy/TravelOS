import { SearchOptions } from '../../domain/repositories/PlaceRepository';
import { Place, PlaceSchema } from '../../domain/models/Place';
import { PlaceCategory } from '../../domain/models/PlaceCategory';
import { Coordinates } from '../../domain/valueObjects/Coordinates';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api';

function sanitizePlace(item: any): any {
  const validCategories = (item.categories || []).map((cat: string) => {
    return Object.values(PlaceCategory).includes(cat as any) ? cat : 'attraction';
  });
  return {
    ...item,
    categories: validCategories.length > 0 ? validCategories : ['attraction']
  };
}

export class TravelBackendService {
  static async searchPlaces(options: SearchOptions): Promise<Place[]> {
    const params = new URLSearchParams();
    if (options.query) params.append('query', options.query);
    if (options.category) params.append('category', options.category.join(','));
    if (options.location) {
      params.append('lat', options.location.latitude.toString());
      params.append('lng', options.location.longitude.toString());
    }
    if (options.radius) {
      params.append('radius', options.radius.value.toString());
    }
    if (options.openNow !== undefined) {
      params.append('openNow', options.openNow.toString());
    }
    if (options.minRating) {
      params.append('minRating', options.minRating.score.toString());
    }
    if (options.priceLevels) {
      params.append('priceLevels', options.priceLevels.join(','));
    }

    const res = await fetch(`${API_URL}/places/search?${params.toString()}`);
    if (!res.ok) throw new Error('Search failed');
    const data = await res.json();
    return (data as any[]).map((item: any) => PlaceSchema.parse(sanitizePlace(item)));
  }

  static async autocomplete(query: string, location?: Coordinates): Promise<Place[]> {
    const params = new URLSearchParams({ query });
    if (location) {
      params.append('lat', location.latitude.toString());
      params.append('lng', location.longitude.toString());
    }
    const res = await fetch(`${API_URL}/places/autocomplete?${params.toString()}`);
    if (!res.ok) throw new Error('Autocomplete failed');
    const data = await res.json();
    return (data as any[]).map((item: any) => PlaceSchema.parse(sanitizePlace(item)));
  }

  static async getPlaceDetails(placeId: string): Promise<Place> {
    const res = await fetch(`${API_URL}/places/${placeId}/details`);
    if (!res.ok) throw new Error(`Failed to get details for place ${placeId}`);
    const data = await res.json();
    return PlaceSchema.parse(sanitizePlace(data));
  }
}
