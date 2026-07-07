import { z } from 'zod';

export const TripStatusSchema = z.enum(['planned', 'ready', 'ongoing', 'completed', 'cancelled', 'archived']);
export type TripStatus = z.infer<typeof TripStatusSchema>;

export const TripSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string().min(1, 'Il titolo è obbligatorio'),
  destination: z.string().min(1, 'La destinazione è obbligatoria'),
  emoji: z.string().optional(),
  currency: z.string().default('EUR').optional(),
  startDate: z.date(),
  endDate: z.date(),
  status: TripStatusSchema.default('planned'),
  coverImageUrl: z.string().url().optional(),
  progress: z.number().min(0).max(100).optional(),
  stats: z.object({
    savedPlaces: z.number().optional(),
    reservations: z.number().optional(),
    activitiesToComplete: z.number().optional(),
    totalPhotos: z.number().optional(),
    distanceTraveled: z.number().optional(),
    organizedDays: z.number().optional(),
  }).optional(),
  weather: z.object({
    temp: z.number(),
    condition: z.string(),
  }).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Trip = z.infer<typeof TripSchema>;

export const TripEventSchema = z.object({
  id: z.string(),
  tripId: z.string(),
  type: z.enum(['flight', 'accommodation', 'activity', 'transport']),
  title: z.string().min(1, 'Il titolo è obbligatorio'),
  startTime: z.date(),
  endTime: z.date(),
  cost: z.number().nonnegative().optional(),
  currency: z.string().length(3).default('EUR'),
});

export type TripEvent = z.infer<typeof TripEventSchema>;



export const ItineraryDaySummarySchema = z.object({
  date: z.date(),
  dayNumber: z.number(),
  placesCount: z.number(),
  restaurantsCount: z.number(),
  museumsCount: z.number().optional(),
});

export type ItineraryDaySummary = z.infer<typeof ItineraryDaySummarySchema>;
