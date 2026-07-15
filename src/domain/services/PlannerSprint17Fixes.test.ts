import { journeyComposer } from './JourneyComposer';
import { JourneyAnchorEngine } from './JourneyAnchorEngine';
import { TimelineEngine } from '../../core/engines/timeline/timeline.engine';
import { PlaceRef, TimelineDaySchedule, JourneyAnchor, JourneyConstraints } from '../../core/engines/types/context.types';

const defaultConstraints: JourneyConstraints = {
  maxWalkingKm: 10,
  maxExperiences: 5,
  targetOccupancy: 0.8,
  lunchRequired: true,
  dinnerRequired: true,
  freeTimeRequired: true,
  preferredEndTime: '22:00',
};

describe('Planner Sprint 17 Fixes (Zero Regression Bug Sprint)', () => {
  describe('BUG 1 — Meal Scheduler ignores time windows', () => {
    it('does not insert lunch after check-in late at night or outside configured meal windows', async () => {
      const schedule: TimelineDaySchedule = {
        dayNumber: 1,
        date: '2026-08-10',
        places: [
          {
            id: 'late-checkin',
            name: 'Hotel Late Checkin',
            category: 'hotel',
            scheduledTime: '21:30',
            durationMinutes: 30,
            isLocked: true,
          },
        ],
        totalWalkDistanceMeters: 0,
        totalEstimatedDurationMinutes: 0,
        overview: { experiencesCount: 0, startTime: '21:30', endTime: '22:00', foodStopsCount: 0 },
      };

      const composed = await journeyComposer.composeDayJourney(
        schedule,
        'culture',
        { ...defaultConstraints, preferredEndTime: '22:30' }
      );

      const meals = composed.places.filter(p => p.isBlock && (p.category === 'lunch' || p.category === 'breakfast' || p.category === 'dinner'));
      // A 21:30 o dopo, non si deve mai generare un pranzo (finestra 11:30-15:00) o colazione (06:00-10:30)
      const hasLunchOrBreakfast = meals.some(m => m.category === 'lunch' || m.category === 'breakfast');
      expect(hasLunchOrBreakfast).toBe(false);
    });
  });

  describe('BUG 3 — Midnight Crossing in JourneyAnchorEngine', () => {
    it('splits anchor across calendar days at presentation layer without breaking identity', () => {
      const anchor: JourneyAnchor = {
        id: 'anchor-arrival-flight-flight-1',
        kind: 'arrival_flight',
        label: 'Volo Arrivo',
        date: '2026-08-10',
        startISO: '2026-08-10T20:00:00.000Z',
        endISO: '2026-08-11T00:45:00.000Z',
        sourceType: 'transport',
        sourceId: 'flight-1',
      };

      const anchorsDay1 = JourneyAnchorEngine.getAnchorsForDate([anchor], '2026-08-10');
      expect(anchorsDay1.length).toBe(1);

      const placesDay1 = JourneyAnchorEngine.toPlaceRefs(anchorsDay1, '2026-08-10');
      expect(placesDay1[0].calculatedStartTime).toBe('20:00');
      expect(placesDay1[0].calculatedEndTime).toBe('23:59');

      const anchorsDay2 = JourneyAnchorEngine.getAnchorsForDate([anchor], '2026-08-11');
      expect(anchorsDay2.length).toBe(1);

      const placesDay2 = JourneyAnchorEngine.toPlaceRefs(anchorsDay2, '2026-08-11');
      expect(placesDay2[0].calculatedStartTime).toBe('00:00');
      expect(placesDay2[0].calculatedEndTime).toBe('00:45');
    });
  });

  describe('BUG 4 & 7 — Dynamic effectiveDayEnd and Feasibility checks', () => {
    it('computes effectiveDayEnd correctly and skips attractions that exceed effectiveDayEnd', async () => {
      const longMuseum: PlaceRef = {
        id: 'long-museum',
        name: 'Super Long Museum',
        category: 'museum',
        durationMinutes: 180, // 3 ore
      };
      const shortWalk: PlaceRef = {
        id: 'short-walk',
        name: 'Nice Park Walk',
        category: 'walk',
        durationMinutes: 30, // 30 min
      };

      const transferAnchor: JourneyAnchor = {
        id: 'anchor-transfer-1',
        kind: 'transfer',
        label: 'Arrivo in Hotel',
        date: '2026-08-10',
        startISO: '2026-08-10T15:15:00.000Z',
        endISO: '2026-08-10T16:00:00.000Z',
        sourceType: 'derived',
      };

      const schedule: TimelineDaySchedule = {
        dayNumber: 1,
        date: '2026-08-10',
        places: [longMuseum, shortWalk],
        totalWalkDistanceMeters: 0,
        totalEstimatedDurationMinutes: 0,
        overview: { experiencesCount: 2, startTime: '16:00', endTime: '18:00', foodStopsCount: 0 },
        anchors: [transferAnchor],
      };

      // Se preferredEndTime è 18:00 (1080 min) e l'anchor finisce alle 16:00 (960 min), ci sono solo 120 min.
      // Il museo da 180 min non deve essere pianificato.
      const composed = await journeyComposer.composeDayJourney(
        schedule,
        'culture',
        { ...defaultConstraints, preferredEndTime: '18:00' },
        [transferAnchor]
      );

      const placedIds = composed.places.map(p => p.id);
      expect(placedIds).not.toContain('long-museum');
      expect(placedIds).toContain('short-walk');
    });
  });

  describe('BUG 5 — DeferredQueue Priority & Retention', () => {
    it('preserves user priority (must-see first), original ordering, and retains locked places assigned to the day', () => {
      const pool: PlaceRef[] = [
        { id: 'opt-1', name: 'Optional 1', category: 'walk', priority: 'optional' },
        { id: 'must-1', name: 'Must See 1', category: 'museum', priority: 'must_see' },
        { id: 'locked-day-1', name: 'Locked Day 1', category: 'restaurant', isLocked: true },
        { id: 'high-1', name: 'High Priority 1', category: 'visit', priority: 'must_see' as any },
        { id: 'opt-2', name: 'Optional 2', category: 'walk', priority: 'optional' },
      ];

      const placedIds = new Set<string>(); // Nessuno piazzato per simulare capienza piena
      const existingRealIds = new Set(['locked-day-1']); // Elemento bloccato originario del giorno

      const sortedQueue = TimelineEngine.filterAndSortDeferredQueue(pool, placedIds, existingRealIds);

      const ids = sortedQueue.map(p => p.id);
      // Il locked-day-1 originario della giornata non deve essere diffuso nella queue verso un altro giorno (mai mosso automaticamente)
      expect(ids).not.toContain('locked-day-1');
      // I must-see devono essere in cima e preservando l'ordine originale tra loro (must-1 prima di high-1)
      expect(ids[0]).toBe('must-1');
      expect(ids[1]).toBe('high-1');
      // Gli optional dopo in ordine originale
      expect(ids[2]).toBe('opt-1');
      expect(ids[3]).toBe('opt-2');
    });
  });

  describe('BUG 6 — Explanation Generation (statusLabel)', () => {
    it('provides clear explanation when no sightseeing is scheduled due to late arrival', async () => {
      const lateTransfer: JourneyAnchor = {
        id: 'anchor-late-transfer',
        kind: 'transfer',
        label: 'Arrivo tardivo',
        date: '2026-08-10',
        startISO: '2026-08-10T21:00:00.000Z',
        endISO: '2026-08-10T21:40:00.000Z',
        sourceType: 'derived',
      };

      const schedule: TimelineDaySchedule = {
        dayNumber: 1,
        date: '2026-08-10',
        places: [
          {
            id: 'museum-1',
            name: 'Museum',
            category: 'museum',
            durationMinutes: 120,
          },
        ],
        totalWalkDistanceMeters: 0,
        totalEstimatedDurationMinutes: 0,
        overview: { experiencesCount: 1, startTime: '21:40', endTime: '22:00', foodStopsCount: 0 },
        anchors: [lateTransfer],
      };

      const composed = await journeyComposer.composeDayJourney(
        schedule,
        'culture',
        { ...defaultConstraints, preferredEndTime: '22:00' },
        [lateTransfer]
      );

      const overview: any = composed.overview;
      expect(overview?.journeyReport?.statusLabel).toContain('Nessuna attività di visita aggiunta: tempo a disposizione limitato dopo l\'arrivo (o transito serale)');
    });
  });
});
