import { useEffect, useState } from 'react';
import { usePlaces } from './usePlaces';
import { ResolvedPlace } from '../../core/engines/types/context.types';
import { placeQueryService } from '../../domain/trip/usecases/place-query.service';

export interface PlaceDetailsResult {
  place: ResolvedPlace['place'] | null;
  resolvedPlace: ResolvedPlace | null;
  loading: boolean;
}

/**
 * ============================================================================
 * USE PLACE DETAILS (LETTURA DETTAGLIO, INCLUSI LUOGHI NON ANCORA SALVATI)
 * ============================================================================
 * Hook UI che maschera la complessità della risoluzione dei luoghi.
 *
 * `PlaceQueryService` risolve i luoghi controllando prima `placesEngine`
 * (stessa fonte di `usePlaces()` e MMKV `places_${tripId}`)
 * e delegal'ottenimento dei dettagli al Place Provider o al Catalogo
 * editoriale quando il luogo non è ancora nei salvati.
 */
export function usePlaceDetails(tripId: string | string[], placeId: string | string[]): PlaceDetailsResult {
  const cleanTripId = Array.isArray(tripId) ? tripId[0] : String(tripId || '');
  const cleanPlaceId = Array.isArray(placeId) ? placeId[0] : String(placeId || '');
  const { savedPlaces } = usePlaces(cleanTripId);

  const saved = savedPlaces.find((p) => p.id === cleanPlaceId) || null;

  const [resolvedPlace, setResolvedPlace] = useState<ResolvedPlace | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (saved || !cleanPlaceId || !cleanTripId) {
      setResolvedPlace(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    placeQueryService.resolvePlace(cleanTripId, cleanPlaceId)
      .then((result) => {
        if (cancelled) return;

        // Se il resolver restituisce qualcosa, facciamo l'override cosmetico dell'ID
        // per soddisfare la regola di [placeId].tsx come faceva la versione precedente.
        if (result) {
          setResolvedPlace({
            ...result,
            place: { ...result.place, id: cleanPlaceId }
          });
        } else {
          setResolvedPlace(null);
        }
      })
      .catch((err) => {
        console.error('[usePlaceDetails] Failed to resolve place:', err);
        if (!cancelled) setResolvedPlace(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [saved, cleanPlaceId, cleanTripId]);

  if (saved) {
    return {
      place: saved,
      resolvedPlace: { place: saved, isTransient: false, source: 'saved' },
      loading: false,
    };
  }
  return {
    place: resolvedPlace?.place || null,
    resolvedPlace,
    loading,
  };
}
