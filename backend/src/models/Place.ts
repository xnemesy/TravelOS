import { z } from 'zod';

export const PlaceSchema = z.object({
  id: z.string(),
  providerPlaceId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  categories: z.array(z.string()),
  
  rating: z.object({
    score: z.number(),
    reviewCount: z.number()
  }).optional(),
  
  coordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  
  openingHours: z.array(z.string()).optional(),
  priceLevel: z.number().optional(),
  
  website: z.string().optional(),
  phone: z.string().optional(),
  photoUrl: z.string().optional(),
  
  editorialSummary: z.string().optional(),
  visitDuration: z.object({ minutes: z.number() }).optional(),
  
  walkingFriendly: z.boolean().optional(),
  indoor: z.boolean().optional(),
  outdoor: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  
  // Future-proof fields
  timezone: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  formattedAddress: z.string().optional(),
  providerUri: z.string().optional(),
  wheelchairAccessible: z.boolean().optional(),
  reservable: z.boolean().optional(),
  livePopularity: z.number().optional(),
  editorialCategory: z.string().optional(),
  bestVisitTime: z.string().optional(),
  icon: z.string().optional(),
});

export type Place = z.infer<typeof PlaceSchema>;
