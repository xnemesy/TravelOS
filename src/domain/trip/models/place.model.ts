import { z } from 'zod';

export const PlaceCategorySchema = z.enum([
  'museum', 'restaurant', 'viewpoint', 'landmark', 'hotel', 'shopping', 'bar', 'experience', 'nature', 'other'
]);

export const PlacePrioritySchema = z.enum(['must_see', 'recommended', 'optional']);
export const PlaceRoleSchema = z.enum([
  'hero_experience', 'secondary', 'quick_stop', 'food', 'coffee', 'viewpoint', 'relax', 'shopping', 'transfer', 'anchor', 'free_time'
]);
export const AnchorTypeSchema = z.enum(['HARD', 'SOFT']);
export const PlaceStatusSchema = z.enum(['to_visit', 'booked', 'visited']);
export const NoteSourceSchema = z.enum(['personal', 'ai_suggestion', 'friend', 'imported']);

export const PlaceNoteSchema = z.object({
  id: z.string(),
  source: NoteSourceSchema,
  content: z.string(),
  authorName: z.string().optional(),
  createdAt: z.date(),
});

// 1. External Layer: Dato in sola lettura proveniente dal Provider (es. Google Places / RealPlacesAdapter)
export const ExternalPlaceSchema = z.object({
  providerId: z.string(),
  name: z.string().min(1, 'Il nome è obbligatorio'),
  category: PlaceCategorySchema.default('other'),
  coverImageUrl: z.string().url().optional(),
  photoUrls: z.array(z.string()).optional(),
  matchScore: z.number().min(0).max(100).optional(),
  
  location: z.object({
    address: z.string().optional(),
    coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
    appleMapsUrl: z.string().url().optional(),
    googleMapsUrl: z.string().url().optional(),
  }).optional(),
  
  contact: z.object({
    phone: z.string().optional(),
    website: z.string().url().optional(),
  }).optional(),
  
  openingHours: z.string().optional(), 
  rating: z.number().min(0).max(5).optional(),
  reviewsCount: z.number().min(0).optional(),
  role: PlaceRoleSchema.optional(),
  anchorType: AnchorTypeSchema.optional(),
});

// 2. Editorial Layer: Informazioni curate da Travel OS (indipendenti dal provider)
export const EditorialPlaceSchema = z.object({
  whyVisit: z.string().optional(),
  recommendedDurationMinutes: z.number().optional(),
  bestTimeToVisit: z.string().optional(),
  goldenHourTip: z.string().optional(),
  photoTips: z.string().optional(),
  curiosities: z.array(z.string()).optional(),
  mistakesToAvoid: z.array(z.string()).optional(),
  recommendedExperience: z.string().optional(),
  editorialCategories: z.array(z.string()).optional(),
});

// 3. Personal Layer / PlaceMemories: La capsula del tempo personale e diario del viaggiatore
export const PlaceMemoriesSchema = z.object({
  diaryEntry: z.string().optional(),
  personalRating: z.number().min(1).max(5).optional(),
  timeSpentMinutes: z.number().optional(),
  totalCost: z.number().optional(),
  linkedPhotosId: z.array(z.string()).optional(),
  linkedExpensesId: z.array(z.string()).optional(),
  isFavorite: z.boolean().default(false),
  checkInStatus: z.enum(['not_checked_in', 'checked_in', 'completed']).default('not_checked_in').optional(),
  checkInTime: z.date().optional(),
  attachments: z.array(z.string()).optional(),
  ticketUrl: z.string().url().optional(),
});

// TravelPlace: L'entità del viaggio che unisce il dato esterno, editoriale e personale
export const TravelPlaceSchema = z.object({
  id: z.string(),
  tripId: z.string(),
  externalProviderId: z.string(), // Riferimento al provider esterno per update
  
  source: z.object({
    provider: z.enum(['editorial', 'provider', 'merged']),
    providerName: z.enum(['google', 'apple', 'osm', 'mock-real']).optional(),
    lastSyncAt: z.date().optional(),
  }).optional(),

  // 1. External Layer (Dati esterni / provider per uso offline)
  baseData: ExternalPlaceSchema,
  external: ExternalPlaceSchema.optional(), // Alias esplicito per 3-layer architecture
  
  // 2. Editorial Layer (Guida e consigli curati da Travel OS)
  editorial: EditorialPlaceSchema.optional(),
  
  // 3. Personal Layer (Diario, note e ricordi personali utente)
  memories: PlaceMemoriesSchema.optional(),
  personal: PlaceMemoriesSchema.optional(), // Alias esplicito per 3-layer architecture
  notes: z.array(PlaceNoteSchema).optional(),
  
  // Informazioni pratiche retrocompatibili
  averageCost: z.number().optional(), 
  currency: z.string().length(3).default('EUR').optional(),
  averageVisitDurationMinutes: z.number().optional(), 
  accessibilityInfo: z.string().optional(),
  menuUrl: z.string().url().optional(),
  checkInUrl: z.string().url().optional(),
  bookingUrl: z.string().url().optional(),
  
  // Pianificazione
  priority: PlacePrioritySchema.default('recommended'),
  role: PlaceRoleSchema.optional(),
  anchorType: AnchorTypeSchema.optional(),
  status: PlaceStatusSchema.default('to_visit'),
  assignedDay: z.number().optional(), 
  scheduledTime: z.date().optional(), 
  
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PlaceCategory = z.infer<typeof PlaceCategorySchema>;
export type PlacePriority = z.infer<typeof PlacePrioritySchema>;
export type PlaceRole = z.infer<typeof PlaceRoleSchema>;
export type AnchorType = z.infer<typeof AnchorTypeSchema>;
export type PlaceStatus = z.infer<typeof PlaceStatusSchema>;
export type NoteSource = z.infer<typeof NoteSourceSchema>;
export type PlaceNote = z.infer<typeof PlaceNoteSchema>;
export type ExternalPlace = z.infer<typeof ExternalPlaceSchema>;
export type EditorialPlace = z.infer<typeof EditorialPlaceSchema>;
export type PlaceMemories = z.infer<typeof PlaceMemoriesSchema>;
export type PersonalPlace = z.infer<typeof PlaceMemoriesSchema>;
export type TravelPlace = z.infer<typeof TravelPlaceSchema>;
