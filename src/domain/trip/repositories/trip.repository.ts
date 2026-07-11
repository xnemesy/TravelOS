import { ITripRepository } from './trip.repository.interface';
import { Trip, TripSchema } from '../models/trip.model';
import { ILocalDatabase } from '../../../core/storage/local-database.interface';

const TRIPS_CACHE_KEY = 'cache_user_trips_';

/**
 * TripRepository persiste esclusivamente su storage locale (MMKV/Isar) tramite ILocalDatabase.
 * Ogni sincronizzazione cloud è esplicitamente rimandata alla futura implementazione del SyncEngine.
 */
export class TripRepository implements ITripRepository {
  constructor(private localDb: ILocalDatabase) {}

  private getCacheKey(userId: string): string {
    return `${TRIPS_CACHE_KEY}${userId}`;
  }

  private deserializeTrips(raw: any[]): Trip[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((t: any) => ({
      ...t,
      startDate: new Date(t.startDate),
      endDate: new Date(t.endDate),
      createdAt: new Date(t.createdAt),
      updatedAt: new Date(t.updatedAt),
    }));
  }

  async getTripById(id: string): Promise<Trip | null> {
    const trips = await this.getUserTrips('default-user');
    return trips.find(t => t.id === id) || null;
  }

  /**
   * Legge i viaggi effettivamente persistiti, senza mai generare il mock
   * Budapest. Usata dai path di scrittura (create/update/delete): se anche
   * loro passassero dal seeding del mock (come accadeva prima), il primo
   * `createTrip` mai eseguito in DEV su un db vergine finiva per persistere
   * `[mockTrip, newTrip]` invece del solo viaggio reale appena creato.
   */
  private async getRawTrips(userId: string): Promise<Trip[]> {
    const rawCache = await this.localDb.get<any[]>(this.getCacheKey(userId));
    if (!rawCache) return [];
    return this.parseTrips(rawCache);
  }

  private parseTrips(rawCache: any[]): Trip[] {
    try {
      const trips = this.deserializeTrips(rawCache);
      // Rimuoviamo il filtro Zod severo in development per evitare la sparizione dei viaggi mock/legacy
      return trips.filter(t => {
        const res = TripSchema.safeParse(t);
        if (!res.success) {
          console.warn('[TripRepository] Validation failed for trip. Returning anyway to prevent data loss:', res.error.message);
        }
        return true; // Accetta comunque il trip per evitare sparizioni improvvise
      });
    } catch (e) {
      console.error('Error deserializing trips from local storage', e);
      return [];
    }
  }

  async getUserTrips(userId: string): Promise<Trip[]> {
    const cacheKey = this.getCacheKey(userId);
    const rawCache = await this.localDb.get<any[]>(cacheKey);

    // Se rawCache è un array vuoto (l'utente ha cancellato tutti i suoi viaggi), non ripristinare il mock
    if (Array.isArray(rawCache) && rawCache.length === 0) {
      return [];
    }

    if (!rawCache) {
      const isDev = process.env.NODE_ENV === 'development' || (typeof __DEV__ !== 'undefined' && __DEV__);
      if (!isDev) {
        await this.localDb.set(cacheKey, []);
        return [];
      }

      // Se il database non è mai stato inizializzato e siamo in sviluppo, restituiamo il mock trip di default
      const mockTrip: Trip = {
        id: 'trip-budapest-2026',
        userId: 'default-user',
        title: 'Fuga a Budapest',
        destination: 'Budapest, Ungheria',
        emoji: '🇭🇺',
        currency: 'HUF',
        startDate: new Date('2026-07-10'),
        endDate: new Date('2026-07-14'),
        status: 'planned',
        coverImageUrl: 'https://images.unsplash.com/photo-1549877452-9c387954fbc2?q=80&w=800&auto=format&fit=crop',
        progress: 0,
        stats: {
          savedPlaces: 5,
          reservations: 0,
          activitiesToComplete: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Salviamo il mock nel db locale così rimane persistente
      await this.localDb.set(cacheKey, [mockTrip]);
      return [mockTrip];
    }

    return this.parseTrips(rawCache);
  }

  async createTrip(tripData: Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>): Promise<Trip> {
    const now = new Date();
    const id = `trip-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newTrip: Trip = {
      ...tripData,
      id,
      createdAt: now,
      updatedAt: now,
    };

    const trips = await this.getRawTrips(tripData.userId);
    trips.push(newTrip);

    await this.localDb.set(this.getCacheKey(tripData.userId), trips);
    return newTrip;
  }

  async updateTrip(id: string, updates: Partial<Trip>): Promise<Trip> {
    const trips = await this.getRawTrips('default-user');
    const index = trips.findIndex(t => t.id === id);
    
    if (index === -1) {
      throw new Error(`Trip con id ${id} non trovato nel repository.`);
    }

    const updatedTrip: Trip = {
      ...trips[index],
      ...updates,
      id: trips[index].id,
      updatedAt: new Date(),
    };

    trips[index] = updatedTrip;
    await this.localDb.set(this.getCacheKey('default-user'), trips);
    return updatedTrip;
  }

  async deleteTrip(id: string): Promise<void> {
    const trips = await this.getRawTrips('default-user');
    const filteredTrips = trips.filter(t => t.id !== id);
    await this.localDb.set(this.getCacheKey('default-user'), filteredTrips);
  }
}
