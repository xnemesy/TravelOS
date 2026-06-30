import { Trip } from '../models/trip.model';

export interface ITripRepository {
  /**
   * Recupera un viaggio per ID.
   * La logica interna cercherà prima nella cache locale (MMKV/SQLite)
   * e poi su Firestore, garantendo il funzionamento offline-first.
   */
  getTripById(id: string): Promise<Trip | null>;

  /**
   * Recupera tutti i viaggi dell'utente.
   */
  getUserTrips(userId: string): Promise<Trip[]>;

  /**
   * Crea un nuovo viaggio (salva localmente e accoda per la sincronizzazione).
   */
  createTrip(trip: Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>): Promise<Trip>;

  /**
   * Aggiorna un viaggio esistente.
   */
  updateTrip(id: string, updates: Partial<Trip>): Promise<Trip>;

  /**
   * Elimina un viaggio.
   */
  deleteTrip(id: string): Promise<void>;
}
