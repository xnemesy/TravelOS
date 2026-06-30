import { Trip, TripEvent } from '../../../domain/trip/models/trip.model';

// Partenza: 10 Agosto 2026, 14:00 (Ora locale Budapest UTC+2 estivo)
const startDate = new Date('2026-08-10T14:00:00+02:00');
// Ritorno: 16 Agosto 2026, 10:00
const endDate = new Date('2026-08-16T10:00:00+02:00');

export const mockBudapestTrip: Trip = {
  id: 'trip-budapest-2026',
  userId: 'mock-user-123',
  title: 'Weekend a Budapest',
  destination: 'Budapest, Ungheria',
  startDate,
  endDate,
  status: 'planned',
  coverImageUrl: 'https://example.com/budapest.jpg',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockBudapestEvents: TripEvent[] = [
  {
    id: 'evt-flight-out',
    tripId: 'trip-budapest-2026',
    type: 'flight',
    title: 'Volo WizzAir W6 233',
    startTime: new Date('2026-08-10T14:00:00+02:00'),
    endTime: new Date('2026-08-10T15:30:00+02:00'),
    cost: 45.0,
    currency: 'EUR'
  },
  {
    id: 'evt-hotel-checkin',
    tripId: 'trip-budapest-2026',
    type: 'accommodation',
    title: 'Check-in Hotel Gellért',
    startTime: new Date('2026-08-10T17:00:00+02:00'),
    endTime: new Date('2026-08-10T17:30:00+02:00'),
    cost: 300.0,
    currency: 'EUR'
  },
  {
    id: 'evt-activity-spa',
    tripId: 'trip-budapest-2026',
    type: 'activity',
    title: 'Terme Széchenyi',
    startTime: new Date('2026-08-11T10:00:00+02:00'),
    endTime: new Date('2026-08-11T14:00:00+02:00'),
    cost: 25.0,
    currency: 'EUR'
  }
];
