import { IPlacesRepository } from './places.repository.interface';
import { ILocalDatabase } from '../../storage/local-database.interface';
import { PlaceRef } from '../types/context.types';

const PLACES_CACHE_KEY_PREFIX = 'places_';

/**
 * Implementazione MMKV/AsyncStorage (via ILocalDatabase) di IPlacesRepository.
 * Unico punto del sottosistema Places che conosce la chiave di storage —
 * stesso valore (`places_${tripId}`) già in uso prima di ADR-021, per
 * compatibilità con i dati già persistiti su dispositivo.
 */
export class PlacesRepository implements IPlacesRepository {
  constructor(private localDb: ILocalDatabase) {}

  private cacheKey(tripId: string): string {
    return `${PLACES_CACHE_KEY_PREFIX}${tripId}`;
  }

  async getPlaces(tripId: string): Promise<PlaceRef[] | null> {
    return this.localDb.get<PlaceRef[]>(this.cacheKey(tripId));
  }

  async savePlaces(tripId: string, places: PlaceRef[]): Promise<void> {
    await this.localDb.set(this.cacheKey(tripId), places);
  }
}
