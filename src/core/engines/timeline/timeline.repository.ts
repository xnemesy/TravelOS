import { ITimelineRepository } from './timeline.repository.interface';
import { ILocalDatabase } from '../../storage/local-database.interface';
import { ITripRepository } from '../../../domain/trip/repositories/trip.repository.interface';
import { TimelineDaySchedule } from '../types/context.types';

const TIMELINE_CACHE_KEY_PREFIX = 'timeline_';

/**
 * Implementazione MMKV/AsyncStorage (via ILocalDatabase) di ITimelineRepository.
 * Unico punto del sottosistema Timeline che conosce la chiave di storage —
 * stesso valore (`timeline_${tripId}`) già in uso prima di ADR-021, per
 * compatibilità con i dati già persistiti su dispositivo.
 *
 * `getTripDateRange` delega a `ITripRepository` (letture da storage
 * persistente, non dallo stato in-memory di `useTripStore`, per preservare
 * esattamente il comportamento pre-ADR-021: prima il timing di risoluzione
 * delle date non dipendeva dall'idratazione dello Zustand store). Prima di
 * ADR-021, `TimelineEngine` leggeva direttamente la chiave grezza
 * `cache_user_trips_${userId}` del repository dei Trip — una violazione
 * doppia (chiave di storage + formato di un aggregato diverso). Questa
 * classe la sostituisce con una dipendenza esplicita e tipizzata.
 */
export class TimelineRepository implements ITimelineRepository {
  constructor(
    private localDb: ILocalDatabase,
    private tripRepository: ITripRepository
  ) {}

  private cacheKey(tripId: string): string {
    return `${TIMELINE_CACHE_KEY_PREFIX}${tripId}`;
  }

  async getTimeline(tripId: string): Promise<TimelineDaySchedule[] | null> {
    return this.localDb.get<TimelineDaySchedule[]>(this.cacheKey(tripId));
  }

  async saveTimeline(tripId: string, days: TimelineDaySchedule[]): Promise<void> {
    await this.localDb.set(this.cacheKey(tripId), days);
  }

  async getTripDateRange(tripId: string): Promise<{ startDate: Date; endDate: Date } | null> {
    const trip = await this.tripRepository.getTripById(tripId);
    if (!trip) return null;
    return { startDate: trip.startDate, endDate: trip.endDate };
  }
}
