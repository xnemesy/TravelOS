import { PlaceRepository, SearchOptions } from '../../domain/repositories/PlaceRepository';
import { Place } from '../../domain/models/Place';
import { Coordinates } from '../../domain/valueObjects/Coordinates';
import { TravelBackendService } from '../services/TravelBackendService';

export class TravelBackendRepository implements PlaceRepository {
  async searchPlaces(options: SearchOptions): Promise<Place[]> {
    return TravelBackendService.searchPlaces(options);
  }

  async autocomplete(query: string, location?: Coordinates): Promise<Place[]> {
    return TravelBackendService.autocomplete(query, location);
  }

  async getPlaceDetails(placeId: string): Promise<Place> {
    return TravelBackendService.getPlaceDetails(placeId);
  }

  async getMultipleDetails(placeIds: string[]): Promise<Place[]> {
    return Promise.all(placeIds.map(id => this.getPlaceDetails(id)));
  }

  async prefetch(placeIds: string[]): Promise<void> {
    // Warm up logic (e.g. background pre-fetch)
    return Promise.resolve();
  }
}
