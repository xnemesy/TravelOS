import { PlaceRepository, SearchOptions } from '../../domain/repositories/PlaceRepository';
import { Place } from '../../domain/models/Place';
import { PlaceCategory } from '../../domain/models/PlaceCategory';

export class MockPlaceRepository implements PlaceRepository {
  private mockPlaces: Place[] = [
    {
      id: 'mock-colosseo',
      providerPlaceId: 'google-colosseo-123',
      name: 'Colosseo',
      categories: [PlaceCategory.attraction],
      coordinates: { latitude: 41.8902, longitude: 12.4922 },
      rating: { score: 4.8, reviewCount: 310000 },
      priceLevel: 3,
      photoUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80',
      visitDuration: { minutes: 120 },
      walkingFriendly: true,
      indoor: false,
      outdoor: true,
      formattedAddress: 'Piazza del Colosseo, 1, 00184 Roma RM, Italia',
      city: 'Roma',
      country: 'Italia',
    },
    {
      id: 'mock-louvre',
      providerPlaceId: 'google-louvre-456',
      name: 'Museo del Louvre',
      categories: [PlaceCategory.museum, PlaceCategory.attraction],
      coordinates: { latitude: 48.8606, longitude: 2.3376 },
      rating: { score: 4.8, reviewCount: 260000 },
      priceLevel: 3,
      photoUrl: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=800&q=80',
      visitDuration: { minutes: 180 },
      walkingFriendly: true,
      indoor: true,
      outdoor: false,
      formattedAddress: 'Rue de Rivoli, 75001 Paris, Francia',
      city: 'Paris',
      country: 'Francia',
    }
  ];

  async searchPlaces(options: SearchOptions): Promise<Place[]> {
    return this.mockPlaces;
  }

  async autocomplete(query: string, location?: any): Promise<Place[]> {
    const lowerQuery = query.toLowerCase();
    return this.mockPlaces.filter(p => p.name.toLowerCase().includes(lowerQuery));
  }

  async getPlaceDetails(placeId: string): Promise<Place> {
    const place = this.mockPlaces.find(p => p.id === placeId);
    if (!place) {
      throw new Error(`Place with id ${placeId} not found`);
    }
    return place;
  }

  async getMultipleDetails(placeIds: string[]): Promise<Place[]> {
    return this.mockPlaces.filter(p => placeIds.includes(p.id));
  }

  async prefetch(placeIds: string[]): Promise<void> {
    // Simulate prefetching (e.g. warming up MMKV cache)
    return Promise.resolve();
  }
}
