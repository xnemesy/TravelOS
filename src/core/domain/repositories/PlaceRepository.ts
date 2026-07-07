import { Place } from '../models/Place';
import { PlaceCategory } from '../models/PlaceCategory';
import { Coordinates } from '../valueObjects/Coordinates';
import { Distance } from '../valueObjects/Distance';
import { Rating } from '../valueObjects/Rating';

export interface SearchOptions {
  query?: string;
  category?: PlaceCategory[];
  location?: Coordinates;
  radius?: Distance;
  openNow?: boolean;
  minRating?: Rating;
  priceLevels?: number[];
}

export interface PlaceRepository {
  searchPlaces(options: SearchOptions): Promise<Place[]>;
  autocomplete(query: string, location?: Coordinates): Promise<Place[]>;
  getPlaceDetails(placeId: string): Promise<Place>;
  getMultipleDetails(placeIds: string[]): Promise<Place[]>;
  prefetch(placeIds: string[]): Promise<void>;
}
