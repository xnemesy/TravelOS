import { useState, useEffect } from 'react';
import { TravelContext, contextEngine } from '../../core/engines';

/**
 * ============================================================================
 * USE TRAVEL CONTEXT (HOOK GLOBALE)
 * ============================================================================
 * REGOLA D'ORO DEL VIEW LAYER:
 * Nessun componente UI può leggere direttamente da repository, store, MMKV o Firebase.
 * Questo hook sottoscrive reattivamente allo stream del Context Engine.
 */
export function useTravelContext(tripId: string | string[]): TravelContext {
  const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
  const [context, setContext] = useState<TravelContext>(() =>
    contextEngine.getContext(cleanTripId)
  );

  useEffect(() => {
    // Sottoscrive lo stream reattivo del compositore
    const unsubscribe = contextEngine.subscribe(cleanTripId, (newContext) => {
      setContext(newContext);
    });

    return () => {
      unsubscribe();
    };
  }, [cleanTripId]);

  return context;
}
