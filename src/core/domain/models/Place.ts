import { z } from 'zod';
import { CoordinatesSchema } from '../valueObjects/Coordinates';
import { RatingSchema } from '../valueObjects/Rating';
import { VisitDurationSchema } from '../valueObjects/VisitDuration';
import { PlaceCategory } from './PlaceCategory';

export const PlaceSchema = z.object({
  id: z.string(),
  providerPlaceId: z.string(), // E.g. Google Place ID
  name: z.string(),
  description: z.string().optional(),
  categories: z.array(z.nativeEnum(PlaceCategory)),
  
  rating: RatingSchema.optional(),
  coordinates: CoordinatesSchema,
  
  openingHours: z.array(z.string()).optional(),
  priceLevel: z.number().optional(),
  
  website: z.string().optional(),
  phone: z.string().optional(),
  photoUrl: z.string().optional(), // Normalized URL from backend
  
  editorialSummary: z.string().optional(),
  visitDuration: VisitDurationSchema.optional(),
  
  walkingFriendly: z.boolean().optional(),
  indoor: z.boolean().optional(),
  outdoor: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  
  // Future-proof fields
  timezone: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  formattedAddress: z.string().optional(),
  providerUri: z.string().optional(), // E.g. googleMapsUri
  wheelchairAccessible: z.boolean().optional(),
  reservable: z.boolean().optional(),
  livePopularity: z.number().optional(),
  editorialCategory: z.string().optional(),
  bestVisitTime: z.string().optional(),
  icon: z.string().optional(),
});

export type Place = z.infer<typeof PlaceSchema>;
