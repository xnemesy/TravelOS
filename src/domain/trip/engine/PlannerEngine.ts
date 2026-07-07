import { TravelPlace } from '../models/place.model';
import { DayTimelineSummary, PlannerValidationWarning, TimelineItem } from './planner.types';

export class PlannerEngine {
  /**
   * Assegna (o rimuove) un luogo da un giorno del viaggio
   */
  static assignPlaceToDay(place: TravelPlace, dayNumber: number | undefined): TravelPlace {
    return {
      ...place,
      assignedDay: dayNumber,
      updatedAt: new Date(),
    };
  }

  /**
   * Calcola la distanza approssimativa in Km usando la formula di Haversine
   */
  static calculateDistanceKm(
    loc1?: { lat: number; lng: number },
    loc2?: { lat: number; lng: number }
  ): number {
    if (!loc1 || !loc2) return 0;
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371; // Raggio della Terra in km
    const dLat = toRad(loc2.lat - loc1.lat);
    const dLng = toRad(loc2.lng - loc1.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(loc1.lat)) *
        Math.cos(toRad(loc2.lat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(1));
  }

  /**
   * Stima i minuti di tragitto basandosi sulla distanza in ambiente urbano
   */
  static calculateTravelTimeMinutes(distanceKm: number): number {
    if (distanceKm <= 0) return 0;
    // Euristica urbana: ~12-15 minuti ogni chilometro a piedi o con mezzi urbani misti + 5 min base
    return Math.max(5, Math.round(distanceKm * 12));
  }

  /**
   * Genera la Timeline completa per una giornata del viaggio, stimando orari di inizio/fine e tragitti
   */
  static generateDayTimeline(placesInDay: TravelPlace[], dayNumber: number, startHour = 9): DayTimelineSummary {
    const items: TimelineItem[] = [];
    let currentTime = new Date(2026, 7, 10 + dayNumber - 1, startHour, 0, 0); // Base fissa per stima orario
    let totalVisitDurationMinutes = 0;
    let totalTravelMinutes = 0;
    let totalDistanceKm = 0;

    for (let i = 0; i < placesInDay.length; i++) {
      const currentPlace = placesInDay[i];
      const nextPlace = placesInDay[i + 1];

      const durationMinutes = currentPlace.averageVisitDurationMinutes || 60; // 1 ora di default se assente
      const estimatedStartTime = new Date(currentTime);
      const estimatedEndTime = new Date(currentTime.getTime() + durationMinutes * 60000);
      totalVisitDurationMinutes += durationMinutes;

      let nextTravelMinutes = 0;
      let nextDistanceKm = 0;

      if (nextPlace) {
        const coords1 = currentPlace.baseData.location?.coordinates;
        const coords2 = nextPlace.baseData.location?.coordinates;
        nextDistanceKm = this.calculateDistanceKm(coords1, coords2);
        nextTravelMinutes = this.calculateTravelTimeMinutes(nextDistanceKm);

        totalDistanceKm += nextDistanceKm;
        totalTravelMinutes += nextTravelMinutes;
      }

      items.push({
        id: `timeline-item-${currentPlace.id}`,
        place: currentPlace,
        orderIndex: i,
        estimatedStartTime,
        estimatedEndTime,
        nextTravelMinutes: nextPlace ? nextTravelMinutes : undefined,
        nextDistanceKm: nextPlace ? nextDistanceKm : undefined,
      });

      // Avanza il tempo per la tappa successiva (durata visita + tempo spostamento)
      currentTime = new Date(estimatedEndTime.getTime() + nextTravelMinutes * 60000);
    }

    const warnings = this.validateDaySchedule(placesInDay, items, dayNumber);

    return {
      dayNumber,
      items,
      totalPlacesCount: placesInDay.length,
      totalVisitDurationMinutes,
      totalTravelMinutes,
      totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
      warnings,
    };
  }

  /**
   * Smart Validation: analizza orari, distanze e carico della giornata per generare avvisi
   */
  static validateDaySchedule(
    placesInDay: TravelPlace[],
    timeline: TimelineItem[],
    dayNumber: number
  ): PlannerValidationWarning[] {
    const warnings: PlannerValidationWarning[] = [];

    // 1. Controllo sovraccarico giornata (> 8.5 ore totali tra visite e spostamenti)
    const totalMinutes = timeline.reduce(
      (sum, item) => sum + (item.place.averageVisitDurationMinutes || 60) + (item.nextTravelMinutes || 0),
      0
    );
    if (totalMinutes > 510) {
      const hours = Math.round((totalMinutes / 60) * 10) / 10;
      warnings.push({
        id: `warn-overstuffed-day-${dayNumber}`,
        type: 'overstuffed_day',
        title: 'Giornata Intensa',
        message: `Hai pianificato ${hours} ore di attività per il Giorno ${dayNumber}. Potrebbe essere faticoso.`,
        suggestion: 'Valuta di spostare 1 o 2 tappe in un giorno con meno attività.',
      });
    }

    // 2. Controllo orari di chiusura e tragitti lunghi
    for (let i = 0; i < timeline.length; i++) {
      const item = timeline[i];
      const place = item.place;

      // Controllo distanza eccessiva (> 5 km) verso la tappa successiva
      if (item.nextDistanceKm && item.nextDistanceKm > 5.0) {
        const nextItem = timeline[i + 1];
        warnings.push({
          id: `warn-dist-${place.id}`,
          type: 'long_distance',
          placeId: place.id,
          placeName: place.baseData.name,
          title: 'Spostamento Lungo',
          message: `Tra ${place.baseData.name} e ${nextItem?.place.baseData.name || 'la prossima tappa'} ci sono ${item.nextDistanceKm} km (${item.nextTravelMinutes} min).`,
          suggestion: 'Forse conviene riordinare le tappe per raggruppare i luoghi vicini.',
        });
      }

      // Controllo orari di chiusura (se specificato in openingHours es. "09:00 - 18:00")
      if (place.baseData.openingHours) {
        // Estrazione orario chiusura semplice dal formato "xx:xx - 18:00" o "chiude alle 18:00"
        const match = place.baseData.openingHours.match(/(\d{1,2})[:.](\d{2})\s*$/);
        if (match) {
          const closingHour = parseInt(match[1], 10);
          const closingMinute = parseInt(match[2], 10);
          const endHour = item.estimatedEndTime.getHours();
          const endMinute = item.estimatedEndTime.getMinutes();

          if (endHour > closingHour || (endHour === closingHour && endMinute > closingMinute)) {
            const timeFormatted = `${item.estimatedEndTime.getHours().toString().padStart(2, '0')}:${item.estimatedEndTime.getMinutes().toString().padStart(2, '0')}`;
            warnings.push({
              id: `warn-closing-${place.id}`,
              type: 'closing_time',
              placeId: place.id,
              placeName: place.baseData.name,
              title: 'Rischio Chiusura',
              message: `${place.baseData.name} chiude alle ${closingHour.toString().padStart(2, '0')}:${closingMinute.toString().padStart(2, '0')}. Con l'ordine attuale termineresti la visita alle ${timeFormatted}.`,
              suggestion: 'Anticipa questa visita all\'inizio della giornata o spostala a un altro giorno.',
            });
          }
        }
      }
    }

    return warnings;
  }

  /**
   * Riordina le tappe di una singola giornata mantenendo la sequenza specificata
   */
  static reorderPlacesInDay(placesInDay: TravelPlace[], orderedPlaceIds: string[]): TravelPlace[] {
    const map = new Map(placesInDay.map((p) => [p.id, p]));
    const reordered: TravelPlace[] = [];
    for (const id of orderedPlaceIds) {
      const found = map.get(id);
      if (found) reordered.push(found);
    }
    // Aggiunge eventuali luoghi rimasti non presenti in orderedPlaceIds
    for (const p of placesInDay) {
      if (!orderedPlaceIds.includes(p.id)) reordered.push(p);
    }
    return reordered;
  }

  /**
   * Predisposizione per l'ottimizzazione automatica (AI Engine) di un giorno
   */
  static async optimizeDay(placesInDay: TravelPlace[]): Promise<TravelPlace[]> {
    // In futuro: chiamata all'AI Engine o all'algoritmo del commesso viaggiatore per ordinare per minima distanza
    console.log('[PlannerEngine] Predisposizione AI optimizeDay eseguita.');
    return [...placesInDay];
  }

  /**
   * Predisposizione per l'ottimizzazione automatica (AI Engine) di tutto il viaggio
   */
  static async optimizeTrip(places: TravelPlace[]): Promise<TravelPlace[]> {
    console.log('[PlannerEngine] Predisposizione AI optimizeTrip eseguita.');
    return [...places];
  }
}
