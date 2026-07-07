import axios, { AxiosInstance } from 'axios';
import { env } from '../../config/env';
import { Place } from '../../models/Place';
import { PlacesProvider, PlacesSearchOptions } from '../core/PlacesProvider';

class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF-OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold = 3;
  private readonly cooldownPeriod = 10000; // 10 seconds

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.cooldownPeriod) {
        this.state = 'HALF-OPEN';
      } else {
        throw new Error('Circuit Breaker is OPEN: Google Places API is currently unreachable.');
      }
    }

    try {
      const result = await fn();
      if (this.state === 'HALF-OPEN') {
        this.state = 'CLOSED';
        this.failureCount = 0;
      }
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
      }
      throw error;
    }
  }

  getStatus() {
    return this.state;
  }
}

export class GooglePlacesProvider implements PlacesProvider {
  private readonly baseUrl = 'https://places.googleapis.com/v1';
  private axiosInstance: AxiosInstance;
  private circuitBreaker = new CircuitBreaker();

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 4000,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
      },
    });

    // Retry interceptor (1 retry)
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config;
        if (!config || config.__isRetryRequest) {
          return Promise.reject(error);
        }

        const isNetworkError = !error.response;
        const isServerError = error.response && error.response.status >= 500;
        const isTimeout = error.code === 'ECONNABORTED';

        if (isNetworkError || isServerError || isTimeout) {
          config.__isRetryRequest = true;
          await new Promise((resolve) => setTimeout(resolve, 500));
          return this.axiosInstance(config);
        }

        return Promise.reject(error);
      }
    );
  }

  private calculateVisitDuration(types: string[]): number {
    if (!types) return 60;
    if (types.some(t => t === 'museum' || t === 'art_gallery')) {
      return 120; // 2 ore
    }
    if (types.some(t => t === 'church' || t === 'place_of_worship' || t === 'cathedral' || t === 'temple' || t === 'mosque')) {
      return 30; // 30 min
    }
    if (types.some(t => t === 'park' || t === 'national_park' || t === 'zoo' || t === 'amusement_park' || t === 'garden')) {
      return 60; // 1 ora
    }
    if (types.some(t => t === 'restaurant' || t === 'food' || t === 'dinner' || t === 'meal_takeaway')) {
      return 75; // 1h 15m
    }
    if (types.some(t => t === 'cafe' || t === 'bar' || t === 'liquor_store' || t === 'coffee_shop')) {
      return 30; // 30 min
    }
    if (types.some(t => t === 'tourist_attraction' || t === 'monument' || t === 'landmark' || t === 'historical_landmark')) {
      return 20; // 20 min
    }
    return 60; // 1 ora default
  }

  private mapGooglePlaceToDomain(gPlace: any): Place {
    const photoName = gPlace.photos?.[0]?.name;
    const photoUrl = photoName 
      ? `/api/places/photo/${encodeURIComponent(photoName)}`
      : undefined;

    // Semplice estrazione di città/nazione da formattedAddress
    const addressParts = gPlace.formattedAddress?.split(',') || [];
    const country = addressParts[addressParts.length - 1]?.trim();
    const city = addressParts[addressParts.length - 2]?.trim();

    return {
      id: gPlace.id,
      providerPlaceId: gPlace.id,
      name: gPlace.displayName?.text || '',
      description: gPlace.editorialSummary?.text,
      categories: gPlace.types || ['attraction'],
      rating: gPlace.rating ? {
        score: gPlace.rating,
        reviewCount: gPlace.userRatingCount || 0
      } : undefined,
      coordinates: {
        latitude: gPlace.location?.latitude || 0,
        longitude: gPlace.location?.longitude || 0
      },
      openingHours: gPlace.currentOpeningHours?.weekdayDescriptions,
      priceLevel: gPlace.priceLevel === 'PRICE_LEVEL_FREE' ? 0 : 
                  gPlace.priceLevel === 'PRICE_LEVEL_INEXPENSIVE' ? 1 :
                  gPlace.priceLevel === 'PRICE_LEVEL_MODERATE' ? 2 :
                  gPlace.priceLevel === 'PRICE_LEVEL_EXPENSIVE' ? 3 :
                  gPlace.priceLevel === 'PRICE_LEVEL_VERY_EXPENSIVE' ? 4 : undefined,
      website: gPlace.websiteUri,
      phone: gPlace.internationalPhoneNumber,
      photoUrl,
      editorialSummary: gPlace.editorialSummary?.text,
      visitDuration: { minutes: this.calculateVisitDuration(gPlace.types || []) },
      formattedAddress: gPlace.formattedAddress,
      city,
      country,
      providerUri: gPlace.googleMapsUri,
    };
  }

  async search(options: PlacesSearchOptions): Promise<Place[]> {
    return this.circuitBreaker.execute(async () => {
      const fieldMask = 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.websiteUri,places.internationalPhoneNumber,places.photos,places.editorialSummary,places.types,places.currentOpeningHours,places.googleMapsUri';
      
      const payload: any = {
        textQuery: options.query || 'tourist attractions',
        languageCode: options.language || 'it',
      };

      if (options.location) {
        payload.locationBias = {
          circle: {
            center: {
              latitude: options.location.lat,
              longitude: options.location.lng
            },
            radius: options.radius || 5000
          }
        };
      }

      const response = await this.axiosInstance.post('/places:searchText', payload, {
        headers: { 'X-Goog-FieldMask': fieldMask }
      });

      const places = response.data.places || [];
      return places.map((p: any) => this.mapGooglePlaceToDomain(p));
    });
  }

  async autocomplete(query: string, location?: { lat: number; lng: number; }): Promise<Place[]> {
    return this.circuitBreaker.execute(async () => {
      const payload: any = {
        input: query,
        languageCode: 'it',
      };

      if (location) {
        payload.locationBias = {
          circle: {
            center: { latitude: location.lat, longitude: location.lng },
            radius: 5000
          }
        };
      }

      const response = await this.axiosInstance.post('/places:autocomplete', payload);
      const suggestions = response.data.suggestions || [];

      // Mappiamo le predizioni a scheletri Place per compatibilità
      return suggestions.map((s: any) => {
        const pred = s.placePrediction;
        return {
          id: pred.placeId,
          providerPlaceId: pred.placeId,
          name: pred.structuredFormat?.mainText?.text || pred.text?.text || '',
          categories: ['attraction'],
          coordinates: { latitude: 0, longitude: 0 },
          formattedAddress: pred.structuredFormat?.secondaryText?.text,
        } as Place;
      });
    });
  }

  async details(providerPlaceId: string): Promise<Place> {
    return this.circuitBreaker.execute(async () => {
      const fieldMask = 'id,displayName,formattedAddress,location,rating,userRatingCount,priceLevel,websiteUri,internationalPhoneNumber,photos,editorialSummary,types,currentOpeningHours,googleMapsUri';
      
      const response = await this.axiosInstance.get(`/places/${providerPlaceId}`, {
        headers: { 'X-Goog-FieldMask': fieldMask },
        params: { languageCode: 'it' }
      });

      return this.mapGooglePlaceToDomain(response.data);
    });
  }

  async getPhotoMedia(photoName: string): Promise<ArrayBuffer> {
    const response = await axios.get(`${this.baseUrl}/${photoName}/media`, {
      params: {
        key: env.GOOGLE_PLACES_API_KEY,
        maxHeightPx: 800
      },
      responseType: 'arraybuffer'
    });
    return response.data;
  }

  getStatus() {
    return this.circuitBreaker.getStatus();
  }
}
