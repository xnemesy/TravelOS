import { TravelPlace, TravelPlaceSchema, ExternalPlace, EditorialPlace } from '../models/place.model';
import { PlaceMetadata } from '../../providers/travel-providers.types';

/**
 * ============================================================================
 * PLACE MERGE ENGINE (Sprint 9 — Conservative Deduplication & Fusion)
 * ============================================================================
 * Motore deterministico di unificazione luoghi per evitare duplicati tra
 * catalogo editoriale e risultati di ricerca dei provider esterni.
 *
 * REGOLA CONSERVATIVA DI SPRINT 9:
 * Meglio avere un duplicato innocuo che fondere per errore due posti diversi!
 * Distanza geodetica < 30 metri E Similarità del nome > 90% = MERGE.
 * Se anche un solo criterio non è soddisfatto -> NON FARE MERGE.
 */

export class PlaceMergeEngine {
  /**
   * Calcola la distanza geodetica in metri tra due coordinate GPS (Formula di Haversine).
   */
  public static calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Raggio della Terra in metri
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Normalizza una stringa rimuovendo accenti, punteggiatura e spazi multipli.
   * Es. "New York Café Budapest!" -> "new york cafe budapest"
   */
  private static normalizeString(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Rimuove diacritici/accenti
      .replace(/[^a-z0-9\s]/g, ' ')   // Sostituisce caratteri speciali con spazi
      .replace(/\s+/g, ' ')           // Riduce spazi multipli
      .trim();
  }

  /**
   * Calcola la distanza di Levenshtein tra due stringhe.
   */
  private static levenshteinDistance(s1: string, s2: string): number {
    const len1 = s1.length;
    const len2 = s2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // Cancellazione
          matrix[i][j - 1] + 1,      // Inserimento
          matrix[i - 1][j - 1] + cost // Sostituzione
        );
      }
    }
    return matrix[len1][len2];
  }

  /**
   * Calcola la similarità percentuale da 0 a 100 tra due nomi di luogo.
   */
  public static calculateNameSimilarity(name1: string, name2: string): number {
    const norm1 = this.normalizeString(name1);
    const norm2 = this.normalizeString(name2);

    if (norm1 === norm2) return 100;
    if (norm1.length === 0 || norm2.length === 0) return 0;

    // Se un nome contiene interamente l'altro ed entrambi hanno almeno 5 caratteri (es. "New York Cafe" e "New York Cafe Budapest")
    if (norm1.length >= 5 && norm2.length >= 5) {
      if (norm1.includes(norm2) || norm2.includes(norm1)) {
        const minLen = Math.min(norm1.length, norm2.length);
        const maxLen = Math.max(norm1.length, norm2.length);
        const ratio = (minLen / maxLen) * 100;
        return Math.max(ratio, 92); // Garantisce superamento soglia 90% in caso di inclusione diretta
      }
    }

    const dist = this.levenshteinDistance(norm1, norm2);
    const maxLen = Math.max(norm1.length, norm2.length);
    return ((maxLen - dist) / maxLen) * 100;
  }

  /**
   * Valuta se due luoghi corrispondono alla stessa entità fisica secondo la regola conservativa:
   * Distanza < 30 metri E Similarità Nome > 90%.
   */
  public static isSamePlace(
    a: { name: string; lat?: number; lon?: number; coordinates?: { lat: number; lng: number } },
    b: { name: string; lat?: number; lon?: number; coordinates?: { lat: number; lng: number } }
  ): boolean {
    const latA = a.lat ?? a.coordinates?.lat;
    const lonA = a.lon ?? a.coordinates?.lng;
    const latB = b.lat ?? b.coordinates?.lat;
    const lonB = b.lon ?? b.coordinates?.lng;

    // Se le coordinate non sono disponibili per entrambi, approccio conservativo: NON MERGE
    if (latA === undefined || lonA === undefined || latB === undefined || lonB === undefined) {
      return false;
    }

    const distance = this.calculateDistanceMeters(latA, lonA, latB, lonB);
    if (distance >= 30) {
      return false;
    }

    const similarity = this.calculateNameSimilarity(a.name, b.name);
    return similarity > 90;
  }

  /**
   * Normalizza un `PlaceMetadata` (dato grezzo di provider, SIP) nella forma
   * `ExternalPlace` usata dal livello External di `TravelPlace`. Estratta da
   * `mergePlace` per essere condivisa anche da `mergeFromProvider` (ramo di
   * creazione) senza duplicare la logica di normalizzazione in due punti.
   */
  private static externalFromMetadata(meta: PlaceMetadata): ExternalPlace {
    return {
      providerId: meta.placeId,
      name: meta.name,
      category: meta.category as any,
      coverImageUrl: meta.coverImageUrl || meta.photoUrls?.[0],
      photoUrls: meta.photoUrls,
      matchScore: meta.matchScore || 100,
      location: {
        address: meta.formattedAddress,
        coordinates: { lat: meta.lat, lng: meta.lon },
        appleMapsUrl: meta.appleMapsUrl || `https://maps.apple.com/?q=${meta.lat},${meta.lon}`,
        googleMapsUrl: meta.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${meta.lat},${meta.lon}`,
      },
      contact: {
        phone: meta.phone,
        website: meta.website,
      },
      openingHours: meta.openingHours,
      rating: meta.rating,
      reviewsCount: meta.reviewsCount,
    };
  }

  /**
   * Unifica i dati di un provider esterno in un luogo editoriale/esistente,
   * preservando intatti i livelli Editorial e Personal e tracciando l'origine unificata.
   */
  public static mergePlace(existing: TravelPlace, providerData: ExternalPlace | PlaceMetadata): TravelPlace {
    const isMetadata = 'placeId' in providerData && !('providerId' in providerData);

    const ext: ExternalPlace = isMetadata
      ? this.externalFromMetadata(providerData as PlaceMetadata)
      : (providerData as ExternalPlace);

    // Fusione selettiva: aggiorniamo il livello External senza mai toccare Editorial o Personal
    const mergedBaseData: ExternalPlace = {
      ...existing.baseData,
      ...ext,
      name: ext.name || existing.baseData.name,
      coverImageUrl: ext.coverImageUrl || existing.baseData.coverImageUrl,
      photoUrls: ext.photoUrls || existing.baseData.photoUrls || (ext.coverImageUrl ? [ext.coverImageUrl] : undefined),
      location: {
        ...existing.baseData.location,
        ...ext.location,
        coordinates: ext.location?.coordinates || existing.baseData.location?.coordinates,
      },
      contact: {
        ...existing.baseData.contact,
        ...ext.contact,
      },
      rating: ext.rating ?? existing.baseData.rating,
      reviewsCount: ext.reviewsCount ?? existing.baseData.reviewsCount,
    };

    return {
      ...existing,
      externalProviderId: ext.providerId || existing.externalProviderId,
      baseData: mergedBaseData,
      source: {
        provider: 'merged',
        providerName: 'mock-real',
        lastSyncAt: new Date(),
      },
      updatedAt: new Date(),
    };
  }

  /**
   * Punto unico di conversione da dato provider a `TravelPlace` (ADR-017,
   * pipeline `PlaceMetadata → TravelPlace → PlaceRef`).
   *
   * - Se `options.existing` è presente, delega a `mergePlace` (nessuna
   *   duplicazione di logica di fusione: `PlaceMetadata` soddisfa già la
   *   union accettata da `mergePlace`) — dopo aver verificato che
   *   `existing.tripId` corrisponda a `options.tripId`: un mismatch
   *   significa che il chiamante ha passato un `tripId` sbagliato, e
   *   aggiornare silenziosamente il trip sbagliato sarebbe un difetto,
   *   non un dato da preservare (stessa filosofia della validazione Zod
   *   sotto: fallire rumorosamente su un errore del chiamante).
   * - Se `options.existing` è assente/null, costruisce un `TravelPlace`
   *   nuovo dal solo livello External — Editorial/Personal non vengono mai
   *   popolati da dati provider (coerente con ADR-017 §3.2). L'`id` del
   *   nuovo `TravelPlace` è generato indipendentemente da
   *   `incoming.placeId`, con la stessa convenzione già in uso in
   *   `TripRepository.createTrip` (`${prefix}-${Date.now()}-${random}`,
   *   vedi `trip.repository.ts`) — non va mai fatto coincidere con
   *   `externalProviderId`: sono due identità diverse per costruzione
   *   (`externalProviderId` esiste apposta per riferire il provider senza
   *   che `id` ne dipenda, vedi commento sul campo in `place.model.ts`).
   *   Farli coincidere romperebbe silenziosamente `InMemoryPlaceRepository`
   *   (`place.repository.ts`), che tiene un'unica `Map` globale chiavata
   *   su `id` per tutti i trip: lo stesso luogo fisico salvato in due trip
   *   diversi produrrebbe due `TravelPlace` con lo stesso `id`, e il
   *   secondo salvataggio sovrascriverebbe silenziosamente il primo.
   *
   * **Limite noto e non ancora risolto**: questa funzione accetta solo
   * `PlaceMetadata` come `incoming`. Il catalogo editoriale
   * (`EditorialPlaceItem.baseData`, vedi `editorial-places.catalog.ts`) è
   * tipizzato `ExternalPlace`, non `PlaceMetadata` — la forma non
   * corrisponde. Collegare il catalogo editoriale come "secondo produttore
   * legittimo" (ADR-017 §3.5) richiederà quindi un passaggio di
   * conversione aggiuntivo (o una firma diversa), non solo passare
   * `options.editorial`: quell'opzione copre solo dove va il contenuto
   * curato, non la forma del dato in ingresso. Non risolto in questa fase.
   *
   * Strategia di errore: `throw`, non `safeParse` con fallback silenzioso
   * come fa `TripRepository` per i dati persistiti/legacy (vedi
   * trip.repository.ts — lì un Trip invalido viene comunque ritornato "per
   * non perdere dati": è un dato esterno imperfetto, meglio degradare che
   * bloccare). Qui il `TravelPlace` è costruito da zero da questo stesso
   * modulo: uno scarto dallo schema significa un difetto nel mapper, non un
   * dato imperfetto da preservare — fallire rumorosamente è la scelta
   * corretta, non c'è alcun dato utente in gioco da salvare a ogni costo.
   */
  public static mergeFromProvider(
    incoming: PlaceMetadata,
    options: { tripId: string; existing?: TravelPlace | null; editorial?: EditorialPlace }
  ): TravelPlace {
    const { tripId, existing = null, editorial } = options;

    if (existing) {
      if (existing.tripId !== tripId) {
        throw new Error(
          `PlaceMergeEngine.mergeFromProvider: tripId incoerente — options.tripId='${tripId}' ma existing.tripId='${existing.tripId}'.`
        );
      }
      return this.mergePlace(existing, incoming);
    }

    const ext = this.externalFromMetadata(incoming);
    const now = new Date();

    const candidate = {
      id: `place-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tripId,
      externalProviderId: ext.providerId,
      source: {
        provider: 'provider' as const,
        providerName: 'mock-real' as const,
        lastSyncAt: now,
      },
      baseData: ext,
      editorial,
      createdAt: now,
      updatedAt: now,
    };

    const result = TravelPlaceSchema.safeParse(candidate);
    if (!result.success) {
      throw new Error(`PlaceMergeEngine.mergeFromProvider: TravelPlace costruito non valido — ${result.error.message}`);
    }
    return result.data;
  }
}
