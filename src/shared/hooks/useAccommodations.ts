import { useTravelContext } from './useTravelContext';
import { Accommodation } from '../../domain/trip/models/trip-setup.model';

export interface AccommodationsSlice {
  accommodations: Accommodation[];
  accommodationsCount: number;
}

/**
 * ============================================================================
 * USE ACCOMMODATIONS (HOOK GRANULARE SELETTIVO — Accommodation Setup module)
 * ============================================================================
 * Stesso principio di `useTransports`: accesso in sola lettura tramite il
 * Context Engine, mai da TripSetupEngine/MMKV direttamente
 * (PRODUCT_PRINCIPLES.md §7). Ordinati per `checkIn`.
 */
export function useAccommodations(tripId: string | string[]): AccommodationsSlice {
  const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
  const context = useTravelContext(cleanTripId);

  const accommodations = [...(context.accommodations || [])].sort(
    (a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime()
  );

  return {
    accommodations,
    accommodationsCount: context.accommodationsCount ?? accommodations.length,
  };
}
