import { journeyComposer, JourneyComposerService } from './JourneyComposer';
import { JourneyAnchorEngine } from './JourneyAnchorEngine';
import { Transport, Accommodation } from '../trip/models/trip-setup.model';
import { PlaceRef } from '../../core/engines/types/context.types';

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

describe('JourneyComposer integration with EndOfDayClosureService (Sprint 18 Phase 7)', () => {
  it('appends accommodation_return block at the end of a normal sightseeing day when return is required', async () => {
    const accommodations: Accommodation[] = [
      {
        id: 'hotel-roma',
        type: 'hotel',
        name: 'Hotel Roma Nord',
        checkIn: new Date('2026-08-01T14:00:00.000Z'),
        checkOut: new Date('2026-08-05T10:00:00.000Z'),
        coordinates: { lat: 41.9100, lng: 12.4900 },
        confirmed: true,
      } as Accommodation,
    ];

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
      targetDay: 2,
      dateStr: '2026-08-02',
      accommodations,
    });

    const returnAnchors = result.places.filter(p => p.journeyAnchorKind === 'accommodation_return');
    expect(returnAnchors.length).toBe(1);
    const lastPlace = result.places[result.places.length - 1];
    expect(lastPlace.journeyAnchorKind).toBe('accommodation_return');
    expect(lastPlace.isBlock).toBe(true);
    expect(lastPlace.isLocked).toBe(true);
    expect(lastPlace.anchorType).toBe('HARD');
  });

  it('generates a valid (non-NaN) calculatedStartTime/calculatedEndTime and overview.endTime for the accommodation_return block', async () => {
    const accommodations: Accommodation[] = [
      {
        id: 'hotel-roma',
        type: 'hotel',
        name: 'Hotel Roma Nord',
        checkIn: new Date('2026-08-01T14:00:00.000Z'),
        checkOut: new Date('2026-08-05T10:00:00.000Z'),
        coordinates: { lat: 41.9100, lng: 12.4900 },
        confirmed: true,
      } as Accommodation,
    ];

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
      targetDay: 2,
      dateStr: '2026-08-02',
      accommodations,
    });

    const timePattern = /^\d{2}:\d{2}$/;
    const returnPlace = result.places.find(p => p.journeyAnchorKind === 'accommodation_return');

    expect(returnPlace).toBeDefined();
    expect(returnPlace!.calculatedStartTime).toMatch(timePattern);
    expect(returnPlace!.calculatedEndTime).toMatch(timePattern);
    expect(returnPlace!.calculatedStartTime).not.toContain('NaN');
    expect(returnPlace!.calculatedEndTime).not.toContain('NaN');
    expect(result.overview.endTime).toMatch(timePattern);
    expect(result.overview.endTime).not.toContain('NaN');
  });

  it('preserves existing behavior and omits accommodation_return on departure day', async () => {
    const accommodations: Accommodation[] = [
      {
        id: 'hotel-roma',
        type: 'hotel',
        name: 'Hotel Roma Nord',
        checkIn: new Date('2026-08-01T14:00:00.000Z'),
        checkOut: new Date('2026-08-05T10:00:00.000Z'),
        coordinates: { lat: 41.9100, lng: 12.4900 },
        confirmed: true,
      } as Accommodation,
    ];
    const transports: Transport[] = [
      {
        id: 'flight-out',
        mode: 'flight',
        destination: 'Milano',
        origin: 'Roma',
        departureDate: new Date('2026-08-05T16:00:00.000Z'),
        arrivalDate: new Date('2026-08-05T17:30:00.000Z'),
        confirmed: true,
      } as Transport,
    ];
    const anchors = JourneyAnchorEngine.buildTripAnchors(transports, accommodations);

    const mockPlaces = [
      {
        id: 'p-1',
        name: 'Pantheon',
        category: 'landmark',
        coordinates: { latitude: 41.8986, longitude: 12.4769 },
        durationMinutes: 60,
      },
    ];

    const result = await journeyComposer.compose({
      availablePlaces: mockPlaces,
      travelStyle: 'culture',
      targetDay: 5,
      dateStr: '2026-08-05',
      anchors,
      accommodations,
      transports,
    });

    expect(result.places.some(p => p.journeyAnchorKind === 'accommodation_return')).toBe(false);
  });

  it('preserves existing behavior when arrival late evening leaves insufficient remaining time', async () => {
    const accommodations: Accommodation[] = [
      {
        id: 'hotel-roma',
        type: 'hotel',
        name: 'Hotel Roma Nord',
        checkIn: new Date('2026-08-01T14:00:00.000Z'),
        checkOut: new Date('2026-08-05T10:00:00.000Z'),
        coordinates: { lat: 41.9100, lng: 12.4900 },
        confirmed: true,
      } as Accommodation,
    ];
    const transports: Transport[] = [
      {
        id: 'flight-in',
        mode: 'flight',
        destination: 'Roma',
        origin: 'Milano',
        departureDate: new Date('2026-08-01T22:00:00.000Z'),
        arrivalDate: new Date('2026-08-01T23:30:00.000Z'),
        confirmed: true,
      } as Transport,
    ];
    const anchors = JourneyAnchorEngine.buildTripAnchors(transports, accommodations);

    const result = await journeyComposer.compose({
      availablePlaces: [],
      travelStyle: 'culture',
      targetDay: 1,
      dateStr: '2026-08-01',
      anchors,
      accommodations,
      transports,
    });

    expect(result.places.some(p => p.journeyAnchorKind === 'accommodation_return')).toBe(false);
  });

  it('preserves existing behavior and omits accommodation_return on a hotel change transition day without night coverage', async () => {
    const accommodations: Accommodation[] = [
      {
        id: 'hotel-1',
        type: 'hotel',
        name: 'Hotel 1',
        checkIn: new Date('2026-08-01T14:00:00.000Z'),
        checkOut: new Date('2026-08-03T10:00:00.000Z'),
        coordinates: { lat: 41.9100, lng: 12.4900 },
        confirmed: true,
      } as Accommodation,
    ];

    const result = await journeyComposer.compose({
      availablePlaces: [],
      travelStyle: 'culture',
      targetDay: 3,
      dateStr: '2026-08-03',
      accommodations,
    });

    expect(result.places.some(p => p.journeyAnchorKind === 'accommodation_return')).toBe(false);
  });

  it('never adds a duplicate accommodation_return when one already exists as the last hard-scheduled node', async () => {
    const accommodations: Accommodation[] = [
      {
        id: 'hotel-roma',
        type: 'hotel',
        name: 'Hotel Roma Nord',
        checkIn: new Date('2026-08-01T14:00:00.000Z'),
        checkOut: new Date('2026-08-05T10:00:00.000Z'),
        coordinates: { lat: 41.9100, lng: 12.4900 },
        confirmed: true,
      } as Accommodation,
    ];

    // isBlock:false (non isBlock:true come nel test precedente): un place
    // isBlock finisce filtrato fuori da nonBlockPlaces PRIMA che la pipeline
    // di composizione parta, facendo scattare il return anticipato di
    // composeDayJourney (nonBlockPlaces.length===0 && anchorBlocks.length===0)
    // e rendendo il test vacuo — passa senza mai eseguire la guardia che
    // dichiara di verificare. Qui il place esistente entra regolarmente in
    // hardAnchors (anchorType HARD + scheduledTime), così la pipeline
    // completa (EndOfDayClosureService + hasClosingOrDeparture) viene
    // davvero attraversata.
    const inputSchedule = {
      dayNumber: 2,
      date: '2026-08-02',
      places: [
        {
          id: 'existing-return',
          name: 'Rientro in hotel',
          category: 'accommodation_return',
          coordinates: { latitude: 41.9100, longitude: 12.4900 },
          isBlock: false,
          isLocked: true,
          anchorType: 'HARD' as const,
          journeyAnchorKind: 'accommodation_return' as const,
          scheduledTime: '2026-08-02T19:00:00.000Z',
          durationMinutes: 30,
        } as PlaceRef,
      ],
      totalWalkDistanceMeters: 0,
      totalEstimatedDurationMinutes: 0,
      overview: { experiencesCount: 1, startTime: '09:00', endTime: '21:00', foodStopsCount: 0 },
    };

    const result = await journeyComposer.composeDayJourney(
      inputSchedule, 'culture', undefined, undefined, accommodations
    );

    // Prova che la pipeline sia stata effettivamente eseguita (niente return
    // anticipato): un compose completo produce sempre un journeyReport.
    expect(result).not.toBe(inputSchedule);
    expect(result.journeyReport).toBeDefined();

    const returnAnchors = result.places.filter(p => p.journeyAnchorKind === 'accommodation_return');
    expect(returnAnchors.length).toBe(1);
    expect(returnAnchors[0].id).toBe('existing-return');
  });

  it('never adds a duplicate accommodation_return when one already exists earlier in the day (not as the last node)', async () => {
    // Isola specificamente hasClosingOrDeparture: EndOfDayClosureService
    // valuta solo l'ULTIMO nodo (Regola A), quindi da solo non baserebbe a
    // impedire un secondo rientro se quello esistente non è l'ultimo nodo
    // della giornata. hasClosingOrDeparture scansiona invece l'intero array
    // (`.some(...)`) e deve bloccare l'inserimento comunque.
    const accommodations: Accommodation[] = [
      {
        id: 'hotel-roma',
        type: 'hotel',
        name: 'Hotel Roma Nord',
        checkIn: new Date('2026-08-01T14:00:00.000Z'),
        checkOut: new Date('2026-08-05T10:00:00.000Z'),
        coordinates: { lat: 41.9100, lng: 12.4900 },
        confirmed: true,
      } as Accommodation,
    ];

    const inputSchedule = {
      dayNumber: 2,
      date: '2026-08-02',
      places: [
        {
          id: 'existing-return-early',
          name: 'Rientro in hotel (pranzo)',
          category: 'accommodation_return',
          coordinates: { latitude: 41.9100, longitude: 12.4900 },
          isBlock: false,
          isLocked: true,
          anchorType: 'HARD' as const,
          journeyAnchorKind: 'accommodation_return' as const,
          scheduledTime: '2026-08-02T13:00:00.000Z',
          durationMinutes: 15,
        } as PlaceRef,
        {
          id: 'late-evening-activity',
          name: 'Aperitivo serale',
          category: 'drinks',
          coordinates: { latitude: 41.9000, longitude: 12.4800 },
          isBlock: false,
          isLocked: true,
          anchorType: 'HARD' as const,
          journeyAnchorKind: undefined,
          scheduledTime: '2026-08-02T20:30:00.000Z',
          durationMinutes: 60,
        } as PlaceRef,
      ],
      totalWalkDistanceMeters: 0,
      totalEstimatedDurationMinutes: 0,
      overview: { experiencesCount: 2, startTime: '09:00', endTime: '21:00', foodStopsCount: 0 },
    };

    const result = await journeyComposer.composeDayJourney(
      inputSchedule, 'culture', undefined, undefined, accommodations
    );

    expect(result).not.toBe(inputSchedule);
    expect(result.journeyReport).toBeDefined();
    // L'ultimo nodo reale della giornata è l'attività serale, non il rientro:
    // se la guardia dipendesse solo dall'ultimo nodo (Regola A), un secondo
    // accommodation_return verrebbe erroneamente aggiunto in coda.
    const lastPlace = result.places[result.places.length - 1];
    expect(lastPlace.journeyAnchorKind).not.toBe('accommodation_return');

    const returnAnchors = result.places.filter(p => p.journeyAnchorKind === 'accommodation_return');
    expect(returnAnchors.length).toBe(1);
    expect(returnAnchors[0].id).toBe('existing-return-early');
  });
});

describe('JourneyComposer coordinate normalization and geoScore evaluation', () => {
  it('normalizes missing or NaN coordinates to undefined and assigns geoScore = 0 during composition without producing NaN', async () => {
    expect(JourneyComposerService.normalizeCoordinates(undefined)).toBeUndefined();
    expect(JourneyComposerService.normalizeCoordinates({ lat: NaN, lng: 12.49 })).toBeUndefined();
    expect(JourneyComposerService.normalizeCoordinates({ latitude: 41.9, longitude: NaN })).toBeUndefined();

    // Quando un luogo non ha coordinate (o ha coordinate non valide),
    // la valutazione del candidato durante la composizione assegna geoScore = 0.
    // Il luogo non produce NaN ed è valutato in modo pulito ed esclusivamente sulla base del suo totalScore.
    const placeWithoutCoords: PlaceRef = {
      id: 'no-coords-place',
      name: 'Luogo Senza Coordinate',
      category: 'landmark',
      durationMinutes: 60,
      coordinates: undefined,
    };

    const result = await journeyComposer.compose({
      availablePlaces: [placeWithoutCoords],
      travelStyle: 'culture',
      targetDay: 1,
      dateStr: '2026-08-01',
    });

    expect(result.places.some(p => p.id === 'no-coords-place')).toBe(true);
  });
});
