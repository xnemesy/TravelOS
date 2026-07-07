import { GeoLocation } from '../../core/engines/types/context.types';

/**
 * ============================================================================
 * DISTANCE CALCULATOR (DOMAIN SERVICE)
 * ============================================================================
 * REGOLA ARCHITETTURALE:
 * Gli Engine orchestrano. I Domain Service calcolano.
 * Questo servizio è un modulo puro, stateless, responsabile unicamente dei
 * calcoli geometrici e stime di tempo/spostamento geospaziale.
 */
export class DistanceCalculator {
  private static readonly EARTH_RADIUS_METERS = 6371000;
  private static readonly DEFAULT_WALKING_SPEED_KMH = 4.8; // Velocità media a piedi
  private static readonly DEFAULT_DRIVING_SPEED_KMH = 30.0; // Velocità media in città

  /**
   * Calcola la distanza in metri tra due coordinate geografiche utilizzando la formula di Haversine.
   */
  public static calculateHaversineDistance(loc1: GeoLocation, loc2: GeoLocation): number {
    const dLat = this.degreesToRadians(loc2.latitude - loc1.latitude);
    const dLon = this.degreesToRadians(loc2.longitude - loc1.longitude);

    const lat1Rad = this.degreesToRadians(loc1.latitude);
    const lat2Rad = this.degreesToRadians(loc2.latitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return Math.round(this.EARTH_RADIUS_METERS * c);
  }

  /**
   * Stima il tempo di camminata in minuti data una distanza in metri.
   */
  public static estimateWalkingDurationMinutes(distanceMeters: number, speedKmh = this.DEFAULT_WALKING_SPEED_KMH): number {
    if (distanceMeters <= 0) return 0;
    const speedMetersPerMinute = (speedKmh * 1000) / 60;
    return Math.ceil(distanceMeters / speedMetersPerMinute);
  }

  /**
   * Stima il tempo di guida in minuti data una distanza in metri.
   */
  public static estimateDrivingDurationMinutes(distanceMeters: number, speedKmh = this.DEFAULT_DRIVING_SPEED_KMH): number {
    if (distanceMeters <= 0) return 0;
    const speedMetersPerMinute = (speedKmh * 1000) / 60;
    return Math.ceil(distanceMeters / speedMetersPerMinute);
  }

  /**
   * Calcola la matrice di distanza e tempo a piedi tra un array sequenziale di tappe.
   */
  public static calculateRouteMetrics(locations: GeoLocation[]): { totalDistanceMeters: number; totalWalkMinutes: number } {
    let totalDistanceMeters = 0;

    for (let i = 0; i < locations.length - 1; i++) {
      totalDistanceMeters += this.calculateHaversineDistance(locations[i], locations[i + 1]);
    }

    const totalWalkMinutes = this.estimateWalkingDurationMinutes(totalDistanceMeters);

    return { totalDistanceMeters, totalWalkMinutes };
  }

  private static degreesToRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}
