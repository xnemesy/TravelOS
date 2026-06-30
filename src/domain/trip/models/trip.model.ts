import { z } from 'zod';

export const TripStatusSchema = z.enum(['planned', 'ongoing', 'completed', 'cancelled']);
export type TripStatus = z.infer<typeof TripStatusSchema>;

export const TripSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string().min(1, 'Il titolo è obbligatorio'),
  destination: z.string().min(1, 'La destinazione è obbligatoria'),
  startDate: z.date(),
  endDate: z.date(),
  status: TripStatusSchema.default('planned'),
  coverImageUrl: z.string().url().optional(),
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
