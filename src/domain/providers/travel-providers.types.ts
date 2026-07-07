/**
 * ============================================================================
 * SERVICE INTEGRATION PLATFORM (SIP) - ADAPTER INTERFACES
 * ============================================================================
 * Contratti astratti (Adapter Pattern) per disaccoppiare il Domain Layer
 * e i motori di Travel OS da qualsiasi servizio esterno o API futura
 * (Google Places, Apple Maps, OpenMeteo, Mapbox, OpenAI, MCP, ecc.).
 */

// --- 1. WEATHER ADAPTER ---
export interface WeatherCondition {
  condition: 'sunny' | 'rainy' | 'cloudy' | 'stormy' | 'snowy';
  temperatureCelsius: number;
  rainProbabilityPercent: number;
  windSpeedKmh?: number;
  sunrise?: string; // Es. "06:15"
  sunset?: string; // Es. "20:45"
  goldenHour?: string; // Es. "20:00"
  alertMessage?: string;
}

export interface WeatherForecast {
  time: string; // HH:mm o ISO
  temperatureCelsius: number;
  condition: 'sunny' | 'rainy' | 'cloudy' | 'stormy' | 'snowy';
  rainProbabilityPercent: number;
}

export interface DailyWeatherSummary {
  date: string;
  condition: 'sunny' | 'rainy' | 'cloudy' | 'stormy' | 'snowy';
  minTempCelsius: number;
  maxTempCelsius: number;
  rainProbabilityPercent: number;
  sunrise: string;
  sunset: string;
  goldenHour: string;
  hourlyForecast: WeatherForecast[];
}

export interface WeatherProviderAdapter {
  getCurrentWeather(lat: number, lon: number): Promise<WeatherCondition>;
  getDailyForecast(lat: number, lon: number, date: string): Promise<DailyWeatherSummary>;
  getWeatherForLocation(lat: number, lon: number, date: string): Promise<WeatherCondition>;
}

// --- 2. ROUTING ADAPTER ---
export type TravelTransportMode = 'walking' | 'transit' | 'driving' | 'bicycling';

export interface RouteEstimate {
  distanceMeters: number;
  durationMinutes: number;
  polyline?: string;
  walkingDurationMinutes?: number;
  drivingDurationMinutes?: number;
  transitDurationMinutes?: number;
  warnings?: string[];
}

export interface RoutingProviderAdapter {
  calculateRoute(
    from: { lat: number; lon: number },
    to: { lat: number; lon: number },
    mode?: TravelTransportMode
  ): Promise<RouteEstimate>;
}

// --- 3. OPENING HOURS ADAPTER ---
export interface TimeWindow {
  open: string; // Es. "09:00"
  close: string; // Es. "17:00"
}

export interface PlaceOpeningStatus {
  isOpen: boolean;
  nextOpening?: string;
  exceptionalClosure?: boolean;
  windows: TimeWindow[];
}

export interface OpeningHoursProviderAdapter {
  isOpenAt(placeId: string, date: string, time: string): Promise<boolean>;
  getOpeningHours(placeId: string, date: string): Promise<TimeWindow[]>;
  getOpeningStatus(placeId: string, date: string, time?: string): Promise<PlaceOpeningStatus>;
}

// --- 4. PLACES ADAPTER ---
export interface PlaceMetadata {
  placeId: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  formattedAddress?: string;
  rating?: number;
  reviewsCount?: number;
  priceLevel?: number;
  phone?: string;
  website?: string;
  photoUrls?: string[];
  coverImageUrl?: string;
  openingHours?: string;
  appleMapsUrl?: string;
  googleMapsUrl?: string;
  matchScore?: number; // 0-100 (affidabilità del match nel Place Merge Engine e nelle ricerche)
  durationMinutes?: number;
}

export interface PlacesProviderAdapter {
  getPlaceDetails(placeId: string): Promise<PlaceMetadata | null>;
  searchPlaces(query: string, lat?: number, lon?: number): Promise<PlaceMetadata[]>;
  searchNearby(lat: number, lon: number, radiusMeters?: number): Promise<PlaceMetadata[]>;
  getCuratedCatalog?(destination?: string): Promise<PlaceMetadata[]>;
}

// --- 5. CURRENCY & TRANSLATION ADAPTERS (SIP Future Readiness) ---
export interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  lastUpdated: string;
}

export interface CurrencyProviderAdapter {
  getExchangeRate(fromCurrency: string, toCurrency: string): Promise<ExchangeRate>;
  convert(amount: number, fromCurrency: string, toCurrency: string): Promise<number>;
}

export interface TranslationProviderAdapter {
  translate(text: string, targetLang: string, sourceLang?: string): Promise<string>;
}

// --- BACKWARD COMPATIBILITY ALIASES ---
export type IWeatherProvider = WeatherProviderAdapter;
export type IRoutingProvider = RoutingProviderAdapter;
export type IOpeningHoursProvider = OpeningHoursProviderAdapter;

