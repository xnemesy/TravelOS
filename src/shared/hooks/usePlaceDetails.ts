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
 * `PlaceQueryService` risolve il "salvato" contro `IPlaceRepository`
 * (`InMemoryPlaceRepository`/`allMockPlaces` in `place.store.ts`) — un
 * repository statico del percorso legacy `domain/trip`, **non** la stessa
 * fonte di `PlacesEngine`/MMKV (`places_${tripId}`) che `usePlaces()` e
 * `actions.savePlace()` usano davvero. Per non regredire sul comportamento
 * dei luoghi già salvati (requisito esplicito del fix), questo hook
 * controlla prima `usePlaces(tripId).savedPlaces` — invariato, sincrono,
 * stessa fonte di prima del fix — e delega a `PlaceQueryService` solo
 * quando il luogo non è tra i salvati reali (ricerca live, catalogo
 * editoriale, o qualunque altro luogo transiente).
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
