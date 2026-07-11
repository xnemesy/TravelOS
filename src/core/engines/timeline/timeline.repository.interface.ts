import { TimelineDaySchedule } from '../types/context.types';

/**
 * Persistenza della timeline per trip (ADR-021 — Repository Abstraction).
 * `TimelineEngine` dipende solo da questo contratto: non conosce MMKV, chiavi
 * di storage o formato di cache — né la chiave/formato del repository dei Trip.
 */
export interface ITimelineRepository {
  /** Timeline persistita per il trip, o `null` se non è mai stata generata/scritta. */
  getTimeline(tripId: string): Promise<TimelineDaySchedule[] | null>;

  /** Sostituisce integralmente la timeline persistita per il trip. */
  saveTimeline(tripId: string, days: TimelineDaySchedule[]): Promise<void>;

  /**
   * Risolve l'intervallo di date del trip, o `null` se il trip non è
   * risolvibile. Serve solo a generare i giorni di default quando la timeline
   * non è mai stata creata — non è persistenza di Timeline in senso stretto
   * (il Trip è un aggregato diverso), ma questo contratto esiste apposta
   * perché TimelineEngine non deve conoscere come/dove sono persistiti i Trip.
   */
  getTripDateRange(tripId: string): Promise<{ startDate: Date; endDate: Date } | null>;
}
