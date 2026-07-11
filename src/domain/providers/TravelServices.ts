import {
  WeatherProviderAdapter,
  RoutingProviderAdapter,
  OpeningHoursProviderAdapter,
  PlacesProviderAdapter,
  CurrencyProviderAdapter,
  TranslationProviderAdapter,
  WeatherCondition,
  DailyWeatherSummary,
  RouteEstimate,
  TimeWindow,
  PlaceOpeningStatus,
  PlaceMetadata,
  ExchangeRate,
  TravelTransportMode,
} from './travel-providers.types';
import {
  weatherProvider as mockWeather,
  routingProvider as mockRouting,
  openingHoursProvider as mockOpeningHours,
  placesProvider as mockPlaces,
  currencyProvider as mockCurrency,
  translationProvider as mockTranslation,
} from './mock-travel.providers';
import { CachedProvider } from './CachedProvider';
import { MMKVCacheRepository } from './mmkv-cache.repository';
import { MMKVAdapter } from '../../core/storage/mmkv.adapter';
import { RealPlacesAdapter } from './real-places.adapter';
import { PlaceRepository } from '../../core/domain/repositories/PlaceRepository';
import { MockPlaceRepository } from '../../core/infrastructure/repositories/MockPlaceRepository';
import { TravelBackendRepository } from '../../core/infrastructure/repositories/TravelBackendRepository';

const USE_REAL_PLACES = process.env.EXPO_PUBLIC_USE_REAL_PLACES === 'true';

// Storage condiviso per la persistenza delle cache (ADR-022): un solo
// MMKVAdapter, stateless, iniettato in un MMKVCacheRepository per namespace —
// stesso pattern "un repository per aggregato" di ADR-021.
const cacheStorageAdapter = new MMKVAdapter();

// Nuovo entry point architetturale per i luoghi (Sprint 12)
export const placeRepository: PlaceRepository = USE_REAL_PLACES 
  ? new TravelBackendRepository()
  : new MockPlaceRepository();

/**
 * ============================================================================
 * TRAVEL SERVICES (Service Integration Platform - SIP)
 * ============================================================================
 * Punto di accesso centralizzato e reattivo per tutti i servizi esterni
 * del dominio (Meteo, Rotte, Orari, Luoghi, Valute, Traduzioni).
 *
 * GESTIONE CONNETTIVITÀ AUTOMATICA:
 * Implementa il flusso invisibile:
 * Online -> Adapter Reale -> Salvataggio in Cache -> Offline -> Cache -> Mock Adapter
 */

export class TravelServicesPlatform {
  // Cache generiche unificate con TTL mirati — persistite in MMKV (ADR-022),
  // sopravvivono al riavvio dell'app in modo trasparente (nessun cambiamento
  // alla firma o al comportamento di .get()/.set() rispetto a prima).
  private weatherCache = new CachedProvider<WeatherCondition | DailyWeatherSummary>('Weather', 30 * 60 * 1000, {
    repository: new MMKVCacheRepository('Weather', cacheStorageAdapter),
    maxEntries: 200,
  });
  private routingCache = new CachedProvider<RouteEstimate>('Routing', 7 * 24 * 60 * 60 * 1000, {
    repository: new MMKVCacheRepository('Routing', cacheStorageAdapter),
    maxEntries: 200,
  });
  private openingHoursCache = new CachedProvider<TimeWindow[] | PlaceOpeningStatus | boolean>('OpeningHours', 24 * 60 * 60 * 1000, {
    repository: new MMKVCacheRepository('OpeningHours', cacheStorageAdapter),
    maxEntries: 200,
  });
  private placesCache = new CachedProvider<PlaceMetadata | PlaceMetadata[] | null>('Places', 7 * 24 * 60 * 60 * 1000, {
    repository: new MMKVCacheRepository('Places', cacheStorageAdapter),
    maxEntries: 300,
  });
  private currencyCache = new CachedProvider<ExchangeRate | number>('Currency', 12 * 60 * 60 * 1000, {
    repository: new MMKVCacheRepository('Currency', cacheStorageAdapter),
    maxEntries: 100,
  });
  private translationCache = new CachedProvider<string>('Translation', 30 * 24 * 60 * 60 * 1000, {
    repository: new MMKVCacheRepository('Translation', cacheStorageAdapter),
    maxEntries: 500,
  });

  // Adattatori reali opzionali (quando pronti in sprint futuri: Google, Apple, OpenMeteo)
  private realWeatherAdapter: WeatherProviderAdapter | null = null;
  private realRoutingAdapter: RoutingProviderAdapter | null = null;
  private realOpeningHoursAdapter: OpeningHoursProviderAdapter | null = null;
  private realPlacesAdapter: PlacesProviderAdapter | null = new RealPlacesAdapter();
  private realCurrencyAdapter: CurrencyProviderAdapter | null = null;
  private realTranslationAdapter: TranslationProviderAdapter | null = null;

  private _isOnline = true; // Simula stato rete odierno; in futuro collegato a NetInfo/Network

  public setOnlineStatus(online: boolean): void {
    this._isOnline = online;
  }

  public registerRealAdapters(adapters: {
    weather?: WeatherProviderAdapter;
    routing?: RoutingProviderAdapter;
    openingHours?: OpeningHoursProviderAdapter;
    places?: PlacesProviderAdapter;
    currency?: CurrencyProviderAdapter;
    translation?: TranslationProviderAdapter;
  }): void {
    if (adapters.weather) this.realWeatherAdapter = adapters.weather;
    if (adapters.routing) this.realRoutingAdapter = adapters.routing;
    if (adapters.openingHours) this.realOpeningHoursAdapter = adapters.openingHours;
    if (adapters.places) this.realPlacesAdapter = adapters.places;
    if (adapters.currency) this.realCurrencyAdapter = adapters.currency;
    if (adapters.translation) this.realTranslationAdapter = adapters.translation;
  }

  /**
   * Servizio Meteo di Dominio
   */
  public weather(): WeatherProviderAdapter {
    const self = this;
    return {
      async getCurrentWeather(lat: number, lon: number): Promise<WeatherCondition> {
        const key = `weather_curr_${lat.toFixed(4)}_${lon.toFixed(4)}`;
        return self.weatherCache.get(key, async () => {
          if (self._isOnline && self.realWeatherAdapter) {
            try { return await self.realWeatherAdapter.getCurrentWeather(lat, lon); } catch (e) { /* fallback */ }
          }
          return mockWeather.getCurrentWeather(lat, lon);
        }) as Promise<WeatherCondition>;
      },
      async getDailyForecast(lat: number, lon: number, date: string): Promise<DailyWeatherSummary> {
        const key = `weather_daily_${lat.toFixed(4)}_${lon.toFixed(4)}_${date}`;
        return self.weatherCache.get(key, async () => {
          if (self._isOnline && self.realWeatherAdapter) {
            try { return await self.realWeatherAdapter.getDailyForecast(lat, lon, date); } catch (e) { /* fallback */ }
          }
          return mockWeather.getDailyForecast(lat, lon, date);
        }) as Promise<DailyWeatherSummary>;
      },
      async getWeatherForLocation(lat: number, lon: number, date: string): Promise<WeatherCondition> {
        return this.getCurrentWeather(lat, lon);
      },
    };
  }

  /**
   * Servizio Routing e Percorrenze di Dominio
   */
  public routing(): RoutingProviderAdapter {
    const self = this;
    return {
      async calculateRoute(from: { lat: number; lon: number }, to: { lat: number; lon: number }, mode: TravelTransportMode = 'walking'): Promise<RouteEstimate> {
        const key = `route_${from.lat.toFixed(4)}_${from.lon.toFixed(4)}_${to.lat.toFixed(4)}_${to.lon.toFixed(4)}_${mode}`;
        return self.routingCache.get(key, async () => {
          if (self._isOnline && self.realRoutingAdapter) {
            try { return await self.realRoutingAdapter.calculateRoute(from, to, mode); } catch (e) { /* fallback */ }
          }
          return mockRouting.calculateRoute(from, to, mode);
        });
      },
    };
  }

  /**
   * Servizio Orari e Stato Operativo di Dominio
   */
  public openingHours(): OpeningHoursProviderAdapter {
    const self = this;
    return {
      async isOpenAt(placeId: string, date: string, time: string): Promise<boolean> {
        const key = `open_at_${placeId}_${date}_${time}`;
        return self.openingHoursCache.get(key, async () => {
          if (self._isOnline && self.realOpeningHoursAdapter) {
            try { return await self.realOpeningHoursAdapter.isOpenAt(placeId, date, time); } catch (e) { /* fallback */ }
          }
          return mockOpeningHours.isOpenAt(placeId, date, time);
        }) as Promise<boolean>;
      },
      async getOpeningHours(placeId: string, date: string): Promise<TimeWindow[]> {
        const key = `open_hours_${placeId}_${date}`;
        return self.openingHoursCache.get(key, async () => {
          if (self._isOnline && self.realOpeningHoursAdapter) {
            try { return await self.realOpeningHoursAdapter.getOpeningHours(placeId, date); } catch (e) { /* fallback */ }
          }
          return mockOpeningHours.getOpeningHours(placeId, date);
        }) as Promise<TimeWindow[]>;
      },
      async getOpeningStatus(placeId: string, date: string, time?: string): Promise<PlaceOpeningStatus> {
        const key = `open_status_${placeId}_${date}_${time || 'def'}`;
        return self.openingHoursCache.get(key, async () => {
          if (self._isOnline && self.realOpeningHoursAdapter) {
            try { return await self.realOpeningHoursAdapter.getOpeningStatus(placeId, date, time); } catch (e) { /* fallback */ }
          }
          return mockOpeningHours.getOpeningStatus(placeId, date, time);
        }) as Promise<PlaceOpeningStatus>;
      },
    };
  }

  /**
   * Servizio Catalogo Luoghi e Ricerca
   */
  public places(): PlacesProviderAdapter {
    const self = this;
    
  const mapPlaceToMetadata = (p: any): PlaceMetadata => {
    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api';
    const BACKEND_BASE = API_URL.endsWith('/api') ? API_URL.slice(0, -4) : API_URL;
    const absPhotoUrl = p.photoUrl ? (p.photoUrl.startsWith('http') ? p.photoUrl : `${BACKEND_BASE}${p.photoUrl}`) : undefined;
    
    return {
      placeId: p.id,
      name: p.name,
      category: p.categories[0] || 'attraction',
      lat: p.coordinates.latitude,
      lon: p.coordinates.longitude,
      formattedAddress: p.formattedAddress || '',
      rating: p.rating?.score,
      reviewsCount: p.rating?.reviewCount || 0,
      priceLevel: p.priceLevel || 0,
      phone: p.phone,
      website: p.website,
      coverImageUrl: absPhotoUrl,
      photoUrls: absPhotoUrl ? [absPhotoUrl] : [],
      openingHours: p.openingHours?.join(', ') || '',
      matchScore: 95,
      durationMinutes: p.visitDuration?.minutes || 60
    };
  };

    return {
      async getPlaceDetails(placeId: string): Promise<PlaceMetadata | null> {
        const key = `place_details_${placeId}`;
        return self.placesCache.get(key, async () => {
          try {
            const res = await placeRepository.getPlaceDetails(placeId);
            return mapPlaceToMetadata(res);
          } catch (e) {
            console.error('[TravelServices] getPlaceDetails error:', e);
            return mockPlaces.getPlaceDetails(placeId);
          }
        }) as Promise<PlaceMetadata | null>;
      },
      async searchPlaces(query: string, lat?: number, lon?: number): Promise<PlaceMetadata[]> {
        const key = `place_search_${query.toLowerCase()}_${lat || 0}_${lon || 0}`;
        return self.placesCache.get(key, async () => {
          try {
            const location = lat && lon ? { latitude: lat, longitude: lon } : undefined;
            const res = await placeRepository.searchPlaces({ query, location });
            return res.map(mapPlaceToMetadata);
          } catch (e) {
            console.error('[TravelServices] searchPlaces error:', e);
            return mockPlaces.searchPlaces(query, lat, lon);
          }
        }) as Promise<PlaceMetadata[]>;
      },
      async searchNearby(lat: number, lon: number, radiusMeters = 1000): Promise<PlaceMetadata[]> {
        const key = `place_nearby_${lat.toFixed(4)}_${lon.toFixed(4)}_${radiusMeters}`;
        return self.placesCache.get(key, async () => {
          try {
            const res = await placeRepository.searchPlaces({
              location: { latitude: lat, longitude: lon },
              radius: { value: radiusMeters, unit: 'meters' }
            });
            return res.map(mapPlaceToMetadata);
          } catch (e) {
            console.error('[TravelServices] searchNearby error:', e);
            return mockPlaces.searchNearby(lat, lon, radiusMeters);
          }
        }) as Promise<PlaceMetadata[]>;
      },
      async getCuratedCatalog(destination: string = 'Budapest'): Promise<PlaceMetadata[]> {
        return await self.places().searchPlaces(destination);
      },
    };
  }

  /**
   * Servizio Catalogo Editoriale Curato per il Wizard di Ispirazione (Catalogo -> Libreria -> Composer)
   */
  public editorial() {
    const self = this;
    return {
      async getCuratedCatalog(destination: string = 'Budapest', style: string = 'culture'): Promise<any[]> {
        let searchQuery = destination;
        if (style === 'culture') {
          searchQuery = `museo attrazioni monumenti storici a ${destination}`;
        } else if (style === 'food') {
          searchQuery = `ristorante bar pasticceria trattoria cibo a ${destination}`;
        } else if (style === 'relax') {
          searchQuery = `parco giardini terme relax natura a ${destination}`;
        } else if (style === 'photography') {
          searchQuery = `belvedere panorama vista punto fotografico a ${destination}`;
        } else if (style === 'family') {
          searchQuery = `parco giochi attrazioni bambini famiglia a ${destination}`;
        } else if (style === 'express') {
          searchQuery = `attrazioni principali imperdibili a ${destination}`;
        }

        const placesMeta = await self.places().searchPlaces(searchQuery);
        return placesMeta.map(p => {
          const category = (p.category as any) || 'visit';
          let defaultDuration = 60;
          if (category === 'restaurant' || category === 'lunch' || category === 'dinner') {
            defaultDuration = 90;
          } else if (category === 'breakfast' || category === 'cafe') {
            defaultDuration = 30;
          }

          const photo = p.coverImageUrl || (p.photoUrls?.[0]) || 'https://images.unsplash.com/photo-1549877452-9c387954fbc2?auto=format&fit=crop&w=800&q=80';

          return {
            id: p.placeId,
            name: p.name,
            category: category,
            coordinates: { latitude: p.lat, longitude: p.lon },
            address: p.formattedAddress,
            formattedAddress: p.formattedAddress,
            rating: p.rating,
            reviewsCount: p.reviewsCount,
            priceLevel: p.priceLevel,
            durationMinutes: p.durationMinutes || defaultDuration,
            energyLevel: 'medium',
            coverImageUrl: photo,
            heroImage: photo,
            source: { providerName: 'Catalogo Travel OS', isExternal: false, matchScore: p.matchScore || 98 }
          };
        });
      }
    };
  }

  /**
   * Servizio Tassi di Cambio e Convertitore Valute
   */
  public currency(): CurrencyProviderAdapter {
    const self = this;
    return {
      async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<ExchangeRate> {
        const key = `rate_${fromCurrency}_${toCurrency}`;
        return self.currencyCache.get(key, async () => {
          if (self._isOnline && self.realCurrencyAdapter) {
            try { return await self.realCurrencyAdapter.getExchangeRate(fromCurrency, toCurrency); } catch (e) { /* fallback */ }
          }
          return mockCurrency.getExchangeRate(fromCurrency, toCurrency);
        }) as Promise<ExchangeRate>;
      },
      async convert(amount: number, fromCurrency: string, toCurrency: string): Promise<number> {
        const key = `conv_${amount}_${fromCurrency}_${toCurrency}`;
        return self.currencyCache.get(key, async () => {
          if (self._isOnline && self.realCurrencyAdapter) {
            try { return await self.realCurrencyAdapter.convert(amount, fromCurrency, toCurrency); } catch (e) { /* fallback */ }
          }
          return mockCurrency.convert(amount, fromCurrency, toCurrency);
        }) as Promise<number>;
      },
    };
  }

  /**
   * Servizio Traduzione di Dominio
   */
  public translation(): TranslationProviderAdapter {
    const self = this;
    return {
      async translate(text: string, targetLang: string, sourceLang?: string): Promise<string> {
        const key = `trans_${text}_${targetLang}_${sourceLang || 'auto'}`;
        return self.translationCache.get(key, async () => {
          if (self._isOnline && self.realTranslationAdapter) {
            try { return await self.realTranslationAdapter.translate(text, targetLang, sourceLang); } catch (e) { /* fallback */ }
          }
          return mockTranslation.translate(text, targetLang, sourceLang);
        }) as Promise<string>;
      },
    };
  }
}

export const TravelServices = new TravelServicesPlatform();
