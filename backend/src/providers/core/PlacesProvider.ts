import { Place } from '../../models/Place';

export interface PlacesSearchOptions {
  query?: string;
  category?: string[];
  location?: { lat: number, lng: number };
  radius?: number; // meters
  openNow?: boolean;
  minRating?: number;
  priceLevels?: number[];
  pageToken?: string;
  language?: string;
}

export interface PlacesProvider {
  search(options: PlacesSearchOptions): Promise<Place[]>;
  autocomplete(query: string, location?: { lat: number, lng: number }): Promise<Place[]>;
  details(providerPlaceId: string): Promise<Place>;
}
