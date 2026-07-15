import { useMemo } from 'react';
import { useTripStore } from '../../features/trips/store/trip.store';
import { useTravelContext } from './useTravelContext';
import { SetupCompletionEngine, SetupProgress } from '../../domain/trip/engine/SetupCompletionEngine';

/**
 * ============================================================================
 * USE SETUP PROGRESS (HOOK GRANULARE SELETTIVO - SETUP COMPLETION MODULE)
 * ============================================================================
 * Conforme alla Regola d'Oro del View Layer (PRODUCT_PRINCIPLES.md §7):
 * NESSUN COMPONENTE UI può calcolare o duplicare la logica di sblocco/completezza
 * del viaggio né leggere direttamente da DB/MMKV. Questo hook compone lo stato
 * del Trip dallo store e il contesto di viaggio (trasporti/alloggi) dal Context Engine,
 * delegando il calcolo puro e deterministico esclusivamente a `SetupCompletionEngine`.
 */
export function useSetupProgress(tripId: string | string[]): SetupProgress {
  const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
  const trip = useTripStore((s) => s.getTripById(cleanTripId));
  const context = useTravelContext(cleanTripId);

  return useMemo(() => {
    return SetupCompletionEngine.evaluateSetup({
      ...(trip || {}),
      id: cleanTripId,
      title: trip?.title || context.tripTitle,
      destination: trip?.destination || context.destination,
      startDate: trip?.startDate || context.startDate,
      endDate: trip?.endDate || context.endDate,
      transports: context.transports || [],
      accommodations: context.accommodations || [],
    });
  }, [
    trip,
    cleanTripId,
    context.tripTitle,
    context.destination,
    context.startDate,
    context.endDate,
    context.transports,
    context.accommodations,
  ]);
}
