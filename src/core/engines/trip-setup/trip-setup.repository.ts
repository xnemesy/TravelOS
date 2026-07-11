import { ITripSetupRepository } from './trip-setup.repository.interface';
import { ILocalDatabase } from '../../storage/local-database.interface';
import { TripSetup } from '../../../domain/trip/models/trip-setup.model';

const TRIP_SETUP_CACHE_KEY_PREFIX = 'trip_setup_';

/**
 * Implementazione MMKV/AsyncStorage (via ILocalDatabase) di ITripSetupRepository.
 * Unico punto del sottosistema TripSetup che conosce la chiave di storage —
 * stesso valore (`trip_setup_${tripId}`) già in uso prima di ADR-021, per
 * compatibilità con i dati già persistiti su dispositivo — e la logica di
 * (de)serializzazione, spostata qui verbatim da `TripSetupEngine`.
 */
export class TripSetupRepository implements ITripSetupRepository {
  constructor(private localDb: ILocalDatabase) {}

  private cacheKey(tripId: string): string {
    return `${TRIP_SETUP_CACHE_KEY_PREFIX}${tripId}`;
  }

  async getTripSetup(tripId: string): Promise<TripSetup | null> {
    const raw = await this.localDb.get<any>(this.cacheKey(tripId));
    if (!raw) return null;
    return this.deserialize(raw);
  }

  async saveTripSetup(tripId: string, setup: TripSetup): Promise<void> {
    await this.localDb.set(this.cacheKey(tripId), setup);
  }

  /** Ricostruisce le Date da MMKV (persistite come stringhe ISO via JSON). */
  private deserialize(raw: any): TripSetup {
    return {
      ...raw,
      createdAt: new Date(raw.createdAt),
      updatedAt: new Date(raw.updatedAt),
      transports: raw.transports?.map((t: any) => ({
        ...t,
        departureDate: new Date(t.departureDate),
        arrivalDate: t.arrivalDate ? new Date(t.arrivalDate) : undefined,
      })),
      accommodations: raw.accommodations?.map((a: any) => ({
        ...a,
        checkIn: new Date(a.checkIn),
        checkOut: new Date(a.checkOut),
      })),
    };
  }
}
