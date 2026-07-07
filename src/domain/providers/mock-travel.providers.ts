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
  TravelTransportMode 
} from './travel-providers.types';

/**
 * ============================================================================
 * MOCK TRAVEL ADAPTERS (Service Integration Platform - SIP)
 * ============================================================================
 * Implementazioni locali, offline-first e deterministiche per simulare le
 * API esterne senza alterare la logica o l'infrastruttura di Travel OS.
 */

export class MockWeatherAdapter implements WeatherProviderAdapter {
  async getCurrentWeather(lat: number, lon: number): Promise<WeatherCondition> {
    return {
      condition: 'sunny',
      temperatureCelsius: 24,
      rainProbabilityPercent: 10,
      windSpeedKmh: 12,
      sunrise: '06:15',
      sunset: '20:45',
      goldenHour: '20:00',
    };
  }

  async getDailyForecast(lat: number, lon: number, date: string): Promise<DailyWeatherSummary> {
    return {
      date,
      condition: 'sunny',
      minTempCelsius: 16,
      maxTempCelsius: 26,
      rainProbabilityPercent: 10,
      sunrise: '06:15',
      sunset: '20:45',
      goldenHour: '20:00',
      hourlyForecast: [
        { time: '09:00', temperatureCelsius: 18, condition: 'sunny', rainProbabilityPercent: 5 },
        { time: '13:00', temperatureCelsius: 25, condition: 'sunny', rainProbabilityPercent: 10 },
        { time: '18:00', temperatureCelsius: 22, condition: 'sunny', rainProbabilityPercent: 15 },
        { time: '21:00', temperatureCelsius: 19, condition: 'sunny', rainProbabilityPercent: 10 },
      ],
    };
  }

  async getWeatherForLocation(lat: number, lon: number, date: string): Promise<WeatherCondition> {
    return this.getCurrentWeather(lat, lon);
  }
}

export class MockRoutingAdapter implements RoutingProviderAdapter {
  async calculateRoute(
    from: { lat: number; lon: number },
    to: { lat: number; lon: number },
    mode: TravelTransportMode = 'walking'
  ): Promise<RouteEstimate> {
    // Calcolo distanza approssimativa euclidea / haversine semplificata
    const dLat = (to.lat - from.lat) * 111000;
    const dLon = (to.lon - from.lon) * 111000 * Math.cos((from.lat * Math.PI) / 180);
    const distanceMeters = Math.round(Math.sqrt(dLat * dLat + dLon * dLon));

    // Velocità media a piedi ≈ 80 metri al minuto (≈ 4.8 km/h)
    const speedMetersPerMinute = mode === 'walking' ? 80 : 300;
    const durationMinutes = Math.max(1, Math.round(distanceMeters / speedMetersPerMinute));

    const walkingDurationMinutes = Math.max(1, Math.round(distanceMeters / 80));
    const drivingDurationMinutes = Math.max(1, Math.round(distanceMeters / 400));
    const transitDurationMinutes = Math.max(1, Math.round(distanceMeters / 250));

    return {
      distanceMeters,
      durationMinutes,
      walkingDurationMinutes,
      drivingDurationMinutes,
      transitDurationMinutes,
      warnings: distanceMeters > 5000 && mode === 'walking' ? ['Percorso a piedi lungo (> 5km)'] : [],
    };
  }
}

export class MockOpeningHoursAdapter implements OpeningHoursProviderAdapter {
  async isOpenAt(placeId: string, date: string, time: string): Promise<boolean> {
    const [hours] = time.split(':').map(Number);
    return hours >= 8 && hours < 22;
  }

  async getOpeningHours(placeId: string, date: string): Promise<TimeWindow[]> {
    return [
      { open: '09:00', close: '13:00' },
      { open: '14:30', close: '19:30' },
    ];
  }

  async getOpeningStatus(placeId: string, date: string, time = '12:00'): Promise<PlaceOpeningStatus> {
    const isOpen = await this.isOpenAt(placeId, date, time);
    return {
      isOpen,
      nextOpening: !isOpen ? '09:00 (domani)' : undefined,
      exceptionalClosure: false,
      windows: await this.getOpeningHours(placeId, date),
    };
  }
}

export class MockPlacesAdapter implements PlacesProviderAdapter {
  async getPlaceDetails(placeId: string): Promise<PlaceMetadata | null> {
    return {
      placeId,
      name: 'Luogo di Interesse',
      category: 'cultural',
      lat: 47.4979,
      lon: 19.0402,
      formattedAddress: 'Centro Storico',
      rating: 4.8,
      priceLevel: 2,
    };
  }

  async searchPlaces(query: string, lat?: number, lon?: number): Promise<PlaceMetadata[]> {
    return [
      {
        placeId: `mock-${query.toLowerCase()}-1`,
        name: `${query} Centrale`,
        category: 'attraction',
        lat: lat || 47.4979,
        lon: lon || 19.0402,
        rating: 4.7,
        matchScore: 90,
      },
    ];
  }

  async searchNearby(lat: number, lon: number, radiusMeters = 1000): Promise<PlaceMetadata[]> {
    return [
      {
        placeId: 'mock-nearby-1',
        name: 'Luogo Vicino',
        category: 'attraction',
        lat: lat + 0.001,
        lon: lon + 0.001,
        rating: 4.6,
        matchScore: 85,
      },
    ];
  }
}

export class MockCurrencyAdapter implements CurrencyProviderAdapter {
  async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<ExchangeRate> {
    return {
      fromCurrency,
      toCurrency,
      rate: fromCurrency === 'EUR' && toCurrency === 'HUF' ? 395.5 : 1.0,
      lastUpdated: new Date().toISOString(),
    };
  }

  async convert(amount: number, fromCurrency: string, toCurrency: string): Promise<number> {
    const { rate } = await this.getExchangeRate(fromCurrency, toCurrency);
    return amount * rate;
  }
}

export class MockTranslationAdapter implements TranslationProviderAdapter {
  async translate(text: string, targetLang: string, sourceLang?: string): Promise<string> {
    return `[${targetLang.toUpperCase()}] ${text}`;
  }
}

// Backward compatibility aliases for existing imports
export const MockWeatherProvider = MockWeatherAdapter;
export const MockRoutingProvider = MockRoutingAdapter;
export const MockOpeningHoursProvider = MockOpeningHoursAdapter;

export const weatherProvider = new MockWeatherAdapter();
export const routingProvider = new MockRoutingAdapter();
export const openingHoursProvider = new MockOpeningHoursAdapter();
export const placesProvider = new MockPlacesAdapter();
export const currencyProvider = new MockCurrencyAdapter();
export const translationProvider = new MockTranslationAdapter();

