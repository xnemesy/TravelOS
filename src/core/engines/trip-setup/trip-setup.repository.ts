import { ITripSetupRepository } from './trip-setup.repository.interface';
import { ILocalDatabase } from '../../storage/local-database.interface';
import { TripSetup } from '../../../domain/trip/models/trip-setup.model';
import { unsafeAsInstantISO } from '../../../domain/time';

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

  /**
   * Reidrata il TripSetup da MMKV (persistito come JSON: gli instanti sono già
   * stringhe ISO su disco). `createdAt`/`updatedAt` restano `Date` (fuori dallo
   * scope di ADR-025 §7 n). Gli instanti di Transport/Accommodation, migrati a
   * `InstantISO` (§7 n), vengono lasciati come stringhe e semplicemente
   * ri-brandati: il formato su disco è invariato, non si ricostruisce più un
   * `Date`, così il tipo a runtime coincide con quello dichiarato e con lo
   * schema (`InstantISOSchema` accetta solo stringhe).
   */
  private deserialize(raw: any): TripSetup {
    return {
      ...raw,
      createdAt: new Date(raw.createdAt),
      updatedAt: new Date(raw.updatedAt),
      transports: raw.transports?.map((t: any) => ({
        ...t,
        departureDate: unsafeAsInstantISO(t.departureDate),
        arrivalDate: t.arrivalDate ? unsafeAsInstantISO(t.arrivalDate) : undefined,
      })),
      accommodations: raw.accommodations?.map((a: any) => ({
        ...a,
        checkIn: unsafeAsInstantISO(a.checkIn),
        checkOut: unsafeAsInstantISO(a.checkOut),
      })),
    };
  }
}
