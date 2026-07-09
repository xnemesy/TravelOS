import { z } from 'zod';

/**
 * ============================================================================
 * TRIP SETUP DOMAIN (ADR-018)
 * ============================================================================
 * Logistica pre-viaggio strutturata: come il viaggiatore arriva/parte
 * (Transport), dove alloggia (Accommodation), come si sposta localmente
 * (Mobility), quali vincoli rispettare (TripConstraint), quali documenti
 * servono (TripDocument), quali preferenze morbide guidano lo stile
 * (TripPreferences) — aggregati sotto TripSetup.
 *
 * Distinto da TripEventSchema (trip.model.ts): quello è un'entrata di
 * calendario leggera già esistente, questo è il dominio di setup da cui,
 * in un futuro sprint di adozione, un TripEvent potrebbe essere derivato —
 * non il contrario. Nessuna delle due sostituisce l'altra oggi.
 *
 * Regola non negoziabile su tutti i campi opzionali array/oggetto di
 * TripSetup: `undefined` significa "sezione non ancora affrontata";
 * un array vuoto o un oggetto presente significa "affrontata, nulla da
 * dichiarare". Vedi ADR-018 §3.7.
 */

// 1. Transport — arrivo/partenza dalla destinazione (o tra tratte multi-città)
export const TransportModeSchema = z.enum(['flight', 'train', 'bus', 'car', 'ferry', 'other']);
export type TransportMode = z.infer<typeof TransportModeSchema>;

export const TransportSchema = z
  .object({
    id: z.string(),
    mode: TransportModeSchema,
    provider: z.string().optional(),
    origin: z.string().optional(),
    destination: z.string().min(1, 'La destinazione è obbligatoria'),
    departureDate: z.date(),
    arrivalDate: z.date().optional(),
    bookingReference: z.string().optional(),
    confirmed: z.boolean().default(false),
    cost: z.number().nonnegative().optional(),
    currency: z.string().length(3).optional(),
    // Se assente, l'ordine tra tratte multiple si deduce da departureDate
    // (ADR-018 §3.1, aggiunto in review indipendente).
    sequenceOrder: z.number().optional(),
  })
  .refine((data) => !data.arrivalDate || data.arrivalDate >= data.departureDate, {
    message: 'arrivalDate non può precedere departureDate',
    path: ['arrivalDate'],
  });

export type Transport = z.infer<typeof TransportSchema>;

// 2. Accommodation — dove il viaggiatore alloggia
export const AccommodationSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1, 'Il nome è obbligatorio'),
    address: z.string().optional(),
    checkIn: z.date(),
    checkOut: z.date(),
    bookingReference: z.string().optional(),
    confirmed: z.boolean().default(false),
    cost: z.number().nonnegative().optional(),
    currency: z.string().length(3).optional(),
    coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
  })
  .refine((data) => data.checkOut > data.checkIn, {
    message: 'checkOut deve essere successivo a checkIn',
    path: ['checkOut'],
  });

export type Accommodation = z.infer<typeof AccommodationSchema>;

// 3. Mobility — spostamenti locali a destinazione (distinto da Transport)
export const MobilityModeSchema = z.enum(['walking', 'public_transit', 'rental_car', 'rideshare', 'bike', 'other']);
export type MobilityMode = z.infer<typeof MobilityModeSchema>;

export const MobilitySchema = z.object({
  modes: z.array(MobilityModeSchema).min(1, 'Almeno una modalità di spostamento è richiesta'),
  hasLocalTransportPass: z.boolean().optional(),
  notes: z.string().optional(),
});

export type Mobility = z.infer<typeof MobilitySchema>;

// 4. TripConstraint — vincolo che il Planner dovrebbe rispettare
export const TripConstraintTypeSchema = z.enum(['budget', 'dietary', 'accessibility', 'medical', 'pace', 'other']);
export type TripConstraintType = z.infer<typeof TripConstraintTypeSchema>;

export const TripConstraintSeveritySchema = z.enum(['hard', 'soft']);
export type TripConstraintSeverity = z.infer<typeof TripConstraintSeveritySchema>;

export const TripConstraintSchema = z.object({
  id: z.string(),
  type: TripConstraintTypeSchema,
  severity: TripConstraintSeveritySchema,
  description: z.string().min(1, 'La descrizione è obbligatoria'),
});

export type TripConstraint = z.infer<typeof TripConstraintSchema>;

// 5. TripDocument — documento di viaggio necessario/posseduto
export const TripDocumentTypeSchema = z.enum(['passport', 'visa', 'insurance', 'vaccination', 'other']);
export type TripDocumentType = z.infer<typeof TripDocumentTypeSchema>;

export const TripDocumentStatusSchema = z.enum(['missing', 'pending', 'obtained', 'not_required']);
export type TripDocumentStatus = z.infer<typeof TripDocumentStatusSchema>;

export const TripDocumentSchema = z.object({
  id: z.string(),
  type: TripDocumentTypeSchema,
  status: TripDocumentStatusSchema,
  expiryDate: z.date().optional(),
  notes: z.string().optional(),
});

export type TripDocument = z.infer<typeof TripDocumentSchema>;

// 6. TripPreferences — preferenze morbide, mai vincoli (vedi TripConstraint)
export const TripPacePreferenceSchema = z.enum(['relaxed', 'balanced', 'intense']);
export type TripPacePreference = z.infer<typeof TripPacePreferenceSchema>;

export const TripBudgetLevelSchema = z.enum(['low', 'medium', 'high']);
export type TripBudgetLevel = z.infer<typeof TripBudgetLevelSchema>;

export const TripPreferencesSchema = z.object({
  pace: TripPacePreferenceSchema.optional(),
  interests: z.array(z.string()).optional(),
  dietaryPreferences: z.array(z.string()).optional(),
  budgetLevel: TripBudgetLevelSchema.optional(),
});

export type TripPreferences = z.infer<typeof TripPreferencesSchema>;

// 7. TripSetup — aggregato radice
export const TripSetupSchema = z.object({
  tripId: z.string(),
  transports: z.array(TransportSchema).optional(),
  accommodations: z.array(AccommodationSchema).optional(),
  mobility: MobilitySchema.optional(),
  constraints: z.array(TripConstraintSchema).optional(),
  documents: z.array(TripDocumentSchema).optional(),
  preferences: TripPreferencesSchema.optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TripSetup = z.infer<typeof TripSetupSchema>;
