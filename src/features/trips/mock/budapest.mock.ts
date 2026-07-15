import { Trip, TripEvent } from '../../../domain/trip/models/trip.model';

// Prossimo Viaggio (Hero Card) - Kyoto
const now = new Date();
const kyotoStart = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // Tra 14 giorni
const kyotoEnd = new Date(now.getTime() + 26 * 24 * 60 * 60 * 1000);

export const mockKyotoTrip: Trip = {
  id: 'trip-kyoto-2026',
  userId: 'mock-user-123',
  title: 'Autunno in Giappone',
  destination: 'Kyoto, Giappone',
  startDate: kyotoStart,
  endDate: kyotoEnd,
  status: 'ready',
  progress: 80,
  coverImageUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop',
  stats: {
    savedPlaces: 16,
    reservations: 3,
    activitiesToComplete: 2,
  },
  weather: {
    temp: 22,
    condition: 'Soleggiato',
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Altro Viaggio (Planning) - Costiera Amalfitana
export const mockAmalfiTrip: Trip = {
  id: 'trip-amalfi-2027',
  userId: 'mock-user-123',
  title: 'Primavera in Costiera',
  destination: 'Costiera Amalfitana',
  startDate: new Date('2027-05-04T10:00:00.000Z'),
  endDate: new Date('2027-05-11T18:00:00.000Z'),
  status: 'planned',
  progress: 35,
  coverImageUrl: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=1200&auto=format&fit=crop',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Altro Viaggio (Completed) - Reykjavik
export const mockReykjavikTrip: Trip = {
  id: 'trip-reykjavik-2025',
  userId: 'mock-user-123',
  title: 'Islanda on the Road',
  destination: 'Reykjavik, Islanda',
  startDate: new Date('2025-07-15T08:00:00.000Z'),
  endDate: new Date('2025-07-22T20:00:00.000Z'),
  status: 'completed',
  progress: 100,
  coverImageUrl: 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?q=80&w=1200&auto=format&fit=crop',
  stats: {
    totalPhotos: 248,
    distanceTraveled: 1250,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockBudapestTrip: Trip = {
  id: 'trip-budapest-2026',
  userId: 'mock-user-123',
  title: 'Weekend a Budapest',
  destination: 'Budapest, Ungheria',
  startDate: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Iniziato ieri
  endDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // Finisce tra 5 giorni
  status: 'ongoing',
  progress: 65,
  coverImageUrl: 'https://images.unsplash.com/photo-1514896856000-91cb6de818e0?q=80&w=1200&auto=format&fit=crop',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockBudapestEvents: TripEvent[] = [
  {
    id: 'evt-flight-out',
    tripId: 'trip-budapest-2026',
    type: 'flight',
    title: 'Volo WizzAir W6 233',
    startTime: new Date('2026-08-10T12:00:00.000Z'),
    endTime: new Date('2026-08-10T13:30:00.000Z'),
    cost: 45.0,
    currency: 'EUR'
  },
  {
    id: 'evt-hotel-checkin',
    tripId: 'trip-budapest-2026',
    type: 'accommodation',
    title: 'Check-in Hotel Gellért',
    startTime: new Date('2026-08-10T15:00:00.000Z'),
    endTime: new Date('2026-08-10T15:30:00.000Z'),
    cost: 300.0,
    currency: 'EUR'
  },
  {
    id: 'evt-activity-spa',
    tripId: 'trip-budapest-2026',
    type: 'activity',
    title: 'Terme Széchenyi',
    startTime: new Date('2026-08-11T08:00:00.000Z'),
    endTime: new Date('2026-08-11T12:00:00.000Z'),
    cost: 25.0,
    currency: 'EUR'
  }
];

export const mockBudapestItinerary: import('../../../domain/trip/models/trip.model').ItineraryDaySummary[] = [
  {
    date: new Date('2026-08-10T00:00:00.000Z'),
    dayNumber: 1,
    placesCount: 2,
    restaurantsCount: 1,
    museumsCount: 0,
  },
  {
    date: new Date('2026-08-11T00:00:00.000Z'),
    dayNumber: 2,
    placesCount: 4,
    restaurantsCount: 2,
    museumsCount: 1,
  },
  {
    date: new Date('2026-08-12T00:00:00.000Z'),
    dayNumber: 3,
    placesCount: 3,
    restaurantsCount: 1,
    museumsCount: 2,
  }
];
