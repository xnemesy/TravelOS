import { ITripRepository } from './trip.repository.interface';
import { Trip, TripSchema } from '../models/trip.model';
import { ILocalDatabase } from '../../../core/storage/local-database.interface';
import { db } from '../../../core/firebase/firebase.config';
import { doc, getDoc, getDocs, collection, query, where, setDoc, deleteDoc } from 'firebase/firestore';

const TRIPS_CACHE_KEY = 'cache_user_trips_';

export class TripRepository implements ITripRepository {
  constructor(private localDb: ILocalDatabase) {}

  /**
   * Helper per serializzare/deserializzare le Date in JSON, dato che MMKV salva stringhe.
   * Firestore restituisce Timestamp, che convertiamo in Date.
   */
  private serializeTrips(trips: Trip[]): string {
    return JSON.stringify(trips);
  }

  private deserializeTrips(json: string): Trip[] {
    const parsed = JSON.parse(json);
    return parsed.map((t: any) => ({
      ...t,
      startDate: new Date(t.startDate),
      endDate: new Date(t.endDate),
      createdAt: new Date(t.createdAt),
      updatedAt: new Date(t.updatedAt),
    }));
  }

  async getTripById(id: string): Promise<Trip | null> {
    // 1. Prova a leggere da una cache globale (oppure dovremmo ciclare tra quelli dell'utente)
    // Per semplificare, in genere leggiamo getUserTrips e cerchiamo lì
    // Qui faremo una lettura diretta da Firestore come fallback
    const docRef = doc(db, 'trips', id);
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const trip: Trip = {
          ...data,
          id: docSnap.id,
          startDate: data.startDate.toDate(),
          endDate: data.endDate.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as Trip;
        return trip;
      }
    } catch (e) {
      console.warn("Firestore fetch failed, relying on cache strategy internally", e);
    }
    return null;
  }

  async getUserTrips(userId: string): Promise<Trip[]> {
    const cacheKey = `${TRIPS_CACHE_KEY}${userId}`;
    let cachedTrips: Trip[] = [];
    
    // 1. Lettura immediata da MMKV
    const rawCache = await this.localDb.get<string>(cacheKey);
    if (rawCache) {
      try {
        cachedTrips = this.deserializeTrips(rawCache);
      } catch (e) {
        console.error("Cache parsing error", e);
      }
    }

    // 2. Fetch in background (se fallisce, ignoriamo l'errore per preservare il flusso offline)
    this.syncUserTrips(userId, cacheKey).catch(console.error);

    // 3. Ritorna immediatamente i dati in cache (potrebbe essere un array vuoto al primo avvio)
    return cachedTrips;
  }

  private async syncUserTrips(userId: string, cacheKey: string): Promise<void> {
    const q = query(collection(db, 'trips'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    
    const trips: Trip[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      trips.push({
        id: doc.id,
        userId: data.userId,
        title: data.title,
        destination: data.destination,
        status: data.status,
        coverImageUrl: data.coverImageUrl,
        startDate: data.startDate.toDate(),
        endDate: data.endDate.toDate(),
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
      });
    });

    // Validiamo con Zod per sicurezza (opzionale ma consigliato)
    const validTrips = trips.filter(t => TripSchema.safeParse(t).success);

    // Salviamo la nuova fonte di verità in cache
    await this.localDb.set(cacheKey, this.serializeTrips(validTrips));
  }

  async createTrip(trip: Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>): Promise<Trip> {
    const newDocRef = doc(collection(db, 'trips'));
    const now = new Date();
    
    const newTrip: Trip = {
      ...trip,
      id: newDocRef.id,
      createdAt: now,
      updatedAt: now,
    };

    const cacheKey = `${TRIPS_CACHE_KEY}${trip.userId}`;
    
    // Aggiornamento ottimistico cache
    const rawCache = await this.localDb.get<string>(cacheKey);
    let cachedTrips = rawCache ? this.deserializeTrips(rawCache) : [];
    cachedTrips.push(newTrip);
    await this.localDb.set(cacheKey, this.serializeTrips(cachedTrips));

    // Scrittura Firestore
    await setDoc(newDocRef, {
      ...newTrip,
      startDate: newTrip.startDate, // Firestore SDK auto-converts Date to Timestamp if configured, but better to use Timestamp.fromDate() in a real app
      endDate: newTrip.endDate,
      createdAt: newTrip.createdAt,
      updatedAt: newTrip.updatedAt,
    });

    return newTrip;
  }

  async updateTrip(id: string, updates: Partial<Trip>): Promise<Trip> {
    // TBD: Trova trip in cache, aggiorna ottimisticamente, scrivi su Firestore
    throw new Error('Method not implemented yet.');
  }

  async deleteTrip(id: string): Promise<void> {
    // TBD: Rimuovi da cache, elimina da Firestore
    throw new Error('Method not implemented yet.');
  }
}
