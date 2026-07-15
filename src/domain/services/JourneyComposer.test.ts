import { journeyComposer } from './JourneyComposer';
import { JourneyAnchorEngine } from './JourneyAnchorEngine';
import { Transport, Accommodation } from '../trip/models/trip-setup.model';

describe('JourneyComposerService.calculateExperienceDensity', () => {
  it('classifies an empty day as very_relaxed', () => {
    expect(journeyComposer.calculateExperienceDensity(0, 0, 0)).toBe('very_relaxed');
    expect(journeyComposer.calculateExperienceDensity(1, 1, 1)).toBe('very_relaxed');
  });

  it('classifies a light day (just past the very_relaxed threshold) as relaxed', () => {
    expect(journeyComposer.calculateExperienceDensity(0, 0, 2)).toBe('relaxed');
    expect(journeyComposer.calculateExperienceDensity(0, 4, 0)).toBe('relaxed');
  });

  it('classifies a moderate day as balanced', () => {
    expect(journeyComposer.calculateExperienceDensity(5, 6, 4)).toBe('balanced');
  });

  it('classifies a packed day as busy', () => {
    expect(journeyComposer.calculateExperienceDensity(9, 9, 7)).toBe('busy');
  });

  it('classifies an extreme day as intense', () => {
    expect(journeyComposer.calculateExperienceDensity(15, 11, 9)).toBe('intense');
  });

  it('lets any single dimension push the day into a higher density tier', () => {
    // 0 km, 0 hours walked, but 9 places scheduled should still count as intense
    expect(journeyComposer.calculateExperienceDensity(0, 0, 9)).toBe('intense');
  });
  it('composes a simple itinerary day without errors', async () => {
    const mockPlaces = [
      {
        id: 'p-1',
        name: 'Colosseo',
        category: 'landmark',
        coordinates: { latitude: 41.8902, longitude: 12.4922 },
        durationMinutes: 90,
      },
      {
        id: 'p-2',
        name: 'Fontana di Trevi',
        category: 'landmark',
        coordinates: { latitude: 41.9009, longitude: 12.4833 },
        durationMinutes: 45,
      },
    ];

    const result = await journeyComposer.compose({
      availablePlaces: mockPlaces,
      travelStyle: 'culture',
      targetDay: 1,
      dateStr: '2026-08-01',
    });

    expect(result.places.length).toBeGreaterThan(0);
    expect(result.places.some(p => p.id.includes('breakfast'))).toBe(true);
  });

  it('never schedules an activity before the arrival Journey Anchors on the arrival day', async () => {
    const transports: Transport[] = [
      {
        id: 'in',
        mode: 'flight',
        destination: 'Roma',
        origin: 'Milano',
        departureDate: new Date('2026-08-01T13:00:00.000Z'),
        arrivalDate: new Date('2026-08-01T15:30:00.000Z'),
        confirmed: true,
      } as Transport,
    ];
    const accommodations: Accommodation[] = [
      {
        id: 'hotel-1',
        type: 'hotel',
        name: 'Hotel Roma',
        checkIn: new Date('2026-08-01T16:00:00.000Z'),
        checkOut: new Date('2026-08-05T10:00:00.000Z'),
        confirmed: true,
      } as Accommodation,
    ];
    const anchors = JourneyAnchorEngine.buildTripAnchors(transports, accommodations);

    const mockPlaces = [
      {
        id: 'p-1',
        name: 'Colosseo',
        category: 'landmark',
        coordinates: { latitude: 41.8902, longitude: 12.4922 },
        durationMinutes: 90,
      },
    ];

    const result = await journeyComposer.compose({
      availablePlaces: mockPlaces,
      travelStyle: 'culture',
      targetDay: 1,
      dateStr: '2026-08-01',
      anchors,
    });

    const window = JourneyAnchorEngine.getDayActivityWindow(anchors, '2026-08-01')!;
    const activityPlaces = result.places.filter(p => !p.isBlock);

    for (const place of activityPlaces) {
      const [h, m] = (place.calculatedStartTime || '00:00').split(':').map(Number);
      expect(h * 60 + m).toBeGreaterThanOrEqual(window.startMinutes);
    }
  });

  it('never schedules an activity after the departure Journey Anchors on the departure day', async () => {
    const transports: Transport[] = [
      {
        id: 'out',
        mode: 'flight',
        destination: 'Milano',
        origin: 'Roma',
        departureDate: new Date('2026-08-05T14:00:00.000Z'),
        arrivalDate: new Date('2026-08-05T15:30:00.000Z'),
        confirmed: true,
      } as Transport,
    ];
    const accommodations: Accommodation[] = [
      {
        id: 'hotel-1',
        type: 'hotel',
        name: 'Hotel Roma',
        checkIn: new Date('2026-08-01T16:00:00.000Z'),
        checkOut: new Date('2026-08-05T10:00:00.000Z'),
        confirmed: true,
      } as Accommodation,
    ];
    const anchors = JourneyAnchorEngine.buildTripAnchors(transports, accommodations);

    const mockPlaces = [
      {
        id: 'p-1',
        name: 'Fontana di Trevi',
        category: 'landmark',
        coordinates: { latitude: 41.9009, longitude: 12.4833 },
        durationMinutes: 45,
      },
    ];

    const result = await journeyComposer.compose({
      availablePlaces: mockPlaces,
      travelStyle: 'culture',
      targetDay: 5,
      dateStr: '2026-08-05',
      anchors,
    });

    const window = JourneyAnchorEngine.getDayActivityWindow(anchors, '2026-08-05')!;
    const activityPlaces = result.places.filter(p => !p.isBlock);

    for (const place of activityPlaces) {
      const [h, m] = (place.calculatedEndTime || '00:00').split(':').map(Number);
      expect(h * 60 + m).toBeLessThanOrEqual(window.endMinutes);
    }
  });
});
