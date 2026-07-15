import { useTravelContext } from './useTravelContext';
import { Transport } from '../../domain/trip/models/trip-setup.model';

export interface TransportsSlice {
  transports: Transport[];
  transportsCount: number;
}

/**
 * ============================================================================
 * USE TRANSPORTS (HOOK GRANULARE SELETTIVO — Transport Setup module)
 * ============================================================================
 * Fornisce accesso in sola lettura ai trasporti di setup del viaggio, letti
 * tramite il Context Engine (mai da TripSetupEngine/MMKV direttamente —
 * PRODUCT_PRINCIPLES.md §7). Ordinati per `sequenceOrder` se presente,
 * altrimenti per `departureDate` (ADR-018 §3.1).
 */
export function useTransports(tripId: string | string[]): TransportsSlice {
  const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
  const context = useTravelContext(cleanTripId);

  const transports = [...(context.transports || [])].sort((a, b) => {
    if (a.sequenceOrder !== undefined && b.sequenceOrder !== undefined) {
      return a.sequenceOrder - b.sequenceOrder;
    }
    return a.departureDate.getTime() - b.departureDate.getTime();
  });

  return {
    transports,
    transportsCount: context.transportsCount ?? transports.length,
  };
}
