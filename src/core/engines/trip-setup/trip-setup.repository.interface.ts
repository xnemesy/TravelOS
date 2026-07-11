import { TripSetup } from '../../../domain/trip/models/trip-setup.model';

/**
 * Persistenza dell'aggregato satellite TripSetup (ADR-021 — Repository
 * Abstraction). `TripSetupEngine` dipende solo da questo contratto: non
 * conosce MMKV, chiavi di storage, formato di cache né la ricostruzione delle
 * Date dai valori serializzati.
 */
export interface ITripSetupRepository {
  /** TripSetup persistito e deserializzato (Date ricostruite), o `null` se non è mai stato scritto nulla. */
  getTripSetup(tripId: string): Promise<TripSetup | null>;

  /** Sostituisce integralmente il TripSetup persistito per il trip. */
  saveTripSetup(tripId: string, setup: TripSetup): Promise<void>;
}
