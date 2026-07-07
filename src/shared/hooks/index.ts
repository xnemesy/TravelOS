/**
 * ============================================================================
 * VIEW LAYER ACCESS HOOKS (LA REGOLA D'ORO)
 * ============================================================================
 * REGOLA ARCHITETTURALE INVIOLABILE:
 * NESSUN COMPONENTE UI può leggere Repository, Store, Firebase, MMKV o Provider
 * direttamente. L'interfaccia utente può leggere e scrivere esclusivamente tramite questi Hooks!
 * 
 * Componenti UI ──► Hooks Granulari ──► Context Engine ──► Domain
 */

export * from './useTravelContext';
export * from './useNextPlace';
export * from './useTimeline';
export * from './useBudget';
export * from './useWeather';
export * from './usePlaces';
export * from './useTravelActions';
