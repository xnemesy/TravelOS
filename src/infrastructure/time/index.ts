/**
 * Barrel del modulo temporale di infrastruttura (ADR-025). Punto d'ingresso
 * unico per i consumatori: espone il contratto `TemporalService`, la sua
 * implementazione di default e la risoluzione del fuso dal luogo.
 */
export * from './TemporalService';
export * from './DefaultTemporalService';
export * from './TimeZoneResolver';

import { TemporalService } from './TemporalService';
import { DefaultTemporalService } from './DefaultTemporalService';
import { TimeZoneResolver, StaticTimeZoneResolver } from './TimeZoneResolver';

/**
 * ============================================================================
 * Composition root del modulo temporale (Sprint 18.5)
 * ============================================================================
 * Singleton di modulo, stessa convenzione di `TravelServices`/`placeRepository`
 * (`export const X = new XPlatform()`). Rende la temporal infrastructure
 * disponibile ai futuri consumatori (a partire da `JourneyAnchorEngine`, ADR-025
 * §7 Fase 2) senza migrare nulla oggi — puramente additivo, zero cambi di
 * comportamento.
 *
 * Tipizzati sulle INTERFACCE, mai sulle classi concrete: i consumatori
 * dipendono dal contratto, non dall'implementazione (§14.1). Sostituire
 * `DefaultTemporalService` in futuro tocca solo questo file.
 *
 * Il resolver è un'unica istanza condivisa, iniettata nel servizio *e*
 * esportata: nessuna seconda fonte di fuso che possa divergere (§4.2 / §6.8).
 *
 * Costruzione pura e a basso costo (solo tabelle statiche, nessun
 * `Date`/`Intl`/rete/storage): istanziare all'import del barrel è privo di
 * side effect.
 */
export const timeZoneResolver: TimeZoneResolver = new StaticTimeZoneResolver();
export const temporalService: TemporalService = new DefaultTemporalService(timeZoneResolver);
