import { TravelPlace } from '../../../domain/trip/models/place.model';
import { PlaceRef } from '../types/context.types';

/**
 * Sottoinsieme di `PlaceRef` che dipende dal contesto di una specifica
 * composizione di giornata (ADR-017 §3.3) — non esiste su `TravelPlace`,
 * va fornito dal chiamante (`TimelineEngine`/`JourneyComposer`) al momento
 * della proiezione, mai inventato da questo mapper.
 */
export interface PlaceRefSchedulingContext {
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
 * **Nota di conformità ADR-017**: `durationMinutes`, `isVisited` e `notes`
 * sono derivati qui da `TravelPlace` (`averageVisitDurationMinutes`/
 * `editorial.recommendedDurationMinutes`, `memories.checkInStatus`,
 * `notes[].content` rispettivamente) pur **non essendo elencati** tra le
 * "Proprietà consentite" di ADR-017 §3.3 — un'estensione di fatto rispetto
 * al testo dell'ADR, non ancora formalizzata in un aggiornamento di §3.3.
 * `role`/`anchorType` restano invece esclusi dal sottoinsieme canonico
 * (disponibili solo via `schedulingContext`), per lo stesso motivo.
 *
 * **Non ancora adottato da alcun chiamante reale nella pipeline principale**
 * (ADR-017, piano di migrazione passo #3): il collegamento a
 * `TimelineEngine`/`JourneyComposer` (passi #8-#10) richiede prima
 * migrare la persistenza di `PlacesEngine`/`TimelineEngine` da
 * `PlaceRef[]` a `TravelPlace[]`, fuori scope per questa fase. Adottato
 * oggi solo dal percorso di sola lettura transiente in `usePlaceDetails`
 * (`src/shared/hooks/`), mai persistito.
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

  // Derive durationMinutes: schedulingContext > TravelPlace.averageVisitDurationMinutes > Editorial.recommendedDurationMinutes > 60
  const durationMinutes = schedulingContext.durationMinutes 
    ?? place.averageVisitDurationMinutes 
    ?? place.editorial?.recommendedDurationMinutes 
    ?? 60;

  // Derive isVisited
  const isVisited = place.memories?.checkInStatus === 'completed';

  // Format notes to a single string for PlaceRef
  const notes = place.notes?.map(n => n.content).join('\n') || undefined;

  return {
    id: place.id,
    name: place.baseData.name,
    category: place.baseData.category,
    coordinates: { latitude: coordinates.lat, longitude: coordinates.lng },
    coverImageUrl: place.baseData.coverImageUrl,
    address: place.baseData.location?.address,
    rating: place.baseData.rating,
    priority: place.priority,
    durationMinutes,
    isVisited,
    notes,
    ...schedulingContext,
  };
}
