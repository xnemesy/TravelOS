import { TravelPlace } from '../../../domain/trip/models/place.model';
import { PlaceRef } from '../types/context.types';

/**
 * Sottoinsieme di `PlaceRef` che dipende dal contesto di una specifica
 * composizione di giornata (ADR-017 §3.3) — non esiste su `TravelPlace`,
 * va fornito dal chiamante (`TimelineEngine`/`JourneyComposer`) al momento
 * della proiezione, mai inventato da questo mapper.
 */
export interface PlaceRefSchedulingContext extends Partial<PlaceRef> {
  scheduledTime?: string;
  calculatedStartTime?: string;
  calculatedEndTime?: string;
  durationMinutes?: number;
  recommendedTime?: PlaceRef['recommendedTime'];
  energyLevel?: PlaceRef['energyLevel'];
  idealTimeWindows?: PlaceRef['idealTimeWindows'];
  weatherPreference?: PlaceRef['weatherPreference'];
  distanceMeters?: number;
  estimatedWalkMinutes?: number;
  isBlock?: boolean;
  isLocked?: boolean;
  warnings?: string[];
  role?: PlaceRef['role'];
  anchorType?: PlaceRef['anchorType'];
  decision?: PlaceRef['decision'];
  freeTimePurpose?: string;
  [key: string]: unknown;
}

/**
 * Punto unico di conversione da Canonical Place a proiezione di
 * pianificazione (ADR-017, pipeline `PlaceMetadata → TravelPlace →
 * PlaceRef`, piano di migrazione passo #3).
 *
 * Copia il sottoinsieme read-oriented elencato in ADR-017 §3.3 (`id`,
 * `name`, `category`, `coordinates`, `coverImageUrl`, `address`, `rating`,
 * `priority`) dal livello External di `place`, più i campi di
 * pianificazione forniti esplicitamente in `schedulingContext`.
 *
 * **Nota di conformità ADR-017 & Sprint 18 Fase 2 (ADR-023/ADR-024)**:
 * Per garantire l'integrità del ciclo `CanonicalPlace → PlaceRef → Timeline →
 * Persistence → Hydration` senza perdita di dati (Zero Regression), il sottoinsieme
 * proiettato preserva integralmente da `place` e da `schedulingContext`:
 * `role`, `anchorType`, `scheduledTime`, `notes`, `isVisited`, `phone`, `website`,
 * `bookingUrl`, e `ticketUrl`.
 */
export function canonicalPlaceToPlaceRef(
  place: TravelPlace,
  schedulingContext: PlaceRefSchedulingContext = {}
): PlaceRef {
  const coordinates = place.baseData.location?.coordinates;
  if (!coordinates) {
    throw new Error(
      `canonicalPlaceToPlaceRef: TravelPlace '${place.id}' non ha coordinate su baseData.location.coordinates — ` +
      `violazione dell'invariante ADR-017 §3.2 (ogni TravelPlace creato da mergeFromProvider ha sempre coordinate).`
    );
  }

  const coords = schedulingContext.coordinates ?? {
    latitude: coordinates.lat,
    longitude: coordinates.lng,
  };

  // Derive durationMinutes: schedulingContext > TravelPlace.averageVisitDurationMinutes > Editorial.recommendedDurationMinutes > 60
  const durationMinutes = schedulingContext.durationMinutes 
    ?? place.averageVisitDurationMinutes 
    ?? place.editorial?.recommendedDurationMinutes 
    ?? 60;

  // Derive isVisited
  const isVisited = schedulingContext.isVisited 
    ?? (place.status === 'visited' || place.memories?.checkInStatus === 'completed');

  // Format notes to a single string for PlaceRef
  const notes = schedulingContext.notes
    ?? (place.notes?.map(n => n.content).join('\n') || place.memories?.diaryEntry || undefined);

  const role = schedulingContext.role ?? place.role ?? place.baseData.role;
  const anchorType = schedulingContext.anchorType ?? place.anchorType ?? place.baseData.anchorType;
  const scheduledTime = schedulingContext.scheduledTime
    ?? (place.scheduledTime instanceof Date
      ? place.scheduledTime.toISOString()
      : typeof place.scheduledTime === 'string'
        ? place.scheduledTime
        : undefined);

  const phone = schedulingContext.phone ?? place.baseData.contact?.phone;
  const website = schedulingContext.website ?? place.baseData.contact?.website;
  const bookingUrl = schedulingContext.bookingUrl ?? place.bookingUrl;
  const ticketUrl = schedulingContext.ticketUrl ?? place.memories?.ticketUrl;

  const ref: PlaceRef = {
    id: place.id,
    name: place.baseData.name,
    category: place.baseData.category,
    coordinates: coords,
    coverImageUrl: place.baseData.coverImageUrl,
    address: place.baseData.location?.address,
    rating: place.baseData.rating,
    priority: place.priority,
    durationMinutes,
    isVisited,
    notes,
    ...schedulingContext,
  };

  if (role !== undefined && ref.role === undefined) ref.role = role;
  if (anchorType !== undefined && ref.anchorType === undefined) ref.anchorType = anchorType;
  if (scheduledTime !== undefined && ref.scheduledTime === undefined) ref.scheduledTime = scheduledTime;
  if (phone !== undefined && ref.phone === undefined) ref.phone = phone;
  if (website !== undefined && ref.website === undefined) ref.website = website;
  if (bookingUrl !== undefined && ref.bookingUrl === undefined) ref.bookingUrl = bookingUrl;
  if (ticketUrl !== undefined && ref.ticketUrl === undefined) ref.ticketUrl = ticketUrl;

  return ref;
}
