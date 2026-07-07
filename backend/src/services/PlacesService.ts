import { PlacesProvider, PlacesSearchOptions } from '../providers/core/PlacesProvider';
import { GooglePlacesProvider } from '../providers/google/GooglePlacesProvider';
import { Place } from '../models/Place';

export class PlacesService {
  private provider: PlacesProvider;

  constructor() {
    // Dependency Injection base: per ora usiamo Google Places
    this.provider = new GooglePlacesProvider();
  }

  async search(options: PlacesSearchOptions): Promise<Place[]> {
    // Qui in futuro: validazione, cache redis/firestore, logica di normalizzazione
    return this.provider.search(options);
  }

  async autocomplete(query: string, location?: { lat: number, lng: number }): Promise<Place[]> {
    return this.provider.autocomplete(query, location);
  }

  async getDetails(providerPlaceId: string): Promise<Place> {
    return this.provider.details(providerPlaceId);
  }
}

export const placesService = new PlacesService();
