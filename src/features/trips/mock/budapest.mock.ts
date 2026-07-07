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

export const mockBudapestPlaces: import('../../../domain/trip/models/place.model').TravelPlace[] = [
  {
    id: 'place-parlamento',
    tripId: 'trip-budapest-2026',
    externalProviderId: 'ext-parlamento-123',
    baseData: {
      providerId: 'ext-parlamento-123',
      name: 'Parlamento di Budapest',
      category: 'landmark',
      coverImageUrl: 'https://images.unsplash.com/photo-1549877452-9c387954fbc2?q=80&w=1200&auto=format&fit=crop',
      location: {
        address: 'Kossuth Lajos tér 1-3, 1055 Budapest',
        coordinates: { lat: 47.5071, lng: 19.0456 }
      },
      contact: { website: 'https://parlament.hu' },
      openingHours: '08:00 - 18:00',
      rating: 4.8,
    },
    priority: 'must_see',
    status: 'to_visit',
    assignedDay: 1,
    bookingUrl: 'https://jegymester.hu',
    averageCost: 25,
    averageVisitDurationMinutes: 120,
    accessibilityInfo: 'Accesso per sedie a rotelle disponibile',
    notes: [
      {
        id: 'note-1',
        source: 'personal',
        content: 'Ricordarsi di prenotare i biglietti salta fila online almeno due giorni prima.',
        createdAt: new Date()
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'place-bastione',
    tripId: 'trip-budapest-2026',
    externalProviderId: 'ext-bastione-789',
    baseData: {
      providerId: 'ext-bastione-789',
      name: 'Bastione dei Pescatori',
      category: 'landmark',
      coverImageUrl: 'https://images.unsplash.com/photo-1514896856000-91cb6de818e0?q=80&w=1200&auto=format&fit=crop',
      location: {
        address: 'Szentháromság tér, 1014 Budapest',
        coordinates: { lat: 47.5022, lng: 19.0348 }
      },
      openingHours: '00:00 - 24:00',
      rating: 4.9,
    },
    priority: 'recommended',
    status: 'to_visit',
    assignedDay: 1,
    averageCost: 0,
    averageVisitDurationMinutes: 60,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'place-newyorkcafe',
    tripId: 'trip-budapest-2026',
    externalProviderId: 'ext-newyorkcafe-456',
    baseData: {
      providerId: 'ext-newyorkcafe-456',
      name: 'New York Café',
      category: 'restaurant',
      coverImageUrl: 'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?q=80&w=1200&auto=format&fit=crop',
      location: {
        address: 'Erzsébet krt. 9-11, 1073 Budapest',
        coordinates: { lat: 47.4984, lng: 19.0705 }
      },
      contact: { phone: '+36 1 886 6111', website: 'https://newyorkcafe.hu' },
      openingHours: '08:00 - 23:00',
      rating: 4.5,
    },
    priority: 'recommended',
    status: 'to_visit',
    assignedDay: 1,
    menuUrl: 'https://newyorkcafe.hu/menu',
    bookingUrl: 'https://newyorkcafe.hu/booking',
    averageCost: 40,
    averageVisitDurationMinutes: 90,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  // Luoghi non ancora pianificati (nella Libreria del viaggio)
  {
    id: 'place-terme-szechenyi',
    tripId: 'trip-budapest-2026',
    externalProviderId: 'ext-szechenyi-101',
    baseData: {
      providerId: 'ext-szechenyi-101',
      name: 'Terme Széchenyi',
      category: 'experience',
      coverImageUrl: 'https://images.unsplash.com/photo-1584646098378-0874589d76b1?q=80&w=1200&auto=format&fit=crop',
      location: {
        address: 'Állatkerti krt. 9-11, 1146 Budapest',
        coordinates: { lat: 47.5186, lng: 19.0824 }
      },
      openingHours: '07:00 - 20:00',
      rating: 4.7,
    },
    priority: 'must_see',
    status: 'to_visit',
    averageCost: 35,
    averageVisitDurationMinutes: 180,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'place-castello-buda',
    tripId: 'trip-budapest-2026',
    externalProviderId: 'ext-castello-102',
    baseData: {
      providerId: 'ext-castello-102',
      name: 'Castello di Buda',
      category: 'landmark',
      coverImageUrl: 'https://images.unsplash.com/photo-1565431388195-2364c67423e8?q=80&w=1200&auto=format&fit=crop',
      location: {
        address: 'Szent György tér 2, 1014 Budapest',
        coordinates: { lat: 47.4962, lng: 19.0396 }
      },
      openingHours: '10:00 - 18:00',
      rating: 4.6,
    },
    priority: 'recommended',
    status: 'to_visit',
    averageCost: 15,
    averageVisitDurationMinutes: 120,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'place-mercato-centrale',
    tripId: 'trip-budapest-2026',
    externalProviderId: 'ext-mercato-103',
    baseData: {
      providerId: 'ext-mercato-103',
      name: 'Mercato Centrale (Nagy Vásárcsarnok)',
      category: 'shopping',
      coverImageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200&auto=format&fit=crop',
      location: {
        address: 'Vámház krt. 1-3, 1093 Budapest',
        coordinates: { lat: 47.4870, lng: 19.0585 }
      },
      openingHours: '06:00 - 18:00',
      rating: 4.5,
    },
    priority: 'optional',
    status: 'to_visit',
    averageCost: 20,
    averageVisitDurationMinutes: 60,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// Mock places per Costiera Amalfitana (viaggio in pianificazione)
export const mockAmalfiPlaces: import('../../../domain/trip/models/place.model').TravelPlace[] = [
  {
    id: 'place-positano-beach',
    tripId: 'trip-amalfi-2027',
    externalProviderId: 'ext-positano-1',
    baseData: {
      providerId: 'ext-positano-1',
      name: 'Spiaggia Grande di Positano',
      category: 'nature',
      coverImageUrl: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=1200&auto=format&fit=crop',
      location: {
        address: 'Piazza Flavio Gioia, Positano',
        coordinates: { lat: 40.6281, lng: 14.4850 }
      },
      openingHours: '08:00 - 20:00',
      rating: 4.8,
    },
    priority: 'must_see',
    status: 'to_visit',
    assignedDay: 1,
    averageCost: 40,
    averageVisitDurationMinutes: 180,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'place-duomo-amalfi',
    tripId: 'trip-amalfi-2027',
    externalProviderId: 'ext-duomo-2',
    baseData: {
      providerId: 'ext-duomo-2',
      name: 'Duomo di Amalfi',
      category: 'landmark',
      coverImageUrl: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?q=80&w=1200&auto=format&fit=crop',
      location: {
        address: 'Piazza Duomo, 84011 Amalfi',
        coordinates: { lat: 40.6340, lng: 14.6027 }
      },
      openingHours: '09:00 - 18:45',
      rating: 4.9,
    },
    priority: 'must_see',
    status: 'to_visit',
    assignedDay: 1,
    averageCost: 3,
    averageVisitDurationMinutes: 60,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'place-villa-rufolo',
    tripId: 'trip-amalfi-2027',
    externalProviderId: 'ext-rufolo-3',
    baseData: {
      providerId: 'ext-rufolo-3',
      name: 'Villa Rufolo (Ravello)',
      category: 'viewpoint',
      coverImageUrl: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=1200&auto=format&fit=crop',
      location: {
        address: 'Piazza Duomo, 84010 Ravello',
        coordinates: { lat: 40.6486, lng: 14.6128 }
      },
      openingHours: '09:00 - 20:00',
      rating: 4.9,
    },
    priority: 'must_see',
    status: 'to_visit',
    averageCost: 8,
    averageVisitDurationMinutes: 90,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'place-sentiero-dei-dei',
    tripId: 'trip-amalfi-2027',
    externalProviderId: 'ext-sentiero-4',
    baseData: {
      providerId: 'ext-sentiero-4',
      name: 'Sentiero degli Dei',
      category: 'nature',
      coverImageUrl: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=1200&auto=format&fit=crop',
      location: {
        address: 'Bomerano - Nocelle',
        coordinates: { lat: 40.6275, lng: 14.5380 }
      },
      openingHours: '05:00 - 21:00',
      rating: 4.9,
    },
    priority: 'recommended',
    status: 'to_visit',
    averageCost: 0,
    averageVisitDurationMinutes: 240,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export const allMockPlaces = [...mockBudapestPlaces, ...mockAmalfiPlaces];

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
