import { useTravelContext } from './useTravelContext';
import { TravelContext } from '../../core/engines/types/context.types';

/**
 * ============================================================================
 * USE BUDGET (HOOK GRANULARE SELETTIVO)
 * ============================================================================
 * Fornisce lo stato finanziario e il budget del viaggio (Fase 2).
 */
export function useBudget(tripId: string): TravelContext['budgetStatus'] {
  const context = useTravelContext(tripId);
  return context.budgetStatus;
}
