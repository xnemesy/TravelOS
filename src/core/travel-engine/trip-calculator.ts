import { Trip, TripStatus, TripEvent } from '../../domain/trip/models/trip.model';

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
}

export class TripCalculator {
  
  /**
   * Calcola lo stato del viaggio in base alle date.
   */
  static getTripStatus(trip: Trip, now: Date = new Date()): TripStatus {
    if (trip.status === 'cancelled') return 'cancelled';
    if (trip.status === 'ready' && now < trip.startDate) return 'ready';
    if (trip.status === 'completed') return 'completed';
    
    if (now < trip.startDate) return 'planned';
    if (now >= trip.startDate && now <= trip.endDate) return 'ongoing';
    return 'completed';
  }

  /**
   * Ritorna il countdown alla partenza. Se il viaggio è iniziato, tutto è 0.
   */
  static getCountdown(trip: Trip, now: Date = new Date()): Countdown {
    const diffMs = trip.startDate.getTime() - now.getTime();
    if (diffMs <= 0) return { days: 0, hours: 0, minutes: 0 };

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diffMs / 1000 / 60) % 60);

    return { days, hours, minutes };
  }

  /**
   * Ritorna la durata del viaggio in notti.
   */
  static getDuration(trip: Trip): number {
    const diffMs = trip.endDate.getTime() - trip.startDate.getTime();
    const nights = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, nights);
  }

  /**
   * Se il viaggio è in corso, ritorna il giorno corrente (es. Giorno 1, Giorno 2).
   * Altrimenti null.
   */
  static getCurrentDay(trip: Trip, now: Date = new Date()): number | null {
    if (this.getTripStatus(trip, now) !== 'ongoing') return null;

    const diffMs = now.getTime() - trip.startDate.getTime();
    const daysPassed = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return daysPassed + 1;
  }

  /**
   * Percentuale di completamento del viaggio (0 a 100).
   */
  static getProgress(trip: Trip, now: Date = new Date()): number {
    const status = this.getTripStatus(trip, now);
    if (status === 'completed') return 100;
    if (status === 'cancelled') return 0;
    if (status === 'planned' || status === 'ready') {
      return trip.progress !== undefined ? trip.progress : 0;
    }

    const totalDurationMs = trip.endDate.getTime() - trip.startDate.getTime();
    const elapsedMs = now.getTime() - trip.startDate.getTime();
    
    if (totalDurationMs <= 0) return 100;

    const rawProgress = (elapsedMs / totalDurationMs) * 100;
    return Math.min(Math.max(Math.round(rawProgress), 0), 100);
  }

  /**
   * Trova il prossimo evento in base all'orario attuale.
   */
  static getNextEvent(events: TripEvent[], now: Date = new Date()): TripEvent | null {
    const futureEvents = events
      .filter(e => e.startTime.getTime() > now.getTime())
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      
    return futureEvents.length > 0 ? futureEvents[0] : null;
  }
}
